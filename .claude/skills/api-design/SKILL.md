---
name: api-design
description: |
  API 설계 원칙 및 모범 사례.
  "API", "엔드포인트", "REST", "GraphQL" 언급 시 활용.
allowed-tools: Read, Grep, Glob
---

# API Design Skill

## REST API 원칙

### 리소스 중심 URL
```
# 좋은 예
GET    /users           # 사용자 목록
GET    /users/123       # 특정 사용자
POST   /users           # 사용자 생성
PUT    /users/123       # 사용자 수정
DELETE /users/123       # 사용자 삭제

# 나쁜 예
GET    /getUsers
POST   /createUser
POST   /deleteUser/123
```

### 중첩 리소스
```
# 사용자의 게시글
GET    /users/123/posts
POST   /users/123/posts
GET    /users/123/posts/456

# 깊은 중첩은 피하기 (3단계 이상)
# 나쁜 예
GET /users/123/posts/456/comments/789/likes

# 좋은 예
GET /comments/789/likes
```

### 쿼리 파라미터
```
# 필터링
GET /users?status=active&role=admin

# 정렬
GET /users?sort=createdAt&order=desc

# 페이지네이션
GET /users?page=2&limit=20

# 필드 선택
GET /users?fields=id,name,email
```

## HTTP 메서드

| 메서드 | 용도 | 멱등성 | 안전 |
|--------|------|--------|------|
| GET | 조회 | O | O |
| POST | 생성 | X | X |
| PUT | 전체 수정 | O | X |
| PATCH | 부분 수정 | X | X |
| DELETE | 삭제 | O | X |

## 응답 형식

### 성공 응답
```json
// 단일 리소스
{
  "data": {
    "id": "123",
    "name": "John",
    "email": "john@example.com"
  }
}

// 목록
{
  "data": [...],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5
  }
}

// 생성 (201)
{
  "data": {
    "id": "124",
    ...
  },
  "message": "User created successfully"
}
```

### 에러 응답
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": [
      {
        "field": "email",
        "message": "Invalid email format"
      }
    ]
  }
}
```

## 버전 관리

```
# URL 경로 (권장)
GET /api/v1/users
GET /api/v2/users

# 헤더
Accept: application/vnd.api+json; version=1

# 쿼리 파라미터 (비권장)
GET /users?version=1
```

## 인증

### Bearer Token
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

### API Key
```
X-API-Key: your-api-key
# 또는
Authorization: ApiKey your-api-key
```

## 요청/응답 설계

### 요청 본문
```json
// POST /users
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "securePassword123"
}

// PATCH /users/123
{
  "name": "John Updated"
}
```

### 응답 헤더
```
Content-Type: application/json
X-Request-Id: uuid
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640995200
```

## Rate Limiting

```
# 응답 헤더
HTTP/1.1 429 Too Many Requests
Retry-After: 60
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1640995200
```

## HATEOAS (선택적)

```json
{
  "data": {
    "id": "123",
    "name": "John"
  },
  "links": {
    "self": "/users/123",
    "posts": "/users/123/posts",
    "followers": "/users/123/followers"
  }
}
```

## API 문서화 (OpenAPI)

```yaml
openapi: 3.0.0
info:
  title: My API
  version: 1.0.0

paths:
  /users:
    get:
      summary: Get users
      parameters:
        - name: page
          in: query
          schema:
            type: integer
      responses:
        '200':
          description: Success
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/UserList'
```

## 모범 사례 체크리스트

```
[ ] RESTful URL 구조
[ ] 적절한 HTTP 메서드 사용
[ ] 일관된 응답 형식
[ ] 적절한 상태 코드
[ ] 에러 처리 표준화
[ ] 페이지네이션 구현
[ ] 버전 관리
[ ] Rate limiting
[ ] 인증/인가
[ ] API 문서화
```
