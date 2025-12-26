/**
 * Context Sync MCP v2.0 - context_get Tool
 * 컨텍스트 상세 조회
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
 */
function getSessionChain(
  db: DatabaseInstance,
  contextId: string
): Array<{ id: string; goal: string; createdAt: string }> {
  const chain: Array<{ id: string; goal: string; createdAt: string }> = [];

  // 부모 체인 조회 (역순)
  let currentId: string | null = contextId;
  const parentChain: Array<{ id: string; goal: string; createdAt: string }> = [];

  while (currentId) {
    const parent = db.prepare(`
      SELECT c.parent_id, p.id, p.goal_short, p.created_at
      FROM contexts c
      LEFT JOIN contexts p ON c.parent_id = p.id
      WHERE c.id = ?
    `).get(currentId) as {
      parent_id: string | null;
      id: string | null;
      goal_short: string | null;
      created_at: string | null;
    } | undefined;

    if (!parent || !parent.parent_id || !parent.id) break;

    parentChain.unshift({
      id: parent.id,
      goal: parent.goal_short || '',
      createdAt: parent.created_at || '',
    });

    currentId = parent.parent_id;

    // 무한 루프 방지
    if (parentChain.length > 10) break;
  }

  chain.push(...parentChain);

  // 현재 컨텍스트
  const current = db.prepare(`
    SELECT id, goal_short, created_at FROM contexts WHERE id = ?
  `).get(contextId) as { id: string; goal_short: string | null; created_at: string } | undefined;

  if (current) {
    chain.push({
      id: current.id,
      goal: current.goal_short || '',
      createdAt: current.created_at,
    });
  }

  // 자식 체인 조회
  const children = db.prepare(`
    SELECT id, goal_short, created_at
    FROM contexts
    WHERE parent_id = ?
    ORDER BY created_at ASC
  `).all(contextId) as Array<{ id: string; goal_short: string | null; created_at: string }>;

  for (const child of children) {
    chain.push({
      id: child.id,
      goal: child.goal_short || '',
      createdAt: child.created_at,
    });
  }

  return chain;
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
