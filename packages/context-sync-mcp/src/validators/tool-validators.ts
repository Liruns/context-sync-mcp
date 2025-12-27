/**
 * 도구별 검증 함수
 * 각 MCP 도구에 대한 입력 검증
 */

import {
  ARCHIVE_ERRORS,
  EXPORT_ERRORS,
  RECOMMEND_ERRORS,
  VALIDATION_ERRORS,
} from "../constants/error-messages.js";
import {
  VALID_ARCHIVE_ACTIONS,
  VALID_EXPORT_FORMATS,
  VALID_STATUS,
  VALID_AGENTS,
  VALID_APPROACH_RESULTS,
  VALID_LOAD_FORMATS,
  VALID_QUERY_TYPES,
  VALID_COMPRESSION_LEVELS,
  VALID_SNAPSHOT_REASONS,
  // v3.0 통합 도구 액션
  VALID_SNAPSHOT_ACTIONS,
  VALID_BLOCKER_ACTIONS,
  VALID_MAINTAIN_ACTIONS,
  VALID_ANALYZE_ACTIONS,
} from "../constants/valid-values.js";
import {
  ACTION_LIMITS,
  SEARCH_LIMITS,
  WARN_LIMITS,
  RECOMMEND_LIMITS,
  SNAPSHOT_LIMITS,
  clampLimit,
} from "../constants/limits.js";
import {
  isNonEmptyString,
  isInteger,
  isBoolean,
  isArray,
  parseArgs,
  validateRequiredString,
  validateOptionalEnum,
} from "./common.js";

// ========================================
// 아카이브 도구 검증
// ========================================

export interface ArchiveInput {
  action: (typeof VALID_ARCHIVE_ACTIONS)[number];
  contextId?: string;
  query?: string;
  limit?: number;
  retentionDays?: number;
}

export function validateArchiveInput(
  args: unknown
): { valid: true; input: ArchiveInput } | { valid: false; error: string } {
  const parsed = parseArgs(args);

  // action 필수
  if (!parsed.action || !isNonEmptyString(parsed.action)) {
    return { valid: false, error: ARCHIVE_ERRORS.ACTION_REQUIRED };
  }

  // action 유효성
  if (!VALID_ARCHIVE_ACTIONS.includes(parsed.action as typeof VALID_ARCHIVE_ACTIONS[number])) {
    return {
      valid: false,
      error: `Invalid action: ${parsed.action}. Use: ${VALID_ARCHIVE_ACTIONS.join(", ")}`,
    };
  }

  const action = parsed.action as ArchiveInput["action"];

  // restore 시 contextId 필수
  if (action === "restore") {
    if (!parsed.contextId || !isNonEmptyString(parsed.contextId)) {
      return { valid: false, error: ARCHIVE_ERRORS.CONTEXT_ID_REQUIRED };
    }
  }

  // search 시 query 필수
  if (action === "search") {
    if (!parsed.query || !isNonEmptyString(parsed.query)) {
      return { valid: false, error: ARCHIVE_ERRORS.QUERY_REQUIRED };
    }
  }

  return {
    valid: true,
    input: {
      action,
      contextId: isNonEmptyString(parsed.contextId) ? parsed.contextId : undefined,
      query: isNonEmptyString(parsed.query) ? parsed.query : undefined,
      limit: isInteger(parsed.limit) ? parsed.limit : undefined,
      retentionDays: isInteger(parsed.retentionDays) ? parsed.retentionDays : undefined,
    },
  };
}

// ========================================
// 내보내기 도구 검증
// ========================================

export interface ExportInput {
  format: (typeof VALID_EXPORT_FORMATS)[number];
  contextIds?: string[];
  dateRange?: { from?: string; to?: string };
  includeActions?: boolean;
}

export function validateExportInput(
  args: unknown
): { valid: true; input: ExportInput } | { valid: false; error: string } {
  const parsed = parseArgs(args);

  // format 필수
  if (!parsed.format || !isNonEmptyString(parsed.format)) {
    return { valid: false, error: EXPORT_ERRORS.FORMAT_REQUIRED };
  }

  // format 유효성
  if (!VALID_EXPORT_FORMATS.includes(parsed.format as typeof VALID_EXPORT_FORMATS[number])) {
    return { valid: false, error: EXPORT_ERRORS.INVALID_FORMAT(parsed.format) };
  }

  const result: ExportInput = {
    format: parsed.format as ExportInput["format"],
  };

  // 선택적 필드
  if (isArray(parsed.contextIds)) {
    result.contextIds = parsed.contextIds.filter((id) => isNonEmptyString(id)) as string[];
  }

  if (parsed.dateRange && typeof parsed.dateRange === "object") {
    const range = parsed.dateRange as Record<string, unknown>;
    result.dateRange = {
      from: isNonEmptyString(range.from) ? range.from : undefined,
      to: isNonEmptyString(range.to) ? range.to : undefined,
    };
  }

  if (isBoolean(parsed.includeActions)) {
    result.includeActions = parsed.includeActions;
  }

  return { valid: true, input: result };
}

