---
name: i18n
description: |
  국제화 (i18n) 및 지역화 (l10n).
  "다국어", "번역", "국제화", "i18n", "지역화" 언급 시 활용.
allowed-tools: Read, Write, Edit, Bash, Grep, Glob
---

# Internationalization (i18n) Skill

## 핵심 개념

### 용어 정의

```
i18n (Internationalization)
- 소프트웨어가 다양한 언어와 지역을 지원할 수 있도록 설계
- 코드에서 번역 가능한 문자열 분리
- 한 번 구현, 여러 언어 지원

l10n (Localization)
- 특정 언어/지역에 맞게 콘텐츠 적응
- 번역, 날짜 형식, 통화 등 적용
- 언어별로 수행
```

## React i18n (react-i18next)

### 설정

```javascript
// i18n.js
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import Backend from 'i18next-http-backend';

i18n
  .use(Backend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: 'en',
    supportedLngs: ['en', 'ko', 'ja'],

    interpolation: {
      escapeValue: false  // React가 XSS 방지
    },

    backend: {
      loadPath: '/locales/{{lng}}/{{ns}}.json'
    },

    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage']
    },

    ns: ['common', 'auth', 'errors'],
    defaultNS: 'common'
  });

export default i18n;
```

### 번역 파일

```json
// locales/en/common.json
{
  "welcome": "Welcome, {{name}}!",
  "items": {
    "one": "{{count}} item",
    "other": "{{count}} items"
  },
  "nav": {
    "home": "Home",
    "about": "About",
    "contact": "Contact"
  },
  "actions": {
    "save": "Save",
    "cancel": "Cancel",
    "delete": "Delete"
  }
}

// locales/ko/common.json
{
  "welcome": "환영합니다, {{name}}님!",
  "items": {
    "one": "{{count}}개 항목",
    "other": "{{count}}개 항목"
  },
  "nav": {
    "home": "홈",
    "about": "소개",
    "contact": "연락처"
  },
  "actions": {
    "save": "저장",
    "cancel": "취소",
    "delete": "삭제"
  }
}
```

### 컴포넌트에서 사용

```jsx
import { useTranslation, Trans } from 'react-i18next';

function Welcome({ name }) {
  const { t, i18n } = useTranslation();

  return (
    <div>
      {/* 기본 번역 */}
      <h1>{t('welcome', { name })}</h1>

      {/* 복수형 */}
      <p>{t('items', { count: 5 })}</p>

      {/* 네임스페이스 지정 */}
      <p>{t('auth:login.title')}</p>

      {/* HTML 포함 번역 */}
      <Trans i18nKey="description">
        Read our <a href="/terms">terms</a> and <a href="/privacy">privacy</a>.
      </Trans>

      {/* 언어 변경 */}
      <select
        value={i18n.language}
        onChange={(e) => i18n.changeLanguage(e.target.value)}
      >
        <option value="en">English</option>
        <option value="ko">한국어</option>
        <option value="ja">日本語</option>
      </select>
    </div>
  );
}
```

## Next.js i18n

### 설정

```javascript
// next.config.js
module.exports = {
  i18n: {
    locales: ['en', 'ko', 'ja'],
    defaultLocale: 'en',
    localeDetection: true
  }
};
```

### 라우팅

```jsx
// pages/index.js
import { useRouter } from 'next/router';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { useTranslation } from 'next-i18next';

export default function Home() {
  const { t } = useTranslation('common');
  const router = useRouter();

  return (
    <div>
      <h1>{t('title')}</h1>

      {/* 로케일 변경 */}
      <Link href="/" locale="ko">한국어</Link>
      <Link href="/" locale="en">English</Link>
    </div>
  );
}

export async function getStaticProps({ locale }) {
  return {
    props: {
      ...(await serverSideTranslations(locale, ['common', 'footer']))
    }
  };
}
```

## 날짜/시간 포맷

### Intl.DateTimeFormat

```javascript
function formatDate(date, locale, options = {}) {
  const defaultOptions = {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  };

  return new Intl.DateTimeFormat(locale, {
    ...defaultOptions,
    ...options
  }).format(date);
}

// 사용 예
formatDate(new Date(), 'en-US');  // "January 15, 2024"
formatDate(new Date(), 'ko-KR');  // "2024년 1월 15일"
formatDate(new Date(), 'ja-JP');  // "2024年1月15日"

// 상대 시간
function formatRelativeTime(date, locale) {
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  const now = new Date();
  const diffInSeconds = (date - now) / 1000;

  if (Math.abs(diffInSeconds) < 60) {
    return rtf.format(Math.round(diffInSeconds), 'second');
  } else if (Math.abs(diffInSeconds) < 3600) {
    return rtf.format(Math.round(diffInSeconds / 60), 'minute');
  } else if (Math.abs(diffInSeconds) < 86400) {
    return rtf.format(Math.round(diffInSeconds / 3600), 'hour');
  } else {
    return rtf.format(Math.round(diffInSeconds / 86400), 'day');
  }
}

formatRelativeTime(new Date(Date.now() - 3600000), 'en');  // "1 hour ago"
formatRelativeTime(new Date(Date.now() - 3600000), 'ko');  // "1시간 전"
```

## 숫자/통화 포맷

### Intl.NumberFormat

