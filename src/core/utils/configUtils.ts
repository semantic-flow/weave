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
  CopyStrategy,
} from "../../types.ts";
import { join } from "../../deps/path.ts";
import { exists, ensureDir } from "../../deps/fs.ts";
import { loadWeaveConfigFromJson, getConfigFilePath, mergeConfigs } from "./configHelpers.ts";
import { determineDefaultBranch } from "./determineDefaultBranch.ts";
import { determineDefaultWorkingDirectory } from "./determineDefaultWorkingDirectory.ts";
import { determineWorkingBranch } from "./determineWorkingBranch.ts";
import { ensureWorkingDirectory } from "./ensureWorkingDirectory.ts";
import { merge } from "./object.ts";

/**
 * Define default global options.
 */
const DEFAULT_GLOBAL: ResolvedGlobalOptions = {
  workspaceDir: "_source_repos",
  dest: "_woven",
  globalCopyStrategy: "no-overwrite",
  globalClean: false,
  watchConfig: true,
  configFilePath: "./weave.config.json", // Assuming a default config file path
};

/**
 * Composes the final weave configuration by merging defaults, environment variables,
 * configuration files, and command-line options.
 * @param commandOptions Command-line options to override configurations.
 * @returns The fully composed WeaveConfig object.
 */
export async function composeWeaveConfig(
  commandOptions?: InputGlobalOptions
): Promise<WeaveConfig> {
  // Step 1: Start with default global options
  const defaultConfig: WeaveConfigInput = {
    global: { ...DEFAULT_GLOBAL },
    inclusions: [],
  };

  // Step 2: Merge environment variables
  const ENV_CONFIG: Partial<WeaveConfigInput> = {
    global: {
      workspaceDir: Deno.env.get("WEAVE_WORKSPACE_DIR") || undefined,
      dest: Deno.env.get("WEAVE_DEST") || undefined,
      globalCopyStrategy: Deno.env.get("WEAVE_COPY_STRATEGY") as CopyStrategy | undefined,
      globalClean: Deno.env.get("WEAVE_CLEAN") === "true",
      configFilePath: Deno.env.get("WEAVE_CONFIG_FILE") || undefined,
    },
  };

  let mergedConfig: WeaveConfig = mergeConfigs(defaultConfig, ENV_CONFIG) as WeaveConfig;

  // Step 3: Determine configFilePath with precedence: CLI > ENV > default
  const preferredConfigPath = commandOptions?.configFilePath;
  const configFilePath = await getConfigFilePath(preferredConfigPath);

  if (!configFilePath) {
    log.error("No configuration file path provided. Exiting.");
    Deno.exit(1);
  }

  // Step 4: Load and merge configuration file (required)
  let fileConfig: Partial<WeaveConfigInput>;
  try {
    fileConfig = await loadWeaveConfigFromJson(configFilePath);
  } catch (error) {
    log.error("Failed to load configuration file. Exiting.");
    Deno.exit(1);
  }

  mergedConfig = mergeConfigs(mergedConfig, fileConfig) as WeaveConfig;

  // Step 5: Merge command-line options
  const commandConfig: Partial<WeaveConfigInput> = {
    global: {
      workspaceDir: commandOptions?.workspaceDir,
      dest: commandOptions?.dest,
      globalCopyStrategy: commandOptions?.globalCopyStrategy,
      globalClean: commandOptions?.globalClean,
      watchConfig: commandOptions?.watchConfig,
      configFilePath: commandOptions?.configFilePath,
      debug: commandOptions?.debug,
    },
  };

  mergedConfig = mergeConfigs(mergedConfig as WeaveConfigInput, commandConfig) as WeaveConfig;

  // Step 6: Assign configFilePath to global options (from the determined path)
  mergedConfig.global.configFilePath = configFilePath;

  // Step 7: Ensure that all required global options are set
  mergedConfig.global.workspaceDir = mergedConfig.global.workspaceDir ?? DEFAULT_GLOBAL.workspaceDir;
  mergedConfig.global.dest = mergedConfig.global.dest ?? DEFAULT_GLOBAL.dest;
  mergedConfig.global.globalCopyStrategy = mergedConfig.global.globalCopyStrategy ?? DEFAULT_GLOBAL.globalCopyStrategy;
  mergedConfig.global.globalClean = mergedConfig.global.globalClean ?? DEFAULT_GLOBAL.globalClean;
  mergedConfig.global.watchConfig = mergedConfig.global.watchConfig ?? DEFAULT_GLOBAL.watchConfig;

  // Step 8: Validate that all required global options are set
  if (
    !mergedConfig.global.workspaceDir ||
    !mergedConfig.global.dest ||
    !mergedConfig.global.globalCopyStrategy ||
    mergedConfig.global.globalClean === undefined ||
    mergedConfig.global.watchConfig === undefined ||
    !mergedConfig.global.configFilePath
  ) {
    log.error("Missing required global configuration options. Exiting.");
    Deno.exit(1);
  }

  const workspaceDir = mergedConfig.global.workspaceDir;

  // Step 9: Process inclusions

  // Pre-filter only active inclusions
  const activeInclusions = mergedConfig.inclusions.filter(
    (inclusion) => inclusion.options?.active !== false
  );

  // Map active inclusions to their resolved inclusions
  const resolvedInclusions = await Promise.all(
    activeInclusions.map(async (inclusion: InputInclusion): Promise<ResolvedInclusion> => {
      return await resolveInclusion(inclusion, workspaceDir);
    })
  );

  // Assign resolved inclusions back to the configuration
  mergedConfig.inclusions = resolvedInclusions;

  // At this point, mergedConfig satisfies WeaveConfig
  return mergedConfig as WeaveConfig;
}


