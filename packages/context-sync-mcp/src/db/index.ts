/**
 * Context Sync MCP v2.2 - Database Module
 * sql.js (WebAssembly) 기반 SQLite 데이터베이스
 *
 * sql.js는 WebAssembly 기반이므로 네이티브 컴파일이 필요 없습니다.
 * 모든 플랫폼에서 npm install만으로 동작합니다.
 *
 * v2.2: 스키마 마이그레이션, 태그 정규화, 아카이빙 지원
 */

import * as path from 'path';
import * as fs from 'fs';
import initSqlJs, { type Database as SqlJsDatabase } from 'sql.js';
import { getAllSchemaQueries, getV2MigrationQueries, SCHEMA_VERSION } from './schema.js';

export { SCHEMA_VERSION } from './schema.js';

/**
 * sql.js 초기화 상태
 */
let SQL: Awaited<ReturnType<typeof initSqlJs>> | null = null;
let initPromise: Promise<void> | null = null;
let initError: Error | null = null;

/**
 * sql.js 초기화 (WASM 로드)
 */
async function ensureSqlJsInitialized(): Promise<boolean> {
  if (SQL) return true;
  if (initError) return false;

  if (!initPromise) {
    initPromise = (async () => {
      try {
        SQL = await initSqlJs();
      } catch (err) {
        initError = err as Error;
        console.error('[Context Sync] sql.js 초기화 실패:', err);
      }
    })();
  }

  await initPromise;
  return SQL !== null;
}

/**
 * Statement 래퍼 (better-sqlite3 호환 API 제공)
 */
class StatementWrapper {
  private db: SqlJsDatabase;
  private sql: string;

  constructor(db: SqlJsDatabase, sql: string) {
    this.db = db;
    this.sql = sql;
  }

  run(...params: unknown[]): { changes: number; lastInsertRowid: number | bigint } {
    this.db.run(this.sql, params as (string | number | null | Uint8Array)[]);
    const changes = this.db.getRowsModified();
    // sql.js doesn't provide lastInsertRowid directly, use a query
    const result = this.db.exec('SELECT last_insert_rowid() as id');
    const lastInsertRowid = result[0]?.values[0]?.[0] as number || 0;
    return { changes, lastInsertRowid };
  }

  get(...params: unknown[]): unknown {
    const stmt = this.db.prepare(this.sql);
    stmt.bind(params as (string | number | null | Uint8Array)[]);
    if (stmt.step()) {
      const columns = stmt.getColumnNames();
      const values = stmt.get();
      stmt.free();
      const row: Record<string, unknown> = {};
      columns.forEach((col: string, i: number) => {
        row[col] = values[i];
      });
      return row;
    }
    stmt.free();
    return undefined;
  }

  all(...params: unknown[]): unknown[] {
    const results: unknown[] = [];
    const stmt = this.db.prepare(this.sql);
    stmt.bind(params as (string | number | null | Uint8Array)[]);
    while (stmt.step()) {
      const columns = stmt.getColumnNames();
      const values = stmt.get();
      const row: Record<string, unknown> = {};
      columns.forEach((col: string, i: number) => {
        row[col] = values[i];
      });
      results.push(row);
    }
    stmt.free();
    return results;
  }
}

/**
 * Database 래퍼 (better-sqlite3 호환 API 제공)
 */
export class DatabaseInstance {
  private db: SqlJsDatabase;
  private dbPath: string;
  private _open: boolean = true;

  constructor(db: SqlJsDatabase, dbPath: string) {
    this.db = db;
    this.dbPath = dbPath;
  }

  get open(): boolean {
    return this._open;
  }

  prepare(sql: string): StatementWrapper {
    return new StatementWrapper(this.db, sql);
  }

  exec(sql: string): void {
    this.db.exec(sql);
  }

  pragma(pragmaStr: string): unknown {
    // sql.js에서 pragma 실행
    const result = this.db.exec(`PRAGMA ${pragmaStr}`);
    if (result.length > 0 && result[0].values.length > 0) {
      return result[0].values.map((row: unknown[]) => {
        const obj: Record<string, unknown> = {};
        result[0].columns.forEach((col: string, i: number) => {
          obj[col] = row[i];
        });
        return obj;
      });
    }
    return [];
  }

  transaction<T>(fn: () => T): () => T {
    return () => {
      this.db.exec('BEGIN TRANSACTION');
      try {
        const result = fn();
        this.db.exec('COMMIT');
        return result;
      } catch (err) {
        this.db.exec('ROLLBACK');
        throw err;
      }
    };
  }

