/**
 * Sync Engine - 자동 동기화 엔진
 * 다양한 트리거에 반응하여 컨텍스트를 자동으로 저장/동기화합니다.
 */

import { EventEmitter } from "events";
import * as chokidar from "chokidar";
import { exec } from "child_process";
import { promisify } from "util";
import { ContextStore } from "../store/index.js";
import { EditorWatcher } from "../watcher/index.js";
import type { EditorSwitchEvent } from "../watcher/index.js";
import { SyncQueue } from "./sync-queue.js";

const execAsync = promisify(exec);

/** 상수 정의 */
const CONSTANTS = {
  /** 에디터 감시 간격 (ms) */
  EDITOR_WATCH_INTERVAL_MS: 2000,
  /** Git 커밋 감지 간격 (ms) */
  GIT_CHECK_INTERVAL_MS: 5000,
  /** Git 명령 타임아웃 (ms) */
  GIT_COMMAND_TIMEOUT_MS: 5000,
  /** 유휴 상태 체크 간격 (ms) */
  IDLE_CHECK_INTERVAL_MS: 60000,
  /** 파일 변경 디바운스 시간 (ms) */
  FILE_DEBOUNCE_MS: 1000,
  /** 파일 쓰기 안정화 대기 시간 (ms) */
  FILE_STABILITY_THRESHOLD_MS: 500,
  /** 파일 쓰기 폴링 간격 (ms) */
  FILE_POLL_INTERVAL_MS: 100,
} as const;

/** 동기화 트리거 타입 */
export type SyncTriggerType =
  | "editor_switch"
  | "file_save"
  | "idle"
  | "git_commit"
  | "manual";

/** 동기화 이벤트 */
export interface SyncEvent {
  type: SyncTriggerType;
  timestamp: Date;
  details?: Record<string, unknown>;
}

/** 동기화 엔진 설정 */
export interface SyncEngineConfig {
  /** 에디터 전환 시 동기화 */
  editorSwitch: boolean;
  /** 파일 저장 시 동기화 */
  fileSave: boolean;
  /** 유휴 시간 후 동기화 (분) */
  idleMinutes: number;
  /** Git 커밋 감지 시 동기화 */
  gitCommit: boolean;
  /** 감시할 파일 패턴 */
  watchPatterns: string[];
  /** 무시할 패턴 */
  ignorePatterns: string[];
}

const DEFAULT_CONFIG: SyncEngineConfig = {
  editorSwitch: true,
  fileSave: true,
  idleMinutes: 5,
  gitCommit: true,
  watchPatterns: ["**/*.{ts,js,tsx,jsx,py,go,rs,java,cpp,c,h}"],
  ignorePatterns: [
    "**/node_modules/**",
    "**/.git/**",
    "**/dist/**",
    "**/build/**",
    "**/.next/**",
  ],
};

/**
 * 동기화 엔진 클래스
 */
export class SyncEngine extends EventEmitter {
  private store: ContextStore;
  private editorWatcher: EditorWatcher | null = null;
  private fileWatcher: chokidar.FSWatcher | null = null;
  private idleTimer: NodeJS.Timeout | null = null;
  private gitCheckInterval: NodeJS.Timeout | null = null;
  private lastGitCommit: string = "";
  private config: SyncEngineConfig;
  private projectPath: string;
  private isRunning: boolean = false;
  private lastActivity: Date = new Date();
  private isGitChecking: boolean = false;
  // 파일 감시 관련 (메모리 누수 방지를 위해 클래스 필드로 관리)
  private fileDebounceTimer: NodeJS.Timeout | null = null;
  private changedFiles: Set<string> = new Set();
  // v2.5: 동기화 큐 (동시성 제어)
  private syncQueue: SyncQueue;

  constructor(
    store: ContextStore,
    projectPath: string,
    config?: Partial<SyncEngineConfig>
  ) {
    super();
    this.store = store;
    this.projectPath = projectPath;
    this.config = { ...DEFAULT_CONFIG, ...config };

    // v2.5: 동기화 큐 초기화
    this.syncQueue = new SyncQueue();
    this.syncQueue.setProcessor((event) => this.processSync(event));
    this.syncQueue.on("error", (err) => this.emit("error", err));
  }

