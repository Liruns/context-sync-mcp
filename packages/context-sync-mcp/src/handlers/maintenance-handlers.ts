/**
 * Maintenance 핸들러
 * context_cleanup, context_archive, snapshot_create, snapshot_restore, snapshot_list
 */

import type {
  ContextCleanupInput,
  ContextArchiveInput,
  SnapshotCreateInput,
  SnapshotListInput,
} from "../types/index.js";
import { type HandlerFn, successResponse, errorResponse } from "./types.js";

/**
 * context_cleanup 핸들러
 * 오래된 데이터 정리
 */
export const handleContextCleanup: HandlerFn = async (args, ctx) => {
  const input = args as ContextCleanupInput;

  const result = await ctx.store.cleanupContexts(input);

  const lines = [
    result.dryRun ? "🔍 정리 미리보기" : "🧹 정리 완료",
    "",
    "**삭제 항목:**",
    `- 의사결정: ${result.deleted.decisions}개`,
    `- 시도 기록: ${result.deleted.approaches}개`,
    `- 블로커: ${result.deleted.blockers}개`,
    `- 컨텍스트: ${result.deleted.contexts}개`,
    `- 스냅샷: ${result.deleted.snapshots}개`,
    "",
    "**남은 항목:**",
    `- 의사결정: ${result.remaining.decisions}개`,
    `- 시도 기록: ${result.remaining.approaches}개`,
    `- 블로커: ${result.remaining.blockers}개`,
    `- 컨텍스트: ${result.remaining.contexts}개`,
    `- 스냅샷: ${result.remaining.snapshots}개`,
    "",
    result.message,
  ];

  return successResponse(lines.join("\n"));
};

/**
 * context_archive 핸들러
 * 완료된 작업 아카이브
 */
export const handleContextArchive: HandlerFn = async (args, ctx) => {
  const input = args as ContextArchiveInput;

  const result = await ctx.store.archiveContexts(input);

  const lines = [
    "📦 아카이브 완료",
    "",
    `아카이브된 컨텍스트: ${result.archivedCount}개`,
    `삭제된 원본: ${result.deletedCount}개`,
    `저장 위치: ${result.archivePath}`,
    "",
    result.message,
  ];

  return successResponse(lines.join("\n"));
};

/**
 * snapshot_create 핸들러
 * 스냅샷 생성
 */
export const handleSnapshotCreate: HandlerFn = async (args, ctx) => {
  const { reason = "manual", description } = args as SnapshotCreateInput;

  const snapshot = await ctx.store.createSnapshot(reason);

  if (!snapshot) {
    return errorResponse("스냅샷 생성 실패: 저장할 컨텍스트가 없습니다.");
  }

  const lines = [
    "📸 스냅샷 생성 완료",
    "",
    `ID: ${snapshot.id}`,
    `이유: ${snapshot.reason}`,
    `생성: ${new Date(snapshot.timestamp).toLocaleString("ko-KR")}`,
  ];

  if (description) {
    lines.push(`설명: ${description}`);
  }

  return successResponse(lines.join("\n"));
};

/**
 * snapshot_restore 핸들러
 * 스냅샷에서 복원
 */
export const handleSnapshotRestore: HandlerFn = async (args, ctx) => {
  const snapshotId = args.snapshotId as string | undefined;

  if (!snapshotId) {
    return errorResponse("snapshotId가 필요합니다.");
  }

  const restored = await ctx.store.restoreFromSnapshot(snapshotId);

  if (!restored) {
    return errorResponse(`스냅샷을 찾을 수 없습니다: ${snapshotId}`);
  }

  const lines = [
    "⏪ 스냅샷 복원 완료",
    "",
    `복원된 목표: ${restored.currentWork.goal}`,
    `상태: ${restored.currentWork.status}`,
    `의사결정: ${restored.conversationSummary.keyDecisions.length}개`,
    `블로커: ${restored.conversationSummary.blockers.length}개`,
  ];

  return successResponse(lines.join("\n"));
};

/**
 * snapshot_list 핸들러
 * 스냅샷 목록 조회
 */
export const handleSnapshotList: HandlerFn = async (args, ctx) => {
  const { limit = 10 } = args as SnapshotListInput;

  const snapshots = await ctx.store.listSnapshots();
  const limitedSnapshots = snapshots.slice(0, limit);

  if (limitedSnapshots.length === 0) {
    return successResponse("저장된 스냅샷이 없습니다.");
  }

  const lines = [
    `📋 스냅샷 목록 (${limitedSnapshots.length}/${snapshots.length}개)`,
    "",
    ...limitedSnapshots.map((s, i) => {
      const date = new Date(s.timestamp).toLocaleString("ko-KR");
      return `${i + 1}. [${s.id.slice(0, 8)}] ${s.reason} - ${date}`;
    }),
  ];

  if (snapshots.length > limit) {
    lines.push("", `... 외 ${snapshots.length - limit}개`);
  }

  return successResponse(lines.join("\n"));
};

/**
 * Maintenance 핸들러 레지스트리
 */
export const maintenanceHandlers = new Map<string, HandlerFn>([
  ["context_cleanup", handleContextCleanup],
  ["context_archive", handleContextArchive],
  ["snapshot_create", handleSnapshotCreate],
  ["snapshot_restore", handleSnapshotRestore],
  ["snapshot_list", handleSnapshotList],
]);
