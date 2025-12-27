/**
 * v2.0+ 토큰 효율적 핸들러
 * context_search_v2, context_get, context_warn,
 * context_stats, context_export, context_recommend, context_archive
 */

import {
  getContext,
  validateGetInput,
  validateWarnInput,
  searchContextsWithScope,
  validateExtendedSearchInput,
  getEnhancedWarnings,
  formatEnhancedWarnings,
  getContextStats,
  validateStatsInput,
  formatStatsMarkdown,
  exportContexts,
  validateExportInput,
  recommendContexts,
  validateRecommendInput,
  formatRecommendMarkdown,
  executeArchive,
  validateArchiveInput,
  formatArchiveMarkdown,
} from "../tools/index.js";
import {
  type HandlerFn,
  successResponse,
  errorResponse,
  requireDatabase,
} from "./types.js";

/**
 * context_search_v2 핸들러
 */
export const handleContextSearchV2: HandlerFn = async (args, ctx) => {
  try {
    const db = requireDatabase(ctx);
    const input = validateExtendedSearchInput(args);
    const result = await searchContextsWithScope(db, input);

    const scopeLabel = input.scope === "global" ? "전역" : "프로젝트";
    let text = `🔍 검색 결과 [${scopeLabel}] (${result.total}건 중 ${result.hints.length}건)\n\n`;

    if (result.hints.length === 0) {
      text += "검색 결과가 없습니다.";
    } else {
      for (const hint of result.hints) {
        const warning = hint.hasWarnings ? " ⚠️" : "";
        const projectPath = (hint as { projectPath?: string }).projectPath;
        const pathInfo = projectPath
          ? ` [${projectPath.split(/[/\\]/).pop()}]`
          : "";
        text += `- [${hint.id.slice(0, 8)}] ${hint.goal} (${hint.date})${warning}${pathInfo}\n`;
      }
    }

    if (result.hasMore) {
      text += `\n💡 더 많은 결과가 있습니다. offset 파라미터를 사용하세요.`;
    }

    if (result.suggestion) {
      text += `\n📎 추천: ${result.suggestion}`;
    }

    return successResponse(text);
  } catch (err) {
    return errorResponse(
      `검색 오류: ${err instanceof Error ? err.message : err}`
    );
  }
};

/**
 * context_get 핸들러
 */
export const handleContextGet: HandlerFn = async (args, ctx) => {
  try {
    const db = requireDatabase(ctx);
    const input = validateGetInput(args);
    const result = getContext(db, input);

    if (!result) {
      return successResponse(`컨텍스트를 찾을 수 없습니다: ${input.id}`);
    }

    const ctxData = result.context;
    let text = `📋 컨텍스트 상세\n\n`;
    text += `**ID:** ${ctxData.id}\n`;
    text += `**목표:** ${ctxData.goal}\n`;
    text += `**상태:** ${ctxData.status}\n`;
    if (ctxData.summary) text += `**요약:** ${ctxData.summary}\n`;
    if (ctxData.tags && ctxData.tags.length > 0)
      text += `**태그:** ${ctxData.tags.join(", ")}\n`;
    text += `**시작:** ${ctxData.startedAt}\n`;
    if (ctxData.endedAt) text += `**종료:** ${ctxData.endedAt}\n`;

    // 메타데이터
    const meta = ctxData.metadata;
    if (meta.decisions && meta.decisions.length > 0) {
      text += `\n### 결정사항 (${meta.decisions.length}개)\n`;
      for (const d of meta.decisions.slice(0, 5)) {
        text += `- ${d.what}: ${d.why}\n`;
      }
      if (meta.decisions.length > 5)
        text += `  ... 외 ${meta.decisions.length - 5}개\n`;
    }

    if (meta.blockers && meta.blockers.length > 0) {
      const unresolved = meta.blockers.filter((b) => !b.resolved);
      if (unresolved.length > 0) {
        text += `\n### ⚠️ 미해결 블로커 (${unresolved.length}개)\n`;
        for (const b of unresolved) {
          text += `- ${b.description}\n`;
        }
      }
    }

    // 액션 로그
    if (result.actions && result.actions.length > 0) {
      text += `\n### 최근 액션 (${result.actions.length}개)\n`;
      for (const a of result.actions.slice(0, 5)) {
        text += `- [${a.type}] ${a.content.slice(0, 50)}${a.content.length > 50 ? "..." : ""}\n`;
      }
      if (result.actions.length > 5)
        text += `  ... 외 ${result.actions.length - 5}개\n`;
    }

    // 세션 체인
    if (result.chain && result.chain.length > 0) {
      text += `\n### 세션 체인\n`;
      for (const c of result.chain) {
        const isCurrent = c.id === ctxData.id ? " 👈" : "";
        text += `- [${c.id.slice(0, 8)}] ${c.goal}${isCurrent}\n`;
      }
    }

    return successResponse(text);
  } catch (err) {
    return errorResponse(
      `조회 오류: ${err instanceof Error ? err.message : err}`
    );
  }
};

