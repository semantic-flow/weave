// config_utils.ts

import { WeaveConfig } from '../../types.ts';

/** Returns the path of the configuration file */
export async function getConfigFilePath(
  path?: string,
  defaultPaths: string[] = ["weave.config.js", "weave.config.ts", "weave.config.json"]
): Promise<string | undefined> {
  if (path) {
    try {
      return await Deno.realPath(path);
    } catch {
      throw new Error(`Config file not found at specified path: ${path}`);
    }
  }
  
  for (const defaultPath of defaultPaths) {
    try {
      return await Deno.realPath(defaultPath);
    } catch {
      // Continue to next default path if not found
    }
  }

  throw new Error('Config file not found in any default paths');
}

/** Loads the weave configuration from a JSON file */
export async function loadWeaveConfigFromJson(filePath: string): Promise<WeaveConfig> {
  try {
    const data = await Deno.readTextFile(filePath);
    return JSON.parse(data) as WeaveConfig;
  } catch (error) {
    throw new Error(`Failed to load or parse JSON config file: ${filePath}. Error: ${error.message}`);
  }
}
