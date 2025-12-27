/**
 * Context Store - 컨텍스트 저장소 파사드
 * v2.0: SQLite 하이브리드 저장소 + 모듈화
 *
 * 이 클래스는 파사드 패턴을 사용하여 여러 레포지토리를 통합 인터페이스로 제공합니다.
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
  ContextSearchInput,
  ContextSearchOutput,
  ContextGetInput,
  ContextGetOutput,
  ContextWarnInput,
  ContextWarnOutput,
  ContextSaveInput,
  ContextCleanupInput,
  ContextCleanupOutput,
  ContextArchiveInput,
  ContextArchiveOutput,
} from "../types/index.js";

// 모듈 임포트
import {
  ConfigManager,
  DEFAULT_CONFIG,
  type ConfigValidationResult,
} from "./config-manager.js";
import { ContextRepository } from "./context-repository.js";
import { MetadataRepository } from "./metadata-repository.js";
import { SnapshotRepository } from "./snapshot-repository.js";

// DB 임포트
import {
  initDatabaseAsync,
  closeDatabase,
  type DatabaseInstance,
} from "../db/index.js";
import { migrateFromJSON, needsMigration } from "../db/migrate.js";
import {
  generateGoalShort,
  generateSummaryShort,
  hasWarnings,
} from "../utils/truncate.js";
import { searchContexts as dbSearchContexts } from "../tools/context-search.js";
import { getContext as dbGetContext } from "../tools/context-get.js";
import { getContextWarnings as dbGetWarnings } from "../tools/context-warn.js";

// 타입 재내보내기 (하위 호환성)
export type { ConfigValidationResult };

/**
 * 컨텍스트 저장소 클래스 (파사드)
 * v2.0: SQLite 하이브리드 저장소
 */
export class ContextStore {
  // 레포지토리들
  private configManager: ConfigManager;
  private contextRepo: ContextRepository;
  private metadataRepo: MetadataRepository;
  private snapshotRepo: SnapshotRepository;

  // DB 관련
  private db: DatabaseInstance | null = null;
  private dbEnabled: boolean = false;
  private storePath: string;

  constructor(projectPath: string, config?: Partial<ContextSyncConfig>) {
    const mergedConfig = { ...DEFAULT_CONFIG, ...config };
    this.storePath = path.join(projectPath, mergedConfig.storage.location);

    // 레포지토리 초기화
    this.configManager = new ConfigManager(projectPath, config);
    this.contextRepo = new ContextRepository(this.storePath);
    this.metadataRepo = new MetadataRepository(this.contextRepo);
    this.snapshotRepo = new SnapshotRepository(
      this.storePath,
      this.contextRepo,
      mergedConfig.storage.maxSnapshots
    );
  }

  // ========================================
  // 초기화 및 종료
  // ========================================

  /**
   * 저장소 초기화
   */
  async initialize(): Promise<void> {
    await fs.mkdir(this.storePath, { recursive: true });
    await fs.mkdir(path.join(this.storePath, "snapshots"), { recursive: true });

    // 설정 로드
    await this.configManager.load();

    // 컨텍스트 로드
    await this.contextRepo.loadCurrentContext();

    // v2.0: SQLite DB 초기화
    try {
      this.db = await initDatabaseAsync(this.storePath);

      if (this.db) {
        this.dbEnabled = true;

        // 자동 마이그레이션
        if (needsMigration(this.db, this.storePath)) {
          const result = migrateFromJSON(this.db, this.storePath);
          if (!result.success) {
            console.warn("마이그레이션 경고:", result.errors);
          }
        }
      } else {
        this.dbEnabled = false;
        console.warn("SQLite 사용 불가, JSON 폴백 모드로 동작합니다.");
      }
    } catch (err) {
      console.warn("SQLite 초기화 실패, JSON 폴백 사용:", err);
      this.dbEnabled = false;
    }
  }

  /**
   * 저장소 종료
   */
  async close(): Promise<void> {
    if (this.db) {
      closeDatabase(this.db);
      this.db = null;
      this.dbEnabled = false;
    }
  }

  // ========================================
  // DB 접근
  // ========================================

  /**
   * DB 인스턴스 가져오기
   */
  getDatabase(): DatabaseInstance | null {
    return this.db;
  }

