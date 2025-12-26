---
paths: src/backend/**, src/api/**, src/server/**, src/routes/**
---

# Backend 개발 규칙

## API 설계

### RESTful 규칙
```
GET    /api/users           # 목록
GET    /api/users/:id       # 상세
POST   /api/users           # 생성
PUT    /api/users/:id       # 수정
DELETE /api/users/:id       # 삭제
```

### 응답 형식
```json
// 성공
{
  "data": { ... },
  "meta": { "page": 1, "total": 100 }
}

// 에러
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input",
    "details": [...]
  }
}
```

## 에러 처리

### 커스텀 에러 클래스
```typescript
class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public code: string
  ) {
    super(message);
  }
}
```

### 에러 미들웨어
```typescript
app.use((err, req, res, next) => {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: { code: err.code, message: err.message }
    });
  }
  // 예상치 못한 에러
  logger.error(err);
  res.status(500).json({ error: { message: 'Internal error' } });
});
```

## 검증

- 입력 검증 필수 (Zod, Joi, class-validator)
- 타입 체크
- SQL Injection 방지 (파라미터 바인딩)

## 인증/인가

- JWT 또는 세션 기반
- 모든 보호된 라우트에 미들웨어
- 역할 기반 접근 제어 (RBAC)

## 로깅

- 요청/응답 로깅
- 에러 로깅 (스택 트레이스)
- 민감 정보 마스킹
