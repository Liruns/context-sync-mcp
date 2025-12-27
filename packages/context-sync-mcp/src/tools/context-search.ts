/**
 * Context Sync MCP v2.2 - context_search Tool
 * 힌트 기반 토큰 효율적 검색
 * v2.1: scope 파라미터로 전역 검색 지원
 * v2.2: context_tags 테이블 사용으로 태그 검색 최적화 (JSON LIKE → 인덱스)
 */

import type { DatabaseInstance } from '../db/index.js';
import { buildFtsQuery, hasFts5Support } from '../db/index.js';
import { searchGlobalContexts } from '../db/global-db.js';
import { formatDateShort } from '../utils/truncate.js';
import type {
  ContextSearchInput,
  ContextSearchOutput,
  ContextHint,
  SearchScope,
} from '../types/context.js';
import { SEARCH_LIMITS, clampLimit } from '../constants/index.js';
import { isNonEmptyString, isArray, isInteger, parseArgs } from '../validators/index.js';
import { VALID_STATUS, VALID_AGENTS } from '../constants/valid-values.js';

/**
 * 컨텍스트 검색 입력 (v2.1 scope 확장)
 */
export interface ExtendedSearchInput extends ContextSearchInput {
  scope?: SearchScope;
}

/**
 * 컨텍스트 검색 (힌트 기반)
 * ~200 토큰 응답
 * v2.1: scope='global'이면 전역 DB 검색
 */
export async function searchContextsWithScope(
  db: DatabaseInstance,
  input: ExtendedSearchInput
): Promise<ContextSearchOutput> {
  const scope = input.scope || 'project';

  // 전역 검색
  if (scope === 'global') {
    const result = await searchGlobalContexts({
      query: input.query,
      status: input.status,
      limit: input.limit,
      offset: input.offset,
    });

    return {
      hints: result.hints.map((h) => ({
        id: h.id,
        goal: h.goal,
        date: h.date,
        hasWarnings: h.hasWarnings,
      })),
      total: result.total,
      hasMore: result.hasMore,
      suggestion: result.total > 0 ? `전역에서 ${result.total}개 프로젝트 검색됨` : undefined,
    };
  }

  // 프로젝트 로컬 검색
  return searchContexts(db, input);
}

/**
 * 컨텍스트 검색 (힌트 기반) - 로컬 DB만
 * ~200 토큰 응답
 */
export function searchContexts(
  db: DatabaseInstance,
  input: ContextSearchInput
): ContextSearchOutput {
  const limit = clampLimit(input.limit, SEARCH_LIMITS.DEFAULT_LIMIT, SEARCH_LIMITS.MAX_LIMIT);
  const offset = input.offset || 0;

  let query: string;
  let params: unknown[] = [];
  let countQuery: string;
  let countParams: unknown[] = [];

  // FTS5 지원 여부 확인 (쿼리가 있을 때만 필요)
  const useFts = input.query ? hasFts5Support(db) : false;

  if (input.query) {

    if (useFts) {
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
      // FTS5 미지원: LIKE 검색으로 fallback
      const likePattern = `%${input.query}%`;
      query = `
        SELECT id, goal_short, created_at, has_warnings
        FROM contexts
        WHERE (goal LIKE ? OR summary LIKE ? OR tags LIKE ?)
      `;
      countQuery = `
        SELECT COUNT(*) as count
        FROM contexts
        WHERE (goal LIKE ? OR summary LIKE ? OR tags LIKE ?)
      `;
      params = [likePattern, likePattern, likePattern];
      countParams = [likePattern, likePattern, likePattern];
    }
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
    // v2.2: context_tags 테이블 사용 (인덱스 활용, JSON LIKE 대비 10x+ 빠름)
    const placeholders = input.tags.map(() => '?').join(', ');
    // FTS5 사용 시 c.id, 그 외에는 id 참조
    const idRef = useFts ? 'c.id' : 'id';
    query += ` AND ${idRef} IN (SELECT context_id FROM context_tags WHERE tag IN (${placeholders}))`;
    countQuery += ` AND ${idRef} IN (SELECT context_id FROM context_tags WHERE tag IN (${placeholders}))`;
    params.push(...input.tags);
    countParams.push(...input.tags);
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
  const parsed = parseArgs(input);

  return {
    query: isNonEmptyString(parsed.query) ? parsed.query : undefined,
    tags: isArray(parsed.tags)
      ? (parsed.tags.filter((t) => isNonEmptyString(t)) as string[])
      : undefined,
    status: VALID_STATUS.includes(parsed.status as typeof VALID_STATUS[number])
      ? (parsed.status as ContextSearchInput['status'])
      : undefined,
    agent: VALID_AGENTS.includes(parsed.agent as typeof VALID_AGENTS[number])
      ? (parsed.agent as ContextSearchInput['agent'])
      : undefined,
    dateRange: parsed.dateRange as ContextSearchInput['dateRange'],
    limit: isInteger(parsed.limit) ? parsed.limit : SEARCH_LIMITS.DEFAULT_LIMIT,
    offset: isInteger(parsed.offset) ? parsed.offset : 0,
  };
}

/**
 * 검색 쿼리 유효성 검사 (v2.1 scope 포함)
 */
export function validateExtendedSearchInput(input: unknown): ExtendedSearchInput {
  const base = validateSearchInput(input);
  const parsed = input as Record<string, unknown>;

  return {
    ...base,
    scope: parsed.scope === 'global' ? 'global' : 'project',
  };
}
