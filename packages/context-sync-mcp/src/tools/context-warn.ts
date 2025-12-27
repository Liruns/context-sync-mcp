/**
 * Context Sync MCP v2.0/v2.1 - context_warn Tool
 * 세션 시작 시 경고/추천 조회 (경량, ~100 토큰)
 * v2.1: 반복 실패 패턴 감지 추가
 */

import type { DatabaseInstance } from '../db/index.js';
import { buildFtsQuery } from '../db/index.js';
import { generateWarningMessage } from '../utils/truncate.js';
import type {
  ContextWarnInput,
  ContextWarnOutput,
  ContextMetadata,
  EnhancedWarning,
} from '../types/context.js';

const DEFAULT_LIMIT = 3;
const MAX_LIMIT = 5;
const FAILURE_PATTERN_LIMIT = 10; // 실패 패턴 분석용 최대 컨텍스트 수
const MIN_FAILURE_COUNT = 2; // 경고 트리거 최소 실패 횟수

/**
 * 경고 및 추천 조회
 * ~100 토큰 응답
 */
export function getContextWarnings(
  db: DatabaseInstance,
  input: ContextWarnInput
): ContextWarnOutput {
  const { currentGoal, limit = DEFAULT_LIMIT } = input;
  const effectiveLimit = Math.min(limit, MAX_LIMIT);

  const warnings: Array<{ contextId: string; message: string }> = [];
  const recommendations: Array<{ id: string; goal: string }> = [];

  // 1. 경고가 있는 관련 세션 검색
  const ftsQuery = buildFtsQuery(currentGoal);

  const warningContexts = db.prepare(`
    SELECT c.id, c.goal_short, c.metadata, c.created_at
    FROM contexts c
    JOIN contexts_fts fts ON c.id = fts.id
    WHERE contexts_fts MATCH ?
      AND c.has_warnings = 1
    ORDER BY c.created_at DESC
    LIMIT ?
  `).all(ftsQuery, effectiveLimit) as Array<{
    id: string;
    goal_short: string | null;
    metadata: string;
    created_at: string;
  }>;

  for (const ctx of warningContexts) {
    let metadata: ContextMetadata;
    try {
      metadata = JSON.parse(ctx.metadata || '{}');
    } catch {
      continue;
    }

    const message = generateWarningMessage(ctx.id, metadata, ctx.created_at);
    if (message) {
      warnings.push({
        contextId: ctx.id,
        message,
      });
    }
  }

  // 2. 관련 세션 추천 (경고 없는 것 포함)
  const relatedContexts = db.prepare(`
    SELECT c.id, c.goal_short
    FROM contexts c
    JOIN contexts_fts fts ON c.id = fts.id
    WHERE contexts_fts MATCH ?
      AND c.status = 'completed'
    ORDER BY c.created_at DESC
    LIMIT ?
  `).all(ftsQuery, effectiveLimit) as Array<{
    id: string;
    goal_short: string | null;
  }>;

  for (const ctx of relatedContexts) {
    // 이미 경고에 포함된 것은 제외
    if (warnings.some((w) => w.contextId === ctx.id)) continue;

    recommendations.push({
      id: ctx.id,
      goal: ctx.goal_short || '',
    });

    if (recommendations.length >= effectiveLimit) break;
  }

  // 3. 전체 관련 세션 수 확인
  const totalResult = db.prepare(`
    SELECT COUNT(*) as count
    FROM contexts c
    JOIN contexts_fts fts ON c.id = fts.id
    WHERE contexts_fts MATCH ?
  `).get(ftsQuery) as { count: number };

  const hasMore = totalResult.count > warnings.length + recommendations.length;

  return {
    warnings,
    recommendations,
    hasMore,
  };
}

/**
 * 간단한 키워드 기반 경고 조회 (FTS 없이)
 */
export function getSimpleWarnings(
  db: DatabaseInstance,
  limit: number = DEFAULT_LIMIT
): ContextWarnOutput {
  const effectiveLimit = Math.min(limit, MAX_LIMIT);
  const warnings: Array<{ contextId: string; message: string }> = [];

  // 최근 경고가 있는 세션 조회
  const warningContexts = db.prepare(`
    SELECT id, goal_short, metadata, created_at
    FROM contexts
    WHERE has_warnings = 1
    ORDER BY created_at DESC
    LIMIT ?
  `).all(effectiveLimit) as Array<{
    id: string;
    goal_short: string | null;
    metadata: string;
    created_at: string;
  }>;

  for (const ctx of warningContexts) {
    let metadata: ContextMetadata;
    try {
      metadata = JSON.parse(ctx.metadata || '{}');
    } catch {
      continue;
    }

    const message = generateWarningMessage(ctx.id, metadata, ctx.created_at);
    if (message) {
      warnings.push({
        contextId: ctx.id,
        message,
      });
    }
  }

  return {
    warnings,
    recommendations: [],
    hasMore: false,
  };
}

/**
 * 입력 유효성 검사
 */
export function validateWarnInput(input: unknown): ContextWarnInput {
  const parsed = input as Record<string, unknown>;

  if (!parsed.currentGoal || typeof parsed.currentGoal !== 'string') {
    throw new Error('currentGoal is required');
  }

  return {
    currentGoal: parsed.currentGoal,
    limit: typeof parsed.limit === 'number'
      ? Math.min(parsed.limit, MAX_LIMIT)
      : DEFAULT_LIMIT,
  };
}