// ========================================
// 검색 도구 검증
// ========================================

export interface SearchInput {
  query?: string;
  tags?: string[];
  status?: (typeof VALID_STATUS)[number];
  agent?: (typeof VALID_AGENTS)[number];
  limit?: number;
  offset?: number;
  warningsOnly?: boolean;
}

export function validateSearchInput(args: unknown): SearchInput {
  const parsed = parseArgs(args);

  return {
    query: isNonEmptyString(parsed.query) ? parsed.query : undefined,
    tags: isArray(parsed.tags)
      ? parsed.tags.filter((t) => isNonEmptyString(t)) as string[]
      : undefined,
    status: VALID_STATUS.includes(parsed.status as typeof VALID_STATUS[number])
      ? (parsed.status as SearchInput["status"])
      : undefined,
    agent: VALID_AGENTS.includes(parsed.agent as typeof VALID_AGENTS[number])
      ? (parsed.agent as SearchInput["agent"])
      : undefined,
    limit: clampLimit(
      isInteger(parsed.limit) ? parsed.limit : undefined,
      SEARCH_LIMITS.DEFAULT_LIMIT,
      SEARCH_LIMITS.MAX_LIMIT
    ),
    offset: isInteger(parsed.offset) && parsed.offset >= 0 ? parsed.offset : 0,
    warningsOnly: isBoolean(parsed.warningsOnly) ? parsed.warningsOnly : undefined,
  };
}

// ========================================
// 컨텍스트 조회 검증
// ========================================

export interface GetContextInput {
  id: string;
  includeActions?: boolean;
  includeChain?: boolean;
  actionsLimit?: number;
}

export function validateGetContextInput(
  args: unknown
): { valid: true; input: GetContextInput } | { valid: false; error: string } {
  const parsed = parseArgs(args);

  // id 필수
  const idValidation = validateRequiredString(parsed, "id");
  if (!idValidation.valid) {
    return { valid: false, error: VALIDATION_ERRORS.REQUIRED_FIELD("id") };
  }

  return {
    valid: true,
    input: {
      id: parsed.id as string,
      includeActions: isBoolean(parsed.includeActions) ? parsed.includeActions : true,
      includeChain: isBoolean(parsed.includeChain) ? parsed.includeChain : false,
      actionsLimit: clampLimit(
        isInteger(parsed.actionsLimit) ? parsed.actionsLimit : undefined,
        ACTION_LIMITS.DEFAULT_LIMIT,
        ACTION_LIMITS.MAX_LIMIT
      ),
    },
  };
}

// ========================================
// 경고 도구 검증
// ========================================

export interface WarnInput {
  currentGoal: string;
  limit?: number;
}

export function validateWarnInput(
  args: unknown
): { valid: true; input: WarnInput } | { valid: false; error: string } {
  const parsed = parseArgs(args);

  // currentGoal 필수
  if (!parsed.currentGoal || !isNonEmptyString(parsed.currentGoal)) {
    return { valid: false, error: RECOMMEND_ERRORS.GOAL_REQUIRED };
  }

  return {
    valid: true,
    input: {
      currentGoal: parsed.currentGoal,
      limit: clampLimit(
        isInteger(parsed.limit) ? parsed.limit : undefined,
        WARN_LIMITS.DEFAULT_LIMIT,
        WARN_LIMITS.MAX_LIMIT
      ),
    },
  };
}

// ========================================
// 추천 도구 검증
// ========================================

export interface RecommendInput {
  currentGoal: string;
  limit?: number;
}

export function validateRecommendInput(
  args: unknown
): { valid: true; input: RecommendInput } | { valid: false; error: string } {
  const parsed = parseArgs(args);

  // currentGoal 필수
  if (!parsed.currentGoal || !isNonEmptyString(parsed.currentGoal)) {
    return { valid: false, error: RECOMMEND_ERRORS.GOAL_REQUIRED };
  }

  return {
    valid: true,
    input: {
      currentGoal: parsed.currentGoal,
      limit: clampLimit(
        isInteger(parsed.limit) ? parsed.limit : undefined,
        RECOMMEND_LIMITS.DEFAULT_LIMIT,
        RECOMMEND_LIMITS.MAX_LIMIT
      ),
    },
  };
}

