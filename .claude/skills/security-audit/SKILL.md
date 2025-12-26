---
name: security-audit
description: |
  보안 감사 및 취약점 검사 지식.
  "보안", "security", "취약점", "vulnerability", "인증", "auth" 언급 시 활용.
allowed-tools: Read, Grep, Glob
---

# Security Audit Skill

## OWASP Top 10 Quick Reference

### 1. Injection
**위험**: SQL, NoSQL, OS, LDAP 인젝션
**방어**:
```javascript
// 나쁜 예
const query = `SELECT * FROM users WHERE id = ${userId}`;

// 좋은 예
const query = 'SELECT * FROM users WHERE id = ?';
db.execute(query, [userId]);
```

### 2. Broken Authentication
**위험**: 세션 하이재킹, 자격증명 노출
**방어**:
```javascript
// 비밀번호 해싱
const hash = await bcrypt.hash(password, 12);

// 세션 설정
app.use(session({
  secret: process.env.SESSION_SECRET,
  cookie: {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    maxAge: 3600000
  }
}));
```

### 3. Sensitive Data Exposure
**위험**: 민감정보 평문 저장/전송
**방어**:
- HTTPS 강제
- 민감 데이터 암호화
- 불필요한 데이터 수집 금지
- 로그에서 민감정보 마스킹

### 4. XSS (Cross-Site Scripting)
**위험**: 스크립트 주입
**방어**:
```javascript
// React (자동 이스케이프)
<div>{userInput}</div>  // 안전

// 위험 (피하기)
<div dangerouslySetInnerHTML={{__html: userInput}} />

// 수동 이스케이프
function escapeHtml(str) {
  return str.replace(/[&<>"']/g, (m) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[m]));
}
```

### 5. Broken Access Control
**위험**: 권한 우회
**방어**:
```javascript
// 모든 요청에서 권한 확인
async function checkPermission(userId, resourceId) {
  const resource = await Resource.findById(resourceId);
  if (resource.ownerId !== userId) {
    throw new ForbiddenError();
  }
}
```

## 보안 검색 패턴

### 하드코딩된 시크릿
```bash
grep -rn "password\s*=\s*['\"]" src/
grep -rn "api[_-]?key\s*[:=]" src/
grep -rn "secret\s*[:=]" src/
grep -rn "token\s*[:=]\s*['\"][a-zA-Z0-9]" src/
```

### SQL Injection
```bash
grep -rn "query.*\$" --include="*.js" src/
grep -rn "execute.*%s" --include="*.py" src/
grep -rn "raw\s*\(" --include="*.py" src/
```

### 위험한 함수
```bash
grep -rn "eval\s*\(" src/
grep -rn "innerHTML\s*=" src/
grep -rn "document\.write" src/
grep -rn "child_process\.exec" src/
```

## 보안 헤더 체크리스트

```javascript
// Helmet.js 사용 권장
app.use(helmet());

// 또는 수동 설정
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000');
  res.setHeader('Content-Security-Policy', "default-src 'self'");
  next();
});
```

## 입력 검증

```javascript
// Zod 예시
const userSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(100),
  age: z.number().int().positive().max(150)
});

// 검증
const validatedData = userSchema.parse(input);
```

## 의존성 취약점 검사

```bash
# npm
npm audit
npm audit fix

# yarn
yarn audit

# Python
pip-audit
safety check
```

## 보안 로깅

```javascript
// 로그에 포함할 것
logger.info('Login attempt', {
  userId: user.id,
  ip: req.ip,
  userAgent: req.headers['user-agent'],
  timestamp: new Date()
});

// 로그에 포함하지 말 것
// password, token, creditCard, ssn, apiKey
```

## 환경별 설정

```
Development:
- 상세 에러 메시지 OK
- 디버그 모드 OK

Production:
- 일반적인 에러 메시지
- 디버그 모드 OFF
- HTTPS 강제
- 보안 헤더 활성화
```
