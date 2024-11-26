// src/cli/configHelper.ts

import { log, setLogLevel } from "../core/utils/logging.ts";
import { WeaveConfig, CommandOptions, CopyStrategy, validCopyStrategies } from "../types.ts";
import { Frame } from "../core/Frame.ts";
import { merge } from "../core/utils/object.ts";
import {
  DEFAULT_GLOBAL,
  getConfigFilePath,
  loadWeaveConfigFromJson,
} from "../core/utils/config_utils.ts";
import type { LevelName } from "../deps/log.ts";

/**
 * Defines the mapping between environment variables and WeaveConfig.
 */
const ENV_CONFIG: Partial<WeaveConfig> = {
  global: {
    repoDir: Deno.env.get("WEAVE_REPO_DIR") || undefined,
    dest: Deno.env.get("WEAVE_DEST") || undefined,
    copyStrategy: Deno.env.get("WEAVE_COPY_STRATEGY") as CopyStrategy | undefined,
    clean: Deno.env.get("WEAVE_CLEAN") === "true",
  },
};

/**
 * Context object to hold mutable state
 */
const configContext = {
  commandOptions: null as CommandOptions | null,
  configFilePath: null as string | null,
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
  let configFilePath: string | undefined;
  if (commandOptions.config) {
    try {
      const resolvedPath = await getConfigFilePath(commandOptions.config);
      if (resolvedPath) {
        configFilePath = resolvedPath;
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
        configFilePath = defaultConfigFilePath;
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

  // Assign configFilePath to global options if available
  if (configFilePath) {
    mergedConfig.global = { ...mergedConfig.global, configFilePath };
    configContext.configFilePath = configFilePath;
  }

  // Store the initial CommandOptions for reloads
  configContext.commandOptions = commandOptions;

  return mergedConfig;
}

/**
 * Sets the log level based on the CLI input.
 * @param debug The debug level string.
 */
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

let isReloading = false;

/**
 * Handles the configuration action by processing command options, setting up configurations, and initializing the Frame.
 * @param options CommandOptions parsed from CLI.
 */
export async function handleConfigAction(options: CommandOptions): Promise<void> {
  // Validate 'copyStrategy' if it's provided
  if (options.copyStrategy && !validCopyStrategies.includes(options.copyStrategy)) {
    log.error(
      `Invalid copy strategy: ${options.copyStrategy}. Must be one of: ${validCopyStrategies.join(", ")}`
    );
    Deno.exit(1);
  }

  try {
    // Set log level based on the debug option
    setLogLevelFromCLI(options.debug || "INFO");

    // Compose the WeaveConfig by merging defaults, env, config file, and CLI options
    const weaveConfig: WeaveConfig = await composeWeaveConfig(options);

    // Initialize or reset the Frame singleton with the composed configuration
    if (Frame.isInitialized()) { // <-- Safe Initialization Check
      // If Frame is already initialized, reset it
      Frame.resetInstance();
      log.info("Resetting Frame due to configuration changes.");
    }
    Frame.getInstance(weaveConfig); // Initialize with WeaveConfig

    // Log success messages
    log.info("Configuration successfully loaded and Frame initialized.");
    log.info(`Detailed config: ${Deno.inspect(Frame.getInstance().config)}`);

    // Start watching the configuration file if the path is available
    if (weaveConfig.global?.configFilePath) {
      // Start watching in a separate, non-blocking async task
      watchConfigFile(weaveConfig.global.configFilePath).catch((error) => {
        log.error(`Failed to watch config file: ${(error as Error).message}`);
      });
    }

    // Placeholder for further actions like building the site
    // await buildSite(Frame.getInstance().config);
  } catch (error) {
    if (error instanceof Error) {
      log.error(`Error occurred during initialization: ${error.message}`);
      log.debug(Deno.inspect(error, { colors: true }));
    } else {
      log.error("An unknown error occurred during initialization.");
    }
    Deno.exit(1);
  }
}

/**
 * Watches the configuration file for changes and reloads the configuration when changes are detected.
 * Implements a debounce mechanism and prevents concurrent reloads.
 * @param configFilePath The path to the configuration file to watch.
 */
export async function watchConfigFile(configFilePath: string): Promise<void> {
  const watcher = Deno.watchFs(configFilePath);
  log.info(`Watching configuration file for changes: ${configFilePath}`);

  const debounceDelay = 300; // milliseconds
  let reloadTimeout: number | null = null;

  for await (const event of watcher) {
    if (event.kind === "modify") {
      log.info(`Configuration file modified: ${event.paths.join(", ")}`);

      if (reloadTimeout !== null) {
        clearTimeout(reloadTimeout);
      }

      reloadTimeout = setTimeout(async () => {
        if (isReloading) {
          log.warn("Configuration reload already in progress. Skipping this modification.");
          return;
        }

        isReloading = true;

        try {
          // Recompose the configuration using the stored CommandOptions
          if (!configContext.commandOptions) {
            throw new Error("Original CommandOptions are unavailable for reloading.");
          }

          const weaveConfig: WeaveConfig = await composeWeaveConfig(configContext.commandOptions);

          // Reset and reinitialize Frame with the new configuration
          Frame.resetInstance();
          Frame.getInstance(weaveConfig);

          log.info("Configuration reloaded and Frame reinitialized.");
          log.info(`Updated config: ${Deno.inspect(Frame.getInstance().config)}`);
        } catch (error) {
          if (error instanceof Error) {
            log.error(`Failed to reload config: ${error.message}`);
            log.debug(Deno.inspect(error, { colors: true }));
          } else {
            log.error("An unknown error occurred while reloading config.");
          }
        } finally {
          isReloading = false;
        }
      }, debounceDelay);
    }
  }
}