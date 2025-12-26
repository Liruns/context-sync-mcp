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
};

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

    // 설정 파일 생성 (없으면)
    const configPath = path.join(this.storePath, "config.json");
    try {
      await fs.access(configPath);
    } catch {
      await fs.writeFile(configPath, JSON.stringify(this.config, null, 2));
    }

    // 기존 컨텍스트 로드 시도
    await this.loadCurrentContext();
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
      throw new Error("No active context");
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
      throw new Error("No active context");
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
      throw new Error("No active context");
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
      throw new Error("No active context");
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
          const data = await fs.readFile(path.join(snapshotsDir, file), "utf-8");
          snapshots.push(JSON.parse(data));
        }
      }

      return snapshots.sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
    } catch {
      return [];
    }
  }

  /**
   * 스냅샷에서 복원
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
    } catch {
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
   */
  private async cleanupOldSnapshots(): Promise<void> {
    const snapshots = await this.listSnapshots();
    if (snapshots.length <= this.config.storage.maxSnapshots) {
      return;
    }

    const toDelete = snapshots.slice(this.config.storage.maxSnapshots);
    for (const snapshot of toDelete) {
      const snapshotPath = path.join(
        this.storePath,
        "snapshots",
        `${snapshot.id}.json`
      );
      await fs.unlink(snapshotPath).catch(() => {});
    }
  }

  /**
   * 컨텍스트 역직렬화 (Date 객체 복원)
   */
  private deserializeContext(data: Record<string, unknown>): SharedContext {
    return {
      ...data,
      createdAt: new Date(data.createdAt as string),
      updatedAt: new Date(data.updatedAt as string),
      currentWork: {
        ...(data.currentWork as Record<string, unknown>),
        startedAt: new Date((data.currentWork as Record<string, unknown>).startedAt as string),
        lastActiveAt: new Date((data.currentWork as Record<string, unknown>).lastActiveAt as string),
      },
      conversationSummary: {
        ...(data.conversationSummary as Record<string, unknown>),
        keyDecisions: ((data.conversationSummary as Record<string, unknown>).keyDecisions as Decision[]).map((d) => ({
          ...d,
          timestamp: new Date(d.timestamp),
        })),
        triedApproaches: ((data.conversationSummary as Record<string, unknown>).triedApproaches as Approach[]).map((a) => ({
          ...a,
          timestamp: new Date(a.timestamp),
        })),
        blockers: ((data.conversationSummary as Record<string, unknown>).blockers as Blocker[]).map((b) => ({
          ...b,
          discoveredAt: new Date(b.discoveredAt),
          resolvedAt: b.resolvedAt ? new Date(b.resolvedAt) : undefined,
        })),
      },
      agentChain: (data.agentChain as AgentHandoff[]).map((h) => ({
        ...h,
        timestamp: new Date(h.timestamp),
      })),
    } as SharedContext;
  }
}
