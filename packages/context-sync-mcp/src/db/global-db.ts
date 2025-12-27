/**
 * Context Sync MCP v2.1 - Global Database
 * 프로젝트 간 전역 검색을 위한 인덱스 DB
 *
 * 저장 위치: ~/.context-sync/global.db
 */

import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import initSqlJs, { type Database as SqlJsDatabase } from 'sql.js';
import { DatabaseInstance } from './index.js';
import type { GlobalContextRecord, ContextHint } from '../types/index.js';
import { buildFtsQuery } from './index.js';

// 전역 DB 경로
const GLOBAL_STORE_DIR = path.join(os.homedir(), '.context-sync');
const GLOBAL_DB_PATH = path.join(GLOBAL_STORE_DIR, 'global.db');

// sql.js 초기화 상태
let SQL: Awaited<ReturnType<typeof initSqlJs>> | null = null;
let globalDb: DatabaseInstance | null = null;
let initPromise: Promise<void> | null = null;

/**
 * 전역 DB 스키마
 */
const GLOBAL_SCHEMA = `
-- 전역 컨텍스트 인덱스
CREATE TABLE IF NOT EXISTS global_contexts (
  id TEXT PRIMARY KEY,
  project_path TEXT NOT NULL,
  goal TEXT NOT NULL,
  goal_short TEXT,
  summary_short TEXT,
  status TEXT,
  tags TEXT DEFAULT '[]',
  has_warnings INTEGER DEFAULT 0,
  created_at TEXT,
  updated_at TEXT
);

-- 전문검색 인덱스
CREATE VIRTUAL TABLE IF NOT EXISTS global_contexts_fts USING fts5(
  id,
  project_path,
  goal,
  tags,
  content='global_contexts',
  content_rowid='rowid'
);

-- FTS 동기화 트리거
CREATE TRIGGER IF NOT EXISTS global_contexts_ai AFTER INSERT ON global_contexts BEGIN
  INSERT INTO global_contexts_fts(id, project_path, goal, tags)
  VALUES (new.id, new.project_path, new.goal, new.tags);
END;

CREATE TRIGGER IF NOT EXISTS global_contexts_ad AFTER DELETE ON global_contexts BEGIN
  INSERT INTO global_contexts_fts(global_contexts_fts, id, project_path, goal, tags)
  VALUES ('delete', old.id, old.project_path, old.goal, old.tags);
END;

CREATE TRIGGER IF NOT EXISTS global_contexts_au AFTER UPDATE ON global_contexts BEGIN
  INSERT INTO global_contexts_fts(global_contexts_fts, id, project_path, goal, tags)
  VALUES ('delete', old.id, old.project_path, old.goal, old.tags);
  INSERT INTO global_contexts_fts(id, project_path, goal, tags)
  VALUES (new.id, new.project_path, new.goal, new.tags);
END;

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_global_project ON global_contexts(project_path);
CREATE INDEX IF NOT EXISTS idx_global_status ON global_contexts(status);
CREATE INDEX IF NOT EXISTS idx_global_created ON global_contexts(created_at);
CREATE INDEX IF NOT EXISTS idx_global_warnings ON global_contexts(has_warnings);
`;

/**
 * sql.js 초기화
 */
async function ensureSqlJsInitialized(): Promise<boolean> {
  if (SQL) return true;

  if (!initPromise) {
    initPromise = (async () => {
      try {
        SQL = await initSqlJs();
      } catch (err) {
        console.error('[Global DB] sql.js 초기화 실패:', err);
      }
    })();
  }

  await initPromise;
  return SQL !== null;
}

/**
 * 전역 DB 초기화
 */
export async function initGlobalDatabase(): Promise<DatabaseInstance | null> {
  if (globalDb && globalDb.open) {
    return globalDb;
  }

  const initialized = await ensureSqlJsInitialized();
  if (!initialized || !SQL) {
    return null;
  }

  // 디렉토리 생성
  if (!fs.existsSync(GLOBAL_STORE_DIR)) {
    fs.mkdirSync(GLOBAL_STORE_DIR, { recursive: true });
  }

  let db: SqlJsDatabase;

  // 기존 DB 로드 또는 새로 생성
  if (fs.existsSync(GLOBAL_DB_PATH)) {
    try {
      const buffer = fs.readFileSync(GLOBAL_DB_PATH);
      db = new SQL.Database(buffer);
    } catch (err) {
      console.warn('[Global DB] 기존 DB 로드 실패, 새로 생성:', err);
      db = new SQL.Database();
    }
  } else {
    db = new SQL.Database();
  }

  globalDb = new DatabaseInstance(db, GLOBAL_DB_PATH);

  // 스키마 초기화
  try {
    globalDb.exec(GLOBAL_SCHEMA);
    globalDb.save();
  } catch (err) {
    console.error('[Global DB] 스키마 초기화 실패:', err);
  }

  return globalDb;
}

/**
 * 전역 DB 가져오기 (이미 초기화된 경우)
 */
export function getGlobalDatabase(): DatabaseInstance | null {
  return globalDb;
}

/**
 * 전역 DB 닫기
 */
export function closeGlobalDatabase(): void {
  if (globalDb && globalDb.open) {
    globalDb.close();
    globalDb = null;
  }
}

/**
 * 컨텍스트를 전역 DB에 동기화
 */
