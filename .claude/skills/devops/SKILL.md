---
name: devops
description: |
  DevOps 및 CI/CD 파이프라인.
  "배포", "CI/CD", "도커", "쿠버네티스", "파이프라인" 언급 시 활용.
allowed-tools: Read, Write, Edit, Bash, Grep, Glob
---

# DevOps Skill

## CI/CD 파이프라인

### GitHub Actions 기본 구조

```yaml
name: CI/CD Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run tests
        run: npm test -- --coverage

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info

  build:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Build
        run: npm run build

      - name: Upload artifact
        uses: actions/upload-artifact@v4
        with:
          name: build
          path: dist/

  deploy:
    needs: build
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - name: Download artifact
        uses: actions/download-artifact@v4
        with:
          name: build

      - name: Deploy to production
        run: |
          # 배포 스크립트
```

### 환경별 배포

```yaml
deploy:
  runs-on: ubuntu-latest
  strategy:
    matrix:
      environment: [staging, production]
  environment: ${{ matrix.environment }}
  steps:
    - name: Deploy
      env:
        API_URL: ${{ vars.API_URL }}
        API_KEY: ${{ secrets.API_KEY }}
      run: |
        echo "Deploying to ${{ matrix.environment }}"
```

## Docker

### Dockerfile 베스트 프랙티스

```dockerfile
# Multi-stage build
FROM node:20-alpine AS builder

WORKDIR /app

# 의존성 레이어 캐싱
COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

# Production image
FROM node:20-alpine AS runner

WORKDIR /app

# Non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 appuser

# 필요한 파일만 복사
COPY --from=builder --chown=appuser:nodejs /app/dist ./dist
COPY --from=builder --chown=appuser:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=appuser:nodejs /app/package.json ./

USER appuser

EXPOSE 3000

ENV NODE_ENV=production

CMD ["node", "dist/main.js"]
```

### Docker Compose

```yaml
version: '3.8'

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgresql://user:pass@db:5432/app
      - REDIS_URL=redis://redis:6379
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_started
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  db:
    image: postgres:15-alpine
    environment:
      - POSTGRES_USER=user
      - POSTGRES_PASSWORD=pass
      - POSTGRES_DB=app
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U user -d app"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:
```

## Kubernetes

### 기본 리소스

```yaml
# Deployment
apiVersion: apps/v1
kind: Deployment
metadata:
  name: app
  labels:
    app: app
spec:
  replicas: 3
  selector:
    matchLabels:
      app: app
  template:
    metadata:
      labels:
        app: app
    spec:
      containers:
        - name: app
          image: myapp:latest
          ports:
            - containerPort: 3000
          resources:
            requests:
              memory: "128Mi"
              cpu: "100m"
            limits:
              memory: "256Mi"
              cpu: "200m"
          livenessProbe:
            httpGet:
              path: /health
              port: 3000
            initialDelaySeconds: 30
            periodSeconds: 10
          readinessProbe:
            httpGet:
              path: /ready
              port: 3000
            initialDelaySeconds: 5
            periodSeconds: 5
          env:
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: app-secrets
                  key: database-url

---
# Service
apiVersion: v1
kind: Service
metadata:
  name: app-service
spec:
  selector:
    app: app
  ports:
    - protocol: TCP
      port: 80
      targetPort: 3000
  type: ClusterIP

---
# Ingress
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: app-ingress
  annotations:
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
spec:
  ingressClassName: nginx
  tls:
    - hosts:
        - app.example.com
      secretName: app-tls
  rules:
    - host: app.example.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: app-service
                port:
                  number: 80
```

### ConfigMap & Secret

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
data:
  LOG_LEVEL: "info"
  API_TIMEOUT: "30s"

---
apiVersion: v1
kind: Secret
metadata:
  name: app-secrets
type: Opaque
stringData:
  database-url: "postgresql://user:pass@db:5432/app"
  api-key: "super-secret-key"
```

## Infrastructure as Code

### Terraform 기본

```hcl
# main.tf
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  backend "s3" {
    bucket = "terraform-state"
    key    = "prod/terraform.tfstate"
    region = "ap-northeast-2"
  }
}

provider "aws" {
  region = var.region
}

# VPC
resource "aws_vpc" "main" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_hostnames = true

  tags = {
    Name        = "${var.project}-vpc"
    Environment = var.environment
  }
}

# Subnet
resource "aws_subnet" "public" {
  count             = 2
  vpc_id            = aws_vpc.main.id
  cidr_block        = "10.0.${count.index}.0/24"
  availability_zone = data.aws_availability_zones.available.names[count.index]

  map_public_ip_on_launch = true

  tags = {
    Name = "${var.project}-public-${count.index + 1}"
  }
}

# Security Group
resource "aws_security_group" "app" {
  name        = "${var.project}-sg"
  description = "Security group for app"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}
```

### Terraform 모듈화

```hcl
# modules/vpc/main.tf
variable "cidr_block" {
  type = string
}

variable "project" {
  type = string
}

resource "aws_vpc" "this" {
  cidr_block = var.cidr_block

  tags = {
    Name = "${var.project}-vpc"
  }
}

output "vpc_id" {
  value = aws_vpc.this.id
}

# 사용
module "vpc" {
  source = "./modules/vpc"

  cidr_block = "10.0.0.0/16"
  project    = "myapp"
}
```

## 모니터링

### Prometheus + Grafana

```yaml
# prometheus.yml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'app'
    static_configs:
      - targets: ['app:3000']
    metrics_path: /metrics

  - job_name: 'node'
    static_configs:
      - targets: ['node-exporter:9100']
```

### 애플리케이션 메트릭

```javascript
// Node.js with prom-client
const promClient = require('prom-client');

const httpRequestDuration = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.3, 0.5, 1, 3, 5, 10]
});

const httpRequestTotal = new promClient.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code']
});

// 미들웨어
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    httpRequestDuration.observe(
      { method: req.method, route: req.path, status_code: res.statusCode },
      duration
    );
    httpRequestTotal.inc(
      { method: req.method, route: req.path, status_code: res.statusCode }
    );
  });
  next();
});
```

## 배포 전략

### Blue-Green

```yaml
# 두 환경을 동시에 유지
# 트래픽을 한 번에 전환

# Ingress에서 서비스 전환
spec:
  rules:
    - http:
        paths:
          - backend:
              service:
                name: app-green  # app-blue에서 전환
```

### Canary

```yaml
# Istio VirtualService
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: app
spec:
  hosts:
    - app
  http:
    - match:
        - headers:
            x-canary:
              exact: "true"
      route:
        - destination:
            host: app-canary
    - route:
        - destination:
            host: app-stable
          weight: 90
        - destination:
            host: app-canary
          weight: 10
```

### Rolling Update

```yaml
# Kubernetes Deployment
spec:
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1        # 추가 Pod 수
      maxUnavailable: 0  # 중단 Pod 수
```

## 체크리스트

### 배포 전
```
□ 테스트 통과
□ 코드 리뷰 완료
□ 환경 변수 확인
□ 마이그레이션 준비
□ 롤백 계획 수립
```

### 배포 후
```
□ 헬스체크 확인
□ 로그 모니터링
□ 메트릭 확인
□ 알림 정상 동작
□ 기능 테스트
```
