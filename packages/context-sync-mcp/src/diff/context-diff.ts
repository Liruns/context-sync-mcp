/**
 * Context Diff Engine - 컨텍스트 비교 및 병합
 * 두 컨텍스트 간의 차이를 분석하고 병합을 지원합니다.
 */

import type {
  SharedContext,
  Decision,
  Approach,
  Blocker,
  AgentHandoff,
} from "../types/index.js";

/** 변경 타입 */
export type ChangeType = "added" | "removed" | "modified";

/** 개별 변경 항목 */
export interface Change<T = unknown> {
  type: ChangeType;
  path: string;
  oldValue?: T;
  newValue?: T;
}

/** Diff 결과 */
export interface ContextDiff {
  /** 컨텍스트 ID들 */
  sourceId: string;
  targetId: string;
  /** 생성 시간 */
  timestamp: Date;
  /** 변경 요약 */
  summary: {
    totalChanges: number;
    added: number;
    removed: number;
    modified: number;
  };
  /** 상세 변경 내역 */
  changes: {
    decisions: Change<Decision>[];
    approaches: Change<Approach>[];
    blockers: Change<Blocker>[];
    handoffs: Change<AgentHandoff>[];
    nextSteps: Change<string>[];
    files: Change<string>[];
    metadata: Change[];
  };
}

/** 병합 전략 */
export type MergeStrategy = "source" | "target" | "union" | "latest";

/** 병합 옵션 */
export interface MergeOptions {
  /** 결정사항 병합 전략 */
  decisions: MergeStrategy;
  /** 접근법 병합 전략 */
  approaches: MergeStrategy;
  /** 블로커 병합 전략 */
  blockers: MergeStrategy;
  /** 다음 단계 병합 전략 */
  nextSteps: MergeStrategy;
  /** 충돌 시 어느 쪽 우선 */
  conflictResolution: "source" | "target";
}

/** 병합 결과 */
export interface MergeResult {
  /** 성공 여부 */
  success: boolean;
  /** 병합된 컨텍스트 */
  merged?: SharedContext;
  /** 충돌 목록 */
  conflicts: MergeConflict[];
  /** 적용된 변경 수 */
  appliedChanges: number;
}

/** 충돌 정보 */
export interface MergeConflict {
  path: string;
  sourceValue: unknown;
  targetValue: unknown;
  resolution?: "source" | "target" | "manual";
}

/** 기본 병합 옵션 */
const DEFAULT_MERGE_OPTIONS: MergeOptions = {
  decisions: "union",
  approaches: "union",
  blockers: "latest",
  nextSteps: "target",
  conflictResolution: "target",
};

/**
 * Context Diff 엔진 클래스
 */
export class ContextDiffEngine {
  /**
   * 두 컨텍스트 비교
   */
  compare(source: SharedContext, target: SharedContext): ContextDiff {
    const changes: ContextDiff["changes"] = {
      decisions: this.compareArrayById(
        source.conversationSummary.keyDecisions,
        target.conversationSummary.keyDecisions,
        "decisions"
      ),
      approaches: this.compareArrayById(
        source.conversationSummary.triedApproaches,
        target.conversationSummary.triedApproaches,
        "approaches"
      ),
      blockers: this.compareArrayById(
        source.conversationSummary.blockers,
        target.conversationSummary.blockers,
        "blockers"
      ),
      handoffs: this.compareHandoffs(
        source.agentChain,
        target.agentChain
      ),
      nextSteps: this.compareStringArray(
        source.conversationSummary.nextSteps,
        target.conversationSummary.nextSteps,
        "nextSteps"
      ),
      files: this.compareStringArray(
        source.codeChanges.modifiedFiles,
        target.codeChanges.modifiedFiles,
        "files"
      ),
      metadata: this.compareMetadata(source, target),
    };

    const summary = this.calculateSummary(changes);

    return {
      sourceId: source.id,
      targetId: target.id,
      timestamp: new Date(),
      summary,
      changes,
    };
  }