// ========================================
// 컨텍스트 저장 검증
// ========================================

export interface SaveContextInput {
  goal: string;
  status?: (typeof VALID_STATUS)[number];
  agent?: (typeof VALID_AGENTS)[number];
  nextSteps?: string[];
}

export function validateSaveContextInput(
  args: unknown
): { valid: true; input: SaveContextInput } | { valid: false; error: string } {
  const parsed = parseArgs(args);

  // goal 필수
  if (!parsed.goal || !isNonEmptyString(parsed.goal)) {
    return { valid: false, error: VALIDATION_ERRORS.REQUIRED_FIELD("goal") };
  }

  // status 유효성 (선택적)
  const statusValidation = validateOptionalEnum(parsed.status, "status", VALID_STATUS);
  if (!statusValidation.valid) {
    return { valid: false, error: statusValidation.error! };
  }

  // agent 유효성 (선택적)
  const agentValidation = validateOptionalEnum(parsed.agent, "agent", VALID_AGENTS);
  if (!agentValidation.valid) {
    return { valid: false, error: agentValidation.error! };
  }

  return {
    valid: true,
    input: {
      goal: parsed.goal,
      status: parsed.status as SaveContextInput["status"],
      agent: parsed.agent as SaveContextInput["agent"],
      nextSteps: isArray(parsed.nextSteps)
        ? parsed.nextSteps.filter((s) => isNonEmptyString(s)) as string[]
        : undefined,
    },
  };
}

// ========================================
// 의사결정 검증
// ========================================

export interface DecisionInput {
  what: string;
  why: string;
}

export function validateDecisionInput(
  args: unknown
): { valid: true; input: DecisionInput } | { valid: false; error: string } {
  const parsed = parseArgs(args);

  if (!parsed.what || !isNonEmptyString(parsed.what)) {
    return { valid: false, error: VALIDATION_ERRORS.REQUIRED_FIELD("what") };
  }

  if (!parsed.why || !isNonEmptyString(parsed.why)) {
    return { valid: false, error: VALIDATION_ERRORS.REQUIRED_FIELD("why") };
  }

  return {
    valid: true,
    input: {
      what: parsed.what,
      why: parsed.why,
    },
  };
}

// ========================================
// 접근법 검증
// ========================================

export interface ApproachInput {
  approach: string;
  result: (typeof VALID_APPROACH_RESULTS)[number];
  reason?: string;
}

export function validateApproachInput(
  args: unknown
): { valid: true; input: ApproachInput } | { valid: false; error: string } {
  const parsed = parseArgs(args);

  if (!parsed.approach || !isNonEmptyString(parsed.approach)) {
    return { valid: false, error: VALIDATION_ERRORS.REQUIRED_FIELD("approach") };
  }

  if (!parsed.result || !VALID_APPROACH_RESULTS.includes(parsed.result as typeof VALID_APPROACH_RESULTS[number])) {
    return {
      valid: false,
      error: VALIDATION_ERRORS.INVALID_VALUE("result", [...VALID_APPROACH_RESULTS]),
    };
  }

  return {
    valid: true,
    input: {
      approach: parsed.approach,
      result: parsed.result as ApproachInput["result"],
      reason: isNonEmptyString(parsed.reason) ? parsed.reason : undefined,
    },
  };
}

// ========================================
// 블로커 검증
// ========================================

export interface BlockerInput {
  description: string;
}

export function validateBlockerInput(
  args: unknown
): { valid: true; input: BlockerInput } | { valid: false; error: string } {
  const parsed = parseArgs(args);

  if (!parsed.description || !isNonEmptyString(parsed.description)) {
    return { valid: false, error: VALIDATION_ERRORS.REQUIRED_FIELD("description") };
  }

  return {
    valid: true,
    input: {
      description: parsed.description,
    },
  };
}

// ========================================
// 스냅샷 검증
// ========================================

export interface SnapshotInput {
  reason?: (typeof VALID_SNAPSHOT_REASONS)[number];
}

export function validateSnapshotInput(args: unknown): SnapshotInput {
  const parsed = parseArgs(args);

  return {
    reason: VALID_SNAPSHOT_REASONS.includes(parsed.reason as typeof VALID_SNAPSHOT_REASONS[number])
      ? (parsed.reason as SnapshotInput["reason"])
      : "manual",
  };
}

// ========================================
// 컨텍스트 로드 검증
// ========================================

export interface LoadContextInput {
  format?: (typeof VALID_LOAD_FORMATS)[number];
}

