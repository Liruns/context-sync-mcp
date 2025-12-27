/**
 * MCP 도구 정의
 * 모든 도구의 스키마를 정의
 */

import type { Tool } from "@modelcontextprotocol/sdk/types.js";

/**
 * 기본 컨텍스트 관리 도구
 */
const contextTools: Tool[] = [
  {
    name: "context_save",
    description: "작업 컨텍스트 저장",
    inputSchema: {
      type: "object" as const,
      properties: {
        goal: { type: "string", description: "작업 목표" },
        status: {
          type: "string",
          enum: ["planning", "coding", "testing", "reviewing", "debugging", "completed", "paused"],
        },
        nextSteps: { type: "array", items: { type: "string" } },
        agent: { type: "string", enum: ["claude-code", "cursor", "windsurf", "copilot", "unknown"] },
      },
      required: ["goal"],
    },
  },
  {
    name: "context_load",
    description: "컨텍스트 로드 (format: full/summary/decisions/blockers/next_steps)",
    inputSchema: {
      type: "object" as const,
      properties: {
        format: {
          type: "string",
          enum: ["full", "summary", "decisions", "blockers", "next_steps"],
          default: "summary",
        },
      },
    },
  },
];

/**
 * 메타데이터 관리 도구
 */
const metadataTools: Tool[] = [
  {
    name: "decision_log",
    description: "의사결정 기록",
    inputSchema: {
      type: "object" as const,
      properties: {
        what: { type: "string", description: "결정 내용" },
        why: { type: "string", description: "결정 이유" },
      },
      required: ["what", "why"],
    },
  },
  {
    name: "attempt_log",
    description: "시도/실패 기록",
    inputSchema: {
      type: "object" as const,
      properties: {
        approach: { type: "string", description: "시도한 접근법" },
        result: { type: "string", enum: ["success", "failed", "partial"] },
        reason: { type: "string", description: "실패 이유" },
      },
      required: ["approach", "result"],
    },
  },
  {
    name: "blocker_add",
    description: "블로커 추가",
    inputSchema: {
      type: "object" as const,
      properties: {
        description: { type: "string", description: "막힌 부분" },
      },
      required: ["description"],
    },
  },
  {
    name: "blocker_resolve",
    description: "블로커 해결",
    inputSchema: {
      type: "object" as const,
      properties: {
        blockerId: { type: "string" },
        resolution: { type: "string", description: "해결 방법" },
      },
      required: ["blockerId", "resolution"],
    },
  },
  {
    name: "handoff",
    description: "다른 AI로 인수인계",
    inputSchema: {
      type: "object" as const,
      properties: {
        to: { type: "string", enum: ["claude-code", "cursor", "windsurf", "copilot"] },
        summary: { type: "string", description: "인수인계 요약" },
      },
      required: ["to", "summary"],
    },
  },
];

/**
 * 모든 도구 정의 (7개)
 * - contextTools: 2개 (context_save, context_load)
 * - metadataTools: 5개 (decision_log, attempt_log, blocker_add, blocker_resolve, handoff)
 */
export const TOOLS: Tool[] = [
  ...contextTools,
  ...metadataTools,
];

/**
 * 도구 개수
 */
export const TOOLS_COUNT = TOOLS.length;
