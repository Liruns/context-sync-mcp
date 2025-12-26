# Claude Code Universal Agent Toolkit

범용 Claude Code 에코시스템 - 모든 개발 프로젝트에서 사용 가능한 에이전트, 스킬, 훅, MCP 서버 모음

## 프로젝트 개요

이 툴킷은 Claude Code의 기능을 확장하여 개발 워크플로우를 자동화합니다.

### 주요 구성요소

| 구성요소 | 위치 | 개수 | 설명 |
|---------|------|------|------|
| Agents | `.claude/agents/` | 12개 | 전문화된 AI 에이전트 |
| Skills | `.claude/skills/` | 15개 | 재사용 가능한 지식 |
| Commands | `.claude/commands/` | 15개 | 슬래시 명령어 |
| Hooks | `.claude/hooks/` | 9개 | 자동화 스크립트 |
| Rules | `.claude/rules/` | 4개 | 경로별 규칙 |
| **MCP Servers** | `packages/` | 1개 | 커스텀 MCP 서버 |

## Context Sync MCP (NEW)

AI 에이전트 간 컨텍스트 자동 동기화 MCP 서버

### 핵심 기능
- **컨텍스트 공유**: Cursor, Claude Code, Windsurf 간 작업 내용 자동 인수인계
- **의사결정 기록**: 왜 특정 방식을 선택했는지 기록
- **실패 기록**: 시도했지만 실패한 접근법 공유 (같은 실수 반복 방지)
- **스냅샷**: 특정 시점으로 롤백 가능

### 사용 가능한 도구

| 도구 | 설명 |
|------|------|
| `context_save` | 현재 작업 컨텍스트 저장 |
| `context_load` | 이전 작업 컨텍스트 로드 |
| `decision_log` | 의사결정 기록 |
| `attempt_log` | 시도/실패 기록 |
| `handoff` | 다른 AI 에이전트로 인수인계 |

### 사용 예시
```
# 작업 시작
context_save로 "로그인 기능 구현" 목표 저장해줘

# 결정 기록
decision_log로 "JWT 방식 사용" 결정 기록해줘

# 다른 도구로 인수인계
handoff로 Windsurf에게 인수인계해줘
```

### 설치
```bash
cd packages/context-sync-mcp
npm install && npm run build
```

## 사용 가능한 에이전트

### 핵심 에이전트

| 에이전트 | 역할 | 모델 |
|---------|------|------|
| orchestrator | 멀티-스텝 작업 조율자 | opus |
| planner | 요구사항 분석 및 설계 | sonnet |
| coder | 코드 작성 및 수정 | sonnet |
| reviewer | 코드 리뷰 (품질, 보안, 성능) | sonnet |
| tester | 테스트 작성 및 실행 | sonnet |
| debugger | 버그 분석 및 수정 | sonnet |
| documenter | 문서화 (README, API, 주석) | sonnet |
| security-auditor | 보안 감사 및 취약점 분석 | sonnet |

### 고급 에이전트 (NEW)

| 에이전트 | 역할 | 모델 |
|---------|------|------|
| refactorer | 코드 리팩토링 (구조 개선, 중복 제거) | sonnet |
| optimizer | 성능 최적화 (병목 분석, 캐싱) | sonnet |
| migrator | 마이그레이션/업그레이드 (버전 업, 전환) | sonnet |
| architect | 아키텍처 설계 (시스템 구조, 기술 스택) | opus |

## 사용 가능한 명령어

### 핵심 명령어
```
/plan <작업>        - 구현 계획 수립
/implement <기능>   - 기능 구현 (전체 워크플로우)
/review [경로]      - 코드 리뷰
/test [경로]        - 테스트 작성/실행
/debug <문제>       - 디버깅
/document [대상]    - 문서화
/security [경로]    - 보안 검사
/commit-msg         - 커밋 메시지 생성
/pr-desc            - PR 설명 생성
```

### 고급 명령어 (NEW)
```
/refactor [경로]    - 코드 리팩토링
/optimize [경로]    - 성능 최적화
/migrate [대상]     - 버전 마이그레이션
/analyze [경로]     - 코드 종합 분석
/architect <설명>   - 아키텍처 설계
/deploy [플랫폼]    - 배포 설정 생성
```

## 자동 활성화 스킬

### 기본 스킬

| 스킬 | 트리거 키워드 |
|------|--------------|
| testing | 테스트, test, coverage |
| security-audit | 보안, security, 취약점 |
| code-quality | 리뷰, 리팩토링, 품질 |
| documentation | 문서, README, 주석 |
| performance | 성능, 최적화, 느림 |
| git-workflow | 커밋, PR, merge |
| error-handling | 에러, 예외, catch |
| api-design | API, 엔드포인트, REST |

### 고급 스킬 (NEW)

| 스킬 | 트리거 키워드 |
|------|--------------|
| database | DB, 쿼리, 스키마, 인덱스 |
| devops | CI/CD, 배포, 도커, 쿠버네티스 |
| ai-ml | AI, ML, LLM, 모델 |
| microservices | 마이크로서비스, 분산, 이벤트 |
| cloud | AWS, Azure, GCP, 클라우드 |
| accessibility | 접근성, a11y, 스크린리더 |
| i18n | 다국어, 번역, 국제화 |

## 활성화된 Hooks

### PreToolUse (실행 전)
- **pre-edit-validator**: 보호된 파일 수정 방지, 민감 정보 검사
- **security-scanner**: Write 시 보안 스캔

### PostToolUse (실행 후)
- **post-edit-formatter**: 자동 코드 포맷팅 (Prettier, Black)
- **lint-checker**: ESLint, Pylint 등 린트 검사 (NEW)
- **code-complexity**: 순환 복잡도, 함수 길이 검사 (NEW)
- **test-runner**: 관련 테스트 자동 실행 (NEW)
- **dependency-checker**: 의존성 취약점 검사 (NEW)
- **command-logger**: Bash 명령어 로깅

### Notification
- **commit-validator**: Conventional Commits 형식 검증 (NEW)

## 코딩 가이드라인

### 일반 원칙
- 읽기 쉬운 코드 작성
- 작은 함수, 작은 클래스
- 중복 최소화 (DRY)
- 에러 처리 필수

### 금지 사항
- 하드코딩된 시크릿 (환경 변수 사용)
- console.log 커밋 금지
- any 타입 남용 (TypeScript)
- 테스트 없는 중요 로직

## 프로젝트별 커스터마이징

이 파일을 수정하여 프로젝트에 맞게 조정하세요:

```markdown
## 기술 스택
- Frontend: [React, Vue, etc.]
- Backend: [Node.js, Python, etc.]
- Database: [PostgreSQL, MongoDB, etc.]

## 프로젝트 특화 규칙
- [규칙 1]
- [규칙 2]

## 자주 사용하는 명령어
- `npm start` - 개발 서버
- `npm test` - 테스트 실행
```
