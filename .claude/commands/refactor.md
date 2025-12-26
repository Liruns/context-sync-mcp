---
description: 코드 리팩토링. 구조 개선, 중복 제거, 복잡도 감소.
---

# 리팩토링 명령

코드 품질 개선을 위한 리팩토링을 수행합니다.

## 수행 작업

### 1. 현재 상태 분석
- 지정된 파일/경로의 코드 스멜 탐지
- 중복 코드 식별
- 복잡도 측정

### 2. 리팩토링 계획 수립
- 발견된 문제점 우선순위화
- 리팩토링 기법 선택
- 영향 범위 파악

### 3. 리팩토링 실행
- 작은 단위로 점진적 변경
- 각 변경 후 테스트 확인
- 기능 동일성 유지

### 4. 결과 보고
- 개선된 지표 (복잡도, 중복 등)
- 변경된 파일 목록
- 권장 후속 작업

## 사용법

```
/refactor [경로 또는 파일]
/refactor src/components/
/refactor src/utils/helper.ts
```

## 리팩토링 대상

### 코드 스멜
- God Class (너무 큰 클래스)
- Long Method (긴 메서드)
- Duplicate Code (중복 코드)
- Feature Envy (다른 클래스 과다 사용)
- Long Parameter List (긴 파라미터)

### 적용 기법
- Extract Method/Function
- Extract Class
- Rename (의미있는 이름)
- Move Method
- Replace Conditional with Polymorphism

## 주의사항

- 테스트가 있는지 먼저 확인
- 작은 단위로 커밋
- 리팩토링과 기능 변경 분리

## 관련 에이전트/스킬
- `refactorer` 에이전트 사용
- `code-quality` 스킬 활용

$ARGUMENTS
