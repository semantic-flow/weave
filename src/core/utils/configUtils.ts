// src/core/utils/configUtils.ts

import { log } from "./logging.ts";
import { Frame } from "../Frame.ts";
import { ConfigError } from "../errors.ts";
import {
  WeaveConfigInput,
  InputGlobalOptions,
  ResolvedGlobalOptions,
  InputInclusion,
  ResolvedInclusion,
  GitOptions,
  WebOptions,
  LocalOptions,
  validCopyStrategies, CopyStrategy,
} from "../../types.ts";
import { join } from "../../deps/path.ts";
import { loadWeaveConfig, getConfigFilePath, mergeConfigs } from "./configHelpers.ts";
import { handleCaughtError } from "./handleCaughtError.ts";

// Dependencies interface for better testability
export interface ConfigDependencies {
  determineDefaultBranch: (url: string) => Promise<string>;
  determineWorkingBranch: (dir: string) => Promise<string>;
  determineDefaultWorkingDirectory: (workspaceDir: string, url: string, branch: string) => string;
  directoryExists: (path: string) => Promise<boolean>;
  getConfigFilePath: (preferredPath?: string) => Promise<string | null>;
  env: {
    get: (key: string) => string | undefined;
  };
}

/**
 * Define default global options.
 */
export const DEFAULT_GLOBAL: ResolvedGlobalOptions = {
  configFilePath: "./weave.config.json",
  debug: "ERROR",
  dest: "_woven",
  dryRun: false,
  globalClean: false,
  globalCopyStrategy: "no-overwrite",
  watchConfig: false,
  workspaceDir: "_source-repos",
};

/**
 * Get environment configuration
 */
export function getEnvConfig(env: { get: (key: string) => string | undefined }): Partial<WeaveConfigInput> {
  return {
    global: {
      configFilePath: env.get("WEAVE_CONFIG_FILE") || undefined,
      debug: env.get("WEAVE_DEBUG") || undefined,
      dest: env.get("WEAVE_DEST") || undefined,
      globalClean: env.get("WEAVE_CLEAN") !== undefined ? env.get("WEAVE_CLEAN") === "true" : undefined,
      globalCopyStrategy: env.get("WEAVE_COPY_STRATEGY") as CopyStrategy || undefined,
      watchConfig: env.get("WEAVE_WATCH_CONFIG") !== undefined ? env.get("WEAVE_WATCH_CONFIG") === "true" : undefined,
      workspaceDir: env.get("WEAVE_WORKSPACE_DIR") || undefined,
    },
  };
}

/**
 * Validate global options
 */
export async function validateGlobalOptions(config: WeaveConfigInput): Promise<void> {
  const requiredGlobalOptions: (keyof ResolvedGlobalOptions)[] = [
    "configFilePath",
    "dest",
    "globalClean",
    "globalCopyStrategy",
    "watchConfig",
    "workspaceDir",
  ];

  // Check each option and throw on the first missing one
  const missingOption = requiredGlobalOptions.find(option => config.global![option] === undefined);
  if (missingOption) {
    throw new ConfigError(`Missing required global configuration option: ${missingOption}`);
  }

}

/**
 * Resolve a git inclusion
 */
export async function resolveGitInclusion(
  inclusion: InputInclusion & { type: "git" },
  workspaceDir: string,
  deps: ConfigDependencies
): Promise<ResolvedInclusion> {
  const { name, url, localPath: providedWorkingDir, options, order } = inclusion;

  if (!url) {
    throw new ConfigError(`Git inclusion requires a 'url': ${JSON.stringify(inclusion)}`);
  }

  let branch = options?.branch;
  let workingDir: string;

  if (!branch && providedWorkingDir) {
    const gitExists = await deps.directoryExists(join(providedWorkingDir, ".git"));
    if (gitExists) {
      try {
        branch = await deps.determineWorkingBranch(providedWorkingDir);
      } catch (error) {
        handleCaughtError(error, `Error determining working branch for provided localPath '${providedWorkingDir}'`);
      }
    }
  }

  if (!branch) {
    try {
      branch = await deps.determineDefaultBranch(url);
    } catch (error) {
      handleCaughtError(error, `Error determining default branch from URL ${url}`);
    }
  }

  if (providedWorkingDir) {
    workingDir = providedWorkingDir;
    if (!(await deps.directoryExists(providedWorkingDir))) {
      log.warn(`Could not find provided localPath '${workingDir}' for git inclusion '${name && `${name}: ` || ""}${url}'`);
    }
  } else {
    if (!branch) branch = "main";
    workingDir = deps.determineDefaultWorkingDirectory(workspaceDir, url, branch);
    if (!(await deps.directoryExists(workingDir))) {
      log.warn(`No localPath provided for working directory and inferred '${workingDir}' not present for '${name && `${name}: ` || ""}${url}'`);
    }
  }

  const resolvedGitOptions: GitOptions = {
    active: options?.active ?? true,
    copyStrategy: options?.copyStrategy ?? "no-overwrite",
    include: options?.include ?? [],
    exclude: options?.exclude ?? [],
    excludeByDefault: options?.excludeByDefault ?? false,
    autoPullBeforeBuild: options?.autoPullBeforeBuild ?? false,
    autoPushBeforeBuild: options?.autoPushBeforeBuild ?? false,
    branch: branch || "main",
  };

  return {
    type: "git",
    name: inclusion.name,
    url,
    options: resolvedGitOptions,
    order: order ?? 0,
    localPath: workingDir,
  };
}

