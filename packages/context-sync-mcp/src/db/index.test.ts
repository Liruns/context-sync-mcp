/**
 * Database Module Tests
 * sql.js 기반 DB 래퍼 테스트
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  initDatabaseAsync,
  closeDatabase,
  saveDatabase,
  getDatabaseStats,
  hasFts5Support,
  buildFtsQuery,
  withTransaction,
  getSchemaVersion,
  syncContextTags,
  getContextTags,
  getActionsForContextsBatch,
  type DatabaseInstance,
} from './index.js';

// 테스트용 컨텍스트 INSERT 헬퍼
function insertTestContext(
  db: DatabaseInstance,
  id: string,
  goal: string,
  options: { status?: string; agent?: string; tags?: string } = {}
): void {
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO contexts (id, project_path, goal, status, agent, tags, metadata, started_at, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    '/test/path',
    goal,
    options.status || 'coding',
    options.agent || 'claude-code',
    options.tags || '[]',
    '{}',
    now,
    now,
    now
  );
}

describe('Database Module', () => {
  let db: DatabaseInstance | null = null;
  let testDir: string;

  beforeEach(async () => {
    // 테스트용 임시 디렉토리 생성
    testDir = path.join(os.tmpdir(), `context-sync-test-${Date.now()}`);
    fs.mkdirSync(testDir, { recursive: true });

    // DB 초기화
    db = await initDatabaseAsync(testDir);
  });

  afterEach(() => {
    // DB 닫기
    if (db) {
      closeDatabase(db);
      db = null;
    }

    // 테스트 디렉토리 정리
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('initDatabaseAsync', () => {
    it('should create database instance', () => {
      expect(db).not.toBeNull();
      expect(db!.open).toBe(true);
    });

    it('should create database file', () => {
      const dbPath = path.join(testDir, 'history.db');
      expect(fs.existsSync(dbPath)).toBe(true);
    });

    it('should initialize schema', () => {
      // contexts 테이블 확인
      const result = db!.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='contexts'"
      ).get() as { name: string } | undefined;
      expect(result?.name).toBe('contexts');
    });

    it('should set schema version', () => {
      const version = getSchemaVersion(db!);
      expect(version).toBeGreaterThanOrEqual(1);
    });
  });

  describe('StatementWrapper', () => {
    describe('run()', () => {
      it('should insert data and return changes', () => {
        const now = new Date().toISOString();
        const result = db!.prepare(`
          INSERT INTO contexts (id, project_path, goal, status, agent, tags, metadata, started_at, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          'test-id-1',
          '/test/path',
          'Test Goal',
          'coding',
          'claude-code',
          '[]',
          '{}',
          now,
          now,
          now
        );

        expect(result.changes).toBe(1);
      });
    });

    describe('get()', () => {
      it('should return single row', () => {
        // 데이터 삽입
        insertTestContext(db!, 'test-id-2', 'Test Goal 2', { agent: 'cursor' });

        const row = db!.prepare('SELECT * FROM contexts WHERE id = ?').get('test-id-2') as {
          id: string;
          goal: string;
        };

        expect(row).toBeDefined();
        expect(row.id).toBe('test-id-2');
        expect(row.goal).toBe('Test Goal 2');
      });

      it('should return undefined when no match', () => {
        const row = db!.prepare('SELECT * FROM contexts WHERE id = ?').get('non-existent');
        expect(row).toBeUndefined();
      });
    });

    describe('all()', () => {
      beforeEach(() => {
        // 테스트 데이터 삽입
        for (let i = 1; i <= 5; i++) {
          insertTestContext(db!, `all-test-${i}`, `Goal ${i}`);
        }
      });

      it('should return all matching rows', () => {
        const rows = db!.prepare('SELECT * FROM contexts WHERE id LIKE ?').all('all-test-%');
        expect(rows).toHaveLength(5);
      });

      it('should return empty array when no match', () => {
        const rows = db!.prepare('SELECT * FROM contexts WHERE id = ?').all('non-existent');
        expect(rows).toHaveLength(0);
      });

      it('should optimize column name retrieval (cached)', () => {
        // 많은 row를 반환하는 쿼리 실행
        const rows = db!.prepare('SELECT * FROM contexts WHERE id LIKE ?').all('all-test-%') as Array<{
          id: string;
        }>;

        // 모든 row가 올바르게 반환되는지 확인
        expect(rows).toHaveLength(5);
        expect(rows.every((r) => r.id.startsWith('all-test-'))).toBe(true);
      });
    });
  });

  describe('DatabaseInstance', () => {
    describe('exec()', () => {
      it('should execute SQL without returning results', () => {
        expect(() => {
          db!.exec('CREATE TABLE IF NOT EXISTS test_table (id TEXT PRIMARY KEY)');
        }).not.toThrow();
      });
    });

    describe('transaction()', () => {
      it('should commit on success', () => {
        const insertWithTransaction = db!.transaction(() => {
          insertTestContext(db!, 'tx-test-1', 'Transaction Test');
          return 'success';
        });

        const result = insertWithTransaction();
        expect(result).toBe('success');

        // 데이터 확인
        const row = db!.prepare('SELECT * FROM contexts WHERE id = ?').get('tx-test-1');
        expect(row).toBeDefined();
      });

      it('should rollback on error', () => {
        const failingTransaction = db!.transaction(() => {
          insertTestContext(db!, 'tx-fail-test', 'Will Rollback');
          throw new Error('Intentional failure');
        });

        expect(() => failingTransaction()).toThrow('Intentional failure');

        // 데이터가 롤백되었는지 확인
        const row = db!.prepare('SELECT * FROM contexts WHERE id = ?').get('tx-fail-test');
        expect(row).toBeUndefined();
      });
    });

    describe('save()', () => {
      it('should save database to file', () => {
        // 데이터 삽입
        insertTestContext(db!, 'save-test', 'Save Test');

        // 저장
        saveDatabase(db!);

        // 파일 크기 확인
        const dbPath = path.join(testDir, 'history.db');
        const stats = fs.statSync(dbPath);
        expect(stats.size).toBeGreaterThan(0);
      });
    });
  });

  describe('Helper Functions', () => {
    describe('getDatabaseStats()', () => {
      it('should return database statistics', () => {
        // 테스트 데이터 삽입
        insertTestContext(db!, 'stats-test', 'Stats Test');

        const stats = getDatabaseStats(db!);

        expect(stats.contextCount).toBeGreaterThanOrEqual(1);
        expect(stats.actionCount).toBeGreaterThanOrEqual(0);
        expect(stats.dbSizeBytes).toBeGreaterThan(0);
      });
    });

    describe('hasFts5Support()', () => {
      it('should check FTS5 support', () => {
        // sql.js는 FTS5를 지원하지 않음
        const result = hasFts5Support(db!);
        expect(typeof result).toBe('boolean');
      });
    });

    describe('buildFtsQuery()', () => {
      it('should build FTS query with single term', () => {
        const result = buildFtsQuery('test');
        expect(result).toBe('"test"*');
      });

      it('should build FTS query with multiple terms', () => {
        const result = buildFtsQuery('hello world');
        expect(result).toBe('"hello"* OR "world"*');
      });

      it('should escape quotes', () => {
        const result = buildFtsQuery('test"value');
        expect(result).toBe('"test""value"*');
      });

      it('should handle empty query', () => {
        const result = buildFtsQuery('');
        expect(result).toBe('*');
      });
    });

    describe('withTransaction()', () => {
      it('should execute function in transaction', () => {
        const result = withTransaction(db!, () => {
          return 'executed';
        });
        expect(result).toBe('executed');
      });
    });
  });

  describe('Tag Functions', () => {
    beforeEach(() => {
      // 테스트 컨텍스트 생성
      insertTestContext(db!, 'tag-test-ctx', 'Tag Test');
    });

    describe('syncContextTags()', () => {
      it('should sync tags to context_tags table', () => {
        syncContextTags(db!, 'tag-test-ctx', ['typescript', 'testing', 'db']);

        const tags = getContextTags(db!, 'tag-test-ctx');
        expect(tags).toHaveLength(3);
        expect(tags).toContain('typescript');
        expect(tags).toContain('testing');
        expect(tags).toContain('db');
      });

      it('should replace existing tags', () => {
        syncContextTags(db!, 'tag-test-ctx', ['old-tag']);
        syncContextTags(db!, 'tag-test-ctx', ['new-tag-1', 'new-tag-2']);

        const tags = getContextTags(db!, 'tag-test-ctx');
        expect(tags).not.toContain('old-tag');
        expect(tags).toContain('new-tag-1');
        expect(tags).toContain('new-tag-2');
      });

      it('should trim whitespace from tags', () => {
        syncContextTags(db!, 'tag-test-ctx', ['  spaced  ', 'normal']);

        const tags = getContextTags(db!, 'tag-test-ctx');
        expect(tags).toContain('spaced');
        expect(tags).toContain('normal');
      });

      it('should ignore empty tags', () => {
        syncContextTags(db!, 'tag-test-ctx', ['', 'valid', '   ']);

        const tags = getContextTags(db!, 'tag-test-ctx');
        expect(tags).toHaveLength(1);
        expect(tags).toContain('valid');
      });
    });

    describe('getContextTags()', () => {
      it('should return tags sorted alphabetically', () => {
        syncContextTags(db!, 'tag-test-ctx', ['zebra', 'apple', 'mango']);

        const tags = getContextTags(db!, 'tag-test-ctx');
        expect(tags).toEqual(['apple', 'mango', 'zebra']);
      });

      it('should return empty array for non-existent context', () => {
        const tags = getContextTags(db!, 'non-existent');
        expect(tags).toEqual([]);
      });
    });
  });

  describe('Batch Functions', () => {
    beforeEach(() => {
      // 테스트 컨텍스트들 생성
      for (let i = 1; i <= 3; i++) {
        insertTestContext(db!, `batch-ctx-${i}`, `Batch Test ${i}`);

        // 각 컨텍스트에 액션 추가
        for (let j = 1; j <= 2; j++) {
          db!.prepare(`
            INSERT INTO actions (id, context_id, type, content, created_at)
            VALUES (?, ?, ?, ?, ?)
          `).run(
            `action-${i}-${j}`,
            `batch-ctx-${i}`,
            'decision',
            '{}',
            new Date().toISOString()
          );
        }
      }
    });

    describe('getActionsForContextsBatch()', () => {
      it('should return actions grouped by context', () => {
        const result = getActionsForContextsBatch(db!, [
          'batch-ctx-1',
          'batch-ctx-2',
          'batch-ctx-3',
        ]);

        expect(result.size).toBe(3);
        expect(result.get('batch-ctx-1')).toHaveLength(2);
        expect(result.get('batch-ctx-2')).toHaveLength(2);
        expect(result.get('batch-ctx-3')).toHaveLength(2);
      });

      it('should return empty map for empty input', () => {
        const result = getActionsForContextsBatch(db!, []);
        expect(result.size).toBe(0);
      });

      it('should handle non-existent context IDs', () => {
        const result = getActionsForContextsBatch(db!, ['non-existent']);
        expect(result.size).toBe(0);
      });

      it('should handle mixed existing and non-existing IDs', () => {
        const result = getActionsForContextsBatch(db!, [
          'batch-ctx-1',
          'non-existent',
          'batch-ctx-2',
        ]);

        expect(result.size).toBe(2);
        expect(result.has('batch-ctx-1')).toBe(true);
        expect(result.has('batch-ctx-2')).toBe(true);
        expect(result.has('non-existent')).toBe(false);
      });
    });
  });
});
