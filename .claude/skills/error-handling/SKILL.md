---
name: error-handling
description: |
  에러 처리 패턴 및 모범 사례.
  "에러", "예외", "catch", "throw", "error" 언급 시 활용.
allowed-tools: Read, Edit, Grep
---

# Error Handling Skill

## 에러 처리 원칙

```
1. 빨리 실패하기 (Fail Fast)
2. 구체적인 에러 메시지
3. 적절한 추상화 수준의 에러
4. 복구 가능한 에러 vs 치명적 에러 구분
5. 에러 로깅 (민감 정보 제외)
```

## JavaScript/TypeScript

### 기본 패턴
```javascript
// 동기 에러
try {
  riskyOperation();
} catch (error) {
  if (error instanceof ValidationError) {
    // 검증 에러 처리
  } else if (error instanceof NetworkError) {
    // 네트워크 에러 처리
  } else {
    throw error;  // 알 수 없는 에러는 재던지기
  }
} finally {
  cleanup();
}

// 비동기 에러
async function fetchData() {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new HttpError(response.status);
    }
    return await response.json();
  } catch (error) {
    if (error instanceof HttpError) {
      handleHttpError(error);
    } else {
      throw error;
    }
  }
}
```

### 커스텀 에러 클래스
```typescript
class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public isOperational: boolean = true
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

class ValidationError extends AppError {
  constructor(message: string, public field?: string) {
    super(message, 'VALIDATION_ERROR', 400);
  }
}

class NotFoundError extends AppError {
  constructor(resource: string) {
    super(`${resource} not found`, 'NOT_FOUND', 404);
  }
}
```

### Promise 에러 처리
```javascript
// Promise chain
fetchUser()
  .then(processUser)
  .then(saveUser)
  .catch(error => {
    // 체인 내 모든 에러 처리
  });

// Promise.all 에러
try {
  const results = await Promise.all([p1, p2, p3]);
} catch (error) {
  // 첫 번째 실패한 Promise의 에러
}

// Promise.allSettled (모든 결과 받기)
const results = await Promise.allSettled([p1, p2, p3]);
results.forEach(result => {
  if (result.status === 'rejected') {
    console.error(result.reason);
  }
});
```

## Python

### 기본 패턴
```python
# 구체적인 예외 처리
try:
    result = risky_operation()
except ValueError as e:
    logger.error(f"Invalid value: {e}")
    raise
except IOError as e:
    logger.error(f"IO error: {e}")
    return default_value
except Exception as e:
    logger.exception("Unexpected error")
    raise
finally:
    cleanup()
```

### 커스텀 예외
```python
class AppError(Exception):
    """애플리케이션 기본 예외"""
    def __init__(self, message: str, code: str = None):
        self.message = message
        self.code = code
        super().__init__(self.message)

class ValidationError(AppError):
    """입력 검증 예외"""
    def __init__(self, message: str, field: str = None):
        super().__init__(message, "VALIDATION_ERROR")
        self.field = field

class NotFoundError(AppError):
    """리소스 없음 예외"""
    def __init__(self, resource: str):
        super().__init__(f"{resource} not found", "NOT_FOUND")
```

### Context Manager
```python
from contextlib import contextmanager

@contextmanager
def managed_resource():
    resource = acquire_resource()
    try:
        yield resource
    except Exception as e:
        logger.error(f"Error: {e}")
        raise
    finally:
        release_resource(resource)

# 사용
with managed_resource() as r:
    r.do_something()
```

## API 에러 응답

### REST API 표준 형식
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input data",
    "details": [
      {
        "field": "email",
        "message": "Invalid email format"
      }
    ]
  }
}
```

### HTTP 상태 코드
| 코드 | 의미 | 사용 시점 |
|------|------|----------|
| 400 | Bad Request | 잘못된 요청 |
| 401 | Unauthorized | 인증 필요 |
| 403 | Forbidden | 권한 없음 |
| 404 | Not Found | 리소스 없음 |
| 409 | Conflict | 충돌 |
| 422 | Unprocessable | 검증 실패 |
| 500 | Internal Error | 서버 에러 |

## 에러 로깅

### 로깅해야 할 정보
```
- 에러 메시지
- 스택 트레이스
- 요청 ID / 상관관계 ID
- 사용자 ID (익명화)
- 타임스탬프
- 환경 정보
```

### 로깅하지 말아야 할 정보
```
- 비밀번호
- API 키
- 신용카드 번호
- 개인 식별 정보
- 세션 토큰
```

## 안티패턴

```javascript
// 나쁜 예: 빈 catch
try {
  doSomething();
} catch (e) {
  // 조용히 무시
}

// 나쁜 예: 너무 넓은 catch
try {
  // 많은 코드
} catch (e) {
  // 모든 에러를 같게 처리
}

// 나쁜 예: 에러 삼키기
try {
  return riskyOperation();
} catch (e) {
  return null;  // 에러 정보 손실
}
```
