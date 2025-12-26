---
name: microservices
description: |
  마이크로서비스 아키텍처 패턴.
  "마이크로서비스", "분산 시스템", "서비스 간 통신", "이벤트" 언급 시 활용.
allowed-tools: Read, Write, Edit, Bash, Grep, Glob
---

# Microservices Skill

## 마이크로서비스 원칙

### 핵심 특성

```
1. 단일 책임
   - 하나의 비즈니스 도메인에 집중
   - 독립적인 데이터 저장소

2. 독립 배포
   - 다른 서비스에 영향 없이 배포
   - 자체 배포 파이프라인

3. 분산 데이터
   - Database per Service
   - 데이터 일관성 관리

4. 기술 다양성
   - 서비스별 최적 기술 스택
   - 폴리글랏 프로그래밍
```

## 서비스 간 통신

### 동기 통신 (REST/gRPC)

```javascript
// REST API 클라이언트
class UserServiceClient {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
  }

  async getUser(id) {
    const response = await fetch(`${this.baseUrl}/users/${id}`);
    if (!response.ok) {
      throw new ServiceError('UserService', response.status);
    }
    return response.json();
  }
}

// gRPC 클라이언트 (Node.js)
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');

const packageDef = protoLoader.loadSync('user.proto');
const protoDescriptor = grpc.loadPackageDefinition(packageDef);

const client = new protoDescriptor.UserService(
  'user-service:50051',
  grpc.credentials.createInsecure()
);

function getUser(id) {
  return new Promise((resolve, reject) => {
    client.GetUser({ id }, (err, response) => {
      if (err) reject(err);
      else resolve(response);
    });
  });
}
```

### 비동기 통신 (Message Queue)

```javascript
// RabbitMQ Publisher
const amqp = require('amqplib');

async function publishEvent(exchange, routingKey, message) {
  const connection = await amqp.connect(process.env.RABBITMQ_URL);
  const channel = await connection.createChannel();

  await channel.assertExchange(exchange, 'topic', { durable: true });

  channel.publish(
    exchange,
    routingKey,
    Buffer.from(JSON.stringify(message)),
    { persistent: true }
  );

  await channel.close();
  await connection.close();
}

// Consumer
async function consumeEvents(exchange, queue, pattern, handler) {
  const connection = await amqp.connect(process.env.RABBITMQ_URL);
  const channel = await connection.createChannel();

  await channel.assertExchange(exchange, 'topic', { durable: true });
  await channel.assertQueue(queue, { durable: true });
  await channel.bindQueue(queue, exchange, pattern);

  channel.consume(queue, async (msg) => {
    try {
      const event = JSON.parse(msg.content.toString());
      await handler(event);
      channel.ack(msg);
    } catch (error) {
      channel.nack(msg, false, false);  // Dead Letter Queue로
    }
  });
}

// 사용 예
publishEvent('orders', 'order.created', {
  orderId: '123',
  userId: 'user-1',
  items: [{ productId: 'p-1', quantity: 2 }]
});

consumeEvents('orders', 'inventory-queue', 'order.created', async (event) => {
  await reserveInventory(event.items);
});
```

### 이벤트 스키마

```javascript
// Avro 스키마
const orderCreatedSchema = {
  type: 'record',
  name: 'OrderCreated',
  namespace: 'com.example.orders',
  fields: [
    { name: 'orderId', type: 'string' },
    { name: 'userId', type: 'string' },
    { name: 'items', type: { type: 'array', items: 'OrderItem' } },
    { name: 'timestamp', type: 'long', logicalType: 'timestamp-millis' }
  ]
};

// JSON Schema
const orderCreatedJsonSchema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  type: 'object',
  required: ['orderId', 'userId', 'items'],
  properties: {
    orderId: { type: 'string', format: 'uuid' },
    userId: { type: 'string' },
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          productId: { type: 'string' },
          quantity: { type: 'integer', minimum: 1 }
        }
      }
    }
  }
};
```

