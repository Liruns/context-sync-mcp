---
name: performance
description: |
  성능 최적화 패턴 및 기법.
  "성능", "최적화", "느림", "빠르게", "performance" 언급 시 활용.
allowed-tools: Read, Grep, Glob, Bash
---

# Performance Skill

## 시간 복잡도 가이드

| 복잡도 | 이름 | 예시 |
|--------|------|------|
| O(1) | 상수 | 배열 인덱스 접근 |
| O(log n) | 로그 | 이진 검색 |
| O(n) | 선형 | 배열 순회 |
| O(n log n) | 선형로그 | 병합 정렬 |
| O(n²) | 이차 | 중첩 루프 |
| O(2ⁿ) | 지수 | 피보나치 재귀 |

## 일반적인 성능 문제

### 1. N+1 쿼리 문제
```javascript
// 나쁜 예
const users = await User.findAll();
for (const user of users) {
  const posts = await Post.findAll({ where: { userId: user.id } });
}

// 좋은 예: Eager loading
const users = await User.findAll({
  include: [{ model: Post }]
});
```

### 2. 불필요한 재렌더링 (React)
```javascript
// 나쁜 예
function Component() {
  const data = { key: 'value' };  // 매 렌더링마다 새 객체
  return <Child data={data} />;
}

// 좋은 예
function Component() {
  const data = useMemo(() => ({ key: 'value' }), []);
  return <Child data={data} />;
}
```

### 3. 메모리 누수
```javascript
// 나쁜 예: 이벤트 리스너 누수
useEffect(() => {
  window.addEventListener('resize', handleResize);
  // cleanup 없음!
}, []);

// 좋은 예
useEffect(() => {
  window.addEventListener('resize', handleResize);
  return () => window.removeEventListener('resize', handleResize);
}, []);
```

## 최적화 기법

### 캐싱
```javascript
// 메모이제이션
const memoizedFn = useMemo(() => expensiveCalculation(a, b), [a, b]);

// 결과 캐싱
const cache = new Map();
function cachedFetch(url) {
  if (cache.has(url)) return cache.get(url);
  const result = fetch(url);
  cache.set(url, result);
  return result;
}
```

### 지연 로딩
```javascript
// React lazy loading
const HeavyComponent = lazy(() => import('./HeavyComponent'));

// 이미지 지연 로딩
<img loading="lazy" src="large-image.jpg" />

// Intersection Observer
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      loadContent(entry.target);
    }
  });
});
```

### 디바운싱 / 쓰로틀링
```javascript
// Debounce: 마지막 호출 후 일정 시간 대기
function debounce(fn, delay) {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

// Throttle: 일정 시간마다 한 번만 실행
function throttle(fn, limit) {
  let inThrottle;
  return (...args) => {
    if (!inThrottle) {
      fn(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}
```

### 가상화 (Virtualization)
```javascript
// 큰 목록 렌더링 시
import { FixedSizeList } from 'react-window';

<FixedSizeList
  height={400}
  width={300}
  itemCount={10000}
  itemSize={35}
>
  {Row}
</FixedSizeList>
```

## 데이터베이스 최적화

### 인덱스
```sql
-- 자주 조회하는 컬럼에 인덱스
CREATE INDEX idx_user_email ON users(email);

-- 복합 인덱스
CREATE INDEX idx_order_user_date ON orders(user_id, created_at);
```

### 쿼리 최적화
```sql
-- 나쁜 예
SELECT * FROM users WHERE name LIKE '%john%';

-- 좋은 예
SELECT id, name, email FROM users WHERE name LIKE 'john%';
```

## 프론트엔드 최적화

```
1. 번들 크기 줄이기 (tree shaking)
2. 이미지 최적화 (WebP, 압축)
3. 코드 스플리팅
4. CDN 사용
5. Gzip/Brotli 압축
6. HTTP/2 활용
```

## 측정 도구

```bash
# Node.js 프로파일링
node --prof app.js
node --prof-process isolate-*.log

# Lighthouse (웹)
npx lighthouse https://example.com

# Bundle 분석
npm run build -- --analyze
```

## 성능 체크리스트

```
[ ] N+1 쿼리 없음
[ ] 적절한 인덱스 설정
[ ] 메모리 누수 없음
[ ] 불필요한 재렌더링 없음
[ ] 이미지 최적화
[ ] 코드 스플리팅 적용
[ ] 캐싱 전략 수립
```
