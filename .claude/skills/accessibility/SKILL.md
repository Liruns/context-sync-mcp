---
name: accessibility
description: |
  웹 접근성 (a11y) 구현.
  "접근성", "a11y", "스크린리더", "WCAG" 언급 시 활용.
allowed-tools: Read, Write, Edit, Bash, Grep, Glob
---

# Accessibility Skill

## WCAG 원칙

### POUR 원칙

```
1. Perceivable (인식 가능)
   - 텍스트 대안
   - 시간 기반 미디어 대안
   - 적응 가능한 콘텐츠
   - 구분 가능한 콘텐츠

2. Operable (운용 가능)
   - 키보드 접근성
   - 충분한 시간
   - 발작 예방
   - 탐색 가능

3. Understandable (이해 가능)
   - 읽기 쉬운 콘텐츠
   - 예측 가능한 동작
   - 입력 지원

4. Robust (견고함)
   - 호환성
   - 보조 기술과의 호환
```

## 시맨틱 HTML

### 올바른 구조

```html
<!-- Bad -->
<div class="header">
  <div class="nav">
    <div class="link">Home</div>
  </div>
</div>

<!-- Good -->
<header>
  <nav aria-label="Main navigation">
    <ul>
      <li><a href="/">Home</a></li>
      <li><a href="/about">About</a></li>
    </ul>
  </nav>
</header>

<main>
  <article>
    <h1>Article Title</h1>
    <section>
      <h2>Section Title</h2>
      <p>Content...</p>
    </section>
  </article>
</main>

<aside aria-label="Related articles">
  <h2>Related</h2>
</aside>

<footer>
  <p>&copy; 2024 Company</p>
</footer>
```

### 제목 계층

```html
<!-- Bad: 제목 레벨 건너뜀 -->
<h1>Main Title</h1>
<h3>Subsection</h3>

<!-- Good: 순차적 제목 -->
<h1>Main Title</h1>
<h2>Section</h2>
<h3>Subsection</h3>
```

## ARIA

### 역할, 상태, 속성

```html
<!-- 버튼으로 동작하는 div -->
<div
  role="button"
  tabindex="0"
  aria-pressed="false"
  onclick="toggleButton(this)"
  onkeydown="handleKeydown(event)"
>
  Toggle
</div>

<!-- 탭 인터페이스 -->
<div role="tablist" aria-label="Sample tabs">
  <button
    role="tab"
    id="tab-1"
    aria-selected="true"
    aria-controls="panel-1"
  >
    Tab 1
  </button>
  <button
    role="tab"
    id="tab-2"
    aria-selected="false"
    aria-controls="panel-2"
  >
    Tab 2
  </button>
</div>

<div
  role="tabpanel"
  id="panel-1"
  aria-labelledby="tab-1"
>
  Panel 1 content
</div>

<!-- 모달 다이얼로그 -->
<div
  role="dialog"
  aria-modal="true"
  aria-labelledby="modal-title"
  aria-describedby="modal-desc"
>
  <h2 id="modal-title">Confirm Action</h2>
  <p id="modal-desc">Are you sure you want to proceed?</p>
  <button>Confirm</button>
  <button>Cancel</button>
</div>
```

### 라이브 리전

```html
<!-- 동적 알림 -->
<div aria-live="polite" aria-atomic="true">
  <!-- 변경 시 스크린리더가 읽음 -->
  <p>3 items added to cart</p>
</div>

<!-- 긴급 알림 -->
<div role="alert" aria-live="assertive">
  Error: Please fix the form errors
</div>

<!-- 상태 메시지 -->
<div role="status" aria-live="polite">
  Loading complete
</div>
```

## 키보드 접근성

### 포커스 관리

```javascript
// 포커스 트랩 (모달용)
function trapFocus(element) {
  const focusableElements = element.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  const firstElement = focusableElements[0];
  const lastElement = focusableElements[focusableElements.length - 1];

  element.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab') return;

    if (e.shiftKey && document.activeElement === firstElement) {
      e.preventDefault();
      lastElement.focus();
    } else if (!e.shiftKey && document.activeElement === lastElement) {
      e.preventDefault();
      firstElement.focus();
    }
  });

  firstElement.focus();
}

// Skip Link
<a href="#main-content" class="skip-link">
  Skip to main content
</a>

<style>
.skip-link {
  position: absolute;
  top: -40px;
  left: 0;
  padding: 8px;
  background: #000;
  color: #fff;
  z-index: 100;
}

.skip-link:focus {
  top: 0;
}
</style>
```

### 키보드 패턴

```javascript
// 키보드 이벤트 처리
function handleKeydown(event, options) {
  const { onEnter, onSpace, onEscape, onArrowDown, onArrowUp } = options;

  switch (event.key) {
    case 'Enter':
      onEnter?.(event);
      break;
    case ' ':
      event.preventDefault();
      onSpace?.(event);
      break;
    case 'Escape':
      onEscape?.(event);
      break;
    case 'ArrowDown':
      event.preventDefault();
      onArrowDown?.(event);
      break;
    case 'ArrowUp':
      event.preventDefault();
      onArrowUp?.(event);
      break;
  }
}

// 메뉴 키보드 내비게이션
class AccessibleMenu {
  constructor(element) {
    this.menu = element;
    this.items = [...element.querySelectorAll('[role="menuitem"]')];
    this.currentIndex = 0;

    this.menu.addEventListener('keydown', (e) => this.handleKeydown(e));
  }

  handleKeydown(event) {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.moveFocus(1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.moveFocus(-1);
        break;
      case 'Home':
        event.preventDefault();
        this.focusItem(0);
        break;
      case 'End':
        event.preventDefault();
        this.focusItem(this.items.length - 1);
        break;
    }
  }

  moveFocus(direction) {
    const newIndex = this.currentIndex + direction;
    if (newIndex >= 0 && newIndex < this.items.length) {
      this.focusItem(newIndex);
    }
  }

  focusItem(index) {
    this.items[this.currentIndex].tabIndex = -1;
    this.currentIndex = index;
    this.items[this.currentIndex].tabIndex = 0;
    this.items[this.currentIndex].focus();
  }
}
```

