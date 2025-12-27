/**
 * Handler Registry (v3.0)
 * 모든 핸들러를 통합하여 관리
 *
 * v3.0 변경사항:
 * - 15개 → 10개 도구로 통합
 * - unifiedHandlers 추가 (snapshot, blocker, context_maintain, context_analyze)
 * - 기존 개별 핸들러 제거 (snapshot_*, blocker_*, context_cleanup/archive, context_stats/recommend)
 */

import type { HandlerFn, HandlerContext, ToolResponse } from "./types.js";
import { contextHandlers } from "./context-handlers.js";
import { metadataHandlers } from "./metadata-handlers.js";
import { intelligenceHandlers } from "./intelligence-handlers.js";
import { unifiedHandlers } from "./unified-handlers.js";

export type { HandlerFn, HandlerContext, ToolResponse };
export { successResponse, errorResponse, requireDatabase } from "./types.js";

/**
 * 모든 핸들러를 통합한 레지스트리
 */
const handlers = new Map<string, HandlerFn>();

/**
 * v3.0 핸들러 모듈 (10개 도구)
 * - contextHandlers: context_save, context_load
 * - metadataHandlers: decision_log, attempt_log, handoff (blocker_* 제거)
 * - intelligenceHandlers: context_search (context_stats/recommend 제거)
 * - unifiedHandlers: snapshot, blocker, context_maintain, context_analyze
 */
const modules = [
  contextHandlers,
  metadataHandlers,
  intelligenceHandlers,
  unifiedHandlers,
];

for (const module of modules) {
  for (const [name, handler] of module) {
    handlers.set(name, handler);
  }
}

/**
 * 핸들러 레지스트리 클래스
 */
export class HandlerRegistry {
  private handlers: Map<string, HandlerFn>;
  private ctx: HandlerContext;

  constructor(ctx: HandlerContext) {
    this.handlers = handlers;
    this.ctx = ctx;
  }

  /**
   * 도구 핸들러 실행
   */
  async handle(
    name: string,
    args: Record<string, unknown>
  ): Promise<ToolResponse> {
    const handler = this.handlers.get(name);

    if (!handler) {
      return {
        content: [{ type: "text", text: `알 수 없는 도구: ${name}` }],
        isError: true,
      };
    }

    try {
      return await handler(args, this.ctx);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: "text", text: `오류 발생: ${message}` }],
        isError: true,
      };
    }
  }

  /**
   * 핸들러 존재 여부 확인
   */
  has(name: string): boolean {
    return this.handlers.has(name);
  }

  /**
   * 등록된 핸들러 이름 목록
   */
  getNames(): string[] {
    return Array.from(this.handlers.keys());
  }

  /**
   * 핸들러 개수
   */
  get size(): number {
    return this.handlers.size;
  }
}

// 개별 핸들러 모듈 내보내기
export { contextHandlers } from "./context-handlers.js";
export { maintenanceHandlers } from "./maintenance-handlers.js";
export { metadataHandlers } from "./metadata-handlers.js";
export { intelligenceHandlers } from "./intelligence-handlers.js";
