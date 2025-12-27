/**
 * Context Sync MCP v2.2 - Archive Service
 * 오래된 컨텍스트 아카이빙 및 복원
 */

import type { DatabaseInstance } from '../db/index.js';
import type { ContextDbRecord, ActionRecord } from '../types/index.js';

/**
 * 아카이브 설정
 */
export interface ArchiveConfig {
  /** 아카이브할 일 수 (기본: 90일) */
  archiveAfterDays: number;
  /** 아카이브에서 삭제할 일 수 (기본: 365일) */
  deleteAfterDays: number;
  /** 배치 크기 (기본: 100) */
  batchSize: number;
}

/**
 * 아카이브 결과
 */
export interface ArchiveResult {
  archived: number;
  failed: number;
}

/**
 * 아카이브 통계
 */
export interface ArchiveStats {
  archiveCount: number;
  oldestArchive: string | null;
  newestArchive: string | null;
  totalSizeEstimate: number;
}

/**
 * 아카이브된 컨텍스트
 */
export interface ArchivedContext {
  id: string;
  goal: string;
  archivedAt: string;
  reason: string;
}

const DEFAULT_CONFIG: ArchiveConfig = {
  archiveAfterDays: 90,
  deleteAfterDays: 365,
  batchSize: 100,
};

/**
 * Archive Service
 * 오래된 컨텍스트를 아카이브하고 복원하는 서비스
 */
export class ArchiveService {
  private db: DatabaseInstance;
  private config: ArchiveConfig;

