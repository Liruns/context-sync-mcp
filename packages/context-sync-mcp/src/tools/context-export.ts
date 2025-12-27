/**
 * Context Sync MCP v2.2 - context_export 도구
 * 컨텍스트 내보내기 (markdown/json/html)
 * v2.2: N+1 쿼리 → 배치 로딩으로 최적화
 */

import * as fs from 'fs';
import * as path from 'path';
import type { DatabaseInstance } from '../db/index.js';
import { getActionsForContextsBatch } from '../db/index.js';
import type {
  ContextExportInput,
  ContextExportOutput,
  ContextDbRecord,
  ActionRecord,
  ContextMetadata,
} from '../types/index.js';

// 상수
const VALID_FORMATS = ['markdown', 'json', 'html'] as const;

/**
 * 입력 검증
 */
export function validateExportInput(input: unknown): ContextExportInput {
  const parsed = input as Record<string, unknown>;

  // format 필수
  if (!parsed.format || typeof parsed.format !== 'string') {
    throw new Error('format is required (markdown, json, or html)');
  }

  if (!VALID_FORMATS.includes(parsed.format as typeof VALID_FORMATS[number])) {
    throw new Error(`Invalid format: ${parsed.format}. Use markdown, json, or html.`);
  }

  const result: ContextExportInput = {
    format: parsed.format as ContextExportInput['format'],
  };

  // range
  if (parsed.range && typeof parsed.range === 'object') {
    const range = parsed.range as Record<string, unknown>;
    result.range = {
      from: typeof range.from === 'string' ? range.from : undefined,
      to: typeof range.to === 'string' ? range.to : undefined,
    };
  }

  // contextIds
  if (Array.isArray(parsed.contextIds)) {
    result.contextIds = parsed.contextIds.filter(
      (id): id is string => typeof id === 'string'
    );
  }

  // output
  if (typeof parsed.output === 'string') {
    result.output = parsed.output;
  }

  return result;
}

/**
 * 컨텍스트 조회
 */
function getContextsToExport(
  db: DatabaseInstance,
  input: ContextExportInput
): ContextDbRecord[] {
  let query = 'SELECT * FROM contexts WHERE 1=1';
  const params: unknown[] = [];

  // contextIds 필터
  if (input.contextIds && input.contextIds.length > 0) {
    const placeholders = input.contextIds.map(() => '?').join(', ');
    query += ` AND id IN (${placeholders})`;
    params.push(...input.contextIds);
  }

  // range 필터
  if (input.range?.from) {
    query += ' AND created_at >= ?';
    params.push(input.range.from);
  }
  if (input.range?.to) {
    query += ' AND created_at <= ?';
    params.push(input.range.to);
  }

  query += ' ORDER BY created_at DESC';

  return db.prepare(query).all(...params) as ContextDbRecord[];
}

/**
 * 마크다운 포맷
 * v2.2: actionsMap 사용 (N+1 쿼리 방지)
 */
