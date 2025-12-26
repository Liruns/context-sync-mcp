import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs/promises";
import * as path from "path";
import { ContextStore } from "../src/store/context-store.js";

const TEST_PROJECT_PATH = path.join(process.cwd(), ".test-context");

describe("ContextStore", () => {
  let store: ContextStore;

  beforeEach(async () => {
    store = new ContextStore(TEST_PROJECT_PATH);
    await store.initialize();
  });

  afterEach(async () => {
    // 테스트 디렉토리 정리
    await fs.rm(TEST_PROJECT_PATH, { recursive: true, force: true });
  });

  describe("initialize", () => {
    it("저장소 디렉토리를 생성해야 함", async () => {
      const storePath = path.join(TEST_PROJECT_PATH, ".context-sync");
      const stat = await fs.stat(storePath);
      expect(stat.isDirectory()).toBe(true);
    });

    it("snapshots 디렉토리를 생성해야 함", async () => {
      const snapshotsPath = path.join(TEST_PROJECT_PATH, ".context-sync", "snapshots");
      const stat = await fs.stat(snapshotsPath);
      expect(stat.isDirectory()).toBe(true);
    });

    it("config.json을 생성해야 함", async () => {
      const configPath = path.join(TEST_PROJECT_PATH, ".context-sync", "config.json");
      const content = await fs.readFile(configPath, "utf-8");
      const config = JSON.parse(content);
      expect(config.syncMode).toBe("seamless");
    });
  });

  describe("createContext", () => {
    it("새 컨텍스트를 생성해야 함", async () => {
      const context = await store.createContext({
        projectPath: TEST_PROJECT_PATH,
        goal: "테스트 기능 구현",
        agent: "claude-code",
      });

      expect(context.id).toBeDefined();
      expect(context.currentWork.goal).toBe("테스트 기능 구현");
      expect(context.currentWork.status).toBe("planning");
      expect(context.agentChain).toHaveLength(1);
      expect(context.agentChain[0].to).toBe("claude-code");
    });

    it("컨텍스트를 파일에 저장해야 함", async () => {
      await store.createContext({
        projectPath: TEST_PROJECT_PATH,
        goal: "저장 테스트",
      });

      const contextPath = path.join(TEST_PROJECT_PATH, ".context-sync", "current.json");
      const content = await fs.readFile(contextPath, "utf-8");
      const saved = JSON.parse(content);
      expect(saved.currentWork.goal).toBe("저장 테스트");
    });
  });

  describe("getContext", () => {
    it("저장된 컨텍스트를 반환해야 함", async () => {
      await store.createContext({
        projectPath: TEST_PROJECT_PATH,
        goal: "조회 테스트",
      });

      const context = await store.getContext();
      expect(context).not.toBeNull();
      expect(context?.currentWork.goal).toBe("조회 테스트");
    });

    it("컨텍스트가 없으면 null을 반환해야 함", async () => {
      const newStore = new ContextStore(path.join(TEST_PROJECT_PATH, "empty"));
      await newStore.initialize();
      const context = await newStore.getContext();
      expect(context).toBeNull();
    });
  });

  describe("updateContext", () => {
    it("목표를 업데이트해야 함", async () => {
      await store.createContext({
        projectPath: TEST_PROJECT_PATH,
        goal: "원래 목표",
      });

      const updated = await store.updateContext({ goal: "새 목표" });
      expect(updated?.currentWork.goal).toBe("새 목표");
    });

    it("상태를 업데이트해야 함", async () => {
      await store.createContext({
        projectPath: TEST_PROJECT_PATH,
        goal: "상태 테스트",
      });

      const updated = await store.updateContext({ status: "coding" });
      expect(updated?.currentWork.status).toBe("coding");
    });

    it("버전을 증가시켜야 함", async () => {
      const created = await store.createContext({
        projectPath: TEST_PROJECT_PATH,
        goal: "버전 테스트",
      });
      const originalVersion = created.version;

      const updated = await store.updateContext({ status: "testing" });
      expect(updated?.version).toBe(originalVersion + 1);
    });
  });

  describe("addDecision", () => {
    it("의사결정을 추가해야 함", async () => {
      await store.createContext({
        projectPath: TEST_PROJECT_PATH,
        goal: "결정 테스트",
      });

      const decision = await store.addDecision("JWT 사용", "stateless 인증", "claude-code");
      expect(decision.what).toBe("JWT 사용");
      expect(decision.why).toBe("stateless 인증");
      expect(decision.madeBy).toBe("claude-code");
    });

    it("컨텍스트에 결정이 저장되어야 함", async () => {
      await store.createContext({
        projectPath: TEST_PROJECT_PATH,
        goal: "결정 저장 테스트",
      });

      await store.addDecision("결정1", "이유1");
      await store.addDecision("결정2", "이유2");

      const context = await store.getContext();
      expect(context?.conversationSummary.keyDecisions).toHaveLength(2);
    });

    it("컨텍스트가 없으면 에러를 던져야 함", async () => {
      const newStore = new ContextStore(path.join(TEST_PROJECT_PATH, "empty2"));
      await newStore.initialize();
      await expect(newStore.addDecision("test", "test")).rejects.toThrow("No active context");
    });
  });

  describe("addApproach", () => {
    it("시도한 접근법을 추가해야 함", async () => {
      await store.createContext({
        projectPath: TEST_PROJECT_PATH,
        goal: "접근법 테스트",
      });

      const approach = await store.addApproach("REST API", "success");
      expect(approach.description).toBe("REST API");
      expect(approach.result).toBe("success");
    });

    it("실패한 접근법에 이유를 기록해야 함", async () => {
      await store.createContext({
        projectPath: TEST_PROJECT_PATH,
        goal: "실패 테스트",
      });

      const approach = await store.addApproach("GraphQL", "failed", "복잡도 증가");
      expect(approach.result).toBe("failed");
      expect(approach.reason).toBe("복잡도 증가");
    });
  });

  describe("addBlocker / resolveBlocker", () => {
    it("블로커를 추가해야 함", async () => {
      await store.createContext({
        projectPath: TEST_PROJECT_PATH,
        goal: "블로커 테스트",
      });

      const blocker = await store.addBlocker("API 키 없음");
      expect(blocker.description).toBe("API 키 없음");
      expect(blocker.resolved).toBe(false);
    });

    it("블로커를 해결해야 함", async () => {
      await store.createContext({
        projectPath: TEST_PROJECT_PATH,
        goal: "해결 테스트",
      });

      const blocker = await store.addBlocker("권한 문제");
      const resolved = await store.resolveBlocker(blocker.id, "admin 권한 획득");

      expect(resolved?.resolved).toBe(true);
      expect(resolved?.resolution).toBe("admin 권한 획득");
    });

    it("존재하지 않는 블로커 해결 시 null 반환", async () => {
      await store.createContext({
        projectPath: TEST_PROJECT_PATH,
        goal: "없는 블로커",
      });

      const result = await store.resolveBlocker("invalid-id", "해결");
      expect(result).toBeNull();
    });
  });

  describe("recordHandoff", () => {
    it("핸드오프를 기록해야 함", async () => {
      await store.createContext({
        projectPath: TEST_PROJECT_PATH,
        goal: "핸드오프 테스트",
      });

      const handoff = await store.recordHandoff("claude-code", "cursor", "기본 구현 완료");
      expect(handoff.from).toBe("claude-code");
      expect(handoff.to).toBe("cursor");
      expect(handoff.summary).toBe("기본 구현 완료");
    });

    it("에이전트 체인에 추가되어야 함", async () => {
      await store.createContext({
        projectPath: TEST_PROJECT_PATH,
        goal: "체인 테스트",
        agent: "claude-code",
      });

      await store.recordHandoff("claude-code", "cursor", "인계1");
      await store.recordHandoff("cursor", "windsurf", "인계2");

      const context = await store.getContext();
      expect(context?.agentChain).toHaveLength(3); // 초기 + 2개
    });
  });

  describe("snapshot", () => {
    it("스냅샷을 생성해야 함", async () => {
      await store.createContext({
        projectPath: TEST_PROJECT_PATH,
        goal: "스냅샷 테스트",
      });

      const snapshot = await store.createSnapshot("manual");
      expect(snapshot).not.toBeNull();
      expect(snapshot?.reason).toBe("manual");
    });

    it("스냅샷 목록을 조회해야 함", async () => {
      await store.createContext({
        projectPath: TEST_PROJECT_PATH,
        goal: "목록 테스트",
      });

      await store.createSnapshot("manual");
      await store.createSnapshot("milestone");

      const snapshots = await store.listSnapshots();
      expect(snapshots).toHaveLength(2);
    });

    it("스냅샷에서 복원해야 함", async () => {
      await store.createContext({
        projectPath: TEST_PROJECT_PATH,
        goal: "원래 목표",
      });

      const snapshot = await store.createSnapshot("manual");
      await store.updateContext({ goal: "변경된 목표" });

      const restored = await store.restoreFromSnapshot(snapshot!.id);
      expect(restored?.currentWork.goal).toBe("원래 목표");
    });
  });

  describe("getSummary", () => {
    it("컨텍스트 요약을 반환해야 함", async () => {
      await store.createContext({
        projectPath: TEST_PROJECT_PATH,
        goal: "요약 테스트",
      });

      await store.addDecision("결정1", "이유1");
      await store.addBlocker("블로커1");

      const summary = await store.getSummary();
      expect(summary).toContain("요약 테스트");
      expect(summary).toContain("결정1");
      expect(summary).toContain("블로커1");
    });

    it("컨텍스트가 없으면 메시지 반환", async () => {
      const newStore = new ContextStore(path.join(TEST_PROJECT_PATH, "empty3"));
      await newStore.initialize();
      const summary = await newStore.getSummary();
      expect(summary).toContain("활성 컨텍스트가 없습니다");
    });
  });

  describe("updateCodeChanges", () => {
    it("코드 변경사항을 업데이트해야 함", async () => {
      await store.createContext({
        projectPath: TEST_PROJECT_PATH,
        goal: "코드 변경 테스트",
      });

      await store.updateCodeChanges(
        ["src/index.ts", "src/utils.ts"],
        "리팩토링 완료",
        true
      );

      const context = await store.getContext();
      expect(context?.codeChanges.modifiedFiles).toHaveLength(2);
      expect(context?.codeChanges.summary).toBe("리팩토링 완료");
      expect(context?.codeChanges.uncommittedChanges).toBe(true);
    });
  });
});
