---
paths: src/auth/**, src/security/**, **/auth*, **/login*, **/password*
---

# 보안 관련 코드 규칙

## 인증

### 비밀번호
```javascript
// 해싱 (bcrypt 권장, cost 12 이상)
const hash = await bcrypt.hash(password, 12);

// 검증
const isValid = await bcrypt.compare(password, hash);
```

### JWT
```javascript
// 토큰 생성
const token = jwt.sign(
  { userId: user.id },
  process.env.JWT_SECRET,
  { expiresIn: '1h' }
);

// 검증
const decoded = jwt.verify(token, process.env.JWT_SECRET);
```

## 입력 검증

### 필수 검증
- 타입 체크
- 길이 제한
- 형식 검증 (이메일, URL 등)
- 화이트리스트 검증

```javascript
const schema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8).max(100),
  role: z.enum(['user', 'admin'])
});
```

## 금지 사항

### 절대 금지
- 하드코딩된 비밀번호/키
- eval() 사용
- 사용자 입력 직접 쿼리 삽입
- 민감 정보 로깅

### 피해야 할 것
- MD5/SHA1 비밀번호 해싱
- 자체 암호화 구현
- 디버그 모드 프로덕션 사용
- CORS 와일드카드 (*)

## 세션 관리

```javascript
// 쿠키 설정
res.cookie('session', token, {
  httpOnly: true,    // JS 접근 방지
  secure: true,      // HTTPS만
  sameSite: 'strict', // CSRF 방지
  maxAge: 3600000    // 1시간
});
```

## 에러 처리

```javascript
// 프로덕션: 일반 메시지
res.status(401).json({ error: 'Authentication failed' });

// 개발: 상세 메시지 (프로덕션에서 비활성화)
if (process.env.NODE_ENV === 'development') {
  res.json({ error: err.message, stack: err.stack });
}
```

## 체크리스트

- [ ] 비밀번호 안전하게 해싱?
- [ ] 토큰 만료 시간 설정?
- [ ] 입력 검증 구현?
- [ ] SQL Injection 방지?
- [ ] XSS 방지?
- [ ] 민감 정보 환경 변수?
- [ ] 에러 메시지 안전?
