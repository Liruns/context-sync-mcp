/**
 * 설정 관리 모듈
 * 설정 검증 및 기본값 관리
 */

import * as fs from "fs/promises";
import * as path from "path";
import type { ContextSyncConfig } from "../types/index.js";

/** 기본 설정 */
export const DEFAULT_CONFIG: ContextSyncConfig = {
  syncMode: "seamless",
  triggers: {
    editorSwitch: true,
    fileSave: true,
    idleMinutes: 5,
    gitCommit: true,
  },
  storage: {
    location: ".context-sync",
    maxSnapshots: 100,
    compressionLevel: "medium",
  },
  adapters: {
    "claude-code": { enabled: true },
    cursor: { enabled: true },
    windsurf: { enabled: true },
    copilot: { enabled: false },
    unknown: { enabled: true },
  },
  privacy: {
    excludePatterns: ["*.env", "*secret*", "*password*", "*.pem", "*.key"],
    localOnly: true,
  },
  automation: {
    autoLoad: true,
    autoSave: true,
    autoSync: false,
  },
};

/** 설정 검증 결과 */
export interface ConfigValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/** 설정 검증 상수 */
export const CONFIG_LIMITS = {
  MIN_IDLE_MINUTES: 1,
  MAX_IDLE_MINUTES: 60,
  MIN_MAX_SNAPSHOTS: 1,
  MAX_MAX_SNAPSHOTS: 1000,
  VALID_SYNC_MODES: ["seamless", "ask", "manual"] as const,
  VALID_COMPRESSION_LEVELS: ["none", "low", "medium", "high"] as const,
} as const;

/**
 * 설정 검증 함수
 */
export function validateConfig(
  config: Partial<ContextSyncConfig>
): ConfigValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // triggers 검증
  if (config.triggers) {
    const { idleMinutes } = config.triggers;
    if (idleMinutes !== undefined) {
      if (typeof idleMinutes !== "number" || !Number.isInteger(idleMinutes)) {
        errors.push("triggers.idleMinutes는 정수여야 합니다");
      } else if (idleMinutes < CONFIG_LIMITS.MIN_IDLE_MINUTES) {
        errors.push(
          `triggers.idleMinutes는 ${CONFIG_LIMITS.MIN_IDLE_MINUTES}분 이상이어야 합니다`
        );
      } else if (idleMinutes > CONFIG_LIMITS.MAX_IDLE_MINUTES) {
        warnings.push(
          `triggers.idleMinutes가 ${CONFIG_LIMITS.MAX_IDLE_MINUTES}분을 초과합니다. 권장하지 않습니다`
        );
      }
    }
  }

  // storage 검증
  if (config.storage) {
    const { maxSnapshots, compressionLevel, location } = config.storage;

    if (maxSnapshots !== undefined) {
      if (typeof maxSnapshots !== "number" || !Number.isInteger(maxSnapshots)) {
        errors.push("storage.maxSnapshots는 정수여야 합니다");
      } else if (maxSnapshots < CONFIG_LIMITS.MIN_MAX_SNAPSHOTS) {
        errors.push(
          `storage.maxSnapshots는 ${CONFIG_LIMITS.MIN_MAX_SNAPSHOTS} 이상이어야 합니다`
        );
      } else if (maxSnapshots > CONFIG_LIMITS.MAX_MAX_SNAPSHOTS) {
        warnings.push(
          `storage.maxSnapshots가 ${CONFIG_LIMITS.MAX_MAX_SNAPSHOTS}을 초과합니다. 디스크 공간에 주의하세요`
        );
      }
    }

    if (compressionLevel !== undefined) {
      if (
        !CONFIG_LIMITS.VALID_COMPRESSION_LEVELS.includes(
          compressionLevel as (typeof CONFIG_LIMITS.VALID_COMPRESSION_LEVELS)[number]
        )
      ) {
        errors.push(
          `storage.compressionLevel은 ${CONFIG_LIMITS.VALID_COMPRESSION_LEVELS.join(", ")} 중 하나여야 합니다`
        );
      }
    }

    if (location !== undefined && typeof location !== "string") {
      errors.push("storage.location은 문자열이어야 합니다");
    }
  }

  // syncMode 검증
  if (config.syncMode !== undefined) {
    if (
      !CONFIG_LIMITS.VALID_SYNC_MODES.includes(
        config.syncMode as (typeof CONFIG_LIMITS.VALID_SYNC_MODES)[number]
      )
    ) {
      errors.push(
        `syncMode는 ${CONFIG_LIMITS.VALID_SYNC_MODES.join(", ")} 중 하나여야 합니다`
      );
    }
  }

  // privacy 검증
  if (config.privacy) {
    if (
      config.privacy.excludePatterns !== undefined &&
      !Array.isArray(config.privacy.excludePatterns)
    ) {
      errors.push("privacy.excludePatterns는 배열이어야 합니다");
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * 설정 관리자 클래스
 */
export class ConfigManager {
  private config: ContextSyncConfig;
  private storePath: string;

  constructor(projectPath: string, initialConfig?: Partial<ContextSyncConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...initialConfig };
    this.storePath = path.join(projectPath, this.config.storage.location);
  }

  /**
   * 설정 로드
   */
  async load(): Promise<void> {
    const configPath = path.join(this.storePath, "config.json");
    try {
      const configData = await fs.readFile(configPath, "utf-8");
      const savedConfig = JSON.parse(configData);
      this.config = { ...DEFAULT_CONFIG, ...savedConfig };
    } catch {
      await this.save();
    }
  }

  /**
   * 설정 저장
   */
  async save(): Promise<void> {
    const configPath = path.join(this.storePath, "config.json");
    await fs.writeFile(configPath, JSON.stringify(this.config, null, 2));
  }

  /**
   * 현재 설정 가져오기
   */
  getConfig(): ContextSyncConfig {
    return this.config;
  }

  /**
   * 저장 경로 가져오기
   */
  getStorePath(): string {
    return this.storePath;
  }

  /**
   * 설정 업데이트
   */
  async updateConfig(
    updates: Partial<ContextSyncConfig>
  ): Promise<{ config: ContextSyncConfig; warnings: string[] }> {
    const validation = validateConfig(updates);
    if (!validation.valid) {
      throw new Error(`설정 검증 실패: ${validation.errors.join(", ")}`);
    }

    this.config = { ...this.config, ...updates };
    await this.save();

    return {
      config: this.config,
      warnings: validation.warnings,
    };
  }

  /**
   * 설정 검증만 수행
   */
  validateUpdate(updates: Partial<ContextSyncConfig>): ConfigValidationResult {
    return validateConfig(updates);
  }
}
