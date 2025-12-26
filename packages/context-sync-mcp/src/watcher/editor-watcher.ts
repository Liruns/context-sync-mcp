/**
 * Editor Watcher - 에디터 전환 감지
 * 현재 활성화된 AI 에디터를 추적하고 전환 이벤트를 발생시킵니다.
 */

import { EventEmitter } from "events";
import { exec } from "child_process";
import { promisify } from "util";
import type { AgentType } from "../types/index.js";

const execAsync = promisify(exec);

/** 상수 정의 */
const CONSTANTS = {
  /** 기본 감시 간격 (ms) */
  DEFAULT_INTERVAL_MS: 2000,
  /** 명령 실행 타임아웃 (ms) */
  COMMAND_TIMEOUT_MS: 5000,
  /** 최대 연속 에러 허용 횟수 */
  MAX_CONSECUTIVE_ERRORS: 5,
} as const;

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

/** 에러 정보 */
export interface EditorWatcherError {
  source: "windows" | "macos" | "linux" | "detection";
  message: string;
  originalError?: unknown;
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
  private lastError: EditorWatcherError | null = null;
  private consecutiveErrors: number = 0;

  constructor(intervalMs: number = CONSTANTS.DEFAULT_INTERVAL_MS) {
    super();
    this.intervalMs = intervalMs;
  }

  /**
   * 마지막 에러 반환
   */
  getLastError(): EditorWatcherError | null {
    return this.lastError;
  }

  /**
   * 연속 에러 횟수 반환
   */
  getConsecutiveErrorCount(): number {
    return this.consecutiveErrors;
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
      let result: AgentType;
      if (platform === "win32") {
        result = await this.detectWindowsActiveEditor();
      } else if (platform === "darwin") {
        result = await this.detectMacOSActiveEditor();
      } else {
        result = await this.detectLinuxActiveEditor();
      }

      // 성공 시 연속 에러 카운트 리셋
      this.consecutiveErrors = 0;
      return result;
    } catch (err) {
      this.consecutiveErrors++;
      this.lastError = {
        source: "detection",
        message: `에디터 감지 실패 (${platform})`,
        originalError: err,
        timestamp: new Date(),
      };

      // 연속 에러가 임계값을 초과하면 경고 이벤트 발생
      if (this.consecutiveErrors >= CONSTANTS.MAX_CONSECUTIVE_ERRORS) {
        this.emit("warning", {
          type: "consecutive_errors",
          count: this.consecutiveErrors,
          lastError: this.lastError,
        });
      }

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
        { timeout: CONSTANTS.COMMAND_TIMEOUT_MS }
      );

      const processName = stdout.trim().toLowerCase();

      // 프로세스 이름으로 에디터 매칭
      for (const [proc, editor] of Object.entries(EDITOR_PROCESSES)) {
        if (processName.includes(proc.replace(".exe", "").toLowerCase())) {
          return editor;
        }
      }

      return "unknown";
    } catch (err) {
      this.lastError = {
        source: "windows",
        message: "Windows 에디터 감지 실패",
        originalError: err,
        timestamp: new Date(),
      };
      throw err; // 상위로 전파하여 detectActiveEditor에서 처리
    }
  }

  /**
   * macOS 활성 에디터 감지
   */
  private async detectMacOSActiveEditor(): Promise<AgentType> {
    try {
      const { stdout } = await execAsync(
        `osascript -e 'tell application "System Events" to get name of first application process whose frontmost is true'`,
        { timeout: CONSTANTS.COMMAND_TIMEOUT_MS }
      );

      const appName = stdout.trim().toLowerCase();

      if (appName.includes("cursor")) return "cursor";
      if (appName.includes("code") || appName.includes("visual studio")) return "claude-code";
      if (appName.includes("windsurf")) return "windsurf";

      return "unknown";
    } catch (err) {
      this.lastError = {
        source: "macos",
        message: "macOS 에디터 감지 실패",
        originalError: err,
        timestamp: new Date(),
      };
      throw err;
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
        { timeout: CONSTANTS.COMMAND_TIMEOUT_MS }
      );

      const processName = stdout.trim().toLowerCase();

      for (const [proc, editor] of Object.entries(EDITOR_PROCESSES)) {
        if (processName.includes(proc)) {
          return editor;
        }
      }

      return "unknown";
    } catch (err) {
      this.lastError = {
        source: "linux",
        message: "Linux 에디터 감지 실패 (xdotool 필요)",
        originalError: err,
        timestamp: new Date(),
      };
      throw err;
    }
  }
}

/**
 * 싱글톤 인스턴스 생성 헬퍼
 */
export function createEditorWatcher(intervalMs?: number): EditorWatcher {
  return new EditorWatcher(intervalMs);
}
