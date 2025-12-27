/**
 * Context Sync MCP - Query Builder
 * FTS5/LIKE 검색 쿼리 통합 빌더
 */

import type { DatabaseInstance } from './index.js';
import { buildFtsQuery, hasFts5Support } from './index.js';

/**
 * 검색 쿼리 옵션
 */
export interface SearchQueryOptions {
  /** 검색어 (FTS 또는 LIKE) */
  query?: string;
  /** 상태 필터 */
  status?: string;
  /** 에이전트 필터 */
  agent?: string;
  /** 태그 필터 */
  tags?: string[];
  /** 날짜 범위 필터 */
  dateRange?: {
    from?: string;
    to?: string;
  };
  /** 결과 제한 */
  limit?: number;
  /** 오프셋 */
  offset?: number;
  /** 정렬 기준 */
  orderBy?: string;
}

/**
 * 쿼리 빌더 결과
 */
export interface SearchQueryResult {
  /** 데이터 조회 쿼리 */
  sql: string;
  /** 카운트 쿼리 */
  countSql: string;
  /** 데이터 쿼리 파라미터 */
  params: unknown[];
  /** 카운트 쿼리 파라미터 */
  countParams: unknown[];
  /** FTS5 사용 여부 */
  useFts: boolean;
}

/**
 * 추천용 검색 쿼리 옵션
 */
export interface RecommendQueryOptions {
  /** 검색어 */
  query: string;
  /** 결과 제한 */
  limit?: number;
}

/**
 * 추천용 쿼리 결과
 */
export interface RecommendQueryResult {
  /** SQL 쿼리 */
  sql: string;
  /** 파라미터 */
  params: unknown[];
  /** FTS5 사용 여부 */
  useFts: boolean;
}

/**
 * 검색 쿼리 빌더 클래스
 */
export class QueryBuilder {
  private db: DatabaseInstance;
  private _useFts: boolean | null = null;

  constructor(db: DatabaseInstance) {
    this.db = db;
  }

  /**
   * FTS5 지원 여부 (캐싱)
   */
  useFts(): boolean {
    if (this._useFts === null) {
      this._useFts = hasFts5Support(this.db);
    }
    return this._useFts;
  }

