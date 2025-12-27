/**
 * 제한값 상수
 * 모든 제한값을 중앙 집중화
 */

/**
 * 검색 관련 제한
 */
export const SEARCH_LIMITS = {
  DEFAULT_LIMIT: 5,
  MAX_LIMIT: 20,
  MIN_LIMIT: 1,
} as const;

/**
 * 액션 관련 제한
 */
export const ACTION_LIMITS = {
  DEFAULT_LIMIT: 10,
  MAX_LIMIT: 50,
} as const;

/**
 * 경고/추천 관련 제한
 */
export const WARN_LIMITS = {
  DEFAULT_LIMIT: 3,
  MAX_LIMIT: 5,
  FAILURE_PATTERN_LIMIT: 10,
  MIN_FAILURE_COUNT: 2,
} as const;

/**
 * 추천 관련 제한
 */
export const RECOMMEND_LIMITS = {
  DEFAULT_LIMIT: 5,
  MAX_LIMIT: 10,
  SEARCH_LIMIT: 20,
} as const;

/**
 * 통계 관련 제한
 */
export const STATS_LIMITS = {
  TOP_TAGS_LIMIT: 10,
} as const;

/**
 * 설정 관련 제한
 */
export const CONFIG_LIMITS = {
  MIN_IDLE_MINUTES: 1,
  MAX_IDLE_MINUTES: 60,
  MIN_MAX_SNAPSHOTS: 1,
  MAX_MAX_SNAPSHOTS: 1000,
} as const;

/**
 * 필드 길이 제한
 */
export const FIELD_LIMITS = {
  GOAL_SHORT_MAX: 50,
  SUMMARY_SHORT_MAX: 100,
  CONTENT_PREVIEW_MAX: 100,
  ACTION_PREVIEW_MAX: 50,
} as const;

/**
 * 에디터 감시 관련 상수
 */
export const WATCHER_LIMITS = {
  DEFAULT_INTERVAL_MS: 2000,
  MAX_CONSECUTIVE_ERRORS: 5,
} as const;

/**
 * 메트릭스 관련 제한
 */
export const METRICS_LIMITS = {
  DEFAULT_MAX_METRICS: 1000,
  DEFAULT_RETENTION_DAYS: 30,
} as const;

/**
 * 아카이브 관련 제한
 */
export const ARCHIVE_LIMITS = {
  DEFAULT_LIMIT: 10,
  DEFAULT_RETENTION_DAYS: 90,
  DEFAULT_BATCH_SIZE: 100,
} as const;

/**
 * 페이지네이션 관련
 */
export const PAGINATION = {
  DEFAULT_OFFSET: 0,
} as const;

/**
 * 제한값 적용 헬퍼
 */
export function clampLimit(
  value: number | undefined,
  defaultLimit: number,
  maxLimit: number
): number {
  if (value === undefined) return defaultLimit;
  return Math.min(Math.max(1, value), maxLimit);
}
