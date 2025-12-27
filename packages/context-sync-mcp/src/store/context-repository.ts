/**
 * 컨텍스트 CRUD 레포지토리
 * 컨텍스트 생성, 읽기, 업데이트 담당
 */

import * as fs from "fs/promises";
import * as path from "path";
import { randomUUID } from "crypto";
import type {
  SharedContext,
  CreateContextInput,
  UpdateContextInput,
  Decision,
  Approach,
  Blocker,
  AgentHandoff,
} from "../types/index.js";

/**
 * 컨텍스트 CRUD 레포지토리
 */
export class ContextRepository {
  private storePath: string;
  private currentContext: SharedContext | null = null;

  constructor(storePath: string) {
    this.storePath = storePath;
  }

  /**
   * 현재 컨텍스트 로드
   */
  async loadCurrentContext(): Promise<SharedContext | null> {
    const contextPath = path.join(this.storePath, "current.json");
    try {
      const data = await fs.readFile(contextPath, "utf-8");
      this.currentContext = this.deserializeContext(JSON.parse(data));
      return this.currentContext;
    } catch {
      this.currentContext = null;
      return null;
    }
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
   * 현재 컨텍스트 직접 설정 (내부용)
   */
  setContext(context: SharedContext | null): void {
    this.currentContext = context;
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
   * 현재 컨텍스트 저장
   */
  async saveCurrentContext(): Promise<void> {
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
   * 컨텍스트 역직렬화 (Date 객체 복원)
   */
  deserializeContext(data: Record<string, unknown>): SharedContext {
    this.validateRequiredFields(data, [
      "id",
      "projectPath",
      "createdAt",
      "updatedAt",
      "currentWork",
      "conversationSummary",
      "codeChanges",
      "agentChain",
      "version",
    ]);

    const currentWork = data.currentWork as Record<string, unknown>;
    this.validateRequiredFields(currentWork, [
      "goal",
      "status",
      "startedAt",
      "lastActiveAt",
    ]);

    const conversationSummary = data.conversationSummary as Record<
      string,
      unknown
    >;
    this.validateRequiredFields(conversationSummary, [
      "keyDecisions",
      "triedApproaches",
      "blockers",
      "nextSteps",
    ]);

    const safeArray = <T>(arr: unknown): T[] => {
      return Array.isArray(arr) ? arr : [];
    };

    const safeDate = (value: unknown): Date => {
      if (value instanceof Date) return value;
      if (typeof value === "string" || typeof value === "number") {
        const date = new Date(value);
        if (!isNaN(date.getTime())) return date;
      }
      return new Date();
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
        keyDecisions: safeArray<Decision>(
          conversationSummary.keyDecisions
        ).map((d) => ({
          ...d,
          timestamp: safeDate(d.timestamp),
        })),
        triedApproaches: safeArray<Approach>(
          conversationSummary.triedApproaches
        ).map((a) => ({
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
        modifiedFiles: safeArray<string>(
          (data.codeChanges as Record<string, unknown>)?.modifiedFiles
        ),
        summary: String(
          (data.codeChanges as Record<string, unknown>)?.summary || ""
        ),
        uncommittedChanges: Boolean(
          (data.codeChanges as Record<string, unknown>)?.uncommittedChanges
        ),
        lastCommitHash: (data.codeChanges as Record<string, unknown>)
          ?.lastCommitHash as string | undefined,
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
  private validateRequiredFields(
    obj: Record<string, unknown>,
    fields: string[]
  ): void {
    for (const field of fields) {
      if (!(field in obj) || obj[field] === undefined) {
        throw new Error(`필수 필드 누락: ${field}`);
      }
    }
  }
}