function formatMarkdown(
  contexts: ContextDbRecord[],
  actionsMap: Map<string, ActionRecord[]>
): string {
  let md = `# Context Export\n\n`;
  md += `*Exported ${contexts.length} context(s) at ${new Date().toISOString()}*\n\n`;
  md += `---\n\n`;

  for (const ctx of contexts) {
    const metadata = JSON.parse(ctx.metadata || '{}') as ContextMetadata;
    const actions = actionsMap.get(ctx.id) || [];

    md += `## ${ctx.goal}\n\n`;
    md += `| Field | Value |\n`;
    md += `|-------|-------|\n`;
    md += `| **ID** | \`${ctx.id}\` |\n`;
    md += `| **Status** | ${ctx.status} |\n`;
    md += `| **Agent** | ${ctx.agent || 'unknown'} |\n`;
    md += `| **Started** | ${ctx.started_at} |\n`;
    if (ctx.ended_at) {
      md += `| **Ended** | ${ctx.ended_at} |\n`;
    }
    md += `\n`;

    // Summary
    if (ctx.summary) {
      md += `### Summary\n${ctx.summary}\n\n`;
    }

    // Tags
    try {
      const tags = JSON.parse(ctx.tags || '[]') as string[];
      if (tags.length > 0) {
        md += `### Tags\n${tags.map((t) => `\`${t}\``).join(' ')}\n\n`;
      }
    } catch {
      // ignore
    }

    // Decisions
    if (metadata.decisions && metadata.decisions.length > 0) {
      md += `### Decisions\n`;
      for (const d of metadata.decisions) {
        md += `- **${d.what}**: ${d.why}\n`;
      }
      md += `\n`;
    }

    // Approaches
    if (metadata.approaches && metadata.approaches.length > 0) {
      md += `### Approaches\n`;
      for (const a of metadata.approaches) {
        const icon = a.result === 'success' ? '✅' : a.result === 'failed' ? '❌' : '⚠️';
        md += `- ${icon} ${a.description}`;
        if (a.reason) {
          md += ` (${a.reason})`;
        }
        md += `\n`;
      }
      md += `\n`;
    }

    // Blockers
    if (metadata.blockers && metadata.blockers.length > 0) {
      md += `### Blockers\n`;
      for (const b of metadata.blockers) {
        const icon = b.resolved ? '✅' : '🚧';
        md += `- ${icon} ${b.description}`;
        if (b.resolution) {
          md += ` → ${b.resolution}`;
        }
        md += `\n`;
      }
      md += `\n`;
    }

    // Actions
    if (actions.length > 0) {
      md += `### Actions (${actions.length})\n`;
      for (const a of actions.slice(0, 20)) {
        md += `- [${a.type}] ${a.content.slice(0, 100)}${a.content.length > 100 ? '...' : ''}\n`;
      }
      if (actions.length > 20) {
        md += `- ... and ${actions.length - 20} more\n`;
      }
      md += `\n`;
    }

    md += `---\n\n`;
  }

  return md;
}

/**
 * JSON 포맷
 * v2.2: actionsMap 사용 (N+1 쿼리 방지)
 */
function formatJSON(
  contexts: ContextDbRecord[],
  actionsMap: Map<string, ActionRecord[]>
): string {
  const exportData = contexts.map((ctx) => {
    const metadata = JSON.parse(ctx.metadata || '{}') as ContextMetadata;
    const tags = JSON.parse(ctx.tags || '[]') as string[];
    const actions = actionsMap.get(ctx.id) || [];

    return {
      id: ctx.id,
      parentId: ctx.parent_id,
      goal: ctx.goal,
      summary: ctx.summary,
      status: ctx.status,
      agent: ctx.agent,
      tags,
      metadata,
      actions: actions.map((a) => ({
        type: a.type,
        content: a.content,
        result: a.result,
        filePath: a.filePath,
        createdAt: a.createdAt,
      })),
      startedAt: ctx.started_at,
      endedAt: ctx.ended_at,
      createdAt: ctx.created_at,
    };
  });

  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      count: contexts.length,
      contexts: exportData,
    },
    null,
    2
  );
}

/**
 * HTML 포맷
 * v2.2: actionsMap 사용 (N+1 쿼리 방지)
 */
