#!/usr/bin/env node

/**
 * Context Sync MCP Server
 * AI 에이전트 간 컨텍스트 자동 동기화 MCP 서버
 *
 * v2.0: 리팩토링 - 핸들러 모듈화
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

// 모듈 임포트
import { ContextStore } from "./store/index.js";
import { SyncEngine } from "./sync/index.js";
import { ContextDiffEngine } from "./diff/index.js";
import { MetricsCollector } from "./metrics/index.js";
import { ContextSearchEngine } from "./search/index.js";
import { HandlerRegistry } from "./handlers/index.js";
import { TOOLS, TOOLS_COUNT } from "./schemas/index.js";
import { initGlobalDatabase } from "./db/global-db.js";

// 현재 작업 디렉토리
const PROJECT_PATH = process.cwd();

// 의존성 초기화
const store = new ContextStore(PROJECT_PATH);
const syncEngine = new SyncEngine(store, PROJECT_PATH);
const diffEngine = new ContextDiffEngine();
const metricsCollector = new MetricsCollector();
const searchEngine = new ContextSearchEngine();

// MCP 서버 생성
const server = new Server(
  {
    name: "context-sync-mcp",
    version: "2.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// 도구 목록 핸들러
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: TOOLS };
});

// 도구 실행 핸들러
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  // 핸들러 레지스트리 생성 (요청마다 새로 생성하여 최신 상태 반영)
  const registry = new HandlerRegistry({
    store,
    syncEngine,
    diffEngine,
    metricsCollector,
    searchEngine,
    projectPath: PROJECT_PATH,
  });

  return registry.handle(name, args as Record<string, unknown>);
});

// 서버 시작
async function main() {
  await store.initialize();

  // v2.1: 전역 DB 초기화
  try {
    await initGlobalDatabase();
    console.error("[v2.1] 전역 DB가 초기화되었습니다.");
  } catch (err) {
    console.error("[v2.1] 전역 DB 초기화 실패 (선택 기능):", err);
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error(
    `Context Sync MCP 서버가 시작되었습니다. (${TOOLS_COUNT}개 도구 로드됨)`
  );
}

main().catch((error) => {
  console.error("서버 시작 실패:", error);
  process.exit(1);
});