  constructor(db: DatabaseInstance, config: Partial<ArchiveConfig> = {}) {
    this.db = db;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 오래된 컨텍스트 아카이브
   * completed 상태인 컨텍스트만 아카이브
   */
  archiveOldContexts(daysOld?: number): ArchiveResult {
    const days = daysOld ?? this.config.archiveAfterDays;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    const cutoff = cutoffDate.toISOString();

    let archived = 0;
    let failed = 0;

    // 배치 처리
    while (true) {
      const batch = this.db.prepare(`
        SELECT * FROM contexts
        WHERE created_at < ? AND status = 'completed'
        LIMIT ?
      `).all(cutoff, this.config.batchSize) as ContextDbRecord[];

      if (batch.length === 0) break;

      const transaction = this.db.transaction(() => {
        for (const ctx of batch) {
          try {
            // 액션 조회
            const actions = this.db.prepare(
              'SELECT * FROM actions WHERE context_id = ?'
            ).all(ctx.id) as ActionRecord[];

            // 아카이브 데이터 생성
            const archiveData = JSON.stringify({
              context: ctx,
              actions,
              archivedAt: new Date().toISOString(),
            });

            // 아카이브 테이블에 삽입
            this.db.prepare(`
              INSERT INTO contexts_archive (id, original_data, archive_reason)
              VALUES (?, ?, 'age')
            `).run(ctx.id, archiveData);

            // 원본 삭제 (context_tags는 트리거로 자동 삭제)
            this.db.prepare('DELETE FROM actions WHERE context_id = ?').run(ctx.id);
            this.db.prepare('DELETE FROM contexts WHERE id = ?').run(ctx.id);

            archived++;
          } catch (err) {
            console.error(`[Archive] Failed to archive ${ctx.id}:`, err);
            failed++;
          }
        }
      });

      transaction();
      this.db.save();
    }

    return { archived, failed };
  }

  /**
   * 오래된 아카이브 삭제
   */
  purgeOldArchives(daysOld?: number): number {
    const days = daysOld ?? this.config.deleteAfterDays;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    const cutoff = cutoffDate.toISOString();

    const result = this.db.prepare(`
      DELETE FROM contexts_archive WHERE archived_at < ?
    `).run(cutoff);

    this.db.save();
    return result.changes;
  }

  /**
   * 아카이브에서 복원
   */
  restoreFromArchive(contextId: string): boolean {
    const archived = this.db.prepare(`
      SELECT original_data FROM contexts_archive WHERE id = ?
    `).get(contextId) as { original_data: string } | undefined;

    if (!archived) {
      return false;
    }

    try {
      const data = JSON.parse(archived.original_data) as {
        context: ContextDbRecord;
        actions: ActionRecord[];
      };

      const transaction = this.db.transaction(() => {
        const ctx = data.context;

        // 컨텍스트 복원
        this.db.prepare(`
          INSERT INTO contexts (
            id, parent_id, goal, goal_short, summary, summary_short,
            status, tags, agent, metadata, has_warnings, project_path,
            started_at, ended_at, created_at, updated_at, version
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          ctx.id,
          ctx.parent_id,
          ctx.goal,
          ctx.goal_short,
          ctx.summary,
          ctx.summary_short,
          ctx.status,
          ctx.tags,
          ctx.agent,
          ctx.metadata,
          ctx.has_warnings,
          ctx.project_path,
          ctx.started_at,
          ctx.ended_at,
          ctx.created_at,
          ctx.updated_at,
          ctx.version
        );

        // 액션 복원 (ActionRecord는 camelCase, DB 컬럼은 snake_case)
        for (const action of data.actions) {
          this.db.prepare(`
            INSERT INTO actions (id, context_id, type, content, result, file_path, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `).run(
            action.id,
            action.contextId,
            action.type,
            action.content,
            action.result,
            action.filePath,
            action.createdAt
          );
        }

        // 태그 복원
        try {
          const tags = JSON.parse(ctx.tags || '[]') as string[];
          for (const tag of tags) {
            if (tag) {
              this.db.prepare(
                'INSERT OR IGNORE INTO context_tags (context_id, tag) VALUES (?, ?)'
              ).run(ctx.id, tag);
            }
          }
        } catch {
          // 태그 파싱 실패 무시
        }

        // 아카이브에서 삭제
        this.db.prepare('DELETE FROM contexts_archive WHERE id = ?').run(contextId);
      });

      transaction();
      this.db.save();
      return true;
    } catch (err) {
      console.error(`[Archive] Failed to restore ${contextId}:`, err);
      return false;
    }
  }

  /**
   * 아카이브 통계 조회
   */
  getStats(): ArchiveStats {
    const stats = this.db.prepare(`
      SELECT
        COUNT(*) as count,
        MIN(archived_at) as oldest,
        MAX(archived_at) as newest,
        SUM(LENGTH(original_data)) as size
      FROM contexts_archive
    `).get() as {
      count: number;
      oldest: string | null;
      newest: string | null;
      size: number | null;
    };

    return {
      archiveCount: stats.count || 0,
      oldestArchive: stats.oldest,
      newestArchive: stats.newest,
      totalSizeEstimate: stats.size || 0,
    };
  }

  /**
   * 아카이브 검색
   */
  searchArchives(query: string, limit: number = 10): ArchivedContext[] {
    const rows = this.db.prepare(`
      SELECT id, archived_at, archive_reason,
             json_extract(original_data, '$.context.goal_short') as goal
      FROM contexts_archive
      WHERE original_data LIKE ?
      ORDER BY archived_at DESC
      LIMIT ?
    `).all(`%${query}%`, limit) as Array<{
      id: string;
      archived_at: string;
      archive_reason: string;
      goal: string | null;
    }>;

    return rows.map((row) => ({
      id: row.id,
      goal: row.goal || '',
      archivedAt: row.archived_at,
      reason: row.archive_reason || 'unknown',
    }));
  }

  /**
   * 아카이브 목록 조회
   */
  listArchives(limit: number = 20, offset: number = 0): ArchivedContext[] {
    const rows = this.db.prepare(`
      SELECT id, archived_at, archive_reason,
             json_extract(original_data, '$.context.goal_short') as goal
      FROM contexts_archive
      ORDER BY archived_at DESC
      LIMIT ? OFFSET ?
    `).all(limit, offset) as Array<{
      id: string;
      archived_at: string;
      archive_reason: string;
      goal: string | null;
    }>;

    return rows.map((row) => ({
      id: row.id,
      goal: row.goal || '',
      archivedAt: row.archived_at,
      reason: row.archive_reason || 'unknown',
    }));
  }
}
