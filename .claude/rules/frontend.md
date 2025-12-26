---
paths: src/frontend/**, src/components/**, src/pages/**, *.tsx, *.jsx
---

# Frontend 개발 규칙

## React/Vue 컴포넌트

### 컴포넌트 구조
```tsx
// 1. imports
import React, { useState, useEffect } from 'react';

// 2. types
interface Props {
  title: string;
  onClick?: () => void;
}

// 3. component
export const Component: React.FC<Props> = ({ title, onClick }) => {
  // hooks first
  const [state, setState] = useState();

  // effects
  useEffect(() => {}, []);

  // handlers
  const handleClick = () => {};

  // render
  return <div>{title}</div>;
};
```

### 네이밍 규칙
- 컴포넌트: PascalCase (`UserProfile`)
- 훅: use 접두사 (`useAuth`)
- 핸들러: handle 접두사 (`handleSubmit`)
- 상태: is/has 접두사 (`isLoading`, `hasError`)

## 스타일링

### CSS-in-JS / Tailwind
```tsx
// Tailwind
<div className="flex items-center justify-center p-4">

// CSS Modules
import styles from './Component.module.css';
<div className={styles.container}>
```

## 상태 관리

- 로컬 상태: useState
- 복잡한 로컬: useReducer
- 전역 상태: Context / Redux / Zustand
- 서버 상태: React Query / SWR

## 성능

- React.memo 적절히 사용
- useMemo/useCallback 필요시만
- 큰 목록은 가상화 (react-window)
- 이미지 lazy loading

## 접근성

- 시맨틱 HTML 사용
- aria 속성 추가
- 키보드 네비게이션 지원
- 색상 대비 확인
