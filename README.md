# Claude Code Universal Agent Toolkit

Claude Code를 위한 범용 에코시스템 - 모든 개발 프로젝트에서 재사용 가능한 에이전트, 스킬, 훅, MCP 서버 모음

## 주요 기능

- **Context Sync MCP**: AI 에이전트 간 컨텍스트 자동 동기화 (Claude Code ↔ Cursor ↔ Windsurf ↔ Copilot)
- **12개 전문 에이전트**: orchestrator, planner, coder, reviewer, tester, debugger, documenter, security-auditor, refactorer, optimizer, migrator, architect
- **15개 범용 스킬**: testing, security-audit, code-quality, documentation, performance, git-workflow, error-handling, api-design, database, devops, ai-ml, microservices, cloud, accessibility, i18n
- **9개 자동화 훅**: 코드 검증, 포맷팅, 보안 스캔, 명령 로깅, 의존성 검사, 테스트 실행, 린트 검사, 복잡도 분석, 커밋 검증
- **16개 슬래시 명령어**: /plan, /implement, /review, /test, /debug, /document, /security, /commit-msg, /pr-desc, /refactor, /optimize, /migrate, /analyze, /architect, /deploy, /setup
- **4개 경로별 규칙**: frontend, backend, tests, security

---

## Context Sync MCP

AI 에디터 간 작업 컨텍스트를 자동으로 공유하는 MCP 서버

### 왜 필요한가?

- **에디터 전환 시 컨텍스트 유실 방지**: Cursor에서 작업하다 Claude Code로 전환해도 맥락 유지
- **의사결정 공유**: "왜 JWT를 선택했는지" 기록하면 다른 AI도 이해
- **실패 경험 공유**: 시도했지만 실패한 접근법을 기록해 같은 실수 반복 방지
- **자동 동기화**: 에디터 전환, 파일 저장, Git 커밋 시 자동으로 동기화

### 설치

```bash
cd packages/context-sync-mcp
npm install && npm run build
```

### MCP 설정

```json
// ~/.claude/mcp.json 또는 프로젝트 .claude/mcp.json
{
  "mcpServers": {
    "context-sync": {
      "command": "node",
      "args": ["<path>/packages/context-sync-mcp/dist/index.js"]
    }
  }
}
```

### 사용 가능한 도구 (14개)

**컨텍스트 관리**
| 도구 | 설명 |
|------|------|
| `context_save` | 작업 컨텍스트 저장 (목표, 상태, 다음 단계) |
| `context_load` | 이전 컨텍스트 로드 |
| `context_query` | 특정 정보 조회 (결정, 블로커, 접근법 등) |
| `context_summarize` | 컨텍스트 요약 (토큰 절약, 압축 레벨 선택) |

**기록 및 추적**
| 도구 | 설명 |
|------|------|
| `decision_log` | 의사결정 기록 (무엇을, 왜) |
| `attempt_log` | 시도한 접근법 기록 (성공/실패/부분 성공) |
| `blocker_add` | 막힌 부분 기록 |
| `blocker_resolve` | 블로커 해결 표시 |
| `handoff` | 다른 AI 에이전트로 인수인계 |

**스냅샷**
| 도구 | 설명 |
|------|------|
| `snapshot_create` | 현재 상태 스냅샷 생성 |
| `snapshot_list` | 스냅샷 목록 조회 |

**자동 동기화 (Phase 2)**
| 도구 | 설명 |
|------|------|
| `sync_start` | 자동 동기화 시작 (에디터 전환, 파일 저장, Git 커밋 감지) |
| `sync_stop` | 자동 동기화 중지 |
| `sync_status` | 동기화 상태 조회 |

### 사용 예시

```
# 작업 시작
> context_save로 "사용자 인증 기능 구현" 목표 저장해줘

# 의사결정 기록
> decision_log로 "JWT 사용" 결정 기록해줘. 이유는 "stateless하고 확장성 좋음"

# 실패한 시도 기록
> attempt_log로 "세션 기반 인증" 시도했지만 실패 기록해줘. 이유는 "Redis 설정 복잡"

# 자동 동기화 시작
> sync_start로 자동 동기화 시작해줘

# 다른 AI로 인수인계
> handoff로 Cursor에게 "로그인 UI 구현" 인수인계해줘

# 컨텍스트 요약 (토큰 절약)
> context_summarize로 마크다운 형식으로 요약해줘
```

### 데이터 저장 위치

```
<project>/.context-sync/
├── context.json      # 현재 컨텍스트
└── snapshots/        # 스냅샷 백업
    ├── snapshot-xxx.json
    └── ...
```

---

## 설치

### 새 프로젝트에 설치

```bash
# 1. 이 저장소 클론
git clone <this-repo> my-project/.claude-toolkit

# 2. 필요한 파일 복사
cp -r my-project/.claude-toolkit/.claude my-project/
cp my-project/.claude-toolkit/CLAUDE.md my-project/

# 3. Context Sync MCP 빌드
cd my-project/.claude-toolkit/packages/context-sync-mcp
npm install && npm run build

# 4. 정리
rm -rf my-project/.claude-toolkit
```

### 기존 프로젝트에 추가

```bash
# .claude 폴더와 CLAUDE.md 복사
cp -r .claude /path/to/your/project/
cp CLAUDE.md /path/to/your/project/
```

---

## 사용법

### 기본 명령어