  /**
   * DB 활성화 여부
   */
  isDbEnabled(): boolean {
    return this.dbEnabled && this.db !== null;
  }

  // ========================================
  // 설정 관리 (ConfigManager 위임)
  // ========================================

  /**
   * 현재 설정 가져오기
   */
  getConfig(): ContextSyncConfig {
    return this.configManager.getConfig();
  }

  /**
   * 설정 업데이트
   */
  async updateConfig(
    updates: Partial<ContextSyncConfig>
  ): Promise<{ config: ContextSyncConfig; warnings: string[] }> {
    const result = await this.configManager.updateConfig(updates);

    // maxSnapshots 변경 시 SnapshotRepository에도 반영
    if (updates.storage?.maxSnapshots !== undefined) {
      this.snapshotRepo.setMaxSnapshots(updates.storage.maxSnapshots);
    }

    return result;
  }

  /**
   * 설정 검증만 수행
   */
  validateConfigUpdate(
    updates: Partial<ContextSyncConfig>
  ): ConfigValidationResult {
    return this.configManager.validateUpdate(updates);
  }

  // ========================================
  // 컨텍스트 CRUD (ContextRepository 위임)
  // ========================================

  /**
   * 새 컨텍스트 생성
   */
  async createContext(input: CreateContextInput): Promise<SharedContext> {
    return this.contextRepo.createContext(input);
  }

  /**
   * 현재 컨텍스트 가져오기
   */
  async getContext(): Promise<SharedContext | null> {
    return this.contextRepo.getContext();
  }

  /**
   * 컨텍스트 업데이트
   */
  async updateContext(
    update: UpdateContextInput
  ): Promise<SharedContext | null> {
    return this.contextRepo.updateContext(update);
  }

  /**
   * 코드 변경 업데이트
   */
  async updateCodeChanges(
    modifiedFiles: string[],
    summary: string,
    uncommitted: boolean
  ): Promise<void> {
    return this.contextRepo.updateCodeChanges(
      modifiedFiles,
      summary,
      uncommitted
    );
  }

  /**
   * 컨텍스트 요약 생성
   */
  async getSummary(): Promise<string> {
    return this.contextRepo.getSummary();
  }

  // ========================================
  // 메타데이터 (MetadataRepository 위임)
  // ========================================

  /**
   * 의사결정 추가
   */
  async addDecision(
    what: string,
    why: string,
    agent: AgentType = "unknown"
  ): Promise<Decision> {
    return this.metadataRepo.addDecision(what, why, agent);
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
    return this.metadataRepo.addApproach(description, result, reason, agent);
  }

  /**
   * 블로커 추가
   */
  async addBlocker(description: string): Promise<Blocker> {
    return this.metadataRepo.addBlocker(description);
  }

  /**
   * 블로커 해결
   */
  async resolveBlocker(
    blockerId: string,
    resolution: string
  ): Promise<Blocker | null> {
    return this.metadataRepo.resolveBlocker(blockerId, resolution);
  }

  /**
   * 에이전트 핸드오프 기록
   */
  async recordHandoff(
    from: AgentType,
    to: AgentType,
    summary: string
  ): Promise<AgentHandoff> {
    return this.metadataRepo.recordHandoff(from, to, summary);
  }

  // ========================================
  // 스냅샷 (SnapshotRepository 위임)
  // ========================================

  /**
   * 스냅샷 생성
   */
  async createSnapshot(
    reason: "auto" | "manual" | "handoff" | "milestone"
  ): Promise<ContextSnapshot | null> {
    return this.snapshotRepo.createSnapshot(reason);
  }

  /**
   * 스냅샷 목록 가져오기
   */
  async listSnapshots(): Promise<ContextSnapshot[]> {
    return this.snapshotRepo.listSnapshots();
  }

  /**
   * 스냅샷에서 복원
   */
  async restoreFromSnapshot(snapshotId: string): Promise<SharedContext | null> {
    return this.snapshotRepo.restoreFromSnapshot(snapshotId);
  }

  // ========================================
  // v2.0 토큰 효율적 메서드들
  // ========================================

