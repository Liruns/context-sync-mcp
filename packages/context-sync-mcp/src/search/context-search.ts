/**
 * Context Search Engine - 컨텍스트 검색
 * 결정사항, 블로커, 접근법 등을 검색합니다.
 */

import type {
  SharedContext,
  Decision,
  Approach,
  Blocker,
  AgentHandoff,
  AgentType,
} from "../types/index.js";

/** 검색 대상 카테고리 */
export type SearchCategory =
  | "all"
  | "decisions"
  | "approaches"
  | "blockers"
  | "files"
  | "nextSteps"
  | "handoffs";

/** 검색 결과 항목 */
export interface SearchResultItem {
  /** 결과 유형 */
  category: SearchCategory;
  /** 일치 점수 (0-100) */
  score: number;
  /** 원본 데이터 */
  data: Decision | Approach | Blocker | AgentHandoff | string;
  /** 일치한 필드 */
  matchedField: string;
  /** 일치한 텍스트 (하이라이트용) */
  matchedText: string;
  /** 타임스탬프 */
  timestamp?: Date;
}

/** 검색 결과 */
export interface SearchResult {
  /** 검색어 */
  query: string;
  /** 검색 대상 */
  categories: SearchCategory[];
  /** 결과 항목 */
  items: SearchResultItem[];
  /** 총 결과 수 */
  totalCount: number;
  /** 검색 소요 시간 (ms) */
  searchTimeMs: number;
}

/** 검색 옵션 */
export interface SearchOptions {
  /** 검색 대상 카테고리 */
  categories?: SearchCategory[];
  /** 최대 결과 수 */
  maxResults?: number;
  /** 최소 점수 */
  minScore?: number;
  /** 대소문자 구분 */
  caseSensitive?: boolean;
  /** 정규식 사용 */
  useRegex?: boolean;
  /** 에이전트 필터 */
  agentFilter?: AgentType[];
  /** 날짜 범위 시작 */
  dateFrom?: Date;
  /** 날짜 범위 끝 */
  dateTo?: Date;
  /** 정렬 기준 */
  sortBy?: "score" | "date" | "category";
  /** 정렬 방향 */
  sortOrder?: "asc" | "desc";
}

/** 기본 옵션 */
const DEFAULT_OPTIONS: Required<SearchOptions> = {
  categories: ["all"],
  maxResults: 50,
  minScore: 10,
  caseSensitive: false,
  useRegex: false,
  agentFilter: [],
  dateFrom: new Date(0),
  dateTo: new Date(Date.now() + 86400000), // 내일까지
  sortBy: "score",
  sortOrder: "desc",
};

/**
 * 컨텍스트 검색 엔진 클래스
 */
export class ContextSearchEngine {
  /**
   * 컨텍스트 검색
   */
  search(
    context: SharedContext,
    query: string,
    options: SearchOptions = {}
  ): SearchResult {
    const startTime = Date.now();
    const opts = { ...DEFAULT_OPTIONS, ...options };
    const items: SearchResultItem[] = [];

    // 검색 대상 카테고리 결정
    const categories = opts.categories.includes("all")
      ? ["decisions", "approaches", "blockers", "files", "nextSteps", "handoffs"] as SearchCategory[]
      : opts.categories;

    // 검색 패턴 생성
    const pattern = this.createSearchPattern(query, opts);

    // 각 카테고리별 검색
    for (const category of categories) {
      const categoryResults = this.searchCategory(context, category, pattern, opts);
      items.push(...categoryResults);
    }

    // 정렬
    this.sortResults(items, opts);

    // 최대 결과 수 제한
    const limitedItems = items.slice(0, opts.maxResults);

    return {
      query,
      categories,
      items: limitedItems,
      totalCount: items.length,
      searchTimeMs: Date.now() - startTime,
    };
  }

