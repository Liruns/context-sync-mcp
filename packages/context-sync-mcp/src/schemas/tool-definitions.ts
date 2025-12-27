/**
 * MCP 도구 정의 (v3.0)
 * 모든 도구의 스키마를 정의
 *
 * v3.0 변경사항:
 * - 15개 → 10개 도구로 통합
 * - snapshot_* → snapshot (action: create|restore|list)
 * - blocker_* → blocker (action: add|resolve|list)
 * - context_cleanup/archive → context_maintain (action: cleanup|archive)
 * - context_stats/recommend → context_analyze (action: stats|recommend)
 */

import type { Tool } from "@modelcontextprotocol/sdk/types.js";

/**
 * 기본 컨텍스트 관리 도구 (2개)
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
 * 메타데이터 관리 도구 (3개)
 * - decision_log, attempt_log: 고빈도 도구 (유지)
 * - handoff: 고유 기능 (유지)
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
 * 인텔리전스 도구 (1개)
 * - context_search: 고유 기능 (유지)
 */
const searchTools: Tool[] = [
  {
    name: "context_search",
    description: "키워드, 태그, 상태로 과거 컨텍스트 검색",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "검색 키워드" },
        tags: {
          type: "array",
          items: { type: "string" },
          description: "태그 필터",
        },
        status: {
          type: "string",
          enum: ["planning", "coding", "testing", "reviewing", "debugging", "completed", "paused"],
          description: "상태 필터",
        },
        agent: {
          type: "string",
          enum: ["claude-code", "cursor", "windsurf", "copilot", "unknown"],
          description: "에이전트 필터",
        },
        dateRange: {
          type: "object",
          properties: {
            from: { type: "string", description: "시작일 (ISO 형식)" },
            to: { type: "string", description: "종료일 (ISO 형식)" },
          },
          description: "날짜 범위",
        },
        limit: { type: "number", description: "결과 개수 제한", default: 10 },
        offset: { type: "number", description: "결과 오프셋", default: 0 },
        scope: {
          type: "string",
          enum: ["project", "global"],
          description: "검색 범위",
          default: "project",
        },
      },
    },
  },
];

/**
 * 통합 도구 (4개) - v3.0
 */
const unifiedTools: Tool[] = [
  // snapshot: create | restore | list
  {
    name: "snapshot",
    description: "스냅샷 관리 (생성/복원/목록)",
    inputSchema: {
      type: "object" as const,
      properties: {
        action: {
          type: "string",
          enum: ["create", "restore", "list"],
          description: "수행할 작업",
        },
        snapshotId: {
          type: "string",
          description: "복원할 스냅샷 ID (restore 시 필수)",
        },
        reason: {
          type: "string",
          enum: ["manual", "milestone"],
          description: "스냅샷 이유 (create 시)",
          default: "manual",
        },
        description: {
          type: "string",
          description: "스냅샷 설명 (create 시)",
        },
        limit: {
          type: "number",
          description: "목록 개수 (list 시)",
          default: 10,
        },
      },
      required: ["action"],
    },
  },
  // blocker: add | resolve | list
  {
    name: "blocker",
    description: "블로커 관리 (추가/해결/목록)",
    inputSchema: {
      type: "object" as const,
      properties: {
        action: {
          type: "string",
          enum: ["add", "resolve", "list"],
          description: "수행할 작업",
        },
        description: {
          type: "string",
          description: "블로커 설명 (add 시 필수)",
        },
        blockerId: {
          type: "string",
          description: "블로커 ID (resolve 시 필수)",
        },
        resolution: {
          type: "string",
          description: "해결 방법 (resolve 시 필수)",
        },
        includeResolved: {
          type: "boolean",
          description: "해결된 블로커 포함 (list 시)",
          default: false,
        },
      },
      required: ["action"],
    },
  },
  // context_maintain: cleanup | archive
  {
    name: "context_maintain",
    description: "컨텍스트 유지보수 (정리/아카이브)",
    inputSchema: {
      type: "object" as const,
      properties: {
        action: {
          type: "string",
          enum: ["cleanup", "archive"],
          description: "수행할 작업",
        },
        // cleanup 옵션
        olderThan: {
          type: "string",
          description: "삭제 기준 (예: 30d, 7d, 2w, 1m)",
          default: "30d",
        },
        dryRun: {
          type: "boolean",
          description: "미리보기 모드 (삭제하지 않음)",
          default: true,
        },
        removeResolvedBlockers: {
          type: "boolean",
          description: "해결된 블로커 삭제",
          default: false,
        },
        keepOnlySuccessful: {
          type: "boolean",
          description: "성공한 시도만 유지",
          default: false,
        },
        removeCompleted: {
          type: "boolean",
          description: "완료된 컨텍스트 삭제",
          default: false,
        },
        // archive 옵션
        reason: {
          type: "string",
          description: "아카이브 사유",
        },
        contextIds: {
          type: "array",
          items: { type: "string" },
          description: "특정 컨텍스트 ID들",
        },
        completedOnly: {
          type: "boolean",
          description: "완료된 컨텍스트만",
          default: true,
        },
        deleteAfterArchive: {
          type: "boolean",
          description: "아카이브 후 원본 삭제",
          default: false,
        },
      },
      required: ["action"],
    },
  },
  // context_analyze: stats | recommend
  {
    name: "context_analyze",
    description: "컨텍스트 분석 (통계/추천)",
    inputSchema: {
      type: "object" as const,
      properties: {
        action: {
          type: "string",
          enum: ["stats", "recommend"],
          description: "수행할 작업",
        },
        // stats 옵션
        range: {
          type: "string",
          enum: ["last_7_days", "last_30_days", "last_90_days", "all"],
          description: "조회 기간",
          default: "last_30_days",
        },
        // recommend 옵션
        currentGoal: {
          type: "string",
          description: "현재 작업 목표 (미지정 시 현재 컨텍스트 사용)",
        },
        limit: {
          type: "number",
          description: "추천 개수",
          default: 5,
        },
      },
      required: ["action"],
    },
  },
];

/**
 * 모든 도구 정의 (10개)
 *
 * v3.0 구조:
 * - contextTools: 2개 (context_save, context_load)
 * - metadataTools: 3개 (decision_log, attempt_log, handoff)
 * - searchTools: 1개 (context_search)
 * - unifiedTools: 4개 (snapshot, blocker, context_maintain, context_analyze)
 */
export const TOOLS: Tool[] = [
  ...contextTools,
  ...metadataTools,
  ...searchTools,
  ...unifiedTools,
];

/**
 * 도구 개수
 */
export const TOOLS_COUNT = TOOLS.length;
