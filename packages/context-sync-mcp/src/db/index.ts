/**
 * Context Sync MCP v2.0 - Database Module
 * SQLite 데이터베이스 초기화 및 관리
 *
 * NOTE: better-sqlite3는 네이티브 모듈이므로 Windows에서 Visual Studio Build Tools가 필요합니다.
 * 모듈 로드 실패 시 null을 반환하고 JSON 폴백 모드로 동작합니다.
 */

import * as path from 'path';
import * as fs from 'fs';
import { getAllSchemaQueries, SCHEMA_VERSION } from './schema.js';

export { SCHEMA_VERSION } from './schema.js';

/**
 * SQLite Statement 인터페이스 (better-sqlite3 호환)
 */
interface Statement {
  run(...params: unknown[]): { changes: number; lastInsertRowid: number | bigint };
  get(...params: unknown[]): unknown;
  all(...params: unknown[]): unknown[];
}

/**
 * SQLite Database 인터페이스 (better-sqlite3 호환)
 */
export interface DatabaseInstance {
  prepare(sql: string): Statement;
  exec(sql: string): void;
  pragma(pragma: string): unknown;
  transaction<T>(fn: () => T): () => T;
  close(): void;
  open: boolean;
}

// better-sqlite3 동적 로드 시도
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let DatabaseConstructor: (new (path: string, options?: { readonly?: boolean }) => DatabaseInstance) | null = null;
let dbLoadError: Error | null = null;

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  DatabaseConstructor = require('better-sqlite3');
} catch (err) {
  dbLoadError = err as Error;
  console.error('[Context Sync] SQLite 모듈을 로드할 수 없습니다. JSON 폴백 모드로 동작합니다.');
  console.error('[Context Sync] SQLite 기능을 사용하려면 Visual Studio Build Tools를 설치하세요.');
}

/**
 * SQLite 사용 가능 여부 확인
 */
export function isSqliteAvailable(): boolean {
  return DatabaseConstructor !== null;
}

/**
 * SQLite 로드 에러 반환
 */
export function getSqliteLoadError(): Error | null {
  return dbLoadError;
}

/**
 * DB 초기화 옵션
 */
export interface DatabaseOptions {
  /** 데이터베이스 파일 경로 */
  dbPath?: string;
  /** WAL 모드 사용 여부 (기본: true) */
  walMode?: boolean;
  /** 읽기 전용 모드 */
  readonly?: boolean;
}

/**
 * 데이터베이스 초기화
 * @param storePath .context-sync 디렉토리 경로
 * @param options 초기화 옵션
 * @returns DatabaseInstance 또는 null (SQLite 사용 불가 시)
 */
export function initDatabase(
  storePath: string,
  options: DatabaseOptions = {}
): DatabaseInstance | null {
  // SQLite 모듈이 없으면 null 반환
  if (!DatabaseConstructor) {
    return null;
  }

  const { walMode = true, readonly = false } = options;
  const dbPath = options.dbPath || path.join(storePath, 'history.db');

  // 디렉토리 확인/생성
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // 데이터베이스 연결
  const db = new DatabaseConstructor(dbPath, { readonly });

  // 성능 최적화 설정
  if (!readonly) {
    if (walMode) {
      db.pragma('journal_mode = WAL');
    }
    db.pragma('synchronous = NORMAL');
    db.pragma('foreign_keys = ON');
    db.pragma('cache_size = -64000'); // 64MB 캐시
  }

  // 스키마 초기화
  if (!readonly) {
    initSchema(db);
  }

  return db;
}

/**
 * 스키마 초기화 및 마이그레이션
 */
function initSchema(db: DatabaseInstance): void {
  const queries = getAllSchemaQueries();

  // 트랜잭션으로 스키마 생성
  const initSchemaTransaction = db.transaction(() => {
    for (const query of queries) {
      db.exec(query);
    }

    // 스키마 버전 기록
    const currentVersion = getSchemaVersion(db);
    if (currentVersion === 0) {
      db.prepare(
        'INSERT OR REPLACE INTO schema_version (version) VALUES (?)'
      ).run(SCHEMA_VERSION);
    }
  });

  initSchemaTransaction();
}

/**
 * 현재 스키마 버전 조회
 */
export function getSchemaVersion(db: DatabaseInstance): number {
  try {
    const result = db
      .prepare('SELECT version FROM schema_version ORDER BY version DESC LIMIT 1')
      .get() as { version: number } | undefined;
    return result?.version || 0;
  } catch {
    return 0;
  }
}

/**
 * 데이터베이스 닫기
 */
export function closeDatabase(db: DatabaseInstance): void {
  if (db && db.open) {
    db.close();
  }
}

/**
 * 데이터베이스 상태 확인
 */
export function getDatabaseStats(db: DatabaseInstance): {
  contextCount: number;
  actionCount: number;
  dbSizeBytes: number;
} {
  const contextCount = (
    db.prepare('SELECT COUNT(*) as count FROM contexts').get() as { count: number }
  ).count;

  const actionCount = (
    db.prepare('SELECT COUNT(*) as count FROM actions').get() as { count: number }
  ).count;

  // 데이터베이스 파일 크기
  const pageCount = (db.pragma('page_count') as { page_count: number }[])[0]?.page_count || 0;
  const pageSize = (db.pragma('page_size') as { page_size: number }[])[0]?.page_size || 4096;
  const dbSizeBytes = pageCount * pageSize;

  return {
    contextCount,
    actionCount,
    dbSizeBytes,
  };
}

/**
 * FTS 검색 쿼리 빌더
 */
export function buildFtsQuery(query: string): string {
  // 특수문자 이스케이프 및 OR 검색 지원
  const terms = query
    .split(/\s+/)
    .filter(Boolean)
    .map((term) => `"${term.replace(/"/g, '""')}"*`)
    .join(' OR ');
  return terms || '*';
}

/**
 * 트랜잭션 헬퍼
 */
export function withTransaction<T>(
  db: DatabaseInstance,
  fn: () => T
): T {
  const transaction = db.transaction(fn);
  return transaction();
}
