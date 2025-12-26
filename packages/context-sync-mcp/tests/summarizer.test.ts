import { describe, it, expect } from "vitest";
import { ContextSummarizer, createSummarizer } from "../src/utils/summarizer.js";
import type { SharedContext } from "../src/types/index.js";

// 테스트용 컨텍스트 생성
function createMockContext(overrides: Partial<SharedContext> = {}): SharedContext {
  const now = new Date();
  return {
    id: "test-context-id",
    version: 1,
    projectPath: "/test/project",
    createdAt: now,
    updatedAt: now,
    currentWork: {
      goal: "테스트 기능 구현",
      status: "coding",
      startedAt: now,
      lastActiveAt: now,
    },
    conversationSummary: {
      keyDecisions: [
        {
          id: "dec-1",
          what: "JWT 사용",
          why: "stateless 인증",
          madeBy: "claude-code",
          timestamp: now,
        },
        {
          id: "dec-2",
          what: "PostgreSQL 선택",
          why: "관계형 데이터 필요",
          madeBy: "cursor",
          timestamp: new Date(now.getTime() - 60000),
        },
      ],
      triedApproaches: [
        {
          id: "app-1",
          description: "세션 기반 인증",
          result: "failed",
          reason: "Redis 설정 복잡",
          attemptedBy: "claude-code",
          timestamp: now,
        },
        {
          id: "app-2",
          description: "REST API 구현",
          result: "success",
          attemptedBy: "cursor",
          timestamp: now,
        },
      ],
      blockers: [
        {
          id: "block-1",
          description: "CORS 이슈",
          resolved: false,
          reportedAt: now,
        },
        {
          id: "block-2",
          description: "타입 에러",
          resolved: true,
          resolution: "타입 정의 추가",
          resolvedAt: now,
          reportedAt: now,
        },
      ],
      nextSteps: ["로그인 UI 구현", "테스트 작성", "배포 설정"],
    },
    codeChanges: {
      modifiedFiles: ["src/auth.ts", "src/api.ts", "src/types.ts"],
      addedFiles: ["src/jwt.ts"],
      deletedFiles: [],
      summary: "인증 모듈 추가",
      lastCommit: "abc1234",
    },
    agentChain: [
      {
        from: "unknown",
        to: "claude-code",
        timestamp: new Date(now.getTime() - 120000),
        summary: "작업 시작",
      },
      {
        from: "claude-code",
        to: "cursor",
        timestamp: new Date(now.getTime() - 60000),
        summary: "UI 작업 인수인계",
      },
      {
        from: "cursor",
        to: "claude-code",
        timestamp: now,
        summary: "백엔드 작업 복귀",
      },
    ],
    ...overrides,
  };
}

