# Claude Code Agent Toolkit

Claude Code 기능을 확장하는 범용 에코시스템

## 구조

```
.claude/
├── agents/      # 12개 - 전문화된 AI 에이전트
├── commands/    # 16개 - 슬래시 명령어
├── skills/      # 15개 - 도메인별 지식
├── hooks/       # 9개 - 자동화 스크립트
├── rules/       # 4개 - 경로별 규칙
├── scripts/     # 유틸리티 스크립트
├── settings.json
└── mcp.json

packages/
└── context-sync-mcp/  # AI 에이전트 간 컨텍스트 동기화
```

---

## Context Sync MCP (`@liruns/context-sync-mcp` v3.0.0)

여러 AI 에디터(Claude Code, Cursor, Windsurf, Copilot) 간 작업 컨텍스트 공유

> v3.0에서 15개 → 10개로 도구 통합 (AI 혼동 감소)

### 도구 (10개)

#### 컨텍스트 관리 (2개)
| 도구 | 설명 | 파라미터 |
|------|------|----------|
| `context_save` | 작업 컨텍스트 저장 | `goal` (필수), `status`, `nextSteps`, `agent` |
| `context_load` | 이전 컨텍스트 로드 | `format`: full/summary/decisions/blockers/next_steps |

#### 기록 및 추적 (3개)
| 도구 | 설명 | 파라미터 |
|------|------|----------|
| `decision_log` | 의사결정 기록 | `what` (필수), `why` (필수) |
| `attempt_log` | 시도/실패 기록 | `approach` (필수), `result`: success/failed/partial, `reason` |
| `handoff` | 다른 AI로 인수인계 | `to`: claude-code/cursor/windsurf/copilot, `summary` |

#### 통합 도구 (4개) - v3.0 신규
| 도구 | action | 설명 |
|------|--------|------|
| `snapshot` | `create`/`restore`/`list` | 스냅샷 생성/복원/목록 |
| `blocker` | `add`/`resolve`/`list` | 블로커 추가/해결/목록 |
| `context_maintain` | `cleanup`/`archive` | 정리/아카이브 |
| `context_analyze` | `stats`/`recommend` | 통계/추천 |

#### 인텔리전스 (1개)
| 도구 | 설명 | 파라미터 |
|------|------|----------|
| `context_search` | 과거 컨텍스트 검색 (FTS5) | `query`, `tags`, `status`, `agent`, `dateRange`, `scope` |

### 워크플로우 예시

```
# 1. 작업 시작 - 목표 저장
> context_save goal: "사용자 인증 구현" status: "coding"

# 2. 결정 기록
> decision_log what: "JWT 사용" why: "stateless하고 확장성 좋음"

# 3. 실패한 시도 기록 (다른 AI가 같은 실수 반복 방지)
> attempt_log approach: "세션 기반 인증" result: "failed" reason: "Redis 설정 복잡"

# 4. 블로커 기록 (v3.0 통합 도구)
> blocker action: "add" description: "CORS 이슈로 API 호출 차단됨"

# 5. 다른 AI로 인수인계
> handoff to: "cursor" summary: "로그인 UI 구현 필요"

# 6. 다른 AI에서 작업 재개
> context_load format: "summary"
```

### 저장 위치
```
.context-sync/
├── config.json      # 설정
├── context.db       # SQLite DB (히스토리, FTS5 검색)
├── archives/        # 아카이브된 컨텍스트
└── snapshots/       # 스냅샷들
```

### v3.0 주요 변경
- **도구 통합**: 15개 → 10개 (AI 도구 선택 혼동 감소)
- **action 파라미터**: 유사 도구를 하나로 통합
- **blocker list**: 블로커 목록 조회 기능 추가

### 설치
```bash
# NPM으로 설치
npm install @liruns/context-sync-mcp

# 또는 로컬 빌드
cd packages/context-sync-mcp && npm install && npm run build
```

### MCP 설정
```json
{
  "mcpServers": {
    "context-sync": {
      "command": "npx",
      "args": ["@liruns/context-sync-mcp"]
    }
  }
}
```

---

## 명령어

