/**
 * Context Sync MCP v2.0 - context_warn Tool
 * 세션 시작 시 경고/추천 조회 (경량, ~100 토큰)
 */

import type { DatabaseInstance } from '../db/index.js';
import { buildFtsQuery } from '../db/index.js';
import { generateWarningMessage } from '../utils/truncate.js';
import type {
  ContextWarnInput,
  ContextWarnOutput,
  ContextMetadata,
} from '../types/context.js';

const DEFAULT_LIMIT = 3;
const MAX_LIMIT = 5;

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
