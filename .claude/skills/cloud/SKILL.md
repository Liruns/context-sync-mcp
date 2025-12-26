---
name: cloud
description: |
  클라우드 서비스 활용.
  "AWS", "Azure", "GCP", "클라우드", "서버리스" 언급 시 활용.
allowed-tools: Read, Write, Edit, Bash, Grep, Glob
---

# Cloud Skill

## AWS 서비스

### Lambda (Serverless)

```javascript
// Lambda Handler
export const handler = async (event, context) => {
  try {
    const body = JSON.parse(event.body);

    const result = await processData(body);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify(result)
    };
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};

// API Gateway 이벤트 처리
export const apiHandler = async (event) => {
  const { httpMethod, path, pathParameters, queryStringParameters, body } = event;

  switch (`${httpMethod} ${path}`) {
    case 'GET /users':
      return listUsers(queryStringParameters);
    case 'GET /users/{id}':
      return getUser(pathParameters.id);
    case 'POST /users':
      return createUser(JSON.parse(body));
    default:
      return { statusCode: 404, body: 'Not Found' };
  }
};
```

### SAM Template

```yaml
AWSTemplateFormatVersion: '2010-09-09'
Transform: AWS::Serverless-2016-10-31

Globals:
  Function:
    Timeout: 30
    Runtime: nodejs20.x
    Environment:
      Variables:
        TABLE_NAME: !Ref UsersTable

Resources:
  ApiFunction:
    Type: AWS::Serverless::Function
    Properties:
      Handler: src/handlers/api.handler
      Events:
        Api:
          Type: HttpApi
          Properties:
            Path: /{proxy+}
            Method: ANY
      Policies:
        - DynamoDBCrudPolicy:
            TableName: !Ref UsersTable

  UsersTable:
    Type: AWS::DynamoDB::Table
    Properties:
      TableName: users
      AttributeDefinitions:
        - AttributeName: id
          AttributeType: S
      KeySchema:
        - AttributeName: id
          KeyType: HASH
      BillingMode: PAY_PER_REQUEST

Outputs:
  ApiEndpoint:
    Value: !Sub "https://${ServerlessHttpApi}.execute-api.${AWS::Region}.amazonaws.com"
```

### DynamoDB

```javascript
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand
} from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

// 단일 항목 조회
async function getItem(tableName, key) {
  const response = await docClient.send(new GetCommand({
    TableName: tableName,
    Key: key
  }));
  return response.Item;
}

// 항목 저장
async function putItem(tableName, item) {
  await docClient.send(new PutCommand({
    TableName: tableName,
    Item: item
  }));
}

// 쿼리
async function queryItems(tableName, pk, skPrefix) {
  const response = await docClient.send(new QueryCommand({
    TableName: tableName,
    KeyConditionExpression: 'pk = :pk AND begins_with(sk, :sk)',
    ExpressionAttributeValues: {
      ':pk': pk,
      ':sk': skPrefix
    }
  }));
  return response.Items;
}

// 업데이트
async function updateItem(tableName, key, updates) {
  const updateExpression = Object.keys(updates)
    .map((k, i) => `#attr${i} = :val${i}`)
    .join(', ');

  const expressionAttributeNames = Object.fromEntries(
    Object.keys(updates).map((k, i) => [`#attr${i}`, k])
  );

  const expressionAttributeValues = Object.fromEntries(
    Object.values(updates).map((v, i) => [`:val${i}`, v])
  );

  await docClient.send(new UpdateCommand({
    TableName: tableName,
    Key: key,
    UpdateExpression: `SET ${updateExpression}`,
    ExpressionAttributeNames: expressionAttributeNames,
    ExpressionAttributeValues: expressionAttributeValues
  }));
}
```

### S3

```javascript
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const s3 = new S3Client({});

// 파일 업로드
async function uploadFile(bucket, key, body, contentType) {
  await s3.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: body,
    ContentType: contentType
  }));
}

// 서명된 URL 생성 (업로드용)
async function getUploadUrl(bucket, key, expiresIn = 3600) {
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key
  });
  return await getSignedUrl(s3, command, { expiresIn });
}

// 서명된 URL 생성 (다운로드용)
async function getDownloadUrl(bucket, key, expiresIn = 3600) {
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key
  });
  return await getSignedUrl(s3, command, { expiresIn });
}
```

### SQS

```javascript
import {
  SQSClient,
  SendMessageCommand,
  ReceiveMessageCommand,
  DeleteMessageCommand
} from '@aws-sdk/client-sqs';

const sqs = new SQSClient({});

// 메시지 전송
async function sendMessage(queueUrl, message) {
  await sqs.send(new SendMessageCommand({
    QueueUrl: queueUrl,
    MessageBody: JSON.stringify(message),
    MessageAttributes: {
      Type: {
        DataType: 'String',
        StringValue: message.type
      }
    }
  }));
}

// Lambda에서 SQS 이벤트 처리
export const sqsHandler = async (event) => {
  const results = await Promise.allSettled(
    event.Records.map(async (record) => {
      const message = JSON.parse(record.body);
      await processMessage(message);
    })
  );

  // 실패한 메시지만 반환 (부분 실패 처리)
  const failures = results
    .map((result, index) => result.status === 'rejected' ? event.Records[index] : null)
    .filter(Boolean);

  if (failures.length > 0) {
    return {
      batchItemFailures: failures.map(f => ({ itemIdentifier: f.messageId }))
    };
  }
};
```

## Azure 서비스

### Azure Functions

```javascript
// HTTP Trigger
module.exports = async function (context, req) {
  const name = req.query.name || (req.body && req.body.name);

  if (name) {
    context.res = {
      status: 200,
      body: { message: `Hello, ${name}` }
    };
  } else {
    context.res = {
      status: 400,
      body: { error: 'Name is required' }
    };
  }
};

