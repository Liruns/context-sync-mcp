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

## Context Sync MCP (`@liruns/context-sync-mcp` v0.2.0)

여러 AI 에디터(Claude Code, Cursor, Windsurf, Copilot) 간 작업 컨텍스트 공유

### 자연어로 사용하기

도구 이름 대신 자연어로 간편하게 사용 가능:

```
"저장해줘" → 컨텍스트 저장
"불러와" / "이전 작업" → 컨텍스트 로드
"어디까지 했어" / "상태" → 현재 상태 조회
"요약해줘" → 컨텍스트 요약
"자동저장 켜줘" → 자동 동기화 시작
"자동저장 꺼줘" → 자동 동기화 중지
```

### 자동화 설정

`.context-sync/config.json`에서 설정 가능:

```json
{
  "automation": {
    "autoLoad": true,   // 세션 시작 시 자동 로드
    "autoSave": true,   // 변경 시 자동 저장
    "autoSync": false   // 자동 동기화 시작
  }
}
```

- `session_start` 도구: 세션 시작 시 자동 로드 + 요약 반환
- `automation_config` 도구: 자동화 설정 조회/변경

### 도구 (17개)

**자연어 & 자동화 (신규)**
| 도구 | 설명 |
|------|------|
| `ctx` | 자연어 명령 (저장/로드/상태/요약) |
| `session_start` | 세션 시작 (자동 로드 지원) |
| `automation_config` | 자동화 설정 관리 |

**컨텍스트 관리**
| 도구 | 설명 |
|------|------|
| `context_save` | 작업 컨텍스트 저장 |
| `context_load` | 이전 컨텍스트 로드 |
| `context_query` | 특정 정보 조회 |
| `context_summarize` | 컨텍스트 요약 (토큰 절약) |

**기록 및 추적**
| 도구 | 설명 |
|------|------|
| `decision_log` | 의사결정 기록 |
| `attempt_log` | 시도/실패 기록 |
| `blocker_add` | 블로커 추가 |
| `blocker_resolve` | 블로커 해결 |
| `handoff` | 다른 AI로 인수인계 |

**스냅샷**
| 도구 | 설명 |
|------|------|
| `snapshot_create` | 스냅샷 생성 |
| `snapshot_list` | 스냅샷 목록 |

**자동 동기화**
| 도구 | 설명 |
|------|------|
| `sync_start` | 자동 동기화 시작 (에디터 전환, 파일 저장, Git 커밋 감지) |
| `sync_stop` | 자동 동기화 중지 |
| `sync_status` | 동기화 상태 조회 |

### 설치
```bash
cd packages/context-sync-mcp && npm install && npm run build
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