export async function syncToGlobalDb(
  record: GlobalContextRecord
): Promise<void> {
  const db = await initGlobalDatabase();
  if (!db) {
    console.warn('[Global DB] DB 초기화 실패, 동기화 건너뜀');
    return;
  }

  try {
    db.prepare(`
      INSERT OR REPLACE INTO global_contexts (
        id, project_path, goal, goal_short, summary_short,
        status, tags, has_warnings, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      record.id,
      record.project_path,
      record.goal,
      record.goal_short,
      record.summary_short,
      record.status,
      record.tags,
      record.has_warnings,
      record.created_at,
      record.updated_at
    );

    db.save();
  } catch (err) {
    console.error('[Global DB] 동기화 실패:', err);
  }
}

/**
 * 전역 DB에서 컨텍스트 삭제
 */
export async function removeFromGlobalDb(contextId: string): Promise<void> {
  const db = await initGlobalDatabase();
  if (!db) return;

  try {
    db.prepare('DELETE FROM global_contexts WHERE id = ?').run(contextId);
    db.save();
  } catch (err) {
    console.error('[Global DB] 삭제 실패:', err);
  }
}

/**
 * 전역 검색 입력
 */
export interface GlobalSearchInput {
  query?: string;
  projectPath?: string; // 특정 프로젝트 필터
  status?: string;
  limit?: number;
  offset?: number;
}

/**
 * 전역 검색 출력
 */
export interface GlobalSearchOutput {
  hints: Array<ContextHint & { projectPath: string }>;
  total: number;
  hasMore: boolean;
}

/**
 * 전역 검색 수행
 */
export async function searchGlobalContexts(
  input: GlobalSearchInput
): Promise<GlobalSearchOutput> {
  const db = await initGlobalDatabase();
  if (!db) {
    return { hints: [], total: 0, hasMore: false };
  }

  const limit = Math.min(input.limit || 10, 50);
  const offset = input.offset || 0;

  let query: string;
  const params: unknown[] = [];

  if (input.query) {
    const ftsQuery = buildFtsQuery(input.query);
    query = `
      SELECT c.id, c.goal_short, c.project_path, c.created_at, c.has_warnings
      FROM global_contexts c
      JOIN global_contexts_fts fts ON c.id = fts.id
      WHERE global_contexts_fts MATCH ?
    `;
    params.push(ftsQuery);
  } else {
    query = `
      SELECT id, goal_short, project_path, created_at, has_warnings
      FROM global_contexts
      WHERE 1=1
    `;
  }

  // 프로젝트 필터
  if (input.projectPath) {
    query += ' AND project_path = ?';
    params.push(input.projectPath);
  }

  // 상태 필터
  if (input.status) {
    query += ' AND status = ?';
    params.push(input.status);
  }

  // 정렬 및 페이지네이션
  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(limit + 1, offset); // +1로 hasMore 확인

  const rows = db.prepare(query).all(...params) as Array<{
    id: string;
    goal_short: string | null;
    project_path: string;
    created_at: string;
    has_warnings: number;
  }>;

  const hasMore = rows.length > limit;
  const resultRows = hasMore ? rows.slice(0, limit) : rows;

  // 전체 카운트
  let countQuery = input.query
    ? `SELECT COUNT(*) as count FROM global_contexts c
       JOIN global_contexts_fts fts ON c.id = fts.id
       WHERE global_contexts_fts MATCH ?`
    : `SELECT COUNT(*) as count FROM global_contexts WHERE 1=1`;

  const countParams: unknown[] = input.query
    ? [buildFtsQuery(input.query)]
    : [];

  if (input.projectPath) {
    countQuery += ' AND project_path = ?';
    countParams.push(input.projectPath);
  }
  if (input.status) {
    countQuery += ' AND status = ?';
    countParams.push(input.status);
  }

  const countResult = db.prepare(countQuery).get(...countParams) as {
    count: number;
  };
  const total = countResult?.count || 0;

  const hints = resultRows.map((row) => ({
    id: row.id,
    goal: row.goal_short || '',
    date: row.created_at.split('T')[0],
    hasWarnings: row.has_warnings === 1,
    projectPath: row.project_path,
  }));

  return { hints, total, hasMore };
}

/**
 * 전역 DB 통계
 */
export async function getGlobalStats(): Promise<{
  totalContexts: number;
  projectCount: number;
  projects: Array<{ path: string; count: number }>;
}> {
  const db = await initGlobalDatabase();
  if (!db) {
    return { totalContexts: 0, projectCount: 0, projects: [] };
  }

  const totalResult = db
    .prepare('SELECT COUNT(*) as count FROM global_contexts')
    .get() as { count: number };

  const projectsResult = db
    .prepare(`
      SELECT project_path, COUNT(*) as count
      FROM global_contexts
      GROUP BY project_path
      ORDER BY count DESC
      LIMIT 20
    `)
    .all() as Array<{ project_path: string; count: number }>;

  return {
    totalContexts: totalResult?.count || 0,
    projectCount: projectsResult.length,
    projects: projectsResult.map((p) => ({
      path: p.project_path,
      count: p.count,
    })),
  };
}

/**
 * 전역 DB 경로 반환
 */
export function getGlobalDbPath(): string {
  return GLOBAL_DB_PATH;
}
