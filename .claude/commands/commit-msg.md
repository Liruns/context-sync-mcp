---
description: 커밋 메시지 생성. Conventional Commits 형식.
allowed-tools: Bash
model: haiku
---

# 커밋 메시지 생성

스테이징된 변경사항을 분석하고 커밋 메시지를 생성합니다.

## 프로세스

1. `git diff --staged` 로 변경사항 확인
2. 변경 내용 분석
3. Conventional Commits 형식으로 메시지 생성

## Conventional Commits 형식

```
<type>(<scope>): <subject>

<body>

<footer>
```

### 타입
- feat: 새로운 기능
- fix: 버그 수정
- docs: 문서 변경
- style: 코드 스타일
- refactor: 리팩토링
- test: 테스트
- chore: 빌드, 설정

## 출력

```
feat(auth): add JWT authentication

Implement JWT-based authentication system
- Add login/logout endpoints
- Add token refresh mechanism

Closes #123
```

## 주의사항

- 제목은 50자 이내
- 본문은 72자에서 줄바꿈
- 무엇을 했는지보다 왜 했는지 설명
