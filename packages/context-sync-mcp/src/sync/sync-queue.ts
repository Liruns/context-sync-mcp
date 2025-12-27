/**
 * Sync Queue - 동기화 이벤트 큐
 * v2.5: 동시성 제어 및 순차 처리
 */

import { EventEmitter } from "events";
import type { SyncEvent } from "./sync-engine.js";

/**
 * 큐 아이템
 */
interface QueueItem {
  event: SyncEvent;
  resolve: () => void;
  reject: (error: Error) => void;
}

/**
 * 큐 상태
 */
export interface QueueStatus {
  size: number;
  processing: boolean;
  currentEvent: SyncEvent | null;
}

/**
 * 동기화 큐 클래스
 * 동시 이벤트를 순차적으로 처리
 */
export class SyncQueue extends EventEmitter {
  private queue: QueueItem[] = [];
  private processing: boolean = false;
  private currentEvent: SyncEvent | null = null;
  private processCallback: ((event: SyncEvent) => Promise<void>) | null = null;

  /**
   * 이벤트 처리 콜백 설정
   */
  setProcessor(callback: (event: SyncEvent) => Promise<void>): void {
    this.processCallback = callback;
  }

  /**
   * 이벤트를 큐에 추가하고 처리
   */
  async enqueue(event: SyncEvent): Promise<void> {
    return new Promise((resolve, reject) => {
      this.queue.push({ event, resolve, reject });
      this.emit("enqueued", event);

      // 처리 중이 아니면 큐 처리 시작
      if (!this.processing) {
        this.processQueue().catch((err) => {
          this.emit("error", err);
        });
      }
    });
  }

  /**
   * 큐 처리
   */
  private async processQueue(): Promise<void> {
    if (this.processing) return;

    this.processing = true;
    this.emit("processing_started");

    while (this.queue.length > 0) {
      const item = this.queue.shift();
      if (!item) continue;

      this.currentEvent = item.event;
      this.emit("processing", item.event);

      try {
        if (this.processCallback) {
          await this.processCallback(item.event);
        }
        item.resolve();
        this.emit("processed", item.event);
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        item.reject(err);
        this.emit("error", { event: item.event, error: err });
      }
    }

    this.currentEvent = null;
    this.processing = false;
    this.emit("processing_completed");
  }

  /**
   * 큐 상태 조회
   */
  getStatus(): QueueStatus {
    return {
      size: this.queue.length,
      processing: this.processing,
      currentEvent: this.currentEvent,
    };
  }

  /**
   * 큐 비우기
   */
  clear(): void {
    for (const item of this.queue) {
      item.reject(new Error("Queue cleared"));
    }
    this.queue = [];
    this.emit("cleared");
  }

  /**
   * 큐 크기
   */
  get size(): number {
    return this.queue.length;
  }

  /**
   * 처리 중 여부
   */
  get isProcessing(): boolean {
    return this.processing;
  }
}

/**
 * 동기화 큐 생성 헬퍼
 */
export function createSyncQueue(): SyncQueue {
  return new SyncQueue();
}
