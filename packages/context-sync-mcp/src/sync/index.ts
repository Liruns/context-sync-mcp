export { SyncEngine, createSyncEngine } from "./sync-engine.js";
export type { SyncTriggerType, SyncEvent, SyncEngineConfig } from "./sync-engine.js";

// v2.5: 동기화 큐
export { SyncQueue, createSyncQueue } from "./sync-queue.js";
export type { QueueStatus } from "./sync-queue.js";

// v2.5: Vector Clock
export {
  createClock,
  cloneClock,
  increment,
  merge as mergeClock,
  compare as compareClock,
  isBefore,
  isAfter,
  isConcurrent,
  isEqual,
  toString as clockToString,
  fromString as clockFromString,
  isValid as isValidClock,
} from "./vector-clock.js";
export type { VectorClock, ClockCompareResult } from "./vector-clock.js";

// v2.5: 파일 락
export { FileLock, createFileLock, withLock } from "./file-lock.js";
export type { LockInfo, LockResult } from "./file-lock.js";