// Queue Trigger
module.exports = async function (context, queueItem) {
  context.log('Processing queue item:', queueItem);

  await processItem(queueItem);

  // 출력 바인딩
  context.bindings.outputBlob = JSON.stringify(result);
};
```

### Cosmos DB

```javascript
const { CosmosClient } = require('@azure/cosmos');

const client = new CosmosClient({
  endpoint: process.env.COSMOS_ENDPOINT,
  key: process.env.COSMOS_KEY
});

const database = client.database('mydb');
const container = database.container('items');

// 항목 생성
async function createItem(item) {
  const { resource } = await container.items.create(item);
  return resource;
}

// 쿼리
async function queryItems(query, parameters) {
  const { resources } = await container.items.query({
    query,
    parameters
  }).fetchAll();
  return resources;
}
```

## GCP 서비스

### Cloud Functions

```javascript
const functions = require('@google-cloud/functions-framework');

functions.http('helloWorld', (req, res) => {
  const name = req.query.name || req.body.name || 'World';
  res.send({ message: `Hello, ${name}!` });
});

functions.cloudEvent('processPubSub', (cloudEvent) => {
  const message = Buffer.from(cloudEvent.data.message.data, 'base64').toString();
  console.log('Received message:', message);
});
```

### Firestore

```javascript
const { Firestore } = require('@google-cloud/firestore');

const firestore = new Firestore();

// 문서 추가
async function addDocument(collection, data) {
  const docRef = await firestore.collection(collection).add(data);
  return docRef.id;
}

// 문서 조회
async function getDocument(collection, id) {
  const doc = await firestore.collection(collection).doc(id).get();
  return doc.exists ? { id: doc.id, ...doc.data() } : null;
}

// 쿼리
async function queryDocuments(collection, field, operator, value) {
  const snapshot = await firestore
    .collection(collection)
    .where(field, operator, value)
    .get();

  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}
```

## 서버리스 패턴

### 이벤트 기반 아키텍처

```
┌─────────┐     ┌─────────┐     ┌──────────┐
│   API   │────→│  Queue  │────→│ Function │
│ Gateway │     │ (SQS)   │     │ (Lambda) │
└─────────┘     └─────────┘     └──────────┘
                                      │
                                      ↓
                              ┌──────────────┐
                              │   Database   │
                              │ (DynamoDB)   │
                              └──────────────┘
```

### Fan-out 패턴

```javascript
// SNS → SQS Fan-out
// 하나의 메시지를 여러 서비스가 병렬 처리

// Publisher
await sns.send(new PublishCommand({
  TopicArn: 'arn:aws:sns:...',
  Message: JSON.stringify(event)
}));

// 각 서비스는 자체 SQS 큐에서 메시지 수신
```

### 재시도 및 DLQ

```yaml
# SAM Template
Resources:
  MyFunction:
    Type: AWS::Serverless::Function
    Properties:
      Events:
        SQSEvent:
          Type: SQS
          Properties:
            Queue: !GetAtt MyQueue.Arn
            BatchSize: 10
            FunctionResponseTypes:
              - ReportBatchItemFailures

  MyQueue:
    Type: AWS::SQS::Queue
    Properties:
      VisibilityTimeout: 180
      RedrivePolicy:
        deadLetterTargetArn: !GetAtt DeadLetterQueue.Arn
        maxReceiveCount: 3

  DeadLetterQueue:
    Type: AWS::SQS::Queue
    Properties:
      MessageRetentionPeriod: 1209600  # 14 days
```

## 비용 최적화

### 전략

```
1. Right-sizing
   - 메모리/CPU 적절히 설정
   - 사용량 기반 조정

2. Reserved Capacity
   - 예약 용량으로 할인
   - Savings Plans 활용

3. Spot/Preemptible 인스턴스
   - 비중요 워크로드에 사용
   - 비용 최대 90% 절감

4. Auto-scaling
   - 수요에 따른 자동 확장/축소
   - 스케줄 기반 스케일링

5. 스토리지 최적화
   - 적절한 스토리지 클래스
   - 수명 주기 정책
```

### 모니터링

```javascript
// CloudWatch 메트릭 게시
import { CloudWatchClient, PutMetricDataCommand } from '@aws-sdk/client-cloudwatch';

const cloudwatch = new CloudWatchClient({});

async function publishMetric(namespace, metricName, value, unit) {
  await cloudwatch.send(new PutMetricDataCommand({
    Namespace: namespace,
    MetricData: [{
      MetricName: metricName,
      Value: value,
      Unit: unit,
      Timestamp: new Date()
    }]
  }));
}
```

## 체크리스트

### 보안
```
□ IAM 최소 권한 원칙
□ 시크릿 관리 (Secrets Manager)
□ VPC 네트워크 격리
□ 암호화 (전송 중/저장 시)
□ WAF 설정
```

### 운영
```
□ 로깅 및 모니터링
□ 알람 설정
□ 백업 정책
□ 재해 복구 계획
□ 비용 알림
```
