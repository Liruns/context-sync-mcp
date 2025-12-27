/**
 * 자동화 핸들러
 * automation_config, session_start
 */

import type { AgentType } from "../types/index.js";
import { type HandlerFn, successResponse } from "./types.js";

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
 * 자동화 핸들러 (현재 미사용, 향후 확장용)
 */
export const automationHandlers = {
  handleAutomationConfig,
  handleSessionStart,
};
