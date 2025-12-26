# Context Sync MCP - AI 에이전트 간 컨텍스트 자동 동기화

## 개요

여러 AI 코딩 도구(Cursor, Claude Code, Windsurf, Copilot 등) 간에
작업 컨텍스트를 **자동으로** 공유하는 MCP 서버

### 핵심 가치

```
"한 도구에서 하던 작업을 다른 도구에서 자연스럽게 이어서"
```

### 기존 솔루션과 차별점

| 기존 | Context Sync MCP |
|------|------------------|
| 파일/코드 정보만 공유 | **대화 + 의도 + 결정** 공유 |
| 명시적 명령 필요 | **자동 감지/동기화** |
| 단방향 | **양방향 실시간** |
| 메타데이터 수준 | **풍부한 컨텍스트** |

---

## 아키텍처

```
┌─────────────────────────────────────────────────────────────────┐
│                    Context Sync MCP Server                       │
│                    (백그라운드 상시 실행)                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    Context Store                          │   │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐     │   │
│  │  │ Session │  │Decision │  │  Code   │  │ Failed  │     │   │
│  │  │   Log   │  │   Log   │  │ Changes │  │Attempts │     │   │
│  │  └─────────┘  └─────────┘  └─────────┘  └─────────┘     │   │
│  └──────────────────────────────────────────────────────────┘   │
│                              ↑↓                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    Sync Engine                            │   │
│  │  • 에디터 전환 감지                                        │   │
│  │  • 파일 변경 감지                                          │   │
│  │  • 유휴 상태 감지                                          │   │
│  │  • 컨텍스트 압축/요약                                      │   │
│  └──────────────────────────────────────────────────────────┘   │
│                              ↑↓                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                   Adapter Layer                           │   │
│  │  ┌────────┐  ┌────────────┐  ┌──────────┐  ┌─────────┐  │   │
│  │  │ Cursor │  │Claude Code │  │ Windsurf │  │ Copilot │  │   │
│  │  │Adapter │  │  Adapter   │  │ Adapter  │  │ Adapter │  │   │
│  │  └────────┘  └────────────┘  └──────────┘  └─────────┘  │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: 핵심 기능 (MVP)

### 1.1 데이터 모델

```typescript
// 공유되는 컨텍스트 구조
interface SharedContext {
  id: string;
  projectPath: string;

  // 현재 작업 상태
  currentWork: {
    goal: string;                    // "로그인 기능 구현"
    status: "planning" | "coding" | "testing" | "reviewing" | "debugging";
    startedAt: Date;
    lastActiveAt: Date;
  };

  // 대화 요약 (전체 대화가 아닌 핵심만)
  conversationSummary: {
    keyDecisions: Decision[];        // 주요 의사결정
    triedApproaches: Approach[];     // 시도한 접근법
    blockers: Blocker[];             // 막힌 부분
    nextSteps: string[];             // 다음 할 일
  };

  // 코드 변경 추적
  codeChanges: {
    modifiedFiles: string[];
    summary: string;                  // 변경 요약
    uncommittedChanges: boolean;
  };

  // 에이전트 체인
  agentChain: AgentHandoff[];        // 어떤 AI들이 거쳐갔는지
}

interface Decision {
  what: string;                      // "JWT 토큰 방식 사용"
  why: string;                       // "세션보다 stateless해서"
  madeBy: AgentType;
  timestamp: Date;
}

interface Approach {
  description: string;
  result: "success" | "failed" | "partial";
  reason?: string;                   // 실패 시 이유
}

interface AgentHandoff {
  from: AgentType;
  to: AgentType;
  summary: string;
  timestamp: Date;
}

type AgentType = "cursor" | "claude-code" | "windsurf" | "copilot" | "unknown";
```

### 1.2 MCP Tools

```typescript
// 제공하는 MCP 도구들

tools: {
  // 컨텍스트 저장
  "context_save": {
    description: "현재 작업 컨텍스트 저장",
    parameters: {
      goal: string,
      summary: string,
      decisions?: Decision[],
      nextSteps?: string[]
    }
  },

  // 컨텍스트 로드
  "context_load": {
    description: "이전 작업 컨텍스트 로드",
    parameters: {
      projectPath?: string  // 없으면 현재 디렉토리
    },
    returns: SharedContext
  },

  // 컨텍스트 조회
  "context_query": {
    description: "특정 정보 조회",
    parameters: {
      query: "decisions" | "blockers" | "next_steps" | "summary"
    }
  },

  // 결정 기록
  "decision_log": {
    description: "의사결정 기록",
    parameters: {
      what: string,
      why: string
    }
  },

  // 실패 기록
  "attempt_log": {
    description: "시도한 접근법 기록",
    parameters: {
      approach: string,
      result: "success" | "failed",
      reason?: string
    }
  }
}
```

### 1.3 파일 구조

```
context-sync-mcp/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts              # MCP 서버 진입점
│   ├── server.ts             # MCP 서버 구현
│   ├── store/
│   │   ├── context-store.ts  # 컨텍스트 저장소
│   │   └── file-store.ts     # 파일 기반 저장
│   ├── tools/
│   │   ├── save.ts           # context_save
│   │   ├── load.ts           # context_load
│   │   ├── query.ts          # context_query
│   │   └── log.ts            # decision_log, attempt_log
│   ├── types/
│   │   └── context.ts        # 타입 정의
│   └── utils/
│       ├── summarizer.ts     # 컨텍스트 요약
│       └── diff.ts           # 변경 감지
└── data/
    └── .context/             # 프로젝트별 컨텍스트 저장
