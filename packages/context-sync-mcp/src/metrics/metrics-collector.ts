/**
 * Metrics Collector - 성능 메트릭스 수집
 * 동기화 성능, 컨텍스트 크기, 메모리 사용량 등을 추적합니다.
 */

import { EventEmitter } from "events";

/** 메트릭 타입 */
export type MetricType =
  | "sync_latency"
  | "context_size"
  | "snapshot_count"
  | "memory_usage"
  | "operation_duration"
  | "error_count";

/** 개별 메트릭 데이터 */
export interface MetricData {
  type: MetricType;
  value: number;
  unit: string;
  timestamp: Date;
  labels?: Record<string, string>;
}

/** 집계된 메트릭 */
export interface AggregatedMetric {
  type: MetricType;
  count: number;
  sum: number;
  min: number;
  max: number;
  avg: number;
  unit: string;
  lastUpdated: Date;
}

/** 전체 메트릭 리포트 */
export interface MetricsReport {
  /** 리포트 생성 시간 */
  generatedAt: Date;
  /** 수집 기간 (ms) */
  collectionPeriodMs: number;
  /** 동기화 관련 메트릭 */
  sync: {
    totalSyncs: number;
    avgLatencyMs: number;
    maxLatencyMs: number;
    syncsByTrigger: Record<string, number>;
  };
  /** 컨텍스트 관련 메트릭 */
  context: {
    currentSizeBytes: number;
    decisionsCount: number;
    approachesCount: number;
    blockersCount: number;
    unresolvedBlockersCount: number;
  };
  /** 스냅샷 관련 메트릭 */
  snapshots: {
    totalCount: number;
    avgSizeBytes: number;
    oldestTimestamp?: Date;
    newestTimestamp?: Date;
  };
  /** 시스템 관련 메트릭 */
  system: {
    memoryUsageBytes: number;
    uptimeMs: number;
    errorCount: number;
    warningCount: number;
  };
  /** 작업 관련 메트릭 */
  operations: {
    totalOperations: number;
    operationsByType: Record<string, number>;
    avgDurationMs: number;
  };
}

/** 메트릭스 컬렉터 설정 */
export interface MetricsCollectorConfig {
  /** 메트릭 보존 기간 (ms) */
  retentionPeriodMs: number;
  /** 집계 간격 (ms) */
  aggregationIntervalMs: number;
  /** 최대 메트릭 수 */
  maxMetrics: number;
  /** 자동 정리 활성화 */
  autoCleanup: boolean;
}

/** 기본 설정 */
const DEFAULT_CONFIG: MetricsCollectorConfig = {
  retentionPeriodMs: 24 * 60 * 60 * 1000, // 24시간
  aggregationIntervalMs: 60 * 1000, // 1분
  maxMetrics: 10000,
  autoCleanup: true,
};

/**
 * 메트릭스 컬렉터 클래스
 */
export class MetricsCollector extends EventEmitter {
  private config: MetricsCollectorConfig;
  private metrics: MetricData[] = [];
  private aggregatedMetrics: Map<MetricType, AggregatedMetric> = new Map();
  private startTime: Date = new Date();
  private cleanupInterval: NodeJS.Timeout | null = null;
  private operationTimers: Map<string, number> = new Map();

  // 카운터
  private syncCounts: Record<string, number> = {};
  private errorCount: number = 0;
  private warningCount: number = 0;
  private operationCounts: Record<string, number> = {};

