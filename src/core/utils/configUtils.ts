// src/core/utils/configUtils.ts

import { log } from "./logging.ts";
import { Frame } from "../Frame.ts";
import {
  WeaveConfig,
  WeaveConfigInput,
  InputGlobalOptions,
  ResolvedGlobalOptions,
  InputInclusion,
  ResolvedInclusion,
  GitOptions,
  WebOptions,
  LocalOptions,
  validCopyStrategies,
} from "../../types.ts";
import { join } from "../../deps/path.ts";
import { loadWeaveConfig, getConfigFilePath, mergeConfigs } from "./configHelpers.ts";
import { determineDefaultBranch } from "./determineDefaultBranch.ts";
import { determineDefaultWorkingDirectory } from "./determineDefaultWorkingDirectory.ts";
import { determineWorkingBranch } from "./determineWorkingBranch.ts";
import { handleCaughtError } from "./handleCaughtError.ts";
import { directoryExists } from "./directoryExists.ts";

/**
 * Define default global options.
 */
const DEFAULT_GLOBAL: ResolvedGlobalOptions = {
  configFilePath: "./weave.config.json", // Assuming a default config file path
  debug: "ERROR",
  dest: "_woven",
  globalClean: false,
  globalCopyStrategy: "no-overwrite",
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
      globalCopyStrategy: Deno.env.get("WEAVE_COPY_STRATEGY") || undefined,
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
    log.error("No configuration file detected. Exiting.");
    Deno.exit(1);
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
      globalCopyStrategy: commandOptions?.globalCopyStrategy,
      watchConfig: commandOptions?.watchConfig,
      workspaceDir: commandOptions?.workspaceDir,
    },
  };

  mergedConfig = mergeConfigs(mergedConfig as WeaveConfigInput, commandConfig);

  // Step 6: perform typesafety theater
  if (!mergedConfig.global) {
    mergedConfig.global = { ...DEFAULT_GLOBAL };
  }
  if (!mergedConfig.inclusions) {
    mergedConfig.inclusions = [];
  }


  // Step 7: Validate that all required global options are set

  if (
    !mergedConfig.global.configFilePath ||
    !mergedConfig.global.dest ||
    !mergedConfig.global.globalClean ||
    !mergedConfig.global.globalCopyStrategy ||
    !mergedConfig.global.watchConfig ||
    !mergedConfig.global.workspaceDir
  ) {
    log.error("Missing required global configuration options. Exiting.");
    Deno.exit(1);
  }

  // Validate 'copyStrategy' if it's provided
  if (!validCopyStrategies.includes(mergedConfig.global.globalCopyStrategy)) {
    log.error(
      `Invalid copy strategy: ${mergedConfig.global.globalCopyStrategy}. Must be one of: ${validCopyStrategies.join(", ")}`
    );
    Deno.exit(1);
  }

  // Step 8: Process inclusions
  // Pre-filter only active inclusions
  const activeInclusions = mergedConfig.inclusions.filter(
    (inclusion) => inclusion.options?.active !== false
  );

  // Map active inclusions to their resolved inclusions
  const resolvedInclusions = await Promise.all(
    activeInclusions.map(async (inclusion: InputInclusion): Promise<ResolvedInclusion> => {
      return await resolveInclusion(inclusion);
    })
  );

  const frame = Frame.getInstance(mergedConfig, resolvedInclusions, commandOptions,);
  log.debug(`Frame instance created with config: ${Deno.inspect(frame)}`);
}


async function resolveInclusion(inclusion: InputInclusion): Promise<ResolvedInclusion> {
  const workspaceDir = Frame.getInstance().config.global.workspaceDir;
  switch (inclusion.type) {
    case "git": {
      const { name, url, localPath: providedWorkingDir, options, order } = inclusion;

      if (!url) {
        throw new Error(`Git inclusion requires a 'url': ${JSON.stringify(inclusion)}`);
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
        throw new Error(`No localPath provided and could not determine branch, so couldn't determining default workingDir '${name && `${name}: ` || ""}${url}'`);
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

    case "web": {
      const { url, name, options, order } = inclusion;

      if (!url) {
        throw new Error(`Web inclusion requires a 'url': ${JSON.stringify(inclusion)}`);
      }

      const resolvedWebOptions: WebOptions = {
        active: options?.active ?? true, // default to true if not provided
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

    case "local": {
      const { localPath: providedWorkingDir, name, options, order } = inclusion;

      if (!providedWorkingDir) {
        throw new Error(`Local inclusion requires a 'localPath': ${JSON.stringify(inclusion)}`);
      }

      const workingDir = providedWorkingDir;

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
  processWeaveConfigFn?: (opts?: InputGlobalOptions) => Promise<WeaveConfig>
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
          const newConfig: WeaveConfig = await (processWeaveConfigFn ?? processWeaveConfig)(commandOptions);

          // Reset and reinitialize Frame with the new configuration
          Frame.resetInstance();
          Frame.getInstance(newConfig, commandOptions);

          log.info("Configuration reloaded and Frame reinitialized.");
          log.info(`Updated config: ${Deno.inspect(Frame.getInstance().config)}`);
        } catch (error) {
          handleCaughtError(error, "Failed to reload config:");
        } finally {
          isReloading = false;
        }
      }, debounceDelay);
    }
  }
}