  /**
   * ID 기반 배열 비교
   */
  private compareArrayById<T extends { id: string }>(
    source: T[],
    target: T[],
    pathPrefix: string
  ): Change<T>[] {
    const changes: Change<T>[] = [];
    const sourceMap = new Map(source.map((item) => [item.id, item]));
    const targetMap = new Map(target.map((item) => [item.id, item]));

    // 추가된 항목 (target에만 존재)
    for (const [id, item] of targetMap) {
      if (!sourceMap.has(id)) {
        changes.push({
          type: "added",
          path: `${pathPrefix}.${id}`,
          newValue: item,
        });
      }
    }

    // 제거된 항목 (source에만 존재)
    for (const [id, item] of sourceMap) {
      if (!targetMap.has(id)) {
        changes.push({
          type: "removed",
          path: `${pathPrefix}.${id}`,
          oldValue: item,
        });
      }
    }

    // 수정된 항목 (양쪽에 존재하지만 다름)
    for (const [id, sourceItem] of sourceMap) {
      const targetItem = targetMap.get(id);
      if (targetItem && JSON.stringify(sourceItem) !== JSON.stringify(targetItem)) {
        changes.push({
          type: "modified",
          path: `${pathPrefix}.${id}`,
          oldValue: sourceItem,
          newValue: targetItem,
        });
      }
    }

    return changes;
  }

  /**
   * 문자열 배열 비교
   */
  private compareStringArray(
    source: string[],
    target: string[],
    pathPrefix: string
  ): Change<string>[] {
    const changes: Change<string>[] = [];
    const sourceSet = new Set(source);
    const targetSet = new Set(target);

    // 추가된 항목
    for (const item of target) {
      if (!sourceSet.has(item)) {
        changes.push({
          type: "added",
          path: `${pathPrefix}`,
          newValue: item,
        });
      }
    }

    // 제거된 항목
    for (const item of source) {
      if (!targetSet.has(item)) {
        changes.push({
          type: "removed",
          path: `${pathPrefix}`,
          oldValue: item,
        });
      }
    }

    return changes;
  }

  /**
   * AgentHandoff 배열 비교 (id 없이 from+to+timestamp 기준)
   */
  private compareHandoffs(
    source: AgentHandoff[],
    target: AgentHandoff[]
  ): Change<AgentHandoff>[] {
    const changes: Change<AgentHandoff>[] = [];

    // 핸드오프 키 생성 함수
    const getKey = (h: AgentHandoff) =>
      `${h.from}->${h.to}@${new Date(h.timestamp).getTime()}`;

    const sourceMap = new Map(source.map((h) => [getKey(h), h]));
    const targetMap = new Map(target.map((h) => [getKey(h), h]));

    // 추가된 핸드오프
    for (const [key, item] of targetMap) {
      if (!sourceMap.has(key)) {
        changes.push({
          type: "added",
          path: `handoffs.${key}`,
          newValue: item,
        });
      }
    }

    // 제거된 핸드오프
    for (const [key, item] of sourceMap) {
      if (!targetMap.has(key)) {
        changes.push({
          type: "removed",
          path: `handoffs.${key}`,
          oldValue: item,
        });
      }
    }

    return changes;
  }

  /**
   * 메타데이터 비교
   */
  private compareMetadata(source: SharedContext, target: SharedContext): Change[] {
    const changes: Change[] = [];

    if (source.currentWork.goal !== target.currentWork.goal) {
      changes.push({
        type: "modified",
        path: "currentWork.goal",
        oldValue: source.currentWork.goal,
        newValue: target.currentWork.goal,
      });
    }

    if (source.currentWork.status !== target.currentWork.status) {
      changes.push({
        type: "modified",
        path: "currentWork.status",
        oldValue: source.currentWork.status,
        newValue: target.currentWork.status,
      });
    }

    if (source.codeChanges.summary !== target.codeChanges.summary) {
      changes.push({
        type: "modified",
        path: "codeChanges.summary",
        oldValue: source.codeChanges.summary,
        newValue: target.codeChanges.summary,
      });
    }

    return changes;
  }

