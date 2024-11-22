export interface InclusionOptions {
  include: string[]; // Specific paths to include
  exclude: string[]; // Specific paths to exclude
  excludeByDefault: boolean; // Exclude all other paths not included
  autoPullBeforeBuild: boolean; // Automatically pull updates before building
  autoPushBeforeBuild: boolean; // Automatically push updates before building
}

export interface Inclusion {
  url: string; // Git repo URL, local folder path, or remote file URL
  options: InclusionOptions;
}

export interface GlobalConfig {
  repoDir: string; // Directory for cloned repositories
  wovenDir: string; // Directory for woven output
}

export interface WeaveConfig {
  global: GlobalConfig;
  inclusions: Inclusion[];
  // Add other global configuration options as needed
}

/** Returns the path of the _config file */
export async function getConfigFile(
  path?: string,
  defaultPaths: string[] = ["_weave_config.js", "_weave_config.ts"],
): Promise<string | undefined> {
  if (path) {
    try {
      return await Deno.realPath(path);
    } catch {
      throw new Error(`Config file not found (${path})`);
    }
  }

  for (const path of defaultPaths) {
    try {
      return await Deno.realPath(path);
    } catch {
      // Ignore
    }
  }
}
