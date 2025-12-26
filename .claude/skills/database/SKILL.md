---
name: database
description: |
  데이터베이스 설계 및 최적화.
  "DB", "데이터베이스", "쿼리", "스키마", "인덱스" 언급 시 활용.
allowed-tools: Read, Write, Edit, Bash, Grep, Glob
---

# Database Skill

## 데이터베이스 설계 원칙

### 정규화

```
1NF: 원자값
- 각 셀에 단일 값만
- 반복 그룹 제거

2NF: 부분 의존성 제거
- 1NF + 기본키 전체에 의존

3NF: 이행 의존성 제거
- 2NF + 비키 속성 간 의존성 제거

BCNF: 결정자가 후보키
- 3NF + 모든 결정자가 후보키
```

### 반정규화 (성능 최적화)

```
언제 적용:
- 자주 조인되는 테이블
- 읽기 중심 워크로드
- 집계 데이터

기법:
- 중복 저장
- 파생 컬럼
- 요약 테이블
```

## 스키마 설계

### 관계 모델링

```sql
-- 1:1 관계
CREATE TABLE users (
    id UUID PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL
);

CREATE TABLE user_profiles (
    user_id UUID PRIMARY KEY REFERENCES users(id),
    bio TEXT,
    avatar_url VARCHAR(500)
);

-- 1:N 관계
CREATE TABLE posts (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id),
    title VARCHAR(255) NOT NULL,
    content TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- N:M 관계
CREATE TABLE post_tags (
    post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
    tag_id UUID REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (post_id, tag_id)
);
```

### 인덱스 설계

```sql
-- B-Tree (기본, 범위 검색)
CREATE INDEX idx_users_email ON users(email);

-- 복합 인덱스 (쿼리 패턴에 맞게)
CREATE INDEX idx_posts_user_created
ON posts(user_id, created_at DESC);

-- 부분 인덱스 (조건부 데이터)
CREATE INDEX idx_active_users
ON users(email) WHERE is_active = true;

-- 커버링 인덱스 (쿼리 전체 커버)
CREATE INDEX idx_posts_covering
ON posts(user_id) INCLUDE (title, created_at);

-- GIN (배열, 전문 검색)
CREATE INDEX idx_posts_tags ON posts USING GIN(tags);

-- GiST (지리 데이터)
CREATE INDEX idx_locations_geo
ON locations USING GIST(coordinates);
```

## 쿼리 최적화

### EXPLAIN 분석

```sql
EXPLAIN ANALYZE
SELECT u.name, COUNT(p.id) as post_count
FROM users u
LEFT JOIN posts p ON u.id = p.user_id
WHERE u.created_at > '2024-01-01'
GROUP BY u.id
ORDER BY post_count DESC
LIMIT 10;

-- 확인 사항:
-- 1. Seq Scan vs Index Scan
-- 2. 예상 비용 (cost)
-- 3. 실제 시간 (actual time)
-- 4. 행 수 추정 정확도
```

### 쿼리 개선 패턴

```sql
-- Bad: SELECT *
SELECT * FROM users WHERE id = 1;

-- Good: 필요한 컬럼만
SELECT id, name, email FROM users WHERE id = 1;

-- Bad: N+1 쿼리
FOR EACH user IN users:
    SELECT * FROM posts WHERE user_id = user.id;

-- Good: JOIN 사용
SELECT u.*, p.*
FROM users u
LEFT JOIN posts p ON u.id = p.user_id;

-- Bad: 함수로 인덱스 무효화
SELECT * FROM users WHERE LOWER(email) = 'test@example.com';

-- Good: 함수형 인덱스 또는 저장 시 정규화
CREATE INDEX idx_users_email_lower ON users(LOWER(email));

-- Bad: OR 조건
SELECT * FROM posts WHERE user_id = 1 OR category_id = 2;

-- Good: UNION
SELECT * FROM posts WHERE user_id = 1
UNION
SELECT * FROM posts WHERE category_id = 2;
```

### 페이지네이션

