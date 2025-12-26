/**
 * Context Search Engine 테스트
 */

import { describe, it, expect, beforeEach } from "vitest";
import { ContextSearchEngine } from "../src/search/context-search.js";
import type { SharedContext } from "../src/types/index.js";

describe("ContextSearchEngine", () => {
  let searchEngine: ContextSearchEngine;
  let testContext: SharedContext;

  beforeEach(() => {
    searchEngine = new ContextSearchEngine();
    testContext = createTestContext();
  });

  describe("search", () => {
    it("should find decisions by keyword", () => {
      const result = searchEngine.search(testContext, "JWT");

      expect(result.query).toBe("JWT");
      expect(result.totalCount).toBeGreaterThan(0);
      expect(result.items.some((r) => r.category === "decisions")).toBe(true);
    });

    it("should find approaches by keyword", () => {
      const result = searchEngine.search(testContext, "API");

      expect(result.items.some((r) => r.category === "approaches")).toBe(true);
    });

    it("should find blockers by keyword", () => {
      const result = searchEngine.search(testContext, "CORS");

      expect(result.items.some((r) => r.category === "blockers")).toBe(true);
    });

    it("should search in nextSteps", () => {
      const result = searchEngine.search(testContext, "문서화");

      expect(result.items.some((r) => r.category === "nextSteps")).toBe(true);
    });

    it("should search in files", () => {
      const result = searchEngine.search(testContext, "auth");

      expect(result.items.some((r) => r.category === "files")).toBe(true);
    });

    it("should return empty results for non-matching query", () => {
      const result = searchEngine.search(testContext, "xyz123nonexistent");

      expect(result.totalCount).toBe(0);
      expect(result.items.length).toBe(0);
    });

    it("should respect maxResults option", () => {
      const result = searchEngine.search(testContext, "테스트", {
        maxResults: 2,
      });

      expect(result.items.length).toBeLessThanOrEqual(2);
    });

    it("should filter by category", () => {
      const result = searchEngine.search(testContext, "테스트", {
        categories: ["decisions"],
      });

      expect(result.items.every((r) => r.category === "decisions")).toBe(true);
    });

    it("should respect minScore option", () => {
      const result = searchEngine.search(testContext, "JWT", {
        minScore: 50,
      });

      expect(result.items.every((r) => r.score >= 50)).toBe(true);
    });

    it("should sort results by score descending", () => {
      const result = searchEngine.search(testContext, "테스트");

      for (let i = 1; i < result.items.length; i++) {
        expect(result.items[i - 1].score).toBeGreaterThanOrEqual(
          result.items[i].score
        );
      }
    });

    it("should calculate search time", () => {
      const result = searchEngine.search(testContext, "JWT");

      expect(result.searchTimeMs).toBeGreaterThanOrEqual(0);
    });

    it("should be case-insensitive", () => {
      const resultLower = searchEngine.search(testContext, "jwt");
      const resultUpper = searchEngine.search(testContext, "JWT");

      expect(resultLower.totalCount).toBe(resultUpper.totalCount);
    });
  });

  describe("quickSearch", () => {
    it("should return limited results quickly", () => {
      const results = searchEngine.quickSearch(testContext, "테스트", 3);

      expect(results.length).toBeLessThanOrEqual(3);
    });

    it("should return items directly without wrapper", () => {
      const results = searchEngine.quickSearch(testContext, "JWT");

      expect(Array.isArray(results)).toBe(true);
      if (results.length > 0) {
        expect(results[0]).toHaveProperty("category");
        expect(results[0]).toHaveProperty("score");
      }
    });
  });

  describe("findUnresolvedBlockers", () => {
    it("should find only unresolved blockers", () => {
      const blockers = searchEngine.findUnresolvedBlockers(testContext);

      expect(blockers.length).toBeGreaterThan(0);
      expect(blockers.every((b) => !b.resolved)).toBe(true);
    });

    it("should not return resolved blockers", () => {
      const blockers = searchEngine.findUnresolvedBlockers(testContext);

      // resolved된 "테스트 실패" 블로커는 포함되지 않아야 함
      expect(blockers.some((b) => b.description.includes("테스트 실패"))).toBe(false);
    });
  });

  describe("findFailedApproaches", () => {
    it("should find only failed approaches", () => {
      const failed = searchEngine.findFailedApproaches(testContext);

      expect(failed.length).toBeGreaterThan(0);
      expect(failed.every((a) => a.result === "failed")).toBe(true);
    });
  });

  describe("toMarkdown", () => {
    it("should generate markdown for search results", () => {
      const result = searchEngine.search(testContext, "JWT");
      const markdown = searchEngine.toMarkdown(result);

      expect(markdown).toContain("## 검색 결과");
      expect(markdown).toContain("JWT");
      expect(markdown).toContain("건");
    });

    it("should show message for empty results", () => {
      const result = searchEngine.search(testContext, "xyz123nonexistent");
      const markdown = searchEngine.toMarkdown(result);

      expect(markdown).toContain("검색 결과가 없습니다");
    });

    it("should include category sections", () => {
      const result = searchEngine.search(testContext, "JWT");
      const markdown = searchEngine.toMarkdown(result);

      // 마크다운에 카테고리별 섹션이 포함되어야 함
      expect(markdown).toContain("### 결정사항");
    });

    it("should include scores in results", () => {
      const result = searchEngine.search(testContext, "JWT");
      const markdown = searchEngine.toMarkdown(result);

      // 점수가 [숫자점] 형태로 표시됨
      expect(markdown).toMatch(/\[\d+점\]/);
    });
  });

  describe("complex queries", () => {
    it("should handle partial matches", () => {
      const result = searchEngine.search(testContext, "인증");

      // "JWT 인증" 등에서 매치되어야 함
      expect(result.totalCount).toBeGreaterThan(0);
    });

    it("should handle Korean and English mixed search", () => {
      const resultKo = searchEngine.search(testContext, "인증");
      const resultEn = searchEngine.search(testContext, "auth");

      expect(resultKo.totalCount).toBeGreaterThan(0);
      expect(resultEn.totalCount).toBeGreaterThan(0);
    });
  });

  describe("search in handoffs", () => {
    it("should find handoff records by summary", () => {
      // searchHandoff은 summary 필드를 검색함
      const result = searchEngine.search(testContext, "기본 구조");

      expect(result.items.some((r) => r.category === "handoffs")).toBe(true);
    });
  });
});

