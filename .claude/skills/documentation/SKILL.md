---
name: documentation
description: |
  문서화 표준 및 템플릿.
  "문서", "README", "주석", "설명", "JSDoc", "docstring" 언급 시 활용.
allowed-tools: Read, Write, Edit, Glob
---

# Documentation Skill

## README 템플릿

```markdown
# 프로젝트 이름

간단한 한 줄 설명

[![License](https://img.shields.io/badge/license-MIT-blue.svg)]()
[![Build](https://img.shields.io/github/workflow/status/user/repo/CI)]()

## 개요

프로젝트에 대한 2-3문장 설명

## 주요 기능

- 기능 1
- 기능 2
- 기능 3

## 설치

### 요구사항

- Node.js 18+
- npm 또는 yarn

### 설치 방법

\```bash
npm install package-name
\```

## 빠른 시작

\```javascript
import { something } from 'package-name';

const result = something();
\```

## 설정

| 옵션 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| port | number | 3000 | 서버 포트 |

## API 문서

[API 문서 링크](./docs/api.md)

## 기여

기여를 환영합니다! [CONTRIBUTING.md](./CONTRIBUTING.md)를 참고하세요.

## 라이선스

MIT License
```

## 코드 주석

### JSDoc (JavaScript/TypeScript)
```javascript
/**
 * 두 숫자의 합을 계산합니다.
 *
 * @param {number} a - 첫 번째 숫자
 * @param {number} b - 두 번째 숫자
 * @returns {number} 두 숫자의 합
 * @throws {TypeError} 숫자가 아닌 값이 전달된 경우
 *
 * @example
 * // returns 3
 * add(1, 2);
 *
 * @example
 * // throws TypeError
 * add('a', 'b');
 */
function add(a, b) {
  if (typeof a !== 'number' || typeof b !== 'number') {
    throw new TypeError('숫자만 허용됩니다');
  }
  return a + b;
}
```

### TypeScript 인터페이스
```typescript
/**
 * 사용자 정보를 나타냅니다.
 */
interface User {
  /** 고유 식별자 */
  id: string;

  /** 사용자 이름 */
  name: string;

  /** 이메일 주소 */
  email: string;

  /**
   * 계정 생성일
   * @format ISO 8601
   */
  createdAt: Date;
}
```

### Python Docstring
```python
def calculate_discount(price: float, rate: float) -> float:
    """할인된 가격을 계산합니다.

    Args:
        price: 원래 가격
        rate: 할인율 (0.0 ~ 1.0)

    Returns:
        할인 적용된 가격

    Raises:
        ValueError: 할인율이 0-1 범위를 벗어난 경우

    Example:
        >>> calculate_discount(100.0, 0.2)
        80.0
    """
    if not 0 <= rate <= 1:
        raise ValueError("할인율은 0과 1 사이여야 합니다")
    return price * (1 - rate)
```

## API 문서

### 엔드포인트 문서
```markdown
## POST /api/users

새 사용자를 생성합니다.

### 요청

**Headers**
| 이름 | 필수 | 설명 |
|------|------|------|
| Authorization | Y | Bearer 토큰 |
| Content-Type | Y | application/json |

**Body**
\```json
{
  "name": "홍길동",
  "email": "hong@example.com",
  "password": "secure123"
}
\```

### 응답

**성공 (201 Created)**
\```json
{
  "id": "user_123",
  "name": "홍길동",
  "email": "hong@example.com",
  "createdAt": "2024-01-01T00:00:00Z"
}
\```

**에러**
| 코드 | 설명 |
|------|------|
| 400 | 잘못된 요청 |
| 409 | 이미 존재하는 이메일 |
```

## 변경 로그 (CHANGELOG)

```markdown
# Changelog

## [1.2.0] - 2024-01-15

### Added
- 새로운 인증 기능

### Changed
- 성능 개선

### Fixed
- 로그인 버그 수정

### Deprecated
- 구 버전 API (v1)

### Removed
- 사용하지 않는 의존성

### Security
- XSS 취약점 패치
```

## 문서 작성 원칙

```
1. 독자 중심: 누가 읽을지 고려
2. 간결함: 필요한 정보만
3. 예제 포함: 코드로 보여주기
4. 최신 유지: 코드와 동기화
5. 검색 가능: 키워드 포함
```
