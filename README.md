# Claude Code Universal Agent Toolkit

Claude Code를 위한 범용 에코시스템 - 모든 개발 프로젝트에서 재사용 가능한 에이전트, 스킬, 훅 모음

## 특징

- **12개 전문 에이전트**: orchestrator, planner, coder, reviewer, tester, debugger, documenter, security-auditor + **refactorer, optimizer, migrator, architect**
- **15개 범용 스킬**: testing, security-audit, code-quality, documentation, performance, git-workflow, error-handling, api-design + **database, devops, ai-ml, microservices, cloud, accessibility, i18n**
- **9개 자동화 훅**: 코드 검증, 포맷팅, 보안 스캔, 명령 로깅 + **의존성 검사, 테스트 실행, 린트 검사, 복잡도 분석, 커밋 검증**
- **15개 슬래시 명령어**: /plan, /implement, /review, /test, /debug, /document, /security, /commit-msg, /pr-desc + **/refactor, /optimize, /migrate, /analyze, /architect, /deploy**
- **4개 경로별 규칙**: frontend, backend, tests, security

## 설치

### 새 프로젝트에 설치

```bash
# 1. 이 저장소 클론 또는 복사
git clone <this-repo> my-project/.claude-toolkit

# 2. 필요한 파일 복사
cp -r my-project/.claude-toolkit/.claude my-project/
cp my-project/.claude-toolkit/CLAUDE.md my-project/

# 3. 정리
rm -rf my-project/.claude-toolkit
```

### 기존 프로젝트에 추가

```bash
# .claude 폴더와 CLAUDE.md 복사
cp -r .claude /path/to/your/project/
cp CLAUDE.md /path/to/your/project/
```

### 전역 사용 (개인)

```bash
# 사용자 홈에 복사
cp -r .claude/agents ~/.claude/
cp -r .claude/skills ~/.claude/
cp -r .claude/commands ~/.claude/
```

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
│   ├── refactorer.md         # 리팩토링 ✨
│   ├── optimizer.md          # 성능 최적화 ✨
│   ├── migrator.md           # 마이그레이션 ✨
│   └── architect.md          # 아키텍처 설계 ✨
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
│   ├── database/             # DB 설계/최적화 ✨
│   ├── devops/               # CI/CD, 배포 ✨
│   ├── ai-ml/                # AI/ML 통합 ✨
│   ├── microservices/        # 마이크로서비스 ✨
│   ├── cloud/                # 클라우드 서비스 ✨
│   ├── accessibility/        # 웹 접근성 ✨
│   └── i18n/                 # 국제화 ✨
│
├── commands/                 # 슬래시 명령어 (15개)
│   ├── plan.md
│   ├── implement.md
│   ├── review.md
│   ├── test.md
│   ├── debug.md
│   ├── document.md
│   ├── security.md
│   ├── commit-msg.md
│   ├── pr-desc.md
│   ├── refactor.md           # 리팩토링 ✨
│   ├── optimize.md           # 성능 최적화 ✨
│   ├── migrate.md            # 마이그레이션 ✨
│   ├── analyze.md            # 코드 분석 ✨
│   ├── architect.md          # 아키텍처 설계 ✨
│   └── deploy.md             # 배포 설정 ✨
│
├── hooks/                    # 자동화 스크립트 (9개)
│   ├── pre-edit-validator.py
│   ├── post-edit-formatter.py
│   ├── security-scanner.py
│   ├── command-logger.py
│   ├── dependency-checker.py # 의존성 취약점 ✨
│   ├── test-runner.py        # 자동 테스트 ✨
│   ├── lint-checker.py       # 린트 검사 ✨
│   ├── code-complexity.py    # 복잡도 분석 ✨
│   └── commit-validator.py   # 커밋 메시지 검증 ✨
│
├── rules/                    # 경로별 규칙
│   ├── frontend.md
│   ├── backend.md
│   ├── tests.md
│   └── security.md
│
├── settings.json             # 권한 및 훅 설정
└── mcp.json                  # MCP 서버 설정

CLAUDE.md                     # 프로젝트 컨텍스트
```

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

### MCP 서버 설정 (자동)

```bash
# 대화형 MCP 설정 (권장)
/setup mcp

# 또는 직접 스크립트 실행
python .claude/scripts/setup-mcp.py

# 환경 체크
python .claude/scripts/check-environment.py
```

### 사용 가능한 MCP 서버

| MCP | 설명 | 필요 환경변수 |
|-----|------|--------------|
| github | GitHub 연동 | GITHUB_TOKEN |
| postgres | PostgreSQL | DATABASE_URL |
| sqlite | SQLite | - |
| puppeteer | 브라우저 자동화 | - |
| fetch | HTTP 요청 | - |
| memory | 영구 메모리 | - |
| sequential-thinking | 순차적 사고 | - |

### MCP 서버 수동 추가

```bash
# GitHub 연결
claude mcp add github -- npx -y @anthropic/mcp-server-github

# PostgreSQL 연결
claude mcp add postgres \
  --env DATABASE_URL=postgresql://... \
  -- npx -y @anthropic/mcp-postgres-server
```

## 요구사항

- Claude Code CLI
- Python 3.8+ (훅 실행용)
- Node.js 18+ (npx 포맷터용, 선택)

## 라이선스

MIT
