/**
 * Limits Constants Tests
 */

import { describe, it, expect } from 'vitest';
import {
  SEARCH_LIMITS,
  ACTION_LIMITS,
  WARN_LIMITS,
  RECOMMEND_LIMITS,
  CONFIG_LIMITS,
  clampLimit,
} from './limits.js';

describe('Limit Constants', () => {
  describe('SEARCH_LIMITS', () => {
    it('should have correct values', () => {
      expect(SEARCH_LIMITS.DEFAULT_LIMIT).toBe(5);
      expect(SEARCH_LIMITS.MAX_LIMIT).toBe(20);
      expect(SEARCH_LIMITS.MIN_LIMIT).toBe(1);
    });
  });

  describe('ACTION_LIMITS', () => {
    it('should have correct values', () => {
      expect(ACTION_LIMITS.DEFAULT_LIMIT).toBe(10);
      expect(ACTION_LIMITS.MAX_LIMIT).toBe(50);
    });
  });

  describe('WARN_LIMITS', () => {
    it('should have correct values', () => {
      expect(WARN_LIMITS.DEFAULT_LIMIT).toBe(3);
      expect(WARN_LIMITS.MAX_LIMIT).toBe(5);
      expect(WARN_LIMITS.FAILURE_PATTERN_LIMIT).toBe(10);
      expect(WARN_LIMITS.MIN_FAILURE_COUNT).toBe(2);
    });
  });

  describe('RECOMMEND_LIMITS', () => {
    it('should have correct values', () => {
      expect(RECOMMEND_LIMITS.DEFAULT_LIMIT).toBe(5);
      expect(RECOMMEND_LIMITS.MAX_LIMIT).toBe(10);
      expect(RECOMMEND_LIMITS.SEARCH_LIMIT).toBe(20);
    });
  });

  describe('CONFIG_LIMITS', () => {
    it('should have correct idle minute limits', () => {
      expect(CONFIG_LIMITS.MIN_IDLE_MINUTES).toBe(1);
      expect(CONFIG_LIMITS.MAX_IDLE_MINUTES).toBe(60);
    });

    it('should have correct snapshot limits', () => {
      expect(CONFIG_LIMITS.MIN_MAX_SNAPSHOTS).toBe(1);
      expect(CONFIG_LIMITS.MAX_MAX_SNAPSHOTS).toBe(1000);
    });
  });
});

describe('clampLimit', () => {
  const defaultLimit = 5;
  const maxLimit = 20;

  it('should return default when undefined', () => {
    expect(clampLimit(undefined, defaultLimit, maxLimit)).toBe(5);
  });

  it('should return value when within range', () => {
    expect(clampLimit(10, defaultLimit, maxLimit)).toBe(10);
  });

  it('should clamp to 1 when below minimum', () => {
    expect(clampLimit(0, defaultLimit, maxLimit)).toBe(1);
    expect(clampLimit(-5, defaultLimit, maxLimit)).toBe(1);
  });

  it('should clamp to max when above maximum', () => {
    expect(clampLimit(100, defaultLimit, maxLimit)).toBe(20);
    expect(clampLimit(999, defaultLimit, maxLimit)).toBe(20);
  });

  it('should work with different limit values', () => {
    expect(clampLimit(50, 10, 100)).toBe(50);
    expect(clampLimit(150, 10, 100)).toBe(100);
    expect(clampLimit(undefined, 10, 100)).toBe(10);
  });
});