## 패턴

### API Gateway

```yaml
# Kong Gateway 설정
services:
  - name: user-service
    url: http://user-service:3000
    routes:
      - name: user-route
        paths:
          - /api/users
    plugins:
      - name: rate-limiting
        config:
          minute: 100
      - name: jwt
        config:
          secret_is_base64: false

  - name: order-service
    url: http://order-service:3000
    routes:
      - name: order-route
        paths:
          - /api/orders
```

### Circuit Breaker

```javascript
const CircuitBreaker = require('opossum');

const circuitOptions = {
  timeout: 3000,              // 타임아웃
  errorThresholdPercentage: 50, // 에러 비율 임계값
  resetTimeout: 30000,        // 회로 리셋 시간
  volumeThreshold: 5          // 최소 요청 수
};

const breaker = new CircuitBreaker(callExternalService, circuitOptions);

breaker.on('open', () => console.log('Circuit opened!'));
breaker.on('halfOpen', () => console.log('Circuit half-open'));
breaker.on('close', () => console.log('Circuit closed'));

// 사용
async function getUser(id) {
  try {
    return await breaker.fire(id);
  } catch (error) {
    if (error.name === 'CircuitBrokenError') {
      return getFallbackUser(id);
    }
    throw error;
  }
}
```

### Saga 패턴

```javascript
// Orchestration-based Saga
class OrderSaga {
  constructor(orderService, inventoryService, paymentService) {
    this.steps = [
      {
        name: 'createOrder',
        execute: (data) => orderService.create(data),
        compensate: (data, result) => orderService.cancel(result.orderId)
      },
      {
        name: 'reserveInventory',
        execute: (data) => inventoryService.reserve(data.items),
        compensate: (data) => inventoryService.release(data.items)
      },
      {
        name: 'processPayment',
        execute: (data) => paymentService.process(data.payment),
        compensate: (data) => paymentService.refund(data.payment)
      }
    ];
  }

  async execute(data) {
    const completed = [];

    try {
      for (const step of this.steps) {
        const result = await step.execute(data);
        completed.push({ step, data, result });
      }
      return { success: true };
    } catch (error) {
      // 보상 트랜잭션 실행
      for (const { step, data, result } of completed.reverse()) {
        try {
          await step.compensate(data, result);
        } catch (compensateError) {
          console.error(`Failed to compensate ${step.name}:`, compensateError);
        }
      }
      return { success: false, error };
    }
  }
}
```

### Service Discovery

```javascript
// Consul 등록
const Consul = require('consul');
const consul = new Consul();

const serviceId = `user-service-${process.env.HOSTNAME}`;

await consul.agent.service.register({
  id: serviceId,
  name: 'user-service',
  address: process.env.HOST,
  port: parseInt(process.env.PORT),
  check: {
    http: `http://${process.env.HOST}:${process.env.PORT}/health`,
    interval: '10s'
  }
});

// 서비스 조회
async function getService(name) {
  const services = await consul.health.service({
    service: name,
    passing: true
  });

  // 로드 밸런싱 (랜덤)
  const service = services[Math.floor(Math.random() * services.length)];
  return `http://${service.Service.Address}:${service.Service.Port}`;
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  await consul.agent.service.deregister(serviceId);
  process.exit(0);
});
```

## 데이터 관리

### 이벤트 소싱

```javascript
class EventStore {
  constructor(db) {
    this.db = db;
  }

  async append(aggregateId, aggregateType, events, expectedVersion) {
    const currentVersion = await this.getVersion(aggregateId);

    if (currentVersion !== expectedVersion) {
      throw new ConcurrencyError(aggregateId, expectedVersion, currentVersion);
    }

    const storedEvents = events.map((event, index) => ({
      aggregate_id: aggregateId,
      aggregate_type: aggregateType,
      event_type: event.type,
      event_data: JSON.stringify(event.data),
      version: expectedVersion + index + 1,
      timestamp: new Date()
    }));

    await this.db.events.insertMany(storedEvents);

    // 이벤트 발행
    for (const event of events) {
      await this.publisher.publish(event);
    }
  }

