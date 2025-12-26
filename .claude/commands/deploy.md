---
description: 배포 준비. CI/CD 설정, 도커, 클라우드 배포.
---

# 배포 준비 명령

애플리케이션 배포를 위한 설정과 스크립트를 생성합니다.

## 수행 작업

### 1. 환경 분석
- 프로젝트 타입 감지
- 기존 배포 설정 확인
- 요구사항 파악

### 2. 배포 설정 생성
- Dockerfile 생성/업데이트
- docker-compose.yml 설정
- CI/CD 파이프라인 설정

### 3. 클라우드 설정 (선택)
- AWS/Azure/GCP 설정
- Kubernetes 매니페스트
- Terraform 설정

### 4. 문서화
- 배포 가이드
- 환경 변수 문서
- 롤백 절차

## 사용법

```
/deploy [플랫폼]
/deploy docker           # Docker 설정
/deploy github-actions   # GitHub Actions CI/CD
/deploy vercel           # Vercel 배포
/deploy aws              # AWS 배포
/deploy kubernetes       # Kubernetes 설정
```

## 지원 플랫폼

### 컨테이너
- Docker
- Docker Compose
- Kubernetes

### CI/CD
- GitHub Actions
- GitLab CI
- CircleCI

### 클라우드
- AWS (ECS, Lambda, S3)
- Azure (App Service, Functions)
- GCP (Cloud Run, GKE)
- Vercel
- Netlify

## 생성 파일 예시

### Docker
```
Dockerfile
docker-compose.yml
.dockerignore
```

### GitHub Actions
```
.github/workflows/ci.yml
.github/workflows/deploy.yml
```

### Kubernetes
```
k8s/deployment.yaml
k8s/service.yaml
k8s/ingress.yaml
k8s/configmap.yaml
```

## 출력 형식

```markdown
## 배포 설정 완료

### 생성된 파일
- [파일 목록]

### 환경 변수
| 변수 | 설명 | 필수 |
|------|------|------|
| ...  | ...  | ...  |

### 배포 명령어
# 로컬 테스트
docker-compose up

# 프로덕션 배포
[배포 명령어]

### 다음 단계
1. 환경 변수 설정
2. 시크릿 설정
3. 첫 배포 실행
```

## 관련 스킬
- `devops` 스킬
- `cloud` 스킬

$ARGUMENTS