  /**
   * 동기화 엔진 시작
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;

    // 에디터 전환 감지
    if (this.config.editorSwitch) {
      this.startEditorWatcher();
    }

    // 파일 변경 감지
    if (this.config.fileSave) {
      this.startFileWatcher();
    }

    // 유휴 상태 감지
    if (this.config.idleMinutes > 0) {
      this.startIdleWatcher();
    }

    // Git 커밋 감지
    if (this.config.gitCommit) {
      await this.startGitWatcher();
    }

    this.emit("started");
  }

  /**
   * 동기화 엔진 중지
   */
  stop(): void {
    if (this.editorWatcher) {
      this.editorWatcher.stop();
      this.editorWatcher = null;
    }

    if (this.fileWatcher) {
      this.fileWatcher.close();
      this.fileWatcher = null;
    }

    if (this.idleTimer) {
      clearInterval(this.idleTimer);
      this.idleTimer = null;
    }

    if (this.gitCheckInterval) {
      clearInterval(this.gitCheckInterval);
      this.gitCheckInterval = null;
    }

    // 파일 디바운스 타이머 정리 (메모리 누수 방지)
    if (this.fileDebounceTimer) {
      clearTimeout(this.fileDebounceTimer);
      this.fileDebounceTimer = null;
    }
    this.changedFiles.clear();

    this.isRunning = false;
    this.isGitChecking = false;
    this.emit("stopped");
  }

  /**
   * 수동 동기화 트리거
   */
  async triggerSync(reason: string = "manual"): Promise<void> {
    await this.onSync({
      type: "manual",
      timestamp: new Date(),
      details: { reason },
    });
  }

  /**
   * 활동 기록 (유휴 타이머 리셋)
   */
  recordActivity(): void {
    this.lastActivity = new Date();
  }

  /**
   * 실행 상태 확인
   */
  isActive(): boolean {
    return this.isRunning;
  }

  /**
   * 에디터 감시 시작
   */
  private startEditorWatcher(): void {
    this.editorWatcher = new EditorWatcher(CONSTANTS.EDITOR_WATCH_INTERVAL_MS);

    this.editorWatcher.on("switch", async (event: EditorSwitchEvent) => {
      if (event.from !== "unknown") {
        await this.onSync({
          type: "editor_switch",
          timestamp: event.timestamp,
          details: {
            from: event.from,
            to: event.to,
          },
        });
      }
    });

    this.editorWatcher.on("error", (err) => {
      this.emit("error", { source: "editor_watcher", error: err });
    });

    this.editorWatcher.start();
  }

  /**
   * 파일 감시 시작
   */
  private startFileWatcher(): void {
    this.fileWatcher = chokidar.watch(this.config.watchPatterns, {
      cwd: this.projectPath,
      ignored: this.config.ignorePatterns,
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: CONSTANTS.FILE_STABILITY_THRESHOLD_MS,
        pollInterval: CONSTANTS.FILE_POLL_INTERVAL_MS,
      },
    });

    // 클래스 필드 초기화
    this.changedFiles.clear();

    const handleChange = (filePath: string) => {
      this.changedFiles.add(filePath);
      this.recordActivity();

      if (this.fileDebounceTimer) {
        clearTimeout(this.fileDebounceTimer);
      }

      this.fileDebounceTimer = setTimeout(async () => {
        const files = Array.from(this.changedFiles);
        this.changedFiles.clear();
        this.fileDebounceTimer = null;

        await this.onSync({
          type: "file_save",
          timestamp: new Date(),
          details: {
            files,
            count: files.length,
          },
        });
      }, CONSTANTS.FILE_DEBOUNCE_MS);
    };

    this.fileWatcher.on("change", handleChange);
    this.fileWatcher.on("add", handleChange);

