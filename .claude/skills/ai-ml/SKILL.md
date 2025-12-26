---
name: ai-ml
description: |
  AI/ML 개발 및 통합.
  "AI", "ML", "머신러닝", "LLM", "모델" 언급 시 활용.
allowed-tools: Read, Write, Edit, Bash, Grep, Glob
---

# AI/ML Skill

## LLM 통합

### OpenAI API

```javascript
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Chat Completion
async function chat(messages) {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages,
    temperature: 0.7,
    max_tokens: 1000
  });

  return response.choices[0].message.content;
}

// Streaming
async function chatStream(messages, onChunk) {
  const stream = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages,
    stream: true
  });

  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content || '';
    onChunk(content);
  }
}

// Function Calling
const tools = [
  {
    type: 'function',
    function: {
      name: 'get_weather',
      description: 'Get current weather for a location',
      parameters: {
        type: 'object',
        properties: {
          location: { type: 'string', description: 'City name' },
          unit: { type: 'string', enum: ['celsius', 'fahrenheit'] }
        },
        required: ['location']
      }
    }
  }
];

async function chatWithTools(messages) {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages,
    tools,
    tool_choice: 'auto'
  });

  const toolCalls = response.choices[0].message.tool_calls;
  if (toolCalls) {
    // 함수 실행 및 결과 반환
  }
}
```

### Anthropic Claude

```javascript
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

async function chat(messages) {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    messages
  });

  return response.content[0].text;
}

// Streaming
async function chatStream(messages, onChunk) {
  const stream = await anthropic.messages.stream({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    messages
  });

  for await (const event of stream) {
    if (event.type === 'content_block_delta') {
      onChunk(event.delta.text);
    }
  }
}
```

## 프롬프트 엔지니어링

### 프롬프트 구조

```javascript
const systemPrompt = `
You are an expert assistant specialized in {domain}.

## Instructions
- Be concise and accurate
- Provide code examples when relevant
- Ask clarifying questions if needed

## Output Format
Respond in {format} format.

## Constraints
- Maximum {maxLength} characters
- Focus only on {topic}
`;

const userPrompt = `
Given the following context:
{context}

Question: {question}

Please provide a detailed answer.
`;
```

### 프롬프트 기법

```
1. Zero-shot
   직접 질문만 제공

2. Few-shot
   예시와 함께 질문

   Example 1:
   Input: X
   Output: Y

   Example 2:
   Input: A
   Output: B

   Now:
   Input: {actual_input}
   Output:

3. Chain-of-Thought
   "Let's think step by step..."
   단계별 추론 유도

4. Self-Consistency
   여러 번 실행 후 다수결

5. ReAct (Reasoning + Acting)
   Thought: 분석
   Action: 도구 사용
   Observation: 결과 확인
   ... 반복 ...
   Answer: 최종 답변
```

## RAG (Retrieval-Augmented Generation)

### 벡터 데이터베이스 설정

```javascript
import { Pinecone } from '@pinecone-database/pinecone';
import OpenAI from 'openai';

const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY
});

const openai = new OpenAI();
const index = pinecone.index('documents');

// 임베딩 생성
async function createEmbedding(text) {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text
  });
  return response.data[0].embedding;
}

// 문서 인덱싱
async function indexDocument(id, text, metadata) {
  const embedding = await createEmbedding(text);

  await index.upsert([{
    id,
    values: embedding,
    metadata: { ...metadata, text }
  }]);
}

// 검색
async function search(query, topK = 5) {
  const queryEmbedding = await createEmbedding(query);

  const results = await index.query({
    vector: queryEmbedding,
    topK,
    includeMetadata: true
  });

  return results.matches;
}

// RAG 파이프라인
async function ragQuery(question) {
  // 1. 관련 문서 검색
  const docs = await search(question);

  // 2. 컨텍스트 구성
  const context = docs
    .map(d => d.metadata.text)
    .join('\n\n');

  // 3. LLM으로 답변 생성
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: `Answer based on the following context:\n\n${context}`
      },
      { role: 'user', content: question }
    ]
  });

  return response.choices[0].message.content;
}
```

### 문서 청킹

```javascript
function chunkDocument(text, options = {}) {
  const {
    chunkSize = 1000,
    overlap = 200,
    separator = '\n\n'
  } = options;

  const chunks = [];
  const paragraphs = text.split(separator);

  let currentChunk = '';

  for (const paragraph of paragraphs) {
    if ((currentChunk + paragraph).length > chunkSize) {
      if (currentChunk) {
        chunks.push(currentChunk.trim());
        // 오버랩 유지
        const words = currentChunk.split(' ');
        currentChunk = words.slice(-Math.floor(overlap / 5)).join(' ');
      }
    }
    currentChunk += (currentChunk ? separator : '') + paragraph;
  }

  if (currentChunk) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}
```

