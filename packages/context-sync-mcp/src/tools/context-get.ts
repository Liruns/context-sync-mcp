/**
 * Context Sync MCP v2.2 - context_get Tool
 * 컨텍스트 상세 조회
 * v2.2: 세션 체인 조회를 재귀 CTE로 최적화 (최대 10 쿼리 → 1 쿼리)
 */

import type { DatabaseInstance } from '../db/index.js';
import type {
  ContextGetInput,
  ContextGetOutput,
  ContextDbRecord,
  ContextMetadata,
  ActionRecord,
  WorkStatus,
  AgentType,
} from '../types/context.js';

const DEFAULT_ACTIONS_LIMIT = 10;
const MAX_ACTIONS_LIMIT = 50;

/**
 * 컨텍스트 상세 조회
 * ~500 토큰 응답
 */
export function getContext(
  db: DatabaseInstance,
  input: ContextGetInput
): ContextGetOutput | null {
  const { id, includeActions = true, includeChain = false, actionsLimit = DEFAULT_ACTIONS_LIMIT } = input;

  // 컨텍스트 조회
  const context = db.prepare(`
    SELECT * FROM contexts WHERE id = ?
  `).get(id) as ContextDbRecord | undefined;

  if (!context) {
    return null;
  }

  // 메타데이터 파싱
  let metadata: ContextMetadata;
  try {
    metadata = JSON.parse(context.metadata || '{}');
  } catch {
    metadata = {
      decisions: [],
      approaches: [],
      blockers: [],
    };
  }

  // 태그 파싱
  let tags: string[];
  try {
    tags = JSON.parse(context.tags || '[]');
  } catch {
    tags = [];
  }

  // 액션 로그 조회
  let actions: ActionRecord[] | undefined;
  if (includeActions) {
    const limit = Math.min(actionsLimit, MAX_ACTIONS_LIMIT);
    const actionRows = db.prepare(`
      SELECT id, context_id, type, content, result, file_path, created_at
      FROM actions
      WHERE context_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `).all(id, limit) as Array<{
      id: string;
      context_id: string;
      type: string;
      content: string;
      result: string | null;
      file_path: string | null;
      created_at: string;
    }>;

    actions = actionRows.map((row) => ({
      id: row.id,
      contextId: row.context_id,
      type: row.type as ActionRecord['type'],
      content: row.content,
      result: row.result || undefined,
      filePath: row.file_path || undefined,
      createdAt: row.created_at,
    }));
  }

  // 세션 체인 조회
  let chain: Array<{ id: string; goal: string; createdAt: string }> | undefined;
  if (includeChain) {
    chain = getSessionChain(db, id);
  }

  return {
    context: {
      id: context.id,
      parentId: context.parent_id || undefined,
      goal: context.goal,
      summary: context.summary || undefined,
      status: context.status as WorkStatus,
      tags,
      agent: context.agent as AgentType | undefined,
      metadata,
      startedAt: context.started_at,
      endedAt: context.ended_at || undefined,
      createdAt: context.created_at,
    },
    actions,
    chain,
  };
}

/**
 * 세션 체인 조회 (부모 → 현재 → 자식)
 * v2.2: 재귀 CTE 사용으로 단일 쿼리로 최적화
 */
function getSessionChain(
  db: DatabaseInstance,
  contextId: string
): Array<{ id: string; goal: string; createdAt: string }> {
  // v2.2: 재귀 CTE로 부모 체인 + 현재 + 자식을 단일 쿼리로 조회
  const chainRows = db.prepare(`
    WITH RECURSIVE
    -- 부모 체인 (depth < 0: 부모들)
    parent_chain(id, goal_short, created_at, depth) AS (
      -- Base: 현재 컨텍스트
      SELECT id, goal_short, created_at, 0 as depth
      FROM contexts
      WHERE id = ?

      UNION ALL

      -- Recursive: 부모 찾기
      SELECT c.id, c.goal_short, c.created_at, pc.depth - 1
      FROM contexts c
      JOIN parent_chain pc ON c.id = (
        SELECT parent_id FROM contexts WHERE id = pc.id
      )
      WHERE pc.depth > -10
    ),
    -- 자식들 (depth = 1)
    children AS (
      SELECT id, goal_short, created_at, 1 as depth
      FROM contexts
      WHERE parent_id = ?
    )
    -- 부모 체인 + 자식 통합 (현재 제외 후 depth 0 다시 포함)
    SELECT id, goal_short as goal, created_at as createdAt, depth
    FROM (
      SELECT * FROM parent_chain
      UNION ALL
      SELECT * FROM children
    )
    ORDER BY depth ASC, created_at ASC
  `).all(contextId, contextId) as Array<{
    id: string;
    goal: string | null;
    createdAt: string;
    depth: number;
  }>;

  return chainRows.map((row) => ({
    id: row.id,
    goal: row.goal || '',
    createdAt: row.createdAt,
  }));
}

/**
 * 입력 유효성 검사
 */
export function validateGetInput(input: unknown): ContextGetInput {
  const parsed = input as Record<string, unknown>;

  if (!parsed.id || typeof parsed.id !== 'string') {
    throw new Error('id is required');
  }

  return {
    id: parsed.id,
    includeActions: parsed.includeActions !== false,
    includeChain: parsed.includeChain === true,
    actionsLimit: typeof parsed.actionsLimit === 'number'
      ? Math.min(parsed.actionsLimit, MAX_ACTIONS_LIMIT)
      : DEFAULT_ACTIONS_LIMIT,
  };
}