```

---

## Phase 2: 자동 감지 및 동기화

### 2.1 에디터 전환 감지

```typescript
interface EditorWatcher {
  // 활성 에디터 추적
  watchActiveEditor(): void;

  // 전환 이벤트
  onEditorSwitch(callback: (from: AgentType, to: AgentType) => void): void;

  // 현재 활성 에디터
  getCurrentEditor(): AgentType;
}

// 구현 방식
class EditorWatcher {
  private checkInterval = 1000; // 1초마다 체크

  watchActiveEditor() {
    // 방법 1: 프로세스 모니터링
    // - Cursor, Claude Code, Windsurf 프로세스 활성화 상태 체크

    // 방법 2: 파일 락 감지
    // - 각 에디터가 생성하는 락 파일 모니터링

    // 방법 3: MCP 연결 상태
    // - 어떤 MCP 클라이언트가 활성 연결인지 추적
  }
}
```

### 2.2 자동 동기화 트리거

```typescript
interface SyncTrigger {
  type: "editor_switch" | "file_save" | "idle" | "git_commit" | "manual";
  condition: () => boolean;
  action: () => Promise<void>;
}

const syncTriggers: SyncTrigger[] = [
  {
    type: "editor_switch",
    condition: () => editorChanged(),
    action: async () => {
      // 이전 에디터 컨텍스트 저장
      await saveCurrentContext();
      // 새 에디터에 컨텍스트 준비
      await prepareContextForNewEditor();
    }
  },
  {
    type: "file_save",
    condition: () => filesSaved(),
    action: async () => {
      // 코드 변경 컨텍스트 업데이트
      await updateCodeChanges();
    }
  },
  {
    type: "idle",
    condition: () => idleFor(5 * 60 * 1000), // 5분 유휴
    action: async () => {
      // 자동 스냅샷
      await saveSnapshot();
    }
  },
  {
    type: "git_commit",
    condition: () => gitCommitDetected(),
    action: async () => {
      // 작업 단위 완료 기록
      await markWorkUnitComplete();
    }
  }
];
```

### 2.3 컨텍스트 압축/요약

```typescript
interface ContextSummarizer {
  // 긴 대화 → 핵심 요약
  summarizeConversation(messages: Message[]): ConversationSummary;

  // 코드 변경 요약
  summarizeCodeChanges(diffs: Diff[]): string;

  // 토큰 제한 내 압축
  compressToTokenLimit(context: SharedContext, maxTokens: number): SharedContext;
}

// 요약 전략
const summarizationStrategies = {
  // 최근 우선
  recency: (items, limit) => items.slice(-limit),

  // 중요도 우선
  importance: (items, limit) => items.sort(byImportance).slice(0, limit),

  // 계층적 요약
  hierarchical: (items) => {
    // 상세 → 중간 → 핵심 3단계 요약
  }
};
```

---

## Phase 3: 에디터별 어댑터

### 3.1 어댑터 인터페이스

```typescript
interface EditorAdapter {
  name: AgentType;

  // 컨텍스트 주입
  injectContext(context: SharedContext): Promise<void>;

  // 컨텍스트 추출
  extractContext(): Promise<Partial<SharedContext>>;

  // 연결 상태
  isConnected(): boolean;

  // 활성 상태
  isActive(): boolean;
}
```

### 3.2 Claude Code 어댑터

```typescript
class ClaudeCodeAdapter implements EditorAdapter {
  name = "claude-code" as const;

  async injectContext(context: SharedContext) {
    // Claude Code는 MCP 네이티브 지원
    // 자동으로 context_load 도구 결과를 활용

    // 시스템 프롬프트에 컨텍스트 요약 추가
    return {
      systemPromptAddition: this.formatContextForClaude(context)
    };
  }

