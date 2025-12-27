/**
 * Intelligence Handlers (v3.0)
 * 인텔리전스 도구 핸들러
 * - context_search: 컨텍스트 검색
 *
 * v3.0 변경사항:
 * - context_stats, context_recommend → unified-handlers.ts의 context_analyze로 이동
 */

import type { HandlerFn } from "./types.js";
import { successResponse, errorResponse, requireDatabase } from "./types.js";
import {
  searchContextsWithScope,
  validateExtendedSearchInput,
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
 * 인텔리전스 핸들러 맵 (v3.0)
 * - context_stats, context_recommend → unified-handlers.ts의 context_analyze로 이동
 */
export const intelligenceHandlers = new Map<string, HandlerFn>([
  ["context_search", handleContextSearch],
]);