  close(): void {
    if (this._open) {
      // 닫기 전에 저장
      this.save();
      this.db.close();
      this._open = false;
    }
  }

  /**
   * 데이터베이스를 파일로 저장
   */
  save(): void {
    try {
      const data = this.db.export();
      const buffer = Buffer.from(data);
      fs.writeFileSync(this.dbPath, buffer);
    } catch (err) {
      console.error('[Context Sync] DB 저장 실패:', err);
    }
  }

  /**
   * 내부 sql.js DB 인스턴스 반환 (고급 사용)
   */
  getInternalDb(): SqlJsDatabase {
    return this.db;
  }
}

/**
 * DB 초기화 옵션
 */
export interface DatabaseOptions {
  /** 데이터베이스 파일 경로 */
  dbPath?: string;
  /** 읽기 전용 모드 */
  readonly?: boolean;
}

/**
 * 데이터베이스 초기화 (비동기)
 * @param storePath .context-sync 디렉토리 경로
 * @param options 초기화 옵션
 * @returns DatabaseInstance 또는 null (초기화 실패 시)
 */
export async function initDatabaseAsync(
  storePath: string,
  options: DatabaseOptions = {}
): Promise<DatabaseInstance | null> {
  // sql.js 초기화
  const initialized = await ensureSqlJsInitialized();
  if (!initialized || !SQL) {
    return null;
  }

  const { readonly = false } = options;
  const dbPath = options.dbPath || path.join(storePath, 'history.db');

  // 디렉토리 확인/생성
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  let db: SqlJsDatabase;

  // 기존 DB 파일 로드 또는 새로 생성
  if (fs.existsSync(dbPath)) {
    try {
      const buffer = fs.readFileSync(dbPath);
      db = new SQL.Database(buffer);
    } catch (err) {
      console.warn('[Context Sync] 기존 DB 로드 실패, 새로 생성:', err);
      db = new SQL.Database();
    }
  } else {
    db = new SQL.Database();
  }

  const wrapper = new DatabaseInstance(db, dbPath);

  // 스키마 초기화
  if (!readonly) {
    initSchema(wrapper);
    wrapper.save(); // 초기화 후 저장
  }

  return wrapper;
}

/**
 * 동기 버전 (이미 초기화된 경우에만 사용)
 * @deprecated initDatabaseAsync 사용 권장
 */
export function initDatabase(
  storePath: string,
  options: DatabaseOptions = {}
): DatabaseInstance | null {
  if (!SQL) {
    console.warn('[Context Sync] sql.js가 초기화되지 않았습니다. initDatabaseAsync를 사용하세요.');
    return null;
  }

  const { readonly = false } = options;
  const dbPath = options.dbPath || path.join(storePath, 'history.db');

  // 디렉토리 확인/생성
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  let db: SqlJsDatabase;

  // 기존 DB 파일 로드 또는 새로 생성
  if (fs.existsSync(dbPath)) {
    try {
      const buffer = fs.readFileSync(dbPath);
      db = new SQL.Database(buffer);
    } catch (err) {
      console.warn('[Context Sync] 기존 DB 로드 실패, 새로 생성:', err);
      db = new SQL.Database();
    }
  } else {
    db = new SQL.Database();
  }

  const wrapper = new DatabaseInstance(db, dbPath);

  // 스키마 초기화
  if (!readonly) {
    initSchema(wrapper);
    wrapper.save();
  }

  return wrapper;
}

/**
 * 스키마 초기화 및 마이그레이션
 */
function initSchema(db: DatabaseInstance): void {
  const queries = getAllSchemaQueries();

  // 트랜잭션으로 스키마 생성
  const initSchemaTransaction = db.transaction(() => {
    for (const query of queries) {
      try {
        db.exec(query);
      } catch (err) {
        // IF NOT EXISTS로 인해 대부분의 에러는 무시
        console.warn('[Context Sync] 스키마 쿼리 실행 경고:', err);
      }
    }

    // 스키마 버전 확인 및 마이그레이션
    const currentVersion = getSchemaVersion(db);

    if (currentVersion === 0) {
      // 새 DB - 최신 버전으로 설정
      db.prepare(
        'INSERT OR REPLACE INTO schema_version (version) VALUES (?)'
      ).run(SCHEMA_VERSION);
    } else if (currentVersion < SCHEMA_VERSION) {
      // 마이그레이션 필요
      runMigrations(db, currentVersion);
    }
  });

  initSchemaTransaction();
}

/**
 * v2.2: 스키마 마이그레이션 실행
 */
