import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs/promises";
import * as path from "path";
import { ContextStore } from "../src/store/context-store.js";

/**
 * MCP 도구 핸들러 테스트
 * 실제 MCP 서버를 실행하지 않고 핸들러 로직만 테스트
 */

const TEST_PROJECT_PATH = path.join(process.cwd(), ".test-mcp-tools");

// 도구 핸들러 시뮬레이션
async function handleTool(
  store: ContextStore,
  name: string,
  args: Record<string, unknown>
): Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> {
  try {
    switch (name) {
      case "context_save": {
        const { goal, status, nextSteps, agent } = args as {
          goal: string;
          status?: string;
          nextSteps?: string[];
          agent?: string;
        };

        let context = await store.getContext();
        if (!context) {
          context = await store.createContext({
            projectPath: TEST_PROJECT_PATH,
            goal,
            agent: agent as "claude-code" | "cursor" | "windsurf" | "copilot" | "unknown",
          });
        } else {
          await store.updateContext({
            goal,
            status: status as "planning" | "coding" | "testing" | "reviewing" | "debugging" | "completed" | "paused",
            nextSteps,
          });
        }

        return {
          content: [
            {
              type: "text",
              text: `컨텍스트가 저장되었습니다.\n\n목표: ${goal}\n상태: ${status || context.currentWork.status}`,
            },
          ],
        };
      }

      case "context_load": {
        const { format = "summary" } = args as { format?: string };
        const context = await store.getContext();

        if (!context) {
          return {
            content: [
              {
                type: "text",
                text: "저장된 컨텍스트가 없습니다. context_save로 새 컨텍스트를 생성하세요.",
              },
            ],
          };
        }

        let result: string;
        switch (format) {
          case "full":
            result = JSON.stringify(context, null, 2);
            break;
          case "decisions":
            result =
              context.conversationSummary.keyDecisions
                .map((d) => `- ${d.what}: ${d.why}`)
                .join("\n") || "결정사항이 없습니다.";
            break;
          case "blockers":
            result =
              context.conversationSummary.blockers
                .filter((b) => !b.resolved)
                .map((b) => `- [${b.id.slice(0, 8)}] ${b.description}`)
                .join("\n") || "블로커가 없습니다.";
            break;
          default:
            result = await store.getSummary();
        }

        return {
          content: [{ type: "text", text: result }],
        };
      }

      case "decision_log": {
        const { what, why } = args as { what: string; why: string };
        const decision = await store.addDecision(what, why, "claude-code");
        return {
          content: [
            {
              type: "text",
              text: `결정이 기록되었습니다.\n\n결정: ${what}\n이유: ${why}\nID: ${decision.id.slice(0, 8)}`,
            },
          ],
        };
      }

      case "attempt_log": {
        const { approach, result, reason } = args as {
          approach: string;
          result: "success" | "failed" | "partial";
          reason?: string;
        };
        await store.addApproach(approach, result, reason, "claude-code");
        return {
          content: [
            {
              type: "text",
              text: `접근법이 기록되었습니다.\n\n접근법: ${approach}\n결과: ${result}${reason ? `\n이유: ${reason}` : ""}`,
            },
          ],
        };
      }

      case "blocker_add": {
        const { description } = args as { description: string };
        const blocker = await store.addBlocker(description);
        return {
          content: [
            {
              type: "text",
              text: `블로커가 추가되었습니다.\n\nID: ${blocker.id.slice(0, 8)}\n설명: ${description}`,
            },
          ],
        };
      }

      case "blocker_resolve": {
        const { blockerId, resolution } = args as { blockerId: string; resolution: string };
        const blocker = await store.resolveBlocker(blockerId, resolution);
        if (!blocker) {
          return {
            content: [{ type: "text", text: "블로커를 찾을 수 없습니다." }],
          };
        }
        return {
          content: [
            {
              type: "text",
              text: `블로커가 해결되었습니다.\n\n해결 방법: ${resolution}`,
            },
          ],
        };
      }

      case "handoff": {
        const { to, summary } = args as { to: string; summary: string };
        await store.recordHandoff(
          "claude-code",
          to as "claude-code" | "cursor" | "windsurf" | "copilot",
          summary
        );
        await store.createSnapshot("handoff");
        const contextSummary = await store.getSummary();
        return {
          content: [
            {
              type: "text",
              text: `${to}로 인수인계되었습니다.\n\n요약: ${summary}\n\n---\n\n${contextSummary}`,
            },
          ],
        };
      }

      case "snapshot_create": {
        const { reason = "manual" } = args as { reason?: "auto" | "manual" | "handoff" | "milestone" };
        const snapshot = await store.createSnapshot(reason);
        if (!snapshot) {
          return {
            content: [{ type: "text", text: "스냅샷 생성 실패. 활성 컨텍스트가 없습니다." }],
          };
        }
        return {
          content: [
            {
              type: "text",
              text: `스냅샷이 생성되었습니다.\n\nID: ${snapshot.id.slice(0, 8)}\n이유: ${reason}`,
            },
          ],
        };
      }

      case "snapshot_list": {
        const { limit = 10 } = args as { limit?: number };
        const snapshots = await store.listSnapshots();
        const list = snapshots.slice(0, limit);

        if (list.length === 0) {
          return {
            content: [{ type: "text", text: "저장된 스냅샷이 없습니다." }],
          };
        }

        const result = list
          .map((s) => `- [${s.id.slice(0, 8)}] ${s.reason} - ${new Date(s.timestamp).toLocaleString()}`)
          .join("\n");

        return {
          content: [{ type: "text", text: `스냅샷 목록:\n\n${result}` }],
        };
      }

      default:
        return {
          content: [{ type: "text", text: `알 수 없는 도구: ${name}` }],
          isError: true,
        };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: "text", text: `오류 발생: ${message}` }],
      isError: true,
    };
  }
}