    this.fileWatcher.on("error", (err) => {
      this.emit("error", { source: "file_watcher", error: err });
    });
  }

  /**
   * 유휴 상태 감시 시작
   */
  private startIdleWatcher(): void {
    const idleMs = this.config.idleMinutes * 60 * 1000;

    this.idleTimer = setInterval(async () => {
      const now = new Date();
      const idleTime = now.getTime() - this.lastActivity.getTime();

      if (idleTime >= idleMs) {
        await this.onSync({
          type: "idle",
          timestamp: now,
          details: {
            idleMinutes: Math.floor(idleTime / 60000),
          },
        });

        // 유휴 동기화 후 타이머 리셋
        this.lastActivity = now;
      }
    }, CONSTANTS.IDLE_CHECK_INTERVAL_MS);
  }

  /**
   * Git 커밋 감시 시작
   */
  private async startGitWatcher(): Promise<void> {
    // 현재 최신 커밋 해시 가져오기
    try {
      const { stdout } = await execAsync("git rev-parse HEAD", {
        cwd: this.projectPath,
        timeout: CONSTANTS.GIT_COMMAND_TIMEOUT_MS,
      });
      this.lastGitCommit = stdout.trim();
    } catch {
      // Git 레포가 아닌 경우
      return;
    }

    // Git 커밋 체크 (race condition 방지)
    this.gitCheckInterval = setInterval(() => {
      this.checkGitCommit().catch((err) => {
        this.emit("error", { source: "git_watcher", error: err });
      });
    }, CONSTANTS.GIT_CHECK_INTERVAL_MS);
  }

  /**
   * Git 커밋 체크 (race condition 방지)
   */
  private async checkGitCommit(): Promise<void> {
    // 이미 체크 중이면 스킵
    if (this.isGitChecking) {
      return;
    }

    this.isGitChecking = true;
    try {
      const { stdout } = await execAsync("git rev-parse HEAD", {
        cwd: this.projectPath,
        timeout: CONSTANTS.GIT_COMMAND_TIMEOUT_MS,
      });
      const currentCommit = stdout.trim();

      if (currentCommit !== this.lastGitCommit) {
        const { stdout: commitMsg } = await execAsync(
          "git log -1 --pretty=%B",
          { cwd: this.projectPath, timeout: CONSTANTS.GIT_COMMAND_TIMEOUT_MS }
        );

        await this.onSync({
          type: "git_commit",
          timestamp: new Date(),
          details: {
            commitHash: currentCommit,
            message: commitMsg.trim(),
            previousHash: this.lastGitCommit,
          },
        });

        this.lastGitCommit = currentCommit;
      }
    } catch (err) {
      // Git 명령 실패 시 에러 이벤트 발생
      this.emit("error", { source: "git_check", error: err });
    } finally {
      this.isGitChecking = false;
    }
  }

  /**
   * 동기화 처리 (v2.5: 큐를 통해 순차 처리)
   */
  private async onSync(event: SyncEvent): Promise<void> {
    await this.syncQueue.enqueue(event);
  }

  /**
   * 실제 동기화 로직 (v2.5: 큐에서 호출)
   */
  private async processSync(event: SyncEvent): Promise<void> {
    try {
      // 스냅샷 생성
      const reason = event.type === "manual" ? "manual" : "auto";
      await this.store.createSnapshot(reason);

      // 코드 변경 업데이트 (파일 저장인 경우)
      if (event.type === "file_save" && event.details?.files) {
        const files = event.details.files as string[];
        await this.store.updateCodeChanges(
          files,
          `${files.length}개 파일 수정됨`,
          true
        );
      }

      this.emit("sync", event);
    } catch (err) {
      this.emit("error", { source: "sync", error: err, event });
      throw err; // 큐에서 에러 처리할 수 있도록
    }
  }

  /**
   * 큐 상태 조회 (v2.5)
   */
  getQueueStatus() {
    return this.syncQueue.getStatus();
  }
}

/**
 * 동기화 엔진 생성 헬퍼
 */
export function createSyncEngine(
  store: ContextStore,
  projectPath: string,
  config?: Partial<SyncEngineConfig>
): SyncEngine {
  return new SyncEngine(store, projectPath, config);
}
