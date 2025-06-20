// src/core/utils/configUtils.ts

import { log } from "@/core/utils/logging.ts";
import { Frame } from "@/core/Frame.ts";
import { ConfigError } from "@/core/errors.ts";
import {
  WeaveConfigInput,
  InputGlobalOptions,
  ResolvedGlobalOptions,
  InputInclusion,
  ResolvedInclusion,
  GitOptions,
  WebOptions,
  LocalOptions,
  CollisionStrategy as _CollisionStrategy,
  UpdateStrategy as _UpdateStrategy,
  validCollisionStrategies,
  validUpdateStrategies,
  validPullStrategies,
  validPushStrategies,
} from "@/types.ts";
import { join } from "@/deps/path.ts";
import { loadWeaveConfig, getConfigFilePath, mergeConfigs } from "@/core/utils/configHelpers.ts";
import { determineDefaultBranch } from "@/core/utils/determineDefaultBranch.ts";
import { determineDefaultWorkingDirectory } from "@/core/utils/determineDefaultWorkingDirectory.ts";
import { determineWorkingBranch } from "@/core/utils/determineWorkingBranch.ts";
import { handleCaughtError } from "@/core/utils/handleCaughtError.ts";
import { directoryExists } from "@/core/utils/directoryExists.ts";

/**
 * Define default global options.
 */
const DEFAULT_GLOBAL: ResolvedGlobalOptions = {
  configFilePath: "./weave.config.json", // Assuming a default config file path
  debug: "ERROR",
  dest: "_woven",
  dryRun: false,
  globalClean: false,
  globalCollisionStrategy: "fail",
  globalUpdateStrategy: "never",
  ignoreMissingTimestamps: false,
  watchConfig: false,
  workspaceDir: "_source-repos",
};

/**
 * Composes the final weave configuration by merging defaults, environment variables,
 * configuration files, and command-line options.
 * @param commandOptions Command-line options to override configurations.
 * @returns The fully composed WeaveConfig object.
 */
export async function processWeaveConfig(
  commandOptions?: InputGlobalOptions
): Promise<void> {

  // Step 0: Initialize or reset the Frame singleton with the composed configuration
  if (Frame.isInitialized()) { // <-- Safe Initialization Check
    // If Frame is already initialized, reset it
    Frame.resetInstance();
    log.info("Resetting Frame due to configuration changes.");
  }

  // Step 1: Start with default global options
  const defaultConfig: WeaveConfigInput = {
    global: { ...DEFAULT_GLOBAL },
    inclusions: [],
  };

  log.debug(`Default config: ${Deno.inspect(defaultConfig)}`);

  // Step 2: Merge environment variables
  const ENV_CONFIG: Partial<WeaveConfigInput> = {
    global: {
      configFilePath: Deno.env.get("WEAVE_CONFIG_FILE") || undefined,
      debug: Deno.env.get("WEAVE_DEBUG") || undefined,
      dest: Deno.env.get("WEAVE_DEST") || undefined,
      globalClean: Deno.env.get("WEAVE_CLEAN") !== undefined ? Deno.env.get("WEAVE_CLEAN") === "true" : undefined,
      globalCollisionStrategy: Deno.env.get("WEAVE_COLLISION_STRATEGY") || undefined,
      globalUpdateStrategy: Deno.env.get("WEAVE_UPDATE_STRATEGY") || undefined,
      ignoreMissingTimestamps: Deno.env.get("WEAVE_IGNORE_MISSING_TIMESTAMPS") !== undefined ? Deno.env.get("WEAVE_IGNORE_MISSING_TIMESTAMPS") === "true" : undefined,
      watchConfig: Deno.env.get("WEAVE_WATCH_CONFIG") !== undefined ? Deno.env.get("WEAVE_WATCH_CONFIG") === "true" : undefined,
      workspaceDir: Deno.env.get("WEAVE_WORKSPACE_DIR") || undefined,
    },
  };

  let mergedConfig: WeaveConfigInput = mergeConfigs(defaultConfig, ENV_CONFIG);

  log.debug(`Default merged with ENV: ${Deno.inspect(mergedConfig)}`);

  // Step 3: Determine configFilePath with precedence: CLI > ENV > default
  const preferredConfigPath = commandOptions?.configFilePath;
  const configFilePath = await getConfigFilePath(preferredConfigPath);

  if (!configFilePath) {
    throw new ConfigError("No configuration file detected");
  }

  mergedConfig.global!.configFilePath = configFilePath;
  log.debug(`Config file path: ${configFilePath}`);

  // Step 4: Load and merge configuration file (required)
  let fileConfig: Partial<WeaveConfigInput>;
  try {
    fileConfig = await loadWeaveConfig(configFilePath);
  } catch (error) {
    handleCaughtError(error, "Failed to load configuration file:");
    Deno.exit(1);
  }

  mergedConfig = mergeConfigs(mergedConfig, fileConfig);

  log.debug(`Default+ENV merged with config file: ${Deno.inspect(mergedConfig)}`);

  // Step 5: Merge command-line options
  const commandConfig: Partial<WeaveConfigInput> = {
    global: {
      // already addressed configFilePath in Step 3
      debug: commandOptions?.debug,
      dest: commandOptions?.dest,
      globalClean: commandOptions?.globalClean,
      globalCollisionStrategy: commandOptions?.globalCollisionStrategy,
      globalUpdateStrategy: commandOptions?.globalUpdateStrategy,
      ignoreMissingTimestamps: commandOptions?.ignoreMissingTimestamps,
      watchConfig: commandOptions?.watchConfig,
      workspaceDir: commandOptions?.workspaceDir,
    },
  };

  mergedConfig = mergeConfigs(mergedConfig as WeaveConfigInput, commandConfig);
  log.debug(`Default+ENV+config file merged with CLI options: ${Deno.inspect(mergedConfig)}`);

  // Step 6: perform typesafety theater
  if (!mergedConfig.inclusions) {
    mergedConfig.inclusions = [];
  }

  // Step 7: Validate that all required global options are set
  const requiredGlobalOptions: (keyof ResolvedGlobalOptions)[] = [
    "configFilePath",
    "dest",
    "globalClean",
    "globalCollisionStrategy",
    "globalUpdateStrategy",
    "ignoreMissingTimestamps",
    "watchConfig",
    "workspaceDir",
  ];

  for (const option of requiredGlobalOptions) {
    if (mergedConfig.global![option] === undefined) {
      throw new ConfigError(`Missing required global configuration option: ${option}`);
    }
  }

  // Validate 'collisionStrategy' if it's provided
  if (mergedConfig.global!.globalCollisionStrategy !== undefined && !validCollisionStrategies.includes(mergedConfig.global!.globalCollisionStrategy)) {
    throw new ConfigError(
      `Invalid collision strategy: ${mergedConfig.global!.globalCollisionStrategy}. Must be one of: ${validCollisionStrategies.join(", ")}`
    );
  }

  // Validate 'updateStrategy' if it's provided
  if (mergedConfig.global!.globalUpdateStrategy !== undefined && !validUpdateStrategies.includes(mergedConfig.global!.globalUpdateStrategy)) {
    throw new ConfigError(
      `Invalid update strategy: ${mergedConfig.global!.globalUpdateStrategy}. Must be one of: ${validUpdateStrategies.join(", ")}`
    );
  }

  // Step 8: Process inclusions
  // Pre-filter only active inclusions
  const activeInclusions = mergedConfig.inclusions.filter(
    (inclusion) => inclusion.options?.active !== false
  );

  // Map active inclusions to their resolved inclusions
  const resolvedInclusions = await Promise.all(
    activeInclusions.map(async (inclusion: InputInclusion): Promise<ResolvedInclusion> => {
      return await resolveInclusion(inclusion, mergedConfig.global!.workspaceDir!);
    })
  );

  Frame.initialize(mergedConfig, resolvedInclusions, commandOptions);
  const frame = Frame.getInstance();
  log.debug(`Frame instance created with config: ${Deno.inspect(frame)}`);
}

