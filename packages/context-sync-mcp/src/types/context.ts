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
