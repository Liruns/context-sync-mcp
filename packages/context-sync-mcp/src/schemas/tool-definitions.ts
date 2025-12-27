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
          enum: [
            "planning",
            "coding",
            "testing",
            "reviewing",
            "debugging",
            "completed",
            "paused",
          ],
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
          enum: [
            "decisions",
            "blockers",
            "approaches",
            "next_steps",
            "agent_chain",
            "code_changes",
          ],
          description: "조회할 정보 유형",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "context_summarize",
    description:
      "컨텍스트를 요약하여 반환합니다. 토큰 절약을 위해 압축된 형식으로 제공합니다.",
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
];

/**
 * 메타데이터 관리 도구
 */
const metadataTools: Tool[] = [
  {
    name: "decision_log",
    description:
      "의사결정을 기록합니다. 왜 특정 방식을 선택했는지 기록해두면 다른 AI가 맥락을 이해할 수 있습니다.",
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
    description:
      "시도한 접근법을 기록합니다. 실패한 시도도 기록해두면 다른 AI가 같은 실수를 반복하지 않습니다.",
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
];

/**
 * 스냅샷 관리 도구
 */
const snapshotTools: Tool[] = [
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
];

/**
 * 동기화 관리 도구
 */
const syncTools: Tool[] = [
  {
    name: "sync_start",
    description:
      "자동 동기화 엔진을 시작합니다. 에디터 전환, 파일 저장, 유휴 상태, Git 커밋 시 자동으로 컨텍스트를 동기화합니다.",
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
];

/**
 * 자연어 및 자동화 도구
 */
const nlpTools: Tool[] = [
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
  {
    name: "automation_config",
    description:
      "자동 저장/로드 설정을 관리합니다. 세션 시작 시 자동 로드, 변경 시 자동 저장 등을 설정할 수 있습니다.",
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
  {
    name: "session_start",
    description:
      "새 세션을 시작합니다. autoLoad가 활성화되어 있으면 이전 컨텍스트를 자동으로 로드하고 요약을 반환합니다.",
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
];

/**
 * 고급 기능 도구
 */
const advancedTools: Tool[] = [
  {
    name: "context_diff",
    description:
      "두 스냅샷 간의 차이점을 비교합니다. 어떤 결정, 접근법, 블로커가 추가/수정/삭제되었는지 확인할 수 있습니다.",
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
    description:
      "두 컨텍스트를 병합합니다. 다른 브랜치에서 작업한 내용을 합칠 때 유용합니다.",
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
    description:
      "컨텍스트 내에서 키워드로 검색합니다. 결정, 접근법, 블로커, 파일, 다음 단계에서 검색합니다.",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description: "검색어",
        },
        category: {
          type: "string",
          enum: [
            "all",
            "decisions",
            "approaches",
            "blockers",
            "files",
            "nextSteps",
            "handoffs",
          ],
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
    description:
      "성능 메트릭 리포트를 생성합니다. 동기화 성능, 메모리 사용량, 작업 통계를 확인할 수 있습니다.",
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
];

/**
 * v2.0+ 토큰 효율적 도구
 */
const v2Tools: Tool[] = [
  {
    name: "context_search_v2",
    description: `세션 검색 (힌트 기반, ~200 토큰). 전체 내용이 아닌 힌트만 반환하여 토큰을 절약합니다.
상세 정보가 필요하면 context_get으로 조회하세요. scope='global'로 프로젝트 간 검색이 가능합니다.`,
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
          enum: [
            "planning",
            "coding",
            "testing",
            "reviewing",
            "debugging",
            "completed",
            "paused",
          ],
          description: "상태 필터",
        },
        scope: {
          type: "string",
          enum: ["project", "global"],
          description:
            "검색 범위 (project: 현재 프로젝트, global: 전체 프로젝트)",
          default: "project",
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
  {
    name: "context_stats",
    description:
      "세션 통계를 조회합니다. 상태별, 에이전트별, 태그별 분석을 제공합니다.",
    inputSchema: {
      type: "object" as const,
      properties: {
        range: {
          type: "string",
          enum: ["last_7_days", "last_30_days", "last_90_days", "all"],
          description: "통계 기간 (기본: last_30_days)",
          default: "last_30_days",
        },
      },
    },
  },
  {
    name: "context_export",
    description:
      "컨텍스트를 파일로 내보냅니다. Markdown, JSON, HTML 형식을 지원합니다.",
    inputSchema: {
      type: "object" as const,
      properties: {
        format: {
          type: "string",
          enum: ["markdown", "json", "html"],
          description: "내보내기 형식",
        },
        range: {
          type: "object",
          properties: {
            from: { type: "string", description: "시작 날짜 (ISO 형식)" },
            to: { type: "string", description: "종료 날짜 (ISO 형식)" },
          },
          description: "날짜 범위 필터",
        },
        contextIds: {
          type: "array",
          items: { type: "string" },
          description: "특정 컨텍스트 ID 목록",
        },
        output: {
          type: "string",
          description: "출력 파일 경로 (없으면 내용 반환)",
        },
      },
      required: ["format"],
    },
  },
  {
    name: "context_recommend",
    description:
      "현재 작업과 관련된 이전 세션을 추천합니다. 유사한 목표, 태그, 실패 패턴을 분석합니다.",
    inputSchema: {
      type: "object" as const,
      properties: {
        currentGoal: {
          type: "string",
          description: "현재 작업 목표",
        },
        limit: {
          type: "number",
          description: "최대 추천 수 (기본: 5, 최대: 10)",
          default: 5,
        },
      },
      required: ["currentGoal"],
    },
  },
  {
    name: "context_archive",
    description: `컨텍스트 아카이빙 관리. 오래된 컨텍스트를 아카이브하거나 복원합니다.

액션:
- archive: 오래된 완료 컨텍스트 아카이브 (기본: 90일)
- restore: 아카이브에서 복원
- stats: 아카이브 통계 조회
- search: 아카이브 검색
- list: 아카이브 목록 조회
- purge: 오래된 아카이브 영구 삭제`,
    inputSchema: {
      type: "object" as const,
      properties: {
        action: {
          type: "string",
          enum: ["archive", "restore", "stats", "search", "list", "purge"],
          description: "아카이브 액션",
        },
        contextId: {
          type: "string",
          description: "복원할 컨텍스트 ID (restore용)",
        },
        query: {
          type: "string",
          description: "검색어 (search용)",
        },
        daysOld: {
          type: "number",
          description: "아카이브/삭제 기준 일수",
        },
        limit: {
          type: "number",
          description: "결과 제한 (list/search용)",
        },
        offset: {
          type: "number",
          description: "시작 위치 (list용)",
        },
      },
      required: ["action"],
    },
  },
];

/**
 * 모든 도구 정의
 */
export const TOOLS: Tool[] = [
  ...contextTools,
  ...metadataTools,
  ...snapshotTools,
  ...syncTools,
  ...nlpTools,
  ...advancedTools,
  ...v2Tools,
];

/**
 * 도구 개수
 */
export const TOOLS_COUNT = TOOLS.length;