describe("MCP Tools", () => {
  let store: ContextStore;

  beforeEach(async () => {
    store = new ContextStore(TEST_PROJECT_PATH);
    await store.initialize();
  });

  afterEach(async () => {
    await fs.rm(TEST_PROJECT_PATH, { recursive: true, force: true });
  });

  describe("context_save", () => {
    it("새 컨텍스트를 생성하고 성공 메시지 반환", async () => {
      const result = await handleTool(store, "context_save", {
        goal: "로그인 기능 구현",
        agent: "claude-code",
      });

      expect(result.content[0].text).toContain("컨텍스트가 저장되었습니다");
      expect(result.content[0].text).toContain("로그인 기능 구현");
    });

    it("기존 컨텍스트를 업데이트", async () => {
      await handleTool(store, "context_save", { goal: "원래 목표" });
      const result = await handleTool(store, "context_save", {
        goal: "새 목표",
        status: "coding",
      });

      expect(result.content[0].text).toContain("새 목표");
      expect(result.content[0].text).toContain("coding");
    });
  });

  describe("context_load", () => {
    it("컨텍스트가 없으면 안내 메시지 반환", async () => {
      const result = await handleTool(store, "context_load", {});
      expect(result.content[0].text).toContain("저장된 컨텍스트가 없습니다");
    });

    it("요약 형식으로 컨텍스트 로드", async () => {
      await handleTool(store, "context_save", { goal: "테스트 목표" });
      const result = await handleTool(store, "context_load", { format: "summary" });

      expect(result.content[0].text).toContain("테스트 목표");
    });

    it("decisions 형식으로 로드", async () => {
      await handleTool(store, "context_save", { goal: "결정 테스트" });
      await handleTool(store, "decision_log", { what: "결정1", why: "이유1" });

      const result = await handleTool(store, "context_load", { format: "decisions" });
      expect(result.content[0].text).toContain("결정1");
      expect(result.content[0].text).toContain("이유1");
    });

    it("blockers 형식으로 로드", async () => {
      await handleTool(store, "context_save", { goal: "블로커 테스트" });
      await handleTool(store, "blocker_add", { description: "API 연동 실패" });

      const result = await handleTool(store, "context_load", { format: "blockers" });
      expect(result.content[0].text).toContain("API 연동 실패");
    });
  });

  describe("decision_log", () => {
    it("의사결정을 기록하고 확인 메시지 반환", async () => {
      await handleTool(store, "context_save", { goal: "결정 기록" });
      const result = await handleTool(store, "decision_log", {
        what: "TypeScript 사용",
        why: "타입 안정성",
      });

      expect(result.content[0].text).toContain("결정이 기록되었습니다");
      expect(result.content[0].text).toContain("TypeScript 사용");
      expect(result.content[0].text).toContain("타입 안정성");
    });

    it("컨텍스트 없이 호출하면 에러", async () => {
      const result = await handleTool(store, "decision_log", {
        what: "테스트",
        why: "테스트",
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("오류");
    });
  });

  describe("attempt_log", () => {
    it("성공한 접근법 기록", async () => {
      await handleTool(store, "context_save", { goal: "접근법 테스트" });
      const result = await handleTool(store, "attempt_log", {
        approach: "REST API 사용",
        result: "success",
      });

      expect(result.content[0].text).toContain("접근법이 기록되었습니다");
      expect(result.content[0].text).toContain("success");
    });

    it("실패한 접근법과 이유 기록", async () => {
      await handleTool(store, "context_save", { goal: "실패 기록" });
      const result = await handleTool(store, "attempt_log", {
        approach: "WebSocket 사용",
        result: "failed",
        reason: "복잡도 과다",
      });

      expect(result.content[0].text).toContain("failed");
      expect(result.content[0].text).toContain("복잡도 과다");
    });
  });

  describe("blocker_add / blocker_resolve", () => {
    it("블로커를 추가하고 ID 반환", async () => {
      await handleTool(store, "context_save", { goal: "블로커 추가" });
      const result = await handleTool(store, "blocker_add", {
        description: "환경변수 설정 필요",
      });

      expect(result.content[0].text).toContain("블로커가 추가되었습니다");
      expect(result.content[0].text).toContain("환경변수 설정 필요");
    });

    it("블로커를 해결", async () => {
      await handleTool(store, "context_save", { goal: "블로커 해결" });
      await handleTool(store, "blocker_add", { description: "권한 문제" });

      const context = await store.getContext();
      const blockerId = context!.conversationSummary.blockers[0].id;

      const result = await handleTool(store, "blocker_resolve", {
        blockerId,
        resolution: "관리자 권한 획득",
      });

      expect(result.content[0].text).toContain("블로커가 해결되었습니다");
      expect(result.content[0].text).toContain("관리자 권한 획득");
    });

    it("존재하지 않는 블로커 해결 시도", async () => {
      await handleTool(store, "context_save", { goal: "없는 블로커" });
      const result = await handleTool(store, "blocker_resolve", {
        blockerId: "invalid-id",
        resolution: "해결",
      });

      expect(result.content[0].text).toContain("블로커를 찾을 수 없습니다");
    });
  });

  describe("handoff", () => {
    it("다른 에이전트로 인수인계", async () => {
      await handleTool(store, "context_save", { goal: "인수인계 테스트" });
      await handleTool(store, "decision_log", { what: "결정1", why: "이유1" });

      const result = await handleTool(store, "handoff", {
        to: "cursor",
        summary: "기본 구현 완료, 스타일링 필요",
      });

      expect(result.content[0].text).toContain("cursor로 인수인계되었습니다");
      expect(result.content[0].text).toContain("기본 구현 완료");
    });

    it("인수인계 시 스냅샷 자동 생성", async () => {
      await handleTool(store, "context_save", { goal: "스냅샷 테스트" });
      await handleTool(store, "handoff", {
        to: "windsurf",
        summary: "인계",
      });

      const snapshots = await store.listSnapshots();
      expect(snapshots.length).toBeGreaterThan(0);
      expect(snapshots[0].reason).toBe("handoff");
    });
  });

  describe("snapshot_create / snapshot_list", () => {
    it("수동 스냅샷 생성", async () => {
      await handleTool(store, "context_save", { goal: "스냅샷" });
      const result = await handleTool(store, "snapshot_create", { reason: "milestone" });

      expect(result.content[0].text).toContain("스냅샷이 생성되었습니다");
      expect(result.content[0].text).toContain("milestone");
    });

    it("스냅샷 목록 조회", async () => {
      await handleTool(store, "context_save", { goal: "목록 테스트" });
      await handleTool(store, "snapshot_create", { reason: "manual" });
      await handleTool(store, "snapshot_create", { reason: "milestone" });

      const result = await handleTool(store, "snapshot_list", { limit: 5 });
      expect(result.content[0].text).toContain("스냅샷 목록");
      expect(result.content[0].text).toContain("manual");
      expect(result.content[0].text).toContain("milestone");
    });

    it("스냅샷이 없을 때 안내 메시지", async () => {
      await handleTool(store, "context_save", { goal: "빈 목록" });
      const result = await handleTool(store, "snapshot_list", {});

      expect(result.content[0].text).toContain("저장된 스냅샷이 없습니다");
    });

    it("컨텍스트 없이 스냅샷 생성 시 실패", async () => {
      const result = await handleTool(store, "snapshot_create", {});
      expect(result.content[0].text).toContain("활성 컨텍스트가 없습니다");
    });
  });

  describe("unknown tool", () => {
    it("알 수 없는 도구 호출 시 에러", async () => {
      const result = await handleTool(store, "unknown_tool", {});
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("알 수 없는 도구");
    });
  });
});

describe("End-to-End Workflow", () => {
  let store: ContextStore;

  beforeEach(async () => {
    store = new ContextStore(TEST_PROJECT_PATH);
    await store.initialize();
  });

  afterEach(async () => {
    await fs.rm(TEST_PROJECT_PATH, { recursive: true, force: true });
  });

  it("전체 워크플로우: 시작 → 작업 → 결정 → 블로커 → 인수인계", async () => {
    // 1. 작업 시작
    await handleTool(store, "context_save", {
      goal: "사용자 인증 시스템 구현",
      agent: "claude-code",
    });

    // 2. 결정 기록
    await handleTool(store, "decision_log", {
      what: "JWT 토큰 사용",
      why: "stateless 인증으로 확장성 확보",
    });

    await handleTool(store, "decision_log", {
      what: "bcrypt로 비밀번호 해싱",
      why: "업계 표준 보안",
    });

    // 3. 시도 기록
    await handleTool(store, "attempt_log", {
      approach: "passport.js 사용",
      result: "partial",
      reason: "OAuth만 필요해서 과도함",
    });

    // 4. 블로커 발생
    await handleTool(store, "blocker_add", {
      description: "리프레시 토큰 저장 위치 미정",
    });

    // 5. 상태 업데이트
    await handleTool(store, "context_save", {
      goal: "사용자 인증 시스템 구현",
      status: "coding",
      nextSteps: ["리프레시 토큰 로직 구현", "로그아웃 API 추가"],
    });

    // 6. 블로커 해결
    const context = await store.getContext();
    const blockerId = context!.conversationSummary.blockers[0].id;
    await handleTool(store, "blocker_resolve", {
      blockerId,
      resolution: "Redis에 저장하기로 결정",
    });

    // 7. 인수인계
    const handoffResult = await handleTool(store, "handoff", {
      to: "cursor",
      summary: "JWT 로그인 구현 완료. 리프레시 토큰은 Redis 사용. 로그아웃 API 필요.",
    });

    expect(handoffResult.content[0].text).toContain("cursor로 인수인계되었습니다");

    // 8. 다른 에이전트에서 컨텍스트 로드
    const loadResult = await handleTool(store, "context_load", { format: "summary" });
    expect(loadResult.content[0].text).toContain("사용자 인증 시스템 구현");
    expect(loadResult.content[0].text).toContain("JWT 토큰 사용");

    // 9. 결정 목록 확인
    const decisionsResult = await handleTool(store, "context_load", { format: "decisions" });
    expect(decisionsResult.content[0].text).toContain("JWT 토큰 사용");
    expect(decisionsResult.content[0].text).toContain("bcrypt");
  });
});
