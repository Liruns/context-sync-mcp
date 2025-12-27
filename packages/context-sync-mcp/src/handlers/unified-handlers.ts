/**
 * 통합 핸들러 (v3.0)
 * snapshot, blocker, context_maintain, context_analyze
 */

import type { HandlerFn } from "./types.js";
import { successResponse, errorResponse, requireDatabase } from "./types.js";
import {
  validateUnifiedSnapshotInput,
  validateUnifiedBlockerInput,
  validateMaintainInput,
  validateAnalyzeInput,
  validateRecommendInput,
} from "../validators/tool-validators.js";
import {
  getContextStats,
  validateStatsInput,
  formatStatsMarkdown,
  recommendContexts,
  formatRecommendMarkdown,
} from "../tools/index.js";

// ========================================
// snapshot 통합 핸들러
// ========================================

/**
 * snapshot 통합 핸들러
 * action: create | restore | list
 */
export const handleSnapshot: HandlerFn = async (args, ctx) => {
  const validation = validateUnifiedSnapshotInput(args);
  if (!validation.valid) {
    return errorResponse(validation.error);
  }

  const { action, ...params } = validation.input;

  switch (action) {
    case "create":
      return handleSnapshotCreate(params, ctx);
    case "restore":
      return handleSnapshotRestore(params, ctx);
    case "list":
      return handleSnapshotList(params, ctx);
    default:
      return errorResponse(`알 수 없는 action: ${action}`);
  }
};

async function handleSnapshotCreate(
  params: { reason?: "manual" | "milestone"; description?: string },
  ctx: Parameters<HandlerFn>[1]
) {
  const { reason = "manual", description } = params;

  const snapshot = await ctx.store.createSnapshot(reason);

  if (!snapshot) {
    return errorResponse("스냅샷 생성 실패: 저장할 컨텍스트가 없습니다.");
  }

  const lines = [
    "스냅샷 생성 완료",
    "",
    `ID: ${snapshot.id}`,
    `이유: ${snapshot.reason}`,
    `생성: ${new Date(snapshot.timestamp).toLocaleString("ko-KR")}`,
  ];

  if (description) {
    lines.push(`설명: ${description}`);
  }

  return successResponse(lines.join("\n"));
}

async function handleSnapshotRestore(
  params: { snapshotId?: string },
  ctx: Parameters<HandlerFn>[1]
) {
  const { snapshotId } = params;

  if (!snapshotId) {
    return errorResponse("snapshotId가 필요합니다.");
  }

  const restored = await ctx.store.restoreFromSnapshot(snapshotId);

  if (!restored) {
    return errorResponse(`스냅샷을 찾을 수 없습니다: ${snapshotId}`);
  }

  const lines = [
    "스냅샷 복원 완료",
    "",
    `복원된 목표: ${restored.currentWork.goal}`,
    `상태: ${restored.currentWork.status}`,
    `의사결정: ${restored.conversationSummary.keyDecisions.length}개`,
    `블로커: ${restored.conversationSummary.blockers.length}개`,
  ];

  return successResponse(lines.join("\n"));
}