  async getEvents(aggregateId, fromVersion = 0) {
    return await this.db.events.find({
      aggregate_id: aggregateId,
      version: { $gt: fromVersion }
    }).sort({ version: 1 });
  }
}

// Aggregate
class Order {
  constructor() {
    this.changes = [];
  }

  static fromEvents(events) {
    const order = new Order();
    for (const event of events) {
      order.apply(event, false);
    }
    return order;
  }

  create(id, userId, items) {
    this.apply({
      type: 'OrderCreated',
      data: { id, userId, items }
    });
  }

  apply(event, isNew = true) {
    switch (event.type) {
      case 'OrderCreated':
        this.id = event.data.id;
        this.userId = event.data.userId;
        this.items = event.data.items;
        this.status = 'created';
        break;
      case 'OrderShipped':
        this.status = 'shipped';
        break;
    }

    if (isNew) {
      this.changes.push(event);
    }
  }
}
```

### CQRS

```javascript
// Write Model
class OrderCommandHandler {
  async handle(command) {
    switch (command.type) {
      case 'CreateOrder':
        const order = new Order();
        order.create(command.data);
        await this.eventStore.append(
          order.id,
          'Order',
          order.changes,
          -1
        );
        break;
    }
  }
}

// Read Model (Projection)
class OrderProjection {
  async handle(event) {
    switch (event.type) {
      case 'OrderCreated':
        await this.readDb.orders.insert({
          id: event.data.id,
          userId: event.data.userId,
          status: 'created',
          createdAt: event.timestamp
        });
        break;
      case 'OrderShipped':
        await this.readDb.orders.update(
          { id: event.data.orderId },
          { $set: { status: 'shipped', shippedAt: event.timestamp } }
        );
        break;
    }
  }
}

// Query Handler
class OrderQueryHandler {
  async getOrdersByUser(userId) {
    return await this.readDb.orders.find({ userId });
  }
}
```

## 관찰성 (Observability)

### 분산 추적

```javascript
const { NodeTracerProvider } = require('@opentelemetry/sdk-trace-node');
const { SimpleSpanProcessor } = require('@opentelemetry/sdk-trace-base');
const { JaegerExporter } = require('@opentelemetry/exporter-jaeger');

const provider = new NodeTracerProvider();
provider.addSpanProcessor(new SimpleSpanProcessor(new JaegerExporter()));
provider.register();

const tracer = provider.getTracer('order-service');

async function processOrder(order) {
  const span = tracer.startSpan('processOrder');
  span.setAttribute('order.id', order.id);

  try {
    await reserveInventory(order.items, span);
    await processPayment(order.payment, span);
    span.setStatus({ code: SpanStatusCode.OK });
  } catch (error) {
    span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
    throw error;
  } finally {
    span.end();
  }
}
```

### 상관관계 ID

```javascript
// 미들웨어
function correlationIdMiddleware(req, res, next) {
  req.correlationId = req.headers['x-correlation-id'] || uuid();
  res.setHeader('x-correlation-id', req.correlationId);
  next();
}

// HTTP 클라이언트에 전파
async function callService(url, correlationId) {
  return await fetch(url, {
    headers: { 'x-correlation-id': correlationId }
  });
}

// 메시지에 포함
async function publishEvent(event, correlationId) {
  await publisher.publish({
    ...event,
    metadata: { correlationId }
  });
}
```

## 체크리스트

### 서비스 설계
```
□ 명확한 도메인 경계
□ 독립적인 데이터 저장소
□ 잘 정의된 API 계약
□ 버전 관리 전략
□ 장애 격리 설계
```

### 운영
```
□ 분산 추적 구현
□ 중앙 집중 로깅
□ 헬스 체크 엔드포인트
□ Circuit Breaker 적용
□ 그레이스풀 셧다운
```