// ========================================
// v2.1 - 반복 실패 패턴 감지
// ========================================

/**
 * 반복 실패 패턴 감지
 * 유사한 작업에서 같은 접근법이 여러 번 실패한 경우 경고
 */
export function detectFailurePatterns(
  db: DatabaseInstance,
  currentGoal: string
): EnhancedWarning[] {
  const warnings: EnhancedWarning[] = [];
  const ftsQuery = buildFtsQuery(currentGoal);

  // 경고가 있는 관련 세션 검색
  const failedContexts = db.prepare(`
    SELECT c.id, c.goal_short, c.metadata, c.created_at
    FROM contexts c
    JOIN contexts_fts fts ON c.id = fts.id
    WHERE contexts_fts MATCH ?
      AND c.has_warnings = 1
    ORDER BY c.created_at DESC
    LIMIT ?
  `).all(ftsQuery, FAILURE_PATTERN_LIMIT) as Array<{
    id: string;
    goal_short: string | null;
    metadata: string;
    created_at: string;
  }>;

  // 접근법별 실패 횟수 집계
  const failuresByApproach: Record<string, {
    count: number;
    contextIds: string[];
    lastDate: string;
  }> = {};

  for (const ctx of failedContexts) {
    let metadata: ContextMetadata;
    try {
      metadata = JSON.parse(ctx.metadata || '{}');
    } catch {
      continue;
    }

    for (const approach of metadata.approaches || []) {
      if (approach.result === 'failed') {
        // 접근법 설명의 처음 50자를 키로 사용
        const key = approach.description.slice(0, 50).toLowerCase().trim();
        if (!failuresByApproach[key]) {
          failuresByApproach[key] = {
            count: 0,
            contextIds: [],
            lastDate: ctx.created_at,
          };
        }
        failuresByApproach[key].count++;
        failuresByApproach[key].contextIds.push(ctx.id);
        // 최신 날짜 업데이트
        if (ctx.created_at > failuresByApproach[key].lastDate) {
          failuresByApproach[key].lastDate = ctx.created_at;
        }
      }
    }
  }

  // 2회 이상 실패한 접근법을 경고로 추가
  for (const [approach, data] of Object.entries(failuresByApproach)) {
    if (data.count >= MIN_FAILURE_COUNT) {
      warnings.push({
        contextId: data.contextIds[0], // 가장 최근 컨텍스트
        type: 'repeated_failure',
        message: `"${approach}..." 접근법이 ${data.count}회 실패함`,
        severity: data.count >= 3 ? 'error' : 'warning',
        details: {
          failureCount: data.count,
          lastFailureDate: data.lastDate.split('T')[0],
        },
      });
    }
  }

  // 미해결 블로커 검사
  for (const ctx of failedContexts) {
    let metadata: ContextMetadata;
    try {
      metadata = JSON.parse(ctx.metadata || '{}');
    } catch {
      continue;
    }

    const unresolvedBlockers = (metadata.blockers || []).filter(
      (b) => !b.resolved
    );

    for (const blocker of unresolvedBlockers.slice(0, 2)) {
      // 이미 같은 설명의 경고가 있는지 확인
      const exists = warnings.some(
        (w) =>
          w.type === 'unresolved_blocker' &&
          w.message.includes(blocker.description.slice(0, 30))
      );

      if (!exists) {
        warnings.push({
          contextId: ctx.id,
          type: 'unresolved_blocker',
          message: `미해결: ${blocker.description.slice(0, 50)}`,
          severity: 'warning',
          details: {
            lastFailureDate: ctx.created_at.split('T')[0],
          },
        });
      }
    }
  }

  // 심각도 순으로 정렬 (error > warning > info)
  const severityOrder = { error: 0, warning: 1, info: 2 };
  warnings.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return warnings.slice(0, 5); // 최대 5개
}

/**
 * 강화된 경고 조회 (v2.1)
 * 기본 경고 + 반복 실패 패턴 감지
 */
export function getEnhancedWarnings(
  db: DatabaseInstance,
  input: ContextWarnInput
): {
  basic: ContextWarnOutput;
  enhanced: EnhancedWarning[];
} {
  const basic = getContextWarnings(db, input);
  const enhanced = detectFailurePatterns(db, input.currentGoal);

  return { basic, enhanced };
}

/**
 * 강화된 경고를 마크다운으로 포맷
 */
export function formatEnhancedWarnings(
  enhanced: EnhancedWarning[]
): string {
  if (enhanced.length === 0) {
    return '';
  }

  let md = `\n### ⚠️ 반복 실패 패턴 감지\n\n`;

  for (const w of enhanced) {
    const icon =
      w.severity === 'error' ? '🚨' : w.severity === 'warning' ? '⚠️' : 'ℹ️';
    const typeLabel =
      w.type === 'repeated_failure'
        ? '반복 실패'
        : w.type === 'unresolved_blocker'
        ? '미해결 블로커'
        : '실패';

    md += `- ${icon} **[${typeLabel}]** ${w.message}`;
    if (w.details?.failureCount) {
      md += ` (${w.details.failureCount}회)`;
    }
    if (w.details?.lastFailureDate) {
      md += ` - ${w.details.lastFailureDate}`;
    }
    md += `\n`;
  }

  return md;
}
