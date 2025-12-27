/**
 * File Lock - 파일 기반 락 메커니즘
 * v2.5: 동시 접근 방지
 */

import * as fs from "fs/promises";
import * as path from "path";

/**
 * 락 정보
 */
export interface LockInfo {
  /** 락을 획득한 에이전트 */
  agent: string;
  /** 프로세스 ID */
  pid: number;
  /** 락 획득 시간 */
  timestamp: string;
}

/**
 * 락 획득 결과
 */
export interface LockResult {
  acquired: boolean;
  holder?: LockInfo;
  message: string;
}

/**
 * 파일 기반 락 클래스
 */
export class FileLock {
  private lockPath: string;
  private agent: string;
  private staleTimeoutMs: number;

  /**
   * @param contextPath 컨텍스트 디렉토리 경로
   * @param agent 현재 에이전트
   * @param staleTimeoutMs 스테일 락 타임아웃 (기본 30초)
   */
  constructor(
    contextPath: string,
    agent: string,
    staleTimeoutMs: number = 30000
  ) {
    this.lockPath = path.join(contextPath, ".context-sync", ".lock");
    this.agent = agent;
    this.staleTimeoutMs = staleTimeoutMs;
  }

  /**
   * 락 획득 시도 (타임아웃 있음)
   * @param timeoutMs 타임아웃 (기본 5초)
   * @param retryIntervalMs 재시도 간격 (기본 100ms)
   */
  async acquire(
    timeoutMs: number = 5000,
    retryIntervalMs: number = 100
  ): Promise<LockResult> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      const result = await this.tryAcquire();
      if (result.acquired) {
        return result;
      }

      await this.wait(retryIntervalMs);
    }

    // 타임아웃
    const holder = await this.readLock();
    return {
      acquired: false,
      holder: holder || undefined,
      message: `락 획득 타임아웃 (${timeoutMs}ms)`,
    };
  }

  /**
   * 락 획득 단일 시도
   */
  async tryAcquire(): Promise<LockResult> {
    try {
      // 락 파일이 이미 있는지 확인
      const existingLock = await this.readLock();

      if (existingLock) {
        // 스테일 락인지 확인
        if (this.isStale(existingLock)) {
          // 스테일 락 제거
          await this.release();
        } else {
          return {
            acquired: false,
            holder: existingLock,
            message: `락이 이미 사용 중입니다: ${existingLock.agent}`,
          };
        }
      }

      // 디렉토리 확인/생성
      const dir = path.dirname(this.lockPath);
      await fs.mkdir(dir, { recursive: true });

      // 락 파일 생성 (wx 플래그: 이미 있으면 실패)
      const lockInfo: LockInfo = {
        agent: this.agent,
        pid: process.pid,
        timestamp: new Date().toISOString(),
      };

      await fs.writeFile(this.lockPath, JSON.stringify(lockInfo, null, 2), {
        flag: "wx",
      });

      return {
        acquired: true,
        message: "락을 획득했습니다",
      };
    } catch (error) {
      // 파일이 이미 존재 (EEXIST)
      if ((error as NodeJS.ErrnoException).code === "EEXIST") {
        const holder = await this.readLock();
        return {
          acquired: false,
          holder: holder || undefined,
          message: "락이 이미 존재합니다",
        };
      }

      // 기타 에러
      const message = error instanceof Error ? error.message : String(error);
      return {
        acquired: false,
        message: `락 획득 실패: ${message}`,
      };
    }
  }

  /**
   * 락 해제
   */
  async release(): Promise<boolean> {
    try {
      await fs.unlink(this.lockPath);
      return true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return true; // 락이 없으면 성공으로 처리
      }
      return false;
    }
  }

  /**
   * 현재 락 정보 읽기
   */
  async readLock(): Promise<LockInfo | null> {
    try {
      const content = await fs.readFile(this.lockPath, "utf-8");
      return JSON.parse(content) as LockInfo;
    } catch {
      return null;
    }
  }

  /**
   * 스테일 락인지 확인
   */
  private isStale(lock: LockInfo): boolean {
    try {
      const lockTime = new Date(lock.timestamp).getTime();
      const age = Date.now() - lockTime;
      return age > this.staleTimeoutMs;
    } catch {
      return true; // 파싱 실패 시 스테일로 처리
    }
  }

  /**
   * 대기
   */
  private wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * 락이 현재 에이전트의 것인지 확인
   */
  async isOwnLock(): Promise<boolean> {
    const lock = await this.readLock();
    if (!lock) return false;
    return lock.agent === this.agent && lock.pid === process.pid;
  }

  /**
   * 락 상태 확인
   */
  async getStatus(): Promise<{
    locked: boolean;
    holder?: LockInfo;
    isStale: boolean;
    isOwn: boolean;
  }> {
    const lock = await this.readLock();

    if (!lock) {
      return { locked: false, isStale: false, isOwn: false };
    }

    return {
      locked: true,
      holder: lock,
      isStale: this.isStale(lock),
      isOwn: lock.agent === this.agent && lock.pid === process.pid,
    };
  }
}

/**
 * 파일 락 생성 헬퍼
 */
export function createFileLock(
  contextPath: string,
  agent: string,
  staleTimeoutMs?: number
): FileLock {
  return new FileLock(contextPath, agent, staleTimeoutMs);
}

/**
 * 락을 사용하여 작업 수행 (with lock 패턴)
 */
export async function withLock<T>(
  lock: FileLock,
  fn: () => Promise<T>,
  timeoutMs: number = 5000
): Promise<{ success: boolean; result?: T; error?: string }> {
  const lockResult = await lock.acquire(timeoutMs);

  if (!lockResult.acquired) {
    return {
      success: false,
      error: lockResult.message,
    };
  }

  try {
    const result = await fn();
    return { success: true, result };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { success: false, error: message };
  } finally {
    await lock.release();
  }
}
