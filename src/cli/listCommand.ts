// src/cli/listCommand.ts

import { loadConfig } from "../core/utils/configHandler.ts";
import { handleList } from "../core/list.ts";
import { info, error } from "../core/utils/logger.ts";

/**
 * Interface representing the CLI options for the 'list' command.
 */
interface ListOptionsCLI {
  config: string;
}

/**
 * CLI handler for the 'list' command.
 *
 * This function is invoked when the user runs the `weave list` command.
 * It loads the configuration, executes the list operation, and handles any errors.
 *
 * @param {ListOptionsCLI} options - Parsed CLI options.
 */
export async function listCommand(options: ListOptionsCLI) {
  try {
    info("Loading configuration...");
    const config = await loadConfig(options.config);
    info("Executing list operation...");
    await handleList(config);
    info("List operation completed successfully.");
  } catch (err: unknown) {
    if (err instanceof Error) {
      error(`Error executing 'list' command: ${err.message}`);
    } else {
      error(`Unknown error executing 'list' command: ${err}`);
    }
    Deno.exit(1);
  }
}
