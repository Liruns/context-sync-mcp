/**
 * Context Sync MCP - 타입 정의
 * AI 에이전트 간 공유되는 컨텍스트 데이터 구조
 */

/** 지원하는 AI 에이전트 타입 */
export type AgentType =
  | "claude-code"
  | "cursor"
  | "windsurf"
  | "copilot"
  | "unknown";

/** 작업 상태 */
export type WorkStatus =
  | "planning"
  | "coding"
  | "testing"
  | "reviewing"
  | "debugging"
  | "completed"
  | "paused";

/** 시도 결과 */
export type AttemptResult = "success" | "failed" | "partial";

/**
 * 의사결정 기록
 */
export interface Decision {
  /** 결정 ID */
  id: string;
  /** 무엇을 결정했는지 */
  what: string;
  /** 왜 그렇게 결정했는지 */
  why: string;
  /** 결정한 에이전트 */
  madeBy: AgentType;
  /** 결정 시간 */
  timestamp: Date;
  /** 관련 파일 */
  relatedFiles?: string[];
}

/**
 * 시도한 접근법
 */
export interface Approach {
  /** 접근법 ID */
  id: string;
  /** 설명 */
  description: string;
  /** 결과 */
  result: AttemptResult;
  /** 실패 시 이유 */
  reason?: string;
  /** 시도한 에이전트 */
  attemptedBy: AgentType;
  /** 시도 시간 */
  timestamp: Date;
}

/**
 * 블로커 (막힌 부분)
 */
export interface Blocker {
  /** 블로커 ID */
  id: string;
  /** 설명 */
  description: string;
  /** 해결됨 여부 */
  resolved: boolean;
  /** 발견 시간 */
  discoveredAt: Date;
  /** 해결 시간 */
  resolvedAt?: Date;
  /** 해결 방법 */
  resolution?: string;
}

/**
 * 에이전트 간 인수인계
 */
export interface AgentHandoff {
  /** 이전 에이전트 */
  from: AgentType;
  /** 다음 에이전트 */
  to: AgentType;
  /** 인수인계 요약 */
  summary: string;
  /** 인수인계 시간 */
  timestamp: Date;
}

/**
 * 대화 요약
 */
export interface ConversationSummary {
  /** 주요 의사결정 */
  keyDecisions: Decision[];
  /** 시도한 접근법 */
  triedApproaches: Approach[];
  /** 막힌 부분 */
  blockers: Blocker[];
  /** 다음 할 일 */
  nextSteps: string[];
}

/**
 * 현재 작업 상태
 */
export interface CurrentWork {
  /** 작업 목표 */
  goal: string;
  /** 작업 상태 */
  status: WorkStatus;
  /** 시작 시간 */
  startedAt: Date;
  /** 마지막 활동 시간 */
  lastActiveAt: Date;
  /** 현재 작업 중인 파일 */
  activeFiles?: string[];
}

/**
 * 코드 변경 추적
 */
export interface CodeChanges {
  /** 수정된 파일 목록 */
  modifiedFiles: string[];
  /** 변경 요약 */
  summary: string;
  /** 커밋되지 않은 변경 있음 */
  uncommittedChanges: boolean;
  /** 마지막 커밋 해시 */
  lastCommitHash?: string;
}

/**
 * 공유 컨텍스트 (메인 데이터 구조)
 */
export interface SharedContext {
  /** 컨텍스트 ID */
  id: string;
  /** 프로젝트 경로 */
  projectPath: string;
  /** 현재 작업 상태 */
  currentWork: CurrentWork;
  /** 대화 요약 */
  conversationSummary: ConversationSummary;
  /** 코드 변경 추적 */
  codeChanges: CodeChanges;
  /** 에이전트 체인 (어떤 AI들이 거쳐갔는지) */
  agentChain: AgentHandoff[];
  /** 생성 시간 */
  createdAt: Date;
  /** 업데이트 시간 */
  updatedAt: Date;
  /** 버전 */
  version: number;
}

/**
 * 컨텍스트 스냅샷 (히스토리용)
 */
export interface ContextSnapshot {
  /** 스냅샷 ID */
  id: string;
  /** 컨텍스트 ID */
  contextId: string;
  /** 스냅샷 데이터 */
  data: SharedContext;
  /** 스냅샷 이유 */
  reason: "auto" | "manual" | "handoff" | "milestone";
  /** 스냅샷 시간 */
  timestamp: Date;
}

/**
 * 자동화 설정
 */
export interface AutomationConfig {
  /** 세션 시작 시 자동 로드 */
  autoLoad: boolean;
  /** 변경 시 자동 저장 */
  autoSave: boolean;
  /** 세션 시작 시 자동 동기화 시작 */
  autoSync: boolean;
}

/**
 * MCP 설정
 */
