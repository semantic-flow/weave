// src/cli/configHelper.ts

import { log, setLogLevel } from "../core/utils/logging.ts";
import { WeaveConfig, CommandOptions, validCopyStrategies } from "../types.ts";
import { Frame } from "../core/Frame.ts";
import type { LevelName } from "../deps/log.ts";
import { composeWeaveConfig } from "../core/utils/config_utils.ts";



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


/**
 * Handles the configuration action by processing command options, setting up configurations, and initializing the Frame.
 * @param options CommandOptions parsed from CLI.
 */
export async function handleConfigAction(options: CommandOptions): Promise<void> {
  // Validate 'copyStrategy' if it's provided
  if (options.globalCopyStrategy && !validCopyStrategies.includes(options.globalCopyStrategy)) {
    log.error(
      `Invalid copy strategy: ${options.globalCopyStrategy}. Must be one of: ${validCopyStrategies.join(", ")}`
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