function formatHTML(
  contexts: ContextDbRecord[],
  actionsMap: Map<string, ActionRecord[]>
): string {
  let html = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Context Export</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 900px; margin: 0 auto; padding: 20px; background: #f5f5f5; }
    .context { background: white; border-radius: 8px; padding: 20px; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .context h2 { margin-top: 0; color: #333; }
    .meta { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px; margin-bottom: 15px; }
    .meta-item { background: #f0f0f0; padding: 8px 12px; border-radius: 4px; }
    .meta-item label { font-weight: bold; color: #666; font-size: 0.85em; }
    .meta-item span { display: block; color: #333; }
    .section { margin-top: 15px; }
    .section h3 { color: #555; border-bottom: 1px solid #eee; padding-bottom: 5px; }
    .tag { display: inline-block; background: #e0e0e0; padding: 2px 8px; border-radius: 12px; font-size: 0.85em; margin-right: 5px; }
    .decision, .approach, .blocker { padding: 8px; margin: 5px 0; border-left: 3px solid #ddd; background: #fafafa; }
    .success { border-left-color: #4caf50; }
    .failed { border-left-color: #f44336; }
    .partial { border-left-color: #ff9800; }
    .resolved { border-left-color: #4caf50; }
    .unresolved { border-left-color: #f44336; }
    .action { font-family: monospace; font-size: 0.9em; padding: 4px 8px; background: #f5f5f5; margin: 2px 0; border-radius: 3px; }
    .action-type { color: #666; }
  </style>
</head>
<body>
  <h1>Context Export</h1>
  <p><em>Exported ${contexts.length} context(s) at ${new Date().toLocaleString('ko-KR')}</em></p>
`;

  for (const ctx of contexts) {
    const metadata = JSON.parse(ctx.metadata || '{}') as ContextMetadata;
    const tags = JSON.parse(ctx.tags || '[]') as string[];
    const actions = actionsMap.get(ctx.id) || [];

    html += `
  <div class="context">
    <h2>${escapeHtml(ctx.goal)}</h2>
    <div class="meta">
      <div class="meta-item"><label>ID</label><span>${ctx.id}</span></div>
      <div class="meta-item"><label>Status</label><span>${ctx.status}</span></div>
      <div class="meta-item"><label>Agent</label><span>${ctx.agent || 'unknown'}</span></div>
      <div class="meta-item"><label>Started</label><span>${ctx.started_at}</span></div>
    </div>
`;

    if (ctx.summary) {
      html += `<div class="section"><h3>Summary</h3><p>${escapeHtml(ctx.summary)}</p></div>`;
    }

    if (tags.length > 0) {
      html += `<div class="section"><h3>Tags</h3>${tags.map((t) => `<span class="tag">${escapeHtml(t)}</span>`).join('')}</div>`;
    }

    if (metadata.decisions && metadata.decisions.length > 0) {
      html += `<div class="section"><h3>Decisions</h3>`;
      for (const d of metadata.decisions) {
        html += `<div class="decision"><strong>${escapeHtml(d.what)}</strong>: ${escapeHtml(d.why)}</div>`;
      }
      html += `</div>`;
    }

    if (metadata.approaches && metadata.approaches.length > 0) {
      html += `<div class="section"><h3>Approaches</h3>`;
      for (const a of metadata.approaches) {
        html += `<div class="approach ${a.result}">${escapeHtml(a.description)}${a.reason ? ` (${escapeHtml(a.reason)})` : ''}</div>`;
      }
      html += `</div>`;
    }

    if (metadata.blockers && metadata.blockers.length > 0) {
      html += `<div class="section"><h3>Blockers</h3>`;
      for (const b of metadata.blockers) {
        html += `<div class="blocker ${b.resolved ? 'resolved' : 'unresolved'}">${escapeHtml(b.description)}${b.resolution ? ` → ${escapeHtml(b.resolution)}` : ''}</div>`;
      }
      html += `</div>`;
    }

    if (actions.length > 0) {
      html += `<div class="section"><h3>Actions (${actions.length})</h3>`;
      for (const a of actions.slice(0, 20)) {
        html += `<div class="action"><span class="action-type">[${a.type}]</span> ${escapeHtml(a.content.slice(0, 100))}${a.content.length > 100 ? '...' : ''}</div>`;
      }
      if (actions.length > 20) {
        html += `<div class="action">... and ${actions.length - 20} more</div>`;
      }
      html += `</div>`;
    }

    html += `</div>`;
  }

  html += `</body></html>`;
  return html;
}

/**
 * HTML 이스케이프
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * 컨텍스트 내보내기
 * v2.2: 배치 로딩으로 N+1 쿼리 방지 (100 컨텍스트 = 2 쿼리)
 */
export function exportContexts(
  db: DatabaseInstance,
  input: ContextExportInput
): ContextExportOutput {
  const contexts = getContextsToExport(db, input);

  if (contexts.length === 0) {
    return {
      content: 'No contexts found to export.',
      exportedCount: 0,
    };
  }

  // v2.2: 배치로 모든 액션 로드 (N+1 → 1 쿼리)
  const contextIds = contexts.map((c) => c.id);
  const actionsMap = getActionsForContextsBatch(db, contextIds) as Map<string, ActionRecord[]>;

  let content: string;
  switch (input.format) {
    case 'markdown':
      content = formatMarkdown(contexts, actionsMap);
      break;
    case 'json':
      content = formatJSON(contexts, actionsMap);
      break;
    case 'html':
      content = formatHTML(contexts, actionsMap);
      break;
    default:
      throw new Error(`Unknown format: ${input.format}`);
  }

  // 파일 저장
  if (input.output) {
    const outputPath = path.resolve(input.output);
    const dir = path.dirname(outputPath);

    // 디렉토리 생성
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(outputPath, content, 'utf-8');

    return {
      filePath: outputPath,
      exportedCount: contexts.length,
    };
  }

  return {
    content,
    exportedCount: contexts.length,
  };
}
