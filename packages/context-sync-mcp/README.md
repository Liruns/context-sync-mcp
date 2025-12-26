# Context Sync MCP

AI 에이전트 간 컨텍스트 자동 동기화 MCP 서버

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)

**[English](README.en.md)** | **[한국어](README.ko.md)**

---

Cursor, Claude Code, Windsurf 등 여러 AI 코딩 도구에서 작업 컨텍스트를 seamless하게 공유합니다.

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
    "autoLoad": true,   // 세션 시작 시 자동 로드
    "autoSave": true,   // 변경 시 자동 저장
    "autoSync": false   // 자동 동기화 시작
  }
}
```

## 사용 가능한 도구 (21개)

| 카테고리 | 도구 | 설명 |
|---------|------|------|
| 자연어 | `ctx` | 자연어 명령 (저장/로드/상태/요약) |
| 자동화 | `session_start` | 세션 시작 (자동 로드 지원) |
| 자동화 | `automation_config` | 자동화 설정 관리 |
| 컨텍스트 | `context_save` | 작업 컨텍스트 저장 |
| 컨텍스트 | `context_load` | 컨텍스트 로드 |
| 컨텍스트 | `context_query` | 특정 정보 조회 |
| 컨텍스트 | `context_summarize` | 컨텍스트 요약 (토큰 절약) |
| 기록 | `decision_log` | 의사결정 기록 |
| 기록 | `attempt_log` | 시도 기록 |
| 기록 | `blocker_add` | 블로커 추가 |
| 기록 | `blocker_resolve` | 블로커 해결 |
| 인수인계 | `handoff` | AI 에이전트 인수인계 |
| 스냅샷 | `snapshot_create` | 스냅샷 생성 |
| 스냅샷 | `snapshot_list` | 스냅샷 목록 |
| 동기화 | `sync_start` | 자동 동기화 시작 |
| 동기화 | `sync_stop` | 자동 동기화 중지 |
| 동기화 | `sync_status` | 동기화 상태 조회 |
| 고급 | `context_diff` | 스냅샷 간 변경사항 비교 |
| 고급 | `context_merge` | 스냅샷 병합 |
| 고급 | `context_search` | 컨텍스트 내 검색 |
| 고급 | `metrics_report` | 성능 메트릭 리포트 |

## 저장 위치

```
.context-sync/
├── config.json      # 설정 (자동화 포함)
├── current.json     # 현재 컨텍스트
└── snapshots/       # 스냅샷들
```

## 문서

자세한 내용은 언어별 README를 참조하세요:

- [English Documentation](README.en.md)
- [한국어 문서](README.ko.md)

## 라이선스

[MIT License](LICENSE)

## 링크

- [MCP 프로토콜](https://modelcontextprotocol.io/)
- [GitHub](https://github.com/Liruns/context-sync-mcp)
