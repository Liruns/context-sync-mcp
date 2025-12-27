/**
 * 자연어 핸들러
 * ctx, automation_config, session_start
 */

import type { AgentType } from "../types/index.js";
import { type HandlerFn, successResponse } from "./types.js";

/**
 * 자연어 명령 패턴 정의
 */
const PATTERNS = {
  save: /^(save|저장|저장해|저장해줘|저장하기|세이브)/,
  load: /^(load|로드|불러|불러와|이전|어디까지|계속|resume|continue)/,
  status: /^(status|상태|현재|지금|뭐|state)/,
  summary: /^(summary|요약|정리|summarize)/,
  autoOn: /^(auto\s*(on|켜|시작|start)|자동.*켜|자동.*시작)/,
  autoOff: /^(auto\s*(off|꺼|중지|stop)|자동.*꺼|자동.*중지)/,
} as const;

/**
 * ctx 핸들러 - 자연어 명령 처리
 */
export const handleCtx: HandlerFn = async (args, ctx) => {
  const { command, goal } = args as { command: string; goal?: string };
  const cmd = command.toLowerCase().trim();

  // 저장 명령 패턴
  if (PATTERNS.save.test(cmd)) {
    let context = await ctx.store.getContext();
    if (!context && goal) {
      context = await ctx.store.createContext({
        projectPath: ctx.projectPath,
        goal,
        agent: "claude-code",
      });
    } else if (context) {
      await ctx.store.updateContext({ goal: goal || context.currentWork.goal });
    } else {
      return successResponse("저장할 목표(goal)를 지정해주세요.");
    }
    return successResponse(
      `✅ 컨텍스트가 저장되었습니다.\n\n목표: ${goal || context?.currentWork.goal}`
    );
  }

  // 로드 명령 패턴
  if (PATTERNS.load.test(cmd)) {
    const context = await ctx.store.getContext();
    if (!context) {
      return successResponse("📭 저장된 컨텍스트가 없습니다.");
    }
    const summary = await ctx.store.getSummary();
    return successResponse(`📥 이전 작업을 불러왔습니다.\n\n${summary}`);
  }

  // 상태 조회 패턴
  if (PATTERNS.status.test(cmd)) {
    const context = await ctx.store.getContext();
    const isActive = ctx.syncEngine.isActive();
    if (!context) {
      return successResponse(
        `📊 상태: 활성 컨텍스트 없음\n자동 동기화: ${isActive ? "실행 중" : "중지됨"}`
      );
    }
    return successResponse(
      `📊 현재 상태\n\n목표: ${context.currentWork.goal}\n상태: ${context.currentWork.status}\n버전: ${context.version}\n자동 동기화: ${isActive ? "실행 중" : "중지됨"}`
    );
  }

  // 요약 패턴
  if (PATTERNS.summary.test(cmd)) {
    const context = await ctx.store.getContext();
    if (!context) {
      return successResponse("📭 요약할 컨텍스트가 없습니다.");
    }
    const summary = await ctx.store.getSummary();
    return successResponse(summary);
  }

  // 자동 동기화 켜기
  if (PATTERNS.autoOn.test(cmd)) {
    if (ctx.syncEngine.isActive()) {
      return successResponse("🔄 자동 동기화가 이미 실행 중입니다.");
    }
    await ctx.syncEngine.start();
    return successResponse("✅ 자동 동기화가 시작되었습니다.");
  }

  // 자동 동기화 끄기
  if (PATTERNS.autoOff.test(cmd)) {
    if (!ctx.syncEngine.isActive()) {
      return successResponse("⏹️ 자동 동기화가 이미 중지되어 있습니다.");
    }
    ctx.syncEngine.stop();
    return successResponse("⏹️ 자동 동기화가 중지되었습니다.");
  }

  return successResponse(
    `❓ 알 수 없는 명령: "${command}"\n\n사용 가능한 명령:\n- 저장/save: 컨텍스트 저장\n- 로드/load: 이전 작업 불러오기\n- 상태/status: 현재 상태 조회\n- 요약/summary: 컨텍스트 요약\n- auto on/off: 자동 동기화 켜기/끄기`
  );
};

/**
 * automation_config 핸들러
 */
export const handleAutomationConfig: HandlerFn = async (args, ctx) => {
  const { autoLoad, autoSave, autoSync } = args as {
    autoLoad?: boolean;
    autoSave?: boolean;
    autoSync?: boolean;
  };

  const config = ctx.store.getConfig();

  if (
    autoLoad !== undefined ||
    autoSave !== undefined ||
    autoSync !== undefined
  ) {
    const updates = {
      automation: {
        ...config.automation,
        ...(autoLoad !== undefined && { autoLoad }),
        ...(autoSave !== undefined && { autoSave }),
        ...(autoSync !== undefined && { autoSync }),
      },
    };
    await ctx.store.updateConfig(updates as Partial<typeof config>);
  }

  const newConfig = ctx.store.getConfig();
  return successResponse(
    `⚙️ 자동화 설정\n\n- autoLoad (세션 시작 시 자동 로드): ${newConfig.automation.autoLoad ? "✅ 켜짐" : "❌ 꺼짐"}\n- autoSave (변경 시 자동 저장): ${newConfig.automation.autoSave ? "✅ 켜짐" : "❌ 꺼짐"}\n- autoSync (자동 동기화 시작): ${newConfig.automation.autoSync ? "✅ 켜짐" : "❌ 꺼짐"}`
  );
};

/**
 * session_start 핸들러
 */
export const handleSessionStart: HandlerFn = async (args, ctx) => {
  const { agent = "claude-code" } = args as { agent?: AgentType };
  const config = ctx.store.getConfig();

  let result = `🚀 세션 시작 (${agent})\n\n`;

  // 자동 로드
  if (config.automation.autoLoad) {
    const context = await ctx.store.getContext();
    if (context) {
      await ctx.store.recordHandoff(
        context.agentChain.at(-1)?.to || "unknown",
        agent,
        "세션 시작"
      );
      const summary = await ctx.store.getSummary();
      result += `📥 이전 작업을 자동으로 불러왔습니다.\n\n${summary}`;
    } else {
      result += "📭 이전 작업 기록이 없습니다. 새 세션입니다.";
    }
  } else {
    result += "⚙️ autoLoad가 비활성화되어 있습니다.";
  }

  // 자동 동기화 시작
  if (config.automation.autoSync && !ctx.syncEngine.isActive()) {
    await ctx.syncEngine.start();
    result += "\n\n🔄 자동 동기화가 시작되었습니다.";
  }

  return successResponse(result);
};

/**
 * NLP 핸들러 레지스트리
 */
export const nlpHandlers = new Map<string, HandlerFn>([
  ["ctx", handleCtx],
  ["automation_config", handleAutomationConfig],
  ["session_start", handleSessionStart],
]);
