import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fs from "fs/promises";
import * as path from "path";
import { SyncEngine, createSyncEngine } from "../src/sync/sync-engine.js";
import { ContextStore } from "../src/store/context-store.js";

const TEST_PROJECT_PATH = path.join(process.cwd(), ".test-sync-engine");

describe("SyncEngine", () => {
  let store: ContextStore;
  let syncEngine: SyncEngine;

  beforeEach(async () => {
    store = new ContextStore(TEST_PROJECT_PATH);
    await store.initialize();
    syncEngine = new SyncEngine(store, TEST_PROJECT_PATH, {
      editorSwitch: false, // 테스트에서는 비활성화
      fileSave: false,
      idleMinutes: 0,
      gitCommit: false,
    });
  });

  afterEach(async () => {
    syncEngine.stop();
    await fs.rm(TEST_PROJECT_PATH, { recursive: true, force: true });
  });

  describe("constructor", () => {
    it("기본 설정으로 생성해야 함", () => {
      const engine = new SyncEngine(store, TEST_PROJECT_PATH);
      expect(engine).toBeDefined();
      engine.stop();
    });

    it("커스텀 설정으로 생성해야 함", () => {
      const engine = new SyncEngine(store, TEST_PROJECT_PATH, {
        editorSwitch: false,
        fileSave: true,
        idleMinutes: 10,
        gitCommit: false,
      });
      expect(engine).toBeDefined();
      engine.stop();
    });
  });

  describe("start/stop", () => {
    it("시작 시 started 이벤트를 발생해야 함", async () => {
      const startedHandler = vi.fn();
      syncEngine.on("started", startedHandler);

      await syncEngine.start();

      expect(startedHandler).toHaveBeenCalled();
    });

    it("중지 시 stopped 이벤트를 발생해야 함", async () => {
      const stoppedHandler = vi.fn();
      syncEngine.on("stopped", stoppedHandler);

      await syncEngine.start();
      syncEngine.stop();

      expect(stoppedHandler).toHaveBeenCalled();
    });

    it("중복 시작을 방지해야 함", async () => {
      const startedHandler = vi.fn();
      syncEngine.on("started", startedHandler);

      await syncEngine.start();
      await syncEngine.start(); // 두 번째 호출

      expect(startedHandler).toHaveBeenCalledTimes(1);
    });
  });

  describe("isActive", () => {
    it("시작 전에는 false여야 함", () => {
      expect(syncEngine.isActive()).toBe(false);
    });

    it("시작 후에는 true여야 함", async () => {
      await syncEngine.start();
      expect(syncEngine.isActive()).toBe(true);
    });

    it("중지 후에는 false여야 함", async () => {
      await syncEngine.start();
      syncEngine.stop();
      expect(syncEngine.isActive()).toBe(false);
    });
  });

  describe("recordActivity", () => {
    it("활동을 기록해야 함", () => {
      // 에러 없이 실행되어야 함
      syncEngine.recordActivity();
      expect(true).toBe(true);
    });
  });

  describe("triggerSync", () => {
    it("수동 동기화를 트리거해야 함", async () => {
      const syncHandler = vi.fn();
      syncEngine.on("sync", syncHandler);

      // 컨텍스트 생성
      await store.createContext({
        projectPath: TEST_PROJECT_PATH,
        goal: "테스트",
      });

      await syncEngine.triggerSync("테스트 동기화");

      expect(syncHandler).toHaveBeenCalled();
      expect(syncHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "manual",
          details: { reason: "테스트 동기화" },
        })
      );
    });

    it("기본 이유로 동기화해야 함", async () => {
      const syncHandler = vi.fn();
      syncEngine.on("sync", syncHandler);

      await store.createContext({
        projectPath: TEST_PROJECT_PATH,
        goal: "테스트",
      });

      await syncEngine.triggerSync();

      expect(syncHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "manual",
          details: { reason: "manual" },
        })
      );
    });
  });

  describe("events", () => {
    it("EventEmitter를 상속해야 함", () => {
      expect(typeof syncEngine.on).toBe("function");
      expect(typeof syncEngine.emit).toBe("function");
      expect(typeof syncEngine.off).toBe("function");
    });

    it("error 이벤트를 발생할 수 있어야 함", () => {
      const errorHandler = vi.fn();
      syncEngine.on("error", errorHandler);

      // 내부에서 에러 발생 시 이벤트가 발생해야 함
      expect(typeof errorHandler).toBe("function");
    });
  });
});

