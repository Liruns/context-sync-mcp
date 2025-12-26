/**
 * Context Sync MCP v2.0 - context_search Tool
 * 힌트 기반 토큰 효율적 검색
 */

import type { DatabaseInstance } from '../db/index.js';
import { buildFtsQuery } from '../db/index.js';
import { formatDateShort } from '../utils/truncate.js';
import type {
  ContextSearchInput,
  ContextSearchOutput,
  ContextHint,
} from '../types/context.js';

const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 20;

/**
 * 컨텍스트 검색 (힌트 기반)
 * ~200 토큰 응답
 */
export function searchContexts(
  db: DatabaseInstance,
  input: ContextSearchInput
): ContextSearchOutput {
  const limit = Math.min(input.limit || DEFAULT_LIMIT, MAX_LIMIT);
  const offset = input.offset || 0;

  let query: string;
  let params: unknown[] = [];
  let countQuery: string;
  let countParams: unknown[] = [];

  if (input.query) {
    // FTS5 전문검색
    const ftsQuery = buildFtsQuery(input.query);
    query = `
      SELECT c.id, c.goal_short, c.created_at, c.has_warnings
      FROM contexts c
      JOIN contexts_fts fts ON c.id = fts.id
      WHERE contexts_fts MATCH ?
    `;
    countQuery = `
      SELECT COUNT(*) as count
      FROM contexts c
      JOIN contexts_fts fts ON c.id = fts.id
      WHERE contexts_fts MATCH ?
    `;
    params = [ftsQuery];
    countParams = [ftsQuery];
  } else {
    // 기본 쿼리
    query = `
      SELECT id, goal_short, created_at, has_warnings
      FROM contexts
      WHERE 1=1
    `;
    countQuery = `SELECT COUNT(*) as count FROM contexts WHERE 1=1`;
  }

  // 필터 추가
  if (input.status) {
    query += ` AND status = ?`;
    countQuery += ` AND status = ?`;
    params.push(input.status);
    countParams.push(input.status);
  }

  if (input.agent) {
    query += ` AND agent = ?`;
    countQuery += ` AND agent = ?`;
    params.push(input.agent);
    countParams.push(input.agent);
  }

  if (input.tags && input.tags.length > 0) {
    // JSON 배열에서 태그 검색
    const tagConditions = input.tags.map(() => `tags LIKE ?`).join(' OR ');
    query += ` AND (${tagConditions})`;
    countQuery += ` AND (${tagConditions})`;
    const tagParams = input.tags.map((tag) => `%"${tag}"%`);
    params.push(...tagParams);
    countParams.push(...tagParams);
  }

  if (input.dateRange?.from) {
    query += ` AND created_at >= ?`;
    countQuery += ` AND created_at >= ?`;
    params.push(input.dateRange.from);
    countParams.push(input.dateRange.from);
  }

  if (input.dateRange?.to) {
    query += ` AND created_at <= ?`;
    countQuery += ` AND created_at <= ?`;
    params.push(input.dateRange.to);
    countParams.push(input.dateRange.to);
  }

  // 정렬 및 페이지네이션
  query += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
  params.push(limit, offset);

  // 실행
  const rows = db.prepare(query).all(...params) as Array<{
    id: string;
    goal_short: string | null;
    created_at: string;
    has_warnings: number;
  }>;

  const countResult = db.prepare(countQuery).get(...countParams) as { count: number };
  const total = countResult.count;

  // 힌트로 변환
  const hints: ContextHint[] = rows.map((row) => ({
    id: row.id,
    goal: row.goal_short || '',
    date: formatDateShort(row.created_at),
    hasWarnings: row.has_warnings === 1,
  }));

  // 경고가 있는 항목에 대한 제안 생성
  const warningHint = hints.find((h) => h.hasWarnings);
  let suggestion: string | undefined;
  if (warningHint) {
    suggestion = `${warningHint.id}에 관련 실패 기록이 있습니다`;
  }

  return {
    hints,
    total,
    hasMore: offset + hints.length < total,
    suggestion,
  };
}

/**
 * 검색 쿼리 유효성 검사
 */
export function validateSearchInput(input: unknown): ContextSearchInput {
  const parsed = input as Record<string, unknown>;

  return {
    query: typeof parsed.query === 'string' ? parsed.query : undefined,
    tags: Array.isArray(parsed.tags) ? parsed.tags : undefined,
    status: typeof parsed.status === 'string' ? parsed.status as ContextSearchInput['status'] : undefined,
    agent: typeof parsed.agent === 'string' ? parsed.agent as ContextSearchInput['agent'] : undefined,
    dateRange: parsed.dateRange as ContextSearchInput['dateRange'],
    limit: typeof parsed.limit === 'number' ? parsed.limit : DEFAULT_LIMIT,
    offset: typeof parsed.offset === 'number' ? parsed.offset : 0,
  };
}
