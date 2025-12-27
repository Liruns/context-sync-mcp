/**
 * Context CRUD 핸들러
 * context_save, context_load, context_query, context_summarize
 */

import type { AgentType, WorkStatus } from "../types/index.js";
import { ContextSummarizer } from "../utils/index.js";
import { type HandlerFn, successResponse } from "./types.js";

/**
 * context_save 핸들러
 */
export const handleContextSave: HandlerFn = async (args, ctx) => {
  const { goal, status, nextSteps, agent } = args as {
    goal: string;
    status?: WorkStatus;
    nextSteps?: string[];
    agent?: AgentType;
  };

  let context = await ctx.store.getContext();
  if (!context) {
    context = await ctx.store.createContext({
      projectPath: ctx.projectPath,
      goal,
      agent,
    });
  } else {
    await ctx.store.updateContext({ goal, status, nextSteps });
  }

  return successResponse(
    `컨텍스트가 저장되었습니다.\n\n목표: ${goal}\n상태: ${status || context.currentWork.status}`
  );
};

/**
 * context_load 핸들러
 */
export const handleContextLoad: HandlerFn = async (args, ctx) => {
  const { format = "summary" } = args as { format?: string };
  const context = await ctx.store.getContext();

  if (!context) {
    return successResponse(
      "저장된 컨텍스트가 없습니다. context_save로 새 컨텍스트를 생성하세요."
    );
  }

  let result: string;
  switch (format) {
    case "full":
      result = JSON.stringify(context, null, 2);
      break;
    case "decisions":
      result =
        context.conversationSummary.keyDecisions
          .map((d) => `- ${d.what}: ${d.why}`)
          .join("\n") || "결정사항이 없습니다.";
      break;
    case "blockers":
      result =
        context.conversationSummary.blockers
          .filter((b) => !b.resolved)
          .map((b) => `- [${b.id.slice(0, 8)}] ${b.description}`)
          .join("\n") || "블로커가 없습니다.";
      break;
    case "next_steps":
      result =
        context.conversationSummary.nextSteps.map((s) => `- ${s}`).join("\n") ||
        "다음 단계가 없습니다.";
      break;
    default:
      result = await ctx.store.getSummary();
  }

  return successResponse(result);
};

/**
 * context_query 핸들러
 */
export const handleContextQuery: HandlerFn = async (args, ctx) => {
  const { query } = args as { query: string };
  const context = await ctx.store.getContext();

  if (!context) {
    return successResponse("컨텍스트가 없습니다.");
  }

  let result: string;
  switch (query) {
    case "decisions":
      result = JSON.stringify(
        context.conversationSummary.keyDecisions,
        null,
        2
      );
      break;
    case "blockers":
      result = JSON.stringify(context.conversationSummary.blockers, null, 2);
      break;
    case "approaches":
      result = JSON.stringify(
        context.conversationSummary.triedApproaches,
        null,
        2
      );
      break;
    case "next_steps":
      result = JSON.stringify(context.conversationSummary.nextSteps, null, 2);
      break;
    case "agent_chain":
      result = context.agentChain
        .map((h) => `${h.from} → ${h.to}: ${h.summary}`)
        .join("\n");
      break;
    case "code_changes":
      result = JSON.stringify(context.codeChanges, null, 2);
      break;
    default:
      result = "알 수 없는 쿼리입니다.";
  }

  return successResponse(result);
};

/**
 * context_summarize 핸들러
 */
export const handleContextSummarize: HandlerFn = async (args, ctx) => {
  const { format = "markdown", compressionLevel = "medium" } = args as {
    format?: "markdown" | "json" | "oneliner";
    compressionLevel?: "none" | "low" | "medium" | "high";
  };

  const context = await ctx.store.getContext();

  if (!context) {
    return successResponse("활성 컨텍스트가 없습니다.");
  }

  const customSummarizer = new ContextSummarizer({ compressionLevel });

  let result: string;
  switch (format) {
    case "json":
      result = customSummarizer.toJSON(context);
      break;
    case "oneliner":
      result = customSummarizer.toOneLiner(context);
      break;
    default:
      result = customSummarizer.toMarkdown(context);
  }

  const tokens = customSummarizer.estimateTokens(context);

  return successResponse(`${result}\n\n---\n예상 토큰: ~${tokens}`);
};

/**
 * Context 핸들러 레지스트리
 */
export const contextHandlers = new Map<string, HandlerFn>([
  ["context_save", handleContextSave],
  ["context_load", handleContextLoad],
  ["context_query", handleContextQuery],
  ["context_summarize", handleContextSummarize],
]);
