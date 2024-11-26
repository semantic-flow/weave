// src/core/utils/config_utils.ts

import { log } from "./logging.ts";
import { Frame } from "../Frame.ts";
import { WeaveConfig, CommandOptions, CopyStrategy } from "../../types.ts";
import { merge } from "./object.ts";

/**
 * Define default global options.
 */
export const DEFAULT_GLOBAL: WeaveConfig["global"] = {
  repoDir: "_source_repos",
  dest: "_woven",
  globalCopyStrategy: "no-overwrite",
  globalClean: false,
  watchConfig: true,
};

/** 
 * Returns the path of the configuration file.
 * @param path Optional specific config file path.
 * @param defaultPaths Array of default config file names.
 * @returns Resolved absolute path to the config file.
 */
export async function getConfigFilePath(
  path?: string,
  defaultPaths: string[] = ["weave.config.json", "weave.config.js", "weave.config.ts"]
): Promise<string | undefined> {
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
      // Check if default path is a URL isn't necessary since defaults are likely local
      return await Deno.realPath(defaultPath);
    } catch {
      // Continue to next default path if not found
    }
  }

  return undefined; // Return undefined if no config file is found
}

/** 
 * Loads the weave configuration from a JSON file or local JS/TS modules.
 * Remote URLs are restricted to JSON.
 * @param filePath The path or URL to the configuration file.
 * @returns The parsed WeaveConfig object.
 */
export async function loadWeaveConfig(filePath: string): Promise<WeaveConfig> {
  try {
    const isURL = /^https?:\/\//.test(filePath);
    if (isURL) {
      const response = await fetch(filePath);
      if (!response.ok) {
        throw new Error(`Failed to fetch config from URL: ${filePath}`);
      }
      const contentType = response.headers.get("Content-Type") || "";
      if (contentType.includes("application/json")) {
        return (await response.json()) as WeaveConfig;
      } else {
        throw new Error("Remote config must be in JSON format.");
      }
    } else {
      const ext = filePath.split(".").pop()?.toLowerCase();
      if (ext === "json") {
        const data = await Deno.readTextFile(filePath);
        const parsed = JSON.parse(data) as WeaveConfig;

        // Validate that 'inclusions' is present and is an array
        if (!parsed.inclusions || !Array.isArray(parsed.inclusions)) {
          throw new Error("'inclusions' must be an array in the configuration file.");
        }

        return parsed;
      } else if (ext === "js" || ext === "ts") {
        const absolutePath = await Deno.realPath(filePath);
        const configModule = await import(`file://${absolutePath}`);
        if ("weaveConfig" in configModule) {
          return configModule.weaveConfig as WeaveConfig;
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
    if (error instanceof Error) {
      log.error(`Error occurred while loading the config file: ${error.message}`);
      log.debug(Deno.inspect(error, { colors: true }));
    } else {
      log.error("An unknown error occurred while loading the config file.");
    }
    throw error; // Re-throwing the error ensures that the promise is rejected
  }
}

/** 
 * Loads the weave configuration from a JSON file.
 * Renamed to 'loadWeaveConfig' to handle both local and remote JSONs.
 * @param filePath The path to the JSON config file.
 * @returns The parsed WeaveConfig object.
 */
export async function loadWeaveConfigFromJson(filePath: string): Promise<WeaveConfig> {
  return loadWeaveConfig(filePath);
}

let isReloading = false;


/**
 * Watches the configuration file for changes and reloads the configuration when changes are detected.
 * Implements a debounce mechanism and prevents concurrent reloads.
 * @param configFilePath The path to the configuration file to watch.
 */
export async function watchConfigFile(configFilePath: string): Promise<void> {
  const watcher = Deno.watchFs(configFilePath);
  console.log(`Watching configuration file for changes: ${configFilePath}`);

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
      globalCopyStrategy: commandOptions.globalCopyStrategy,
      globalClean: commandOptions.globalClean,
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
 * Context object to hold mutable state
 */
const configContext = {
  commandOptions: null as CommandOptions | null,
  configFilePath: null as string | null,
};

/**
 * Defines the mapping between environment variables and WeaveConfig.
 */
const ENV_CONFIG: Partial<WeaveConfig> = {
  global: {
    repoDir: Deno.env.get("WEAVE_REPO_DIR") || undefined,
    dest: Deno.env.get("WEAVE_DEST") || undefined,
    globalCopyStrategy: Deno.env.get("WEAVE_COPY_STRATEGY") as CopyStrategy | undefined,
    globalClean: Deno.env.get("WEAVE_CLEAN") === "true",
  },
};
