// src/core/utils/configHelpers.ts

import { log, setLogLevel, LOG_LEVELS } from "@/core/utils/logging.ts";
import { LevelName } from "@/deps/log.ts";
import { WeaveConfigInput, InputGlobalOptions } from "@/types.ts";
import { processWeaveConfig } from "@/core/utils/configUtils.ts";
import { handleCaughtError } from "@/core/utils/handleCaughtError.ts";
import { ConfigError } from "@/core/errors.ts";

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
        throw new ConfigError(`Failed to fetch config from URL: ${filePath}`);
      }
      const contentType = response.headers.get("Content-Type") || "";
      if (contentType.includes("application/json")) {
        return (await response.json()) as WeaveConfigInput;
      } else {
        throw new ConfigError("Remote config must be in JSON format");
      }
    } else {
      const ext = filePath.split(".").pop()?.toLowerCase();
      if (ext === "json") {
        log.info(`loadWeaveConfig: Reading file ${filePath}`);
        const data = await Deno.readTextFile(filePath);
        const parsed = JSON.parse(data) as WeaveConfigInput;

        // Validate that 'inclusions' is present and is an array
        if (!parsed.inclusions || !Array.isArray(parsed.inclusions)) {
          throw new ConfigError("'inclusions' must be an array in the configuration file");
        }

        return parsed;
      } else if (ext === "js" || ext === "ts") {
        const absolutePath = await Deno.realPath(filePath);
        const configModule = await import(`file://${absolutePath}`);
        if ("weaveConfig" in configModule) {
          return configModule.weaveConfig as WeaveConfigInput;
        } else {
          throw new ConfigError(`Config file does not export 'weaveConfig': ${filePath}`);
        }
      } else {
        throw new ConfigError(
          `Unsupported config file extension: .${ext}. Supported extensions are .json, .js, .ts`
        );
      }
    }
  } catch (error) {
    handleCaughtError(error, `Error processing ${filePath}:`);
    throw error; // Re-throwing the error ensures that the promise is rejected
  }
}



/**
 * Handles the configuration action by setting up logging.
 * @param options InputGlobalOptions parsed from CLI.
 */
export async function handleConfigAction(options: InputGlobalOptions): Promise<void> {

  try {
    // Ensure options.debug is a valid LevelName, or default to a safe value
    const logLevel: LevelName = options.debug && LOG_LEVELS[options.debug as LevelName] !== undefined
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
    await processWeaveConfig(options);
    log.info("Configuration successfully loaded.");

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
