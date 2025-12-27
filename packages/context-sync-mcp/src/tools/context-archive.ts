/**
 * Context Sync MCP v2.2 - context_archive 도구
 * 컨텍스트 아카이빙 관리
 */

import type { DatabaseInstance } from '../db/index.js';
import { ArchiveService } from '../services/archive-service.js';
import type {
  ArchiveConfig,
  ArchiveResult,
  ArchiveStats,
  ArchivedContext,
} from '../services/archive-service.js';

/**
 * 아카이브 액션 타입
 */
export type ArchiveAction = 'archive' | 'restore' | 'stats' | 'search' | 'list' | 'purge';

/**
 * 아카이브 도구 입력
 */
export interface ContextArchiveInput {
  action: ArchiveAction;
  contextId?: string;       // restore용
  query?: string;           // search용
  daysOld?: number;         // archive/purge용
  limit?: number;           // list/search용
  offset?: number;          // list용
}

/**
 * 아카이브 도구 출력
 */
export interface ContextArchiveOutput {
  success: boolean;
  message: string;
  data?: {
    result?: ArchiveResult;
    stats?: ArchiveStats;
    archives?: ArchivedContext[];
    purgedCount?: number;
  };
}

const VALID_ACTIONS: ArchiveAction[] = ['archive', 'restore', 'stats', 'search', 'list', 'purge'];

/**
 * 입력 검증
 */
export function validateArchiveInput(input: unknown): ContextArchiveInput {
  const parsed = input as Record<string, unknown>;

  if (!parsed.action || typeof parsed.action !== 'string') {
    throw new Error('action is required (archive, restore, stats, search, list, purge)');
  }

  if (!VALID_ACTIONS.includes(parsed.action as ArchiveAction)) {
    throw new Error(`Invalid action: ${parsed.action}. Use: ${VALID_ACTIONS.join(', ')}`);
  }

  const result: ContextArchiveInput = {
    action: parsed.action as ArchiveAction,
  };

  // restore용 contextId
  if (parsed.action === 'restore') {
    if (!parsed.contextId || typeof parsed.contextId !== 'string') {
      throw new Error('contextId is required for restore action');
    }
    result.contextId = parsed.contextId;
  }

  // search용 query
  if (parsed.action === 'search') {
    if (!parsed.query || typeof parsed.query !== 'string') {
      throw new Error('query is required for search action');
    }
    result.query = parsed.query;
  }

  // 선택적 파라미터
  if (typeof parsed.daysOld === 'number') {
    result.daysOld = parsed.daysOld;
  }

  if (typeof parsed.limit === 'number') {
    result.limit = Math.min(parsed.limit, 100);
  }

  if (typeof parsed.offset === 'number') {
    result.offset = parsed.offset;
  }

  return result;
}

/**
 * 아카이브 도구 실행
 */
export function executeArchive(
  db: DatabaseInstance,
  input: ContextArchiveInput,
  config?: Partial<ArchiveConfig>
): ContextArchiveOutput {
  const service = new ArchiveService(db, config);

  switch (input.action) {
    case 'archive': {
      const result = service.archiveOldContexts(input.daysOld);
      return {
        success: true,
        message: `아카이브 완료: ${result.archived}개 성공, ${result.failed}개 실패`,
        data: { result },
      };
    }

    case 'restore': {
      const success = service.restoreFromArchive(input.contextId!);
      return {
        success,
        message: success
          ? `${input.contextId} 복원 완료`
          : `${input.contextId} 복원 실패 (찾을 수 없음)`,
      };
    }

    case 'stats': {
      const stats = service.getStats();
      return {
        success: true,
        message: `아카이브 통계: ${stats.archiveCount}개`,
        data: { stats },
      };
    }

    case 'search': {
      const archives = service.searchArchives(input.query!, input.limit || 10);
      return {
        success: true,
        message: `검색 결과: ${archives.length}개`,
        data: { archives },
      };
    }

    case 'list': {
      const archives = service.listArchives(input.limit || 20, input.offset || 0);
      return {
        success: true,
        message: `아카이브 목록: ${archives.length}개`,
        data: { archives },
      };
    }

    case 'purge': {
      const purgedCount = service.purgeOldArchives(input.daysOld);
      return {
        success: true,
        message: `${purgedCount}개 아카이브 영구 삭제`,
        data: { purgedCount },
      };
    }

    default:
      return {
        success: false,
        message: `알 수 없는 액션: ${input.action}`,
      };
  }
}

/**
 * 아카이브 출력을 마크다운으로 포맷
 */
export function formatArchiveMarkdown(output: ContextArchiveOutput): string {
  let md = `**${output.success ? '✅' : '❌'} ${output.message}**\n\n`;

  if (output.data?.stats) {
    const stats = output.data.stats;
    md += `### 통계\n`;
    md += `- 아카이브 수: ${stats.archiveCount}개\n`;
    if (stats.oldestArchive) {
      md += `- 가장 오래된: ${stats.oldestArchive.split('T')[0]}\n`;
    }
    if (stats.newestArchive) {
      md += `- 가장 최근: ${stats.newestArchive.split('T')[0]}\n`;
    }
    md += `- 예상 크기: ${Math.round(stats.totalSizeEstimate / 1024)}KB\n`;
  }

  if (output.data?.archives && output.data.archives.length > 0) {
    md += `### 아카이브 목록\n`;
    for (const archive of output.data.archives) {
      md += `- \`${archive.id}\`: ${archive.goal} (${archive.archivedAt.split('T')[0]})\n`;
    }
  }

  return md;
}