### 핵심
| 명령어 | 설명 |
|--------|------|
| `/plan` | 구현 계획 수립 |
| `/implement` | 기능 구현 |
| `/review` | 코드 리뷰 |
| `/test` | 테스트 작성/실행 |
| `/debug` | 디버깅 |
| `/document` | 문서화 |
| `/security` | 보안 검사 |
| `/commit-msg` | 커밋 메시지 생성 |
| `/pr-desc` | PR 설명 생성 |

### 고급
| 명령어 | 설명 |
|--------|------|
| `/refactor` | 코드 리팩토링 |
| `/optimize` | 성능 최적화 |
| `/migrate` | 마이그레이션 |
| `/analyze` | 코드 분석 |
| `/architect` | 아키텍처 설계 |
| `/deploy` | 배포 설정 |
| `/setup` | 환경 설정 |

---

## 에이전트

### 핵심 (8개)
| 에이전트 | 역할 |
|---------|------|
| orchestrator | 멀티-스텝 작업 조율 (opus) |
| planner | 요구사항 분석/설계 |
| coder | 코드 작성/수정 |
| reviewer | 코드 리뷰 |
| tester | 테스트 작성/실행 |
| debugger | 버그 분석/수정 |
| documenter | 문서화 |
| security-auditor | 보안 감사 |

### 고급 (4개)
| 에이전트 | 역할 |
|---------|------|
| refactorer | 코드 리팩토링 |
| optimizer | 성능 최적화 |
| migrator | 마이그레이션 |
| architect | 아키텍처 설계 (opus) |

---

## 스킬

### 기본 (8개)
testing, security-audit, code-quality, documentation, performance, git-workflow, error-handling, api-design

### 고급 (7개)
database, devops, ai-ml, microservices, cloud, accessibility, i18n

---

## Hooks

### 활성화됨 (settings.json)
- **PreToolUse**: `pre-edit-validator` (Edit/Write)
- **PostToolUse**: `post-edit-formatter`, `command-logger`

### 사용 가능
| Hook | 트리거 | 설명 |
|------|--------|------|
| pre-edit-validator | Edit/Write | 보호 파일, 민감정보 검사 |
| post-edit-formatter | Edit/Write | 자동 포맷팅 |
| security-scanner | Write | 보안 스캔 |
| lint-checker | Edit | 린트 검사 |
| code-complexity | Edit | 복잡도 검사 |
| test-runner | Edit | 테스트 실행 |
| dependency-checker | Write | 의존성 검사 |
| command-logger | Bash | 명령어 로깅 |
| commit-validator | Notification | 커밋 메시지 검증 |

---

## 권한 설정

### 허용 (자동 승인)
```
npm, yarn, pnpm, npx, python, pip
git (status, diff, log, branch, checkout, add, commit, push, pull, fetch)
ls, cat, grep, find
docker, docker-compose, kubectl, terraform
aws, az, gcloud
```

### 차단
```
.env, secrets/, credentials, *.pem, *.key 읽기
rm -rf, sudo, chmod 777, curl|sh, wget|sh
```

---

## MCP 서버 (사용 가능)

| 서버 | 설명 | 필요 환경변수 |
|------|------|--------------|
| github | GitHub 연동 | GITHUB_TOKEN |
| postgres | PostgreSQL | DATABASE_URL |
| sqlite | SQLite | - |
| filesystem | 파일시스템 | - |
| puppeteer | 브라우저 자동화 | - |
| fetch | HTTP 요청 | - |
| memory | 영구 메모리 | - |
| sequential-thinking | 순차적 사고 | - |

설정: `/setup mcp` 또는 `python .claude/scripts/setup-mcp.py`

---

## 코딩 규칙

### 원칙
- 간결하고 읽기 쉬운 코드
- 작은 함수, 단일 책임
- 중복 최소화 (DRY)
- 적절한 에러 처리

### 금지
- 하드코딩된 시크릿
- console.log 커밋
- any 타입 남용
- 테스트 없는 중요 로직

---

## 경로별 규칙

| 경로 | 규칙 파일 |
|------|----------|
| src/components/, frontend/ | `.claude/rules/frontend.md` |
| src/api/, backend/ | `.claude/rules/backend.md` |
| tests/, __tests__/ | `.claude/rules/tests.md` |
| auth/, security/ | `.claude/rules/security.md` |
