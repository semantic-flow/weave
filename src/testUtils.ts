// src/testUtils.ts

import { stub } from "./deps/testing.ts";
import { log } from "./core/utils/logging.ts";
import type { Logger } from "./deps/log.ts";
import { WeaveConfigInput, InputGlobalOptions, ResolvedInclusion } from "./types.ts";
import { Frame } from "./core/Frame.ts";
import { ConfigDependencies } from "./core/utils/configUtils.ts";

// Helper to capture log messages
export interface LogCapture {
  critical: string[];
  error: string[];
  warn: string[];
  info: string[];
  debug: string[];
}

export interface LogStubs {
  critical: ReturnType<typeof stub<Logger, "critical">>;
  error: ReturnType<typeof stub<Logger, "error">>;
  warn: ReturnType<typeof stub<Logger, "warn">>;
  info: ReturnType<typeof stub<Logger, "info">>;
  debug: ReturnType<typeof stub<Logger, "debug">>;
}

export function setupLogCapture(): { capture: LogCapture; stubs: LogStubs; restore: () => void } {
  const capture: LogCapture = {
    critical: [],
    error: [],
    warn: [],
    info: [],
    debug: [],
  };

  // Save original console methods
  const originalError = console.error;
  const originalWarn = console.warn;
  const originalLog = console.log;

  // Override console methods to capture messages
  console.error = (msg: string) => {
    capture.critical.push(msg);
    capture.error.push(msg);
    originalError(msg); // Still show the message
  };

  console.warn = (msg: string) => {
    capture.warn.push(msg);
    originalWarn(msg); // Still show the message
  };

  console.log = (msg: string) => {
    capture.info.push(msg);
    capture.debug.push(msg);
    originalLog(msg); // Still show the message
  };

  // Create stubs for backward compatibility
  const stubs: LogStubs = {
    critical: stub<Logger, "critical">(log, "critical"),
    error: stub<Logger, "error">(log, "error"),
    warn: stub<Logger, "warn">(log, "warn"),
    info: stub<Logger, "info">(log, "info"),
    debug: stub<Logger, "debug">(log, "debug"),
  };

  return {
    capture,
    stubs,
    restore: () => {
      console.error = originalError;
      console.warn = originalWarn;
      console.log = originalLog;
    },
  };
}

// For backward compatibility
export const setupLogStubs = setupLogCapture;
export const restoreLogStubs = (stubs: LogStubs) => {
  // No-op since actual restoration is handled by restore()
};

// Test helper for Frame operations
export const withTestFrame = async <T>(
  fn: () => Promise<T>,
  config?: WeaveConfigInput,
  resolvedInclusions: ResolvedInclusion[] = [],
  commandOptions?: InputGlobalOptions
): Promise<T> => {
  if (config) {
    Frame.initialize(config, resolvedInclusions, commandOptions);
  }
  try {
    return await fn();
  } finally {
    Frame.resetInstance();
  }
};

// Mock config loader for testing
export class TestConfigLoader {
  private mockConfig: WeaveConfigInput;

  constructor(mockConfig: WeaveConfigInput) {
    this.mockConfig = mockConfig;
  }

  async loadConfig(_filePath: string): Promise<WeaveConfigInput> {
    return this.mockConfig;
  }
}

// Base mock dependencies for config tests
export const mockConfigDeps: ConfigDependencies = {
  determineDefaultBranch: async () => "main",
  determineWorkingBranch: async () => "feature-branch",
  determineDefaultWorkingDirectory: () => "_source-repos/repo",
  directoryExists: async () => true,
  getConfigFilePath: async () => "weave.config.json",
  env: {
    get: (key: string) => {
      const envMap: Record<string, string> = {
        WEAVE_DEBUG: "DEBUG",
        WEAVE_DEST: "custom_dest",
        WEAVE_CLEAN: "true",
      };
      return envMap[key];
    },
  },
};

// Extend globalThis type for config tests
declare global {
  var determineDefaultBranch: () => Promise<string>;
  var determineWorkingBranch: () => Promise<string>;
  var determineDefaultWorkingDirectory: () => string;
  var getConfigFilePath: (preferredPath?: string) => Promise<string | null>;
}