  /**
   * 변경 요약 계산
   */
  private calculateSummary(changes: ContextDiff["changes"]): ContextDiff["summary"] {
    let added = 0;
    let removed = 0;
    let modified = 0;

    const allChanges = [
      ...changes.decisions,
      ...changes.approaches,
      ...changes.blockers,
      ...changes.handoffs,
      ...changes.nextSteps,
      ...changes.files,
      ...changes.metadata,
    ];

    for (const change of allChanges) {
      switch (change.type) {
        case "added":
          added++;
          break;
        case "removed":
          removed++;
          break;
        case "modified":
          modified++;
          break;
      }
    }

    return {
      totalChanges: added + removed + modified,
      added,
      removed,
      modified,
    };
  }

  /**
   * 두 컨텍스트 병합
   */
  merge(
    source: SharedContext,
    target: SharedContext,
    options: Partial<MergeOptions> = {}
  ): MergeResult {
    const opts: MergeOptions = { ...DEFAULT_MERGE_OPTIONS, ...options };
    const conflicts: MergeConflict[] = [];
    let appliedChanges = 0;

    try {
      // 기본 구조는 target 기반
      const merged: SharedContext = JSON.parse(JSON.stringify(target));

      // 결정사항 병합
      const mergedDecisions = this.mergeArrayById(
        source.conversationSummary.keyDecisions,
        target.conversationSummary.keyDecisions,
        opts.decisions,
        "decisions",
        conflicts
      );
      merged.conversationSummary.keyDecisions = mergedDecisions.items;
      appliedChanges += mergedDecisions.changes;

      // 접근법 병합
      const mergedApproaches = this.mergeArrayById(
        source.conversationSummary.triedApproaches,
        target.conversationSummary.triedApproaches,
        opts.approaches,
        "approaches",
        conflicts
      );
      merged.conversationSummary.triedApproaches = mergedApproaches.items;
      appliedChanges += mergedApproaches.changes;

      // 블로커 병합
      const mergedBlockers = this.mergeArrayById(
        source.conversationSummary.blockers,
        target.conversationSummary.blockers,
        opts.blockers,
        "blockers",
        conflicts
      );
      merged.conversationSummary.blockers = mergedBlockers.items;
      appliedChanges += mergedBlockers.changes;

      // 다음 단계 병합
      merged.conversationSummary.nextSteps = this.mergeStringArray(
        source.conversationSummary.nextSteps,
        target.conversationSummary.nextSteps,
        opts.nextSteps
      );

      // 에이전트 체인 병합 (union으로 고정)
      merged.agentChain = this.mergeHandoffs(
        source.agentChain,
        target.agentChain
      );

      // 파일 목록 병합
      merged.codeChanges.modifiedFiles = this.mergeStringArray(
        source.codeChanges.modifiedFiles,
        target.codeChanges.modifiedFiles,
        "union"
      );

      // 메타데이터 업데이트
      merged.updatedAt = new Date();
      merged.version = Math.max(source.version, target.version) + 1;

      return {
        success: true,
        merged,
        conflicts,
        appliedChanges,
      };
    } catch (error) {
      return {
        success: false,
        conflicts,
        appliedChanges,
      };
    }
  }