## 폼 접근성

### 레이블과 설명

```html
<!-- 명시적 레이블 -->
<label for="email">Email Address</label>
<input
  type="email"
  id="email"
  name="email"
  aria-describedby="email-hint email-error"
  aria-invalid="true"
  required
/>
<span id="email-hint" class="hint">We'll never share your email</span>
<span id="email-error" class="error" role="alert">
  Please enter a valid email
</span>

<!-- 필수 필드 -->
<label for="name">
  Name <span aria-hidden="true">*</span>
  <span class="visually-hidden">required</span>
</label>
<input type="text" id="name" required aria-required="true" />

<!-- 그룹화 -->
<fieldset>
  <legend>Shipping Address</legend>
  <label for="street">Street</label>
  <input type="text" id="street" />
  <label for="city">City</label>
  <input type="text" id="city" />
</fieldset>
```

### 에러 처리

```javascript
function validateForm(form) {
  const errors = [];

  // 유효성 검사
  const email = form.querySelector('#email');
  if (!email.value.includes('@')) {
    errors.push({
      element: email,
      message: 'Please enter a valid email address'
    });
  }

  // 에러 표시
  if (errors.length > 0) {
    // 에러 요약 표시
    const summary = document.getElementById('error-summary');
    summary.innerHTML = `
      <h2>There are ${errors.length} errors</h2>
      <ul>
        ${errors.map(e => `
          <li><a href="#${e.element.id}">${e.message}</a></li>
        `).join('')}
      </ul>
    `;
    summary.focus();

    // 각 필드에 에러 표시
    errors.forEach(({ element, message }) => {
      element.setAttribute('aria-invalid', 'true');
      document.getElementById(`${element.id}-error`).textContent = message;
    });

    return false;
  }

  return true;
}
```

## 시각적 접근성

### 색상 대비

```css
/* WCAG AA 기준: 4.5:1 (일반 텍스트), 3:1 (큰 텍스트) */
/* WCAG AAA 기준: 7:1 (일반 텍스트), 4.5:1 (큰 텍스트) */

:root {
  --text-color: #1a1a1a;      /* 높은 대비 */
  --background: #ffffff;
  --link-color: #0066cc;      /* 충분한 대비 */
  --error-color: #cc0000;
}

/* 색상만으로 정보를 전달하지 않음 */
.error {
  color: var(--error-color);
  border-left: 4px solid currentColor;  /* 색상 + 시각적 표시 */
}

.error::before {
  content: "⚠ ";  /* 아이콘 추가 */
}
```

### 모션과 애니메이션

```css
/* 모션 감소 설정 존중 */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}

/* 안전한 애니메이션 */
.fade-in {
  animation: fadeIn 200ms ease-in;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
```

## React 접근성

### 컴포넌트 패턴

```jsx
// 접근성 높은 버튼
function Button({ children, isLoading, disabled, ...props }) {
  return (
    <button
      disabled={disabled || isLoading}
      aria-busy={isLoading}
      aria-disabled={disabled}
      {...props}
    >
      {isLoading ? (
        <>
          <span aria-hidden="true">Loading...</span>
          <span className="visually-hidden">Please wait</span>
        </>
      ) : children}
    </button>
  );
}

// 접근성 높은 아이콘 버튼
function IconButton({ icon, label, ...props }) {
  return (
    <button aria-label={label} {...props}>
      <span aria-hidden="true">{icon}</span>
    </button>
  );
}

// 알림 컴포넌트
function Alert({ type, children }) {
  return (
    <div role="alert" aria-live="assertive" className={`alert alert-${type}`}>
      {children}
    </div>
  );
}
```

### 포커스 관리

```jsx
function Modal({ isOpen, onClose, title, children }) {
  const modalRef = useRef(null);
  const previousFocus = useRef(null);

  useEffect(() => {
    if (isOpen) {
      previousFocus.current = document.activeElement;
      modalRef.current?.focus();
    } else {
      previousFocus.current?.focus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      ref={modalRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      tabIndex={-1}
    >
      <h2 id="modal-title">{title}</h2>
      {children}
      <button onClick={onClose}>Close</button>
    </div>
  );
}
```

## 테스트

### 자동화 테스트

```javascript
// Jest + Testing Library
import { render, screen } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';

expect.extend(toHaveNoViolations);

test('button is accessible', async () => {
  const { container } = render(<Button>Click me</Button>);

  const results = await axe(container);
  expect(results).toHaveNoViolations();
});

// Cypress
describe('Accessibility', () => {
  beforeEach(() => {
    cy.visit('/');
    cy.injectAxe();
  });

  it('has no detectable a11y violations', () => {
    cy.checkA11y();
  });
});
```

### 수동 테스트 체크리스트

```
□ 키보드만으로 모든 기능 사용 가능
□ 포커스 표시 명확
□ Tab 순서 논리적
□ 스크린리더로 콘텐츠 이해 가능
□ 색상 대비 충분
□ 텍스트 200% 확대 시 사용 가능
□ 모션 감소 설정 존중
□ 오류 메시지 명확
```

## 도구

```bash
# 자동화 도구
npx lighthouse --accessibility https://example.com
npx axe https://example.com

# 브라우저 확장
# - axe DevTools
# - WAVE
# - Accessibility Insights
```
