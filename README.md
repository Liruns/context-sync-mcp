# @liruns/context-sync-mcp

[![npm version](https://badge.fury.io/js/@liruns%2Fcontext-sync-mcp.svg)](https://www.npmjs.com/package/@liruns/context-sync-mcp)
[![CI](https://github.com/Liruns/context-sync-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/Liruns/context-sync-mcp/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**AI 에이전트 간 컨텍스트 자동 동기화 MCP 서버**

Claude Code, Cursor, Windsurf, Copilot 등 여러 AI 에디터 간에 작업 컨텍스트를 자동으로 공유합니다.

[English](./packages/context-sync-mcp/README.en.md) | [한국어](./packages/context-sync-mcp/README.ko.md)

---

## 왜 필요한가?

AI 코딩 도구를 사용하다 보면 이런 문제가 있습니다:

- **컨텍스트 유실**: Cursor에서 작업하다 Claude Code로 전환하면 이전 맥락이 사라짐
- **의사결정 망각**: "왜 이 방식을 선택했지?" 기억이 안 남
- **같은 실수 반복**: 이미 실패한 접근법을 다시 시도
- **인수인계 어려움**: 다른 AI에게 작업을 넘길 때 설명이 번거로움

**Context Sync MCP**가 이 문제를 해결합니다.

---

## 설치

### NPM (권장)

```bash
npm install -g @liruns/context-sync-mcp
```

### 소스에서 빌드

```bash
git clone https://github.com/Liruns/context-sync-mcp.git
cd context-sync-mcp/packages/context-sync-mcp
npm install && npm run build
```

---

## MCP 설정

### Claude Code

```bash
claude mcp add context-sync -- npx @liruns/context-sync-mcp
```

### 수동 설정

`~/.claude/mcp.json` 또는 프로젝트의 `.claude/mcp.json`:

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

## 사용법

### 기본 워크플로우

```
# 1. 작업 시작 - 목표 저장
> context_save로 "사용자 인증 기능 구현" 목표 저장해줘

# 2. 의사결정 기록
> decision_log로 "JWT 사용" 결정 기록해줘. 이유는 "stateless하고 확장성 좋음"

# 3. 실패한 시도 기록 (다른 AI가 같은 실수 안 하도록)
> attempt_log로 "세션 기반 인증" 실패 기록해줘. 이유는 "Redis 설정 복잡"

# 4. 막힌 부분 기록
> blocker_add로 "CORS 이슈" 기록해줘

# 5. 다른 AI로 인수인계
> handoff로 Cursor에게 "로그인 UI 구현" 인수인계해줘
```

### 다른 AI에서 작업 이어받기

```
# 이전 컨텍스트 로드
> context_load로 이전 작업 내용 보여줘

# 요약만 보기 (토큰 절약)
> context_summarize로 마크다운 형식으로 요약해줘
```

### 자동 동기화

```
# 자동 동기화 시작 (에디터 전환, 파일 저장, Git 커밋 시 자동 저장)
> sync_start

# 상태 확인
> sync_status

# 중지
> sync_stop
```

---

## 사용 가능한 도구 (14개)

### 컨텍스트 관리

| 도구 | 설명 |
|------|------|
| `context_save` | 작업 컨텍스트 저장 (목표, 상태, 다음 단계) |
| `context_load` | 이전 컨텍스트 로드 |
| `context_query` | 특정 정보 조회 (결정, 블로커, 접근법 등) |
| `context_summarize` | 컨텍스트 요약 (토큰 절약, 압축 레벨 선택) |

### 기록 및 추적

| 도구 | 설명 |
|------|------|
| `decision_log` | 의사결정 기록 (무엇을, 왜) |
| `attempt_log` | 시도한 접근법 기록 (성공/실패/부분 성공) |
| `blocker_add` | 막힌 부분 기록 |
| `blocker_resolve` | 블로커 해결 표시 |
| `handoff` | 다른 AI 에이전트로 인수인계 |

### 스냅샷

| 도구 | 설명 |
|------|------|
| `snapshot_create` | 현재 상태 스냅샷 생성 |
| `snapshot_list` | 스냅샷 목록 조회 |

### 자동 동기화

| 도구 | 설명 |
|------|------|
| `sync_start` | 자동 동기화 시작 (에디터 전환, 파일 저장, Git 커밋 감지) |
| `sync_stop` | 자동 동기화 중지 |
| `sync_status` | 동기화 상태 조회 |

---

## 데이터 저장

컨텍스트는 프로젝트 루트의 `.context-sync/` 폴더에 저장됩니다:

```
<project>/.context-sync/
├── current.json      # 현재 컨텍스트
├── config.json       # 설정
└── snapshots/        # 스냅샷 백업
    ├── snapshot-xxx.json
    └── ...
```

> `.gitignore`에 `.context-sync/`를 추가하는 것을 권장합니다.

---

## 지원 플랫폼

| AI 에디터 | 지원 |
|----------|------|
| Claude Code | ✅ |
| Cursor | ✅ |
| Windsurf | ✅ |
| GitHub Copilot | ✅ |

| OS | 지원 |
|----|------|
| Windows | ✅ |
| macOS | ✅ |
| Linux | ✅ |

---

## 요구사항

- Node.js 18+
- MCP 지원 AI 에디터

---

## 개발

```bash
# 설치
cd packages/context-sync-mcp
npm install

# 빌드
npm run build

# 테스트
npm test

# 개발 모드 (watch)
npm run dev
```

---

## 라이선스

MIT

---

## 링크

- [NPM](https://www.npmjs.com/package/@liruns/context-sync-mcp)
- [GitHub](https://github.com/Liruns/context-sync-mcp)
- [이슈](https://github.com/Liruns/context-sync-mcp/issues)
