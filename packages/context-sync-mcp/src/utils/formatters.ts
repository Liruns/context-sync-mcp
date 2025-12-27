/**
 * Context Sync MCP - Formatters
 * 마크다운 포맷팅 유틸리티
 */

import type { ContextSearchOutput, ContextHint } from '../types/context.js';

/**
 * 검색 결과를 마크다운으로 포맷
 */
export function formatSearchMarkdown(result: ContextSearchOutput): string {
  if (result.hints.length === 0) {
    return '검색 결과가 없습니다.';
  }

  let md = `🔍 **검색 결과** (${result.total}개 중 ${result.hints.length}개)\n\n`;

  for (const hint of result.hints) {
    const warningIcon = hint.hasWarnings ? '⚠️ ' : '';
    md += `- ${warningIcon}**${hint.goal}** (\`${hint.id.slice(0, 8)}\`) - ${hint.date}\n`;
  }

  if (result.hasMore) {
    md += `\n> 더 많은 결과가 있습니다. offset을 조정하세요.`;
  }

  if (result.suggestion) {
    md += `\n\n💡 ${result.suggestion}`;
  }

  return md;
}

/**
 * 힌트 목록을 마크다운으로 포맷
 */
export function formatHintsMarkdown(hints: ContextHint[]): string {
  if (hints.length === 0) {
    return '결과가 없습니다.';
  }

  return hints
    .map((hint) => {
      const warningIcon = hint.hasWarnings ? '⚠️ ' : '';
      return `- ${warningIcon}**${hint.goal}** (\`${hint.id.slice(0, 8)}\`) - ${hint.date}`;
    })
    .join('\n');
}

/**
 * 리스트 아이템을 마크다운으로 포맷
 */
export function formatListItems(
  items: string[],
  options: {
    icon?: string;
    prefix?: string;
    emptyMessage?: string;
  } = {}
): string {
  const { icon = '', prefix = '-', emptyMessage = '없음' } = options;

  if (items.length === 0) {
    return emptyMessage;
  }

  return items.map((item) => `${prefix} ${icon}${item}`).join('\n');
}

/**
 * 키-값 쌍을 마크다운으로 포맷
 */
export function formatKeyValuePairs(
  pairs: Record<string, string | number | undefined>,
  options: {
    prefix?: string;
    separator?: string;
  } = {}
): string {
  const { prefix = '-', separator = ': ' } = options;

  return Object.entries(pairs)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${prefix} **${key}**${separator}${value}`)
    .join('\n');
}

/**
 * 섹션 헤더 생성
 */
export function formatSectionHeader(
  title: string,
  level: 1 | 2 | 3 = 2,
  icon?: string
): string {
  const hashes = '#'.repeat(level);
  const iconPrefix = icon ? `${icon} ` : '';
  return `${hashes} ${iconPrefix}${title}`;
}

/**
 * 날짜 포맷 (간단)
 */
export function formatDateCompact(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    // Invalid Date 체크
    if (isNaN(date.getTime())) {
      return dateStr;
    }
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

/**
 * 숫자를 읽기 쉬운 형식으로 포맷
 */
export function formatNumber(num: number): string {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`;
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`;
  }
  return num.toString();
}

/**
 * 퍼센트 포맷
 */
export function formatPercent(value: number, total: number): string {
  if (total === 0) return '0%';
  return `${Math.round((value / total) * 100)}%`;
}

/**
 * 코드 블록으로 감싸기
 */
export function wrapCodeBlock(content: string, language: string = ''): string {
  return `\`\`\`${language}\n${content}\n\`\`\``;
}

/**
 * 인라인 코드로 감싸기
 */
export function wrapInlineCode(content: string): string {
  return `\`${content}\``;
}
