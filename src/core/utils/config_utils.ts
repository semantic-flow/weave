// src/core/utils/config_utils.ts

import { log } from "./logging.ts";
import { WeaveConfig } from "../../types.ts";

/**
 * Define default global options.
 */
export const DEFAULT_GLOBAL: WeaveConfig["global"] = {
  repoDir: "_source_repos",
  dest: "_woven",
  copyStrategy: "no-overwrite",
  clean: false,
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
        if (ext === "json") {
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