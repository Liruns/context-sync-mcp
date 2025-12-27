/**
 * Formatters Tests
 */

import { describe, it, expect } from 'vitest';
import {
  formatSearchMarkdown,
  formatHintsMarkdown,
  formatListItems,
  formatKeyValuePairs,
  formatSectionHeader,
  formatDateCompact,
  formatNumber,
  formatPercent,
  wrapCodeBlock,
  wrapInlineCode,
} from './formatters.js';
import type { ContextSearchOutput, ContextHint } from '../types/context.js';

describe('formatSearchMarkdown', () => {
  it('should format search results', () => {
    const result: ContextSearchOutput = {
      hints: [
        { id: '12345678-abcd', goal: 'Test Goal', date: '2024-01-01', hasWarnings: false },
      ],
      total: 1,
      hasMore: false,
    };

    const md = formatSearchMarkdown(result);

    expect(md).toContain('🔍 **검색 결과**');
    expect(md).toContain('Test Goal');
    expect(md).toContain('`12345678`');
  });

  it('should show warning icon for items with warnings', () => {
    const result: ContextSearchOutput = {
      hints: [
        { id: '12345678-abcd', goal: 'Warning Goal', date: '2024-01-01', hasWarnings: true },
      ],
      total: 1,
      hasMore: false,
    };

    const md = formatSearchMarkdown(result);
    expect(md).toContain('⚠️');
  });

  it('should show message when no results', () => {
    const result: ContextSearchOutput = {
      hints: [],
      total: 0,
      hasMore: false,
    };

    const md = formatSearchMarkdown(result);
    expect(md).toBe('검색 결과가 없습니다.');
  });

  it('should show hasMore message', () => {
    const result: ContextSearchOutput = {
      hints: [
        { id: '12345678-abcd', goal: 'Test', date: '2024-01-01', hasWarnings: false },
      ],
      total: 10,
      hasMore: true,
    };

    const md = formatSearchMarkdown(result);
    expect(md).toContain('더 많은 결과가 있습니다');
  });

  it('should show suggestion if provided', () => {
    const result: ContextSearchOutput = {
      hints: [
        { id: '12345678-abcd', goal: 'Test', date: '2024-01-01', hasWarnings: false },
      ],
      total: 1,
      hasMore: false,
      suggestion: '관련 기록 참고',
    };

    const md = formatSearchMarkdown(result);
    expect(md).toContain('💡 관련 기록 참고');
  });
});

describe('formatHintsMarkdown', () => {
  it('should format hints list', () => {
    const hints: ContextHint[] = [
      { id: 'abc12345', goal: 'Goal 1', date: '2024-01-01', hasWarnings: false },
      { id: 'def67890', goal: 'Goal 2', date: '2024-01-02', hasWarnings: true },
    ];

    const md = formatHintsMarkdown(hints);

    expect(md).toContain('Goal 1');
    expect(md).toContain('Goal 2');
    expect(md).toContain('⚠️');
  });

  it('should return empty message for empty list', () => {
    const md = formatHintsMarkdown([]);
    expect(md).toBe('결과가 없습니다.');
  });
});

describe('formatListItems', () => {
  it('should format items with default options', () => {
    const items = ['Item 1', 'Item 2', 'Item 3'];
    const result = formatListItems(items);

    expect(result).toBe('- Item 1\n- Item 2\n- Item 3');
  });

  it('should format items with custom icon', () => {
    const items = ['Item 1', 'Item 2'];
    const result = formatListItems(items, { icon: '✓ ' });

    expect(result).toBe('- ✓ Item 1\n- ✓ Item 2');
  });

  it('should format items with custom prefix', () => {
    const items = ['Item 1', 'Item 2'];
    const result = formatListItems(items, { prefix: '*' });

    expect(result).toBe('* Item 1\n* Item 2');
  });

  it('should return empty message for empty list', () => {
    const result = formatListItems([]);
    expect(result).toBe('없음');
  });

  it('should return custom empty message', () => {
    const result = formatListItems([], { emptyMessage: 'No items' });
    expect(result).toBe('No items');
  });
});

describe('formatKeyValuePairs', () => {
  it('should format key-value pairs', () => {
    const pairs = { Name: 'Test', Count: 5 };
    const result = formatKeyValuePairs(pairs);

    expect(result).toContain('**Name**');
    expect(result).toContain('Test');
    expect(result).toContain('**Count**');
    expect(result).toContain('5');
  });

  it('should skip undefined values', () => {
    const pairs = { Name: 'Test', Missing: undefined };
    const result = formatKeyValuePairs(pairs);

    expect(result).toContain('Name');
    expect(result).not.toContain('Missing');
  });

  it('should use custom separator', () => {
    const pairs = { Key: 'Value' };
    const result = formatKeyValuePairs(pairs, { separator: ' = ' });

    expect(result).toContain('**Key** = Value');
  });
});

describe('formatSectionHeader', () => {
  it('should create h2 by default', () => {
    const result = formatSectionHeader('Title');
    expect(result).toBe('## Title');
  });

  it('should create h1', () => {
    const result = formatSectionHeader('Title', 1);
    expect(result).toBe('# Title');
  });

  it('should create h3', () => {
    const result = formatSectionHeader('Title', 3);
    expect(result).toBe('### Title');
  });

  it('should include icon', () => {
    const result = formatSectionHeader('Title', 2, '📊');
    expect(result).toBe('## 📊 Title');
  });
});

describe('formatDateCompact', () => {
  it('should format date string', () => {
    const result = formatDateCompact('2024-01-15T10:30:00Z');
    expect(result).toMatch(/2024.*01.*15/);
  });

  it('should return original string on error', () => {
    const result = formatDateCompact('invalid-date');
    expect(result).toBe('invalid-date');
  });
});

describe('formatNumber', () => {
  it('should format small numbers as is', () => {
    expect(formatNumber(123)).toBe('123');
  });

  it('should format thousands with K', () => {
    expect(formatNumber(1500)).toBe('1.5K');
  });

  it('should format millions with M', () => {
    expect(formatNumber(2500000)).toBe('2.5M');
  });
});

describe('formatPercent', () => {
  it('should calculate percentage', () => {
    expect(formatPercent(25, 100)).toBe('25%');
  });

  it('should return 0% when total is 0', () => {
    expect(formatPercent(10, 0)).toBe('0%');
  });

  it('should round to nearest integer', () => {
    expect(formatPercent(1, 3)).toBe('33%');
  });
});

describe('wrapCodeBlock', () => {
  it('should wrap content in code block', () => {
    const result = wrapCodeBlock('const x = 1;', 'typescript');
    expect(result).toBe('```typescript\nconst x = 1;\n```');
  });

  it('should work without language', () => {
    const result = wrapCodeBlock('text');
    expect(result).toBe('```\ntext\n```');
  });
});

describe('wrapInlineCode', () => {
  it('should wrap content in inline code', () => {
    const result = wrapInlineCode('variable');
    expect(result).toBe('`variable`');
  });
});
