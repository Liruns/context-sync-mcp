/**
 * Context Sync MCP v2.2 - Tools Module
 * 토큰 효율적인 도구들
 * v2.2: context_archive 추가, 성능 최적화
 */

// v2.0 도구들
export {
  searchContexts,
  validateSearchInput,
  // v2.1 scope 확장
  searchContextsWithScope,
  validateExtendedSearchInput,
} from './context-search.js';

export {
  getContext,
  validateGetInput,
} from './context-get.js';

export {
  getContextWarnings,
  getSimpleWarnings,
  validateWarnInput,
  // v2.1 패턴 감지
  detectFailurePatterns,
  getEnhancedWarnings,
  formatEnhancedWarnings,
} from './context-warn.js';

// v2.1 도구들
export {
  getContextStats,
  validateStatsInput,
  formatStatsMarkdown,
} from './context-stats.js';

export {
  exportContexts,
  validateExportInput,
} from './context-export.js';

export {
  recommendContexts,
  validateRecommendInput,
  formatRecommendMarkdown,
} from './context-recommend.js';

// v2.2 새 도구
export {
  executeArchive,
  validateArchiveInput,
  formatArchiveMarkdown,
} from './context-archive.js';

export type {
  ContextArchiveInput,
  ContextArchiveOutput,
  ArchiveAction,
} from './context-archive.js';