export interface ContextSyncConfig {
  /** 동기화 모드 */
  syncMode: "seamless" | "ask" | "manual";
  /** 트리거 설정 */
  triggers: {
    editorSwitch: boolean;
    fileSave: boolean;
    idleMinutes: number;
    gitCommit: boolean;
  };
  /** 저장소 설정 */
  storage: {
    location: string;
    maxSnapshots: number;
    compressionLevel: "none" | "low" | "medium" | "high";
  };
  /** 어댑터 설정 */
  adapters: {
    [key in AgentType]?: { enabled: boolean };
  };
  /** 프라이버시 설정 */
  privacy: {
    excludePatterns: string[];
    localOnly: boolean;
  };
  /** 자동화 설정 */
  automation: AutomationConfig;
}

/**
 * 새 컨텍스트 생성용 입력
 */
export interface CreateContextInput {
  projectPath: string;
  goal: string;
  agent?: AgentType;
}

/**
 * 컨텍스트 업데이트용 입력
 */
export interface UpdateContextInput {
  goal?: string;
  status?: WorkStatus;
  activeFiles?: string[];
  nextSteps?: string[];
}

// ========================================
// v2.0 - 토큰 효율적인 새 타입들
// ========================================

/**
 * 컨텍스트 힌트 (검색 결과용, 토큰 효율적)
 */
export interface ContextHint {
  /** 컨텍스트 ID */
  id: string;
  /** 목표 (50자 이내) */
  goal: string;
  /** 날짜 (YYYY-MM-DD) */
  date: string;
  /** 경고 여부 (실패/블로커 존재) */
  hasWarnings: boolean;
}

/**
 * context_search 입력
 */
export interface ContextSearchInput {
  /** 자연어 검색 쿼리 (FTS5) */
  query?: string;
  /** 태그 필터 */
  tags?: string[];
  /** 상태 필터 */
  status?: WorkStatus;
  /** 에이전트 필터 */
  agent?: AgentType;
  /** 날짜 범위 */
  dateRange?: {
    from?: string;
    to?: string;
  };
  /** 결과 개수 (기본 5, 최대 20) */
  limit?: number;
  /** 페이지네이션 오프셋 */
  offset?: number;
}

/**
 * context_search 출력 (~200 토큰)
 */
export interface ContextSearchOutput {
  /** 힌트 목록 */
  hints: ContextHint[];
  /** 전체 결과 수 */
  total: number;
  /** 더 많은 결과 있음 */
  hasMore: boolean;
  /** 제안 메시지 (선택적) */
  suggestion?: string;
}

/**
 * context_get 입력
 */
export interface ContextGetInput {
  /** 컨텍스트 ID */
  id: string;
  /** 액션 로그 포함 여부 (기본 true) */
  includeActions?: boolean;
  /** 연결된 세션 체인 포함 여부 */
  includeChain?: boolean;
  /** 액션 개수 제한 (기본 10) */
  actionsLimit?: number;
}

/**
 * context_get 출력 (~500 토큰)
 */
export interface ContextGetOutput {
  /** 컨텍스트 상세 */
  context: {
    id: string;
    parentId?: string;
    goal: string;
    summary?: string;
    status: WorkStatus;
    tags: string[];
    agent?: AgentType;
    metadata: ContextMetadata;
    startedAt: string;
    endedAt?: string;
    createdAt: string;
  };
  /** 액션 로그 */
  actions?: ActionRecord[];
  /** 연결된 세션 체인 */
  chain?: Array<{
    id: string;
    goal: string;
    createdAt: string;
  }>;
}

/**
 * context_warn 입력
 */
export interface ContextWarnInput {
  /** 현재 작업 목표 */
  currentGoal: string;
  /** 추천 개수 (기본 3) */
  limit?: number;
}

/**
 * context_warn 출력 (~100 토큰)
 */
export interface ContextWarnOutput {
  /** 경고 목록 */
  warnings: Array<{
    contextId: string;
    message: string;
  }>;
  /** 추천 세션 목록 */
  recommendations: Array<{
    id: string;
    goal: string;
  }>;
  /** 더 많은 관련 세션 있음 */
  hasMore: boolean;
}

/**
 * 컨텍스트 메타데이터 (DB 저장용)
 */
export interface ContextMetadata {
  decisions: Array<{
    what: string;
    why: string;
    madeBy: string;
    timestamp: string;
  }>;
  approaches: Array<{
    description: string;
    result: string;
    reason?: string;
    timestamp: string;
  }>;
  blockers: Array<{
    description: string;
    resolved: boolean;
    resolution?: string;
    discoveredAt: string;
    resolvedAt?: string;
  }>;
  codeChanges?: {
    modifiedFiles: string[];
    summary: string;
  };
  nextSteps?: string[];
}

