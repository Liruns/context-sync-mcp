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
 * 유지보수 도구 (v2.3)
 */
const maintenanceTools: Tool[] = [
  {
    name: "context_cleanup",
    description: "오래된 데이터 정리 (decisions, approaches, blockers, snapshots)",
    inputSchema: {
      type: "object" as const,
      properties: {
        olderThan: {
          type: "string",
          description: "삭제 기준 (예: 30d, 7d, 2w, 1m)",
          default: "30d",
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
        dryRun: {
          type: "boolean",
          description: "미리보기 모드 (삭제하지 않음)",
          default: true,
        },
      },
    },
  },
  {
    name: "context_archive",
    description: "완료된 작업 아카이브",
    inputSchema: {
      type: "object" as const,
      properties: {
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
    },
  },
  {
    name: "snapshot_create",
    description: "현재 컨텍스트 스냅샷 생성",
    inputSchema: {
      type: "object" as const,
      properties: {
        reason: {
          type: "string",
          enum: ["manual", "milestone"],
          default: "manual",
        },
        description: {
          type: "string",
          description: "스냅샷 설명",
        },
      },
    },
  },
  {
    name: "snapshot_restore",
    description: "스냅샷에서 컨텍스트 복원",
    inputSchema: {
      type: "object" as const,
      properties: {
        snapshotId: {
          type: "string",
          description: "복원할 스냅샷 ID",
        },
      },
      required: ["snapshotId"],
    },
  },
  {
    name: "snapshot_list",
    description: "저장된 스냅샷 목록 조회",
    inputSchema: {
      type: "object" as const,
      properties: {
        limit: {
          type: "number",
          description: "조회 개수 제한",
          default: 10,
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
 * 인텔리전스 도구 (v2.5)
 */
const intelligenceTools: Tool[] = [
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
  {
    name: "context_stats",
    description: "작업 통계 조회 (성공률, 패턴 분석)",
    inputSchema: {
      type: "object" as const,
      properties: {
        range: {
          type: "string",
          enum: ["last_7_days", "last_30_days", "last_90_days", "all"],
          description: "조회 기간",
          default: "last_30_days",
        },
      },
    },
  },
  {
    name: "context_recommend",
    description: "현재 작업 기반 유사 해결책 추천",
    inputSchema: {
      type: "object" as const,
      properties: {
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
    },
  },
];

/**
 * 모든 도구 정의 (15개)
 * - contextTools: 2개 (context_save, context_load)
 * - maintenanceTools: 5개 (context_cleanup, context_archive, snapshot_create, snapshot_restore, snapshot_list)
 * - metadataTools: 5개 (decision_log, attempt_log, blocker_add, blocker_resolve, handoff)
 * - intelligenceTools: 3개 (context_search, context_stats, context_recommend)
 */
export const TOOLS: Tool[] = [
  ...contextTools,
  ...maintenanceTools,
  ...metadataTools,
  ...intelligenceTools,
];

/**
 * 도구 개수
 */
export const TOOLS_COUNT = TOOLS.length;
