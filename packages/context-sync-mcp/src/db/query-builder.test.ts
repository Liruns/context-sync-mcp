/**
 * Query Builder Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  QueryBuilder,
  extractKeywords,
  normalizeText,
  createQueryBuilder,
  type SearchQueryOptions,
} from './query-builder.js';
import type { DatabaseInstance } from './index.js';

// Mock hasFts5Support
vi.mock('./index.js', async () => {
  const actual = await vi.importActual('./index.js');
  return {
    ...actual,
    hasFts5Support: vi.fn(),
    buildFtsQuery: (query: string) => {
      const terms = query
        .split(/\s+/)
        .filter(Boolean)
        .map((term) => `"${term.replace(/"/g, '""')}"*`)
        .join(' OR ');
      return terms || '*';
    },
  };
});

import { hasFts5Support } from './index.js';

// Mock DB
function createMockDb(ftsSupported: boolean = false): DatabaseInstance {
  vi.mocked(hasFts5Support).mockReturnValue(ftsSupported);
  return {} as DatabaseInstance;
}

describe('extractKeywords', () => {
  it('should extract words from text', () => {
    const result = extractKeywords('Hello World');
    expect(result).toEqual(['hello', 'world']);
  });

  it('should filter short words (< 2 chars)', () => {
    const result = extractKeywords('I am a test');
    expect(result).toEqual(['am', 'test']);
  });

  it('should handle Korean text', () => {
    const result = extractKeywords('테스트 검색 기능');
    expect(result).toEqual(['테스트', '검색', '기능']);
  });

  it('should remove special characters', () => {
    const result = extractKeywords('hello@world.com test!');
    expect(result).toEqual(['hello', 'world', 'com', 'test']);
  });

  it('should limit results to maxCount', () => {
    const result = extractKeywords('one two three four five six', 3);
    expect(result).toHaveLength(3);
  });

  it('should return empty array for empty string', () => {
    const result = extractKeywords('');
    expect(result).toEqual([]);
  });

  it('should handle mixed Korean and English', () => {
    const result = extractKeywords('MCP 서버 test 구현');
    expect(result).toEqual(['mcp', '서버', 'test', '구현']);
  });
});

describe('normalizeText', () => {
  it('should lowercase text', () => {
    expect(normalizeText('Hello WORLD')).toBe('hello world');
  });

  it('should remove special characters', () => {
    expect(normalizeText('hello@world!')).toBe('hello world');
  });

  it('should collapse multiple spaces', () => {
    expect(normalizeText('hello   world')).toBe('hello world');
  });

  it('should trim whitespace', () => {
    expect(normalizeText('  hello world  ')).toBe('hello world');
  });
});

describe('QueryBuilder', () => {
  describe('useFts', () => {
    it('should cache FTS5 support check', () => {
      const mockDb = createMockDb(true);
      const builder = new QueryBuilder(mockDb);

      // First call
      expect(builder.useFts()).toBe(true);
      // Second call should use cached value
      expect(builder.useFts()).toBe(true);

      // hasFts5Support should only be called once
      expect(hasFts5Support).toHaveBeenCalledTimes(1);
    });
  });

  describe('buildSearchQuery - without FTS', () => {
    let builder: QueryBuilder;

    beforeEach(() => {
      vi.clearAllMocks();
      const mockDb = createMockDb(false);
      builder = new QueryBuilder(mockDb);
    });

    it('should build basic query without search term', () => {
      const result = builder.buildSearchQuery({});

      expect(result.sql).toContain('SELECT id, goal_short, created_at, has_warnings');
      expect(result.sql).toContain('FROM contexts');
      expect(result.sql).toContain('WHERE 1=1');
      expect(result.useFts).toBe(false);
      expect(result.params).toEqual([]);
    });

    it('should build LIKE query with search term', () => {
      const result = builder.buildSearchQuery({ query: 'test' });

      expect(result.sql).toContain('goal LIKE ?');
      expect(result.sql).toContain('summary LIKE ?');
      expect(result.sql).toContain('tags LIKE ?');
      expect(result.useFts).toBe(false);
      expect(result.params).toContain('%test%');
    });

    it('should add status filter', () => {
      const result = builder.buildSearchQuery({ status: 'completed' });

      expect(result.sql).toContain('status = ?');
      expect(result.params).toContain('completed');
    });

    it('should add agent filter', () => {
      const result = builder.buildSearchQuery({ agent: 'claude-code' });

      expect(result.sql).toContain('agent = ?');
      expect(result.params).toContain('claude-code');
    });

    it('should add tags filter', () => {
      const result = builder.buildSearchQuery({ tags: ['tag1', 'tag2'] });

      expect(result.sql).toContain('context_tags');
      expect(result.sql).toContain('tag IN (?, ?)');
      expect(result.params).toContain('tag1');
      expect(result.params).toContain('tag2');
    });

    it('should add date range filter', () => {
      const result = builder.buildSearchQuery({
        dateRange: { from: '2024-01-01', to: '2024-12-31' },
      });

      expect(result.sql).toContain('created_at >= ?');
      expect(result.sql).toContain('created_at <= ?');
      expect(result.params).toContain('2024-01-01');
      expect(result.params).toContain('2024-12-31');
    });

    it('should add limit and offset', () => {
      const result = builder.buildSearchQuery({ limit: 10, offset: 20 });

      expect(result.sql).toContain('LIMIT ?');
      expect(result.sql).toContain('OFFSET ?');
      expect(result.params).toContain(10);
      expect(result.params).toContain(20);
    });

    it('should add ORDER BY clause', () => {
      const result = builder.buildSearchQuery({});

      expect(result.sql).toContain('ORDER BY');
      expect(result.sql).toContain('DESC');
    });
  });

  describe('buildSearchQuery - with FTS', () => {
    let builder: QueryBuilder;

    beforeEach(() => {
      vi.clearAllMocks();
      const mockDb = createMockDb(true);
      builder = new QueryBuilder(mockDb);
    });

    it('should build FTS query with search term', () => {
      const result = builder.buildSearchQuery({ query: 'test' });

      expect(result.sql).toContain('contexts_fts MATCH ?');
      expect(result.sql).toContain('JOIN contexts_fts');
      expect(result.useFts).toBe(true);
    });

    it('should use c.id prefix for FTS queries', () => {
      const result = builder.buildSearchQuery({ query: 'test', status: 'completed' });

      expect(result.sql).toContain('c.id');
      expect(result.sql).toContain('c.goal_short');
    });
  });

  describe('buildRecommendQuery - without FTS', () => {
    let builder: QueryBuilder;

    beforeEach(() => {
      vi.clearAllMocks();
      const mockDb = createMockDb(false);
      builder = new QueryBuilder(mockDb);
    });

    it('should build LIKE query for recommendations', () => {
      const result = builder.buildRecommendQuery({ query: 'test query' });

      expect(result.sql).toContain('goal LIKE ?');
      expect(result.sql).toContain('summary LIKE ?');
      expect(result.useFts).toBe(false);
    });

    it('should return latest contexts when no keywords', () => {
      const result = builder.buildRecommendQuery({ query: '!' });

      expect(result.sql).toContain('ORDER BY created_at DESC');
      expect(result.sql).not.toContain('LIKE');
    });

    it('should respect limit option', () => {
      const result = builder.buildRecommendQuery({ query: 'test', limit: 5 });

      expect(result.sql).toContain('LIMIT ?');
      expect(result.params).toContain(5);
    });
  });

  describe('buildRecommendQuery - with FTS', () => {
    let builder: QueryBuilder;

    beforeEach(() => {
      vi.clearAllMocks();
      const mockDb = createMockDb(true);
      builder = new QueryBuilder(mockDb);
    });

    it('should build FTS query for recommendations', () => {
      const result = builder.buildRecommendQuery({ query: 'test query' });

      expect(result.sql).toContain('contexts_fts MATCH ?');
      expect(result.sql).toContain('ORDER BY rank');
      expect(result.useFts).toBe(true);
    });
  });
});

describe('createQueryBuilder', () => {
  it('should create QueryBuilder instance', () => {
    const mockDb = createMockDb();
    const builder = createQueryBuilder(mockDb);

    expect(builder).toBeInstanceOf(QueryBuilder);
  });
});
