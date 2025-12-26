/**
 * Context Summarizer - 컨텍스트 요약 및 압축
 * 긴 컨텍스트를 핵심 정보만 추출하여 요약합니다.
 */

import type { SharedContext, Decision, Approach, Blocker } from "../types/index.js";

/** 요약 설정 */
export interface SummarizerConfig {
  /** 최대 결정 수 */
  maxDecisions: number;
  /** 최대 접근법 수 */
  maxApproaches: number;
  /** 최대 블로커 수 */
  maxBlockers: number;
  /** 최대 다음 단계 수 */
  maxNextSteps: number;
  /** 최대 파일 수 */
  maxFiles: number;
  /** 압축 레벨 */
  compressionLevel: "none" | "low" | "medium" | "high";
}

const DEFAULT_CONFIG: SummarizerConfig = {
  maxDecisions: 5,
  maxApproaches: 5,
  maxBlockers: 5,
  maxNextSteps: 5,
  maxFiles: 10,
  compressionLevel: "medium",
};

/** 압축 레벨별 설정 */
const COMPRESSION_LIMITS: Record<string, Partial<SummarizerConfig>> = {
  none: {
    maxDecisions: 100,
    maxApproaches: 100,
    maxBlockers: 100,
    maxNextSteps: 100,
    maxFiles: 100,
  },
  low: {
    maxDecisions: 10,
    maxApproaches: 10,
    maxBlockers: 10,
    maxNextSteps: 10,
    maxFiles: 20,
  },
  medium: {
    maxDecisions: 5,
    maxApproaches: 5,
    maxBlockers: 5,
    maxNextSteps: 5,
    maxFiles: 10,
  },
  high: {
    maxDecisions: 3,
    maxApproaches: 3,
    maxBlockers: 3,
    maxNextSteps: 3,
    maxFiles: 5,
  },
};

/**
 * 컨텍스트 요약기 클래스
 */
export class ContextSummarizer {
  private config: SummarizerConfig;

  constructor(config?: Partial<SummarizerConfig>) {
    const level = config?.compressionLevel || "medium";
    this.config = {
      ...DEFAULT_CONFIG,
      ...COMPRESSION_LIMITS[level],
      ...config,
    };
  }

  /**
   * 전체 컨텍스트 요약
   */
  summarize(context: SharedContext): SummarizedContext {
    return {
      id: context.id,
      projectPath: context.projectPath,
      goal: context.currentWork.goal,
      status: context.currentWork.status,
      startedAt: context.currentWork.startedAt,
      lastActiveAt: context.currentWork.lastActiveAt,

      // 최근 결정만 유지
      recentDecisions: this.summarizeDecisions(
        context.conversationSummary.keyDecisions
      ),

      // 실패한 접근법 우선
      failedApproaches: this.summarizeApproaches(
        context.conversationSummary.triedApproaches
      ),

      // 미해결 블로커
      unresolvedBlockers: this.summarizeBlockers(
        context.conversationSummary.blockers
      ),

      // 다음 단계
      nextSteps: context.conversationSummary.nextSteps.slice(
        0,
        this.config.maxNextSteps
      ),

      // 변경 파일
      modifiedFiles: context.codeChanges.modifiedFiles.slice(
        0,
        this.config.maxFiles
      ),

      // 에이전트 체인 (마지막 3개만)
      agentHistory: context.agentChain.slice(-3).map((h) => ({
        from: h.from,
        to: h.to,
        summary: h.summary,
      })),

      // 메타데이터
      version: context.version,
      updatedAt: context.updatedAt,
    };
  }

