// src/core/utils/configHandler.ts

import { exists } from "../../deps/fs.ts";
import { WeaveConfig } from "./weave_config.ts";

export async function loadConfig(configPath: string): Promise<WeaveConfig> {
  const resolvedPath = resolvePath(configPath);

  if (!await exists(resolvedPath)) {
    throw new Error(`Config file not found: ${configPath}`);
  }

  const configModule = await import(`file://${resolvedPath}`);

  if (!configModule.weaveConfig) {
    throw new Error(`Config file must export 'weaveConfig'`);
  }

  return configModule.weaveConfig as WeaveConfig;
}

function resolvePath(configPath: string): string {
  // Resolve relative and absolute paths
  if (configPath.startsWith(".")) {
    return new URL(configPath, import.meta.url).pathname;
  }
  return configPath;
}
