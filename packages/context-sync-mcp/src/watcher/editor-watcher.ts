/**
 * Editor Watcher - 에디터 전환 감지
 * 현재 활성화된 AI 에디터를 추적하고 전환 이벤트를 발생시킵니다.
 */

import { EventEmitter } from "events";
import { exec } from "child_process";
import { promisify } from "util";
import type { AgentType } from "../types/index.js";

const execAsync = promisify(exec);

/** 에디터 프로세스 매핑 */
const EDITOR_PROCESSES: Record<string, AgentType> = {
  // Windows
  "cursor.exe": "cursor",
  "code.exe": "claude-code", // VS Code with Claude extension
  "windsurf.exe": "windsurf",
  "copilot.exe": "copilot",
  // macOS / Linux
  cursor: "cursor",
  code: "claude-code",
  windsurf: "windsurf",
};

/** 에디터 전환 이벤트 */
export interface EditorSwitchEvent {
  from: AgentType;
  to: AgentType;
  timestamp: Date;
}

/**
 * 에디터 감시 클래스
 */
export class EditorWatcher extends EventEmitter {
  private currentEditor: AgentType = "unknown";
  private previousEditor: AgentType = "unknown";
  private checkInterval: NodeJS.Timeout | null = null;
  private intervalMs: number;
  private isRunning: boolean = false;

  constructor(intervalMs: number = 2000) {
    super();
    this.intervalMs = intervalMs;
  }

  /**
   * 감시 시작
   */
  start(): void {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;
    this.checkInterval = setInterval(() => {
      this.checkActiveEditor().catch((err) => {
        this.emit("error", err);
      });
    }, this.intervalMs);

    // 즉시 한 번 체크
    this.checkActiveEditor().catch((err) => {
      this.emit("error", err);
    });
  }

  /**
   * 감시 중지
   */
  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    this.isRunning = false;
  }

  /**
   * 현재 활성 에디터 반환
   */
  getCurrentEditor(): AgentType {
    return this.currentEditor;
  }

  /**
   * 이전 에디터 반환
   */
  getPreviousEditor(): AgentType {
    return this.previousEditor;
  }

  /**
   * 실행 중인지 확인
   */
  isWatching(): boolean {
    return this.isRunning;
  }

  /**
   * 활성 에디터 체크
   */
  private async checkActiveEditor(): Promise<void> {
    const activeEditor = await this.detectActiveEditor();

    if (activeEditor !== this.currentEditor) {
      this.previousEditor = this.currentEditor;
      this.currentEditor = activeEditor;

      const event: EditorSwitchEvent = {
        from: this.previousEditor,
        to: this.currentEditor,
        timestamp: new Date(),
      };

      this.emit("switch", event);
    }
  }

  /**
   * 활성 에디터 감지
   */
  private async detectActiveEditor(): Promise<AgentType> {
    const platform = process.platform;

    try {
      if (platform === "win32") {
        return await this.detectWindowsActiveEditor();
      } else if (platform === "darwin") {
        return await this.detectMacOSActiveEditor();
      } else {
        return await this.detectLinuxActiveEditor();
      }
    } catch {
      return "unknown";
    }
  }

  /**
   * Windows 활성 에디터 감지
   */
  private async detectWindowsActiveEditor(): Promise<AgentType> {
    try {
      // PowerShell로 활성 윈도우 프로세스 이름 가져오기
      const { stdout } = await execAsync(
        `powershell -Command "(Get-Process | Where-Object { $_.MainWindowHandle -ne 0 } | Select-Object -First 1 ProcessName).ProcessName"`,
        { timeout: 5000 }
      );

      const processName = stdout.trim().toLowerCase();

      // 프로세스 이름으로 에디터 매칭
      for (const [proc, editor] of Object.entries(EDITOR_PROCESSES)) {
        if (processName.includes(proc.replace(".exe", "").toLowerCase())) {
          return editor;
        }
      }

      return "unknown";
    } catch {
      return "unknown";
    }
  }

  /**
   * macOS 활성 에디터 감지
   */
  private async detectMacOSActiveEditor(): Promise<AgentType> {
    try {
      const { stdout } = await execAsync(
        `osascript -e 'tell application "System Events" to get name of first application process whose frontmost is true'`,
        { timeout: 5000 }
      );

      const appName = stdout.trim().toLowerCase();

      if (appName.includes("cursor")) return "cursor";
      if (appName.includes("code") || appName.includes("visual studio")) return "claude-code";
      if (appName.includes("windsurf")) return "windsurf";

      return "unknown";
    } catch {
      return "unknown";
    }
  }

  /**
   * Linux 활성 에디터 감지
   */
  private async detectLinuxActiveEditor(): Promise<AgentType> {
    try {
      // xdotool로 활성 윈도우 이름 가져오기
      const { stdout } = await execAsync(
        `xdotool getactivewindow getwindowpid 2>/dev/null | xargs -I{} ps -p {} -o comm=`,
        { timeout: 5000 }
      );

      const processName = stdout.trim().toLowerCase();

      for (const [proc, editor] of Object.entries(EDITOR_PROCESSES)) {
        if (processName.includes(proc)) {
          return editor;
        }
      }

      return "unknown";
    } catch {
      return "unknown";
    }
  }
}

/**
 * 싱글톤 인스턴스 생성 헬퍼
 */
export function createEditorWatcher(intervalMs?: number): EditorWatcher {
  return new EditorWatcher(intervalMs);
}