```sql
-- Offset (작은 데이터)
SELECT * FROM posts
ORDER BY created_at DESC
LIMIT 20 OFFSET 100;

-- Cursor (대용량 데이터, 권장)
SELECT * FROM posts
WHERE created_at < '2024-01-15T10:00:00Z'
ORDER BY created_at DESC
LIMIT 20;

-- Keyset (ID 기반)
SELECT * FROM posts
WHERE id < 12345
ORDER BY id DESC
LIMIT 20;
```

## 트랜잭션 관리

### ACID 속성

```
A - Atomicity: 전부 또는 전무
C - Consistency: 일관성 유지
I - Isolation: 격리 수준
D - Durability: 영속성
```

### 격리 수준

```sql
-- Read Uncommitted (Dirty Read 가능)
-- Read Committed (기본값, Dirty Read 방지)
-- Repeatable Read (Phantom Read 가능)
-- Serializable (완전 격리)

SET TRANSACTION ISOLATION LEVEL REPEATABLE READ;
BEGIN;
-- 작업
COMMIT;
```

### 데드락 방지

```
1. 락 순서 일관성
   - 항상 같은 순서로 테이블/행 접근

2. 짧은 트랜잭션
   - 락 유지 시간 최소화

3. 적절한 락 레벨
   - 필요한 최소 범위만 락

4. 타임아웃 설정
   SET lock_timeout = '5s';
```

## ORM 패턴

### N+1 문제 해결

```javascript
// Prisma - include
const users = await prisma.user.findMany({
  include: { posts: true }
});

// TypeORM - relations
const users = await userRepository.find({
  relations: ['posts']
});

// Sequelize - include
const users = await User.findAll({
  include: [{ model: Post }]
});
```

### 배치 처리

```javascript
// 대량 삽입
await prisma.user.createMany({
  data: users,
  skipDuplicates: true
});

// 트랜잭션
await prisma.$transaction([
  prisma.user.create({ data: user1 }),
  prisma.post.create({ data: post1 }),
]);

// 인터랙티브 트랜잭션
await prisma.$transaction(async (tx) => {
  const user = await tx.user.create({ data: userData });
  await tx.post.create({
    data: { ...postData, userId: user.id }
  });
});
```

## 마이그레이션

### 마이그레이션 파일 구조

```javascript
// 예: 20240115_add_user_role.js
export async function up(db) {
  await db.query(`
    ALTER TABLE users
    ADD COLUMN role VARCHAR(50) DEFAULT 'user'
  `);

  await db.query(`
    CREATE INDEX idx_users_role ON users(role)
  `);
}

export async function down(db) {
  await db.query(`DROP INDEX idx_users_role`);
  await db.query(`ALTER TABLE users DROP COLUMN role`);
}
```

### 무중단 마이그레이션

```
1. 컬럼 추가 (호환)
   - NULL 허용 또는 기본값

2. 이중 쓰기
   - 새 컬럼에도 데이터 쓰기

3. 데이터 마이그레이션
   - 백그라운드로 기존 데이터 이전

4. 읽기 전환
   - 새 컬럼에서 읽기

5. 정리
   - 이전 컬럼 제거 (별도 배포)
```

## 모니터링

### 주요 메트릭

```
성능:
- Query response time
- Slow queries (> 1s)
- Lock wait time
- Cache hit ratio

연결:
- Active connections
- Connection pool usage
- Connection errors

용량:
- Database size
- Table sizes
- Index sizes
- Disk usage
```

### 슬로우 쿼리 분석

```sql
-- PostgreSQL
SELECT
  calls,
  mean_exec_time,
  query
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;

-- MySQL
SELECT * FROM mysql.slow_log
ORDER BY query_time DESC
LIMIT 10;
```

## 체크리스트

### 설계 시
```
□ 정규화 수준 결정
□ 적절한 데이터 타입 선택
□ 필요한 인덱스 설계
□ 외래키 제약조건 정의
□ 기본값 및 NOT NULL 정의
```

### 쿼리 작성 시
```
□ EXPLAIN으로 실행 계획 확인
□ 필요한 컬럼만 SELECT
□ 적절한 인덱스 활용
□ N+1 쿼리 방지
□ 페이지네이션 구현
```

### 운영 시
```
□ 백업 정책 수립
□ 모니터링 설정
□ 슬로우 쿼리 알림
□ 인덱스 사용률 확인
□ 테이블 bloat 관리
```
