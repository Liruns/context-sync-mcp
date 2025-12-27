/**
 * 메타데이터 레포지토리
 * 의사결정, 접근법, 블로커, 핸드오프 관리
 */

import { randomUUID } from "crypto";
import type {
  Decision,
  Approach,
  Blocker,
  AgentHandoff,
  AgentType,
} from "../types/index.js";
import type { ContextRepository } from "./context-repository.js";

/**
 * 메타데이터 레포지토리
 */
export class MetadataRepository {
  private contextRepo: ContextRepository;

  constructor(contextRepo: ContextRepository) {
    this.contextRepo = contextRepo;
  }

  /**
   * 의사결정 추가
   */
  async addDecision(
    what: string,
    why: string,
    agent: AgentType = "unknown"
  ): Promise<Decision> {
    const context = await this.contextRepo.getContext();
    if (!context) {
      throw new Error("활성 컨텍스트가 없습니다");
    }

    const decision: Decision = {
      id: randomUUID(),
      what,
      why,
      madeBy: agent,
      timestamp: new Date(),
    };

    context.conversationSummary.keyDecisions.push(decision);
    context.updatedAt = new Date();
    context.version += 1;

    await this.contextRepo.saveCurrentContext();
    return decision;
  }

  /**
   * 시도한 접근법 추가
   */
  async addApproach(
    description: string,
    result: "success" | "failed" | "partial",
    reason?: string,
    agent: AgentType = "unknown"
  ): Promise<Approach> {
    const context = await this.contextRepo.getContext();
    if (!context) {
      throw new Error("활성 컨텍스트가 없습니다");
    }

    const approach: Approach = {
      id: randomUUID(),
      description,
      result,
      reason,
      attemptedBy: agent,
      timestamp: new Date(),
    };

    context.conversationSummary.triedApproaches.push(approach);
    context.updatedAt = new Date();
    context.version += 1;

    await this.contextRepo.saveCurrentContext();
    return approach;
  }

  /**
   * 블로커 추가
   */
  async addBlocker(description: string): Promise<Blocker> {
    const context = await this.contextRepo.getContext();
    if (!context) {
      throw new Error("활성 컨텍스트가 없습니다");
    }

    const blocker: Blocker = {
      id: randomUUID(),
      description,
      resolved: false,
      discoveredAt: new Date(),
    };

    context.conversationSummary.blockers.push(blocker);
    context.updatedAt = new Date();
    context.version += 1;

    await this.contextRepo.saveCurrentContext();
    return blocker;
  }

  /**
   * 블로커 해결
   */
  async resolveBlocker(
    blockerId: string,
    resolution: string
  ): Promise<Blocker | null> {
    const context = await this.contextRepo.getContext();
    if (!context) {
      return null;
    }

    const blocker = context.conversationSummary.blockers.find(
      (b) => b.id === blockerId
    );
    if (!blocker) {
      return null;
    }

    blocker.resolved = true;
    blocker.resolvedAt = new Date();
    blocker.resolution = resolution;

    context.updatedAt = new Date();
    context.version += 1;

    await this.contextRepo.saveCurrentContext();
    return blocker;
  }

  /**
   * 에이전트 핸드오프 기록
   */
  async recordHandoff(
    from: AgentType,
    to: AgentType,
    summary: string
  ): Promise<AgentHandoff> {
    const context = await this.contextRepo.getContext();
    if (!context) {
      throw new Error("활성 컨텍스트가 없습니다");
    }

    const handoff: AgentHandoff = {
      from,
      to,
      summary,
      timestamp: new Date(),
    };

    context.agentChain.push(handoff);
    context.updatedAt = new Date();
    context.version += 1;

    await this.contextRepo.saveCurrentContext();
    return handoff;
  }
}
