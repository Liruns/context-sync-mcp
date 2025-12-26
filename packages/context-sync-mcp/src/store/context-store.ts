/**
 * Context Store - 컨텍스트 저장소 인터페이스 및 구현
 */

import * as fs from "fs/promises";
import * as path from "path";
import { randomUUID } from "crypto";
import type {
  SharedContext,
  ContextSnapshot,
  CreateContextInput,
  UpdateContextInput,
  Decision,
  Approach,
  Blocker,
  AgentHandoff,
  AgentType,
  ContextSyncConfig,
} from "../types/index.js";

/** 기본 설정 */
const DEFAULT_CONFIG: ContextSyncConfig = {
  syncMode: "seamless",
  triggers: {
    editorSwitch: true,
    fileSave: true,
    idleMinutes: 5,
    gitCommit: true,
  },
  storage: {
    location: ".context-sync",
    maxSnapshots: 100,
    compressionLevel: "medium",
  },
  adapters: {
    "claude-code": { enabled: true },
    cursor: { enabled: true },
    windsurf: { enabled: true },
    copilot: { enabled: false },
    unknown: { enabled: true },
  },
  privacy: {
    excludePatterns: ["*.env", "*secret*", "*password*", "*.pem", "*.key"],
    localOnly: true,
  },
  automation: {
    autoLoad: true,
    autoSave: true,
    autoSync: false,
  },
};

/** 설정 검증 결과 */
export interface ConfigValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/** 설정 검증 상수 */
const CONFIG_LIMITS = {
  MIN_IDLE_MINUTES: 1,
  MAX_IDLE_MINUTES: 60,
  MIN_MAX_SNAPSHOTS: 1,
  MAX_MAX_SNAPSHOTS: 1000,
  VALID_SYNC_MODES: ["seamless", "ask", "manual"] as const,
  VALID_COMPRESSION_LEVELS: ["none", "low", "medium", "high"] as const,
} as const;

/**
 * 설정 검증 함수
 */
