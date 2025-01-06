// src/core/utils/configHelpers.ts

import { log, setLogLevel } from "./logging.ts";
import * as logger from "../../deps/log.ts";
import type { LevelName } from "../../deps/log.ts";
import { WeaveConfigInput, InputGlobalOptions } from "../../types.ts";
import { processWeaveConfig as defaultProcessWeaveConfig } from "./configUtils.ts";
import { handleCaughtError } from "./handleCaughtError.ts";
import { ConfigError } from "../errors.ts";

// Utility function to merge two configurations
export function mergeConfigs(base: WeaveConfigInput, override: Partial<WeaveConfigInput>): WeaveConfigInput {
  return {
    ...base,
    ...Object.fromEntries(
      Object.entries(override).filter(([_, value]) => value !== undefined)
    ),
    global: {
      ...base.global,
      ...Object.fromEntries(
        Object.entries(override.global || {}).filter(([_, value]) => value !== undefined)
      ),
    },
    // TODO: probably should merge inclusions individually
    inclusions: override.inclusions !== undefined ? override.inclusions : base.inclusions,
  };
}

/**
 * Returns the path of the configuration file.
 * @param path Optional specific config file path.
 * @param defaultPaths Array of default config file names.
 * @returns Resolved absolute path to the config file.
 * @throws Will throw an error if no configuration file is found.
 */
export async function getConfigFilePath(
  path?: string,
  defaultPaths: string[] = ["weave.config.json", "weave.config.js", "weave.config.ts"]
): Promise<string> {
  if (path) {
    try {
      // Check if the path is a URL
      const url = new URL(path);
      if (url.protocol === "http:" || url.protocol === "https:") {
        // If it's a URL, and you allow dynamic config, return as is if it's JSON
        const ext = path.split(".").pop()?.toLowerCase();
        if (ext === "json" || ext === "jsonld") {
          return path;
        } else {
          throw new ConfigError("Remote config must be a JSON file");
        }
      }
      // Otherwise, resolve as a local path
      return await Deno.realPath(path);
    } catch (error) {
      if (error instanceof TypeError) {
        // Not a URL, treat as a local path
        try {
          return await Deno.realPath(path);
        } catch {
          throw new ConfigError(`Config file not found at specified path: ${path}`);
        }
      } else {
        throw error;
      }
    }
  }

  // Search through default paths
  for (const defaultPath of defaultPaths) {
    try {
      // Assuming defaults are local paths
      return await Deno.realPath(defaultPath);
    } catch {
      // Continue to next default path if not found
    }
  }

  throw new ConfigError("No configuration file found");
}

// Interface for loading config files
export interface ConfigLoader {
  loadConfig(filePath: string): Promise<WeaveConfigInput>;
}

// Default implementation that uses Deno's file system and dynamic imports
export class DefaultConfigLoader implements ConfigLoader {
  async loadConfig(filePath: string): Promise<WeaveConfigInput> {
    const isURL = /^https?:\/\//.test(filePath);
    if (isURL) {
      return await this.loadRemoteConfig(filePath);
    } else {
      return await this.loadLocalConfig(filePath);
    }
  }

  private async loadRemoteConfig(url: string): Promise<WeaveConfigInput> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new ConfigError(`Failed to fetch config from URL: ${url}`);
    }
    const contentType = response.headers.get("Content-Type") || "";
    if (!contentType.includes("application/json")) {
      throw new ConfigError("Remote config must be in JSON format");
    }
    return await response.json() as WeaveConfigInput;
  }

  protected async importModule(filePath: string): Promise<unknown> {
    // Handle memory:// protocol for testing
    if (filePath.startsWith("memory://")) {
      throw new Error("memory:// protocol is only for testing");
    }
    const absolutePath = await Deno.realPath(filePath);
    return await import(`file://${absolutePath}`);
  }

  private async loadLocalConfig(filePath: string): Promise<WeaveConfigInput> {
    const ext = filePath.split(".").pop()?.toLowerCase();
    if (ext === "json") {
      log.info(`loadWeaveConfig: Reading file ${filePath}`);
      const data = await Deno.readTextFile(filePath);
      const parsed = JSON.parse(data) as WeaveConfigInput;
      this.validateConfig(parsed, filePath);
      return parsed;
    } else if (ext === "js" || ext === "ts") {
      const configModule = await this.importModule(filePath);
      if (!("weaveConfig" in (configModule as object))) {
        throw new ConfigError(`Config file does not export 'weaveConfig': ${filePath}`);
      }
      const config = (configModule as { weaveConfig: WeaveConfigInput }).weaveConfig;
      this.validateConfig(config, filePath);
      return config;
    } else {
      throw new ConfigError(
        `Unsupported config file extension: .${ext}. Supported extensions are .json, .js, .ts`
      );
    }
  }

  private validateConfig(config: WeaveConfigInput, filePath: string) {
    if (!config.inclusions || !Array.isArray(config.inclusions)) {
      throw new ConfigError("'inclusions' must be an array in the configuration file");
    }
  }
}

// Global instance for the default loader
let configLoader: ConfigLoader = new DefaultConfigLoader();

// Allow injection of a custom loader for testing
export function setConfigLoader(loader: ConfigLoader) {
  configLoader = loader;
}

/**
 * Loads the weave configuration from a JSON file or local JS/TS modules.
 * Remote URLs are restricted to JSON.
 * @param filePath The path or URL to the configuration file.
 * @returns The parsed WeaveConfigInput object.
 */
export async function loadWeaveConfig(filePath: string): Promise<WeaveConfigInput> {
  try {
    return await configLoader.loadConfig(filePath);
  } catch (error) {
    handleCaughtError(error, `Error processing ${filePath}:`);
    throw error;
  }
}

/**
 * Handles the configuration action by setting up logging.
 * @param options InputGlobalOptions parsed from CLI.
 * @param processConfig Function to process the config, defaults to processWeaveConfig from configUtils.
 */
export async function handleConfigAction(
  options: InputGlobalOptions,
  processConfig: (options: InputGlobalOptions) => Promise<void> = defaultProcessWeaveConfig
): Promise<void> {
  try {
    // Ensure options.debug is a valid LevelName, or default to a safe value
    const logLevel: LevelName = options.debug && logger.LogLevels[options.debug as LevelName] !== undefined
      ? options.debug as LevelName
      : "ERROR";

    // Set log level based on the debug option
    try {
      setLogLevel(logLevel);
    } catch (error) {
      handleCaughtError(error, `Failed to set log level: ${logLevel}`);
      // Fall back to default log level
      setLogLevel("ERROR");
    }

    // Compose the WeaveConfig by merging defaults, env, config file, and CLI options
    await processConfig(options);
    log.info("Configuration successfully loaded.");

  } catch (error) {
    if (error instanceof Error) {
      log.error(`Error occurred during initialization: ${error.message}`);
      log.debug(Deno.inspect(error, { colors: true }));
      throw error;
    } else {
      const wrappedError = new Error("An unknown error occurred during initialization.");
      log.error(wrappedError.message);
      throw wrappedError;
    }
  }
}
