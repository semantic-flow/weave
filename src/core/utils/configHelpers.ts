// src/core/utils/configHelpers.ts

import { log, setLogLevel } from "./logging.ts";
import { WeaveConfigInput, WeaveConfig, InputGlobalOptions, validCopyStrategies } from "../../types.ts";
import { Frame } from "../Frame.ts";
import { composeWeaveConfig } from "../../core/utils/configUtils.ts";
import { handleCaughtError } from "./handleCaughtError.ts";

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
          throw new Error("Remote config must be a JSON file.");
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
          throw new Error(`Config file not found at specified path: ${path}`);
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

  throw new Error("No configuration file found.");
}

/**
 * Loads the weave configuration from a JSON file or local JS/TS modules.
 * Remote URLs are restricted to JSON.
 * @param filePath The path or URL to the configuration file.
 * @returns The parsed WeaveConfigInput object.
 */
export async function loadWeaveConfig(filePath: string): Promise<WeaveConfigInput> {
  try {
    const isURL = /^https?:\/\//.test(filePath);
    if (isURL) {
      const response = await fetch(filePath);
      if (!response.ok) {
        throw new Error(`Failed to fetch config from URL: ${filePath}`);
      }
      const contentType = response.headers.get("Content-Type") || "";
      if (contentType.includes("application/json")) {
        return (await response.json()) as WeaveConfigInput;
      } else {
        throw new Error("Remote config must be in JSON format.");
      }
    } else {
      const ext = filePath.split(".").pop()?.toLowerCase();
      if (ext === "json") {
        log.info(`loadWeaveConfig: Reading file ${filePath}`);
        const data = await Deno.readTextFile(filePath);
        const parsed = JSON.parse(data) as WeaveConfigInput;

        // Validate that 'inclusions' is present and is an array
        if (!parsed.inclusions || !Array.isArray(parsed.inclusions)) {
          throw new Error("'inclusions' must be an array in the configuration file.");
        }

        return parsed;
      } else if (ext === "js" || ext === "ts") {
        const absolutePath = await Deno.realPath(filePath);
        const configModule = await import(`file://${absolutePath}`);
        if ("weaveConfig" in configModule) {
          return configModule.weaveConfig as WeaveConfigInput;
        } else {
          throw new Error(`Config file does not export 'weaveConfig': ${filePath}`);
        }
      } else {
        throw new Error(
          `Unsupported config file extension: .${ext}. Supported extensions are .json, .js, .ts`,
        );
      }
    }
  } catch (error) {
    handleCaughtError(error, `Error processing ${filePath}:`);
    throw error; // Re-throwing the error ensures that the promise is rejected
  }
}



/**
 * Handles the configuration action by processing command options, setting up configurations, and initializing the Frame.
 * @param options InputGlobalOptions parsed from CLI.
 */
export async function handleConfigAction(options: InputGlobalOptions): Promise<void> {
  // Validate 'copyStrategy' if it's provided
  if (options.globalCopyStrategy && !validCopyStrategies.includes(options.globalCopyStrategy)) {
    log.error(
      `Invalid copy strategy: ${options.globalCopyStrategy}. Must be one of: ${validCopyStrategies.join(", ")}`
    );
    Deno.exit(1);
  }

  try {
    // Set log level based on the debug option
    setLogLevel(options.debug || "ERROR");

    // Compose the WeaveConfig by merging defaults, env, config file, and CLI options
    const weaveConfig: WeaveConfig = await composeWeaveConfig(options);

    // Initialize or reset the Frame singleton with the composed configuration
    if (Frame.isInitialized()) { // <-- Safe Initialization Check
      // If Frame is already initialized, reset it
      Frame.resetInstance();
      log.info("Resetting Frame due to configuration changes.");
    }
    const frame = Frame.getInstance(weaveConfig); // Initialize with WeaveConfig

    // Log success messages
    log.info("Configuration successfully loaded and Frame initialized.");
    log.debug(`Detailed config: ${Deno.inspect(frame.config)}`);

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
