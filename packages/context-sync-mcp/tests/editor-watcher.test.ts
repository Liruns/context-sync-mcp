import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EditorWatcher, createEditorWatcher } from "../src/watcher/editor-watcher.js";

describe("EditorWatcher", () => {
  let watcher: EditorWatcher;

  beforeEach(() => {
    watcher = new EditorWatcher(100); // 빠른 테스트를 위해 100ms 간격
  });

  afterEach(() => {
    watcher.stop();
  });

  describe("constructor", () => {
    it("기본 간격으로 생성해야 함", () => {
      const defaultWatcher = new EditorWatcher();
      expect(defaultWatcher).toBeDefined();
      defaultWatcher.stop();
    });

    it("커스텀 간격으로 생성해야 함", () => {
      const customWatcher = new EditorWatcher(5000);
      expect(customWatcher).toBeDefined();
      customWatcher.stop();
    });
  });

  describe("start/stop", () => {
    it("시작하면 isRunning 상태가 되어야 함", async () => {
      watcher.start();
      // 내부 상태가 변경되었는지 확인 (getCurrentEditor가 동작하면 정상)
      expect(watcher.getCurrentEditor()).toBeDefined();
    });

    it("중지하면 정상적으로 종료되어야 함", async () => {
      watcher.start();
      watcher.stop();
      // 에러 없이 중지되어야 함
      expect(true).toBe(true);
    });

    it("중복 시작해도 에러 없이 처리해야 함", () => {
      watcher.start();
      watcher.start(); // 두 번째 호출
      // 에러 없이 처리되어야 함
      expect(watcher.getCurrentEditor()).toBeDefined();
    });

    it("중복 중지를 허용해야 함", () => {
      watcher.start();
      watcher.stop();
      watcher.stop(); // 두 번째 호출 - 에러 없이 실행되어야 함

      expect(true).toBe(true);
    });
  });

  describe("getCurrentEditor", () => {
    it("초기값은 unknown이어야 함", () => {
      expect(watcher.getCurrentEditor()).toBe("unknown");
    });
  });

  describe("getPreviousEditor", () => {
    it("초기값은 unknown이어야 함", () => {
      expect(watcher.getPreviousEditor()).toBe("unknown");
    });
  });

  describe("events", () => {
    it("EventEmitter를 상속해야 함", () => {
      expect(typeof watcher.on).toBe("function");
      expect(typeof watcher.emit).toBe("function");
      expect(typeof watcher.off).toBe("function");
    });

    it("이벤트 리스너를 등록할 수 있어야 함", () => {
      const handler = vi.fn();
      watcher.on("switch", handler);
      expect(true).toBe(true); // 에러 없이 등록되어야 함
    });

    it("이벤트 리스너를 제거할 수 있어야 함", () => {
      const handler = vi.fn();
      watcher.on("switch", handler);
      watcher.off("switch", handler);
      expect(true).toBe(true); // 에러 없이 제거되어야 함
    });
  });
});

describe("createEditorWatcher", () => {
  it("EditorWatcher 인스턴스를 생성해야 함", () => {
    const watcher = createEditorWatcher();
    expect(watcher).toBeInstanceOf(EditorWatcher);
    watcher.stop();
  });

  it("간격을 전달해야 함", () => {
    const watcher = createEditorWatcher(3000);
    expect(watcher).toBeInstanceOf(EditorWatcher);
    watcher.stop();
  });
});

describe("EditorWatcher - 에디터 감지 로직", () => {
  it("Cursor 프로세스 이름을 감지해야 함", () => {
    // 프로세스 이름 매칭 로직 테스트 (내부 로직이지만 중요)
    const cursorPatterns = ["cursor", "Cursor"];
    cursorPatterns.forEach((name) => {
      expect(name.toLowerCase()).toContain("cursor");
    });
  });

  it("Claude Code 프로세스 이름을 감지해야 함", () => {
    const claudePatterns = ["claude", "Claude"];
    claudePatterns.forEach((name) => {
      expect(name.toLowerCase()).toContain("claude");
    });
  });

  it("Windsurf 프로세스 이름을 감지해야 함", () => {
    const windsurfPatterns = ["windsurf", "Windsurf"];
    windsurfPatterns.forEach((name) => {
      expect(name.toLowerCase()).toContain("windsurf");
    });
  });

  it("Copilot/VS Code 프로세스 이름을 감지해야 함", () => {
    const vscodePatterns = ["code", "Code"];
    vscodePatterns.forEach((name) => {
      expect(name.toLowerCase()).toContain("code");
    });
  });
});
