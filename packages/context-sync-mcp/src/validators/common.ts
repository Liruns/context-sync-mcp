/**
 * 공통 검증 함수
 * 재사용 가능한 기본 검증 로직
 */

import { VALIDATION_ERRORS } from "../constants/error-messages.js";

/**
 * 검증 결과 타입
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * 성공 결과 생성
 */
export function validResult(): ValidationResult {
  return { valid: true, errors: [], warnings: [] };
}

/**
 * 실패 결과 생성
 */
export function invalidResult(error: string): ValidationResult {
  return { valid: false, errors: [error], warnings: [] };
}

// ========================================
// 타입 검증
// ========================================

/**
 * 문자열인지 검증
 */
export function isString(value: unknown): value is string {
  return typeof value === "string";
}

/**
 * 비어있지 않은 문자열인지 검증
 */
export function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * 숫자인지 검증
 */
export function isNumber(value: unknown): value is number {
  return typeof value === "number" && !isNaN(value);
}

/**
 * 정수인지 검증
 */
export function isInteger(value: unknown): value is number {
  return isNumber(value) && Number.isInteger(value);
}

/**
 * 양의 정수인지 검증
 */
export function isPositiveInteger(value: unknown): value is number {
  return isInteger(value) && value > 0;
}

/**
 * 불리언인지 검증
 */
export function isBoolean(value: unknown): value is boolean {
  return typeof value === "boolean";
}

/**
 * 배열인지 검증
 */
export function isArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

/**
 * 비어있지 않은 배열인지 검증
 */
export function isNonEmptyArray(value: unknown): value is unknown[] {
  return isArray(value) && value.length > 0;
}

/**
 * 객체인지 검증 (null 제외)
 */
export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// ========================================
// 필드 검증
// ========================================

/**
 * 필수 문자열 필드 검증
 */
export function validateRequiredString(
  obj: Record<string, unknown>,
  field: string
): { valid: boolean; error?: string } {
  const value = obj[field];
  if (value === undefined || value === null) {
    return { valid: false, error: VALIDATION_ERRORS.REQUIRED_FIELD(field) };
  }
  if (!isNonEmptyString(value)) {
    return { valid: false, error: VALIDATION_ERRORS.INVALID_TYPE(field, "string") };
  }
  return { valid: true };
}

/**
 * 필수 필드 목록 검증
 */
export function validateRequiredFields(
  obj: Record<string, unknown>,
  fields: string[]
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  for (const field of fields) {
    if (!(field in obj) || obj[field] === undefined) {
      errors.push(VALIDATION_ERRORS.MISSING_FIELD(field));
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * 선택적 정수 필드 검증
 */
export function validateOptionalInteger(
  obj: Record<string, unknown>,
  field: string
): { valid: boolean; error?: string } {
  const value = obj[field];
  if (value === undefined) {
    return { valid: true };
  }
  if (!isInteger(value)) {
    return { valid: false, error: VALIDATION_ERRORS.INVALID_TYPE(field, "integer") };
  }
  return { valid: true };
}

/**
 * 범위 내 숫자 검증
 */
export function validateNumberInRange(
  value: number,
  field: string,
  min: number,
  max: number
): { valid: boolean; error?: string; warning?: string } {
  if (value < min) {
    return { valid: false, error: VALIDATION_ERRORS.MIN_VALUE(field, min) };
  }
  if (value > max) {
    return { valid: true, warning: VALIDATION_ERRORS.MAX_VALUE(field, max) };
  }
  return { valid: true };
}

// ========================================
// 열거형 검증
// ========================================

/**
 * 유효한 값인지 검증
 */
export function validateEnum<T extends readonly string[]>(
  value: unknown,
  field: string,
  validValues: T
): { valid: boolean; error?: string } {
  if (!isString(value)) {
    return { valid: false, error: VALIDATION_ERRORS.INVALID_TYPE(field, "string") };
  }
  if (!validValues.includes(value)) {
    return {
      valid: false,
      error: VALIDATION_ERRORS.INVALID_VALUE(field, [...validValues]),
    };
  }
  return { valid: true };
}

/**
 * 선택적 열거형 검증
 */
export function validateOptionalEnum<T extends readonly string[]>(
  value: unknown,
  field: string,
  validValues: T
): { valid: boolean; error?: string } {
  if (value === undefined) {
    return { valid: true };
  }
  return validateEnum(value, field, validValues);
}

// ========================================
// 복합 검증
// ========================================

/**
 * 날짜 문자열 검증
 */
export function validateDateString(value: unknown): value is string {
  if (!isString(value)) return false;
  const date = new Date(value);
  return !isNaN(date.getTime());
}

/**
 * 안전하게 Date 객체로 변환
 */
export function safeDate(value: unknown): Date {
  if (value instanceof Date) return value;
  if (isString(value) || isNumber(value)) {
    const date = new Date(value);
    if (!isNaN(date.getTime())) return date;
  }
  return new Date();
}

/**
 * 안전하게 배열로 변환
 */
export function safeArray<T>(value: unknown): T[] {
  return isArray(value) ? (value as T[]) : [];
}

/**
 * 객체 파싱 (Record<string, unknown> 보장)
 */
export function parseArgs(args: unknown): Record<string, unknown> {
  if (isObject(args)) return args;
  return {};
}
