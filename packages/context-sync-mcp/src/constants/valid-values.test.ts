/**
 * Valid Values Constants Tests
 */

import { describe, it, expect } from 'vitest';
import {
  VALID_STATUS,
  VALID_AGENTS,
  VALID_SNAPSHOT_REASONS,
  VALID_ARCHIVE_ACTIONS,
  VALID_EXPORT_FORMATS,
  VALID_COMPRESSION_LEVELS,
  VALID_SYNC_MODES,
  VALID_LOAD_FORMATS,
  VALID_QUERY_TYPES,
  VALID_APPROACH_RESULTS,
  VALID_ACTION_TYPES,
  isValidValue,
} from './valid-values.js';

describe('Valid Value Constants', () => {
  describe('VALID_STATUS', () => {
    it('should contain all status values', () => {
      expect(VALID_STATUS).toContain('planning');
      expect(VALID_STATUS).toContain('coding');
      expect(VALID_STATUS).toContain('testing');
      expect(VALID_STATUS).toContain('reviewing');
      expect(VALID_STATUS).toContain('debugging');
      expect(VALID_STATUS).toContain('completed');
      expect(VALID_STATUS).toContain('paused');
    });

    it('should have 7 status values', () => {
      expect(VALID_STATUS).toHaveLength(7);
    });
  });

  describe('VALID_AGENTS', () => {
    it('should contain all agent types', () => {
      expect(VALID_AGENTS).toContain('claude-code');
      expect(VALID_AGENTS).toContain('cursor');
      expect(VALID_AGENTS).toContain('windsurf');
      expect(VALID_AGENTS).toContain('copilot');
      expect(VALID_AGENTS).toContain('unknown');
    });

    it('should have 5 agent types', () => {
      expect(VALID_AGENTS).toHaveLength(5);
    });
  });

  describe('VALID_SNAPSHOT_REASONS', () => {
    it('should contain all snapshot reasons', () => {
      expect(VALID_SNAPSHOT_REASONS).toContain('auto');
      expect(VALID_SNAPSHOT_REASONS).toContain('manual');
      expect(VALID_SNAPSHOT_REASONS).toContain('handoff');
      expect(VALID_SNAPSHOT_REASONS).toContain('milestone');
    });
  });

  describe('VALID_ARCHIVE_ACTIONS', () => {
    it('should contain all archive actions', () => {
      expect(VALID_ARCHIVE_ACTIONS).toContain('archive');
      expect(VALID_ARCHIVE_ACTIONS).toContain('restore');
      expect(VALID_ARCHIVE_ACTIONS).toContain('stats');
      expect(VALID_ARCHIVE_ACTIONS).toContain('search');
      expect(VALID_ARCHIVE_ACTIONS).toContain('list');
      expect(VALID_ARCHIVE_ACTIONS).toContain('purge');
    });
  });

  describe('VALID_EXPORT_FORMATS', () => {
    it('should contain all export formats', () => {
      expect(VALID_EXPORT_FORMATS).toContain('markdown');
      expect(VALID_EXPORT_FORMATS).toContain('json');
      expect(VALID_EXPORT_FORMATS).toContain('html');
    });

    it('should have 3 formats', () => {
      expect(VALID_EXPORT_FORMATS).toHaveLength(3);
    });
  });

  describe('VALID_COMPRESSION_LEVELS', () => {
    it('should contain all compression levels', () => {
      expect(VALID_COMPRESSION_LEVELS).toContain('none');
      expect(VALID_COMPRESSION_LEVELS).toContain('low');
      expect(VALID_COMPRESSION_LEVELS).toContain('medium');
      expect(VALID_COMPRESSION_LEVELS).toContain('high');
    });
  });

  describe('VALID_SYNC_MODES', () => {
    it('should contain all sync modes', () => {
      expect(VALID_SYNC_MODES).toContain('auto');
      expect(VALID_SYNC_MODES).toContain('manual');
      expect(VALID_SYNC_MODES).toContain('smart');
    });
  });

  describe('VALID_LOAD_FORMATS', () => {
    it('should contain all load formats', () => {
      expect(VALID_LOAD_FORMATS).toContain('full');
      expect(VALID_LOAD_FORMATS).toContain('summary');
      expect(VALID_LOAD_FORMATS).toContain('decisions');
      expect(VALID_LOAD_FORMATS).toContain('blockers');
      expect(VALID_LOAD_FORMATS).toContain('next_steps');
    });
  });

  describe('VALID_QUERY_TYPES', () => {
    it('should contain all query types', () => {
      expect(VALID_QUERY_TYPES).toContain('decisions');
      expect(VALID_QUERY_TYPES).toContain('blockers');
      expect(VALID_QUERY_TYPES).toContain('approaches');
      expect(VALID_QUERY_TYPES).toContain('next_steps');
      expect(VALID_QUERY_TYPES).toContain('agent_chain');
      expect(VALID_QUERY_TYPES).toContain('code_changes');
    });
  });

  describe('VALID_APPROACH_RESULTS', () => {
    it('should contain all approach results', () => {
      expect(VALID_APPROACH_RESULTS).toContain('success');
      expect(VALID_APPROACH_RESULTS).toContain('failed');
      expect(VALID_APPROACH_RESULTS).toContain('partial');
    });
  });

  describe('VALID_ACTION_TYPES', () => {
    it('should contain all action types', () => {
      expect(VALID_ACTION_TYPES).toContain('command');
      expect(VALID_ACTION_TYPES).toContain('edit');
      expect(VALID_ACTION_TYPES).toContain('error');
    });
  });
});

describe('isValidValue', () => {
  it('should return true for valid values', () => {
    expect(isValidValue('planning', VALID_STATUS)).toBe(true);
    expect(isValidValue('claude-code', VALID_AGENTS)).toBe(true);
    expect(isValidValue('markdown', VALID_EXPORT_FORMATS)).toBe(true);
  });

  it('should return false for invalid values', () => {
    expect(isValidValue('invalid', VALID_STATUS)).toBe(false);
    expect(isValidValue('unknown-agent', VALID_AGENTS)).toBe(false);
    expect(isValidValue('pdf', VALID_EXPORT_FORMATS)).toBe(false);
  });

  it('should return false for non-string values', () => {
    expect(isValidValue(123, VALID_STATUS)).toBe(false);
    expect(isValidValue(null, VALID_STATUS)).toBe(false);
    expect(isValidValue(undefined, VALID_STATUS)).toBe(false);
  });

  it('should work with custom arrays', () => {
    const custom = ['x', 'y', 'z'] as const;
    expect(isValidValue('x', custom)).toBe(true);
    expect(isValidValue('a', custom)).toBe(false);
  });
});