/**
 * context_warn 핸들러
 */
export const handleContextWarn: HandlerFn = async (args, ctx) => {
  try {
    const db = requireDatabase(ctx);
    const input = validateWarnInput(args);
    const { basic, enhanced } = getEnhancedWarnings(db, input);

    let text = `⚡ 세션 시작 알림\n\n`;

    if (basic.warnings.length > 0) {
      text += `### ⚠️ 경고 (${basic.warnings.length}건)\n`;
      for (const w of basic.warnings) {
        text += `- ${w.message}\n`;
      }
      text += `\n`;
    }

    if (enhanced.length > 0) {
      text += formatEnhancedWarnings(enhanced);
    }

    if (basic.recommendations.length > 0) {
      text += `### 📚 관련 세션\n`;
      for (const r of basic.recommendations) {
        text += `- [${r.id.slice(0, 8)}] ${r.goal}\n`;
      }
    }

    if (
      basic.warnings.length === 0 &&
      basic.recommendations.length === 0 &&
      enhanced.length === 0
    ) {
      text += `관련 기록이 없습니다. 새로운 작업을 시작하세요!`;
    }

    if (basic.hasMore) {
      text += `\n\n💡 더 많은 관련 세션이 있습니다. context_search_v2로 검색하세요.`;
    }

    return successResponse(text);
  } catch (err) {
    return errorResponse(
      `경고 조회 오류: ${err instanceof Error ? err.message : err}`
    );
  }
};

/**
 * context_stats 핸들러
 */
export const handleContextStats: HandlerFn = async (args, ctx) => {
  try {
    const db = requireDatabase(ctx);
    const input = validateStatsInput(args);
    const stats = getContextStats(db, input);
    const markdown = formatStatsMarkdown(stats);
    return successResponse(markdown);
  } catch (err) {
    return errorResponse(
      `통계 조회 오류: ${err instanceof Error ? err.message : err}`
    );
  }
};

/**
 * context_export 핸들러
 */
export const handleContextExport: HandlerFn = async (args, ctx) => {
  try {
    const db = requireDatabase(ctx);
    const input = validateExportInput(args);
    const result = exportContexts(db, input);

    if (result.filePath) {
      return successResponse(
        `✅ ${result.exportedCount}개 컨텍스트를 내보냈습니다.\n\n파일: ${result.filePath}`
      );
    } else {
      return successResponse(result.content || "내보내기 결과가 없습니다.");
    }
  } catch (err) {
    return errorResponse(
      `내보내기 오류: ${err instanceof Error ? err.message : err}`
    );
  }
};

/**
 * context_recommend 핸들러
 */
export const handleContextRecommend: HandlerFn = async (args, ctx) => {
  try {
    const db = requireDatabase(ctx);
    const input = validateRecommendInput(args);
    const result = recommendContexts(db, input);
    const markdown = formatRecommendMarkdown(result);
    return successResponse(markdown);
  } catch (err) {
    return errorResponse(
      `추천 조회 오류: ${err instanceof Error ? err.message : err}`
    );
  }
};

/**
 * context_archive 핸들러
 */
export const handleContextArchive: HandlerFn = async (args, ctx) => {
  try {
    const db = requireDatabase(ctx);
    const input = validateArchiveInput(args);
    const result = executeArchive(db, input);
    const markdown = formatArchiveMarkdown(result);
    return successResponse(markdown);
  } catch (err) {
    return errorResponse(
      `아카이브 오류: ${err instanceof Error ? err.message : err}`
    );
  }
};

/**
 * v2 핸들러 레지스트리
 */
export const v2Handlers = new Map<string, HandlerFn>([
  ["context_search_v2", handleContextSearchV2],
  ["context_get", handleContextGet],
  ["context_warn", handleContextWarn],
  ["context_stats", handleContextStats],
  ["context_export", handleContextExport],
  ["context_recommend", handleContextRecommend],
  ["context_archive", handleContextArchive],
]);
