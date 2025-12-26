#!/usr/bin/env node

/**
 * Context Sync MCP Server
 * AI 에이전트 간 컨텍스트 자동 동기화 MCP 서버
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { ContextStore } from "./store/index.js";
import { SyncEngine } from "./sync/index.js";
import { ContextSummarizer } from "./utils/index.js";
import { ContextDiffEngine } from "./diff/index.js";
import { MetricsCollector } from "./metrics/index.js";
import { ContextSearchEngine } from "./search/index.js";
import type { AgentType, WorkStatus, SharedContext } from "./types/index.js";

// v2.0: 토큰 효율적인 새 도구들
import {
  searchContexts,
  validateSearchInput,
  getContext,
  validateGetInput,
  getContextWarnings,
  validateWarnInput,
} from "./tools/index.js";

// 현재 작업 디렉토리
const PROJECT_PATH = process.cwd();

// 컨텍스트 저장소 초기화
const store = new ContextStore(PROJECT_PATH);

// Phase 2: 동기화 엔진
const syncEngine = new SyncEngine(store, PROJECT_PATH);

// Phase 3: 고급 기능
const diffEngine = new ContextDiffEngine();
const metricsCollector = new MetricsCollector();
const searchEngine = new ContextSearchEngine();

// MCP 서버 생성
const server = new Server(
  {
    name: "context-sync-mcp",
    version: "2.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// 사용 가능한 도구 정의
const TOOLS: Tool[] = [
  {
    name: "context_save",
    description:
      "현재 작업 컨텍스트를 저장합니다. 새 세션을 시작하거나 기존 컨텍스트를 업데이트합니다.",
    inputSchema: {
      type: "object" as const,
      properties: {
        goal: {
          type: "string",
          description: "작업 목표 (예: '로그인 기능 구현')",
        },
        status: {
          type: "string",
          enum: ["planning", "coding", "testing", "reviewing", "debugging", "completed", "paused"],
          description: "작업 상태",
        },
        nextSteps: {
          type: "array",
          items: { type: "string" },
          description: "다음 할 일 목록",
        },
        agent: {
          type: "string",
          enum: ["claude-code", "cursor", "windsurf", "copilot", "unknown"],
          description: "현재 사용 중인 AI 에이전트",
        },
      },
      required: ["goal"],
    },
  },
  {
    name: "context_load",
    description:
      "이전 작업 컨텍스트를 로드합니다. 다른 AI 에이전트에서 작업하던 내용을 이어받을 수 있습니다.",
    inputSchema: {
      type: "object" as const,
      properties: {
        format: {
          type: "string",
          enum: ["full", "summary", "decisions", "blockers", "next_steps"],
          description: "로드할 정보 형식",
          default: "summary",
        },
      },
    },
  },
  {
    name: "context_query",
    description: "컨텍스트에서 특정 정보를 조회합니다.",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          enum: ["decisions", "blockers", "approaches", "next_steps", "agent_chain", "code_changes"],
          description: "조회할 정보 유형",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "decision_log",
    description: "의사결정을 기록합니다. 왜 특정 방식을 선택했는지 기록해두면 다른 AI가 맥락을 이해할 수 있습니다.",
    inputSchema: {
      type: "object" as const,
      properties: {
        what: {
          type: "string",
          description: "무엇을 결정했는지 (예: 'JWT 토큰 방식 사용')",
        },
        why: {
          type: "string",
          description: "왜 그렇게 결정했는지 (예: '세션보다 stateless해서')",
        },
      },
      required: ["what", "why"],
    },
  },
  {
    name: "attempt_log",
    description: "시도한 접근법을 기록합니다. 실패한 시도도 기록해두면 다른 AI가 같은 실수를 반복하지 않습니다.",
    inputSchema: {
      type: "object" as const,
      properties: {
        approach: {
          type: "string",
          description: "시도한 접근법 설명",
        },
        result: {
          type: "string",
          enum: ["success", "failed", "partial"],
          description: "결과",
        },
        reason: {
          type: "string",
          description: "실패한 경우 이유",
        },
      },
      required: ["approach", "result"],
    },
  },
  {
    name: "blocker_add",
    description: "막힌 부분을 기록합니다.",
    inputSchema: {
      type: "object" as const,
      properties: {
        description: {
          type: "string",
          description: "막힌 부분 설명",
        },
      },
      required: ["description"],
    },
  },
  {
    name: "blocker_resolve",
    description: "막힌 부분이 해결되었음을 기록합니다.",
    inputSchema: {
      type: "object" as const,
      properties: {
        blockerId: {
          type: "string",
          description: "블로커 ID",
        },
        resolution: {
          type: "string",
          description: "해결 방법",
        },
      },
      required: ["blockerId", "resolution"],
    },
  },
  {
    name: "handoff",
    description: "다른 AI 에이전트로 작업을 인수인계합니다.",
    inputSchema: {
      type: "object" as const,
      properties: {
        to: {
          type: "string",
          enum: ["claude-code", "cursor", "windsurf", "copilot"],
          description: "인수인계 받을 AI 에이전트",
        },
        summary: {
          type: "string",
          description: "인수인계 요약",
        },
      },
      required: ["to", "summary"],
    },
  },
  {
    name: "snapshot_create",
    description: "현재 컨텍스트의 스냅샷을 생성합니다.",
    inputSchema: {
      type: "object" as const,
      properties: {
        reason: {
          type: "string",
          enum: ["auto", "manual", "handoff", "milestone"],
          description: "스냅샷 생성 이유",
          default: "manual",
        },
      },
    },
  },
  {
    name: "snapshot_list",
    description: "저장된 스냅샷 목록을 조회합니다.",
    inputSchema: {
      type: "object" as const,
      properties: {
        limit: {
          type: "number",
          description: "최대 개수",
          default: 10,
        },
      },
    },
  },
  // Phase 2: 자동 동기화 도구
  {
    name: "sync_start",
    description: "자동 동기화 엔진을 시작합니다. 에디터 전환, 파일 저장, 유휴 상태, Git 커밋 시 자동으로 컨텍스트를 동기화합니다.",
    inputSchema: {
      type: "object" as const,
      properties: {
        editorSwitch: {
          type: "boolean",
          description: "에디터 전환 시 동기화 (기본: true)",
          default: true,
        },
        fileSave: {
          type: "boolean",
          description: "파일 저장 시 동기화 (기본: true)",
          default: true,
        },
        idleMinutes: {
          type: "number",
          description: "유휴 시간 후 동기화 (분, 0이면 비활성화)",
          default: 5,
        },
        gitCommit: {
          type: "boolean",
          description: "Git 커밋 시 동기화 (기본: true)",
          default: true,
        },
      },
    },
  },
  {
    name: "sync_stop",
    description: "자동 동기화 엔진을 중지합니다.",
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: "sync_status",
    description: "자동 동기화 엔진의 현재 상태를 조회합니다.",
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: "context_summarize",
    description: "컨텍스트를 요약하여 반환합니다. 토큰 절약을 위해 압축된 형식으로 제공합니다.",
    inputSchema: {
      type: "object" as const,
      properties: {
        format: {
          type: "string",
          enum: ["markdown", "json", "oneliner"],
          description: "출력 형식",
          default: "markdown",
        },
        compressionLevel: {
          type: "string",
          enum: ["none", "low", "medium", "high"],
          description: "압축 레벨 (높을수록 더 많이 압축)",
          default: "medium",
        },
      },
    },
  },
  // 자연어 별칭 도구
  {
    name: "ctx",
    description: `자연어로 컨텍스트를 관리합니다. 자연스러운 한국어/영어 명령을 지원합니다.

예시:
- "저장" / "save" / "저장해줘" → 컨텍스트 저장
- "로드" / "load" / "불러와" / "이전 작업" → 컨텍스트 로드
- "상태" / "status" / "어디까지 했어" → 현재 상태 조회
- "요약" / "summary" / "정리해줘" → 컨텍스트 요약
- "자동저장 켜줘" / "auto on" → 자동 동기화 시작
- "자동저장 꺼줘" / "auto off" → 자동 동기화 중지`,
    inputSchema: {
      type: "object" as const,
      properties: {
        command: {
          type: "string",
          description: "자연어 명령 (예: '저장해줘', 'load', '어디까지 했더라')",
        },
        goal: {
          type: "string",
          description: "저장 시 작업 목표 (선택사항)",
        },
      },
      required: ["command"],
    },
  },
  // 자동화 설정 도구
  {
    name: "automation_config",
    description: "자동 저장/로드 설정을 관리합니다. 세션 시작 시 자동 로드, 변경 시 자동 저장 등을 설정할 수 있습니다.",
    inputSchema: {
      type: "object" as const,
      properties: {
        autoLoad: {
          type: "boolean",
          description: "세션 시작 시 자동으로 이전 컨텍스트 로드 (기본: true)",
        },
        autoSave: {
          type: "boolean",
          description: "변경 시 자동 저장 (기본: true)",
        },
        autoSync: {
          type: "boolean",
          description: "세션 시작 시 자동 동기화 시작 (기본: false)",
        },
      },
    },
  },
  // 세션 시작 도구 (자동 로드 지원)
  {
    name: "session_start",
    description: "새 세션을 시작합니다. autoLoad가 활성화되어 있으면 이전 컨텍스트를 자동으로 로드하고 요약을 반환합니다.",
    inputSchema: {
      type: "object" as const,
      properties: {
        agent: {
          type: "string",
          enum: ["claude-code", "cursor", "windsurf", "copilot"],
          description: "현재 AI 에이전트",
        },
      },
    },
  },
  // Phase 3: 고급 기능 도구
  {
    name: "context_diff",
    description: "두 스냅샷 간의 차이점을 비교합니다. 어떤 결정, 접근법, 블로커가 추가/수정/삭제되었는지 확인할 수 있습니다.",
    inputSchema: {
      type: "object" as const,
      properties: {
        snapshotId1: {
          type: "string",
          description: "첫 번째 스냅샷 ID (없으면 가장 오래된 스냅샷)",
        },
        snapshotId2: {
          type: "string",
          description: "두 번째 스냅샷 ID (없으면 현재 컨텍스트)",
        },
      },
    },
  },
  {
    name: "context_merge",
    description: "두 컨텍스트를 병합합니다. 다른 브랜치에서 작업한 내용을 합칠 때 유용합니다.",
    inputSchema: {
      type: "object" as const,
      properties: {
        snapshotId: {
          type: "string",
          description: "병합할 스냅샷 ID",
        },
        strategy: {
          type: "string",
          enum: ["source_wins", "target_wins", "merge_all", "interactive"],
          description: "병합 전략 (기본: merge_all)",
          default: "merge_all",
        },
      },
      required: ["snapshotId"],
    },
  },
  {
    name: "context_search",
    description: "컨텍스트 내에서 키워드로 검색합니다. 결정, 접근법, 블로커, 파일, 다음 단계에서 검색합니다.",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description: "검색어",
        },
        category: {
          type: "string",
          enum: ["all", "decisions", "approaches", "blockers", "files", "nextSteps", "handoffs"],
          description: "검색 범위 (기본: all)",
          default: "all",
        },
        maxResults: {
          type: "number",
          description: "최대 결과 수 (기본: 10)",
          default: 10,
        },
      },
      required: ["query"],
    },
  },
  {
    name: "metrics_report",
    description: "성능 메트릭 리포트를 생성합니다. 동기화 성능, 메모리 사용량, 작업 통계를 확인할 수 있습니다.",
    inputSchema: {
      type: "object" as const,
      properties: {
        format: {
          type: "string",
          enum: ["markdown", "json"],
          description: "출력 형식 (기본: markdown)",
          default: "markdown",
        },
      },
    },
  },
  // v2.0: 토큰 효율적인 새 도구들
  {
    name: "context_search_v2",
    description: `세션 검색 (힌트 기반, ~200 토큰). 전체 내용이 아닌 힌트만 반환하여 토큰을 절약합니다.
상세 정보가 필요하면 context_get으로 조회하세요.`,
    inputSchema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description: "검색어 (goal, summary, tags에서 검색)",
        },
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
        limit: {
          type: "number",
          description: "최대 결과 수 (기본: 5, 최대: 20)",
          default: 5,
        },
        offset: {
          type: "number",
          description: "시작 위치 (페이지네이션)",
          default: 0,
        },
      },
    },
  },
  {
    name: "context_get",
    description: `컨텍스트 상세 조회 (~500 토큰). context_search_v2에서 찾은 ID로 상세 정보를 조회합니다.`,
    inputSchema: {
      type: "object" as const,
      properties: {
        id: {
          type: "string",
          description: "컨텍스트 ID",
        },
        includeActions: {
          type: "boolean",
          description: "액션 로그 포함 여부 (기본: true)",
          default: true,
        },
        includeChain: {
          type: "boolean",
          description: "세션 체인 포함 여부 (기본: false)",
          default: false,
        },
        actionsLimit: {
          type: "number",
          description: "액션 로그 최대 개수 (기본: 10, 최대: 50)",
          default: 10,
        },
      },
      required: ["id"],
    },
  },
  {
    name: "context_warn",
    description: `세션 시작 시 경고/추천 조회 (~100 토큰). 현재 작업과 관련된 실패 기록이나 블로커를 경고합니다.`,
    inputSchema: {
      type: "object" as const,
      properties: {
        currentGoal: {
          type: "string",
          description: "현재 작업 목표 (관련 세션 검색용)",
        },
        limit: {
          type: "number",
          description: "최대 경고 수 (기본: 3, 최대: 5)",
          default: 3,
        },
      },
      required: ["currentGoal"],
    },
  },
];

// 도구 목록 핸들러
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: TOOLS };
});

// 도구 실행 핸들러
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "context_save": {
        const { goal, status, nextSteps, agent } = args as {
          goal: string;
          status?: WorkStatus;
          nextSteps?: string[];
          agent?: AgentType;
        };

        let context = await store.getContext();
        if (!context) {
          context = await store.createContext({
            projectPath: PROJECT_PATH,
            goal,
            agent,
          });
        } else {
          await store.updateContext({ goal, status, nextSteps });
        }

        return {
          content: [
            {
              type: "text",
              text: `컨텍스트가 저장되었습니다.\n\n목표: ${goal}\n상태: ${status || context.currentWork.status}`,
            },
          ],
        };
      }

      case "context_load": {
        const { format = "summary" } = args as { format?: string };
        const context = await store.getContext();

        if (!context) {
          return {
            content: [
              {
                type: "text",
                text: "저장된 컨텍스트가 없습니다. context_save로 새 컨텍스트를 생성하세요.",
              },
            ],
          };
        }

        let result: string;
        switch (format) {
          case "full":
            result = JSON.stringify(context, null, 2);
            break;
          case "decisions":
            result = context.conversationSummary.keyDecisions
              .map((d) => `- ${d.what}: ${d.why}`)
              .join("\n") || "결정사항이 없습니다.";
            break;
          case "blockers":
            result = context.conversationSummary.blockers
              .filter((b) => !b.resolved)
              .map((b) => `- [${b.id.slice(0, 8)}] ${b.description}`)
              .join("\n") || "블로커가 없습니다.";
            break;
          case "next_steps":
            result = context.conversationSummary.nextSteps
              .map((s) => `- ${s}`)
              .join("\n") || "다음 단계가 없습니다.";
            break;
          default:
            result = await store.getSummary();
        }

        return {
          content: [{ type: "text", text: result }],
        };
      }

      case "context_query": {
        const { query } = args as { query: string };
        const context = await store.getContext();

        if (!context) {
          return {
            content: [{ type: "text", text: "컨텍스트가 없습니다." }],
          };
        }

        let result: string;
        switch (query) {
          case "decisions":
            result = JSON.stringify(context.conversationSummary.keyDecisions, null, 2);
            break;
          case "blockers":
            result = JSON.stringify(context.conversationSummary.blockers, null, 2);
            break;
          case "approaches":
            result = JSON.stringify(context.conversationSummary.triedApproaches, null, 2);
            break;
          case "next_steps":
            result = JSON.stringify(context.conversationSummary.nextSteps, null, 2);
            break;
          case "agent_chain":
            result = context.agentChain
              .map((h) => `${h.from} → ${h.to}: ${h.summary}`)
              .join("\n");
            break;
          case "code_changes":
            result = JSON.stringify(context.codeChanges, null, 2);
            break;
          default:
            result = "알 수 없는 쿼리입니다.";
        }

        return {
          content: [{ type: "text", text: result }],
        };
      }

      case "decision_log": {
        const { what, why } = args as { what: string; why: string };
        const decision = await store.addDecision(what, why, "claude-code");
        return {
          content: [
            {
              type: "text",
              text: `결정이 기록되었습니다.\n\n결정: ${what}\n이유: ${why}\nID: ${decision.id.slice(0, 8)}`,
            },
          ],
        };
      }

      case "attempt_log": {
        const { approach, result, reason } = args as {
          approach: string;
          result: "success" | "failed" | "partial";
          reason?: string;
        };
        await store.addApproach(approach, result, reason, "claude-code");
        return {
          content: [
            {
              type: "text",
              text: `접근법이 기록되었습니다.\n\n접근법: ${approach}\n결과: ${result}${reason ? `\n이유: ${reason}` : ""}`,
            },
          ],
        };
      }

      case "blocker_add": {
        const { description } = args as { description: string };
        const blocker = await store.addBlocker(description);
        return {
          content: [
            {
              type: "text",
              text: `블로커가 추가되었습니다.\n\nID: ${blocker.id.slice(0, 8)}\n설명: ${description}`,
            },
          ],
        };
      }

      case "blocker_resolve": {
        const { blockerId, resolution } = args as { blockerId: string; resolution: string };
        const blocker = await store.resolveBlocker(blockerId, resolution);
        if (!blocker) {
          return {
            content: [{ type: "text", text: "블로커를 찾을 수 없습니다." }],
          };
        }
        return {
          content: [
            {
              type: "text",
              text: `블로커가 해결되었습니다.\n\n해결 방법: ${resolution}`,
            },
          ],
        };
      }

      case "handoff": {
        const { to, summary } = args as { to: AgentType; summary: string };
        await store.recordHandoff("claude-code", to, summary);
        await store.createSnapshot("handoff");
        const contextSummary = await store.getSummary();
        return {
          content: [
            {
              type: "text",
              text: `${to}로 인수인계되었습니다.\n\n요약: ${summary}\n\n---\n\n${contextSummary}`,
            },
          ],
        };
      }

      case "snapshot_create": {
        const { reason = "manual" } = args as { reason?: "auto" | "manual" | "handoff" | "milestone" };
        const snapshot = await store.createSnapshot(reason);
        if (!snapshot) {
          return {
            content: [{ type: "text", text: "스냅샷 생성 실패. 활성 컨텍스트가 없습니다." }],
          };
        }
        return {
          content: [
            {
              type: "text",
              text: `스냅샷이 생성되었습니다.\n\nID: ${snapshot.id.slice(0, 8)}\n이유: ${reason}`,
            },
          ],
        };
      }

      case "snapshot_list": {
        const { limit = 10 } = args as { limit?: number };
        const snapshots = await store.listSnapshots();
        const list = snapshots.slice(0, limit);

        if (list.length === 0) {
          return {
            content: [{ type: "text", text: "저장된 스냅샷이 없습니다." }],
          };
        }

        const result = list
          .map((s) => `- [${s.id.slice(0, 8)}] ${s.reason} - ${new Date(s.timestamp).toLocaleString()}`)
          .join("\n");

        return {
          content: [{ type: "text", text: `스냅샷 목록:\n\n${result}` }],
        };
      }

      // Phase 2: 자동 동기화 핸들러
      case "sync_start": {
        const { editorSwitch, fileSave, idleMinutes, gitCommit } = args as {
          editorSwitch?: boolean;
          fileSave?: boolean;
          idleMinutes?: number;
          gitCommit?: boolean;
        };

        if (syncEngine.isActive()) {
          return {
            content: [{ type: "text", text: "동기화 엔진이 이미 실행 중입니다." }],
          };
        }

        // 동적 설정 적용은 향후 구현 (현재는 기본값 사용)
        await syncEngine.start();

        return {
          content: [
            {
              type: "text",
              text: `자동 동기화가 시작되었습니다.\n\n설정:\n- 에디터 전환: ${editorSwitch !== false ? "활성화" : "비활성화"}\n- 파일 저장: ${fileSave !== false ? "활성화" : "비활성화"}\n- 유휴 시간: ${idleMinutes || 5}분\n- Git 커밋: ${gitCommit !== false ? "활성화" : "비활성화"}`,
            },
          ],
        };
      }

      case "sync_stop": {
        if (!syncEngine.isActive()) {
          return {
            content: [{ type: "text", text: "동기화 엔진이 실행 중이 아닙니다." }],
          };
        }

        syncEngine.stop();

        return {
          content: [{ type: "text", text: "자동 동기화가 중지되었습니다." }],
        };
      }

      case "sync_status": {
        const isActive = syncEngine.isActive();
        const context = await store.getContext();

        let statusText = `동기화 상태: ${isActive ? "실행 중" : "중지됨"}`;

        if (context) {
          statusText += `\n\n현재 컨텍스트:\n- 목표: ${context.currentWork.goal}\n- 상태: ${context.currentWork.status}\n- 버전: ${context.version}`;
        } else {
          statusText += "\n\n활성 컨텍스트가 없습니다.";
        }

        return {
          content: [{ type: "text", text: statusText }],
        };
      }

      case "context_summarize": {
        const { format = "markdown", compressionLevel = "medium" } = args as {
          format?: "markdown" | "json" | "oneliner";
          compressionLevel?: "none" | "low" | "medium" | "high";
        };

        const context = await store.getContext();

        if (!context) {
          return {
            content: [{ type: "text", text: "활성 컨텍스트가 없습니다." }],
          };
        }

        // 압축 레벨에 맞는 요약기 생성
        const customSummarizer = new ContextSummarizer({ compressionLevel });

        let result: string;
        switch (format) {
          case "json":
            result = customSummarizer.toJSON(context);
            break;
          case "oneliner":
            result = customSummarizer.toOneLiner(context);
            break;
          default:
            result = customSummarizer.toMarkdown(context);
        }

        const tokens = customSummarizer.estimateTokens(context);

        return {
          content: [
            {
              type: "text",
              text: `${result}\n\n---\n예상 토큰: ~${tokens}`,
            },
          ],
        };
      }

      // 자연어 별칭 도구 핸들러
      case "ctx": {
        const { command, goal } = args as { command: string; goal?: string };
        const cmd = command.toLowerCase().trim();

        // 저장 명령 패턴
        if (/^(save|저장|저장해|저장해줘|저장하기|세이브)/.test(cmd)) {
          let context = await store.getContext();
          if (!context && goal) {
            context = await store.createContext({
              projectPath: PROJECT_PATH,
              goal,
              agent: "claude-code",
            });
          } else if (context) {
            await store.updateContext({ goal: goal || context.currentWork.goal });
          } else {
            return {
              content: [{ type: "text", text: "저장할 목표(goal)를 지정해주세요." }],
            };
          }
          return {
            content: [{ type: "text", text: `✅ 컨텍스트가 저장되었습니다.\n\n목표: ${goal || context?.currentWork.goal}` }],
          };
        }

        // 로드 명령 패턴
        if (/^(load|로드|불러|불러와|이전|어디까지|계속|resume|continue)/.test(cmd)) {
          const context = await store.getContext();
          if (!context) {
            return {
              content: [{ type: "text", text: "📭 저장된 컨텍스트가 없습니다." }],
            };
          }
          const summary = await store.getSummary();
          return {
            content: [{ type: "text", text: `📥 이전 작업을 불러왔습니다.\n\n${summary}` }],
          };
        }

        // 상태 조회 패턴
        if (/^(status|상태|현재|지금|뭐|state)/.test(cmd)) {
          const context = await store.getContext();
          const isActive = syncEngine.isActive();
          if (!context) {
            return {
              content: [{ type: "text", text: `📊 상태: 활성 컨텍스트 없음\n자동 동기화: ${isActive ? "실행 중" : "중지됨"}` }],
            };
          }
          return {
            content: [{
              type: "text",
              text: `📊 현재 상태\n\n목표: ${context.currentWork.goal}\n상태: ${context.currentWork.status}\n버전: ${context.version}\n자동 동기화: ${isActive ? "실행 중" : "중지됨"}`
            }],
          };
        }

        // 요약 패턴
        if (/^(summary|요약|정리|summarize)/.test(cmd)) {
          const context = await store.getContext();
          if (!context) {
            return {
              content: [{ type: "text", text: "📭 요약할 컨텍스트가 없습니다." }],
            };
          }
          const summary = await store.getSummary();
          return {
            content: [{ type: "text", text: summary }],
          };
        }

        // 자동 동기화 켜기
        if (/^(auto\s*(on|켜|시작|start)|자동.*켜|자동.*시작)/.test(cmd)) {
          if (syncEngine.isActive()) {
            return {
              content: [{ type: "text", text: "🔄 자동 동기화가 이미 실행 중입니다." }],
            };
          }
          await syncEngine.start();
          return {
            content: [{ type: "text", text: "✅ 자동 동기화가 시작되었습니다." }],
          };
        }

        // 자동 동기화 끄기
        if (/^(auto\s*(off|꺼|중지|stop)|자동.*꺼|자동.*중지)/.test(cmd)) {
          if (!syncEngine.isActive()) {
            return {
              content: [{ type: "text", text: "⏹️ 자동 동기화가 이미 중지되어 있습니다." }],
            };
          }
          syncEngine.stop();
          return {
            content: [{ type: "text", text: "⏹️ 자동 동기화가 중지되었습니다." }],
          };
        }

        return {
          content: [{
            type: "text",
            text: `❓ 알 수 없는 명령: "${command}"\n\n사용 가능한 명령:\n- 저장/save: 컨텍스트 저장\n- 로드/load: 이전 작업 불러오기\n- 상태/status: 현재 상태 조회\n- 요약/summary: 컨텍스트 요약\n- auto on/off: 자동 동기화 켜기/끄기`
          }],
        };
      }

      // 자동화 설정 핸들러
      case "automation_config": {
        const { autoLoad, autoSave, autoSync } = args as {
          autoLoad?: boolean;
          autoSave?: boolean;
          autoSync?: boolean;
        };

        const config = store.getConfig();
        const updates: { automation?: typeof config.automation } = {};

        if (autoLoad !== undefined || autoSave !== undefined || autoSync !== undefined) {
          updates.automation = {
            ...config.automation,
            ...(autoLoad !== undefined && { autoLoad }),
            ...(autoSave !== undefined && { autoSave }),
            ...(autoSync !== undefined && { autoSync }),
          };
          await store.updateConfig(updates as Partial<typeof config>);
        }

        const newConfig = store.getConfig();
        return {
          content: [{
            type: "text",
            text: `⚙️ 자동화 설정\n\n- autoLoad (세션 시작 시 자동 로드): ${newConfig.automation.autoLoad ? "✅ 켜짐" : "❌ 꺼짐"}\n- autoSave (변경 시 자동 저장): ${newConfig.automation.autoSave ? "✅ 켜짐" : "❌ 꺼짐"}\n- autoSync (자동 동기화 시작): ${newConfig.automation.autoSync ? "✅ 켜짐" : "❌ 꺼짐"}`,
          }],
        };
      }

      // 세션 시작 핸들러
      case "session_start": {
        const { agent = "claude-code" } = args as { agent?: AgentType };
        const config = store.getConfig();

        let result = `🚀 세션 시작 (${agent})\n\n`;

        // 자동 로드
        if (config.automation.autoLoad) {
          const context = await store.getContext();
          if (context) {
            await store.recordHandoff(context.agentChain.at(-1)?.to || "unknown", agent, "세션 시작");
            const summary = await store.getSummary();
            result += `📥 이전 작업을 자동으로 불러왔습니다.\n\n${summary}`;
          } else {
            result += "📭 이전 작업 기록이 없습니다. 새 세션입니다.";
          }
        } else {
          result += "⚙️ autoLoad가 비활성화되어 있습니다.";
        }

        // 자동 동기화 시작
        if (config.automation.autoSync && !syncEngine.isActive()) {
          await syncEngine.start();
          result += "\n\n🔄 자동 동기화가 시작되었습니다.";
        }

        return {
          content: [{ type: "text", text: result }],
        };
      }

      // Phase 3: 고급 기능 핸들러
      case "context_diff": {
        const { snapshotId1, snapshotId2 } = args as {
          snapshotId1?: string;
          snapshotId2?: string;
        };

        const snapshots = await store.listSnapshots();
        let source: SharedContext | null = null;
        let target: SharedContext | null = null;

        // 첫 번째 스냅샷 (없으면 가장 오래된 스냅샷)
        if (snapshotId1) {
          const snapshot = snapshots.find((s) => s.id.startsWith(snapshotId1));
          if (snapshot) source = snapshot.data;
        } else if (snapshots.length > 0) {
          source = snapshots[snapshots.length - 1].data;
        }

        // 두 번째 스냅샷 (없으면 현재 컨텍스트)
        if (snapshotId2) {
          const snapshot = snapshots.find((s) => s.id.startsWith(snapshotId2));
          if (snapshot) target = snapshot.data;
        } else {
          target = await store.getContext();
        }

        if (!source || !target) {
          return {
            content: [{ type: "text", text: "비교할 컨텍스트가 충분하지 않습니다. 최소 2개의 스냅샷이 필요합니다." }],
          };
        }

        const diff = diffEngine.compare(source, target);
        const markdown = diffEngine.toMarkdown(diff);

        // 메트릭 기록
        metricsCollector.startOperation("diff-" + Date.now());
        metricsCollector.endOperation("diff-" + Date.now(), "context_diff");

        return {
          content: [{ type: "text", text: markdown }],
        };
      }

      case "context_merge": {
        const { snapshotId, strategy = "merge_all" } = args as {
          snapshotId: string;
          strategy?: "source_wins" | "target_wins" | "merge_all" | "interactive";
        };

        const snapshots = await store.listSnapshots();
        const snapshot = snapshots.find((s) => s.id.startsWith(snapshotId));

        if (!snapshot) {
          return {
            content: [{ type: "text", text: `스냅샷을 찾을 수 없습니다: ${snapshotId}` }],
          };
        }

        const currentContext = await store.getContext();
        if (!currentContext) {
          return {
            content: [{ type: "text", text: "현재 활성 컨텍스트가 없습니다." }],
          };
        }

        // 전략을 MergeOptions로 변환
        const mergeOptions = {
          conflictResolution: strategy === "source_wins" ? "source" as const : "target" as const,
        };

        const mergeResult = diffEngine.merge(snapshot.data, currentContext, mergeOptions);

        if (!mergeResult.success || !mergeResult.merged) {
          const conflictText = mergeResult.conflicts
            .map((c) => `- ${c.path}: source(${JSON.stringify(c.sourceValue)}) vs target(${JSON.stringify(c.targetValue)})`)
            .join("\n");
          return {
            content: [{
              type: "text",
              text: `병합 충돌이 발생했습니다:\n\n${conflictText}\n\n수동으로 해결이 필요합니다.`,
            }],
          };
        }

        // 병합된 컨텍스트 저장
        await store.updateContext({
          goal: mergeResult.merged.currentWork.goal,
          status: mergeResult.merged.currentWork.status,
          nextSteps: mergeResult.merged.conversationSummary.nextSteps,
        });

        // 메트릭 기록
        metricsCollector.startOperation("merge-" + Date.now());
        metricsCollector.endOperation("merge-" + Date.now(), "context_merge");

        return {
          content: [{
            type: "text",
            text: `병합이 완료되었습니다.\n\n- 결정: ${mergeResult.merged.conversationSummary.keyDecisions.length}개\n- 접근법: ${mergeResult.merged.conversationSummary.triedApproaches.length}개\n- 블로커: ${mergeResult.merged.conversationSummary.blockers.length}개`,
          }],
        };
      }

      case "context_search": {
        const { query, category = "all", maxResults = 10 } = args as {
          query: string;
          category?: "all" | "decisions" | "approaches" | "blockers" | "files" | "nextSteps" | "handoffs";
          maxResults?: number;
        };

        const context = await store.getContext();
        if (!context) {
          return {
            content: [{ type: "text", text: "검색할 컨텍스트가 없습니다." }],
          };
        }

        const searchResult = searchEngine.search(context, query, {
          categories: category === "all" ? undefined : [category],
          maxResults,
        });

        const markdown = searchEngine.toMarkdown(searchResult);

        // 메트릭 기록
        metricsCollector.startOperation("search-" + Date.now());
        metricsCollector.endOperation("search-" + Date.now(), "context_search");

        return {
          content: [{ type: "text", text: markdown }],
        };
      }

      case "metrics_report": {
        const { format = "markdown" } = args as {
          format?: "markdown" | "json";
        };

        // 현재 컨텍스트 정보 추가
        const context = await store.getContext();
        if (context) {
          metricsCollector.recordContextSize(JSON.stringify(context).length);
        }

        const snapshots = await store.listSnapshots();
        metricsCollector.recordSnapshotCount(snapshots.length);
        metricsCollector.recordMemoryUsage();

        const report = metricsCollector.generateReport();

        // 컨텍스트 정보 보강
        if (context) {
          report.context.decisionsCount = context.conversationSummary.keyDecisions.length;
          report.context.approachesCount = context.conversationSummary.triedApproaches.length;
          report.context.blockersCount = context.conversationSummary.blockers.length;
          report.context.unresolvedBlockersCount = context.conversationSummary.blockers.filter(b => !b.resolved).length;
        }

        if (format === "json") {
          return {
            content: [{ type: "text", text: JSON.stringify(report, null, 2) }],
          };
        }

        return {
          content: [{ type: "text", text: metricsCollector.toMarkdown(report) }],
        };
      }

      // v2.0: 토큰 효율적인 새 도구 핸들러
      case "context_search_v2": {
        const db = store.getDatabase();
        if (!db) {
          return {
            content: [{ type: "text", text: "DB가 활성화되지 않았습니다. SQLite를 확인하세요." }],
            isError: true,
          };
        }

        try {
          const input = validateSearchInput(args);
          const result = searchContexts(db, input);

          // 힌트 형식으로 출력
          let text = `🔍 검색 결과 (${result.total}건 중 ${result.hints.length}건)\n\n`;

          if (result.hints.length === 0) {
            text += "검색 결과가 없습니다.";
          } else {
            for (const hint of result.hints) {
              const warning = hint.hasWarnings ? " ⚠️" : "";
              text += `- [${hint.id.slice(0, 8)}] ${hint.goal} (${hint.date})${warning}\n`;
            }
          }

          if (result.hasMore) {
            text += `\n💡 더 많은 결과가 있습니다. offset 파라미터를 사용하세요.`;
          }

          if (result.suggestion) {
            text += `\n📎 추천: ${result.suggestion}`;
          }

          return {
            content: [{ type: "text", text }],
          };
        } catch (err) {
          return {
            content: [{ type: "text", text: `검색 오류: ${err instanceof Error ? err.message : err}` }],
            isError: true,
          };
        }
      }

      case "context_get": {
        const db = store.getDatabase();
        if (!db) {
          return {
            content: [{ type: "text", text: "DB가 활성화되지 않았습니다. SQLite를 확인하세요." }],
            isError: true,
          };
        }

        try {
          const input = validateGetInput(args);
          const result = getContext(db, input);

          if (!result) {
            return {
              content: [{ type: "text", text: `컨텍스트를 찾을 수 없습니다: ${input.id}` }],
            };
          }

          // 상세 정보 출력
          const ctx = result.context;
          let text = `📋 컨텍스트 상세\n\n`;
          text += `**ID:** ${ctx.id}\n`;
          text += `**목표:** ${ctx.goal}\n`;
          text += `**상태:** ${ctx.status}\n`;
          if (ctx.summary) text += `**요약:** ${ctx.summary}\n`;
          if (ctx.tags && ctx.tags.length > 0) text += `**태그:** ${ctx.tags.join(", ")}\n`;
          text += `**시작:** ${ctx.startedAt}\n`;
          if (ctx.endedAt) text += `**종료:** ${ctx.endedAt}\n`;

          // 메타데이터
          const meta = ctx.metadata;
          if (meta.decisions && meta.decisions.length > 0) {
            text += `\n### 결정사항 (${meta.decisions.length}개)\n`;
            for (const d of meta.decisions.slice(0, 5)) {
              text += `- ${d.what}: ${d.why}\n`;
            }
            if (meta.decisions.length > 5) text += `  ... 외 ${meta.decisions.length - 5}개\n`;
          }

          if (meta.blockers && meta.blockers.length > 0) {
            const unresolved = meta.blockers.filter((b) => !b.resolved);
            if (unresolved.length > 0) {
              text += `\n### ⚠️ 미해결 블로커 (${unresolved.length}개)\n`;
              for (const b of unresolved) {
                text += `- ${b.description}\n`;
              }
            }
          }

          // 액션 로그
          if (result.actions && result.actions.length > 0) {
            text += `\n### 최근 액션 (${result.actions.length}개)\n`;
            for (const a of result.actions.slice(0, 5)) {
              text += `- [${a.type}] ${a.content.slice(0, 50)}${a.content.length > 50 ? "..." : ""}\n`;
            }
            if (result.actions.length > 5) text += `  ... 외 ${result.actions.length - 5}개\n`;
          }

          // 세션 체인
          if (result.chain && result.chain.length > 0) {
            text += `\n### 세션 체인\n`;
            for (const c of result.chain) {
              const isCurrent = c.id === ctx.id ? " 👈" : "";
              text += `- [${c.id.slice(0, 8)}] ${c.goal}${isCurrent}\n`;
            }
          }

          return {
            content: [{ type: "text", text }],
          };
        } catch (err) {
          return {
            content: [{ type: "text", text: `조회 오류: ${err instanceof Error ? err.message : err}` }],
            isError: true,
          };
        }
      }

      case "context_warn": {
        const db = store.getDatabase();
        if (!db) {
          return {
            content: [{ type: "text", text: "DB가 활성화되지 않았습니다. SQLite를 확인하세요." }],
            isError: true,
          };
        }

        try {
          const input = validateWarnInput(args);
          const result = getContextWarnings(db, input);

          let text = `⚡ 세션 시작 알림\n\n`;

          if (result.warnings.length > 0) {
            text += `### ⚠️ 경고 (${result.warnings.length}건)\n`;
            for (const w of result.warnings) {
              text += `- ${w.message}\n`;
            }
            text += `\n`;
          }

          if (result.recommendations.length > 0) {
            text += `### 📚 관련 세션\n`;
            for (const r of result.recommendations) {
              text += `- [${r.id.slice(0, 8)}] ${r.goal}\n`;
            }
          }

          if (result.warnings.length === 0 && result.recommendations.length === 0) {
            text += `관련 기록이 없습니다. 새로운 작업을 시작하세요!`;
          }

          if (result.hasMore) {
            text += `\n\n💡 더 많은 관련 세션이 있습니다. context_search_v2로 검색하세요.`;
          }

          return {
            content: [{ type: "text", text }],
          };
        } catch (err) {
          return {
            content: [{ type: "text", text: `경고 조회 오류: ${err instanceof Error ? err.message : err}` }],
            isError: true,
          };
        }
      }

      default:
        return {
          content: [{ type: "text", text: `알 수 없는 도구: ${name}` }],
          isError: true,
        };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: "text", text: `오류 발생: ${message}` }],
      isError: true,
    };
  }
});

// 서버 시작
async function main() {
  await store.initialize();

  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error("Context Sync MCP 서버가 시작되었습니다.");
}

main().catch((error) => {
  console.error("서버 시작 실패:", error);
  process.exit(1);
});
