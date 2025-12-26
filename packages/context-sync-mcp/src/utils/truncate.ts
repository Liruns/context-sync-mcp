/**
 * Context Sync MCP v2.0 - Server-side Truncation Utilities
 * 토큰 효율성을 위한 서버 사이드 요약 생성
 */

/**
 * 필드 길이 제한
 */
export const FIELD_LIMITS = {
  GOAL_MAX: 500,
  GOAL_SHORT_MAX: 50,
  SUMMARY_MAX: 2000,
  SUMMARY_SHORT_MAX: 100,
} as const;

/**
 * 텍스트를 지정된 길이로 자르기
 * @param text 원본 텍스트
 * @param maxLength 최대 길이
 * @param suffix 생략 시 접미사 (기본: '...')
 */
export function truncate(
  text: string | null | undefined,
  maxLength: number,
  suffix: string = '...'
): string {
  if (!text) return '';

  const trimmed = text.trim();
  if (trimmed.length <= maxLength) {
    return trimmed;
  }

  // 단어 경계에서 자르기 시도
  const truncated = trimmed.slice(0, maxLength - suffix.length);
  const lastSpace = truncated.lastIndexOf(' ');

  if (lastSpace > maxLength * 0.7) {
    return truncated.slice(0, lastSpace) + suffix;
  }

  return truncated + suffix;
}

/**
 * 목표(goal)의 짧은 버전 생성
 */
export function generateGoalShort(goal: string): string {
  return truncate(goal, FIELD_LIMITS.GOAL_SHORT_MAX);
}

/**
 * 요약(summary)의 짧은 버전 생성
 */
export function generateSummaryShort(summary: string | null | undefined): string {
  if (!summary) return '';
  return truncate(summary, FIELD_LIMITS.SUMMARY_SHORT_MAX);
}

/**
 * 경고 여부 확인
 * 실패한 접근법이나 미해결 블로커가 있으면 true
 */
export function hasWarnings(metadata: {
  approaches?: Array<{ result: string }>;
  blockers?: Array<{ resolved: boolean }>;
}): boolean {
  // 실패한 접근법 확인
  const hasFailedApproaches = metadata.approaches?.some(
    (a) => a.result === 'failed'
  ) ?? false;

  // 미해결 블로커 확인
  const hasUnresolvedBlockers = metadata.blockers?.some(
    (b) => !b.resolved
  ) ?? false;

  return hasFailedApproaches || hasUnresolvedBlockers;
}

/**
 * 컨텍스트 저장 시 짧은 버전들 자동 생성
 */
export interface ShortVersions {
  goalShort: string;
  summaryShort: string;
  hasWarnings: boolean;
}

export function generateShortVersions(input: {
  goal: string;
  summary?: string | null;
  approaches?: Array<{ result: string }>;
  blockers?: Array<{ resolved: boolean }>;
}): ShortVersions {
  return {
    goalShort: generateGoalShort(input.goal),
    summaryShort: generateSummaryShort(input.summary),
    hasWarnings: hasWarnings({
      approaches: input.approaches,
      blockers: input.blockers,
    }),
  };
}

/**
 * 날짜를 YYYY-MM-DD 형식으로 변환
 */
export function formatDateShort(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toISOString().split('T')[0];
}

/**
 * 경고 메시지 생성
 * 실패한 접근법이나 블로커를 간단한 메시지로 변환
 */
export function generateWarningMessage(
  _contextId: string,
  metadata: {
    approaches?: Array<{ description: string; result: string; reason?: string }>;
    blockers?: Array<{ description: string; resolved: boolean }>;
  },
  date: Date | string
): string | null {
  // 실패한 접근법 확인
  const failedApproach = metadata.approaches?.find(a => a.result === 'failed');
  if (failedApproach) {
    const shortDesc = truncate(failedApproach.description, 40);
    return `${shortDesc} (${formatDateShort(date)})`;
  }

  // 미해결 블로커 확인
  const unresolvedBlocker = metadata.blockers?.find(b => !b.resolved);
  if (unresolvedBlocker) {
    const shortDesc = truncate(unresolvedBlocker.description, 40);
    return `Blocker: ${shortDesc} (${formatDateShort(date)})`;
  }

  return null;
}
