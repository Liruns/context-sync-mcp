# Context Sync MCP

AI 에이전트 간 컨텍스트 자동 동기화 MCP 서버

Cursor, Claude Code, Windsurf 등 여러 AI 코딩 도구에서 작업 컨텍스트를 seamless하게 공유합니다.

## 특징

- **자동 컨텍스트 동기화**: 도구 전환 시 작업 내용 자동 인수인계
- **의사결정 기록**: 왜 특정 방식을 선택했는지 기록
- **실패 기록**: 시도했지만 실패한 접근법 공유
- **블로커 추적**: 막힌 부분과 해결 방법 기록
- **스냅샷**: 특정 시점으로 롤백 가능

## 설치

```bash
npm install @anthropic/context-sync-mcp
```

## Claude Code 설정

`.claude/mcp.json`에 추가:

```json
{
  "mcpServers": {
    "context-sync": {
      "command": "npx",
      "args": ["@anthropic/context-sync-mcp"]
    }
  }
}
```

## 사용 가능한 도구

### 컨텍스트 관리

| 도구 | 설명 |
|------|------|
| `context_save` | 현재 작업 컨텍스트 저장 |
| `context_load` | 이전 작업 컨텍스트 로드 |
| `context_query` | 특정 정보 조회 |

### 기록

| 도구 | 설명 |
|------|------|
| `decision_log` | 의사결정 기록 |
| `attempt_log` | 시도한 접근법 기록 |
| `blocker_add` | 막힌 부분 추가 |
| `blocker_resolve` | 막힌 부분 해결 |

### 인수인계

| 도구 | 설명 |
|------|------|
| `handoff` | 다른 AI 에이전트로 인수인계 |
| `snapshot_create` | 스냅샷 생성 |
| `snapshot_list` | 스냅샷 목록 조회 |

## 사용 예시

### 작업 시작

```
context_save로 "로그인 기능 구현" 목표 저장해줘
```

### 결정 기록

```
decision_log로 "JWT 방식 사용" 결정 기록해줘. 이유는 "세션보다 stateless해서"
```

### 다른 도구로 전환

```
handoff로 Windsurf에게 인수인계해줘. 요약: "JWT 로그인 기본 구현 완료, 리프레시 토큰 로직 필요"
```

### Windsurf에서 이어받기

```
context_load로 이전 작업 내용 불러와줘
```

## 저장 위치

컨텍스트는 프로젝트 루트의 `.context-sync/` 폴더에 저장됩니다:

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

# 개발 모드
npm run dev
```

## 라이선스

MIT
