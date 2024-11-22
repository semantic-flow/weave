import { info } from "./utils/logger.ts";

/**
 * Handles the core logic for the 'list' command.
 *
 * @param {any} config - Loaded configuration object.
 */
export async function handleList(config: any): Promise<void> {
  // Implement the logic to list all inclusion sources based on the config
  // Example:
  info("Listing all inclusion sources:");
  config.inclusions.forEach((inclusion: any, index: number) => {
    info(`${index + 1}. ${inclusion.name} - ${inclusion.path}`);
  });
}