  /**
   * ID 기반 배열 병합
   */
  private mergeArrayById<T extends { id: string; timestamp?: Date }>(
    source: T[],
    target: T[],
    strategy: MergeStrategy,
    pathPrefix: string,
    conflicts: MergeConflict[]
  ): { items: T[]; changes: number } {
    const sourceMap = new Map(source.map((item) => [item.id, item]));
    const targetMap = new Map(target.map((item) => [item.id, item]));
    const allIds = new Set([...sourceMap.keys(), ...targetMap.keys()]);
    const result: T[] = [];
    let changes = 0;

    for (const id of allIds) {
      const sourceItem = sourceMap.get(id);
      const targetItem = targetMap.get(id);

      if (sourceItem && !targetItem) {
        // source에만 존재
        if (strategy === "source" || strategy === "union") {
          result.push(sourceItem);
          changes++;
        }
      } else if (!sourceItem && targetItem) {
        // target에만 존재
        if (strategy === "target" || strategy === "union") {
          result.push(targetItem);
        }
      } else if (sourceItem && targetItem) {
        // 양쪽에 존재
        if (JSON.stringify(sourceItem) === JSON.stringify(targetItem)) {
          result.push(targetItem);
        } else {
          // 충돌 발생
          if (strategy === "latest" && sourceItem.timestamp && targetItem.timestamp) {
            const sourceTime = new Date(sourceItem.timestamp).getTime();
            const targetTime = new Date(targetItem.timestamp).getTime();
            result.push(sourceTime > targetTime ? sourceItem : targetItem);
            changes++;
          } else if (strategy === "source") {
            result.push(sourceItem);
            changes++;
          } else {
            result.push(targetItem);
          }
          conflicts.push({
            path: `${pathPrefix}.${id}`,
            sourceValue: sourceItem,
            targetValue: targetItem,
            resolution: strategy === "source" ? "source" : "target",
          });
        }
      }
    }

    return { items: result, changes };
  }

  /**
   * 문자열 배열 병합
   */
  private mergeStringArray(
    source: string[],
    target: string[],
    strategy: MergeStrategy
  ): string[] {
    switch (strategy) {
      case "source":
        return [...source];
      case "target":
        return [...target];
      case "union":
        return [...new Set([...source, ...target])];
      case "latest":
      default:
        return [...target];
    }
  }

  /**
   * AgentHandoff 배열 병합 (union 전략 사용)
   */
  private mergeHandoffs(
    source: AgentHandoff[],
    target: AgentHandoff[]
  ): AgentHandoff[] {
    const getKey = (h: AgentHandoff) =>
      `${h.from}->${h.to}@${new Date(h.timestamp).getTime()}`;

    const seen = new Set<string>();
    const result: AgentHandoff[] = [];

    // target의 모든 핸드오프 추가
    for (const h of target) {
      const key = getKey(h);
      if (!seen.has(key)) {
        seen.add(key);
        result.push(h);
      }
    }

    // source에서 없는 것만 추가
    for (const h of source) {
      const key = getKey(h);
      if (!seen.has(key)) {
        seen.add(key);
        result.push(h);
      }
    }

    // 타임스탬프로 정렬
    return result.sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
  }

  /**
   * Diff를 마크다운으로 변환
   */
  toMarkdown(diff: ContextDiff): string {
    const lines: string[] = [
      "## 컨텍스트 비교 결과",
      "",
      `- **Source**: ${diff.sourceId}`,
      `- **Target**: ${diff.targetId}`,
      `- **비교 시간**: ${diff.timestamp.toISOString()}`,
      "",
      "### 변경 요약",
      "",
      `| 유형 | 개수 |`,
      `|------|------|`,
      `| 추가 | ${diff.summary.added} |`,
      `| 삭제 | ${diff.summary.removed} |`,
      `| 수정 | ${diff.summary.modified} |`,
      `| **합계** | **${diff.summary.totalChanges}** |`,
      "",
    ];

    if (diff.changes.decisions.length > 0) {
      lines.push("### 결정사항 변경", "");
      for (const change of diff.changes.decisions) {
        lines.push(`- [${change.type}] ${change.path}`);
      }
      lines.push("");
    }

    if (diff.changes.approaches.length > 0) {
      lines.push("### 접근법 변경", "");
      for (const change of diff.changes.approaches) {
        lines.push(`- [${change.type}] ${change.path}`);
      }
      lines.push("");
    }

    if (diff.changes.blockers.length > 0) {
      lines.push("### 블로커 변경", "");
      for (const change of diff.changes.blockers) {
        lines.push(`- [${change.type}] ${change.path}`);
      }
      lines.push("");
    }

    return lines.join("\n");
  }
}

/**
 * Diff 엔진 생성 헬퍼
 */
export function createDiffEngine(): ContextDiffEngine {
  return new ContextDiffEngine();
}