function runMigrations(db: DatabaseInstance, fromVersion: number): void {
  console.log(`[Context Sync] 마이그레이션 실행: v${fromVersion} → v${SCHEMA_VERSION}`);

  if (fromVersion < 2) {
    // v1 → v2 마이그레이션
    const migrationQueries = getV2MigrationQueries();
    for (const query of migrationQueries) {
      try {
        db.exec(query);
      } catch (err) {
        console.warn('[Context Sync] 마이그레이션 쿼리 경고:', err);
      }
    }

    // 기존 태그 데이터를 context_tags 테이블로 마이그레이션
    migrateTagsToJunctionTable(db);
  }

  // 버전 업데이트
  db.prepare(
    'INSERT OR REPLACE INTO schema_version (version) VALUES (?)'
  ).run(SCHEMA_VERSION);

  console.log(`[Context Sync] 마이그레이션 완료: v${SCHEMA_VERSION}`);
}

/**
 * v2.2: 기존 JSON 태그를 context_tags 테이블로 마이그레이션
 */
function migrateTagsToJunctionTable(db: DatabaseInstance): void {
  console.log('[Context Sync] 태그 정규화 마이그레이션 시작...');

  try {
    const contexts = db.prepare('SELECT id, tags FROM contexts').all() as Array<{
      id: string;
      tags: string;
    }>;

    let migratedCount = 0;

    for (const ctx of contexts) {
      try {
        const tags = JSON.parse(ctx.tags || '[]') as string[];
        for (const tag of tags) {
          if (tag && typeof tag === 'string') {
            db.prepare(
              'INSERT OR IGNORE INTO context_tags (context_id, tag) VALUES (?, ?)'
            ).run(ctx.id, tag.trim());
            migratedCount++;
          }
        }
      } catch {
        // JSON 파싱 실패 무시
      }
    }

    console.log(`[Context Sync] 태그 마이그레이션 완료: ${migratedCount}개 태그`);
  } catch (err) {
    console.error('[Context Sync] 태그 마이그레이션 실패:', err);
  }
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
 * 데이터베이스 저장 (sql.js는 메모리 기반이므로 수동 저장 필요)
 */
export function saveDatabase(db: DatabaseInstance): void {
  if (db && db.open) {
    db.save();
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

  // sql.js에서는 export된 데이터 크기로 추정
  const internalDb = db.getInternalDb();
  const data = internalDb.export();
  const dbSizeBytes = data.length;

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

/**
 * SQLite 사용 가능 여부 확인 (sql.js는 항상 사용 가능)
 */
export function isSqliteAvailable(): boolean {
  return true; // sql.js는 항상 사용 가능
}

/**
 * SQLite 로드 에러 반환
 */
export function getSqliteLoadError(): Error | null {
  return initError;
}

/**
 * v2.2: 컨텍스트의 태그를 context_tags 테이블에 동기화
 */
export function syncContextTags(
  db: DatabaseInstance,
  contextId: string,
  tags: string[]
): void {
  // 기존 태그 삭제
  db.prepare('DELETE FROM context_tags WHERE context_id = ?').run(contextId);

  // 새 태그 삽입
  for (const tag of tags) {
    if (tag && typeof tag === 'string') {
      db.prepare(
        'INSERT OR IGNORE INTO context_tags (context_id, tag) VALUES (?, ?)'
      ).run(contextId, tag.trim());
    }
  }
}

/**
 * v2.2: 컨텍스트의 태그 목록 조회
 */
export function getContextTags(db: DatabaseInstance, contextId: string): string[] {
  const rows = db.prepare(
    'SELECT tag FROM context_tags WHERE context_id = ? ORDER BY tag'
  ).all(contextId) as Array<{ tag: string }>;

  return rows.map((r) => r.tag);
}

/**
 * v2.2: 배치로 여러 컨텍스트의 액션 조회 (N+1 쿼리 방지)
 */
export function getActionsForContextsBatch(
  db: DatabaseInstance,
  contextIds: string[]
): Map<string, unknown[]> {
  if (contextIds.length === 0) return new Map();

  const placeholders = contextIds.map(() => '?').join(', ');
  const rows = db.prepare(`
    SELECT * FROM actions
    WHERE context_id IN (${placeholders})
    ORDER BY context_id, created_at ASC
  `).all(...contextIds) as Array<{ context_id: string; [key: string]: unknown }>;

  const result = new Map<string, unknown[]>();
  for (const row of rows) {
    const ctxId = row.context_id;
    if (!result.has(ctxId)) {
      result.set(ctxId, []);
    }
    result.get(ctxId)!.push(row);
  }

  return result;
}