describe("ContextSummarizer", () => {
  describe("constructor", () => {
    it("기본 설정으로 생성해야 함", () => {
      const summarizer = new ContextSummarizer();
      expect(summarizer).toBeDefined();
    });

    it("커스텀 압축 레벨로 생성해야 함", () => {
      const summarizer = new ContextSummarizer({ compressionLevel: "high" });
      expect(summarizer).toBeDefined();
    });
  });

  describe("summarize", () => {
    it("컨텍스트를 요약해야 함", () => {
      const summarizer = new ContextSummarizer();
      const context = createMockContext();
      const summary = summarizer.summarize(context);

      expect(summary.id).toBe(context.id);
      expect(summary.goal).toBe("테스트 기능 구현");
      expect(summary.status).toBe("coding");
    });

    it("최근 결정사항만 포함해야 함", () => {
      const summarizer = new ContextSummarizer({ maxDecisions: 1 });
      const context = createMockContext();
      const summary = summarizer.summarize(context);

      expect(summary.recentDecisions.length).toBeLessThanOrEqual(1);
    });

    it("실패한 접근법만 포함해야 함", () => {
      const summarizer = new ContextSummarizer();
      const context = createMockContext();
      const summary = summarizer.summarize(context);

      // 실패한 접근법만 포함되어야 함
      summary.failedApproaches.forEach((a) => {
        expect(a.description).toBeDefined();
      });
    });

    it("미해결 블로커만 포함해야 함", () => {
      const summarizer = new ContextSummarizer();
      const context = createMockContext();
      const summary = summarizer.summarize(context);

      // 해결된 블로커는 제외
      expect(summary.unresolvedBlockers.length).toBe(1);
      expect(summary.unresolvedBlockers[0].description).toBe("CORS 이슈");
    });

    it("에이전트 체인 마지막 3개만 포함해야 함", () => {
      const summarizer = new ContextSummarizer();
      const context = createMockContext();
      const summary = summarizer.summarize(context);

      expect(summary.agentHistory.length).toBeLessThanOrEqual(3);
    });
  });

  describe("compressionLevel", () => {
    it("none 레벨은 많은 항목을 유지해야 함", () => {
      const summarizer = new ContextSummarizer({ compressionLevel: "none" });
      const context = createMockContext();
      const summary = summarizer.summarize(context);

      // none 레벨은 최대 100개까지 유지
      expect(summary.recentDecisions.length).toBe(2); // 모든 결정 유지
    });

    it("high 레벨은 적은 항목만 유지해야 함", () => {
      const summarizer = new ContextSummarizer({ compressionLevel: "high" });
      const context = createMockContext();
      const summary = summarizer.summarize(context);

      expect(summary.nextSteps.length).toBeLessThanOrEqual(3);
    });
  });

  describe("toMarkdown", () => {
    it("마크다운 형식으로 출력해야 함", () => {
      const summarizer = new ContextSummarizer();
      const context = createMockContext();
      const markdown = summarizer.toMarkdown(context);

      expect(markdown).toContain("## 작업 컨텍스트");
      expect(markdown).toContain("**목표**: 테스트 기능 구현");
      expect(markdown).toContain("**상태**: coding");
    });

    it("주요 결정사항을 포함해야 함", () => {
      const summarizer = new ContextSummarizer();
      const context = createMockContext();
      const markdown = summarizer.toMarkdown(context);

      expect(markdown).toContain("### 주요 결정사항");
      expect(markdown).toContain("JWT 사용");
    });

    it("실패한 시도를 포함해야 함", () => {
      const summarizer = new ContextSummarizer();
      const context = createMockContext();
      const markdown = summarizer.toMarkdown(context);

      expect(markdown).toContain("### 시도했지만 실패한 것");
      expect(markdown).toContain("세션 기반 인증");
    });

    it("미해결 블로커를 포함해야 함", () => {
      const summarizer = new ContextSummarizer();
      const context = createMockContext();
      const markdown = summarizer.toMarkdown(context);

      expect(markdown).toContain("### 현재 막힌 부분");
      expect(markdown).toContain("CORS 이슈");
    });

    it("다음 단계를 포함해야 함", () => {
      const summarizer = new ContextSummarizer();
      const context = createMockContext();
      const markdown = summarizer.toMarkdown(context);

      expect(markdown).toContain("### 다음 단계");
      expect(markdown).toContain("로그인 UI 구현");
    });

    it("변경된 파일을 포함해야 함", () => {
      const summarizer = new ContextSummarizer();
      const context = createMockContext();
      const markdown = summarizer.toMarkdown(context);

      expect(markdown).toContain("### 변경된 파일");
      expect(markdown).toContain("src/auth.ts");
    });
  });

  describe("toJSON", () => {
    it("JSON 문자열을 반환해야 함", () => {
      const summarizer = new ContextSummarizer();
      const context = createMockContext();
      const json = summarizer.toJSON(context);

      const parsed = JSON.parse(json);
      expect(parsed.goal).toBe("테스트 기능 구현");
    });

    it("포맷팅된 JSON을 반환해야 함", () => {
      const summarizer = new ContextSummarizer();
      const context = createMockContext();
      const json = summarizer.toJSON(context);

      expect(json).toContain("\n"); // 들여쓰기 포함
    });
  });

  describe("toOneLiner", () => {
    it("한 줄 요약을 반환해야 함", () => {
      const summarizer = new ContextSummarizer();
      const context = createMockContext();
      const oneliner = summarizer.toOneLiner(context);

      expect(oneliner).toContain("[coding]");
      expect(oneliner).toContain("테스트 기능 구현");
      expect(oneliner).toContain("블로커: 1개");
    });

    it("다음 단계를 포함해야 함", () => {
      const summarizer = new ContextSummarizer();
      const context = createMockContext();
      const oneliner = summarizer.toOneLiner(context);

      expect(oneliner).toContain("다음: 로그인 UI 구현");
    });

    it("다음 단계가 없으면 기본 메시지를 표시해야 함", () => {
      const summarizer = new ContextSummarizer();
      const context = createMockContext({
        conversationSummary: {
          keyDecisions: [],
          triedApproaches: [],
          blockers: [],
          nextSteps: [],
        },
      });
      const oneliner = summarizer.toOneLiner(context);

      expect(oneliner).toContain("다음 단계 없음");
    });
  });

  describe("estimateTokens", () => {
    it("토큰 수를 추정해야 함", () => {
      const summarizer = new ContextSummarizer();
      const context = createMockContext();
      const tokens = summarizer.estimateTokens(context);

      expect(tokens).toBeGreaterThan(0);
      expect(typeof tokens).toBe("number");
    });

    it("압축 레벨이 높을수록 토큰 수가 적어야 함", () => {
      const lowSummarizer = new ContextSummarizer({ compressionLevel: "low" });
      const highSummarizer = new ContextSummarizer({ compressionLevel: "high" });
      const context = createMockContext();

      const lowTokens = lowSummarizer.estimateTokens(context);
      const highTokens = highSummarizer.estimateTokens(context);

      expect(highTokens).toBeLessThanOrEqual(lowTokens);
    });
  });
});

describe("createSummarizer", () => {
  it("요약기 인스턴스를 생성해야 함", () => {
    const summarizer = createSummarizer();
    expect(summarizer).toBeInstanceOf(ContextSummarizer);
  });

  it("설정을 전달해야 함", () => {
    const summarizer = createSummarizer({ compressionLevel: "high" });
    expect(summarizer).toBeInstanceOf(ContextSummarizer);
  });
});