function validateConfig(config: Partial<ContextSyncConfig>): ConfigValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // triggers 검증
  if (config.triggers) {
    const { idleMinutes } = config.triggers;
    if (idleMinutes !== undefined) {
      if (typeof idleMinutes !== "number" || !Number.isInteger(idleMinutes)) {
        errors.push("triggers.idleMinutes는 정수여야 합니다");
      } else if (idleMinutes < CONFIG_LIMITS.MIN_IDLE_MINUTES) {
        errors.push(`triggers.idleMinutes는 ${CONFIG_LIMITS.MIN_IDLE_MINUTES}분 이상이어야 합니다`);
      } else if (idleMinutes > CONFIG_LIMITS.MAX_IDLE_MINUTES) {
        warnings.push(`triggers.idleMinutes가 ${CONFIG_LIMITS.MAX_IDLE_MINUTES}분을 초과합니다. 권장하지 않습니다`);
      }
    }
  }

  // storage 검증
  if (config.storage) {
    const { maxSnapshots, compressionLevel, location } = config.storage;

    if (maxSnapshots !== undefined) {
      if (typeof maxSnapshots !== "number" || !Number.isInteger(maxSnapshots)) {
        errors.push("storage.maxSnapshots는 정수여야 합니다");
      } else if (maxSnapshots < CONFIG_LIMITS.MIN_MAX_SNAPSHOTS) {
        errors.push(`storage.maxSnapshots는 ${CONFIG_LIMITS.MIN_MAX_SNAPSHOTS} 이상이어야 합니다`);
      } else if (maxSnapshots > CONFIG_LIMITS.MAX_MAX_SNAPSHOTS) {
        warnings.push(`storage.maxSnapshots가 ${CONFIG_LIMITS.MAX_MAX_SNAPSHOTS}을 초과합니다. 디스크 공간에 주의하세요`);
      }
    }

    if (compressionLevel !== undefined) {
      if (!CONFIG_LIMITS.VALID_COMPRESSION_LEVELS.includes(compressionLevel as typeof CONFIG_LIMITS.VALID_COMPRESSION_LEVELS[number])) {
        errors.push(`storage.compressionLevel은 ${CONFIG_LIMITS.VALID_COMPRESSION_LEVELS.join(", ")} 중 하나여야 합니다`);
      }
    }

    if (location !== undefined && typeof location !== "string") {
      errors.push("storage.location은 문자열이어야 합니다");
    }
  }

  // syncMode 검증
  if (config.syncMode !== undefined) {
    if (!CONFIG_LIMITS.VALID_SYNC_MODES.includes(config.syncMode as typeof CONFIG_LIMITS.VALID_SYNC_MODES[number])) {
      errors.push(`syncMode는 ${CONFIG_LIMITS.VALID_SYNC_MODES.join(", ")} 중 하나여야 합니다`);
    }
  }

  // privacy 검증
  if (config.privacy) {
    if (config.privacy.excludePatterns !== undefined && !Array.isArray(config.privacy.excludePatterns)) {
      errors.push("privacy.excludePatterns는 배열이어야 합니다");
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * 컨텍스트 저장소 클래스
 */
export class ContextStore {
  private config: ContextSyncConfig;
  private storePath: string;
  private currentContext: SharedContext | null = null;

  constructor(projectPath: string, config?: Partial<ContextSyncConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.storePath = path.join(projectPath, this.config.storage.location);
  }

  /**
   * 저장소 초기화
   */
  async initialize(): Promise<void> {
    await fs.mkdir(this.storePath, { recursive: true });
    await fs.mkdir(path.join(this.storePath, "snapshots"), { recursive: true });

    // 설정 파일 로드 또는 생성
    const configPath = path.join(this.storePath, "config.json");
    try {
      const configData = await fs.readFile(configPath, "utf-8");
      const savedConfig = JSON.parse(configData);
      this.config = { ...DEFAULT_CONFIG, ...savedConfig };
    } catch {
      await fs.writeFile(configPath, JSON.stringify(this.config, null, 2));
    }

    // 기존 컨텍스트 로드 시도
    await this.loadCurrentContext();
  }

  /**
   * 현재 설정 가져오기
   */
  getConfig(): ContextSyncConfig {
    return this.config;
  }

  /**
   * 설정 업데이트
   * @throws 설정 검증 실패 시 에러 발생
   */
  async updateConfig(updates: Partial<ContextSyncConfig>): Promise<{ config: ContextSyncConfig; warnings: string[] }> {
    // 설정 검증
    const validation = validateConfig(updates);
    if (!validation.valid) {
      throw new Error(`설정 검증 실패: ${validation.errors.join(", ")}`);
    }

    this.config = { ...this.config, ...updates };
    const configPath = path.join(this.storePath, "config.json");
    await fs.writeFile(configPath, JSON.stringify(this.config, null, 2));

    return {
      config: this.config,
      warnings: validation.warnings,
    };
  }

  /**
   * 설정 검증만 수행 (저장하지 않음)
   */
  validateConfigUpdate(updates: Partial<ContextSyncConfig>): ConfigValidationResult {
    return validateConfig(updates);
  }

  /**
   * 현재 컨텍스트 로드
   */
  private async loadCurrentContext(): Promise<void> {
    const contextPath = path.join(this.storePath, "current.json");
    try {
      const data = await fs.readFile(contextPath, "utf-8");
      this.currentContext = this.deserializeContext(JSON.parse(data));
    } catch {
      this.currentContext = null;
    }
  }

  /**
   * 새 컨텍스트 생성
   */
  async createContext(input: CreateContextInput): Promise<SharedContext> {
    const now = new Date();
    const context: SharedContext = {
      id: randomUUID(),
      projectPath: input.projectPath,
      currentWork: {
        goal: input.goal,
        status: "planning",
        startedAt: now,
        lastActiveAt: now,
        activeFiles: [],
      },
      conversationSummary: {
        keyDecisions: [],
        triedApproaches: [],
        blockers: [],
        nextSteps: [],
      },
      codeChanges: {
        modifiedFiles: [],
        summary: "",
        uncommittedChanges: false,
      },
      agentChain: input.agent
        ? [
            {
              from: "unknown",
              to: input.agent,
              summary: "세션 시작",
              timestamp: now,
            },
          ]
        : [],
      createdAt: now,
      updatedAt: now,
      version: 1,
    };

    this.currentContext = context;
    await this.saveCurrentContext();
    return context;
  }

  /**
   * 현재 컨텍스트 가져오기
   */
  async getContext(): Promise<SharedContext | null> {
    if (!this.currentContext) {
      await this.loadCurrentContext();
    }
    return this.currentContext;
  }

  /**
   * 컨텍스트 업데이트
   */
  async updateContext(update: UpdateContextInput): Promise<SharedContext | null> {
    if (!this.currentContext) {
      return null;
    }

    const now = new Date();

    if (update.goal !== undefined) {
      this.currentContext.currentWork.goal = update.goal;
    }
    if (update.status !== undefined) {
      this.currentContext.currentWork.status = update.status;
    }
    if (update.activeFiles !== undefined) {
      this.currentContext.currentWork.activeFiles = update.activeFiles;
    }
    if (update.nextSteps !== undefined) {
      this.currentContext.conversationSummary.nextSteps = update.nextSteps;
    }

    this.currentContext.currentWork.lastActiveAt = now;
    this.currentContext.updatedAt = now;
    this.currentContext.version += 1;

    await this.saveCurrentContext();
    return this.currentContext;
  }

  /**
   * 의사결정 추가
   */
  async addDecision(what: string, why: string, agent: AgentType = "unknown"): Promise<Decision> {
    if (!this.currentContext) {
      throw new Error("활성 컨텍스트가 없습니다");
    }

    const decision: Decision = {
      id: randomUUID(),
      what,
      why,
      madeBy: agent,
      timestamp: new Date(),
    };

    this.currentContext.conversationSummary.keyDecisions.push(decision);
    this.currentContext.updatedAt = new Date();
    this.currentContext.version += 1;

    await this.saveCurrentContext();
    return decision;
  }

  /**
   * 시도한 접근법 추가
   */
  async addApproach(
    description: string,
    result: "success" | "failed" | "partial",
    reason?: string,
    agent: AgentType = "unknown"
  ): Promise<Approach> {
    if (!this.currentContext) {
      throw new Error("활성 컨텍스트가 없습니다");
    }

    const approach: Approach = {
      id: randomUUID(),
      description,
      result,
      reason,
      attemptedBy: agent,
      timestamp: new Date(),
    };

    this.currentContext.conversationSummary.triedApproaches.push(approach);
    this.currentContext.updatedAt = new Date();
    this.currentContext.version += 1;

    await this.saveCurrentContext();
    return approach;
  }

  /**
   * 블로커 추가
   */
  async addBlocker(description: string): Promise<Blocker> {
    if (!this.currentContext) {
      throw new Error("활성 컨텍스트가 없습니다");
    }

    const blocker: Blocker = {
      id: randomUUID(),
      description,
      resolved: false,
      discoveredAt: new Date(),
    };

    this.currentContext.conversationSummary.blockers.push(blocker);
    this.currentContext.updatedAt = new Date();
    this.currentContext.version += 1;

    await this.saveCurrentContext();
    return blocker;
  }

  /**
   * 블로커 해결
   */
  async resolveBlocker(blockerId: string, resolution: string): Promise<Blocker | null> {
    if (!this.currentContext) {
      return null;
    }

    const blocker = this.currentContext.conversationSummary.blockers.find(
      (b) => b.id === blockerId
    );
    if (!blocker) {
      return null;
    }

    blocker.resolved = true;
    blocker.resolvedAt = new Date();
    blocker.resolution = resolution;

    this.currentContext.updatedAt = new Date();
    this.currentContext.version += 1;

    await this.saveCurrentContext();
    return blocker;
  }

  /**
   * 에이전트 핸드오프 기록
   */
  async recordHandoff(from: AgentType, to: AgentType, summary: string): Promise<AgentHandoff> {
    if (!this.currentContext) {
      throw new Error("활성 컨텍스트가 없습니다");
    }

    const handoff: AgentHandoff = {
      from,
      to,
      summary,
      timestamp: new Date(),
    };

    this.currentContext.agentChain.push(handoff);
    this.currentContext.updatedAt = new Date();
    this.currentContext.version += 1;

    await this.saveCurrentContext();
    return handoff;
  }

  /**
   * 코드 변경 업데이트
   */
  async updateCodeChanges(
    modifiedFiles: string[],
    summary: string,
    uncommitted: boolean
  ): Promise<void> {
    if (!this.currentContext) {
      return;
    }

    this.currentContext.codeChanges = {
      modifiedFiles,
      summary,
      uncommittedChanges: uncommitted,
    };
    this.currentContext.updatedAt = new Date();
    this.currentContext.version += 1;

    await this.saveCurrentContext();
  }

  /**
   * 스냅샷 생성
   */
  async createSnapshot(reason: "auto" | "manual" | "handoff" | "milestone"): Promise<ContextSnapshot | null> {
    if (!this.currentContext) {
      return null;
    }

    const snapshot: ContextSnapshot = {
      id: randomUUID(),
      contextId: this.currentContext.id,
      data: { ...this.currentContext },
      reason,
      timestamp: new Date(),
    };

    const snapshotPath = path.join(
      this.storePath,
      "snapshots",
      `${snapshot.id}.json`
    );
    await fs.writeFile(snapshotPath, JSON.stringify(snapshot, null, 2));

    // 오래된 스냅샷 정리
    await this.cleanupOldSnapshots();

    return snapshot;
  }

  /**
   * 스냅샷 목록 가져오기
   */
  async listSnapshots(): Promise<ContextSnapshot[]> {
    const snapshotsDir = path.join(this.storePath, "snapshots");
    try {
      const files = await fs.readdir(snapshotsDir);
      const snapshots: ContextSnapshot[] = [];

      for (const file of files) {
        if (file.endsWith(".json")) {
          try {
            const data = await fs.readFile(path.join(snapshotsDir, file), "utf-8");
            snapshots.push(JSON.parse(data));
          } catch (parseErr) {
            // 손상된 스냅샷 파일 무시 (로깅만)
            console.warn(`스냅샷 파일 읽기 실패: ${file}`, parseErr);
          }
        }
      }

      return snapshots.sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
    } catch (err) {
      // 디렉토리가 없는 경우 빈 배열 반환
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        return [];
      }
      console.error("스냅샷 목록 조회 실패:", err);
      return [];
    }
  }

  /**
   * 스냅샷에서 복원
   * @throws 복원 실패 시 상세 에러 정보 포함
   */
  async restoreFromSnapshot(snapshotId: string): Promise<SharedContext | null> {
    const snapshotPath = path.join(
      this.storePath,
      "snapshots",
      `${snapshotId}.json`
    );
    try {
      const data = await fs.readFile(snapshotPath, "utf-8");
      const snapshot: ContextSnapshot = JSON.parse(data);
      this.currentContext = this.deserializeContext(snapshot.data as unknown as Record<string, unknown>);
      this.currentContext.version += 1;
      this.currentContext.updatedAt = new Date();
      await this.saveCurrentContext();
      return this.currentContext;
    } catch (err) {
      const errCode = (err as NodeJS.ErrnoException).code;
      if (errCode === "ENOENT") {
        console.warn(`스냅샷을 찾을 수 없음: ${snapshotId}`);
      } else if (err instanceof SyntaxError) {
        console.error(`스냅샷 JSON 파싱 실패: ${snapshotId}`, err);
      } else {
        console.error(`스냅샷 복원 실패: ${snapshotId}`, err);
      }
      return null;
    }
  }

  /**
   * 컨텍스트 요약 생성
   */
  async getSummary(): Promise<string> {
    if (!this.currentContext) {
      return "활성 컨텍스트가 없습니다.";
    }

    const ctx = this.currentContext;
    const decisions = ctx.conversationSummary.keyDecisions
      .slice(-3)
      .map((d) => `- ${d.what}`)
      .join("\n");
    const blockers = ctx.conversationSummary.blockers
      .filter((b) => !b.resolved)
      .map((b) => `- ${b.description}`)
      .join("\n");
    const nextSteps = ctx.conversationSummary.nextSteps
      .slice(0, 3)
      .map((s) => `- ${s}`)
      .join("\n");
    const lastAgent = ctx.agentChain.at(-1);

    return `
## 작업 컨텍스트 요약

**목표**: ${ctx.currentWork.goal}
**상태**: ${ctx.currentWork.status}
**마지막 활동**: ${lastAgent ? `${lastAgent.from} → ${lastAgent.to}` : "없음"}

### 주요 결정사항
${decisions || "없음"}

### 해결되지 않은 블로커
${blockers || "없음"}

### 다음 단계
${nextSteps || "없음"}

### 변경된 파일
${ctx.codeChanges.modifiedFiles.join(", ") || "없음"}
`.trim();
  }

  /**
   * 현재 컨텍스트 저장
   */
  private async saveCurrentContext(): Promise<void> {
    if (!this.currentContext) {
      return;
    }

    const contextPath = path.join(this.storePath, "current.json");
    await fs.writeFile(
      contextPath,
      JSON.stringify(this.currentContext, null, 2)
    );
  }

  /**
   * 오래된 스냅샷 정리
   * @returns 삭제된 스냅샷 수와 실패한 삭제 수
   */
  private async cleanupOldSnapshots(): Promise<{ deleted: number; failed: number }> {
    const result = { deleted: 0, failed: 0 };

    try {
      const snapshots = await this.listSnapshots();
      if (snapshots.length <= this.config.storage.maxSnapshots) {
        return result;
      }

      const toDelete = snapshots.slice(this.config.storage.maxSnapshots);
      for (const snapshot of toDelete) {
        const snapshotPath = path.join(
          this.storePath,
          "snapshots",
          `${snapshot.id}.json`
        );
        try {
          await fs.unlink(snapshotPath);
          result.deleted++;
        } catch (err) {
          result.failed++;
          // 파일이 이미 없는 경우는 무시, 그 외는 로깅
          if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
            console.error(`스냅샷 삭제 실패: ${snapshotPath}`, err);
          }
        }
      }
    } catch (err) {
      console.error("스냅샷 정리 중 오류 발생:", err);
    }

    return result;
  }

  /**
   * 컨텍스트 역직렬화 (Date 객체 복원)
   * @throws 필수 필드가 없거나 형식이 잘못된 경우 에러 발생
   */
  private deserializeContext(data: Record<string, unknown>): SharedContext {
    // 필수 필드 검증
    this.validateRequiredFields(data, ["id", "projectPath", "createdAt", "updatedAt", "currentWork", "conversationSummary", "codeChanges", "agentChain", "version"]);

    const currentWork = data.currentWork as Record<string, unknown>;
    this.validateRequiredFields(currentWork, ["goal", "status", "startedAt", "lastActiveAt"]);

    const conversationSummary = data.conversationSummary as Record<string, unknown>;
    this.validateRequiredFields(conversationSummary, ["keyDecisions", "triedApproaches", "blockers", "nextSteps"]);

    // 안전한 배열 변환 헬퍼
    const safeArray = <T>(arr: unknown): T[] => {
      return Array.isArray(arr) ? arr : [];
    };

    // 안전한 Date 변환 헬퍼
    const safeDate = (value: unknown): Date => {
      if (value instanceof Date) return value;
      if (typeof value === "string" || typeof value === "number") {
        const date = new Date(value);
        if (!isNaN(date.getTime())) return date;
      }
      return new Date(); // 기본값
    };

    return {
      id: String(data.id),
      projectPath: String(data.projectPath),
      version: Number(data.version) || 1,
      createdAt: safeDate(data.createdAt),
      updatedAt: safeDate(data.updatedAt),
      currentWork: {
        goal: String(currentWork.goal),
        status: currentWork.status as SharedContext["currentWork"]["status"],
        startedAt: safeDate(currentWork.startedAt),
        lastActiveAt: safeDate(currentWork.lastActiveAt),
        activeFiles: safeArray<string>(currentWork.activeFiles),
      },
      conversationSummary: {
        keyDecisions: safeArray<Decision>(conversationSummary.keyDecisions).map((d) => ({
          ...d,
          timestamp: safeDate(d.timestamp),
        })),
        triedApproaches: safeArray<Approach>(conversationSummary.triedApproaches).map((a) => ({
          ...a,
          timestamp: safeDate(a.timestamp),
        })),
        blockers: safeArray<Blocker>(conversationSummary.blockers).map((b) => ({
          ...b,
          discoveredAt: safeDate(b.discoveredAt),
          resolvedAt: b.resolvedAt ? safeDate(b.resolvedAt) : undefined,
        })),
        nextSteps: safeArray<string>(conversationSummary.nextSteps),
      },
      codeChanges: {
        modifiedFiles: safeArray<string>((data.codeChanges as Record<string, unknown>)?.modifiedFiles),
        summary: String((data.codeChanges as Record<string, unknown>)?.summary || ""),
        uncommittedChanges: Boolean((data.codeChanges as Record<string, unknown>)?.uncommittedChanges),
        lastCommitHash: (data.codeChanges as Record<string, unknown>)?.lastCommitHash as string | undefined,
      },
      agentChain: safeArray<AgentHandoff>(data.agentChain).map((h) => ({
        ...h,
        timestamp: safeDate(h.timestamp),
      })),
    };
  }

  /**
   * 필수 필드 검증 헬퍼
   */
  private validateRequiredFields(obj: Record<string, unknown>, fields: string[]): void {
    for (const field of fields) {
      if (!(field in obj) || obj[field] === undefined) {
        throw new Error(`필수 필드 누락: ${field}`);
      }
    }
  }
}
