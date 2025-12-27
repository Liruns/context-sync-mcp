/**
 * Context Sync MCP v2.2 - context_stats 도구
 * 세션 통계 조회
 * v2.2: context_tags 테이블 사용, LEFT JOIN 최적화
 */

import type { DatabaseInstance } from '../db/index.js';
import type {
  ContextStatsInput,
  ContextStatsOutput,
  ContextMetadata,
} from '../types/index.js';

// 상수
const VALID_RANGES = ['last_7_days', 'last_30_days', 'last_90_days', 'all'] as const;
const TOP_TAGS_LIMIT = 10;

/**
 * 입력 검증
 */
export function validateStatsInput(input: unknown): ContextStatsInput {
  const parsed = input as Record<string, unknown>;

  let range: ContextStatsInput['range'] = 'last_30_days';
  if (typeof parsed.range === 'string') {
    if (VALID_RANGES.includes(parsed.range as typeof VALID_RANGES[number])) {
      range = parsed.range as ContextStatsInput['range'];
    }
  }

  return { range };
}

/**
 * 날짜 범위 계산
 */
function getDateRange(range: ContextStatsInput['range']): { from: string; to: string } {
  const now = new Date();
  const to = now.toISOString();

  let from: string;
  switch (range) {
    case 'last_7_days':
      from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      break;
    case 'last_30_days':
      from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
      break;
    case 'last_90_days':
      from = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString();
      break;
    case 'all':
    default:
      from = '1970-01-01T00:00:00.000Z';
      break;
  }

  return { from, to };
}

/**
 * 컨텍스트 통계 조회
 */
export function getContextStats(
  db: DatabaseInstance,
  input: ContextStatsInput
): ContextStatsOutput {
  const { from, to } = getDateRange(input.range);

  // 1. 총 세션 수
  const totalResult = db
    .prepare('SELECT COUNT(*) as count FROM contexts WHERE created_at >= ?')
    .get(from) as { count: number };
  const totalSessions = totalResult?.count || 0;

  // 2. 상태별 집계
  const statusRows = db
    .prepare(
      'SELECT status, COUNT(*) as count FROM contexts WHERE created_at >= ? GROUP BY status'
    )
    .all(from) as Array<{ status: string; count: number }>;

  const byStatus: Record<string, number> = {};
  for (const row of statusRows) {
    if (row.status) {
      byStatus[row.status] = row.count;
    }
  }

  // 3. 에이전트별 집계
  const agentRows = db
    .prepare(
      'SELECT agent, COUNT(*) as count FROM contexts WHERE created_at >= ? AND agent IS NOT NULL GROUP BY agent'
    )
    .all(from) as Array<{ agent: string; count: number }>;

  const byAgent: Record<string, number> = {};
  for (const row of agentRows) {
    if (row.agent) {
      byAgent[row.agent] = row.count;
    }
  }

  // 4. 태그 집계 (v2.2: context_tags 테이블 사용, JSON 파싱 불필요)
  const topTags = db
    .prepare(`
      SELECT ct.tag, COUNT(*) as count
      FROM context_tags ct
      JOIN contexts c ON ct.context_id = c.id
      WHERE c.created_at >= ?
      GROUP BY ct.tag
      ORDER BY count DESC
      LIMIT ?
    `)
    .all(from, TOP_TAGS_LIMIT) as Array<{ tag: string; count: number }>;

  // 5. 실패한 접근법 수
  const warningRows = db
    .prepare(
      'SELECT metadata FROM contexts WHERE created_at >= ? AND has_warnings = 1'
    )
    .all(from) as Array<{ metadata: string }>;

  let failedApproaches = 0;
  for (const row of warningRows) {
    try {
      const metadata = JSON.parse(row.metadata || '{}') as ContextMetadata;
      const failed = metadata.approaches?.filter((a) => a.result === 'failed') || [];
      failedApproaches += failed.length;
    } catch {
      // JSON 파싱 실패 시 무시
    }
  }

  // 6. 세션당 평균 액션 수 (v2.2: LEFT JOIN 사용, IN 서브쿼리 제거)
  const avgResult = db
    .prepare(`
      SELECT AVG(action_count) as avg FROM (
        SELECT COUNT(a.id) as action_count
        FROM contexts c
        LEFT JOIN actions a ON c.id = a.context_id
        WHERE c.created_at >= ?
        GROUP BY c.id
      )
    `)
    .get(from) as { avg: number | null };

  const avgActionsPerSession = avgResult?.avg
    ? Math.round(avgResult.avg * 10) / 10
    : 0;

  return {
    totalSessions,
    byStatus,
    byAgent,
    topTags,
    failedApproaches,
    avgActionsPerSession,
    dateRange: {
      from: from.split('T')[0],
      to: to.split('T')[0],
    },
  };
}

/**
 * 통계를 마크다운으로 포맷
 */
export function formatStatsMarkdown(stats: ContextStatsOutput): string {
  let md = `📊 **컨텍스트 통계** (${stats.dateRange.from} ~ ${stats.dateRange.to})\n\n`;

  md += `**총 세션**: ${stats.totalSessions}개\n`;
  md += `**실패한 접근법**: ${stats.failedApproaches}개\n`;
  md += `**세션당 평균 액션**: ${stats.avgActionsPerSession}개\n\n`;

  // 상태별
  if (Object.keys(stats.byStatus).length > 0) {
    md += `### 상태별\n`;
    for (const [status, count] of Object.entries(stats.byStatus)) {
      md += `- ${status}: ${count}개\n`;
    }
    md += `\n`;
  }

  // 에이전트별
  if (Object.keys(stats.byAgent).length > 0) {
    md += `### 에이전트별\n`;
    for (const [agent, count] of Object.entries(stats.byAgent)) {
      md += `- ${agent}: ${count}개\n`;
    }
    md += `\n`;
  }

  // 상위 태그
  if (stats.topTags.length > 0) {
    md += `### 상위 태그\n`;
    for (const { tag, count } of stats.topTags) {
      md += `- ${tag}: ${count}회\n`;
    }
  }

  return md;
}