  /**
   * 컨텍스트 저장 (v2.0 확장)
   */
  async saveContext(
    input: ContextSaveInput
  ): Promise<{ id: string; message: string }> {
    const now = new Date();
    const id = randomUUID();

    const goalShort = generateGoalShort(input.goal);
    const summaryShort = generateSummaryShort(input.summary);
    const hasWarningsFlag = hasWarnings({
      approaches: input.approaches?.map((a) => ({ result: a.result })),
      blockers: input.blockers?.map((b) => ({ resolved: b.resolved ?? false })),
    });

    const metadata = {
      decisions: (input.decisions || []).map((d) => ({
        what: d.what,
        why: d.why,
        madeBy: input.agent || "unknown",
        timestamp: now.toISOString(),
      })),
      approaches: (input.approaches || []).map((a) => ({
        description: a.description,
        result: a.result,
        reason: a.reason,
        timestamp: now.toISOString(),
      })),
      blockers: (input.blockers || []).map((b) => ({
        description: b.description,
        resolved: b.resolved ?? false,
        resolution: b.resolution,
        discoveredAt: now.toISOString(),
        resolvedAt: b.resolved ? now.toISOString() : undefined,
      })),
      codeChanges: input.codeChanges,
      nextSteps: input.nextSteps || [],
    };

    // DB에 저장
    if (this.db && this.dbEnabled) {
      try {
        this.db
          .prepare(
            `
          INSERT INTO contexts (
            id, parent_id, goal, goal_short, summary, summary_short,
            status, tags, agent, metadata, has_warnings, project_path,
            started_at, created_at, updated_at, version
          ) VALUES (
            ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?
          )
        `
          )
          .run(
            id,
            input.parentId || null,
            input.goal,
            goalShort,
            input.summary || null,
            summaryShort,
            input.status || "planning",
            JSON.stringify(input.tags || []),
            input.agent || null,
            JSON.stringify(metadata),
            hasWarningsFlag ? 1 : 0,
            this.storePath,
            now.toISOString(),
            now.toISOString(),
            now.toISOString(),
            1
          );
        // sql.js는 메모리 기반이므로 명시적 저장 필요
        this.db.save();
      } catch (err) {
        console.error("DB 저장 실패:", err);
      }
    }

    // 기존 방식으로도 저장 (하위 호환성)
    await this.createContext({
      projectPath: this.storePath,
      goal: input.goal,
      agent: input.agent,
    });

    return {
      id,
      message: `컨텍스트 저장 완료: ${goalShort}`,
    };
  }

  /**
   * 컨텍스트 검색 (v2.0 힌트 기반)
   */
  searchContexts(input: ContextSearchInput): ContextSearchOutput {
    if (!this.db || !this.dbEnabled) {
      return { hints: [], total: 0, hasMore: false };
    }
    return dbSearchContexts(this.db, input);
  }

  /**
   * 컨텍스트 상세 조회 (v2.0)
   */
  getContextById(input: ContextGetInput): ContextGetOutput | null {
    if (!this.db || !this.dbEnabled) {
      return null;
    }
    return dbGetContext(this.db, input);
  }

  /**
   * 경고/추천 조회 (v2.0)
   */
  getWarnings(input: ContextWarnInput): ContextWarnOutput {
    if (!this.db || !this.dbEnabled) {
      return { warnings: [], recommendations: [], hasMore: false };
    }
    return dbGetWarnings(this.db, input);
  }

  /**
   * 액션 로그 추가 (v2.0)
   */
  async addAction(
    contextId: string,
    type: "command" | "edit" | "error",
    content: string,
    result?: string,
    filePath?: string
  ): Promise<void> {
    if (!this.db || !this.dbEnabled) return;

    try {
      this.db
        .prepare(
          `
        INSERT INTO actions (id, context_id, type, content, result, file_path, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `
        )
        .run(
          randomUUID(),
          contextId,
          type,
          content,
          result || null,
          filePath || null,
          new Date().toISOString()
        );
      this.db.save();
    } catch (err) {
      console.error("액션 로그 저장 실패:", err);
    }
  }

  // ========================================
  // v2.3 유지보수 메서드들
  // ========================================

