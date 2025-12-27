/**
 * Handler 공통 타입 정의
 */

import type { ContextStore } from "../store/index.js";
import type { SyncEngine } from "../sync/index.js";
import type { ContextDiffEngine } from "../diff/index.js";
import type { MetricsCollector } from "../metrics/index.js";
import type { ContextSearchEngine } from "../search/index.js";
import type { DatabaseInstance } from "../db/index.js";
import { DB_ERRORS } from "../constants/index.js";

/**
 * MCP 도구 응답 타입 (MCP SDK와 호환)
 */
export interface ToolResponse {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
  [key: string]: unknown;
}

/**
 * 핸들러 컨텍스트 - 모든 핸들러가 공유하는 의존성
 */
export interface HandlerContext {
  store: ContextStore;
  syncEngine: SyncEngine;
  diffEngine: ContextDiffEngine;
  metricsCollector: MetricsCollector;
  searchEngine: ContextSearchEngine;
  projectPath: string;
}

/**
 * 핸들러 함수 타입
 */
export type HandlerFn = (
  args: Record<string, unknown>,
  ctx: HandlerContext
) => Promise<ToolResponse>;

/**
 * 핸들러 레지스트리 타입
 */
export type HandlerRegistry = Map<string, HandlerFn>;

/**
 * 성공 응답 생성
 */
export function successResponse(text: string): ToolResponse {
  return {
    content: [{ type: "text", text }],
  };
}

/**
 * 에러 응답 생성
 */
export function errorResponse(text: string): ToolResponse {
  return {
    content: [{ type: "text", text }],
    isError: true,
  };
}

/**
 * DB 필수 체크 (null이 아닌 DatabaseInstance 반환)
 */
export function requireDatabase(ctx: HandlerContext): DatabaseInstance {
  const db = ctx.store.getDatabase();
  if (!db) {
    throw new Error(DB_ERRORS.NOT_ENABLED);
  }
  return db;
}