  constructor(config?: Partial<MetricsCollectorConfig>) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };

    if (this.config.autoCleanup) {
      this.startAutoCleanup();
    }
  }

  /**
   * 메트릭 기록
   */
  record(
    type: MetricType,
    value: number,
    unit: string,
    labels?: Record<string, string>
  ): void {
    const metric: MetricData = {
      type,
      value,
      unit,
      timestamp: new Date(),
      labels,
    };

    this.metrics.push(metric);
    this.updateAggregation(metric);

    // 최대 개수 초과 시 오래된 메트릭 제거
    if (this.metrics.length > this.config.maxMetrics) {
      this.metrics.shift();
    }

    this.emit("metric", metric);
  }

  /**
   * 동기화 지연 시간 기록
   */
  recordSyncLatency(latencyMs: number, trigger: string): void {
    this.record("sync_latency", latencyMs, "ms", { trigger });
    this.syncCounts[trigger] = (this.syncCounts[trigger] || 0) + 1;
  }

  /**
   * 컨텍스트 크기 기록
   */
  recordContextSize(sizeBytes: number): void {
    this.record("context_size", sizeBytes, "bytes");
  }

  /**
   * 스냅샷 수 기록
   */
  recordSnapshotCount(count: number): void {
    this.record("snapshot_count", count, "count");
  }

  /**
   * 에러 기록
   */
  recordError(source: string): void {
    this.errorCount++;
    this.record("error_count", 1, "count", { source });
  }

  /**
   * 경고 기록
   */
  recordWarning(source: string): void {
    this.warningCount++;
    this.emit("warning_recorded", { source, timestamp: new Date() });
  }

  /**
   * 작업 시작 타이머
   */
  startOperation(operationId: string): void {
    this.operationTimers.set(operationId, Date.now());
  }

  /**
   * 작업 종료 및 시간 기록
   */
  endOperation(operationId: string, operationType: string): number {
    const startTime = this.operationTimers.get(operationId);
    if (!startTime) {
      return 0;
    }

    const duration = Date.now() - startTime;
    this.operationTimers.delete(operationId);

    this.record("operation_duration", duration, "ms", { type: operationType });
    this.operationCounts[operationType] = (this.operationCounts[operationType] || 0) + 1;

    return duration;
  }

  /**
   * 메모리 사용량 기록
   */
  recordMemoryUsage(): void {
    const usage = process.memoryUsage();
    this.record("memory_usage", usage.heapUsed, "bytes");
  }

  /**
   * 집계 메트릭 업데이트
   */
  private updateAggregation(metric: MetricData): void {
    const existing = this.aggregatedMetrics.get(metric.type);

    if (existing) {
      existing.count++;
      existing.sum += metric.value;
      existing.min = Math.min(existing.min, metric.value);
      existing.max = Math.max(existing.max, metric.value);
      existing.avg = existing.sum / existing.count;
      existing.lastUpdated = metric.timestamp;
    } else {
      this.aggregatedMetrics.set(metric.type, {
        type: metric.type,
        count: 1,
        sum: metric.value,
        min: metric.value,
        max: metric.value,
        avg: metric.value,
        unit: metric.unit,
        lastUpdated: metric.timestamp,
      });
    }
  }

  /**
   * 집계 메트릭 가져오기
   */
  getAggregatedMetric(type: MetricType): AggregatedMetric | undefined {
    return this.aggregatedMetrics.get(type);
  }

  /**
   * 전체 메트릭 리포트 생성
   */
  generateReport(): MetricsReport {
    const now = new Date();
    const uptimeMs = now.getTime() - this.startTime.getTime();

    // 동기화 메트릭 집계
    const syncLatencyMetric = this.aggregatedMetrics.get("sync_latency");
    const totalSyncs = Object.values(this.syncCounts).reduce((a, b) => a + b, 0);

    // 컨텍스트 메트릭
    const contextSizeMetric = this.aggregatedMetrics.get("context_size");

    // 스냅샷 메트릭
    const snapshotMetric = this.aggregatedMetrics.get("snapshot_count");

    // 메모리 메트릭
    const memoryMetric = this.aggregatedMetrics.get("memory_usage");

    // 작업 메트릭
    const operationMetric = this.aggregatedMetrics.get("operation_duration");
    const totalOperations = Object.values(this.operationCounts).reduce((a, b) => a + b, 0);

    return {
      generatedAt: now,
      collectionPeriodMs: uptimeMs,
      sync: {
        totalSyncs,
        avgLatencyMs: syncLatencyMetric?.avg ?? 0,
        maxLatencyMs: syncLatencyMetric?.max ?? 0,
        syncsByTrigger: { ...this.syncCounts },
      },
      context: {
        currentSizeBytes: contextSizeMetric?.sum ?? 0,
        decisionsCount: 0, // 외부에서 설정 필요
        approachesCount: 0,
        blockersCount: 0,
        unresolvedBlockersCount: 0,
      },
      snapshots: {
        totalCount: snapshotMetric?.sum ?? 0,
        avgSizeBytes: 0,
      },
      system: {
        memoryUsageBytes: memoryMetric?.sum ?? process.memoryUsage().heapUsed,
        uptimeMs,
        errorCount: this.errorCount,
        warningCount: this.warningCount,
      },
      operations: {
        totalOperations,
        operationsByType: { ...this.operationCounts },
        avgDurationMs: operationMetric?.avg ?? 0,
      },
    };
  }

  /**
   * 특정 기간의 메트릭 조회
   */
  getMetricsByPeriod(
    type: MetricType,
    startTime: Date,
    endTime: Date = new Date()
  ): MetricData[] {
    return this.metrics.filter(
      (m) =>
        m.type === type &&
        m.timestamp >= startTime &&
        m.timestamp <= endTime
    );
  }

  /**
   * 최근 N개 메트릭 조회
   */
  getRecentMetrics(type: MetricType, count: number): MetricData[] {
    return this.metrics
      .filter((m) => m.type === type)
      .slice(-count);
  }

  /**
   * 자동 정리 시작
   */
  private startAutoCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, this.config.aggregationIntervalMs);
  }

  /**
   * 오래된 메트릭 정리
   */
  cleanup(): number {
    const cutoffTime = new Date(Date.now() - this.config.retentionPeriodMs);
    const initialCount = this.metrics.length;

    this.metrics = this.metrics.filter((m) => m.timestamp >= cutoffTime);

    const removedCount = initialCount - this.metrics.length;
    if (removedCount > 0) {
      this.emit("cleanup", { removedCount });
    }

    return removedCount;
  }

  /**
   * 모든 메트릭 초기화
   */
  reset(): void {
    this.metrics = [];
    this.aggregatedMetrics.clear();
    this.syncCounts = {};
    this.errorCount = 0;
    this.warningCount = 0;
    this.operationCounts = {};
    this.startTime = new Date();
    this.emit("reset");
  }

  /**
   * 컬렉터 중지
   */
  stop(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.emit("stopped");
  }

  /**
   * 리포트를 마크다운으로 변환
   */
  toMarkdown(report?: MetricsReport): string {
    const r = report ?? this.generateReport();

    return `## 성능 메트릭 리포트

**생성 시간**: ${r.generatedAt.toISOString()}
**수집 기간**: ${(r.collectionPeriodMs / 1000 / 60).toFixed(1)}분

### 동기화 성능

| 항목 | 값 |
|------|-----|
| 총 동기화 | ${r.sync.totalSyncs}회 |
| 평균 지연 | ${r.sync.avgLatencyMs.toFixed(2)}ms |
| 최대 지연 | ${r.sync.maxLatencyMs.toFixed(2)}ms |

**트리거별 동기화**:
${Object.entries(r.sync.syncsByTrigger)
  .map(([trigger, count]) => `- ${trigger}: ${count}회`)
  .join("\n")}

### 시스템 상태

| 항목 | 값 |
|------|-----|
| 메모리 사용 | ${(r.system.memoryUsageBytes / 1024 / 1024).toFixed(2)}MB |
| 업타임 | ${(r.system.uptimeMs / 1000 / 60).toFixed(1)}분 |
| 에러 | ${r.system.errorCount}건 |
| 경고 | ${r.system.warningCount}건 |

### 작업 성능

| 항목 | 값 |
|------|-----|
| 총 작업 | ${r.operations.totalOperations}회 |
| 평균 소요 | ${r.operations.avgDurationMs.toFixed(2)}ms |

**작업 유형별**:
${Object.entries(r.operations.operationsByType)
  .map(([type, count]) => `- ${type}: ${count}회`)
  .join("\n") || "- 기록 없음"}
`;
  }
}

/**
 * 메트릭스 컬렉터 생성 헬퍼
 */
export function createMetricsCollector(
  config?: Partial<MetricsCollectorConfig>
): MetricsCollector {
  return new MetricsCollector(config);
}
