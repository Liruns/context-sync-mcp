/**
 * 스냅샷 레포지토리
 * 스냅샷 생성, 목록, 복원, 정리 담당
 */

import * as fs from "fs/promises";
import * as path from "path";
import { randomUUID } from "crypto";
import type { SharedContext, ContextSnapshot } from "../types/index.js";
import type { ContextRepository } from "./context-repository.js";

/**
 * 스냅샷 레포지토리
 */
export class SnapshotRepository {
  private storePath: string;
  private contextRepo: ContextRepository;
  private maxSnapshots: number;

  constructor(
    storePath: string,
    contextRepo: ContextRepository,
    maxSnapshots: number = 100
  ) {
    this.storePath = storePath;
    this.contextRepo = contextRepo;
    this.maxSnapshots = maxSnapshots;
  }

  /**
   * 스냅샷 디렉토리 경로
   */
  private get snapshotsDir(): string {
    return path.join(this.storePath, "snapshots");
  }

  /**
   * 스냅샷 생성
   */
  async createSnapshot(
    reason: "auto" | "manual" | "handoff" | "milestone"
  ): Promise<ContextSnapshot | null> {
    const context = await this.contextRepo.getContext();
    if (!context) {
      return null;
    }

    const snapshot: ContextSnapshot = {
      id: randomUUID(),
      contextId: context.id,
      data: { ...context },
      reason,
      timestamp: new Date(),
    };

    const snapshotPath = path.join(this.snapshotsDir, `${snapshot.id}.json`);
    await fs.writeFile(snapshotPath, JSON.stringify(snapshot, null, 2));

    // 오래된 스냅샷 정리
    await this.cleanupOldSnapshots();

    return snapshot;
  }

  /**
   * 스냅샷 목록 가져오기
   */
  async listSnapshots(): Promise<ContextSnapshot[]> {
    try {
      const files = await fs.readdir(this.snapshotsDir);
      const snapshots: ContextSnapshot[] = [];

      for (const file of files) {
        if (file.endsWith(".json")) {
          try {
            const data = await fs.readFile(
              path.join(this.snapshotsDir, file),
              "utf-8"
            );
            snapshots.push(JSON.parse(data));
          } catch (parseErr) {
            console.warn(`스냅샷 파일 읽기 실패: ${file}`, parseErr);
          }
        }
      }

      return snapshots.sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        return [];
      }
      console.error("스냅샷 목록 조회 실패:", err);
      return [];
    }
  }

  /**
   * 스냅샷에서 복원
   */
  async restoreFromSnapshot(snapshotId: string): Promise<SharedContext | null> {
    const snapshotPath = path.join(this.snapshotsDir, `${snapshotId}.json`);
    try {
      const data = await fs.readFile(snapshotPath, "utf-8");
      const snapshot: ContextSnapshot = JSON.parse(data);
      const context = this.contextRepo.deserializeContext(
        snapshot.data as unknown as Record<string, unknown>
      );
      context.version += 1;
      context.updatedAt = new Date();

      this.contextRepo.setContext(context);
      await this.contextRepo.saveCurrentContext();

      return context;
    } catch (err) {
      const errCode = (err as NodeJS.ErrnoException).code;
      if (errCode === "ENOENT") {
        console.warn(`스냅샷을 찾을 수 없음: ${snapshotId}`);
      } else if (err instanceof SyntaxError) {
        console.error(`스냅샷 JSON 파싱 실패: ${snapshotId}`, err);
      } else {
        console.error(`스냅샷 복원 실패: ${snapshotId}`, err);
      }
      return null;
    }
  }

  /**
   * 오래된 스냅샷 정리
   */
  async cleanupOldSnapshots(): Promise<{ deleted: number; failed: number }> {
    const result = { deleted: 0, failed: 0 };

    try {
      const snapshots = await this.listSnapshots();
      if (snapshots.length <= this.maxSnapshots) {
        return result;
      }

      const toDelete = snapshots.slice(this.maxSnapshots);
      for (const snapshot of toDelete) {
        const snapshotPath = path.join(
          this.snapshotsDir,
          `${snapshot.id}.json`
        );
        try {
          await fs.unlink(snapshotPath);
          result.deleted++;
        } catch (err) {
          result.failed++;
          if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
            console.error(`스냅샷 삭제 실패: ${snapshotPath}`, err);
          }
        }
      }
    } catch (err) {
      console.error("스냅샷 정리 중 오류 발생:", err);
    }

    return result;
  }

  /**
   * maxSnapshots 설정 업데이트
   */
  setMaxSnapshots(max: number): void {
    this.maxSnapshots = max;
  }
}