  private formatContextForClaude(context: SharedContext): string {
    return `
## 이전 작업 컨텍스트

**목표**: ${context.currentWork.goal}
**상태**: ${context.currentWork.status}
**마지막 활동**: ${context.agentChain.at(-1)?.from} (${context.agentChain.at(-1)?.summary})

### 주요 결정사항
${context.conversationSummary.keyDecisions.map(d => `- ${d.what} (${d.why})`).join('\n')}

### 시도했지만 실패한 것
${context.conversationSummary.triedApproaches.filter(a => a.result === 'failed').map(a => `- ${a.description}: ${a.reason}`).join('\n')}

### 다음 단계
${context.conversationSummary.nextSteps.map(s => `- ${s}`).join('\n')}
    `.trim();
  }
}
```

### 3.3 Cursor 어댑터

```typescript
class CursorAdapter implements EditorAdapter {
  name = "cursor" as const;

  async injectContext(context: SharedContext) {
    // Cursor는 .cursorrules 또는 MCP 활용
    // 방법 1: 임시 .cursorrules 파일에 컨텍스트 추가
    // 방법 2: MCP 도구로 컨텍스트 제공
  }

  async extractContext(): Promise<Partial<SharedContext>> {
    // Cursor의 대화 히스토리 접근은 제한적
    // 파일 변경 기반으로 추적
  }
}
```

### 3.4 Windsurf 어댑터

```typescript
class WindsurfAdapter implements EditorAdapter {
  name = "windsurf" as const;

  // Windsurf 특화 구현
}
```

---

## Phase 4: 고급 기능

### 4.1 스마트 컨텍스트 전환

```typescript
interface SmartHandoff {
  // AI가 자동으로 컨텍스트 인식
  seamlessMode: {
    enabled: boolean;

    // 질문 없이 자동 로드
    autoLoad: boolean;

    // AI 응답에 자연스럽게 통합
    naturalIntegration: boolean;
  };

  // 컨텍스트 충돌 해결
  conflictResolution: {
    // 같은 파일을 여러 AI가 수정했을 때
    strategy: "latest" | "merge" | "ask";
  };
}
```

### 4.2 작업 히스토리 타임라인

```typescript
interface WorkTimeline {
  // 시간순 작업 기록
  entries: TimelineEntry[];

  // 특정 시점으로 롤백
  rollbackTo(timestamp: Date): SharedContext;

  // 시각화용 데이터
  getVisualization(): TimelineVisualization;
}

interface TimelineEntry {
  timestamp: Date;
  agent: AgentType;
  action: "start" | "decision" | "code_change" | "handoff" | "complete";
  summary: string;
  snapshot?: SharedContext;
}
```

### 4.3 팀 동기화 (선택적)

```typescript
interface TeamSync {
  // 팀원 간 컨텍스트 공유
  shareWith(userId: string, contextId: string): void;

  // 팀 작업 현황
  getTeamActivity(): TeamActivity[];

  // 충돌 감지
  detectConflicts(): Conflict[];
}
```

### 4.4 분석 및 인사이트

```typescript
interface Analytics {
  // 어떤 도구를 얼마나 사용했는지
  toolUsage(): ToolUsageStats;

  // 작업 패턴 분석
  workPatterns(): WorkPattern[];

  // 생산성 인사이트
  productivityInsights(): Insight[];

  // 자주 겪는 블로커
  commonBlockers(): Blocker[];
}
```

---

## 구현 로드맵

### MVP (2주) ✅ 완료

```
Week 1:
├── [x] 프로젝트 셋업 (TypeScript, MCP SDK)
├── [x] 기본 데이터 모델 구현
├── [x] 파일 기반 저장소 구현
├── [x] 핵심 MCP 도구 구현
│   ├── context_save
│   ├── context_load
│   └── context_query
└── [x] Claude Code 기본 연동 테스트

