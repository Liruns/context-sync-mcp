/**
 * Intelligence Handlers (v2.5)
 * 인텔리전스 도구 핸들러
 * - context_search: 컨텍스트 검색
 * - context_stats: 작업 통계
 * - context_recommend: 관련 세션 추천
 */

import type { HandlerFn } from "./types.js";
import { successResponse, errorResponse, requireDatabase } from "./types.js";
import {
  searchContextsWithScope,
  validateExtendedSearchInput,
  getContextStats,
  validateStatsInput,
  formatStatsMarkdown,
  recommendContexts,
  validateRecommendInput,
  formatRecommendMarkdown,
} from "../tools/index.js";
import { formatSearchMarkdown } from "../utils/formatters.js";

/**
 * context_search 핸들러
 * 키워드, 태그, 상태로 과거 컨텍스트 검색
 */
export const handleContextSearch: HandlerFn = async (args, ctx) => {
  try {
    const input = validateExtendedSearchInput(args);
    const db = requireDatabase(ctx);

    const result = await searchContextsWithScope(db, input);
    const markdown = formatSearchMarkdown(result);

    return successResponse(markdown);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return errorResponse(`검색 오류: ${message}`);
  }
};

/**
 * context_stats 핸들러
 * 작업 통계 조회
 */
export const handleContextStats: HandlerFn = async (args, ctx) => {
  try {
    const input = validateStatsInput(args);
    const db = requireDatabase(ctx);

    const stats = getContextStats(db, input);
    const markdown = formatStatsMarkdown(stats);

    return successResponse(markdown);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return errorResponse(`통계 조회 오류: ${message}`);
  }
};

/**
 * context_recommend 핸들러
 * 현재 작업 기반 유사 해결책 추천
 */
export const handleContextRecommend: HandlerFn = async (args, ctx) => {
  try {
    // currentGoal이 없으면 현재 컨텍스트에서 가져옴
    let inputArgs = args;
    if (!args.currentGoal) {
      const context = await ctx.store.getContext();
      if (context?.currentWork?.goal) {
        inputArgs = { ...args, currentGoal: context.currentWork.goal };
      } else {
        return errorResponse("현재 목표가 설정되지 않았습니다. currentGoal을 지정하세요.");
      }
    }

    const input = validateRecommendInput(inputArgs);
    const db = requireDatabase(ctx);

    const result = recommendContexts(db, input);
    const markdown = formatRecommendMarkdown(result);

    return successResponse(markdown);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return errorResponse(`추천 오류: ${message}`);
  }
};

/**
 * 인텔리전스 핸들러 맵
 */
export const intelligenceHandlers = new Map<string, HandlerFn>([
  ["context_search", handleContextSearch],
  ["context_stats", handleContextStats],
  ["context_recommend", handleContextRecommend],
]);
