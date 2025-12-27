/**
 * Common Validators Tests
 */

import { describe, it, expect } from 'vitest';
import {
  isString,
  isNonEmptyString,
  isNumber,
  isInteger,
  isPositiveInteger,
  isBoolean,
  isArray,
  isNonEmptyArray,
  isObject,
  validateRequiredString,
  validateRequiredFields,
  validateOptionalInteger,
  validateNumberInRange,
  validateEnum,
  validateOptionalEnum,
  safeDate,
  safeArray,
  parseArgs,
} from './common.js';

describe('Type Validators', () => {
  describe('isString', () => {
    it('should return true for strings', () => {
      expect(isString('')).toBe(true);
      expect(isString('hello')).toBe(true);
    });

    it('should return false for non-strings', () => {
      expect(isString(123)).toBe(false);
      expect(isString(null)).toBe(false);
      expect(isString(undefined)).toBe(false);
      expect(isString({})).toBe(false);
    });
  });

  describe('isNonEmptyString', () => {
    it('should return true for non-empty strings', () => {
      expect(isNonEmptyString('hello')).toBe(true);
      expect(isNonEmptyString('  hello  ')).toBe(true);
    });

    it('should return false for empty strings or whitespace', () => {
      expect(isNonEmptyString('')).toBe(false);
      expect(isNonEmptyString('   ')).toBe(false);
    });

    it('should return false for non-strings', () => {
      expect(isNonEmptyString(123)).toBe(false);
      expect(isNonEmptyString(null)).toBe(false);
    });
  });

  describe('isNumber', () => {
    it('should return true for numbers', () => {
      expect(isNumber(0)).toBe(true);
      expect(isNumber(123)).toBe(true);
      expect(isNumber(-456)).toBe(true);
      expect(isNumber(1.5)).toBe(true);
    });

    it('should return false for NaN', () => {
      expect(isNumber(NaN)).toBe(false);
    });

    it('should return false for non-numbers', () => {
      expect(isNumber('123')).toBe(false);
      expect(isNumber(null)).toBe(false);
    });
  });

  describe('isInteger', () => {
    it('should return true for integers', () => {
      expect(isInteger(0)).toBe(true);
      expect(isInteger(123)).toBe(true);
      expect(isInteger(-456)).toBe(true);
    });

    it('should return false for floats', () => {
      expect(isInteger(1.5)).toBe(false);
      expect(isInteger(0.1)).toBe(false);
    });
  });

  describe('isPositiveInteger', () => {
    it('should return true for positive integers', () => {
      expect(isPositiveInteger(1)).toBe(true);
      expect(isPositiveInteger(100)).toBe(true);
    });

    it('should return false for zero and negative', () => {
      expect(isPositiveInteger(0)).toBe(false);
      expect(isPositiveInteger(-1)).toBe(false);
    });
  });

  describe('isBoolean', () => {
    it('should return true for booleans', () => {
      expect(isBoolean(true)).toBe(true);
      expect(isBoolean(false)).toBe(true);
    });

    it('should return false for non-booleans', () => {
      expect(isBoolean(0)).toBe(false);
      expect(isBoolean('true')).toBe(false);
    });
  });

  describe('isArray', () => {
    it('should return true for arrays', () => {
      expect(isArray([])).toBe(true);
      expect(isArray([1, 2, 3])).toBe(true);
    });

    it('should return false for non-arrays', () => {
      expect(isArray({})).toBe(false);
      expect(isArray('array')).toBe(false);
    });
  });

  describe('isNonEmptyArray', () => {
    it('should return true for non-empty arrays', () => {
      expect(isNonEmptyArray([1])).toBe(true);
      expect(isNonEmptyArray([1, 2, 3])).toBe(true);
    });

    it('should return false for empty arrays', () => {
      expect(isNonEmptyArray([])).toBe(false);
    });
  });

  describe('isObject', () => {
    it('should return true for objects', () => {
      expect(isObject({})).toBe(true);
      expect(isObject({ a: 1 })).toBe(true);
    });

    it('should return false for null and arrays', () => {
      expect(isObject(null)).toBe(false);
      expect(isObject([])).toBe(false);
    });
  });
});