  /**
   * 컨텍스트 검색 쿼리 생성
   */
  buildSearchQuery(options: SearchQueryOptions): SearchQueryResult {
    const useFts = options.query ? this.useFts() : false;
    let query: string;
    let countQuery: string;
    let params: unknown[] = [];
    let countParams: unknown[] = [];

    // 기본 SELECT 절
    const selectColumns = 'id, goal_short, created_at, has_warnings';
    const ftsSelectColumns = 'c.id, c.goal_short, c.created_at, c.has_warnings';

    if (options.query) {
      if (useFts) {
        // FTS5 전문검색
        const ftsQuery = buildFtsQuery(options.query);
        query = `
          SELECT ${ftsSelectColumns}
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
        // LIKE 검색 폴백
        const likePattern = `%${options.query}%`;
        query = `
          SELECT ${selectColumns}
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
      query = `SELECT ${selectColumns} FROM contexts WHERE 1=1`;
      countQuery = `SELECT COUNT(*) as count FROM contexts WHERE 1=1`;
    }

    // 필터 추가
    const idRef = useFts ? 'c.id' : 'id';
    const statusRef = useFts ? 'c.status' : 'status';
    const agentRef = useFts ? 'c.agent' : 'agent';
    const createdAtRef = useFts ? 'c.created_at' : 'created_at';

    if (options.status) {
      query += ` AND ${statusRef} = ?`;
      countQuery += ` AND ${statusRef} = ?`;
      params.push(options.status);
      countParams.push(options.status);
    }

    if (options.agent) {
      query += ` AND ${agentRef} = ?`;
      countQuery += ` AND ${agentRef} = ?`;
      params.push(options.agent);
      countParams.push(options.agent);
    }

    if (options.tags && options.tags.length > 0) {
      const placeholders = options.tags.map(() => '?').join(', ');
      query += ` AND ${idRef} IN (SELECT context_id FROM context_tags WHERE tag IN (${placeholders}))`;
      countQuery += ` AND ${idRef} IN (SELECT context_id FROM context_tags WHERE tag IN (${placeholders}))`;
      params.push(...options.tags);
      countParams.push(...options.tags);
    }

    if (options.dateRange?.from) {
      query += ` AND ${createdAtRef} >= ?`;
      countQuery += ` AND ${createdAtRef} >= ?`;
      params.push(options.dateRange.from);
      countParams.push(options.dateRange.from);
    }

    if (options.dateRange?.to) {
      query += ` AND ${createdAtRef} <= ?`;
      countQuery += ` AND ${createdAtRef} <= ?`;
      params.push(options.dateRange.to);
      countParams.push(options.dateRange.to);
    }

    // 정렬 및 페이지네이션
    const orderBy = options.orderBy || `${createdAtRef} DESC`;
    query += ` ORDER BY ${orderBy}`;

    if (options.limit !== undefined) {
      query += ` LIMIT ?`;
      params.push(options.limit);
    }

    if (options.offset !== undefined && options.offset > 0) {
      query += ` OFFSET ?`;
      params.push(options.offset);
    }

    return { sql: query, countSql: countQuery, params, countParams, useFts };
  }

  /**
   * 추천용 검색 쿼리 생성
   */
  buildRecommendQuery(options: RecommendQueryOptions): RecommendQueryResult {
    const useFts = this.useFts();
    const limit = options.limit || 20;

    const selectColumns = `id, goal, goal_short, summary_short, status,
                          tags, metadata, has_warnings, created_at`;

    if (useFts) {
      // FTS5 전문검색
      const ftsQuery = buildFtsQuery(options.query);
      return {
        sql: `
          SELECT c.${selectColumns.replace(/,\s*/g, ', c.')}
          FROM contexts c
          JOIN contexts_fts fts ON c.id = fts.id
          WHERE contexts_fts MATCH ?
          ORDER BY rank
          LIMIT ?
        `,
        params: [ftsQuery, limit],
        useFts: true,
      };
    }

    // LIKE 검색 폴백
    const keywords = extractKeywords(options.query);

    if (keywords.length === 0) {
      // 키워드가 없으면 최신 컨텍스트 반환
      return {
        sql: `
          SELECT ${selectColumns}
          FROM contexts
          ORDER BY created_at DESC
          LIMIT ?
        `,
        params: [limit],
        useFts: false,
      };
    }

    // 키워드 기반 LIKE 검색
    const likeConditions = keywords
      .slice(0, 5)
      .map(() => '(goal LIKE ? OR summary LIKE ? OR tags LIKE ?)')
      .join(' OR ');

    const likeParams: unknown[] = [];
    for (const kw of keywords.slice(0, 5)) {
      const pattern = `%${kw}%`;
      likeParams.push(pattern, pattern, pattern);
    }
    likeParams.push(limit);

    return {
      sql: `
        SELECT ${selectColumns}
        FROM contexts
        WHERE ${likeConditions}
        ORDER BY created_at DESC
        LIMIT ?
      `,
      params: likeParams,
      useFts: false,
    };
  }
}

/**
 * 키워드 추출 (간단한 토크나이저)
 * 한글/영문/숫자에서 2자 이상 단어 추출
 */
export function extractKeywords(text: string, maxCount: number = 10): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\sㄱ-ㅎㅏ-ㅣ가-힣]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length >= 2)
    .slice(0, maxCount);
}

/**
 * 텍스트 정규화
 */
export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\sㄱ-ㅎㅏ-ㅣ가-힣]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * 쿼리 빌더 인스턴스 생성
 */
export function createQueryBuilder(db: DatabaseInstance): QueryBuilder {
  return new QueryBuilder(db);
}
