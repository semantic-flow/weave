// src/cli/monitorCommand.ts

import { loadConfig } from "../core/utils/configHandler.ts";
import { startMonitoring } from "../core/monitor.ts";
import { info, error } from "../core/utils/logger.ts";

/**
 * Interface representing the CLI options for the 'monitor' command.
 */
interface MonitorOptionsCLI {
  config: string;
  out: string;
  repoDir: string;
}

/**
 * CLI handler for the 'monitor' command.
 *
 * This function is invoked when the user runs the `weave monitor` command.
 * It loads the configuration, initializes the monitoring process, and handles any errors.
 *
 * @param {MonitorOptionsCLI} options - Parsed CLI options.
 */
export async function monitorCommand(options: MonitorOptionsCLI) {
  try {
    // Log the initiation of the configuration loading process
    info("Loading configuration...");

    // Load the configuration file specified by the user
    const config = await loadConfig(options.config);

    // Log the start of the monitoring and synchronization process
    info("Starting file monitoring and synchronization...");

    // Invoke the core monitoring logic with the provided options
    await startMonitoring({
      config,
      out: options.out,
      repoDir: options.repoDir,
    });

    // Log the successful completion of the monitoring process
    info("File monitoring and synchronization completed successfully.");
  } catch (err: unknown) {
    // Handle any errors that occur during the monitoring process
    if (err instanceof Error) {
      error(`Error executing 'monitor' command: ${err.message}`);
    } else {
      error(`Unknown error executing 'monitor' command: ${err}`);
    }

    // Exit the CLI with a non-zero status code to indicate failure
    Deno.exit(1);
  }
}