  /**
   * 검색 패턴 생성
   */
  private createSearchPattern(query: string, opts: Required<SearchOptions>): RegExp {
    let pattern: string;

    if (opts.useRegex) {
      pattern = query;
    } else {
      // 특수문자 이스케이프
      pattern = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }

    const flags = opts.caseSensitive ? "g" : "gi";
    return new RegExp(pattern, flags);
  }

  /**
   * 카테고리별 검색
   */
  private searchCategory(
    context: SharedContext,
    category: SearchCategory,
    pattern: RegExp,
    opts: Required<SearchOptions>
  ): SearchResultItem[] {
    const results: SearchResultItem[] = [];

    switch (category) {
      case "decisions":
        for (const decision of context.conversationSummary.keyDecisions) {
          const matches = this.searchDecision(decision, pattern, opts);
          results.push(...matches);
        }
        break;

      case "approaches":
        for (const approach of context.conversationSummary.triedApproaches) {
          const matches = this.searchApproach(approach, pattern, opts);
          results.push(...matches);
        }
        break;

      case "blockers":
        for (const blocker of context.conversationSummary.blockers) {
          const matches = this.searchBlocker(blocker, pattern, opts);
          results.push(...matches);
        }
        break;

      case "files":
        for (const file of context.codeChanges.modifiedFiles) {
          const match = this.searchFile(file, pattern, opts);
          if (match) results.push(match);
        }
        break;

      case "nextSteps":
        for (const step of context.conversationSummary.nextSteps) {
          const match = this.searchNextStep(step, pattern, opts);
          if (match) results.push(match);
        }
        break;

      case "handoffs":
        for (const handoff of context.agentChain) {
          const matches = this.searchHandoff(handoff, pattern, opts);
          results.push(...matches);
        }
        break;
    }

    return results;
  }

  /**
   * 결정사항 검색
   */
  private searchDecision(
    decision: Decision,
    pattern: RegExp,
    opts: Required<SearchOptions>
  ): SearchResultItem[] {
    const results: SearchResultItem[] = [];

    // 에이전트 필터
    if (opts.agentFilter.length > 0 && !opts.agentFilter.includes(decision.madeBy)) {
      return results;
    }

    // 날짜 필터
    if (decision.timestamp < opts.dateFrom || decision.timestamp > opts.dateTo) {
      return results;
    }

    // what 필드 검색
    const whatMatch = decision.what.match(pattern);
    if (whatMatch) {
      results.push({
        category: "decisions",
        score: this.calculateScore(decision.what, whatMatch[0]),
        data: decision,
        matchedField: "what",
        matchedText: whatMatch[0],
        timestamp: decision.timestamp,
      });
    }

    // why 필드 검색
    const whyMatch = decision.why.match(pattern);
    if (whyMatch) {
      results.push({
        category: "decisions",
        score: this.calculateScore(decision.why, whyMatch[0]),
        data: decision,
        matchedField: "why",
        matchedText: whyMatch[0],
        timestamp: decision.timestamp,
      });
    }

    // 점수 필터링
    return results.filter((r) => r.score >= opts.minScore);
  }

  /**
   * 접근법 검색
   */
  private searchApproach(
    approach: Approach,
    pattern: RegExp,
    opts: Required<SearchOptions>
  ): SearchResultItem[] {
    const results: SearchResultItem[] = [];

    // 에이전트 필터
    if (opts.agentFilter.length > 0 && !opts.agentFilter.includes(approach.attemptedBy)) {
      return results;
    }

    // 날짜 필터
    if (approach.timestamp < opts.dateFrom || approach.timestamp > opts.dateTo) {
      return results;
    }

    // description 필드 검색
    const descMatch = approach.description.match(pattern);
    if (descMatch) {
      results.push({
        category: "approaches",
        score: this.calculateScore(approach.description, descMatch[0]),
        data: approach,
        matchedField: "description",
        matchedText: descMatch[0],
        timestamp: approach.timestamp,
      });
    }

    // reason 필드 검색
    if (approach.reason) {
      const reasonMatch = approach.reason.match(pattern);
      if (reasonMatch) {
        results.push({
          category: "approaches",
          score: this.calculateScore(approach.reason, reasonMatch[0]),
          data: approach,
          matchedField: "reason",
          matchedText: reasonMatch[0],
          timestamp: approach.timestamp,
        });
      }
    }

    return results.filter((r) => r.score >= opts.minScore);
  }

