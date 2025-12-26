---
description: 환경 설정. MCP 서버 설치, 의존성 체크, 초기 설정.
---

# 환경 설정 명령

Claude Code 개발 환경을 설정하고 필요한 MCP 서버를 설치합니다.

## 수행 작업

### 1. 환경 체크
- Node.js / npm 설치 확인
- Claude CLI 설치 확인
- Python 설치 확인
- 현재 설치된 MCP 서버 확인

### 2. MCP 서버 설치
- 개발 스택에 맞는 MCP 서버 추천
- 선택한 MCP 서버 자동 설치
- Claude CLI에 MCP 등록

### 3. 프로젝트 설정
- .claude 폴더 구성 확인
- hooks 실행 권한 설정
- 환경 변수 가이드

## 사용법

```bash
# 대화형 설정 (권장)
/setup

# MCP 서버만 설정
/setup mcp

# 환경 체크만
/setup check

# 특정 MCP 설치
/setup mcp github postgres

# 사용 가능한 MCP 목록
/setup mcp --list
```

## 사용 가능한 MCP 서버

| MCP 서버 | 설명 | 필요 환경변수 |
|---------|------|--------------|
| github | GitHub 연동 (이슈, PR) | GITHUB_TOKEN |
| postgres | PostgreSQL DB | DATABASE_URL |
| sqlite | SQLite DB | - |
| filesystem | 파일 시스템 확장 | - |
| puppeteer | 브라우저 자동화 | - |
| fetch | HTTP 요청 | - |
| memory | 영구 메모리 | - |
| sequential-thinking | 순차적 사고 | - |

## 개발 스택별 추천

| 스택 | 추천 MCP |
|------|----------|
| web | github, fetch, puppeteer |
| backend | github, postgres, fetch |
| fullstack | github, postgres, fetch, puppeteer |
| data | postgres, sqlite, fetch |
| minimal | github, fetch |

## 환경 변수 설정

MCP 서버 사용을 위해 필요한 환경 변수:

```bash
# GitHub
export GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx

# PostgreSQL
export DATABASE_URL=postgresql://user:pass@localhost:5432/db

# OpenAI (ai-ml 스킬용)
export OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxx

# Anthropic (추가 AI 기능용)
export ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxxxxxxxxx
```

## 실행 스크립트

설정 스크립트 직접 실행:

```bash
# 대화형 설정
python .claude/scripts/setup-mcp.py

# 환경 체크
python .claude/scripts/setup-mcp.py --check

# MCP 목록
python .claude/scripts/setup-mcp.py --list

# 특정 MCP 설치
python .claude/scripts/setup-mcp.py --install github postgres
```

$ARGUMENTS
