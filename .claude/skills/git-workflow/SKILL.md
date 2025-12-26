---
name: git-workflow
description: |
  Git 워크플로우 및 커밋 메시지 규칙.
  "커밋", "PR", "merge", "branch", "git" 언급 시 활용.
allowed-tools: Bash
---

# Git Workflow Skill

## 브랜치 전략

### Git Flow
```
main        ──●────────────────────────●──
             ↑                          ↑
release    ──┴──●──────────────●───────┴──
                ↑              ↑
develop    ────●───●───●───●───●──────────
               ↑   ↑
feature    ────┴───┘
```

### GitHub Flow (단순)
```
main       ──●────●────●────●──
             ↑    ↑    ↑    ↑
feature    ──┘    │    │    │
feature    ───────┘    │    │
feature    ────────────┘    │
hotfix     ─────────────────┘
```

## 브랜치 네이밍

```
feature/user-authentication
feature/JIRA-123-add-login
bugfix/login-redirect-issue
hotfix/critical-security-patch
release/v1.2.0
```

## Conventional Commits

### 형식
```
<type>(<scope>): <subject>

<body>

<footer>
```

### 타입
| 타입 | 설명 |
|------|------|
| feat | 새로운 기능 |
| fix | 버그 수정 |
| docs | 문서 변경 |
| style | 코드 스타일 (포맷팅) |
| refactor | 리팩토링 |
| test | 테스트 추가/수정 |
| chore | 빌드, 설정 변경 |
| perf | 성능 개선 |
| ci | CI 설정 변경 |

### 예시
```
feat(auth): add JWT authentication

Implement JWT-based authentication system
- Add login/logout endpoints
- Add token refresh mechanism
- Add auth middleware

Closes #123
```

## 자주 사용하는 명령어

### 기본
```bash
# 상태 확인
git status
git log --oneline -10
git diff

# 브랜치
git checkout -b feature/new-feature
git branch -d feature/completed
git push -u origin feature/new-feature
```

### 되돌리기
```bash
# 커밋 전 변경 취소
git checkout -- file.js
git restore file.js  # Git 2.23+

# 스테이징 취소
git reset HEAD file.js
git restore --staged file.js

# 커밋 수정 (push 전)
git commit --amend

# 커밋 되돌리기
git revert HEAD
git revert <commit-hash>
```

### Stash
```bash
git stash
git stash list
git stash pop
git stash apply stash@{0}
git stash drop stash@{0}
```

### Rebase
```bash
# 브랜치 rebase
git checkout feature
git rebase main

# Interactive rebase (커밋 정리)
git rebase -i HEAD~3
```

## PR (Pull Request) 가이드

### PR 제목
```
feat(auth): implement OAuth2 login
fix(cart): resolve item duplication issue
docs: update API documentation
```

### PR 설명 템플릿
```markdown
## 변경 사항
- 무엇을 변경했는지

## 변경 이유
- 왜 변경했는지

## 테스트 방법
- 어떻게 테스트할 수 있는지

## 체크리스트
- [ ] 테스트 통과
- [ ] 문서 업데이트
- [ ] 리뷰어 지정

## 관련 이슈
Closes #123
```

## 충돌 해결

```bash
# 충돌 발생 시
git status  # 충돌 파일 확인

# 수동으로 파일 수정 후
git add <resolved-file>
git commit
# 또는 rebase 중이라면
git rebase --continue
```

## .gitignore 필수 항목

```
# 의존성
node_modules/
vendor/
venv/

# 빌드
dist/
build/
*.pyc

# 환경/설정
.env
.env.local
*.local

# IDE
.idea/
.vscode/
*.swp

# OS
.DS_Store
Thumbs.db

# 로그
*.log
logs/
```

## 커밋 모범 사례

```
1. 자주 커밋 (작은 단위)
2. 의미 있는 커밋 메시지
3. 관련 없는 변경 분리
4. 작동하는 상태로 커밋
5. 커밋 전 diff 확인
6. 민감 정보 커밋 금지
```