function createTestContext(): SharedContext {
  return {
    id: "ctx-test-search",
    projectPath: "/test/project",
    currentWork: {
      goal: "사용자 인증 시스템 구현",
      status: "coding",
      startedAt: new Date(),
      lastActiveAt: new Date(),
    },
    conversationSummary: {
      keyDecisions: [
        {
          id: "dec-1",
          what: "JWT 인증 방식 사용",
          why: "세션보다 stateless하고 확장성이 좋음",
          madeBy: "claude-code",
          timestamp: new Date(),
        },
        {
          id: "dec-2",
          what: "테스트 프레임워크로 Vitest 선택",
          why: "Vite 프로젝트와 호환성 및 빠른 실행",
          madeBy: "claude-code",
          timestamp: new Date(),
        },
      ],
      triedApproaches: [
        {
          id: "app-1",
          description: "REST API로 인증 구현 시도",
          result: "success",
          attemptedBy: "claude-code",
          timestamp: new Date(),
        },
        {
          id: "app-2",
          description: "OAuth2 통합 테스트",
          result: "failed",
          reason: "클라이언트 설정 문제",
          attemptedBy: "claude-code",
          timestamp: new Date(),
        },
      ],
      blockers: [
        {
          id: "block-1",
          description: "CORS 설정 문제로 API 호출 실패",
          resolved: false,
          discoveredAt: new Date(),
        },
        {
          id: "block-2",
          description: "테스트 실패 - 모킹 문제",
          resolved: true,
          discoveredAt: new Date(),
          resolvedAt: new Date(),
          resolution: "vitest-mock 사용",
        },
      ],
      nextSteps: [
        "API 문서화 완료",
        "테스트 커버리지 80% 달성",
        "코드 리뷰 요청",
      ],
    },
    codeChanges: {
      modifiedFiles: ["src/auth/login.ts", "src/auth/token.ts", "tests/auth.test.ts"],
      summary: "인증 모듈 구현",
      uncommittedChanges: true,
    },
    agentChain: [
      {
        from: "claude-code",
        to: "cursor",
        summary: "기본 구조 완성, 세부 구현 필요",
        timestamp: new Date(),
      },
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
    version: 1,
  };
}
