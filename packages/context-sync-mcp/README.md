# Context Sync MCP v3.0.0

AI 에이전트 간 컨텍스트 자동 동기화 MCP 서버

[![npm version](https://badge.fury.io/js/@liruns%2Fcontext-sync-mcp.svg)](https://www.npmjs.com/package/@liruns/context-sync-mcp)
[![npm downloads](https://img.shields.io/npm/dm/@liruns/context-sync-mcp.svg)](https://www.npmjs.com/package/@liruns/context-sync-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![MCP](https://img.shields.io/badge/MCP-Compatible-purple.svg)](https://modelcontextprotocol.io/)

> **Claude Code, Cursor, Windsurf, Copilot** - 어떤 AI 도구를 쓰든 작업 흐름이 끊기지 않습니다

---

Cursor, Claude Code, Windsurf 등 여러 AI 코딩 도구에서 작업 컨텍스트를 seamless하게 공유합니다.

## 주요 기능

- **컨텍스트 동기화**: 도구 전환 시 작업 내용 자동 인수인계
- **의사결정 기록**: 왜 특정 방식을 선택했는지 기록
- **실패 기록**: 시도했지만 실패한 접근법 공유
- **블로커 관리**: 막힌 부분 추적 및 해결
- **스냅샷 관리**: 컨텍스트 스냅샷 생성/복원
- **아카이브**: 완료된 작업 아카이브
- **정리 도구**: 오래된 데이터 정리
- **인텔리전스**: 검색, 통계, 추천 기능 (v2.5 신규)
- **SQLite 저장**: sql.js 기반 히스토리 추적 및 검색

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

## 사용 가능한 도구 (10개)

> v3.0에서 15개 → 10개로 통합되었습니다. AI가 도구를 선택할 때 혼동을 줄이기 위해 유사 기능을 action 파라미터로 통합했습니다.

### 컨텍스트 관리 (2개)

| 도구 | 설명 |
|------|------|
| `context_save` | 작업 컨텍스트 저장 (목표, 상태, 다음 단계) |
| `context_load` | 이전 컨텍스트 로드 (full/summary/decisions/blockers/next_steps) |

### 기록 및 추적 (3개)

| 도구 | 설명 |
|------|------|
| `decision_log` | 의사결정 기록 (무엇을 & 왜) |
| `attempt_log` | 시도 기록 (success/failed/partial) |
| `handoff` | AI 에이전트 인수인계 |

### 통합 도구 (4개) - v3.0 신규

| 도구 | action | 설명 |
|------|--------|------|
| `snapshot` | `create` | 현재 컨텍스트 스냅샷 생성 |
|  | `restore` | 스냅샷에서 컨텍스트 복원 |
|  | `list` | 저장된 스냅샷 목록 조회 |
| `blocker` | `add` | 블로커 추가 |
|  | `resolve` | 블로커 해결 |
|  | `list` | 블로커 목록 조회 (신규) |
| `context_maintain` | `cleanup` | 오래된 데이터 정리 |
|  | `archive` | 완료된 작업 아카이브 |
| `context_analyze` | `stats` | 작업 통계 조회 |
|  | `recommend` | 유사 해결책 추천 |

### 인텔리전스 도구 (1개)

| 도구 | 설명 |
|------|------|
| `context_search` | 키워드/태그로 과거 컨텍스트 검색 (FTS5) |

## 기본 워크플로우

```
# 1. 작업 시작 - 목표 저장
> context_save goal: "사용자 인증 구현"

# 2. 결정 기록
> decision_log what: "JWT 사용" why: "stateless하고 확장성 좋음"

# 3. 실패한 시도 기록 (다른 AI가 같은 실수 반복 방지)
> attempt_log approach: "세션 기반 인증" result: "failed" reason: "Redis 설정 복잡"

# 4. 블로커 기록 (v3.0 통합 도구)
> blocker action: "add" description: "CORS 이슈로 API 호출 차단됨"

# 5. 다른 AI로 인수인계
> handoff to: "cursor" summary: "로그인 UI 구현 필요"
```

### 스냅샷 관리 (v3.0 통합)

```
# 마일스톤 달성 시 스냅샷 저장
> snapshot action: "create" reason: "milestone" description: "인증 기능 완료"

# 스냅샷 목록 확인
> snapshot action: "list" limit: 5

# 이전 상태로 복원
> snapshot action: "restore" snapshotId: "snap_abc123"
```

### 블로커 관리 (v3.0 통합)

```
# 블로커 추가
> blocker action: "add" description: "CORS 이슈"

# 블로커 목록 조회
> blocker action: "list"

# 블로커 해결
> blocker action: "resolve" blockerId: "blk_123" resolution: "nginx 프록시 설정"
```

### 유지보수 (v3.0 통합)

```
# 30일 이상 된 데이터 정리 (미리보기)
> context_maintain action: "cleanup" olderThan: "30d" dryRun: true

# 실제 정리 실행
> context_maintain action: "cleanup" olderThan: "30d" dryRun: false

# 완료된 작업 아카이브
> context_maintain action: "archive" completedOnly: true
```

### 분석 (v3.0 통합)

```
# 작업 통계 조회
> context_analyze action: "stats" range: "last_30_days"

# 현재 목표와 유사한 과거 해결책 추천
> context_analyze action: "recommend" limit: 5
```

### 검색

```
# 과거 작업 검색
> context_search query: "인증" tags: ["security"] status: "completed"
```

### 다른 AI에서 작업 재개

```
# 이전 컨텍스트 로드
> context_load

# 요약만 보기 (토큰 절약)
> context_load format: "summary"
```

## 저장 위치

```
.context-sync/
├── config.json      # 설정
├── context.db       # SQLite DB (히스토리, 검색)
├── archives/        # 아카이브된 컨텍스트
└── snapshots/       # 스냅샷들
```

## 지원 플랫폼

| AI 에디터 | 지원 |
|-----------|------|
| Claude Code | O |
| Cursor | O |
| Windsurf | O |
| GitHub Copilot | O |

| OS | 지원 |
|----|------|
| Windows | O |
| macOS | O |
| Linux | O |

## 개발

```bash
# 설치
npm install

# 빌드
npm run build

# 테스트
npm test

# 개발 모드 (watch)
npm run dev
```

## 변경 이력

### v3.0.0 (2024-12) - Breaking Changes
- **도구 통합**: 15개 → 10개로 축소 (AI 혼동 감소)
- 새 통합 도구:
  - `snapshot` (action: create/restore/list) - 기존 snapshot_create, snapshot_restore, snapshot_list 대체
  - `blocker` (action: add/resolve/list) - 기존 blocker_add, blocker_resolve 대체 + list 기능 추가
  - `context_maintain` (action: cleanup/archive) - 기존 context_cleanup, context_archive 대체
  - `context_analyze` (action: stats/recommend) - 기존 context_stats, context_recommend 대체
- **제거된 도구** (Breaking):
  - `snapshot_create`, `snapshot_restore`, `snapshot_list` → `snapshot` 사용
  - `blocker_add`, `blocker_resolve` → `blocker` 사용
  - `context_cleanup`, `context_archive` → `context_maintain` 사용
  - `context_stats`, `context_recommend` → `context_analyze` 사용

### v2.5.0 (2024-12)
- 인텔리전스 도구 추가
  - `context_search`: FTS5 기반 컨텍스트 검색
  - `context_stats`: 작업 통계 조회
  - `context_recommend`: 유사 해결책 추천
- 도구 총 15개로 확장

### v2.3.0
- 유지보수 도구 추가 (Phase 1)
  - `context_cleanup`: 오래된 데이터 정리
  - `context_archive`: 완료된 작업 아카이브
  - `snapshot_create/restore/list`: 스냅샷 관리
- 도구 총 12개로 확장

### v2.2.0
- SQLite 저장소 안정화
- 성능 개선

### v2.0.0
- SQLite 기반 저장소 도입
- 히스토리 추적 기능

## 라이선스

[MIT License](LICENSE)

## 링크

- [NPM](https://www.npmjs.com/package/@liruns/context-sync-mcp)
- [GitHub](https://github.com/Liruns/context-sync-mcp)
- [MCP 프로토콜](https://modelcontextprotocol.io/)