export function validateLoadContextInput(args: unknown): LoadContextInput {
  const parsed = parseArgs(args);

  return {
    format: VALID_LOAD_FORMATS.includes(parsed.format as typeof VALID_LOAD_FORMATS[number])
      ? (parsed.format as LoadContextInput["format"])
      : "summary",
  };
}

// ========================================
// 컨텍스트 쿼리 검증
// ========================================

export interface QueryContextInput {
  query: (typeof VALID_QUERY_TYPES)[number];
}

export function validateQueryContextInput(
  args: unknown
): { valid: true; input: QueryContextInput } | { valid: false; error: string } {
  const parsed = parseArgs(args);

  if (!parsed.query || !VALID_QUERY_TYPES.includes(parsed.query as typeof VALID_QUERY_TYPES[number])) {
    return {
      valid: false,
      error: VALIDATION_ERRORS.INVALID_VALUE("query", [...VALID_QUERY_TYPES]),
    };
  }

  return {
    valid: true,
    input: {
      query: parsed.query as QueryContextInput["query"],
    },
  };
}

// ========================================
// 요약 검증
// ========================================

export interface SummarizeInput {
  format?: "markdown" | "json" | "oneliner";
  compressionLevel?: (typeof VALID_COMPRESSION_LEVELS)[number];
}

export function validateSummarizeInput(args: unknown): SummarizeInput {
  const parsed = parseArgs(args);

  const validFormats = ["markdown", "json", "oneliner"] as const;

  return {
    format: validFormats.includes(parsed.format as typeof validFormats[number])
      ? (parsed.format as SummarizeInput["format"])
      : "markdown",
    compressionLevel: VALID_COMPRESSION_LEVELS.includes(
      parsed.compressionLevel as typeof VALID_COMPRESSION_LEVELS[number]
    )
      ? (parsed.compressionLevel as SummarizeInput["compressionLevel"])
      : "medium",
  };
}

// ========================================
// v3.0 - 통합 도구 검증 함수
// ========================================

import type {
  SnapshotInput as UnifiedSnapshotInput,
  BlockerInput as UnifiedBlockerInput,
  MaintainInput,
  AnalyzeInput,
} from "../types/context.js";

/**
 * snapshot 통합 도구 검증
 */
export function validateUnifiedSnapshotInput(
  args: unknown
): { valid: true; input: UnifiedSnapshotInput } | { valid: false; error: string } {
  const parsed = parseArgs(args);

  // action 필수
  if (!parsed.action || !isNonEmptyString(parsed.action)) {
    return { valid: false, error: "action이 필요합니다 (create, restore, list)" };
  }

  // action 유효성
  if (!VALID_SNAPSHOT_ACTIONS.includes(parsed.action as typeof VALID_SNAPSHOT_ACTIONS[number])) {
    return {
      valid: false,
      error: `잘못된 action: ${parsed.action}. 사용 가능: ${VALID_SNAPSHOT_ACTIONS.join(", ")}`,
    };
  }

  const action = parsed.action as UnifiedSnapshotInput["action"];

  // restore 시 snapshotId 필수
  if (action === "restore") {
    if (!parsed.snapshotId || !isNonEmptyString(parsed.snapshotId)) {
      return { valid: false, error: "restore 시 snapshotId가 필요합니다" };
    }
  }

  return {
    valid: true,
    input: {
      action,
      snapshotId: isNonEmptyString(parsed.snapshotId) ? parsed.snapshotId : undefined,
      reason: parsed.reason === "milestone" ? "milestone" : "manual",
      description: isNonEmptyString(parsed.description) ? parsed.description : undefined,
      limit: clampLimit(
        isInteger(parsed.limit) ? parsed.limit : undefined,
        SNAPSHOT_LIMITS.DEFAULT_LIMIT,
        SNAPSHOT_LIMITS.MAX_LIMIT
      ),
    },
  };
}

/**
 * blocker 통합 도구 검증
 */
