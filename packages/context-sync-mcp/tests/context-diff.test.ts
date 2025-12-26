/**
 * Context Diff Engine 테스트
 */

import { describe, it, expect, beforeEach } from "vitest";
import { ContextDiffEngine } from "../src/diff/context-diff.js";
import type { SharedContext } from "../src/types/index.js";

describe("ContextDiffEngine", () => {
  let diffEngine: ContextDiffEngine;
  let baseContext: SharedContext;

  beforeEach(() => {
    diffEngine = new ContextDiffEngine();
    baseContext = createBaseContext();
  });

  describe("compare", () => {
    it("should detect no changes for identical contexts", () => {
      const diff = diffEngine.compare(baseContext, baseContext);

      expect(diff.summary.totalChanges).toBe(0);
      expect(diff.summary.added).toBe(0);
      expect(diff.summary.removed).toBe(0);
      expect(diff.summary.modified).toBe(0);
    });

    it("should detect added decisions", () => {
      const target = JSON.parse(JSON.stringify(baseContext)) as SharedContext;
      target.conversationSummary.keyDecisions.push({
        id: "dec-2",
        what: "새로운 결정",
        why: "테스트를 위해",
        madeBy: "claude-code",
        timestamp: new Date(),
      });

      const diff = diffEngine.compare(baseContext, target);

      expect(diff.summary.added).toBe(1);
      expect(diff.changes.decisions.length).toBe(1);
      expect(diff.changes.decisions[0].type).toBe("added");
    });

    it("should detect removed blockers", () => {
      const source = JSON.parse(JSON.stringify(baseContext)) as SharedContext;
      source.conversationSummary.blockers.push({
        id: "blocker-1",
        description: "해결된 블로커",
        resolved: true,
        discoveredAt: new Date(),
      });

      const diff = diffEngine.compare(source, baseContext);

      expect(diff.summary.removed).toBe(1);
      expect(diff.changes.blockers.length).toBe(1);
      expect(diff.changes.blockers[0].type).toBe("removed");
    });

    it("should detect modified approaches", () => {
      const target = JSON.parse(JSON.stringify(baseContext)) as SharedContext;
      target.conversationSummary.triedApproaches.push({
        id: "approach-1",
        description: "첫 번째 접근",
        result: "success",
        attemptedBy: "claude-code",
        timestamp: new Date(),
      });
      const source = JSON.parse(JSON.stringify(target)) as SharedContext;
      target.conversationSummary.triedApproaches[0].result = "failed";
      target.conversationSummary.triedApproaches[0].reason = "테스트 실패";

      const diff = diffEngine.compare(source, target);

      expect(diff.summary.modified).toBe(1);
      expect(diff.changes.approaches[0].type).toBe("modified");
    });

    it("should detect changes in nextSteps", () => {
      const target = JSON.parse(JSON.stringify(baseContext)) as SharedContext;
      target.conversationSummary.nextSteps.push("새로운 단계");

      const diff = diffEngine.compare(baseContext, target);

      expect(diff.changes.nextSteps.length).toBe(1);
      expect(diff.changes.nextSteps[0].type).toBe("added");
      expect(diff.changes.nextSteps[0].newValue).toBe("새로운 단계");
    });

    it("should detect changes in handoffs", () => {
      const target = JSON.parse(JSON.stringify(baseContext)) as SharedContext;
      target.agentChain.push({
        from: "claude-code",
        to: "cursor",
        summary: "작업 인계",
        timestamp: new Date(),
      });

      const diff = diffEngine.compare(baseContext, target);

      expect(diff.changes.handoffs.length).toBe(1);
      expect(diff.changes.handoffs[0].type).toBe("added");
    });

    it("should detect metadata changes", () => {
      const target = JSON.parse(JSON.stringify(baseContext)) as SharedContext;
      target.currentWork.goal = "변경된 목표";

      const diff = diffEngine.compare(baseContext, target);

      const goalChange = diff.changes.metadata.find(
        (c) => c.path === "currentWork.goal"
      );
      expect(goalChange).toBeDefined();
      expect(goalChange?.type).toBe("modified");
      expect(goalChange?.newValue).toBe("변경된 목표");
    });
  });

  describe("merge", () => {
    it("should merge contexts with union strategy", () => {
      const source = JSON.parse(JSON.stringify(baseContext)) as SharedContext;
      const target = JSON.parse(JSON.stringify(baseContext)) as SharedContext;

      source.conversationSummary.keyDecisions.push({
        id: "dec-source",
        what: "Source 결정",
        why: "이유",
        madeBy: "claude-code",
        timestamp: new Date(),
      });

      target.conversationSummary.keyDecisions.push({
        id: "dec-target",
        what: "Target 결정",
        why: "이유",
        madeBy: "cursor",
        timestamp: new Date(),
      });

      const result = diffEngine.merge(source, target, {
        decisions: "union",
      });

      expect(result.success).toBe(true);
      expect(result.merged).toBeDefined();
      expect(result.merged!.conversationSummary.keyDecisions.length).toBe(2);
    });

    it("should prefer target on source_wins strategy for conflictResolution", () => {
      const source = JSON.parse(JSON.stringify(baseContext)) as SharedContext;
      const target = JSON.parse(JSON.stringify(baseContext)) as SharedContext;

      source.conversationSummary.nextSteps = ["Source 단계"];
      target.conversationSummary.nextSteps = ["Target 단계"];

      const result = diffEngine.merge(source, target, {
        nextSteps: "target",
      });

      expect(result.success).toBe(true);
      expect(result.merged!.conversationSummary.nextSteps).toContain("Target 단계");
    });

    it("should merge handoffs from both contexts", () => {
      const source = JSON.parse(JSON.stringify(baseContext)) as SharedContext;
      const target = JSON.parse(JSON.stringify(baseContext)) as SharedContext;

      source.agentChain.push({
        from: "claude-code",
        to: "cursor",
        summary: "Source handoff",
        timestamp: new Date("2024-01-01"),
      });

      target.agentChain.push({
        from: "cursor",
        to: "windsurf",
        summary: "Target handoff",
        timestamp: new Date("2024-01-02"),
      });

      const result = diffEngine.merge(source, target);

      expect(result.success).toBe(true);
      expect(result.merged!.agentChain.length).toBe(2);
    });

    it("should update version after merge", () => {
      const source = JSON.parse(JSON.stringify(baseContext)) as SharedContext;
      const target = JSON.parse(JSON.stringify(baseContext)) as SharedContext;
      source.version = 3;
      target.version = 5;

      const result = diffEngine.merge(source, target);

      expect(result.merged!.version).toBe(6);
    });
  });

  describe("toMarkdown", () => {
    it("should generate markdown summary", () => {
      const target = JSON.parse(JSON.stringify(baseContext)) as SharedContext;
      target.conversationSummary.keyDecisions.push({
        id: "dec-new",
        what: "새 결정",
        why: "테스트",
        madeBy: "claude-code",
        timestamp: new Date(),
      });

      const diff = diffEngine.compare(baseContext, target);
      const markdown = diffEngine.toMarkdown(diff);

      expect(markdown).toContain("## 컨텍스트 비교 결과");
      expect(markdown).toContain("### 변경 요약");
      expect(markdown).toContain("추가");
    });
  });
});

function createBaseContext(): SharedContext {
  return {
    id: "ctx-test",
    projectPath: "/test/project",
    currentWork: {
      goal: "테스트 목표",
      status: "coding",
      startedAt: new Date(),
      lastActiveAt: new Date(),
    },
    conversationSummary: {
      keyDecisions: [],
      triedApproaches: [],
      blockers: [],
      nextSteps: [],
    },
    codeChanges: {
      modifiedFiles: [],
      summary: "",
      uncommittedChanges: false,
    },
    agentChain: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    version: 1,
  };
}
