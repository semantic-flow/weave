// src/cli/configHelper.ts
import { log, setLogLevel } from "../core/utils/logging.ts";
import { WeaveConfig, CommandOptions } from "../types.ts";
import { merge } from "../core/utils/object.ts";
import { DEFAULT_GLOBAL, getConfigFilePath, loadWeaveConfigFromJson } from "../core/utils/config_utils.ts";
import type { LevelName } from "../deps/log.ts";

/**
 * Defines the mapping between environment variables and WeaveConfig.
 */
const ENV_CONFIG: Partial<WeaveConfig> = {
  global: {
    repoDir: Deno.env.get("WEAVE_REPO_DIR") || undefined,
    dest: Deno.env.get("WEAVE_DEST") || undefined,
    copyStrategy: Deno.env.get("WEAVE_COPY_STRATEGY") as
      | "no-overwrite"
      | "overwrite"
      | "skip"
      | "prompt"
      | undefined,
    clean: Deno.env.get("WEAVE_CLEAN") === "true",
  },
};

/**
 * Merges default config, environment variables, config file, and CLI options into a single WeaveConfig.
 * @param commandOptions Command-line options to override configurations.
 * @returns The fully composed WeaveConfig object.
 */
export async function composeWeaveConfig(commandOptions: CommandOptions): Promise<WeaveConfig> {
  // Step 1: Start with default global options
  const defaultConfig: WeaveConfig = {
    global: { ...DEFAULT_GLOBAL },
    inclusions: [],
  };

  // Step 2: Merge environment variables
  let mergedConfig = merge(defaultConfig, ENV_CONFIG);

  // Step 3: Load and merge configuration file if provided
  if (commandOptions.config) {
    try {
      const resolvedPath = await getConfigFilePath(commandOptions.config);
      if (resolvedPath) {
        const fileConfig = await loadWeaveConfigFromJson(resolvedPath);
        mergedConfig = merge(mergedConfig, fileConfig);
      }
    } catch (error) {
      log.error(`Failed to load config file: ${(error as Error).message}`);
      throw error;
    }
  } else {
    // Attempt to load from default paths if --config is not provided
    try {
      const defaultConfigFilePath = await getConfigFilePath();
      if (defaultConfigFilePath) {
        const fileConfig = await loadWeaveConfigFromJson(defaultConfigFilePath);
        mergedConfig = merge(mergedConfig, fileConfig);
      } else {
        log.info("No configuration file found. Proceeding with defaults and environment variables.");
      }
    } catch (error) {
      log.warn(`Could not load default config files: ${(error as Error).message}`);
    }
  }

  // Step 4: Merge command-line options
  const commandConfig: Partial<WeaveConfig> = {
    global: {
      repoDir: commandOptions.repoDir,
      dest: commandOptions.dest,
      copyStrategy: commandOptions.copyStrategy,
      clean: commandOptions.clean,
    },
    // Future: Add more mappings for additional command-line options
  };

  mergedConfig = merge(mergedConfig, commandConfig);

  // Ensure inclusions are present
  if (!mergedConfig.inclusions) {
    mergedConfig.inclusions = [];
  }

  return mergedConfig;
}

export function setLogLevelFromCLI(debug: string) {
  const level = debug.toUpperCase() as LevelName;
  const validLevels: LevelName[] = ["DEBUG", "INFO", "WARN", "ERROR", "CRITICAL"];
  if (validLevels.includes(level)) {
    setLogLevel(level);
  } else {
    log.warn(`Invalid log level: ${debug}. Defaulting to INFO.`);
    setLogLevel("INFO");
  }
}