describe('Field Validators', () => {
  describe('validateRequiredString', () => {
    it('should pass for valid strings', () => {
      expect(validateRequiredString({ name: 'test' }, 'name')).toEqual({ valid: true });
    });

    it('should fail for missing or empty', () => {
      expect(validateRequiredString({}, 'name').valid).toBe(false);
      expect(validateRequiredString({ name: '' }, 'name').valid).toBe(false);
      expect(validateRequiredString({ name: '   ' }, 'name').valid).toBe(false);
    });
  });

  describe('validateRequiredFields', () => {
    it('should pass when all fields present', () => {
      const result = validateRequiredFields({ a: 1, b: 2 }, ['a', 'b']);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail for missing fields', () => {
      const result = validateRequiredFields({ a: 1 }, ['a', 'b']);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('validateOptionalInteger', () => {
    it('should pass for undefined', () => {
      expect(validateOptionalInteger({}, 'count')).toEqual({ valid: true });
    });

    it('should pass for integers', () => {
      expect(validateOptionalInteger({ count: 5 }, 'count')).toEqual({ valid: true });
    });

    it('should fail for non-integers', () => {
      expect(validateOptionalInteger({ count: 1.5 }, 'count').valid).toBe(false);
    });
  });

  describe('validateNumberInRange', () => {
    it('should pass for values in range', () => {
      expect(validateNumberInRange(5, 'count', 1, 10)).toEqual({ valid: true });
    });

    it('should fail for values below min', () => {
      const result = validateNumberInRange(0, 'count', 1, 10);
      expect(result.valid).toBe(false);
    });

    it('should warn for values above max', () => {
      const result = validateNumberInRange(15, 'count', 1, 10);
      expect(result.valid).toBe(true);
      expect(result.warning).toBeDefined();
    });
  });
});

describe('Enum Validators', () => {
  const VALID_VALUES = ['a', 'b', 'c'] as const;

  describe('validateEnum', () => {
    it('should pass for valid values', () => {
      expect(validateEnum('a', 'field', VALID_VALUES)).toEqual({ valid: true });
    });

    it('should fail for invalid values', () => {
      expect(validateEnum('x', 'field', VALID_VALUES).valid).toBe(false);
    });

    it('should fail for non-strings', () => {
      expect(validateEnum(123, 'field', VALID_VALUES).valid).toBe(false);
    });
  });

  describe('validateOptionalEnum', () => {
    it('should pass for undefined', () => {
      expect(validateOptionalEnum(undefined, 'field', VALID_VALUES)).toEqual({ valid: true });
    });

    it('should validate when present', () => {
      expect(validateOptionalEnum('a', 'field', VALID_VALUES)).toEqual({ valid: true });
      expect(validateOptionalEnum('x', 'field', VALID_VALUES).valid).toBe(false);
    });
  });
});

describe('Utility Functions', () => {
  describe('safeDate', () => {
    it('should return Date for valid inputs', () => {
      const date = new Date('2024-01-01');
      expect(safeDate(date)).toEqual(date);
      expect(safeDate('2024-01-01')).toBeInstanceOf(Date);
      expect(safeDate(1704067200000)).toBeInstanceOf(Date);
    });

    it('should return current date for invalid inputs', () => {
      const result = safeDate('invalid');
      expect(result).toBeInstanceOf(Date);
    });
  });

  describe('safeArray', () => {
    it('should return array as-is', () => {
      expect(safeArray([1, 2, 3])).toEqual([1, 2, 3]);
    });

    it('should return empty array for non-arrays', () => {
      expect(safeArray(null)).toEqual([]);
      expect(safeArray('test')).toEqual([]);
    });
  });

  describe('parseArgs', () => {
    it('should return object as-is', () => {
      expect(parseArgs({ a: 1 })).toEqual({ a: 1 });
    });

    it('should return empty object for non-objects', () => {
      expect(parseArgs(null)).toEqual({});
      expect(parseArgs('test')).toEqual({});
    });
  });
});