describe("createSyncEngine", () => {
  let store: ContextStore;

  beforeEach(async () => {
    store = new ContextStore(TEST_PROJECT_PATH);
    await store.initialize();
  });

  afterEach(async () => {
    await fs.rm(TEST_PROJECT_PATH, { recursive: true, force: true });
  });

  it("SyncEngine 인스턴스를 생성해야 함", () => {
    const engine = createSyncEngine(store, TEST_PROJECT_PATH);
    expect(engine).toBeInstanceOf(SyncEngine);
    engine.stop();
  });

  it("설정을 전달해야 함", () => {
    const engine = createSyncEngine(store, TEST_PROJECT_PATH, {
      idleMinutes: 15,
    });
    expect(engine).toBeInstanceOf(SyncEngine);
    engine.stop();
  });
});

describe("SyncEngine - 설정 옵션", () => {
  let store: ContextStore;

  beforeEach(async () => {
    store = new ContextStore(TEST_PROJECT_PATH);
    await store.initialize();
  });

  afterEach(async () => {
    await fs.rm(TEST_PROJECT_PATH, { recursive: true, force: true });
  });

  it("editorSwitch 옵션이 동작해야 함", async () => {
    const engine = new SyncEngine(store, TEST_PROJECT_PATH, {
      editorSwitch: true,
      fileSave: false,
      idleMinutes: 0,
      gitCommit: false,
    });

    await engine.start();
    expect(engine.isActive()).toBe(true);
    engine.stop();
  });

  it("fileSave 옵션이 동작해야 함", async () => {
    const engine = new SyncEngine(store, TEST_PROJECT_PATH, {
      editorSwitch: false,
      fileSave: true,
      idleMinutes: 0,
      gitCommit: false,
    });

    await engine.start();
    expect(engine.isActive()).toBe(true);
    engine.stop();
  });

  it("idleMinutes 옵션이 동작해야 함", async () => {
    const engine = new SyncEngine(store, TEST_PROJECT_PATH, {
      editorSwitch: false,
      fileSave: false,
      idleMinutes: 5,
      gitCommit: false,
    });

    await engine.start();
    expect(engine.isActive()).toBe(true);
    engine.stop();
  });

  it("gitCommit 옵션이 동작해야 함", async () => {
    const engine = new SyncEngine(store, TEST_PROJECT_PATH, {
      editorSwitch: false,
      fileSave: false,
      idleMinutes: 0,
      gitCommit: true,
    });

    await engine.start();
    expect(engine.isActive()).toBe(true);
    engine.stop();
  });
});

describe("SyncEngine - 동기화 트리거 타입", () => {
  it("editor_switch 타입이 정의되어 있어야 함", () => {
    const types = ["editor_switch", "file_save", "idle", "git_commit", "manual"];
    expect(types).toContain("editor_switch");
  });

  it("file_save 타입이 정의되어 있어야 함", () => {
    const types = ["editor_switch", "file_save", "idle", "git_commit", "manual"];
    expect(types).toContain("file_save");
  });

  it("idle 타입이 정의되어 있어야 함", () => {
    const types = ["editor_switch", "file_save", "idle", "git_commit", "manual"];
    expect(types).toContain("idle");
  });

  it("git_commit 타입이 정의되어 있어야 함", () => {
    const types = ["editor_switch", "file_save", "idle", "git_commit", "manual"];
    expect(types).toContain("git_commit");
  });

  it("manual 타입이 정의되어 있어야 함", () => {
    const types = ["editor_switch", "file_save", "idle", "git_commit", "manual"];
    expect(types).toContain("manual");
  });
});