  /**
   * 마크다운 형식으로 요약
   */
  toMarkdown(context: SharedContext): string {
    const summary = this.summarize(context);
    const lastAgent = summary.agentHistory.at(-1);

    let md = `## 작업 컨텍스트\n\n`;
    md += `**목표**: ${summary.goal}\n`;
    md += `**상태**: ${summary.status}\n`;
    md += `**마지막 활동**: ${this.formatDate(summary.lastActiveAt)}`;
    if (lastAgent) {
      md += ` (${lastAgent.from} → ${lastAgent.to})`;
    }
    md += `\n\n`;

    // 주요 결정사항
    if (summary.recentDecisions.length > 0) {
      md += `### 주요 결정사항\n`;
      for (const d of summary.recentDecisions) {
        md += `- **${d.what}**: ${d.why}\n`;
      }
      md += `\n`;
    }

    // 실패한 시도
    if (summary.failedApproaches.length > 0) {
      md += `### 시도했지만 실패한 것\n`;
      for (const a of summary.failedApproaches) {
        md += `- ~~${a.description}~~: ${a.reason || "이유 미기록"}\n`;
      }
      md += `\n`;
    }

    // 미해결 블로커
    if (summary.unresolvedBlockers.length > 0) {
      md += `### 현재 막힌 부분\n`;
      for (const b of summary.unresolvedBlockers) {
        md += `- ⚠️ ${b.description}\n`;
      }
      md += `\n`;
    }

    // 다음 단계
    if (summary.nextSteps.length > 0) {
      md += `### 다음 단계\n`;
      for (const s of summary.nextSteps) {
        md += `- [ ] ${s}\n`;
      }
      md += `\n`;
    }

    // 변경 파일
    if (summary.modifiedFiles.length > 0) {
      md += `### 변경된 파일\n`;
      md += `\`\`\`\n${summary.modifiedFiles.join("\n")}\n\`\`\`\n`;
    }

    return md;
  }

  /**
   * JSON 형식으로 요약 (AI 친화적)
   */
  toJSON(context: SharedContext): string {
    return JSON.stringify(this.summarize(context), null, 2);
  }

  /**
   * 한 줄 요약
   */
  toOneLiner(context: SharedContext): string {
    const summary = this.summarize(context);
    const blockers = summary.unresolvedBlockers.length;
    const nextStep = summary.nextSteps[0] || "다음 단계 없음";

    return `[${summary.status}] ${summary.goal} | 블로커: ${blockers}개 | 다음: ${nextStep}`;
  }

  /**
   * 토큰 예상치 계산 (대략적)
   */
  estimateTokens(context: SharedContext): number {
    const json = this.toJSON(context);
    // 대략 4자당 1토큰
    return Math.ceil(json.length / 4);
  }

  /**
   * 결정 요약
   */
  private summarizeDecisions(decisions: Decision[]): SummarizedDecision[] {
    return decisions
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, this.config.maxDecisions)
      .map((d) => ({
        what: d.what,
        why: d.why,
        madeBy: d.madeBy,
      }));
  }

  /**
   * 접근법 요약 (실패한 것 우선)
   */
  private summarizeApproaches(approaches: Approach[]): SummarizedApproach[] {
    return approaches
      .filter((a) => a.result === "failed")
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, this.config.maxApproaches)
      .map((a) => ({
        description: a.description,
        reason: a.reason,
      }));
  }

  /**
   * 블로커 요약 (미해결만)
   */
  private summarizeBlockers(blockers: Blocker[]): SummarizedBlocker[] {
    return blockers
      .filter((b) => !b.resolved)
      .slice(0, this.config.maxBlockers)
      .map((b) => ({
        id: b.id,
        description: b.description,
      }));
  }

  /**
   * 날짜 포맷
   */
  private formatDate(date: Date): string {
    const now = new Date();
    const diff = now.getTime() - new Date(date).getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (minutes < 1) return "방금 전";
    if (minutes < 60) return `${minutes}분 전`;
    if (hours < 24) return `${hours}시간 전`;
    return `${days}일 전`;
  }
}

/** 요약된 컨텍스트 타입 */
export interface SummarizedContext {
  id: string;
  projectPath: string;
  goal: string;
  status: string;
  startedAt: Date;
  lastActiveAt: Date;
  recentDecisions: SummarizedDecision[];
  failedApproaches: SummarizedApproach[];
  unresolvedBlockers: SummarizedBlocker[];
  nextSteps: string[];
  modifiedFiles: string[];
  agentHistory: { from: string; to: string; summary: string }[];
  version: number;
  updatedAt: Date;
}

interface SummarizedDecision {
  what: string;
  why: string;
  madeBy: string;
}

interface SummarizedApproach {
  description: string;
  reason?: string;
}

interface SummarizedBlocker {
  id: string;
  description: string;
}

/**
 * 요약기 생성 헬퍼
 */
export function createSummarizer(config?: Partial<SummarizerConfig>): ContextSummarizer {
  return new ContextSummarizer(config);
}
