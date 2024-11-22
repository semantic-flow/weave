// src/cli/buildCommand.ts

import { handleBuild } from "../core/build.ts";
import { info, error } from "../core/utils/logger.ts";

/**
 * Interface representing the CLI options for the 'build' command.
 */
interface BuildOptionsCLI {
  out: string;
}

/**
 * CLI handler for the 'build' command.
 *
 * This function is invoked when the user runs the `weave build` command.
 * It executes the build process and handles any errors.
 *
 * @param {BuildOptionsCLI} options - Parsed CLI options.
 */
export async function buildCommand(options: BuildOptionsCLI) {
  try {
    info(`Starting build process in directory: ${options.out}`);
    await handleBuild(options.out);
    info("Build process completed successfully.");
  } catch (err: unknown) {
    if (err instanceof Error) {
      error(`Error executing 'build' command: ${err.message}`);
    } else {
      error(`Unknown error executing 'build' command: ${err}`);
    }
    Deno.exit(1);
  }
}