/**
 * Resolve a web inclusion
 */
export async function resolveWebInclusion(inclusion: InputInclusion & { type: "web" }): Promise<ResolvedInclusion> {
  const { url, name, options, order } = inclusion;

  if (!url) {
    throw new ConfigError(`Web inclusion requires a 'url': ${JSON.stringify(inclusion)}`);
  }

  const resolvedWebOptions: WebOptions = {
    active: options?.active ?? true,
    copyStrategy: options?.copyStrategy ?? "no-overwrite",
  };

  return {
    type: "web",
    name,
    url,
    options: resolvedWebOptions,
    order: order ?? 0,
  };
}

/**
 * Resolve a local inclusion
 */
export async function resolveLocalInclusion(inclusion: InputInclusion & { type: "local" }): Promise<ResolvedInclusion> {
  const { localPath: providedWorkingDir, name, options, order } = inclusion;

  if (!providedWorkingDir) {
    throw new ConfigError(`Local inclusion requires a 'localPath': ${JSON.stringify(inclusion)}`);
  }

  const resolvedLocalOptions: LocalOptions = {
    active: options?.active ?? true,
    copyStrategy: options?.copyStrategy ?? "no-overwrite",
    include: options?.include ?? [],
    exclude: options?.exclude ?? [],
    excludeByDefault: options?.excludeByDefault ?? false,
  };

  return {
    type: "local",
    name,
    options: resolvedLocalOptions,
    order: order ?? 0,
    localPath: providedWorkingDir,
  };
}

/**
 * Resolve an inclusion based on its type
 */
export async function resolveInclusion(
  inclusion: InputInclusion,
  workspaceDir: string,
  deps: ConfigDependencies
): Promise<ResolvedInclusion> {
  switch (inclusion.type) {
    case "git":
      return resolveGitInclusion(inclusion, workspaceDir, deps);
    case "web":
      return resolveWebInclusion(inclusion);
    case "local":
      return resolveLocalInclusion(inclusion);
  }
}

/**
 * Process weave configuration with dependency injection
 */
export interface ProcessedWeaveConfig extends WeaveConfigInput {
  resolvedInclusions?: ResolvedInclusion[];
}