  /**
   * 블로커 검색
   */
  private searchBlocker(
    blocker: Blocker,
    pattern: RegExp,
    opts: Required<SearchOptions>
  ): SearchResultItem[] {
    const results: SearchResultItem[] = [];

    // 날짜 필터
    if (blocker.discoveredAt < opts.dateFrom || blocker.discoveredAt > opts.dateTo) {
      return results;
    }

    // description 필드 검색
    const descMatch = blocker.description.match(pattern);
    if (descMatch) {
      results.push({
        category: "blockers",
        score: this.calculateScore(blocker.description, descMatch[0]),
        data: blocker,
        matchedField: "description",
        matchedText: descMatch[0],
        timestamp: blocker.discoveredAt,
      });
    }

    // resolution 필드 검색
    if (blocker.resolution) {
      const resMatch = blocker.resolution.match(pattern);
      if (resMatch) {
        results.push({
          category: "blockers",
          score: this.calculateScore(blocker.resolution, resMatch[0]),
          data: blocker,
          matchedField: "resolution",
          matchedText: resMatch[0],
          timestamp: blocker.resolvedAt,
        });
      }
    }

    return results.filter((r) => r.score >= opts.minScore);
  }

  /**
   * 파일 검색
   */
  private searchFile(
    file: string,
    pattern: RegExp,
    opts: Required<SearchOptions>
  ): SearchResultItem | null {
    const match = file.match(pattern);
    if (!match) return null;

    const score = this.calculateScore(file, match[0]);
    if (score < opts.minScore) return null;

    return {
      category: "files",
      score,
      data: file,
      matchedField: "path",
      matchedText: match[0],
    };
  }

  /**
   * 다음 단계 검색
   */
  private searchNextStep(
    step: string,
    pattern: RegExp,
    opts: Required<SearchOptions>
  ): SearchResultItem | null {
    const match = step.match(pattern);
    if (!match) return null;

    const score = this.calculateScore(step, match[0]);
    if (score < opts.minScore) return null;

    return {
      category: "nextSteps",
      score,
      data: step,
      matchedField: "content",
      matchedText: match[0],
    };
  }

  /**
   * 핸드오프 검색
   */
  private searchHandoff(
    handoff: AgentHandoff,
    pattern: RegExp,
    opts: Required<SearchOptions>
  ): SearchResultItem[] {
    const results: SearchResultItem[] = [];

    // 에이전트 필터
    if (opts.agentFilter.length > 0) {
      if (!opts.agentFilter.includes(handoff.from) && !opts.agentFilter.includes(handoff.to)) {
        return results;
      }
    }

    // 날짜 필터
    if (handoff.timestamp < opts.dateFrom || handoff.timestamp > opts.dateTo) {
      return results;
    }

    // summary 필드 검색
    const summaryMatch = handoff.summary.match(pattern);
    if (summaryMatch) {
      const score = this.calculateScore(handoff.summary, summaryMatch[0]);
      if (score >= opts.minScore) {
        results.push({
          category: "handoffs",
          score,
          data: handoff,
          matchedField: "summary",
          matchedText: summaryMatch[0],
          timestamp: handoff.timestamp,
        });
      }
    }

    return results;
  }

  /**
   * 일치 점수 계산
   */
  private calculateScore(text: string, match: string): number {
    // 일치 비율 기반 점수
    const ratio = match.length / text.length;

    // 기본 점수 (50점) + 비율 점수 (최대 50점)
    let score = 50 + Math.round(ratio * 50);

    // 정확한 일치 보너스
    if (text.toLowerCase() === match.toLowerCase()) {
      score = 100;
    }

    // 시작 부분 일치 보너스
    if (text.toLowerCase().startsWith(match.toLowerCase())) {
      score = Math.min(100, score + 10);
    }

    return Math.min(100, Math.max(0, score));
  }