  /**
   * 기간 문자열을 Date로 변환 (예: "30d" -> 30일 전)
   */
  private parseDuration(duration: string): Date {
    const match = duration.match(/^(\d+)(d|w|m)$/);
    if (!match) {
      return new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 기본 30일
    }
    const value = parseInt(match[1], 10);
    const unit = match[2];
    const now = Date.now();
    switch (unit) {
      case "d":
        return new Date(now - value * 24 * 60 * 60 * 1000);
      case "w":
        return new Date(now - value * 7 * 24 * 60 * 60 * 1000);
      case "m":
        return new Date(now - value * 30 * 24 * 60 * 60 * 1000);
      default:
        return new Date(now - 30 * 24 * 60 * 60 * 1000);
    }
  }

  /**
   * 컨텍스트 정리 (v2.3)
   */
  async cleanupContexts(input: ContextCleanupInput): Promise<ContextCleanupOutput> {
    const {
      olderThan = "30d",
      removeResolvedBlockers = false,
      keepOnlySuccessful = false,
      removeCompleted = false,
      dryRun = true,
    } = input;

    const cutoffDate = this.parseDuration(olderThan);
    const cutoffISO = cutoffDate.toISOString();

    const deleted = {
      decisions: 0,
      approaches: 0,
      blockers: 0,
      contexts: 0,
      snapshots: 0,
    };

    const context = await this.getContext();
    if (context) {
      const summary = context.conversationSummary;

      // 오래된 decisions 카운트
      const oldDecisions = summary.keyDecisions.filter(
        (d) => new Date(d.timestamp) < cutoffDate
      );
      deleted.decisions = oldDecisions.length;

      // 오래된 approaches 카운트
      let oldApproaches = summary.triedApproaches.filter(
        (a) => new Date(a.timestamp) < cutoffDate
      );
      if (keepOnlySuccessful) {
        oldApproaches = oldApproaches.filter((a) => a.result !== "success");
      }
      deleted.approaches = oldApproaches.length;

      // 해결된 blockers 카운트
      if (removeResolvedBlockers) {
        deleted.blockers = summary.blockers.filter((b) => b.resolved).length;
      }

      // 실제 삭제 수행
      if (!dryRun && context) {
        // decisions 정리
        context.conversationSummary.keyDecisions = summary.keyDecisions.filter(
          (d) => new Date(d.timestamp) >= cutoffDate
        );

        // approaches 정리
        if (keepOnlySuccessful) {
          context.conversationSummary.triedApproaches = summary.triedApproaches.filter(
            (a) => new Date(a.timestamp) >= cutoffDate || a.result === "success"
          );
        } else {
          context.conversationSummary.triedApproaches = summary.triedApproaches.filter(
            (a) => new Date(a.timestamp) >= cutoffDate
          );
        }

        // blockers 정리
        if (removeResolvedBlockers) {
          context.conversationSummary.blockers = summary.blockers.filter(
            (b) => !b.resolved
          );
        }

        // 저장
        await this.contextRepo.updateContext({
          goal: context.currentWork.goal,
        });
      }
    }

    // 스냅샷 정리
    const snapshots = await this.listSnapshots();
    const oldSnapshots = snapshots.filter(
      (s) => new Date(s.timestamp) < cutoffDate
    );
    deleted.snapshots = oldSnapshots.length;

    if (!dryRun) {
      for (const snapshot of oldSnapshots) {
        const snapshotPath = path.join(
          this.storePath,
          "snapshots",
          `${snapshot.id}.json`
        );
        try {
          await fs.unlink(snapshotPath);
        } catch {
          // 파일 없으면 무시
        }
      }
    }

    // 완료된 컨텍스트 삭제 (DB)
    if (removeCompleted && this.db && this.dbEnabled) {
      try {
        const countResult = this.db
          .prepare(
            `SELECT COUNT(*) as count FROM contexts WHERE status = 'completed' AND created_at < ?`
          )
          .get(cutoffISO) as { count: number } | undefined;
        deleted.contexts = countResult?.count || 0;

        if (!dryRun) {
          this.db
            .prepare(
              `DELETE FROM contexts WHERE status = 'completed' AND created_at < ?`
            )
            .run(cutoffISO);
          this.db.save();
        }
      } catch (err) {
        console.error("DB 정리 실패:", err);
      }
    }

    // 남은 항목 카운트
    const remaining = {
      decisions: context?.conversationSummary.keyDecisions.length || 0,
      approaches: context?.conversationSummary.triedApproaches.length || 0,
      blockers: context?.conversationSummary.blockers.length || 0,
      contexts: 0,
      snapshots: snapshots.length - deleted.snapshots,
    };

    if (this.db && this.dbEnabled) {
      try {
        const contextCount = this.db
          .prepare(`SELECT COUNT(*) as count FROM contexts`)
          .get() as { count: number } | undefined;
        remaining.contexts = contextCount?.count || 0;
      } catch {
        // 무시
      }
    }

    const totalDeleted =
      deleted.decisions +
      deleted.approaches +
      deleted.blockers +
      deleted.contexts +
      deleted.snapshots;

    return {
      deleted,
      remaining,
      dryRun,
      message: dryRun
        ? `미리보기: ${totalDeleted}개 항목이 삭제 대상입니다. 실제 삭제하려면 dryRun: false로 설정하세요.`
        : `${totalDeleted}개 항목이 삭제되었습니다.`,
    };
  }