## 에이전트 개발

### 기본 에이전트 구조

```javascript
class Agent {
  constructor(llm, tools) {
    this.llm = llm;
    this.tools = tools;
    this.memory = [];
  }

  async run(task) {
    this.memory.push({ role: 'user', content: task });

    while (true) {
      // 1. LLM에게 다음 액션 결정 요청
      const response = await this.llm.chat({
        messages: [
          { role: 'system', content: this.systemPrompt },
          ...this.memory
        ],
        tools: this.tools
      });

      // 2. 액션 실행
      if (response.tool_calls) {
        for (const call of response.tool_calls) {
          const result = await this.executeTool(call);
          this.memory.push({
            role: 'tool',
            content: JSON.stringify(result),
            tool_call_id: call.id
          });
        }
      }

      // 3. 완료 여부 확인
      if (response.finish_reason === 'stop') {
        return response.content;
      }
    }
  }

  async executeTool(call) {
    const tool = this.tools.find(t => t.name === call.function.name);
    return await tool.execute(JSON.parse(call.function.arguments));
  }
}
```

### LangChain 사용

```javascript
import { ChatOpenAI } from '@langchain/openai';
import { PromptTemplate } from '@langchain/core/prompts';
import { RunnableSequence } from '@langchain/core/runnables';

const model = new ChatOpenAI({
  modelName: 'gpt-4o',
  temperature: 0.7
});

// 체인 구성
const chain = RunnableSequence.from([
  PromptTemplate.fromTemplate(`
    Summarize the following text:
    {text}
  `),
  model,
  (output) => output.content
]);

const result = await chain.invoke({ text: 'Long document...' });
```

## 모델 평가

### 메트릭

```javascript
// 텍스트 유사도
function cosineSimilarity(a, b) {
  const dotProduct = a.reduce((sum, ai, i) => sum + ai * b[i], 0);
  const magnitudeA = Math.sqrt(a.reduce((sum, ai) => sum + ai * ai, 0));
  const magnitudeB = Math.sqrt(b.reduce((sum, bi) => sum + bi * bi, 0));
  return dotProduct / (magnitudeA * magnitudeB);
}

// ROUGE 스코어 (간단 버전)
function rougeN(reference, generated, n = 1) {
  const refNgrams = getNgrams(reference, n);
  const genNgrams = getNgrams(generated, n);

  const overlap = [...refNgrams].filter(ng => genNgrams.has(ng)).length;
  const recall = overlap / refNgrams.size;
  const precision = overlap / genNgrams.size;

  return {
    precision,
    recall,
    f1: 2 * (precision * recall) / (precision + recall)
  };
}

// LLM-as-Judge
async function evaluateResponse(query, response, criteria) {
  const prompt = `
    Evaluate the following response on a scale of 1-5 for each criterion:

    Query: ${query}
    Response: ${response}

    Criteria:
    ${criteria.map(c => `- ${c}`).join('\n')}

    Provide scores and explanations.
  `;

  return await llm.chat([{ role: 'user', content: prompt }]);
}
```

## 비용 최적화

### 토큰 관리

```javascript
import { encoding_for_model } from 'tiktoken';

const enc = encoding_for_model('gpt-4o');

function countTokens(text) {
  return enc.encode(text).length;
}

function estimateCost(inputTokens, outputTokens, model) {
  const pricing = {
    'gpt-4o': { input: 0.005, output: 0.015 },
    'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
    'claude-sonnet-4-20250514': { input: 0.003, output: 0.015 }
  };

  const price = pricing[model];
  return (inputTokens / 1000) * price.input +
         (outputTokens / 1000) * price.output;
}
```

### 캐싱

```javascript
import { Redis } from 'ioredis';
import crypto from 'crypto';

const redis = new Redis();

async function cachedChat(messages, model) {
  const key = crypto
    .createHash('sha256')
    .update(JSON.stringify({ messages, model }))
    .digest('hex');

  const cached = await redis.get(key);
  if (cached) {
    return JSON.parse(cached);
  }

  const response = await llm.chat({ messages, model });
  await redis.setex(key, 3600, JSON.stringify(response));

  return response;
}
```

## 체크리스트

### 프로덕션 배포
```
□ API 키 환경 변수화
□ Rate limiting 구현
□ 에러 핸들링 및 재시도
□ 비용 모니터링
□ 응답 시간 모니터링
□ 프롬프트 버전 관리
□ A/B 테스트 준비
```

### 안전성
```
□ 프롬프트 인젝션 방지
□ 출력 검증
□ PII 마스킹
□ 콘텐츠 필터링
□ 사용자 입력 제한
```
