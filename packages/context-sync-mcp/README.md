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
- **의사결정 기록**: 왜 특정 방식을 선택했는지 기록
- **실패 기록**: 시도했지만 실패한 접근법 공유
- **블로커 추적**: 막힌 부분과 해결 방법 기록
- **스냅샷**: 특정 시점으로 롤백 가능

## 빠른 시작

### 설치

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

## 사용 가능한 도구

| 카테고리 | 도구 | 설명 |
|---------|------|------|
| 컨텍스트 | `context_save` | 작업 컨텍스트 저장 |
| 컨텍스트 | `context_load` | 컨텍스트 로드 |
| 컨텍스트 | `context_query` | 특정 정보 조회 |
| 기록 | `decision_log` | 의사결정 기록 |
| 기록 | `attempt_log` | 시도 기록 |
| 기록 | `blocker_add` | 블로커 추가 |
| 기록 | `blocker_resolve` | 블로커 해결 |
| 인수인계 | `handoff` | AI 에이전트 인수인계 |
| 스냅샷 | `snapshot_create` | 스냅샷 생성 |
| 스냅샷 | `snapshot_list` | 스냅샷 목록 |

## 사용 예시

```bash
# 작업 시작
context_save로 "로그인 기능 구현" 목표 저장해줘

# 결정 기록
decision_log로 "JWT 방식 사용" 결정 기록해줘. 이유는 "세션보다 stateless해서"

# 다른 도구로 인수인계
handoff로 Cursor에게 인수인계해줘. 요약: "JWT 로그인 구현 완료"

# 다른 도구에서 이어받기
context_load로 이전 작업 내용 불러와줘
```

## 저장 위치

```
.context-sync/
├── config.json      # 설정
├── current.json     # 현재 컨텍스트
└── snapshots/       # 스냅샷들
```

## 개발

```bash
# 의존성 설치
npm install

# 빌드
npm run build

# 테스트
npm test

# 개발 모드
npm run dev
```

## 문서

자세한 내용은 언어별 README를 참조하세요:

- [English Documentation](README.en.md)
- [한국어 문서](README.ko.md)

## 라이선스

[MIT License](LICENSE)

## 기여

버그 리포트, 기능 요청, PR을 환영합니다!

## 링크

- [MCP 프로토콜](https://modelcontextprotocol.io/)
- [GitHub](https://github.com/Liruns/context-sync-mcp)
