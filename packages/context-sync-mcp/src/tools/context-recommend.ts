/**
 * Context Sync MCP v2.1 - context_recommend 도구
 * 관련 세션 추천
 */

import type { DatabaseInstance } from '../db/index.js';
import { buildFtsQuery, hasFts5Support } from '../db/index.js';
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
 * 키워드 추출 (간단한 토크나이저)
 */
function extractKeywords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\sㄱ-ㅎㅏ-ㅣ가-힣]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length >= 2)
    .slice(0, 10); // 최대 10개
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

  // FTS5 지원 여부 확인
  const useFts = hasFts5Support(db);

  let candidates: Array<{
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

  if (useFts) {
    // FTS5 전문검색
    const ftsQuery = buildFtsQuery(input.currentGoal);
    candidates = db
      .prepare(
        `
        SELECT c.id, c.goal, c.goal_short, c.summary_short, c.status,
               c.tags, c.metadata, c.has_warnings, c.created_at
        FROM contexts c
        JOIN contexts_fts fts ON c.id = fts.id
        WHERE contexts_fts MATCH ?
        ORDER BY rank
        LIMIT ?
      `
      )
      .all(ftsQuery, SEARCH_LIMIT) as typeof candidates;
  } else {
    // FTS5 미지원: LIKE 검색으로 fallback
    const keywords = extractKeywords(input.currentGoal);
    if (keywords.length === 0) {
      // 키워드가 없으면 최신 컨텍스트 반환
      candidates = db
        .prepare(
          `
          SELECT id, goal, goal_short, summary_short, status,
                 tags, metadata, has_warnings, created_at
          FROM contexts
          ORDER BY created_at DESC
          LIMIT ?
        `
        )
        .all(SEARCH_LIMIT) as typeof candidates;
    } else {
      // 키워드 기반 LIKE 검색
      const likeConditions = keywords
        .slice(0, 5) // 최대 5개 키워드만 사용
        .map(() => '(goal LIKE ? OR summary LIKE ? OR tags LIKE ?)')
        .join(' OR ');
      const likeParams: string[] = [];
      for (const kw of keywords.slice(0, 5)) {
        const pattern = `%${kw}%`;
        likeParams.push(pattern, pattern, pattern);
      }
      likeParams.push(String(SEARCH_LIMIT));

      candidates = db
        .prepare(
          `
          SELECT id, goal, goal_short, summary_short, status,
                 tags, metadata, has_warnings, created_at
          FROM contexts
          WHERE ${likeConditions}
          ORDER BY created_at DESC
          LIMIT ?
        `
        )
        .all(...likeParams) as typeof candidates;
    }
  }

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
