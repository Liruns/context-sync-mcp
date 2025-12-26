/**
 * Context Sync MCP v2.0 - Database Schema
 * SQLite 스키마 정의 및 FTS5 전문검색 설정
 */

export const SCHEMA_VERSION = 1;

/**
 * 메인 테이블 스키마
 */
export const CREATE_CONTEXTS_TABLE = `
CREATE TABLE IF NOT EXISTS contexts (
  id TEXT PRIMARY KEY,
  parent_id TEXT,
  goal TEXT NOT NULL,
  goal_short TEXT,
  summary TEXT,
  summary_short TEXT,
  status TEXT DEFAULT 'planning',
  tags TEXT DEFAULT '[]',
  agent TEXT,
  metadata TEXT DEFAULT '{}',
  has_warnings INTEGER DEFAULT 0,
  project_path TEXT,
  started_at TEXT NOT NULL,
  ended_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  version INTEGER DEFAULT 1,
  FOREIGN KEY (parent_id) REFERENCES contexts(id)
)`;

/**
 * 액션 로그 테이블 (명령어, 편집, 에러)
 */
export const CREATE_ACTIONS_TABLE = `
CREATE TABLE IF NOT EXISTS actions (
  id TEXT PRIMARY KEY,
  context_id TEXT NOT NULL,
  type TEXT NOT NULL,
  content TEXT NOT NULL,
  result TEXT,
  file_path TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (context_id) REFERENCES contexts(id)
)`;

/**
 * FTS5 전문검색 인덱스
 */
export const CREATE_FTS_TABLE = `
CREATE VIRTUAL TABLE IF NOT EXISTS contexts_fts USING fts5(
  id,
  goal,
  summary,
  tags,
  content='contexts',
  content_rowid='rowid'
)`;

/**
 * FTS 트리거 - INSERT
 */
export const CREATE_FTS_INSERT_TRIGGER = `
CREATE TRIGGER IF NOT EXISTS contexts_ai AFTER INSERT ON contexts BEGIN
  INSERT INTO contexts_fts(id, goal, summary, tags)
  VALUES (new.id, new.goal, new.summary, new.tags);
END`;

/**
 * FTS 트리거 - UPDATE
 */
export const CREATE_FTS_UPDATE_TRIGGER = `
CREATE TRIGGER IF NOT EXISTS contexts_au AFTER UPDATE ON contexts BEGIN
  DELETE FROM contexts_fts WHERE id = old.id;
  INSERT INTO contexts_fts(id, goal, summary, tags)
  VALUES (new.id, new.goal, new.summary, new.tags);
END`;

/**
 * FTS 트리거 - DELETE
 */
export const CREATE_FTS_DELETE_TRIGGER = `
CREATE TRIGGER IF NOT EXISTS contexts_ad AFTER DELETE ON contexts BEGIN
  DELETE FROM contexts_fts WHERE id = old.id;
END`;

/**
 * 인덱스들
 */
export const CREATE_INDEXES = [
  `CREATE INDEX IF NOT EXISTS idx_contexts_parent ON contexts(parent_id)`,
  `CREATE INDEX IF NOT EXISTS idx_contexts_status ON contexts(status)`,
  `CREATE INDEX IF NOT EXISTS idx_contexts_agent ON contexts(agent)`,
  `CREATE INDEX IF NOT EXISTS idx_contexts_project ON contexts(project_path)`,
  `CREATE INDEX IF NOT EXISTS idx_contexts_created ON contexts(created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_contexts_warnings ON contexts(has_warnings)`,
  `CREATE INDEX IF NOT EXISTS idx_actions_context ON actions(context_id)`,
  `CREATE INDEX IF NOT EXISTS idx_actions_type ON actions(type)`,
  `CREATE INDEX IF NOT EXISTS idx_actions_file ON actions(file_path)`,
];

/**
 * 스키마 버전 테이블
 */
export const CREATE_SCHEMA_VERSION_TABLE = `
CREATE TABLE IF NOT EXISTS schema_version (
  version INTEGER PRIMARY KEY,
  applied_at TEXT DEFAULT CURRENT_TIMESTAMP
)`;

/**
 * 모든 스키마 생성 쿼리 (순서 중요)
 */
export function getAllSchemaQueries(): string[] {
  return [
    CREATE_SCHEMA_VERSION_TABLE,
    CREATE_CONTEXTS_TABLE,
    CREATE_ACTIONS_TABLE,
    CREATE_FTS_TABLE,
    CREATE_FTS_INSERT_TRIGGER,
    CREATE_FTS_UPDATE_TRIGGER,
    CREATE_FTS_DELETE_TRIGGER,
    ...CREATE_INDEXES,
  ];
}
