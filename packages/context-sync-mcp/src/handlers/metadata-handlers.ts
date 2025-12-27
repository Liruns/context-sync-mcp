/**
 * Metadata 핸들러
 * decision_log, attempt_log, blocker_add, blocker_resolve, handoff
 */

import type { AgentType } from "../types/index.js";
import { type HandlerFn, successResponse } from "./types.js";

/**
 * decision_log 핸들러
 */
export const handleDecisionLog: HandlerFn = async (args, ctx) => {
  const { what, why } = args as { what: string; why: string };
  const decision = await ctx.store.addDecision(what, why, "claude-code");

  return successResponse(
    `결정이 기록되었습니다.\n\n결정: ${what}\n이유: ${why}\nID: ${decision.id.slice(0, 8)}`
  );
};

/**
 * attempt_log 핸들러
 */
export const handleAttemptLog: HandlerFn = async (args, ctx) => {
  const { approach, result, reason } = args as {
    approach: string;
    result: "success" | "failed" | "partial";
    reason?: string;
  };

  await ctx.store.addApproach(approach, result, reason, "claude-code");

  return successResponse(
    `접근법이 기록되었습니다.\n\n접근법: ${approach}\n결과: ${result}${reason ? `\n이유: ${reason}` : ""}`
  );
};

/**
 * handoff 핸들러
 */
export const handleHandoff: HandlerFn = async (args, ctx) => {
  const { to, summary } = args as { to: AgentType; summary: string };

  await ctx.store.recordHandoff("claude-code", to, summary);
  await ctx.store.createSnapshot("handoff");
  const contextSummary = await ctx.store.getSummary();

  return successResponse(
    `${to}로 인수인계되었습니다.\n\n요약: ${summary}\n\n---\n\n${contextSummary}`
  );
};

/**
 * Metadata 핸들러 레지스트리 (v3.0)
 * - blocker_add, blocker_resolve → unified-handlers.ts의 blocker로 이동
 */
export const metadataHandlers = new Map<string, HandlerFn>([
  ["decision_log", handleDecisionLog],
  ["attempt_log", handleAttemptLog],
  ["handoff", handleHandoff],
]);