export async function processWeaveConfigWithDeps(
  deps: ConfigDependencies,
  commandOptions?: InputGlobalOptions,
  skipDefaults = false
): Promise<ProcessedWeaveConfig> {
  // Step 1: Start with default global options (unless skipped, e.g. for testing purposes)
  const defaultConfig: WeaveConfigInput = skipDefaults ? {
    global: {},
    inclusions: [],
  } : {
    global: { ...DEFAULT_GLOBAL },
    inclusions: [],
  };

  // Step 2: Merge environment variables
  const envConfig = getEnvConfig(deps.env);
  let mergedConfig = mergeConfigs(defaultConfig, envConfig);

  // Step 3: Determine configFilePath
  const preferredConfigPath = commandOptions?.configFilePath;
  const configFilePath = await deps.getConfigFilePath(preferredConfigPath);

  if (!configFilePath) {
    throw new ConfigError("No configuration file detected");
  }

  if (!skipDefaults) {
    mergedConfig.global!.configFilePath = configFilePath;
  }

  // Step 4: Load and merge configuration file
  let fileConfig: Partial<WeaveConfigInput>;
  try {
    fileConfig = await loadWeaveConfig(configFilePath);
  } catch (error: unknown) {
    if (error instanceof Error) {
      throw new ConfigError(error.message);
    }
    throw new ConfigError("Failed to load config: Unknown error");
  }
  mergedConfig = mergeConfigs(mergedConfig, fileConfig);

  // Step 5: Merge command-line options
  const commandConfig: Partial<WeaveConfigInput> = {
    global: {
      debug: commandOptions?.debug,
      dest: commandOptions?.dest,
      globalClean: commandOptions?.globalClean,
      globalCopyStrategy: commandOptions?.globalCopyStrategy,
      watchConfig: commandOptions?.watchConfig,
      workspaceDir: commandOptions?.workspaceDir,
    },
  };

  mergedConfig = mergeConfigs(mergedConfig, commandConfig);

  // Step 6: Ensure inclusions array exists
  if (!mergedConfig.inclusions) {
    mergedConfig.inclusions = [];
  }

  // Step 7: Validate global options
  validateGlobalOptions(mergedConfig);

  // Step 8: Process inclusions
  const activeInclusions = mergedConfig.inclusions.filter(
    (inclusion) => inclusion.options?.active !== false
  );

  const resolvedInclusions = await Promise.all(
    activeInclusions.map((inclusion) => resolveInclusion(inclusion, mergedConfig.global!.workspaceDir!, deps))
  );

  const config = { ...mergedConfig, resolvedInclusions };

  // Step 9: Initialize Frame
  if (Frame.isInitialized()) {
    Frame.resetInstance();
    log.info("Resetting Frame due to configuration changes.");
  }

  Frame.initialize(config, resolvedInclusions, commandOptions);
  log.debug(`Frame instance created with config: ${Deno.inspect(Frame.getInstance())}`);

  return config;
}

/**
 * Main entry point that uses real dependencies
 */
export async function processWeaveConfig(commandOptions?: InputGlobalOptions): Promise<void> {
  // Import real dependencies
  const { determineDefaultBranch } = await import("./determineDefaultBranch.ts");
  const { determineWorkingBranch } = await import("./determineWorkingBranch.ts");
  const { determineDefaultWorkingDirectory } = await import("./determineDefaultWorkingDirectory.ts");
  const { directoryExists } = await import("./directoryExists.ts");

  const deps: ConfigDependencies = {
    determineDefaultBranch,
    determineWorkingBranch,
    determineDefaultWorkingDirectory,
    directoryExists,
    getConfigFilePath,
    env: Deno.env,
  };

  try {
    await processWeaveConfigWithDeps(deps, commandOptions);
  } catch (error) {
    handleCaughtError(error, "Failed to process configuration:");
    throw error;
  }
}

/**
 * Watch config file with dependency injection
 */
export async function watchConfigFileWithDeps(
  configFilePath: string,
  commandOptions?: InputGlobalOptions,
  deps?: ConfigDependencies,
  processWeaveConfigFn?: (opts?: InputGlobalOptions) => Promise<void>
): Promise<void> {
  const watcher = Deno.watchFs(configFilePath);
  log.info(`Watching configuration file for changes: ${configFilePath}`);

  const debounceDelay = 300;
  let reloadTimeout: number | null = null;
  let isReloading = false;

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
          await (processWeaveConfigFn ?? processWeaveConfig)(commandOptions);
          const updatedConfig = Frame.getInstance().config;
          log.info("Configuration reloaded and Frame reinitialized.");
          log.info(`Updated config: ${Deno.inspect(updatedConfig)}`);
        } catch (error) {
          handleCaughtError(error, "Failed to reload config:");
        } finally {
          isReloading = false;
        }
      }, debounceDelay);
    }
  }
}

/**
 * Main watch config file entry point
 */
export async function watchConfigFile(
  configFilePath: string,
  commandOptions?: InputGlobalOptions,
  processWeaveConfigFn?: (opts?: InputGlobalOptions) => Promise<void>
): Promise<void> {
  const { determineDefaultBranch } = await import("./determineDefaultBranch.ts");
  const { determineWorkingBranch } = await import("./determineWorkingBranch.ts");
  const { determineDefaultWorkingDirectory } = await import("./determineDefaultWorkingDirectory.ts");
  const { directoryExists } = await import("./directoryExists.ts");

  const deps: ConfigDependencies = {
    determineDefaultBranch,
    determineWorkingBranch,
    determineDefaultWorkingDirectory,
    directoryExists,
    getConfigFilePath,
    env: Deno.env,
  };

  return watchConfigFileWithDeps(configFilePath, commandOptions, deps, processWeaveConfigFn);
}
