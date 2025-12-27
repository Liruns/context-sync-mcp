/**
 * 유효값 상수
 * enum 대신 사용하는 유효값 목록
 */

/**
 * 작업 상태
 */
export const VALID_STATUS = [
  "planning",
  "coding",
  "testing",
  "reviewing",
  "debugging",
  "completed",
  "paused",
] as const;

export type ValidStatus = (typeof VALID_STATUS)[number];

/**
 * AI 에이전트 유형
 */
export const VALID_AGENTS = [
  "claude-code",
  "cursor",
  "windsurf",
  "copilot",
  "unknown",
] as const;

export type ValidAgent = (typeof VALID_AGENTS)[number];

/**
 * 스냅샷 생성 이유
 */
export const VALID_SNAPSHOT_REASONS = [
  "auto",
  "manual",
  "handoff",
  "milestone",
] as const;

export type ValidSnapshotReason = (typeof VALID_SNAPSHOT_REASONS)[number];

/**
 * 아카이브 액션
 */
export const VALID_ARCHIVE_ACTIONS = [
  "archive",
  "restore",
  "stats",
  "search",
  "list",
  "purge",
] as const;

export type ValidArchiveAction = (typeof VALID_ARCHIVE_ACTIONS)[number];

/**
 * 내보내기 형식
 */
export const VALID_EXPORT_FORMATS = ["markdown", "json", "html"] as const;

export type ValidExportFormat = (typeof VALID_EXPORT_FORMATS)[number];

/**
 * 압축 레벨
 */
export const VALID_COMPRESSION_LEVELS = [
  "none",
  "low",
  "medium",
  "high",
] as const;

export type ValidCompressionLevel = (typeof VALID_COMPRESSION_LEVELS)[number];

/**
 * 동기화 모드
 */
export const VALID_SYNC_MODES = ["auto", "manual", "smart"] as const;

export type ValidSyncMode = (typeof VALID_SYNC_MODES)[number];

/**
 * 컨텍스트 로드 형식
 */
export const VALID_LOAD_FORMATS = [
  "full",
  "summary",
  "decisions",
  "blockers",
  "next_steps",
] as const;

export type ValidLoadFormat = (typeof VALID_LOAD_FORMATS)[number];

/**
 * 컨텍스트 쿼리 타입
 */
export const VALID_QUERY_TYPES = [
  "decisions",
  "blockers",
  "approaches",
  "next_steps",
  "agent_chain",
  "code_changes",
] as const;

export type ValidQueryType = (typeof VALID_QUERY_TYPES)[number];

/**
 * 접근법 결과
 */
export const VALID_APPROACH_RESULTS = ["success", "failed", "partial"] as const;

export type ValidApproachResult = (typeof VALID_APPROACH_RESULTS)[number];

/**
 * 액션 타입
 */
export const VALID_ACTION_TYPES = ["command", "edit", "error"] as const;

export type ValidActionType = (typeof VALID_ACTION_TYPES)[number];

/**
 * 유효값 검사 헬퍼
 */
export function isValidValue<T extends readonly string[]>(
  value: unknown,
  validValues: T
): value is T[number] {
  return typeof value === "string" && validValues.includes(value as T[number]);
}
