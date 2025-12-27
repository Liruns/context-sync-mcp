# Context Sync MCP v2.0

AI 에이전트 간 컨텍스트 자동 동기화 MCP 서버

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![Version](https://img.shields.io/badge/Version-2.0.0-blue.svg)](https://github.com/Liruns/context-sync-mcp)

## 개요

Context Sync MCP는 Cursor, Claude Code, Windsurf 등 여러 AI 코딩 도구에서 작업 컨텍스트를 seamless하게 공유할 수 있는 MCP(Model Context Protocol) 서버입니다.

### 왜 필요한가요?

- **에이전트 전환 시 컨텍스트 손실 방지**: Claude Code에서 Cursor로 전환해도 작업 내용 유지
- **자연어 명령**: "저장해줘", "불러와" 같은 자연스러운 표현으로 사용
- **자동 저장/로드**: 세션 시작 시 자동으로 이전 작업 로드
- **의사결정 기록**: 왜 특정 방식을 선택했는지 다른 AI도 이해 가능
- **실패 기록**: 시도했지만 실패한 접근법 공유로 같은 실수 반복 방지
- **작업 연속성**: 스냅샷으로 특정 시점 상태 복원 가능

## v2.0 주요 변경사항

- **SQLite 하이브리드 저장**: JSON + SQLite(sql.js) 이중 저장으로 히스토리 추적 및 검색 가능
- **토큰 효율적 응답**: 2단계 응답 패턴으로 90% 토큰 절감 (힌트 → 상세)
- **FTS5 전문검색**: SQLite 전문검색으로 빠른 컨텍스트 검색
- **세션 연결**: 관련 작업들의 연속성 추적 (parentId)
- **실패 패턴 경고**: 이전 실패 기록 자동 경고
- **프로젝트 간 검색**: 전역 DB로 다른 프로젝트 컨텍스트 검색
- **아카이브 시스템**: 오래된 컨텍스트 아카이브 및 복원

## 주요 기능

| 기능 | 설명 |
|------|------|
| 자연어 명령 | "저장", "로드", "상태" 같은 자연어로 사용 |
| 자동 저장/로드 | 세션 시작 시 자동 로드, 변경 시 자동 저장 설정 |
| 컨텍스트 저장/로드 | 작업 목표, 상태, 다음 단계 관리 |
| 의사결정 기록 | 결정 내용과 이유 기록 |
| 접근법 기록 | 성공/실패한 시도 기록 |
| 블로커 관리 | 막힌 부분과 해결 방법 추적 |
| 에이전트 인수인계 | AI 간 seamless 핸드오프 |
| 스냅샷 | 특정 시점 상태 저장 및 복원 |
| 자동 동기화 | 파일 저장, 에디터 전환, Git 커밋 시 자동 동기화 |
| Diff/Merge | 스냅샷 간 변경사항 비교 및 병합 |
| 전문검색 | FTS5 기반 컨텍스트 검색 |
| 메트릭 | 동기화 성능 및 작업 통계 추적 |
| 아카이브 | 오래된 컨텍스트 아카이브 관리 |

## 설치

### npm 설치 (권장)

```bash
npm install @liruns/context-sync-mcp
```

### 소스에서 빌드

```bash
git clone https://github.com/Liruns/context-sync-mcp.git
cd context-sync-mcp/packages/context-sync-mcp
npm install
npm run build
```

## 설정

### Claude Code

`.claude/mcp.json` 파일에 추가:

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

### Cursor

`.cursor/mcp.json` 파일에 추가:

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

### Windsurf

Windsurf 설정에서 MCP 서버 추가:

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

## 사용법

### 자연어 명령

`ctx` 도구로 자연어 명령 사용:

```
"저장" / "save" / "저장해줘"  → 컨텍스트 저장
"로드" / "불러와" / "이전 작업" → 컨텍스트 로드
"상태" / "어디까지 했어"       → 현재 상태 조회
"요약" / "정리해줘"           → 컨텍스트 요약
"자동저장 켜줘" / "auto on"   → 자동 동기화 시작
"자동저장 꺼줘" / "auto off"  → 자동 동기화 중지
```

### v2.0 권장 워크플로우 (토큰 효율적)

```
1. 세션 시작 시 경고 확인
   > context_warn currentGoal: "로그인 기능 구현"
   → ~100 토큰 (이전 실패 기록, 관련 세션 추천)

2. 필요시 검색 (힌트만 반환)
   > context_search query: "인증"
   → ~200 토큰 ({ hints: [{ id, goal, date, hasWarnings }] })

3. 상세 필요시 조회
   > context_get id: "ctx_abc123"
   → ~500 토큰 (전체 정보)

4. 세션 종료 시 저장
   > context_save goal: "로그인 기능 구현", summary: "JWT 인증 완료"
   → ~50 토큰
```

### 기본 워크플로우

```
1. 작업 시작
   > context_save goal: "로그인 기능 구현"

2. 결정 기록
   > decision_log what: "JWT 방식 사용" why: "세션보다 stateless해서"

3. 시도 기록
   > attempt_log approach: "passport.js 사용" result: "failed" reason: "과도한 복잡도"

4. 막힌 부분 기록
   > blocker_add description: "리프레시 토큰 저장 위치 미정"

5. 다른 도구로 인수인계
   > handoff to: "cursor" summary: "JWT 로그인 구현 완료, 리프레시 토큰 로직 필요"

6. 다른 도구에서 이어받기
   > context_load
```

### 자동 동기화

```
# 자동 동기화 시작 (파일 저장, 에디터 전환, Git 커밋 시 자동 저장)
> sync_start

# 상태 확인
> sync_status

# 중지
> sync_stop
```

## 자동화 설정

`.context-sync/config.json`에서 설정:

```json
{
  "automation": {
    "autoLoad": true,
    "autoSave": true,
    "autoSync": false
  }
}
```

`automation_config` 도구로 조회/변경:

```
> automation_config autoLoad: true, autoSync: true
```

## 사용 가능한 도구 (25개)

### 자연어 & 자동화

| 도구 | 설명 | 필수 파라미터 |
|------|------|--------------|
| `ctx` | 자연어 명령 | `command` |
| `session_start` | 세션 시작 (자동 로드 지원) | - |
| `automation_config` | 자동화 설정 관리 | - |

### 컨텍스트 관리 (v2.0 핵심)

| 도구 | 설명 | 예상 토큰 |
|------|------|-----------|
| `context_save` | 컨텍스트 저장 | ~50 |
| `context_search` | 힌트 기반 검색 (토큰 효율적) | ~200 |
| `context_get` | 상세 컨텍스트 조회 | ~500 |
| `context_warn` | 세션 시작 시 경고/추천 | ~100 |
| `context_load` | 컨텍스트 로드 (레거시) | - |
| `context_query` | 특정 정보 조회 (레거시) | - |
| `context_summarize` | 컨텍스트 요약 | - |

### 기록

| 도구 | 설명 | 필수 파라미터 |
|------|------|--------------|
| `decision_log` | 의사결정 기록 | `what`, `why` |
| `attempt_log` | 시도 기록 | `approach`, `result` |
| `blocker_add` | 블로커 추가 | `description` |
| `blocker_resolve` | 블로커 해결 | `blockerId`, `resolution` |

### 인수인계 & 스냅샷

| 도구 | 설명 | 필수 파라미터 |
|------|------|--------------|
| `handoff` | AI 에이전트 인수인계 | `to`, `summary` |
| `snapshot_create` | 스냅샷 생성 | - |
| `snapshot_list` | 스냅샷 목록 | - |

### 자동 동기화

| 도구 | 설명 | 필수 파라미터 |
|------|------|--------------|
| `sync_start` | 자동 동기화 시작 | - |
| `sync_stop` | 자동 동기화 중지 | - |
| `sync_status` | 동기화 상태 조회 | - |

### 고급 기능 (v2.0+)

| 도구 | 설명 | 버전 |
|------|------|------|
| `context_diff` | 스냅샷 간 변경사항 비교 | - |
| `context_merge` | 스냅샷 병합 | - |
| `context_stats` | 세션 통계 조회 | v2.1 |
| `context_export` | 마크다운/JSON/HTML 내보내기 | v2.1 |
| `context_recommend` | 관련 세션 추천 | v2.1 |
| `context_archive` | 아카이브 관리 (archive/restore/stats/search/list/purge) | v2.2 |
| `metrics_report` | 성능 메트릭 리포트 | - |

## 토큰 효율성

v2.0은 2단계 응답 패턴을 사용하여 토큰을 90% 절감합니다:

| 시나리오 | 기존 | v2.0 | 절감률 |
|----------|------|------|--------|
| 검색 (20개 결과) | ~8,000 | ~400 | 95% |
| 세션 시작 경고 | ~2,000 | ~150 | 92% |
| 상세 조회 1개 | ~800 | ~500 | 37% |
| **일반적 사용** | **~10,000** | **~1,000** | **90%** |

## 저장 위치

컨텍스트는 프로젝트 루트의 `.context-sync/` 폴더에 저장됩니다:

```
.context-sync/
├── config.json      # 설정 (자동화 포함)
├── current.json     # 현재 컨텍스트 (Git 추적 가능)
├── history.db       # SQLite DB (히스토리, 검색)
└── snapshots/       # 스냅샷들

~/.context-sync/
└── global.db        # 전역 DB (프로젝트 간 검색)
```

> `.gitignore`에 `.context-sync/history.db`를 추가하는 것을 권장합니다.

## 개발

### 요구사항

- Node.js 18+
- npm 또는 yarn

### 빌드

```bash
# 의존성 설치
npm install

# 빌드
npm run build

# 개발 모드 (watch)
npm run dev
```

### 테스트

```bash
# 테스트 실행
npm test

# 커버리지 포함
npm run test:coverage
```

### 프로젝트 구조

```
src/
├── index.ts              # MCP 서버 진입점
├── db/
│   ├── index.ts          # DB 초기화 (DatabaseInstance)
│   ├── schema.ts         # 스키마 정의
│   └── global-db.ts      # 전역 DB
├── store/
│   ├── index.ts          # ContextStore (Facade)
│   ├── context-store.ts  # JSON 저장소
│   └── action-store.ts   # 액션 로깅
├── handlers/
│   ├── index.ts          # 핸들러 레지스트리
│   └── *.ts              # 도구별 핸들러
├── tools/
│   └── *.ts              # v2.0 도구 구현
├── services/
│   └── archive-service.ts # 아카이브 서비스
├── sync/
│   └── sync-engine.ts    # 자동 동기화 엔진
├── diff/
│   └── context-diff.ts   # Diff/Merge 엔진
├── search/
│   └── context-search.ts # 검색 엔진
├── metrics/
│   └── metrics-collector.ts # 메트릭 수집기
├── constants/
│   ├── errors.ts         # 에러 메시지
│   ├── limits.ts         # 제한값
│   └── valid-values.ts   # 유효값 상수
├── validators/
│   └── common.ts         # 공통 검증기
├── utils/
│   └── truncate.ts       # 서버 사이드 요약 생성
└── types/
    └── context.ts        # 타입 정의
```

## 기술 스택

- **sql.js**: WebAssembly 기반 SQLite (네이티브 컴파일 불필요)
- **FTS5**: 전문검색 지원
- **MCP SDK**: Model Context Protocol
- **TypeScript**: 타입 안전성
- **Vitest**: 테스트 프레임워크

## 버전 히스토리

### v2.0.0 (현재)
- SQLite 하이브리드 저장 (sql.js)
- 토큰 효율적 2단계 응답 패턴
- FTS5 전문검색
- context_search, context_get, context_warn 도구
- context_stats, context_export, context_recommend 도구 (v2.1)
- context_archive 도구 및 아카이브 시스템 (v2.2)
- 프로젝트 간 검색 (global.db)

### v0.3.0
- Diff/Merge 엔진
- 컨텍스트 검색
- 성능 메트릭

### v0.2.0
- 자연어 명령 (`ctx`)
- 자동화 설정
- 자동 동기화 엔진

## 라이선스

MIT License - 자세한 내용은 [LICENSE](LICENSE) 파일을 참조하세요.

## 기여

버그 리포트, 기능 요청, PR을 환영합니다!

1. Fork
2. Feature branch 생성 (`git checkout -b feature/amazing-feature`)
3. Commit (`git commit -m 'feat: Add amazing feature'`)
4. Push (`git push origin feature/amazing-feature`)
5. Pull Request 생성

## 관련 링크

- [MCP 프로토콜 문서](https://modelcontextprotocol.io/)
- [Claude Code](https://claude.ai/code)
- [GitHub 저장소](https://github.com/Liruns/context-sync-mcp)
- [v2.0 구현 계획](docs/v2.0-plan.md)