```javascript
// 숫자 포맷
function formatNumber(number, locale) {
  return new Intl.NumberFormat(locale).format(number);
}

formatNumber(1234567.89, 'en-US');  // "1,234,567.89"
formatNumber(1234567.89, 'de-DE');  // "1.234.567,89"
formatNumber(1234567.89, 'ko-KR');  // "1,234,567.89"

// 통화 포맷
function formatCurrency(amount, currency, locale) {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currency
  }).format(amount);
}

formatCurrency(1234.56, 'USD', 'en-US');  // "$1,234.56"
formatCurrency(1234.56, 'EUR', 'de-DE');  // "1.234,56 €"
formatCurrency(1234.56, 'KRW', 'ko-KR');  // "₩1,235"
formatCurrency(1234.56, 'JPY', 'ja-JP');  // "￥1,235"

// 퍼센트 포맷
function formatPercent(value, locale) {
  return new Intl.NumberFormat(locale, {
    style: 'percent',
    minimumFractionDigits: 1
  }).format(value);
}

formatPercent(0.1234, 'en-US');  // "12.3%"
```

## 복수형 처리

### ICU 메시지 형식

```javascript
// ICU MessageFormat
const messages = {
  en: {
    items: '{count, plural, =0 {No items} one {# item} other {# items}}',
    lastLogin: '{gender, select, male {He} female {She} other {They}} logged in {time} ago'
  },
  ko: {
    items: '{count, plural, =0 {항목 없음} other {#개 항목}}',
    lastLogin: '{time} 전에 로그인함'
  }
};

// FormatJS 사용
import { IntlProvider, FormattedMessage, FormattedPlural } from 'react-intl';

<IntlProvider locale="en" messages={messages.en}>
  <FormattedMessage
    id="items"
    values={{ count: 5 }}
  />
</IntlProvider>
```

### 언어별 복수형 규칙

```javascript
// 언어별 복수형 카테고리
const pluralRules = {
  en: ['one', 'other'],           // 1 item, 2 items
  ko: ['other'],                  // 1개, 2개 (구분 없음)
  ru: ['one', 'few', 'many', 'other'],  // 러시아어는 복잡
  ar: ['zero', 'one', 'two', 'few', 'many', 'other']  // 아랍어
};

// Intl.PluralRules 사용
function getPlural(count, locale) {
  const pr = new Intl.PluralRules(locale);
  return pr.select(count);
}

getPlural(1, 'en');   // "one"
getPlural(2, 'en');   // "other"
getPlural(1, 'ru');   // "one"
getPlural(2, 'ru');   // "few"
getPlural(5, 'ru');   // "many"
```

## RTL (Right-to-Left) 지원

### CSS 논리적 속성

```css
/* 물리적 속성 (비권장) */
.old-way {
  margin-left: 10px;
  padding-right: 20px;
  text-align: left;
}

/* 논리적 속성 (권장) */
.new-way {
  margin-inline-start: 10px;
  padding-inline-end: 20px;
  text-align: start;
}

/* RTL 지원 */
[dir="rtl"] .component {
  /* RTL 특정 스타일 */
}

/* 또는 */
.component {
  direction: inherit;
}
```

### RTL 감지

```jsx
function useDirection() {
  const { i18n } = useTranslation();
  const rtlLanguages = ['ar', 'he', 'fa', 'ur'];

  return rtlLanguages.includes(i18n.language) ? 'rtl' : 'ltr';
}

function App() {
  const direction = useDirection();

  return (
    <div dir={direction}>
      {/* 콘텐츠 */}
    </div>
  );
}
```

## 번역 관리

### 번역 키 추출

```bash
# i18next-parser
npx i18next-parser 'src/**/*.{js,jsx,ts,tsx}'

# i18next-scanner
npx i18next-scanner --config i18next-scanner.config.js
```

### 번역 플랫폼 통합

```javascript
// Lokalise, Crowdin, Phrase 등과 통합
// CLI를 통한 동기화

// lokalise2 CLI
// lokalise2 file download --project-id <id> --dest ./locales

// 자동화 스크립트
// scripts/sync-translations.js
const { exec } = require('child_process');

async function syncTranslations() {
  // 1. 소스에서 키 추출
  await exec('npx i18next-parser');

  // 2. 플랫폼에 업로드
  await exec('lokalise2 file upload ...');

  // 3. 번역된 파일 다운로드
  await exec('lokalise2 file download ...');
}
```

## 테스트

### 번역 테스트

```javascript
import { render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from './i18n-test';  // 테스트용 설정

function renderWithI18n(component, locale = 'en') {
  i18n.changeLanguage(locale);
  return render(
    <I18nextProvider i18n={i18n}>
      {component}
    </I18nextProvider>
  );
}

test('displays translated text', async () => {
  renderWithI18n(<Welcome name="John" />, 'ko');

  expect(screen.getByText('환영합니다, John님!')).toBeInTheDocument();
});

test('handles missing translations', () => {
  const { container } = renderWithI18n(<MissingKey />);

  // fallback 동작 확인
});
```

### 시각적 테스트

```javascript
// 다양한 로케일로 스크린샷 비교
describe('Visual i18n tests', () => {
  const locales = ['en', 'ko', 'ja', 'ar'];

  locales.forEach(locale => {
    it(`renders correctly in ${locale}`, () => {
      cy.visit(`/?lng=${locale}`);
      cy.matchImageSnapshot(`home-${locale}`);
    });
  });
});
```

## 체크리스트

### 구현
```
□ 모든 사용자 노출 문자열 외부화
□ 날짜/시간/숫자 로케일 포맷
□ 복수형 규칙 적용
□ RTL 레이아웃 지원
□ 이미지/아이콘 현지화
□ 폼 검증 메시지 번역
```

### 품질
```
□ 번역 누락 검사
□ 텍스트 길이 변화 대응
□ 컨텍스트 정보 제공
□ 번역자용 주석 추가
□ 스크린샷 제공
```

### 테스트
```
□ 모든 로케일 렌더링 테스트
□ 폴백 동작 테스트
□ 날짜/숫자 포맷 테스트
□ 복수형 테스트
□ RTL 레이아웃 테스트
```
