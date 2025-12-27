/**
 * 고급 기능 핸들러
 * context_diff, context_merge, context_search, metrics_report
 */

import type { SharedContext } from "../types/index.js";
import { type HandlerFn, successResponse } from "./types.js";

/**
 * context_diff 핸들러
 */
export const handleContextDiff: HandlerFn = async (args, ctx) => {
  const { snapshotId1, snapshotId2 } = args as {
    snapshotId1?: string;
    snapshotId2?: string;
  };

  const snapshots = await ctx.store.listSnapshots();
  let source: SharedContext | null = null;
  let target: SharedContext | null = null;

  // 첫 번째 스냅샷 (없으면 가장 오래된 스냅샷)
  if (snapshotId1) {
    const snapshot = snapshots.find((s) => s.id.startsWith(snapshotId1));
    if (snapshot) source = snapshot.data;
  } else if (snapshots.length > 0) {
    source = snapshots[snapshots.length - 1].data;
  }

  // 두 번째 스냅샷 (없으면 현재 컨텍스트)
  if (snapshotId2) {
    const snapshot = snapshots.find((s) => s.id.startsWith(snapshotId2));
    if (snapshot) target = snapshot.data;
  } else {
    target = await ctx.store.getContext();
  }

  if (!source || !target) {
    return successResponse(
      "비교할 컨텍스트가 충분하지 않습니다. 최소 2개의 스냅샷이 필요합니다."
    );
  }

  const diff = ctx.diffEngine.compare(source, target);
  const markdown = ctx.diffEngine.toMarkdown(diff);

  // 메트릭 기록
  const opId = "diff-" + Date.now();
  ctx.metricsCollector.startOperation(opId);
  ctx.metricsCollector.endOperation(opId, "context_diff");

  return successResponse(markdown);
};

/**
 * context_merge 핸들러
 */
export const handleContextMerge: HandlerFn = async (args, ctx) => {
  const { snapshotId, strategy = "merge_all" } = args as {
    snapshotId: string;
    strategy?: "source_wins" | "target_wins" | "merge_all" | "interactive";
  };

  const snapshots = await ctx.store.listSnapshots();
  const snapshot = snapshots.find((s) => s.id.startsWith(snapshotId));

  if (!snapshot) {
    return successResponse(`스냅샷을 찾을 수 없습니다: ${snapshotId}`);
  }

  const currentContext = await ctx.store.getContext();
  if (!currentContext) {
    return successResponse("현재 활성 컨텍스트가 없습니다.");
  }

  // 전략을 MergeOptions로 변환
  const mergeOptions = {
    conflictResolution:
      strategy === "source_wins" ? ("source" as const) : ("target" as const),
  };

  const mergeResult = ctx.diffEngine.merge(
    snapshot.data,
    currentContext,
    mergeOptions
  );

  if (!mergeResult.success || !mergeResult.merged) {
    const conflictText = mergeResult.conflicts
      .map(
        (c) =>
          `- ${c.path}: source(${JSON.stringify(c.sourceValue)}) vs target(${JSON.stringify(c.targetValue)})`
      )
      .join("\n");
    return successResponse(
      `병합 충돌이 발생했습니다:\n\n${conflictText}\n\n수동으로 해결이 필요합니다.`
    );
  }

  // 병합된 컨텍스트 저장
  await ctx.store.updateContext({
    goal: mergeResult.merged.currentWork.goal,
    status: mergeResult.merged.currentWork.status,
    nextSteps: mergeResult.merged.conversationSummary.nextSteps,
  });

  // 메트릭 기록
  const opId = "merge-" + Date.now();
  ctx.metricsCollector.startOperation(opId);
  ctx.metricsCollector.endOperation(opId, "context_merge");

  return successResponse(
    `병합이 완료되었습니다.\n\n- 결정: ${mergeResult.merged.conversationSummary.keyDecisions.length}개\n- 접근법: ${mergeResult.merged.conversationSummary.triedApproaches.length}개\n- 블로커: ${mergeResult.merged.conversationSummary.blockers.length}개`
  );
};

/**
 * context_search 핸들러
 */
export const handleContextSearch: HandlerFn = async (args, ctx) => {
  const { query, category = "all", maxResults = 10 } = args as {
    query: string;
    category?:
      | "all"
      | "decisions"
      | "approaches"
      | "blockers"
      | "files"
      | "nextSteps"
      | "handoffs";
    maxResults?: number;
  };

  const context = await ctx.store.getContext();
  if (!context) {
    return successResponse("검색할 컨텍스트가 없습니다.");
  }

  const searchResult = ctx.searchEngine.search(context, query, {
    categories: category === "all" ? undefined : [category],
    maxResults,
  });

  const markdown = ctx.searchEngine.toMarkdown(searchResult);

  // 메트릭 기록
  const opId = "search-" + Date.now();
  ctx.metricsCollector.startOperation(opId);
  ctx.metricsCollector.endOperation(opId, "context_search");

  return successResponse(markdown);
};

/**
 * metrics_report 핸들러
 */
export const handleMetricsReport: HandlerFn = async (args, ctx) => {
  const { format = "markdown" } = args as {
    format?: "markdown" | "json";
  };

  // 현재 컨텍스트 정보 추가
  const context = await ctx.store.getContext();
  if (context) {
    ctx.metricsCollector.recordContextSize(JSON.stringify(context).length);
  }

  const snapshots = await ctx.store.listSnapshots();
  ctx.metricsCollector.recordSnapshotCount(snapshots.length);
  ctx.metricsCollector.recordMemoryUsage();

  const report = ctx.metricsCollector.generateReport();

  // 컨텍스트 정보 보강
  if (context) {
    report.context.decisionsCount =
      context.conversationSummary.keyDecisions.length;
    report.context.approachesCount =
      context.conversationSummary.triedApproaches.length;
    report.context.blockersCount = context.conversationSummary.blockers.length;
    report.context.unresolvedBlockersCount =
      context.conversationSummary.blockers.filter((b) => !b.resolved).length;
  }

  if (format === "json") {
    return successResponse(JSON.stringify(report, null, 2));
  }

  return successResponse(ctx.metricsCollector.toMarkdown(report));
};

/**
 * Advanced 핸들러 레지스트리
 */
export const advancedHandlers = new Map<string, HandlerFn>([
  ["context_diff", handleContextDiff],
  ["context_merge", handleContextMerge],
  ["context_search", handleContextSearch],
  ["metrics_report", handleMetricsReport],
]);
