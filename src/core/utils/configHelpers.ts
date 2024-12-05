// src/core/utils/configHelpers.ts

import { log } from "./logging.ts";
import { WeaveConfigInput } from "../../types.ts";

/**
 * Merges two configuration objects deeply, ensuring that required fields are preserved.
 * @param target The target configuration object.
 * @param source The source configuration object to merge into target.
 * @returns The merged configuration object.
 */
export function mergeConfigs<T extends object>(target: T, source: Partial<T>): T {
  for (const key in source) {
    if (source.hasOwnProperty(key)) {
      const sourceValue = source[key as keyof T];
      if (sourceValue !== undefined) {
        if (
          typeof sourceValue === "object" &&
          !Array.isArray(sourceValue) &&
          sourceValue !== null
        ) {
          // @ts-ignore: TypeScript doesn't recognize recursive generic merging
          target[key as keyof T] = mergeConfigs(target[key as keyof T] || {}, sourceValue as any);
        } else {
          target[key as keyof T] = sourceValue as T[keyof T];
        }
      }
    }
  }
  return target;
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
 * @param filePath The path to the JSON config file.
 * @returns The parsed WeaveConfigInput object.
 */
export async function loadWeaveConfigFromJson(filePath: string): Promise<WeaveConfigInput> {
  return await loadWeaveConfig(filePath);
}