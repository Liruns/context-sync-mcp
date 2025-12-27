# Context Sync MCP v2.2.0

AI 에이전트 간 컨텍스트 자동 동기화 MCP 서버

[![npm version](https://badge.fury.io/js/@liruns%2Fcontext-sync-mcp.svg)](https://www.npmjs.com/package/@liruns/context-sync-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)

---

Cursor, Claude Code, Windsurf 등 여러 AI 코딩 도구에서 작업 컨텍스트를 seamless하게 공유합니다.

## 주요 기능

- **컨텍스트 동기화**: 도구 전환 시 작업 내용 자동 인수인계
- **의사결정 기록**: 왜 특정 방식을 선택했는지 기록
- **실패 기록**: 시도했지만 실패한 접근법 공유
- **블로커 관리**: 막힌 부분 추적 및 해결
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

## 사용 가능한 도구 (7개)

### 컨텍스트 관리

| 도구 | 설명 |
|------|------|
| `context_save` | 작업 컨텍스트 저장 (목표, 상태, 다음 단계) |
| `context_load` | 이전 컨텍스트 로드 (full/summary/decisions/blockers/next_steps) |

### 기록 및 추적

| 도구 | 설명 |
|------|------|
| `decision_log` | 의사결정 기록 (무엇을 & 왜) |
| `attempt_log` | 시도 기록 (success/failed/partial) |
| `blocker_add` | 블로커 추가 |
| `blocker_resolve` | 블로커 해결 |
| `handoff` | AI 에이전트 인수인계 |

## 기본 워크플로우

```
# 1. 작업 시작 - 목표 저장
> context_save goal: "사용자 인증 구현"

# 2. 결정 기록
> decision_log what: "JWT 사용" why: "stateless하고 확장성 좋음"

# 3. 실패한 시도 기록 (다른 AI가 같은 실수 반복 방지)
> attempt_log approach: "세션 기반 인증" result: "failed" reason: "Redis 설정 복잡"

# 4. 블로커 기록
> blocker_add description: "CORS 이슈로 API 호출 차단됨"

# 5. 다른 AI로 인수인계
> handoff to: "cursor" summary: "로그인 UI 구현 필요"
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
└── snapshots/       # 스냅샷들
```

## 지원 플랫폼

| AI 에디터 | 지원 |
|-----------|------|
| Claude Code | ✅ |
| Cursor | ✅ |
| Windsurf | ✅ |
| GitHub Copilot | ✅ |

| OS | 지원 |
|----|------|
| Windows | ✅ |
| macOS | ✅ |
| Linux | ✅ |

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

## 라이선스

[MIT License](LICENSE)

## 링크

- [NPM](https://www.npmjs.com/package/@liruns/context-sync-mcp)
- [GitHub](https://github.com/Liruns/context-sync-mcp)
- [MCP 프로토콜](https://modelcontextprotocol.io/)