```bash
# 프로젝트 디렉토리에서 Claude Code 시작
cd your-project
claude

# 구현 계획 수립
> /plan 사용자 인증 기능

# 기능 구현 (전체 워크플로우)
> /implement JWT 기반 로그인

# 코드 리뷰
> /review src/auth/

# 테스트 작성
> /test src/utils/auth.ts

# 디버깅
> /debug 로그인이 안 됩니다

# 보안 검사
> /security

# 커밋 메시지 생성
> /commit-msg

# PR 설명 생성
> /pr-desc

# 리팩토링
> /refactor src/components/

# 성능 최적화
> /optimize src/api/

# 버전 마이그레이션
> /migrate react@18

# 코드 분석
> /analyze

# 아키텍처 설계
> /architect 실시간 채팅 기능

# 배포 설정
> /deploy docker
```

### 에이전트 직접 호출

```bash
# 특정 에이전트 사용
> orchestrator 에이전트로 결제 시스템 구현해줘
> debugger 에이전트로 이 에러 분석해줘
```

---

## 구조

```
.claude/
├── agents/                   # AI 에이전트 (12개)
│   ├── orchestrator.md       # 메인 조율자
│   ├── planner.md            # 계획 수립
│   ├── coder.md              # 코드 작성
│   ├── reviewer.md           # 코드 리뷰
│   ├── tester.md             # 테스트
│   ├── debugger.md           # 디버깅
│   ├── documenter.md         # 문서화
│   ├── security-auditor.md   # 보안 검사
│   ├── refactorer.md         # 리팩토링
│   ├── optimizer.md          # 성능 최적화
│   ├── migrator.md           # 마이그레이션
│   └── architect.md          # 아키텍처 설계
│
├── skills/                   # 재사용 가능 지식 (15개)
│   ├── testing/
│   ├── security-audit/
│   ├── code-quality/
│   ├── documentation/
│   ├── performance/
│   ├── git-workflow/
│   ├── error-handling/
│   ├── api-design/
│   ├── database/
│   ├── devops/
│   ├── ai-ml/
│   ├── microservices/
│   ├── cloud/
│   ├── accessibility/
│   └── i18n/
│
├── commands/                 # 슬래시 명령어 (16개)
│   ├── plan.md
│   ├── implement.md
│   ├── review.md
│   ├── test.md
│   ├── debug.md
│   ├── document.md
│   ├── security.md
│   ├── commit-msg.md
│   ├── pr-desc.md
│   ├── refactor.md
│   ├── optimize.md
│   ├── migrate.md
│   ├── analyze.md
│   ├── architect.md
│   ├── deploy.md
│   └── setup.md
│
├── hooks/                    # 자동화 스크립트 (9개)
│   ├── pre-edit-validator.py
│   ├── post-edit-formatter.py
│   ├── security-scanner.py
│   ├── command-logger.py
│   ├── dependency-checker.py
│   ├── test-runner.py
│   ├── lint-checker.py
│   ├── code-complexity.py
│   └── commit-validator.py
│
├── rules/                    # 경로별 규칙
│   ├── frontend.md
│   ├── backend.md
│   ├── tests.md
│   └── security.md
│
├── settings.json             # 권한 및 훅 설정
└── mcp.json                  # MCP 서버 설정

packages/
└── context-sync-mcp/         # AI 에이전트 컨텍스트 동기화 MCP
    ├── src/
    │   ├── index.ts          # MCP 서버 엔트리
    │   ├── store/            # 컨텍스트 저장소
    │   ├── sync/             # 자동 동기화 엔진
    │   ├── watcher/          # 에디터 감지
    │   ├── utils/            # 컨텍스트 요약기
    │   └── types/            # 타입 정의
    └── package.json

CLAUDE.md                     # 프로젝트 컨텍스트
```

---

## 커스터마이징

### 프로젝트별 CLAUDE.md 수정

```markdown
## 기술 스택
- Frontend: React + TypeScript
- Backend: Node.js + Express
- Database: PostgreSQL

## 프로젝트 규칙
- 모든 API는 /api/v1 prefix
- 테스트 커버리지 80% 이상
```

### 새 에이전트 추가

```markdown
<!-- .claude/agents/my-agent.md -->
---
name: my-agent
description: 에이전트 설명
tools: Read, Edit, Bash
model: sonnet
---

시스템 프롬프트...
```

### 새 스킬 추가

```markdown
<!-- .claude/skills/my-skill/SKILL.md -->
---
name: my-skill
description: 트리거 키워드 포함
---

지식 내용...
```

---

## MCP 서버 설정

### 사용 가능한 MCP 서버

| MCP | 설명 | 필요 환경변수 |
|-----|------|--------------|
| **context-sync** | AI 에이전트 컨텍스트 동기화 | - |
| github | GitHub 연동 | GITHUB_TOKEN |
| postgres | PostgreSQL | DATABASE_URL |
| sqlite | SQLite | - |
| puppeteer | 브라우저 자동화 | - |
| fetch | HTTP 요청 | - |
| memory | 영구 메모리 | - |
| sequential-thinking | 순차적 사고 | - |

### MCP 설정 방법

```bash
# 대화형 MCP 설정 (권장)
/setup mcp

# 또는 직접 스크립트 실행
python .claude/scripts/setup-mcp.py

# 환경 체크
python .claude/scripts/check-environment.py
```

### MCP 서버 수동 추가

```bash
# Context Sync MCP 추가
claude mcp add context-sync -- node /path/to/packages/context-sync-mcp/dist/index.js

# GitHub 연결
claude mcp add github -- npx -y @anthropic/mcp-server-github

# PostgreSQL 연결
claude mcp add postgres \
  --env DATABASE_URL=postgresql://... \
  -- npx -y @anthropic/mcp-postgres-server
```

---

## 요구사항

- Claude Code CLI
- Node.js 18+ (Context Sync MCP, npx 포맷터용)
- Python 3.8+ (훅 실행용, 선택)

## 라이선스

MIT