async function handleSnapshotList(
  params: { limit?: number },
  ctx: Parameters<HandlerFn>[1]
) {
  const { limit = 10 } = params;

  const snapshots = await ctx.store.listSnapshots();
  const limitedSnapshots = snapshots.slice(0, limit);

  if (limitedSnapshots.length === 0) {
    return successResponse("저장된 스냅샷이 없습니다.");
  }

  const lines = [
    `스냅샷 목록 (${limitedSnapshots.length}/${snapshots.length}개)`,
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
}

// ========================================
// blocker 통합 핸들러
// ========================================

/**
 * blocker 통합 핸들러
 * action: add | resolve | list
 */
export const handleBlocker: HandlerFn = async (args, ctx) => {
  const validation = validateUnifiedBlockerInput(args);
  if (!validation.valid) {
    return errorResponse(validation.error);
  }

  const { action, ...params } = validation.input;

  switch (action) {
    case "add":
      return handleBlockerAdd(params, ctx);
    case "resolve":
      return handleBlockerResolve(params, ctx);
    case "list":
      return handleBlockerList(params, ctx);
    default:
      return errorResponse(`알 수 없는 action: ${action}`);
  }
};

async function handleBlockerAdd(
  params: { description?: string },
  ctx: Parameters<HandlerFn>[1]
) {
  const { description } = params;

  if (!description) {
    return errorResponse("description이 필요합니다.");
  }

  const blocker = await ctx.store.addBlocker(description);

  return successResponse(
    `블로커가 추가되었습니다.\n\nID: ${blocker.id.slice(0, 8)}\n설명: ${description}`
  );
}

async function handleBlockerResolve(
  params: { blockerId?: string; resolution?: string },
  ctx: Parameters<HandlerFn>[1]
) {
  const { blockerId, resolution } = params;

  if (!blockerId || !resolution) {
    return errorResponse("blockerId와 resolution이 필요합니다.");
  }

  const blocker = await ctx.store.resolveBlocker(blockerId, resolution);

  if (!blocker) {
    return successResponse("블로커를 찾을 수 없습니다.");
  }

  return successResponse(`블로커가 해결되었습니다.\n\n해결 방법: ${resolution}`);
}

async function handleBlockerList(
  params: { includeResolved?: boolean },
  ctx: Parameters<HandlerFn>[1]
) {
  const { includeResolved = false } = params;

  const context = await ctx.store.getContext();

  if (!context) {
    return successResponse("컨텍스트가 없습니다.");
  }

  const blockers = context.conversationSummary.blockers;
  const filtered = includeResolved
    ? blockers
    : blockers.filter((b) => !b.resolved);

  if (filtered.length === 0) {
    return successResponse(
      includeResolved ? "블로커가 없습니다." : "미해결 블로커가 없습니다."
    );
  }

  const lines = [
    `블로커 목록 (${filtered.length}개)`,
    "",
    ...filtered.map((b, i) => {
      const status = b.resolved ? "[해결됨]" : "[미해결]";
      return `${i + 1}. ${status} [${b.id.slice(0, 8)}] ${b.description}`;
    }),
  ];

  return successResponse(lines.join("\n"));
}

// ========================================
// context_maintain 통합 핸들러
// ========================================

/**
 * context_maintain 통합 핸들러
 * action: cleanup | archive
 */
export const handleMaintain: HandlerFn = async (args, ctx) => {
  const validation = validateMaintainInput(args);
  if (!validation.valid) {
    return errorResponse(validation.error);
  }

  const { action, ...params } = validation.input;

  switch (action) {
    case "cleanup":
      return handleContextCleanup(params, ctx);
    case "archive":
      return handleContextArchive(params, ctx);
    default:
      return errorResponse(`알 수 없는 action: ${action}`);
  }
};

async function handleContextCleanup(
  params: {
    olderThan?: string;
    dryRun?: boolean;
    removeResolvedBlockers?: boolean;
    keepOnlySuccessful?: boolean;
    removeCompleted?: boolean;
  },
  ctx: Parameters<HandlerFn>[1]
) {
  const result = await ctx.store.cleanupContexts(params);

  const lines = [
    result.dryRun ? "정리 미리보기" : "정리 완료",
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
}

async function handleContextArchive(
  params: {
    reason?: string;
    contextIds?: string[];
    completedOnly?: boolean;
    deleteAfterArchive?: boolean;
  },
  ctx: Parameters<HandlerFn>[1]
) {
  const result = await ctx.store.archiveContexts(params);

  const lines = [
    "아카이브 완료",
    "",
    `아카이브된 컨텍스트: ${result.archivedCount}개`,
    `삭제된 원본: ${result.deletedCount}개`,
    `저장 위치: ${result.archivePath}`,
    "",
    result.message,
  ];

  return successResponse(lines.join("\n"));
}

// ========================================
// context_analyze 통합 핸들러
// ========================================

/**
 * context_analyze 통합 핸들러
 * action: stats | recommend
 */
export const handleAnalyze: HandlerFn = async (args, ctx) => {
  const validation = validateAnalyzeInput(args);
  if (!validation.valid) {
    return errorResponse(validation.error);
  }

  const { action, ...params } = validation.input;

  switch (action) {
    case "stats":
      return handleContextStats(params, ctx);
    case "recommend":
      return handleContextRecommend(params, ctx);
    default:
      return errorResponse(`알 수 없는 action: ${action}`);
  }
};

async function handleContextStats(
  params: { range?: "last_7_days" | "last_30_days" | "last_90_days" | "all" },
  ctx: Parameters<HandlerFn>[1]
) {
  try {
    const input = validateStatsInput(params);
    const db = requireDatabase(ctx);

    const stats = getContextStats(db, input);
    const markdown = formatStatsMarkdown(stats);

    return successResponse(markdown);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return errorResponse(`통계 조회 오류: ${message}`);
  }
}

async function handleContextRecommend(
  params: { currentGoal?: string; limit?: number },
  ctx: Parameters<HandlerFn>[1]
) {
  try {
    // currentGoal이 없으면 현재 컨텍스트에서 가져옴
    let inputArgs = params;
    if (!params.currentGoal) {
      const context = await ctx.store.getContext();
      if (context?.currentWork?.goal) {
        inputArgs = { ...params, currentGoal: context.currentWork.goal };
      } else {
        return errorResponse(
          "현재 목표가 설정되지 않았습니다. currentGoal을 지정하세요."
        );
      }
    }

    const validation = validateRecommendInput(inputArgs);
    if (!validation.valid) {
      return errorResponse(validation.error);
    }

    const db = requireDatabase(ctx);
    const result = recommendContexts(db, validation.input);
    const markdown = formatRecommendMarkdown(result);

    return successResponse(markdown);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return errorResponse(`추천 오류: ${message}`);
  }
}

// ========================================
// 통합 핸들러 레지스트리
// ========================================

export const unifiedHandlers = new Map<string, HandlerFn>([
  ["snapshot", handleSnapshot],
  ["blocker", handleBlocker],
  ["context_maintain", handleMaintain],
  ["context_analyze", handleAnalyze],
]);
