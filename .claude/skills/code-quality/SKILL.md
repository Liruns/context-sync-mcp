---
name: code-quality
description: |
  코드 품질 기준 및 모범 사례.
  "리뷰", "리팩토링", "품질", "클린 코드" 언급 시 활용.
allowed-tools: Read, Grep, Glob
---

# Code Quality Skill

## 클린 코드 원칙

### 1. 명확한 네이밍
```javascript
// 나쁜 예
const d = new Date();
const fn = (a, b) => a + b;
const data = fetchData();

// 좋은 예
const currentDate = new Date();
const calculateSum = (price, tax) => price + tax;
const userProfile = fetchUserProfile();
```

### 2. 함수 설계
```javascript
// 나쁜 예: 너무 많은 매개변수
function createUser(name, email, age, address, phone, role) { }

// 좋은 예: 객체 사용
function createUser({ name, email, age, address, phone, role }) { }

// 나쁜 예: 부작용이 있는 함수
let total = 0;
function addToTotal(value) {
  total += value;  // 외부 상태 변경
  return total;
}

// 좋은 예: 순수 함수
function add(a, b) {
  return a + b;
}
```

### 3. 단일 책임 원칙
```javascript
// 나쁜 예: 여러 책임
class User {
  save() { }
  sendEmail() { }
  generateReport() { }
}

// 좋은 예: 분리된 책임
class User { save() { } }
class EmailService { sendEmail(user) { } }
class ReportGenerator { generateReport(user) { } }
```

## 코드 스멜 (Code Smell)

### 긴 함수
```
- 20줄 이상의 함수는 분리 고려
- 하나의 추상화 수준 유지
- 조기 리턴으로 중첩 줄이기
```

### 긴 매개변수 목록
```
- 3개 이상이면 객체로 묶기
- 관련 매개변수 그룹화
- 빌더 패턴 고려
```

### 중복 코드
```
- 함수로 추출
- 상속 또는 조합 사용
- 유틸리티 모듈 생성
```

### 조건문 복잡도
```javascript
// 나쁜 예
if (user && user.profile && user.profile.settings && user.profile.settings.theme) { }

// 좋은 예
const theme = user?.profile?.settings?.theme;
if (theme) { }

// 나쁜 예: 중첩 조건문
if (a) {
  if (b) {
    if (c) { }
  }
}

// 좋은 예: 조기 리턴
if (!a) return;
if (!b) return;
if (!c) return;
// 핵심 로직
```

## SOLID 원칙

### S - Single Responsibility
```
클래스/함수는 하나의 책임만
```

### O - Open/Closed
```
확장에는 열려있고, 수정에는 닫혀있게
```

### L - Liskov Substitution
```
하위 타입은 상위 타입을 대체할 수 있어야
```

### I - Interface Segregation
```
클라이언트에 특화된 인터페이스
```

### D - Dependency Inversion
```
구체화가 아닌 추상화에 의존
```

## 리팩토링 기법

### 함수 추출
```javascript
// Before
function printOwing(invoice) {
  console.log("***********************");
  console.log("**** Customer Owes ****");
  console.log("***********************");
  // calculate outstanding
  let outstanding = 0;
  for (const o of invoice.orders) {
    outstanding += o.amount;
  }
  console.log(`Amount: ${outstanding}`);
}

// After
function printOwing(invoice) {
  printBanner();
  const outstanding = calculateOutstanding(invoice);
  printDetails(outstanding);
}
```

### 변수 인라인화 / 추출
```javascript
// 추출 (복잡한 표현식)
const isEligible = user.age >= 18 && user.verified && !user.banned;
if (isEligible) { }

// 인라인화 (불필요한 변수)
const basePrice = order.price;  // 불필요
return basePrice;  // → return order.price;
```

## 주석 가이드라인

```javascript
// 나쁜 예: what을 설명
i++; // i를 1 증가

// 좋은 예: why를 설명
i++; // 페이지네이션은 1부터 시작하므로

// 좋은 예: 복잡한 비즈니스 로직 설명
// 30일 이내 3회 이상 구매 시 프리미엄 자격 부여
if (purchases.filter(p => p.date > thirtyDaysAgo).length >= 3) {
  user.tier = 'premium';
}
```

## 코드 리뷰 체크리스트

```
[ ] 요구사항을 충족하는가?
[ ] 버그가 없는가?
[ ] 읽기 쉬운가?
[ ] 테스트가 있는가?
[ ] 중복이 없는가?
[ ] 에러 처리가 적절한가?
[ ] 성능 문제가 없는가?
[ ] 보안 문제가 없는가?
```
