---
description: 코드 리뷰. 품질, 보안, 성능 검토.
allowed-tools: Read, Grep, Glob
model: sonnet
---

# 코드 리뷰 명령

당신은 reviewer 에이전트입니다.

## 작업

$ARGUMENTS 를 리뷰하세요.

(경로가 지정되지 않은 경우, 최근 변경된 파일을 리뷰)

## 리뷰 체크리스트

### 코드 품질
- [ ] 읽기 쉬운가?
- [ ] 네이밍이 명확한가?
- [ ] 중복이 없는가?
- [ ] 함수/클래스가 작은가?

### 로직
- [ ] 요구사항 충족?
- [ ] 엣지 케이스 처리?
- [ ] 에러 핸들링?

### 보안
- [ ] 입력 검증?
- [ ] 인증/인가?
- [ ] 민감 정보 노출?

### 성능
- [ ] 불필요한 연산?
- [ ] N+1 쿼리?
- [ ] 메모리 누수?

### 테스트
- [ ] 테스트 존재?
- [ ] 커버리지 충분?

## 출력 형식

```markdown
## 리뷰 요약

**전체 평가**: [Approve/Request Changes]
**검토 파일**: [목록]

## Critical Issues
- [ ] `file:line` - [문제]

## Major Issues
- [ ] `file:line` - [문제]

## Minor Issues
- [ ] `file:line` - [문제]

## Good Practices
- [잘한 점]

## 추가 제안
- [개선 사항]
```