async function resolveInclusion(inclusion: InputInclusion, workspaceDir: string): Promise<ResolvedInclusion> {
  switch (inclusion.type) {
    case "git": {
      const { name, url, localPath: providedWorkingDir, options, order } = inclusion;

      if (!url) {
        throw new ConfigError(`Git inclusion requires a 'url': ${JSON.stringify(inclusion)}`);
      }

      // determine branch, although it doesn't really matter if providedWorkingDir
      let branch = null;

      if (options?.branch) {
        branch = options.branch;
      } else if (providedWorkingDir) {
        try {
          const gitExists = await directoryExists(join(providedWorkingDir, ".git"));
          if (gitExists) {
            try {
              branch = await determineWorkingBranch(providedWorkingDir);
            } catch (error) {
              handleCaughtError(error, `Error determining working branch for provided localPath '${providedWorkingDir}'`);
            }
          } else {
            try {
              branch = await determineDefaultBranch(url);
            } catch (error) {
              handleCaughtError(error, `Error determining default branch from provided URL ${url}`);
            }
          }
        } catch (error) {
          handleCaughtError(error, `Error checking existence of '.git' directory within provided localPath '${providedWorkingDir}'`);
        }
      } else {
        try {
          branch = await determineDefaultBranch(url);
        } catch (error) {
          handleCaughtError(error, `Error determining default branch from URL ${url}`);
        }
      }

      let workingDir: string;

      if (providedWorkingDir) {
        // used localPath (as providedWorkingDir) if provided...
        if (!(await directoryExists(providedWorkingDir))) {
          log.warn(`Could not find provided localPath '${providedWorkingDir}' for git inclusion '${name && `${name}: ` || ""}${url}'`);
        } else if (!(await directoryExists(join(providedWorkingDir, ".git")))) {
          log.warn(`The provided localPath '${providedWorkingDir}' for git inclusion '${name && `${name}: ` || ""}${url}' is not a git repository.`);
          workingDir = providedWorkingDir;
        }
        workingDir = providedWorkingDir;
      } else if (branch) {
        // otherwise calculate localPath from URL and branch...
        workingDir = determineDefaultWorkingDirectory(workspaceDir, url, branch);
        if (!(await directoryExists(workingDir))) {
          log.warn(`Could not find localPath '${workingDir}' for git inclusion '${name && `${name}: ` || ""}${url}'`);
        }
      } else {
        throw new ConfigError(`No localPath provided and could not determine branch, so couldn't determining default workingDir '${name && `${name}: ` || ""}${url}'`);
      }

      // Validate pullStrategy if provided
      if (options?.pullStrategy !== undefined && !validPullStrategies.includes(options.pullStrategy)) {
        throw new ConfigError(
          `Invalid pull strategy: ${options.pullStrategy}. Must be one of: ${validPullStrategies.join(", ")}`
        );
      }

      // Validate pushStrategy if provided
      if (options?.pushStrategy !== undefined && !validPushStrategies.includes(options.pushStrategy)) {
        throw new ConfigError(
          `Invalid push strategy: ${options.pushStrategy}. Must be one of: ${validPushStrategies.join(", ")}`
        );
      }

      const resolvedGitOptions: GitOptions = {
        active: options?.active ?? true,
        collisionStrategy: options?.collisionStrategy ?? "fail",
        updateStrategy: options?.updateStrategy ?? "never",
        ignoreMissingTimestamps: options?.ignoreMissingTimestamps ?? false,
        include: options?.include ?? [],
        exclude: options?.exclude ?? [],
        excludeByDefault: options?.excludeByDefault ?? false,
        autoPullBeforeBuild: options?.autoPullBeforeBuild ?? false,
        autoPushBeforeBuild: options?.autoPushBeforeBuild ?? false,
        branch: branch || "main",
        pullStrategy: (options?.pullStrategy as "ff-only" | "rebase" | "merge") ?? "rebase",
        pushStrategy: (options?.pushStrategy as "no-force" | "force-with-lease" | "force") ?? "no-force",
        // Verification options
        ignoreBehind: options?.ignoreBehind ?? false,
        ignoreAhead: options?.ignoreAhead ?? false,
        ignoreDivergent: options?.ignoreDivergent ?? false,
        ignoreCheckoutConsistency: options?.ignoreCheckoutConsistency ?? false,
        ignoreMissing: options?.ignoreMissing ?? false,
        ignoreDirty: options?.ignoreDirty ?? false,
        // Remappings
        remappings: options?.remappings ?? [],
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

    case "web": {
      const { url, name, options, order } = inclusion;

      if (!url) {
        throw new ConfigError(`Web inclusion requires a 'url': ${JSON.stringify(inclusion)}`);
      }

      const resolvedWebOptions: WebOptions = {
        active: options?.active ?? true, // default to true if not provided
        collisionStrategy: options?.collisionStrategy ?? "fail",
        updateStrategy: options?.updateStrategy ?? "never",
        ignoreMissingTimestamps: options?.ignoreMissingTimestamps ?? false,
        // Verification options
        ignoreRemoteAvailability: options?.ignoreRemoteAvailability ?? false,
        // Remappings
        remappings: options?.remappings ?? [],
      };

      return {
        type: "web",
        name,
        url,
        options: resolvedWebOptions,
        order: order ?? 0,
      };
    }

    case "local": {
      const { localPath: providedWorkingDir, name, options, order } = inclusion;

      if (!providedWorkingDir) {
        throw new ConfigError(`Local inclusion requires a 'localPath': ${JSON.stringify(inclusion)}`);
      }

      const workingDir = providedWorkingDir;

      const resolvedLocalOptions: LocalOptions = {
        active: options?.active ?? true,
        collisionStrategy: options?.collisionStrategy ?? "fail",
        updateStrategy: options?.updateStrategy ?? "never",
        ignoreMissingTimestamps: options?.ignoreMissingTimestamps ?? false,
        include: options?.include ?? [],
        exclude: options?.exclude ?? [],
        excludeByDefault: options?.excludeByDefault ?? false,
        // Verification options
        ignoreLocalEmpty: options?.ignoreLocalEmpty ?? false,
        ignoreMissing: options?.ignoreMissing ?? false,
        // Remappings
        remappings: options?.remappings ?? [],
      };

      return {
        type: "local",
        name,
        options: resolvedLocalOptions,
        order: order ?? 0,
        localPath: workingDir,
      };
    }
  }
}

/**
 * Watches the configuration file for changes and reloads the configuration when changes are detected.
 * @param configFilePath The path to the configuration file to watch.
 * @param commandOptions The original command-line options to retain during reloads.
 * @param processWeaveConfigFn Supports dependency injection of the processWeaveConfig function.
 */
export async function watchConfigFile(
  configFilePath: string,
  commandOptions?: InputGlobalOptions,
  processWeaveConfigFn?: (opts?: InputGlobalOptions) => Promise<void>
): Promise<void> {
  const watcher = Deno.watchFs(configFilePath);
  log.info(`Watching configuration file for changes: ${configFilePath}`);

  const debounceDelay = 300; // milliseconds
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
          // Use the injected processWeaveConfigFn or default to the actual function
          await (processWeaveConfigFn ?? processWeaveConfig)(commandOptions);

          // Assuming that processWeaveConfig would have updated the Frame already
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