export function validateUnifiedBlockerInput(
  args: unknown
): { valid: true; input: UnifiedBlockerInput } | { valid: false; error: string } {
  const parsed = parseArgs(args);

  // action 필수
  if (!parsed.action || !isNonEmptyString(parsed.action)) {
    return { valid: false, error: "action이 필요합니다 (add, resolve, list)" };
  }

  // action 유효성
  if (!VALID_BLOCKER_ACTIONS.includes(parsed.action as typeof VALID_BLOCKER_ACTIONS[number])) {
    return {
      valid: false,
      error: `잘못된 action: ${parsed.action}. 사용 가능: ${VALID_BLOCKER_ACTIONS.join(", ")}`,
    };
  }

  const action = parsed.action as UnifiedBlockerInput["action"];

  // add 시 description 필수
  if (action === "add") {
    if (!parsed.description || !isNonEmptyString(parsed.description)) {
      return { valid: false, error: "add 시 description이 필요합니다" };
    }
  }

  // resolve 시 blockerId, resolution 필수
  if (action === "resolve") {
    if (!parsed.blockerId || !isNonEmptyString(parsed.blockerId)) {
      return { valid: false, error: "resolve 시 blockerId가 필요합니다" };
    }
    if (!parsed.resolution || !isNonEmptyString(parsed.resolution)) {
      return { valid: false, error: "resolve 시 resolution이 필요합니다" };
    }
  }

  return {
    valid: true,
    input: {
      action,
      description: isNonEmptyString(parsed.description) ? parsed.description : undefined,
      blockerId: isNonEmptyString(parsed.blockerId) ? parsed.blockerId : undefined,
      resolution: isNonEmptyString(parsed.resolution) ? parsed.resolution : undefined,
      includeResolved: isBoolean(parsed.includeResolved) ? parsed.includeResolved : false,
    },
  };
}

/**
 * context_maintain 통합 도구 검증
 */
export function validateMaintainInput(
  args: unknown
): { valid: true; input: MaintainInput } | { valid: false; error: string } {
  const parsed = parseArgs(args);

  // action 필수
  if (!parsed.action || !isNonEmptyString(parsed.action)) {
    return { valid: false, error: "action이 필요합니다 (cleanup, archive)" };
  }

  // action 유효성
  if (!VALID_MAINTAIN_ACTIONS.includes(parsed.action as typeof VALID_MAINTAIN_ACTIONS[number])) {
    return {
      valid: false,
      error: `잘못된 action: ${parsed.action}. 사용 가능: ${VALID_MAINTAIN_ACTIONS.join(", ")}`,
    };
  }

  const action = parsed.action as MaintainInput["action"];

  return {
    valid: true,
    input: {
      action,
      // cleanup 옵션
      olderThan: isNonEmptyString(parsed.olderThan) ? parsed.olderThan : "30d",
      dryRun: isBoolean(parsed.dryRun) ? parsed.dryRun : true,
      removeResolvedBlockers: isBoolean(parsed.removeResolvedBlockers) ? parsed.removeResolvedBlockers : false,
      keepOnlySuccessful: isBoolean(parsed.keepOnlySuccessful) ? parsed.keepOnlySuccessful : false,
      removeCompleted: isBoolean(parsed.removeCompleted) ? parsed.removeCompleted : false,
      // archive 옵션
      reason: isNonEmptyString(parsed.reason) ? parsed.reason : undefined,
      contextIds: isArray(parsed.contextIds)
        ? parsed.contextIds.filter((id) => isNonEmptyString(id)) as string[]
        : undefined,
      completedOnly: isBoolean(parsed.completedOnly) ? parsed.completedOnly : true,
      deleteAfterArchive: isBoolean(parsed.deleteAfterArchive) ? parsed.deleteAfterArchive : false,
    },
  };
}

/**
 * context_analyze 통합 도구 검증
 */
export function validateAnalyzeInput(
  args: unknown
): { valid: true; input: AnalyzeInput } | { valid: false; error: string } {
  const parsed = parseArgs(args);

  // action 필수
  if (!parsed.action || !isNonEmptyString(parsed.action)) {
    return { valid: false, error: "action이 필요합니다 (stats, recommend)" };
  }

  // action 유효성
  if (!VALID_ANALYZE_ACTIONS.includes(parsed.action as typeof VALID_ANALYZE_ACTIONS[number])) {
    return {
      valid: false,
      error: `잘못된 action: ${parsed.action}. 사용 가능: ${VALID_ANALYZE_ACTIONS.join(", ")}`,
    };
  }

  const action = parsed.action as AnalyzeInput["action"];

  // recommend 시 currentGoal 확인 (선택적 - 현재 컨텍스트에서 가져올 수 있음)
  const validRanges = ["last_7_days", "last_30_days", "last_90_days", "all"] as const;

  return {
    valid: true,
    input: {
      action,
      range: validRanges.includes(parsed.range as typeof validRanges[number])
        ? (parsed.range as AnalyzeInput["range"])
        : "last_30_days",
      currentGoal: isNonEmptyString(parsed.currentGoal) ? parsed.currentGoal : undefined,
      limit: clampLimit(
        isInteger(parsed.limit) ? parsed.limit : undefined,
        RECOMMEND_LIMITS.DEFAULT_LIMIT,
        RECOMMEND_LIMITS.MAX_LIMIT
      ),
    },
  };
}
