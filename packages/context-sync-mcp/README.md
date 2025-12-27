# Context Sync MCP v2.0

AI 에이전트 간 컨텍스트 자동 동기화 MCP 서버

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![Version](https://img.shields.io/badge/Version-2.0.0-blue.svg)](https://github.com/Liruns/context-sync-mcp)

**[English](README.en.md)** | **[한국어](README.ko.md)**

---

Cursor, Claude Code, Windsurf 등 여러 AI 코딩 도구에서 작업 컨텍스트를 seamless하게 공유합니다.

## v2.0 주요 변경사항

- **SQLite 하이브리드 저장**: JSON + SQLite(sql.js) 이중 저장으로 히스토리 추적 및 검색 가능
- **토큰 효율적 응답**: 2단계 응답 패턴으로 90% 토큰 절감 (힌트 → 상세)
- **FTS5 전문검색**: SQLite 전문검색으로 빠른 컨텍스트 검색
- **세션 연결**: 관련 작업들의 연속성 추적 (parentId)
- **실패 패턴 경고**: 이전 실패 기록 자동 경고
- **프로젝트 간 검색**: 전역 DB로 다른 프로젝트 컨텍스트 검색

## 주요 기능

- **컨텍스트 동기화**: 도구 전환 시 작업 내용 자동 인수인계
- **자연어 명령**: "저장해줘", "불러와" 같은 자연어로 사용
- **자동 저장/로드**: 세션 시작 시 자동 로드, 변경 시 자동 저장
- **의사결정 기록**: 왜 특정 방식을 선택했는지 기록
- **실패 기록**: 시도했지만 실패한 접근법 공유
- **스냅샷**: 특정 시점으로 롤백 가능
- **Diff/Merge**: 스냅샷 간 변경사항 비교 및 병합
- **검색**: 결정, 접근법, 블로커 등 전문 검색
- **메트릭**: 동기화 성능 및 작업 통계 추적
- **아카이브**: 오래된 컨텍스트 아카이브 및 복원

## 빠른 시작

### 설치

```bash
npm install @liruns/context-sync-mcp
```

### MCP 설정

`.claude/mcp.json` 또는 해당 도구의 MCP 설정 파일에 추가:

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

## 자연어로 사용하기

```
"저장해줘" → 컨텍스트 저장
"불러와" / "이전 작업" → 컨텍스트 로드
"상태" / "어디까지 했어" → 현재 상태 조회
"요약해줘" → 컨텍스트 요약
"자동저장 켜줘" → 자동 동기화 시작
"자동저장 꺼줘" → 자동 동기화 중지
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

## 사용 가능한 도구 (25개)

### 자연어 및 자동화

| 도구 | 설명 |
|------|------|
| `ctx` | 자연어 명령 (저장/로드/상태/요약) |
| `session_start` | 세션 시작 (자동 로드 지원) |
| `automation_config` | 자동화 설정 관리 |

### 컨텍스트 관리 (v2.0 핵심)

| 도구 | 설명 | 예상 토큰 |
|------|------|-----------|
| `context_save` | 작업 컨텍스트 저장 | ~50 |
| `context_search` | 힌트 기반 검색 (토큰 효율적) | ~200 |
| `context_get` | 상세 컨텍스트 조회 | ~500 |
| `context_warn` | 세션 시작 시 경고/추천 | ~100 |
| `context_load` | 컨텍스트 로드 (레거시) | - |
| `context_query` | 특정 정보 조회 (레거시) | - |
| `context_summarize` | 컨텍스트 요약 | - |

### 기록 및 추적

| 도구 | 설명 |
|------|------|
| `decision_log` | 의사결정 기록 |
| `attempt_log` | 시도 기록 |
| `blocker_add` | 블로커 추가 |
| `blocker_resolve` | 블로커 해결 |
| `handoff` | AI 에이전트 인수인계 |

### 스냅샷

| 도구 | 설명 |
|------|------|
| `snapshot_create` | 스냅샷 생성 |
| `snapshot_list` | 스냅샷 목록 |

### 동기화

| 도구 | 설명 |
|------|------|
| `sync_start` | 자동 동기화 시작 |
| `sync_stop` | 자동 동기화 중지 |
| `sync_status` | 동기화 상태 조회 |

### 고급 (v2.0+)

| 도구 | 설명 | 버전 |
|------|------|------|
| `context_diff` | 스냅샷 간 변경사항 비교 | - |
| `context_merge` | 스냅샷 병합 | - |
| `context_stats` | 세션 통계 조회 | v2.1 |
| `context_export` | 마크다운/JSON/HTML 내보내기 | v2.1 |
| `context_recommend` | 관련 세션 추천 | v2.1 |
| `context_archive` | 아카이브 관리 | v2.2 |
| `metrics_report` | 성능 메트릭 리포트 | - |

## 토큰 효율적 사용 패턴

v2.0은 2단계 응답 패턴을 사용하여 토큰을 90% 절감합니다:

```
1단계: 힌트 (~100-200 토큰)
─────────────────────────
context_search({ query: "인증" })
→ { hints: [{ id, goal, date, hasWarnings }], total: 5 }
"5개 발견. 상세: context_get(id)"

       ↓ 필요시

2단계: 상세 (~300-500 토큰)
─────────────────────────
context_get({ id: "ctx_abc" })
→ { context: { goal, summary, metadata }, actions }
```

### 권장 세션 흐름

```
1. 세션 시작: context_warn → ~100 토큰
2. 필요시 검색: context_search → ~200 토큰
3. 상세 필요시: context_get → ~500 토큰
4. 세션 종료: context_save → ~50 토큰
─────────────────────────────────────
총 예상: 300-850 토큰 (기존 대비 90% 절감)
```

## 저장 위치

```
.context-sync/
├── config.json      # 설정 (자동화 포함)
├── current.json     # 현재 컨텍스트 (Git 추적 가능)
├── history.db       # SQLite DB (히스토리, 검색)
└── snapshots/       # 스냅샷들

~/.context-sync/
└── global.db        # 전역 DB (프로젝트 간 검색)
```

## 기술 스택

- **sql.js**: WebAssembly 기반 SQLite (네이티브 컴파일 불필요)
- **FTS5**: 전문검색 지원
- **MCP SDK**: Model Context Protocol
- **TypeScript**: 타입 안전성

## 문서

자세한 내용은 언어별 README를 참조하세요:

- [English Documentation](README.en.md)
- [한국어 문서](README.ko.md)
- [v2.0 구현 계획](docs/v2.0-plan.md)

## 라이선스

[MIT License](LICENSE)

## 링크

- [MCP 프로토콜](https://modelcontextprotocol.io/)
- [GitHub](https://github.com/Liruns/context-sync-mcp)
