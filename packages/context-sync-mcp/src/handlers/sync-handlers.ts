/**
 * Sync 핸들러
 * sync_start, sync_stop, sync_status
 */

import { type HandlerFn, successResponse } from "./types.js";

/**
 * sync_start 핸들러
 */
export const handleSyncStart: HandlerFn = async (args, ctx) => {
  const { editorSwitch, fileSave, idleMinutes, gitCommit } = args as {
    editorSwitch?: boolean;
    fileSave?: boolean;
    idleMinutes?: number;
    gitCommit?: boolean;
  };

  if (ctx.syncEngine.isActive()) {
    return successResponse("동기화 엔진이 이미 실행 중입니다.");
  }

  await ctx.syncEngine.start();

  return successResponse(
    `자동 동기화가 시작되었습니다.\n\n설정:\n- 에디터 전환: ${editorSwitch !== false ? "활성화" : "비활성화"}\n- 파일 저장: ${fileSave !== false ? "활성화" : "비활성화"}\n- 유휴 시간: ${idleMinutes || 5}분\n- Git 커밋: ${gitCommit !== false ? "활성화" : "비활성화"}`
  );
};

/**
 * sync_stop 핸들러
 */
export const handleSyncStop: HandlerFn = async (_args, ctx) => {
  if (!ctx.syncEngine.isActive()) {
    return successResponse("동기화 엔진이 실행 중이 아닙니다.");
  }

  ctx.syncEngine.stop();

  return successResponse("자동 동기화가 중지되었습니다.");
};

/**
 * sync_status 핸들러
 */
export const handleSyncStatus: HandlerFn = async (_args, ctx) => {
  const isActive = ctx.syncEngine.isActive();
  const context = await ctx.store.getContext();

  let statusText = `동기화 상태: ${isActive ? "실행 중" : "중지됨"}`;

  if (context) {
    statusText += `\n\n현재 컨텍스트:\n- 목표: ${context.currentWork.goal}\n- 상태: ${context.currentWork.status}\n- 버전: ${context.version}`;
  } else {
    statusText += "\n\n활성 컨텍스트가 없습니다.";
  }

  return successResponse(statusText);
};

/**
 * Sync 핸들러 레지스트리
 */
export const syncHandlers = new Map<string, HandlerFn>([
  ["sync_start", handleSyncStart],
  ["sync_stop", handleSyncStop],
  ["sync_status", handleSyncStatus],
]);
