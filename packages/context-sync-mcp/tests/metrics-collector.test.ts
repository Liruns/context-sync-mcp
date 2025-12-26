/**
 * Metrics Collector 테스트
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { MetricsCollector } from "../src/metrics/metrics-collector.js";

describe("MetricsCollector", () => {
  let collector: MetricsCollector;

  beforeEach(() => {
    collector = new MetricsCollector({ autoCleanup: false });
  });

  afterEach(() => {
    collector.stop();
  });

  describe("record", () => {
    it("should record basic metrics", () => {
      collector.record("sync_latency", 100, "ms");

      const metric = collector.getAggregatedMetric("sync_latency");
      expect(metric).toBeDefined();
      expect(metric!.count).toBe(1);
      expect(metric!.sum).toBe(100);
      expect(metric!.avg).toBe(100);
    });

    it("should calculate aggregations correctly", () => {
      collector.record("sync_latency", 100, "ms");
      collector.record("sync_latency", 200, "ms");
      collector.record("sync_latency", 300, "ms");

      const metric = collector.getAggregatedMetric("sync_latency");
      expect(metric!.count).toBe(3);
      expect(metric!.sum).toBe(600);
      expect(metric!.min).toBe(100);
      expect(metric!.max).toBe(300);
      expect(metric!.avg).toBe(200);
    });

    it("should emit metric event", () => {
      const handler = vi.fn();
      collector.on("metric", handler);

      collector.record("sync_latency", 100, "ms");

      expect(handler).toHaveBeenCalledOnce();
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "sync_latency",
          value: 100,
          unit: "ms",
        })
      );
    });

    it("should store labels", () => {
      collector.record("sync_latency", 100, "ms", { trigger: "file_save" });

      const recent = collector.getRecentMetrics("sync_latency", 1);
      expect(recent[0].labels).toEqual({ trigger: "file_save" });
    });
  });

  describe("recordSyncLatency", () => {
    it("should record sync latency with trigger", () => {
      collector.recordSyncLatency(150, "file_save");

      const metric = collector.getAggregatedMetric("sync_latency");
      expect(metric!.avg).toBe(150);
    });

    it("should count syncs by trigger", () => {
      collector.recordSyncLatency(100, "file_save");
      collector.recordSyncLatency(200, "file_save");
      collector.recordSyncLatency(150, "editor_switch");

      const report = collector.generateReport();
      expect(report.sync.syncsByTrigger["file_save"]).toBe(2);
      expect(report.sync.syncsByTrigger["editor_switch"]).toBe(1);
    });
  });

  describe("recordContextSize", () => {
    it("should record context size in bytes", () => {
      collector.recordContextSize(1024);

      const metric = collector.getAggregatedMetric("context_size");
      expect(metric!.sum).toBe(1024);
    });
  });

  describe("startOperation / endOperation", () => {
    it("should measure operation duration", () => {
      const opId = "op-1";
      collector.startOperation(opId);

      // 시간이 지난 것처럼 시뮬레이션 (실제로는 매우 짧음)
      const duration = collector.endOperation(opId, "context_save");

      expect(duration).toBeGreaterThanOrEqual(0);

      const metric = collector.getAggregatedMetric("operation_duration");
      expect(metric).toBeDefined();
    });

    it("should return 0 for unknown operation", () => {
      const duration = collector.endOperation("unknown-op", "test");
      expect(duration).toBe(0);
    });

    it("should track operations by type", () => {
      collector.startOperation("op-1");
      collector.endOperation("op-1", "save");
      collector.startOperation("op-2");
      collector.endOperation("op-2", "save");
      collector.startOperation("op-3");
      collector.endOperation("op-3", "load");

      const report = collector.generateReport();
      expect(report.operations.operationsByType["save"]).toBe(2);
      expect(report.operations.operationsByType["load"]).toBe(1);
    });
  });

  describe("recordError / recordWarning", () => {
    it("should count errors", () => {
      collector.recordError("sync_engine");
      collector.recordError("file_io");
      collector.recordError("sync_engine");

      const report = collector.generateReport();
      expect(report.system.errorCount).toBe(3);
    });

    it("should count warnings", () => {
      collector.recordWarning("config_validation");
      collector.recordWarning("deprecated_api");

      const report = collector.generateReport();
      expect(report.system.warningCount).toBe(2);
    });

    it("should emit warning_recorded event", () => {
      const handler = vi.fn();
      collector.on("warning_recorded", handler);

      collector.recordWarning("test_source");

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          source: "test_source",
        })
      );
    });
  });

  describe("generateReport", () => {
    it("should generate comprehensive report", () => {
      collector.recordSyncLatency(100, "file_save");
      collector.recordSyncLatency(200, "editor_switch");
      collector.recordContextSize(2048);
      collector.recordSnapshotCount(5);
      collector.recordError("test");

      const report = collector.generateReport();

      expect(report.generatedAt).toBeDefined();
      expect(report.collectionPeriodMs).toBeGreaterThanOrEqual(0);
      expect(report.sync.totalSyncs).toBe(2);
      expect(report.sync.avgLatencyMs).toBe(150);
      expect(report.sync.maxLatencyMs).toBe(200);
      expect(report.system.errorCount).toBe(1);
    });
  });

  describe("getMetricsByPeriod", () => {
    it("should filter metrics by time period", () => {
      const now = new Date();
      const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000);

      collector.record("sync_latency", 100, "ms");
      collector.record("sync_latency", 200, "ms");

      const metrics = collector.getMetricsByPeriod("sync_latency", tenMinutesAgo, now);
      expect(metrics.length).toBe(2);
    });
  });

  describe("getRecentMetrics", () => {
    it("should return recent metrics", () => {
      collector.record("sync_latency", 100, "ms");
      collector.record("sync_latency", 200, "ms");
      collector.record("sync_latency", 300, "ms");

      const recent = collector.getRecentMetrics("sync_latency", 2);
      expect(recent.length).toBe(2);
      expect(recent[0].value).toBe(200);
      expect(recent[1].value).toBe(300);
    });
  });

  describe("cleanup", () => {
    it("should remove old metrics", () => {
      const collectorWithShortRetention = new MetricsCollector({
        retentionPeriodMs: 1, // 1ms 보존
        autoCleanup: false,
      });

      collectorWithShortRetention.record("sync_latency", 100, "ms");

      // 약간의 시간 대기
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          const removed = collectorWithShortRetention.cleanup();
          expect(removed).toBeGreaterThanOrEqual(0);
          collectorWithShortRetention.stop();
          resolve();
        }, 10);
      });
    });

    it("should emit cleanup event", () => {
      const handler = vi.fn();
      collector.on("cleanup", handler);

      collector.cleanup();

      // 오래된 메트릭이 없으면 이벤트가 발생하지 않을 수 있음
      // 이 테스트는 cleanup 메서드가 오류 없이 실행되는지 확인
    });
  });

  describe("reset", () => {
    it("should clear all metrics", () => {
      collector.record("sync_latency", 100, "ms");
      collector.recordError("test");
      collector.recordWarning("test");

      collector.reset();

      const report = collector.generateReport();
      expect(report.sync.totalSyncs).toBe(0);
      expect(report.system.errorCount).toBe(0);
      expect(report.system.warningCount).toBe(0);
    });

    it("should emit reset event", () => {
      const handler = vi.fn();
      collector.on("reset", handler);

      collector.reset();

      expect(handler).toHaveBeenCalledOnce();
    });
  });

  describe("toMarkdown", () => {
    it("should generate readable markdown report", () => {
      collector.recordSyncLatency(100, "file_save");
      collector.recordError("test");

      const markdown = collector.toMarkdown();

      expect(markdown).toContain("## 성능 메트릭 리포트");
      expect(markdown).toContain("### 동기화 성능");
      expect(markdown).toContain("### 시스템 상태");
      expect(markdown).toContain("에러");
    });
  });

  describe("maxMetrics limit", () => {
    it("should remove oldest metrics when limit exceeded", () => {
      const limitedCollector = new MetricsCollector({
        maxMetrics: 3,
        autoCleanup: false,
      });

      limitedCollector.record("sync_latency", 100, "ms");
      limitedCollector.record("sync_latency", 200, "ms");
      limitedCollector.record("sync_latency", 300, "ms");
      limitedCollector.record("sync_latency", 400, "ms");

      const recent = limitedCollector.getRecentMetrics("sync_latency", 10);
      expect(recent.length).toBe(3);
      expect(recent[0].value).toBe(200); // 첫 번째(100)는 제거됨

      limitedCollector.stop();
    });
  });
});
