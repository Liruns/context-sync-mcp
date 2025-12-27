/**
 * Context Sync MCP v2.1 - context_recommend 도구
 * 관련 세션 추천
 */

import type { DatabaseInstance } from '../db/index.js';
import { createQueryBuilder, extractKeywords } from '../db/query-builder.js';
import type {
  ContextRecommendInput,
  ContextRecommendOutput,
  ContextMetadata,
} from '../types/index.js';

// 상수
const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 10;
const SEARCH_LIMIT = 20; // FTS 검색 후보 수

/**
 * 입력 검증
 */
export function validateRecommendInput(input: unknown): ContextRecommendInput {
  const parsed = input as Record<string, unknown>;

  if (!parsed.currentGoal || typeof parsed.currentGoal !== 'string') {
    throw new Error('currentGoal is required');
  }

  return {
    currentGoal: parsed.currentGoal,
    limit:
      typeof parsed.limit === 'number'
        ? Math.min(Math.max(1, parsed.limit), MAX_LIMIT)
        : DEFAULT_LIMIT,
  };
}

/**
 * 관련성 점수 계산
 */
interface RelevanceResult {
  score: number;
  matchedTags: string[];
}

function calculateRelevance(
  currentGoal: string,
  ctx: {
    goal: string;
    tags: string;
    status: string;
    created_at: string;
    metadata: string;
  }
): RelevanceResult {
  let score = 0;
  const matchedTags: string[] = [];
  const currentKeywords = extractKeywords(currentGoal);

  // 1. 태그 매칭 (키워드가 태그에 포함되면 +10점)
  try {
    const tags = JSON.parse(ctx.tags || '[]') as string[];
    for (const tag of tags) {
      const tagLower = tag.toLowerCase();
      if (currentKeywords.some((kw) => tagLower.includes(kw))) {
        score += 10;
        matchedTags.push(tag);
      }
    }
  } catch {
    // ignore
  }

  // 2. 목표 키워드 매칭 (+5점 per match)
  const goalLower = ctx.goal.toLowerCase();
  for (const kw of currentKeywords) {
    if (goalLower.includes(kw)) {
      score += 5;
    }
  }

  // 3. 완료된 세션 보너스 (+5점)
  if (ctx.status === 'completed') {
    score += 5;
  }

  // 4. 최신성 보너스
  try {
    const daysSince =
      (Date.now() - new Date(ctx.created_at).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSince < 7) {
      score += 3;
    } else if (daysSince < 30) {
      score += 1;
    }
  } catch {
    // ignore
  }

  return { score, matchedTags };
}

/**
 * 점수를 관련성으로 변환
 */
function scoreToRelevance(score: number): 'high' | 'medium' | 'low' {
  if (score >= 15) return 'high';
  if (score >= 8) return 'medium';
  return 'low';
}

/**
 * 실패한 접근법 추출
 */
function getFailedApproaches(metadata: ContextMetadata): string[] {
  if (!metadata.approaches) return [];

  return metadata.approaches
    .filter((a) => a.result === 'failed')
    .map((a) => a.description.slice(0, 50))
    .slice(0, 3);
}

/**
 * 관련 세션 추천
 */
export function recommendContexts(
  db: DatabaseInstance,
  input: ContextRecommendInput
): ContextRecommendOutput {
  const limit = input.limit || DEFAULT_LIMIT;

  // QueryBuilder를 사용하여 쿼리 생성
  const queryBuilder = createQueryBuilder(db);
  const { sql, params } = queryBuilder.buildRecommendQuery({
    query: input.currentGoal,
    limit: SEARCH_LIMIT,
  });

  const candidates = db.prepare(sql).all(...params) as Array<{
    id: string;
    goal: string;
    goal_short: string | null;
    summary_short: string | null;
    status: string;
    tags: string;
    metadata: string;
    has_warnings: number;
    created_at: string;
  }>;

  // 관련성 점수 계산 및 정렬
  const scored = candidates.map((ctx) => {
    const { score, matchedTags } = calculateRelevance(input.currentGoal, ctx);
    return { ctx, score, matchedTags };
  });

  scored.sort((a, b) => b.score - a.score);

  // 상위 N개 선택
  const topResults = scored.slice(0, limit);

  // 추천 목록 생성
  const recommendations: ContextRecommendOutput['recommendations'] = topResults.map(
    ({ ctx, score, matchedTags }) => {
      let metadata: ContextMetadata = { decisions: [], approaches: [], blockers: [] };
      try {
        metadata = JSON.parse(ctx.metadata || '{}') as ContextMetadata;
      } catch {
        // ignore
      }

      const failedApproaches = getFailedApproaches(metadata);

      return {
        id: ctx.id,
        goal: ctx.goal_short || ctx.goal.slice(0, 50),
        summary: ctx.summary_short || '',
        relevance: scoreToRelevance(score),
        matchedTags,
        ...(failedApproaches.length > 0 ? { failedApproaches } : {}),
      };
    }
  );

  return { recommendations };
}

/**
 * 추천을 마크다운으로 포맷
 */
export function formatRecommendMarkdown(
  output: ContextRecommendOutput
): string {
  if (output.recommendations.length === 0) {
    return '관련 세션을 찾을 수 없습니다.';
  }

  let md = `📚 **관련 세션 추천** (${output.recommendations.length}개)\n\n`;

  for (const rec of output.recommendations) {
    const relevanceIcon =
      rec.relevance === 'high' ? '🔥' : rec.relevance === 'medium' ? '⭐' : '📄';

    md += `### ${relevanceIcon} ${rec.goal}\n`;
    md += `- **ID**: \`${rec.id.slice(0, 8)}\`\n`;
    md += `- **관련성**: ${rec.relevance}\n`;

    if (rec.matchedTags.length > 0) {
      md += `- **매칭 태그**: ${rec.matchedTags.join(', ')}\n`;
    }

    if (rec.summary) {
      md += `- **요약**: ${rec.summary}\n`;
    }

    if (rec.failedApproaches && rec.failedApproaches.length > 0) {
      md += `- ⚠️ **실패 기록**: ${rec.failedApproaches.join(', ')}\n`;
    }

    md += `\n`;
  }

  return md;
}
