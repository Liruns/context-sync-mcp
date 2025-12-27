/**
 * 에러 메시지 상수
 * 모든 에러 메시지를 중앙 집중화하여 일관성 유지
 */

/**
 * 컨텍스트 관련 에러
 */
export const CONTEXT_ERRORS = {
  NO_ACTIVE_CONTEXT: "활성 컨텍스트가 없습니다",
  CONTEXT_NOT_FOUND: "컨텍스트를 찾을 수 없습니다",
  CONTEXT_LOAD_FAILED: "컨텍스트 로드에 실패했습니다",
  CONTEXT_SAVE_FAILED: "컨텍스트 저장에 실패했습니다",
} as const;

/**
 * DB 관련 에러
 */
export const DB_ERRORS = {
  NOT_ENABLED: "DB가 활성화되지 않았습니다. SQLite를 확인하세요.",
  INIT_FAILED: "SQLite 초기화에 실패했습니다",
  QUERY_FAILED: "DB 쿼리 실행에 실패했습니다",
  MIGRATION_FAILED: "마이그레이션에 실패했습니다",
} as const;

/**
 * 검증 관련 에러
 */
export const VALIDATION_ERRORS = {
  REQUIRED_FIELD: (field: string) => `${field} 필드는 필수입니다`,
  MISSING_FIELD: (field: string) => `필수 필드 누락: ${field}`,
  INVALID_TYPE: (field: string, expected: string) =>
    `${field}은(는) ${expected} 타입이어야 합니다`,
  INVALID_VALUE: (field: string, validValues: string[]) =>
    `${field}은(는) ${validValues.join(", ")} 중 하나여야 합니다`,
  OUT_OF_RANGE: (field: string, min: number, max: number) =>
    `${field}은(는) ${min}~${max} 범위 내여야 합니다`,
  MIN_VALUE: (field: string, min: number) =>
    `${field}은(는) ${min} 이상이어야 합니다`,
  MAX_VALUE: (field: string, max: number) =>
    `${field}은(는) ${max}를 초과할 수 없습니다`,
} as const;

/**
 * 설정 관련 에러
 */
export const CONFIG_ERRORS = {
  VALIDATION_FAILED: (errors: string[]) =>
    `설정 검증 실패: ${errors.join(", ")}`,
  LOAD_FAILED: "설정 로드에 실패했습니다",
  SAVE_FAILED: "설정 저장에 실패했습니다",
} as const;

/**
 * 스냅샷 관련 에러
 */
export const SNAPSHOT_ERRORS = {
  NOT_FOUND: (id: string) => `스냅샷을 찾을 수 없음: ${id}`,
  PARSE_FAILED: (id: string) => `스냅샷 JSON 파싱 실패: ${id}`,
  RESTORE_FAILED: (id: string) => `스냅샷 복원 실패: ${id}`,
  CREATE_FAILED: "스냅샷 생성에 실패했습니다",
} as const;

/**
 * 동기화 관련 에러
 */
export const SYNC_ERRORS = {
  ALREADY_RUNNING: "자동 동기화가 이미 실행 중입니다",
  NOT_RUNNING: "자동 동기화가 실행 중이 아닙니다",
  START_FAILED: "자동 동기화 시작에 실패했습니다",
} as const;

/**
 * 도구 관련 에러
 */
export const TOOL_ERRORS = {
  UNKNOWN_TOOL: (name: string) => `알 수 없는 도구: ${name}`,
  INVALID_ACTION: (action: string, validActions: string[]) =>
    `잘못된 액션: ${action}. 유효한 값: ${validActions.join(", ")}`,
  EXECUTION_FAILED: (name: string) => `도구 실행 실패: ${name}`,
} as const;

/**
 * 아카이브 관련 에러
 */
export const ARCHIVE_ERRORS = {
  ACTION_REQUIRED: "action 필드는 필수입니다 (archive, restore, stats, search, list, purge)",
  CONTEXT_ID_REQUIRED: "restore 액션에는 contextId가 필요합니다",
  QUERY_REQUIRED: "search 액션에는 query가 필요합니다",
} as const;

/**
 * 내보내기 관련 에러
 */
export const EXPORT_ERRORS = {
  FORMAT_REQUIRED: "format 필드는 필수입니다 (markdown, json, html)",
  INVALID_FORMAT: (format: string) =>
    `잘못된 형식: ${format}. markdown, json, html 중 하나를 사용하세요`,
  UNKNOWN_FORMAT: (format: string) => `알 수 없는 형식: ${format}`,
} as const;

/**
 * 추천 관련 에러
 */
export const RECOMMEND_ERRORS = {
  GOAL_REQUIRED: "currentGoal 필드는 필수입니다",
} as const;