  /**
   * 컨텍스트 아카이브 (v2.3)
   */
  async archiveContexts(input: ContextArchiveInput): Promise<ContextArchiveOutput> {
    const {
      reason = "archived",
      contextIds,
      completedOnly = true,
      deleteAfterArchive = false,
    } = input;

    const archiveDir = path.join(this.storePath, "archives");
    await fs.mkdir(archiveDir, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const archiveFileName = `archive-${timestamp}.json`;
    const archivePath = path.join(archiveDir, archiveFileName);

    const toArchive: SharedContext[] = [];
    let deletedCount = 0;

    // 현재 컨텍스트 아카이브
    const context = await this.getContext();
    if (context) {
      const shouldArchive =
        !contextIds || contextIds.includes(context.id);
      const isCompleted = context.currentWork.status === "completed";

      if (shouldArchive && (!completedOnly || isCompleted)) {
        toArchive.push(context);
      }
    }

    // DB에서 컨텍스트 가져오기
    if (this.db && this.dbEnabled) {
      try {
        let query = `SELECT * FROM contexts`;
        const params: string[] = [];

        if (contextIds && contextIds.length > 0) {
          query += ` WHERE id IN (${contextIds.map(() => "?").join(",")})`;
          params.push(...contextIds);
        } else if (completedOnly) {
          query += ` WHERE status = 'completed'`;
        }

        const rows = this.db.prepare(query).all(...params) as Array<{
          id: string;
          goal: string;
          status: string;
          metadata: string;
          created_at: string;
        }>;

        for (const row of rows) {
          // 이미 추가된 것 제외
          if (!toArchive.find((c) => c.id === row.id)) {
            toArchive.push({
              id: row.id,
              projectPath: this.storePath,
              currentWork: {
                goal: row.goal,
                status: row.status as any,
                startedAt: new Date(row.created_at),
                lastActiveAt: new Date(row.created_at),
              },
              conversationSummary: JSON.parse(row.metadata || "{}"),
              codeChanges: {
                modifiedFiles: [],
                summary: "",
                uncommittedChanges: false,
              },
              agentChain: [],
              createdAt: new Date(row.created_at),
              updatedAt: new Date(row.created_at),
              version: 1,
            } as SharedContext);
          }
        }
      } catch (err) {
        console.error("DB 아카이브 조회 실패:", err);
      }
    }

    // 아카이브 파일 저장
    const archiveData = {
      reason,
      createdAt: new Date().toISOString(),
      contexts: toArchive,
    };

    await fs.writeFile(archivePath, JSON.stringify(archiveData, null, 2));

    // 원본 삭제
    if (deleteAfterArchive && this.db && this.dbEnabled) {
      try {
        for (const ctx of toArchive) {
          this.db.prepare(`DELETE FROM contexts WHERE id = ?`).run(ctx.id);
          deletedCount++;
        }
        this.db.save();
      } catch (err) {
        console.error("원본 삭제 실패:", err);
      }
    }

    return {
      archivedCount: toArchive.length,
      archivePath,
      deletedCount,
      message: `${toArchive.length}개 컨텍스트가 아카이브되었습니다: ${archivePath}`,
    };
  }
}
