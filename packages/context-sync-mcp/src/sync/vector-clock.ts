/**
 * Vector Clock - 분산 시스템 인과관계 추적
 * v2.5: 충돌 감지 및 병합 지원
 */

/**
 * Vector Clock 타입
 * 각 에이전트별 논리적 시간을 추적
 */
export interface VectorClock {
  [agent: string]: number;
}

/**
 * Vector Clock 비교 결과
 */
export type ClockCompareResult = "before" | "after" | "concurrent" | "equal";

/**
 * 빈 Vector Clock 생성
 */
export function createClock(): VectorClock {
  return {};
}

/**
 * Vector Clock 복제
 */
export function cloneClock(clock: VectorClock): VectorClock {
  return { ...clock };
}

/**
 * 특정 에이전트의 시간 증가
 */
export function increment(clock: VectorClock, agent: string): VectorClock {
  return {
    ...clock,
    [agent]: (clock[agent] || 0) + 1,
  };
}

/**
 * 두 Vector Clock 병합 (각 에이전트별 최댓값)
 */
export function merge(a: VectorClock, b: VectorClock): VectorClock {
  const agents = new Set([...Object.keys(a), ...Object.keys(b)]);
  const result: VectorClock = {};

  for (const agent of agents) {
    result[agent] = Math.max(a[agent] || 0, b[agent] || 0);
  }

  return result;
}

/**
 * 두 Vector Clock 비교
 * @returns 'before' - a가 b보다 이전
 * @returns 'after' - a가 b보다 이후
 * @returns 'concurrent' - 동시 발생 (충돌 가능)
 * @returns 'equal' - 동일
 */
export function compare(a: VectorClock, b: VectorClock): ClockCompareResult {
  const agents = new Set([...Object.keys(a), ...Object.keys(b)]);

  let aLess = false;
  let aGreater = false;

  for (const agent of agents) {
    const aVal = a[agent] || 0;
    const bVal = b[agent] || 0;

    if (aVal < bVal) aLess = true;
    if (aVal > bVal) aGreater = true;
  }

  if (!aLess && !aGreater) return "equal";
  if (aLess && !aGreater) return "before";
  if (aGreater && !aLess) return "after";
  return "concurrent";
}

/**
 * a가 b보다 이전인지 확인
 */
export function isBefore(a: VectorClock, b: VectorClock): boolean {
  return compare(a, b) === "before";
}

/**
 * a가 b보다 이후인지 확인
 */
export function isAfter(a: VectorClock, b: VectorClock): boolean {
  return compare(a, b) === "after";
}

/**
 * 두 clock이 동시 발생(충돌)인지 확인
 */
export function isConcurrent(a: VectorClock, b: VectorClock): boolean {
  return compare(a, b) === "concurrent";
}

/**
 * 두 clock이 동일한지 확인
 */
export function isEqual(a: VectorClock, b: VectorClock): boolean {
  return compare(a, b) === "equal";
}

/**
 * Vector Clock을 문자열로 변환
 */
export function toString(clock: VectorClock): string {
  const entries = Object.entries(clock).sort((a, b) => a[0].localeCompare(b[0]));
  return entries.map(([agent, time]) => `${agent}:${time}`).join(",");
}

/**
 * 문자열에서 Vector Clock 파싱
 */
export function fromString(str: string): VectorClock {
  if (!str) return {};

  const clock: VectorClock = {};
  const parts = str.split(",");

  for (const part of parts) {
    const [agent, timeStr] = part.split(":");
    if (agent && timeStr) {
      clock[agent] = parseInt(timeStr, 10);
    }
  }

  return clock;
}

/**
 * Vector Clock 유효성 검사
 */
export function isValid(clock: unknown): clock is VectorClock {
  if (typeof clock !== "object" || clock === null) return false;

  for (const [key, value] of Object.entries(clock)) {
    if (typeof key !== "string") return false;
    if (typeof value !== "number" || value < 0 || !Number.isInteger(value)) {
      return false;
    }
  }

  return true;
}