  /**
   * 결과 정렬
   */
  private sortResults(items: SearchResultItem[], opts: Required<SearchOptions>): void {
    items.sort((a, b) => {
      let comparison = 0;

      switch (opts.sortBy) {
        case "score":
          comparison = a.score - b.score;
          break;
        case "date":
          const aTime = a.timestamp?.getTime() ?? 0;
          const bTime = b.timestamp?.getTime() ?? 0;
          comparison = aTime - bTime;
          break;
        case "category":
          comparison = a.category.localeCompare(b.category);
          break;
      }

      return opts.sortOrder === "desc" ? -comparison : comparison;
    });
  }

  /**
   * 결과를 마크다운으로 변환
   */
  toMarkdown(result: SearchResult): string {
    const lines: string[] = [
      `## 검색 결과: "${result.query}"`,
      "",
      `- **총 결과**: ${result.totalCount}건`,
      `- **검색 시간**: ${result.searchTimeMs}ms`,
      `- **검색 대상**: ${result.categories.join(", ")}`,
      "",
    ];

    if (result.items.length === 0) {
      lines.push("*검색 결과가 없습니다.*");
      return lines.join("\n");
    }

    // 카테고리별 그룹화
    const byCategory = new Map<SearchCategory, SearchResultItem[]>();
    for (const item of result.items) {
      const list = byCategory.get(item.category) ?? [];
      list.push(item);
      byCategory.set(item.category, list);
    }

    const categoryNames: Record<SearchCategory, string> = {
      all: "전체",
      decisions: "결정사항",
      approaches: "접근법",
      blockers: "블로커",
      files: "파일",
      nextSteps: "다음 단계",
      handoffs: "인수인계",
    };

    for (const [category, items] of byCategory) {
      lines.push(`### ${categoryNames[category]} (${items.length}건)`);
      lines.push("");

      for (const item of items) {
        const scoreBar = "█".repeat(Math.round(item.score / 10)) + "░".repeat(10 - Math.round(item.score / 10));
        lines.push(`- **[${item.score}점]** ${scoreBar}`);
        lines.push(`  - 일치: "${item.matchedText}" (${item.matchedField} 필드)`);
        if (typeof item.data === "string") {
          lines.push(`  - 내용: ${item.data}`);
        } else if ("what" in item.data) {
          lines.push(`  - 내용: ${(item.data as Decision).what}`);
        } else if ("description" in item.data) {
          lines.push(`  - 내용: ${(item.data as Approach | Blocker).description}`);
        } else if ("summary" in item.data) {
          lines.push(`  - 내용: ${(item.data as AgentHandoff).summary}`);
        }
        lines.push("");
      }
    }

    return lines.join("\n");
  }

  /**
   * 빠른 검색 (카테고리 지정 없이)
   */
  quickSearch(context: SharedContext, query: string, maxResults: number = 10): SearchResultItem[] {
    const result = this.search(context, query, { maxResults });
    return result.items;
  }

  /**
   * 미해결 블로커 검색
   */
  findUnresolvedBlockers(context: SharedContext): Blocker[] {
    return context.conversationSummary.blockers.filter((b) => !b.resolved);
  }

  /**
   * 실패한 접근법 검색
   */
  findFailedApproaches(context: SharedContext): Approach[] {
    return context.conversationSummary.triedApproaches.filter((a) => a.result === "failed");
  }

  /**
   * 특정 에이전트의 결정사항 검색
   */
  findDecisionsByAgent(context: SharedContext, agent: AgentType): Decision[] {
    return context.conversationSummary.keyDecisions.filter((d) => d.madeBy === agent);
  }
}

/**
 * 검색 엔진 생성 헬퍼
 */
export function createSearchEngine(): ContextSearchEngine {
  return new ContextSearchEngine();
}
