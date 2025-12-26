---
name: testing
description: |
  테스트 전략 및 패턴.
  "테스트", "test", "coverage", "단위 테스트", "통합 테스트" 언급 시 활용.
allowed-tools: Read, Write, Edit, Bash, Grep, Glob
---

# Testing Skill

## 테스트 피라미드

```
        /\
       /  \      E2E Tests (느림, 적게)
      /----\
     /      \    Integration Tests
    /--------\
   /          \  Unit Tests (빠름, 많이)
  --------------
```

## 단위 테스트 패턴

### AAA 패턴
```javascript
test('should calculate total', () => {
  // Arrange - 준비
  const cart = new Cart();
  cart.addItem({ price: 100 });
  cart.addItem({ price: 200 });

  // Act - 실행
  const total = cart.getTotal();

  // Assert - 검증
  expect(total).toBe(300);
});
```

### Given-When-Then
```javascript
describe('Cart', () => {
  describe('given items in cart', () => {
    describe('when calculating total', () => {
      it('then returns sum of prices', () => {
        // ...
      });
    });
  });
});
```

## 테스트 케이스 설계

### 경계값 분석
```
- 최솟값, 최솟값-1, 최솟값+1
- 최댓값, 최댓값-1, 최댓값+1
- 0, 빈 문자열, null, undefined
```

### 등가 분할
```
- 유효한 입력 그룹
- 유효하지 않은 입력 그룹
- 특수 케이스 그룹
```

## 모킹 전략

### 언제 Mock을 사용하나
```
- 외부 API 호출
- 데이터베이스 접근
- 파일 시스템 접근
- 현재 시간
- 랜덤 값
```

### Mock 예시 (Jest)
```javascript
// 함수 모킹
jest.mock('./api', () => ({
  fetchUser: jest.fn().mockResolvedValue({ id: 1, name: 'Test' })
}));

// 모듈 모킹
jest.mock('axios');

// 타이머 모킹
jest.useFakeTimers();
jest.advanceTimersByTime(1000);
```

## 테스트 명명 규칙

```
// 좋은 예
'should return empty array when no items'
'should throw error when input is null'
'should calculate discount for premium users'

// 나쁜 예
'test1'
'it works'
'getTotal test'
```

## 커버리지 목표

| 영역 | 최소 | 권장 |
|------|------|------|
| 비즈니스 로직 | 80% | 90% |
| 유틸리티 함수 | 90% | 100% |
| UI 컴포넌트 | 60% | 80% |
| API 핸들러 | 80% | 90% |

## 테스트 실행 명령어

### JavaScript/TypeScript
```bash
# Jest
npm test
npm test -- --coverage
npm test -- --watch
npm test -- --testPathPattern="user"

# Vitest
npx vitest
npx vitest --coverage
```

### Python
```bash
# Pytest
pytest
pytest --cov=src
pytest -k "test_user"
pytest -v
```

## 피해야 할 안티패턴

```
1. 테스트 간 의존성
2. 실제 외부 서비스 호출
3. 테스트 데이터 공유
4. 하나의 테스트에 여러 검증
5. 비결정적 테스트 (flaky)
6. 구현 세부사항 테스트
```