async function resolveInclusion(inclusion: InputInclusion, workspaceDir: string): Promise<ResolvedInclusion> {
  switch (inclusion.type) {
    case "git": {
      const { url, localPath: providedWorkingDir, options, order } = inclusion;

      if (!url) {
        throw new Error(`Git inclusion requires a 'url': ${JSON.stringify(inclusion)}`);
      }

      const branch: string = options?.branch
        ? options.branch
        : providedWorkingDir && (await exists(join(providedWorkingDir, ".git")))
          ? await determineWorkingBranch(providedWorkingDir)
          : await determineDefaultBranch(url);

      const workingDir = providedWorkingDir
        ? providedWorkingDir
        : determineDefaultWorkingDirectory(workspaceDir, url, branch);

      await ensureWorkingDirectory(workspaceDir, url, branch);

      const resolvedGitOptions: GitOptions = {
        active: options?.active ?? true,
        copyStrategy: options?.copyStrategy ?? "no-overwrite",
        include: options?.include ?? [],
        exclude: options?.exclude ?? [],
        excludeByDefault: options?.excludeByDefault ?? false,
        autoPullBeforeBuild: options?.autoPullBeforeBuild ?? false,
        autoPushBeforeBuild: options?.autoPushBeforeBuild ?? false,
        branch,
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

    case "local": {
      const { localPath: providedWorkingDir, name, options, order } = inclusion;

      if (!providedWorkingDir) {
        throw new Error(`Local inclusion requires a 'localPath': ${JSON.stringify(inclusion)}`);
      }

      const workingDir = providedWorkingDir;

      await ensureDir(workingDir);

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
 */
export async function watchConfigFile(configFilePath: string, commandOptions?: InputGlobalOptions): Promise<void> {

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
          // Recompose the configuration using the original CommandOptions
          const newConfig: WeaveConfig = await composeWeaveConfig(commandOptions);

          // Reset and reinitialize Frame with the new configuration
          Frame.resetInstance();
          Frame.getInstance(newConfig, commandOptions);

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