/**
 * 액션 기록 (명령어, 편집, 에러)
 */
export interface ActionRecord {
  id: string;
  contextId: string;
  type: "command" | "edit" | "error";
  content: string;
  result?: string;
  filePath?: string;
  createdAt: string;
}

/**
 * DB 컨텍스트 레코드
 */
export interface ContextDbRecord {
  id: string;
  parent_id: string | null;
  goal: string;
  goal_short: string | null;
  summary: string | null;
  summary_short: string | null;
  status: string;
  tags: string;
  agent: string | null;
  metadata: string;
  has_warnings: number;
  project_path: string | null;
  started_at: string;
  ended_at: string | null;
  created_at: string;
  updated_at: string;
  version: number;
}

/**
 * context_save 입력 (v2.0 확장)
 */
export interface ContextSaveInput {
  /** 작업 목표 (필수) */
  goal: string;
  /** 요약 */
  summary?: string;
  /** 상태 */
  status?: WorkStatus;
  /** 태그 */
  tags?: string[];
  /** 부모 세션 ID (연결용) */
  parentId?: string;
  /** 에이전트 */
  agent?: AgentType;
  /** 메타데이터 */
  decisions?: Array<{ what: string; why: string }>;
  approaches?: Array<{ description: string; result: string; reason?: string }>;
  blockers?: Array<{ description: string; resolved?: boolean; resolution?: string }>;
  codeChanges?: { modifiedFiles: string[]; summary: string };
  nextSteps?: string[];
}

// ========================================
// v2.1 - 확장 기능 타입들
// ========================================

/**
 * context_stats 입력
 */
export interface ContextStatsInput {
  /** 통계 기간 */
  range?: 'last_7_days' | 'last_30_days' | 'last_90_days' | 'all';
}

/**
 * context_stats 출력
 */
export interface ContextStatsOutput {
  /** 총 세션 수 */
  totalSessions: number;
  /** 상태별 세션 수 */
  byStatus: Record<string, number>;
  /** 에이전트별 세션 수 */
  byAgent: Record<string, number>;
  /** 상위 태그 */
  topTags: Array<{ tag: string; count: number }>;
  /** 실패한 접근법 수 */
  failedApproaches: number;
  /** 세션당 평균 액션 수 */
  avgActionsPerSession: number;
  /** 통계 기간 */
  dateRange: {
    from: string;
    to: string;
  };
}

/**
 * context_export 입력
 */
export interface ContextExportInput {
  /** 출력 형식 (필수) */
  format: 'markdown' | 'json' | 'html';
  /** 날짜 범위 */
  range?: {
    from?: string;
    to?: string;
  };
  /** 특정 컨텍스트 ID 목록 */
  contextIds?: string[];
  /** 출력 파일 경로 (없으면 내용 반환) */
  output?: string;
}

/**
 * context_export 출력
 */
export interface ContextExportOutput {
  /** 내용 (output이 없을 때) */
  content?: string;
  /** 파일 경로 (output이 있을 때) */
  filePath?: string;
  /** 내보낸 컨텍스트 수 */
  exportedCount: number;
}

/**
 * context_recommend 입력
 */
export interface ContextRecommendInput {
  /** 현재 작업 목표 */
  currentGoal: string;
  /** 최대 추천 수 (기본 5) */
  limit?: number;
}

/**
 * context_recommend 출력
 */
export interface ContextRecommendOutput {
  recommendations: Array<{
    /** 컨텍스트 ID */
    id: string;
    /** 목표 */
    goal: string;
    /** 요약 */
    summary: string;
    /** 관련성 */
    relevance: 'high' | 'medium' | 'low';
    /** 매칭된 태그 */
    matchedTags: string[];
    /** 실패한 접근법 (경고용) */
    failedApproaches?: string[];
  }>;
}

/**
 * 강화된 경고 (v2.1)
 */
export interface EnhancedWarning {
  /** 관련 컨텍스트 ID */
  contextId: string;
  /** 경고 타입 */
  type: 'failed_approach' | 'unresolved_blocker' | 'repeated_failure';
  /** 경고 메시지 */
  message: string;
  /** 심각도 */
  severity: 'info' | 'warning' | 'error';
  /** 상세 정보 */
  details?: {
    failureCount?: number;
    lastFailureDate?: string;
    similarGoals?: string[];
  };
}

/**
 * 전역 검색용 scope 확장 (v2.1)
 */
export type SearchScope = 'project' | 'global';

/**
 * 전역 컨텍스트 레코드 (global.db용)
 */
export interface GlobalContextRecord {
  id: string;
  project_path: string;
  goal: string;
  goal_short: string | null;
  summary_short: string | null;
  status: string | null;
  tags: string;
  has_warnings: number;
  created_at: string;
  updated_at: string;
}
