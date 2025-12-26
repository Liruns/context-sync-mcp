/**
 * Context Sync MCP v2.0 - Migration Tool
 * JSON 데이터를 SQLite로 자동 마이그레이션
 */

import * as fs from 'fs';
import * as path from 'path';
import type { DatabaseInstance } from './index.js';
import { generateGoalShort, generateSummaryShort, hasWarnings } from '../utils/truncate.js';
import type { SharedContext, ContextSnapshot } from '../types/context.js';

/**
 * 마이그레이션 결과
 */
export interface MigrationResult {
  success: boolean;
  contextsImported: number;
  snapshotsImported: number;
  errors: string[];
}

/**
 * JSON 데이터를 SQLite로 마이그레이션
 */
export function migrateFromJSON(
  db: DatabaseInstance,
  storePath: string
): MigrationResult {
  const result: MigrationResult = {
    success: true,
    contextsImported: 0,
    snapshotsImported: 0,
    errors: [],
  };

  try {
    // 이미 마이그레이션되었는지 확인
    const existingCount = (
      db.prepare('SELECT COUNT(*) as count FROM contexts').get() as { count: number }
    ).count;

    if (existingCount > 0) {
      // 이미 데이터가 있으면 스킵
      return result;
    }

    // 1. current.json 마이그레이션
    const currentPath = path.join(storePath, 'current.json');
    if (fs.existsSync(currentPath)) {
      try {
        const data = fs.readFileSync(currentPath, 'utf-8');
        const context = JSON.parse(data) as SharedContext;
        importContext(db, context, storePath);
        result.contextsImported++;
      } catch (err) {
        result.errors.push(`current.json 마이그레이션 실패: ${err}`);
      }
    }

    // 2. snapshots 마이그레이션
    const snapshotsPath = path.join(storePath, 'snapshots');
    if (fs.existsSync(snapshotsPath)) {
      const files = fs.readdirSync(snapshotsPath).filter((f) => f.endsWith('.json'));

      for (const file of files) {
        try {
          const filePath = path.join(snapshotsPath, file);
          const data = fs.readFileSync(filePath, 'utf-8');
          const snapshot = JSON.parse(data) as ContextSnapshot;

          // 스냅샷의 컨텍스트도 가져오기
          if (snapshot.data) {
            importContext(db, snapshot.data, storePath, snapshot.id);
            result.snapshotsImported++;
          }
        } catch (err) {
          result.errors.push(`${file} 마이그레이션 실패: ${err}`);
        }
      }
    }

    result.success = result.errors.length === 0;
  } catch (err) {
    result.success = false;
    result.errors.push(`마이그레이션 중 오류: ${err}`);
  }

  return result;
}

/**
 * 단일 컨텍스트를 DB에 임포트
 */
function importContext(
  db: DatabaseInstance,
  context: SharedContext,
  storePath: string,
  snapshotId?: string
): void {
  const id = snapshotId || context.id || generateUUID();
  const now = new Date().toISOString();

  // 메타데이터 구성
  const metadata = {
    decisions: (context.conversationSummary?.keyDecisions || []).map((d) => ({
      what: d.what,
      why: d.why,
      madeBy: d.madeBy || 'unknown',
      timestamp: d.timestamp?.toISOString?.() || now,
    })),
    approaches: (context.conversationSummary?.triedApproaches || []).map((a) => ({
      description: a.description,
      result: a.result,
      reason: a.reason,
      timestamp: a.timestamp?.toISOString?.() || now,
    })),
    blockers: (context.conversationSummary?.blockers || []).map((b) => ({
      description: b.description,
      resolved: b.resolved,
      resolution: b.resolution,
      discoveredAt: b.discoveredAt?.toISOString?.() || now,
      resolvedAt: b.resolvedAt?.toISOString?.(),
    })),
    codeChanges: context.codeChanges ? {
      modifiedFiles: context.codeChanges.modifiedFiles || [],
      summary: context.codeChanges.summary || '',
    } : undefined,
    nextSteps: context.conversationSummary?.nextSteps || [],
  };

  const goal = context.currentWork?.goal || 'Imported context';
  const summary = ''; // 기존 데이터에는 summary가 없을 수 있음

  // 짧은 버전 생성
  const goalShort = generateGoalShort(goal);
  const summaryShort = generateSummaryShort(summary);
  const hasWarningsFlag = hasWarnings({
    approaches: metadata.approaches,
    blockers: metadata.blockers,
  });

  // 중복 확인
  const existing = db.prepare('SELECT id FROM contexts WHERE id = ?').get(id);
  if (existing) {
    return; // 이미 존재하면 스킵
  }

  // INSERT
  db.prepare(`
    INSERT INTO contexts (
      id, parent_id, goal, goal_short, summary, summary_short,
      status, tags, agent, metadata, has_warnings, project_path,
      started_at, ended_at, created_at, updated_at, version
    ) VALUES (
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?
    )
  `).run(
    id,
    null, // parent_id
    goal,
    goalShort,
    summary,
    summaryShort,
    context.currentWork?.status || 'completed',
    JSON.stringify([]), // tags
    context.agentChain?.[0]?.to || 'unknown',
    JSON.stringify(metadata),
    hasWarningsFlag ? 1 : 0,
    context.projectPath || storePath,
    context.currentWork?.startedAt?.toISOString?.() || now,
    null, // ended_at
    context.createdAt?.toISOString?.() || now,
    context.updatedAt?.toISOString?.() || now,
    context.version || 1
  );
}

/**
 * UUID 생성 (crypto 없이)
 */
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * 마이그레이션 필요 여부 확인
 */
export function needsMigration(
  db: DatabaseInstance,
  storePath: string
): boolean {
  // DB에 데이터가 없고, JSON 파일이 있으면 마이그레이션 필요
  const dbCount = (
    db.prepare('SELECT COUNT(*) as count FROM contexts').get() as { count: number }
  ).count;

  if (dbCount > 0) {
    return false;
  }

  const currentPath = path.join(storePath, 'current.json');
  const snapshotsPath = path.join(storePath, 'snapshots');

  return (
    fs.existsSync(currentPath) ||
    (fs.existsSync(snapshotsPath) && fs.readdirSync(snapshotsPath).length > 0)
  );
}