Week 2:
├── [x] 에디터 전환 감지 (기본)
├── [x] 자동 저장 트리거
├── [x] 컨텍스트 요약 로직
├── [x] 기본 UI/알림
└── [x] 문서화 및 설치 가이드
```

### v1.0 (4주) ✅ 완료

```
Week 3-4:
├── [x] 자연어 명령 지원 (ctx 도구)
├── [x] 자동화 설정 (autoLoad, autoSave, autoSync)
├── [x] 컨텍스트 압축 최적화
├── [x] 스냅샷 기능
├── [x] 고급 기능 (diff, merge, search, metrics)
└── [x] NPM 패키지 배포 (@liruns/context-sync-mcp)
```

### v2.0 (8주) ✅ 완료 (2024-12)

```
Week 5-8:
├── [x] SQLite 하이브리드 저장소
│   ├── sql.js (WebAssembly) 기반 - 네이티브 컴파일 불필요
│   ├── FTS5 전문검색 지원
│   └── JSON 폴백 모드 유지
├── [x] 토큰 효율적 새 도구들
│   ├── context_search_v2 (~200 토큰, 힌트 기반)
│   ├── context_get (~500 토큰, 상세 조회)
│   └── context_warn (~100 토큰, 경고/추천)
├── [x] 서버 사이드 요약
│   ├── goal_short (50자)
│   ├── summary_short (100자)
│   └── has_warnings 플래그
├── [x] 자동 마이그레이션 (JSON → SQLite)
└── [x] 하위 호환성 유지 (기존 21개 도구)
```

### v2.1 (예정)

```
├── [ ] seamless 모드 개선
├── [ ] 작업 타임라인 시각화
├── [ ] 팀 동기화 기능
├── [ ] 분석 대시보드
├── [ ] VS Code 확장 (선택적)
└── [ ] Copilot 어댑터
```

---

## 기술 스택

| 영역 | 기술 | 이유 |
|------|------|------|
| 언어 | TypeScript | MCP SDK 호환, 타입 안전성 |
| MCP SDK | @modelcontextprotocol/sdk | 공식 SDK |
| 저장소 | SQLite + JSON | 로컬 우선, 심플 |
| 프로세스 감지 | node-process-list | 크로스 플랫폼 |
| 파일 감시 | chokidar | 성능 좋은 파일 와처 |
| CLI | commander + inquirer | 사용자 인터페이스 |

---

## 설정 예시

```json
// .context-sync/config.json
{
  "syncMode": "seamless",  // "seamless" | "ask" | "manual"

  "triggers": {
    "editorSwitch": true,
    "fileSave": true,
    "idleMinutes": 5,
    "gitCommit": true
  },

  "storage": {
    "location": ".context-sync/data",
    "maxSnapshots": 100,
    "compressionLevel": "medium"
  },

  "adapters": {
    "claude-code": { "enabled": true },
    "cursor": { "enabled": true },
    "windsurf": { "enabled": true },
    "copilot": { "enabled": false }
  },

  "privacy": {
    "excludePatterns": ["*.env", "*secret*", "*password*"],
    "localOnly": true  // 외부 서버로 전송 안 함
  }
}
```

---

## 사용 시나리오

### 시나리오 1: 자연스러운 도구 전환

```
[Cursor에서 작업]
사용자: "로그인 API 만들어줘"
Cursor: JWT 기반 로그인 API 구현...
        ↓ (자동으로 컨텍스트 저장됨)

[Claude Code로 전환]
(자동 감지 + seamless 모드)

사용자: "보안 강화해줘"
Claude Code: "Cursor에서 만든 JWT 로그인 API를 보니까,
             refresh token 로직이 없네요. 추가할게요.
             그리고 rate limiting도 넣을게요..."
```

### 시나리오 2: 디버깅 이어하기

```
[Windsurf에서 디버깅]
사용자: "왜 로그인이 안 될까?"
Windsurf: 토큰 만료 시간 문제 발견, 하지만 수정 복잡함
          ↓ (실패 시도 + 발견 내용 저장됨)

[Claude Code로 전환]
Claude Code: "Windsurf에서 토큰 만료 시간 문제를 찾았네요.
             시도했던 방법(만료 시간 연장)은 보안상 좋지 않았고요.
             대신 refresh token 방식으로 해결할게요..."
```

### 시나리오 3: 코드 리뷰 인수인계

```
[Cursor에서 구현 완료]
        ↓ (변경 파일 + 결정 사항 저장됨)

[Windsurf에서 리뷰]
Windsurf: "Cursor에서 구현한 내용 보니까:
          - JWT 토큰 방식 선택 (세션보다 stateless)
          - bcrypt로 비밀번호 해싱

          몇 가지 개선점:
          - 토큰 블랙리스트 없음
          - 에러 메시지가 너무 상세함 (보안 위험)"
```

---

## 예상 이슈 및 해결책

| 이슈 | 해결책 |
|------|--------|
| 에디터 감지 불안정 | 다중 감지 방법 (프로세스 + 파일락 + MCP 연결) |
| 컨텍스트 너무 큼 | 계층적 요약 + 토큰 제한 압축 |
| 민감 정보 노출 | 패턴 기반 필터링 + 로컬 전용 모드 |
| 동시 수정 충돌 | 타임스탬프 기반 + 사용자 확인 |
| 성능 오버헤드 | 배치 처리 + 디바운싱 |

---

## 성공 지표

| 지표 | 목표 |
|------|------|
| 컨텍스트 복원 정확도 | 90%+ (사용자가 "맞아, 그거 하고 있었어" 반응) |
| 동기화 지연 | < 2초 |
| 토큰 효율 | 원본 대비 80% 압축 |
| 사용자 개입 | seamless 모드에서 0회 |
| 에디터 지원 | 3개+ (Claude Code, Cursor, Windsurf) |
