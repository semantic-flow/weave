// config_utils.ts


import { log } from "./log.ts";
import { WeaveConfig, GlobalOptions, Inclusion, GitOptions, HttpOptions, LocalOptions } from "../../types.ts";

const DEFAULT_GLOBAL: GlobalOptions = {
  repoDir: "_source_repos",
  dest: "_woven",
};

export function processConfig(config: WeaveConfig) {
  const globalConfig = {
    ...DEFAULT_GLOBAL,
    ...config.global, // User-provided overrides
  };

  console.log(`Using repoDir: ${globalConfig.repoDir}`);
  console.log(`Using dest: ${globalConfig.dest}`);

  config.inclusions.forEach((inclusion) => {
    const options = inclusion.options || {};

    if (options.excludeByDefault === undefined) {
      options.excludeByDefault = true;
    }

    switch (inclusion.type) {
      case "git+ssh":
      case "git+https":
        processGitInclusion(inclusion, options as GitOptions);
        break;
      case "http":
        processHttpInclusion(inclusion, options as HttpOptions);
        break;
      case "local":
        processLocalInclusion(inclusion, options as LocalOptions);
        break;
    }
  });
}

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
    if (error instanceof Error) {
      log.error(`Error occurred while parsing the command: ${error.message}`);
      log.debug(Deno.inspect(error, { colors: true }));
    } else {
      log.error("An unknown error occurred.");
    }
    throw error; // Re-throwing the error ensures that the promise is rejected
  }
}