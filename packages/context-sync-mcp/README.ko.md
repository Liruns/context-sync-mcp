# Context Sync MCP

AI 에이전트 간 컨텍스트 자동 동기화 MCP 서버

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)

## 개요

Context Sync MCP는 Cursor, Claude Code, Windsurf 등 여러 AI 코딩 도구에서 작업 컨텍스트를 seamless하게 공유할 수 있는 MCP(Model Context Protocol) 서버입니다.

### 왜 필요한가요?

- **에이전트 전환 시 컨텍스트 손실 방지**: Claude Code에서 Cursor로 전환해도 작업 내용 유지
- **의사결정 기록**: 왜 특정 방식을 선택했는지 다른 AI도 이해 가능
- **실패 기록**: 시도했지만 실패한 접근법 공유로 같은 실수 반복 방지
- **작업 연속성**: 스냅샷으로 특정 시점 상태 복원 가능

## 주요 기능

| 기능 | 설명 |
|------|------|
| 컨텍스트 저장/로드 | 작업 목표, 상태, 다음 단계 관리 |
| 의사결정 기록 | 결정 내용과 이유 기록 |
| 접근법 기록 | 성공/실패한 시도 기록 |
| 블로커 관리 | 막힌 부분과 해결 방법 추적 |
| 에이전트 인수인계 | AI 간 seamless 핸드오프 |
| 스냅샷 | 특정 시점 상태 저장 및 복원 |

## 설치

### npm 설치 (권장)

```bash
npm install @anthropic/context-sync-mcp
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
      "args": ["@anthropic/context-sync-mcp"]
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
      "args": ["@anthropic/context-sync-mcp"]
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
      "args": ["@anthropic/context-sync-mcp"]
    }
  }
}
```

## 사용법

### 기본 워크플로우

```
1. 작업 시작
   > context_save로 "로그인 기능 구현" 목표 저장해줘

2. 결정 기록
   > decision_log로 "JWT 방식 사용" 결정 기록해줘. 이유는 "세션보다 stateless해서"

3. 시도 기록
   > attempt_log로 "passport.js 사용" 시도를 기록해줘. 결과는 failed, 이유는 "과도한 복잡도"

4. 막힌 부분 기록
   > blocker_add로 "리프레시 토큰 저장 위치 미정" 추가해줘

5. 다른 도구로 인수인계
   > handoff로 Cursor에게 인수인계해줘. 요약: "JWT 로그인 구현 완료, 리프레시 토큰 로직 필요"

6. 다른 도구에서 이어받기
   > context_load로 이전 작업 내용 불러와줘
```

### 사용 가능한 도구

#### 컨텍스트 관리

| 도구 | 설명 | 필수 파라미터 |
|------|------|--------------|
| `context_save` | 컨텍스트 저장/업데이트 | `goal` |
| `context_load` | 컨텍스트 로드 | - |
| `context_query` | 특정 정보 조회 | `query` |

#### 기록

| 도구 | 설명 | 필수 파라미터 |
|------|------|--------------|
| `decision_log` | 의사결정 기록 | `what`, `why` |
| `attempt_log` | 시도 기록 | `approach`, `result` |
| `blocker_add` | 블로커 추가 | `description` |
| `blocker_resolve` | 블로커 해결 | `blockerId`, `resolution` |

#### 인수인계

| 도구 | 설명 | 필수 파라미터 |
|------|------|--------------|
| `handoff` | AI 에이전트 인수인계 | `to`, `summary` |
| `snapshot_create` | 스냅샷 생성 | - |
| `snapshot_list` | 스냅샷 목록 | - |

## 저장 위치

컨텍스트는 프로젝트 루트의 `.context-sync/` 폴더에 저장됩니다:

```
.context-sync/
├── config.json      # 설정
├── current.json     # 현재 컨텍스트
└── snapshots/       # 스냅샷들
```

> `.gitignore`에 `.context-sync/`를 추가하는 것을 권장합니다.

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
├── store/
│   └── context-store.ts  # 컨텍스트 저장소
└── types/
    └── context.ts        # 타입 정의

tests/
├── context-store.test.ts # 저장소 유닛 테스트
└── mcp-tools.test.ts     # MCP 도구 통합 테스트
```

## 로드맵

### v1.0 (예정)
- [ ] 자동 에디터 전환 감지
- [ ] Cursor/Windsurf 전용 어댑터
- [ ] Seamless 모드 (자동 로드)

### v2.0 (예정)
- [ ] 팀 동기화 (Git 기반)
- [ ] 클라우드 백업
- [ ] 충돌 해결 UI

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
