/**
 * Snapshot 핸들러
 * snapshot_create, snapshot_list
 */

import { type HandlerFn, successResponse } from "./types.js";

/**
 * snapshot_create 핸들러
 */
export const handleSnapshotCreate: HandlerFn = async (args, ctx) => {
  const { reason = "manual" } = args as {
    reason?: "auto" | "manual" | "handoff" | "milestone";
  };

  const snapshot = await ctx.store.createSnapshot(reason);

  if (!snapshot) {
    return successResponse("스냅샷 생성 실패. 활성 컨텍스트가 없습니다.");
  }

  return successResponse(
    `스냅샷이 생성되었습니다.\n\nID: ${snapshot.id.slice(0, 8)}\n이유: ${reason}`
  );
};

/**
 * snapshot_list 핸들러
 */
export const handleSnapshotList: HandlerFn = async (args, ctx) => {
  const { limit = 10 } = args as { limit?: number };
  const snapshots = await ctx.store.listSnapshots();
  const list = snapshots.slice(0, limit);

  if (list.length === 0) {
    return successResponse("저장된 스냅샷이 없습니다.");
  }

  const result = list
    .map(
      (s) =>
        `- [${s.id.slice(0, 8)}] ${s.reason} - ${new Date(s.timestamp).toLocaleString()}`
    )
    .join("\n");

  return successResponse(`스냅샷 목록:\n\n${result}`);
};

/**
 * Snapshot 핸들러 레지스트리
 */
export const snapshotHandlers = new Map<string, HandlerFn>([
  ["snapshot_create", handleSnapshotCreate],
  ["snapshot_list", handleSnapshotList],
]);
