// src/core/utils/synchronizeFiles.ts

import { copy } from "https://deno.land/std@0.203.0/fs/copy.ts";
import { ensureDir } from "https://deno.land/std@0.203.0/fs/ensure_dir.ts";
import { join, resolve } from "https://deno.land/std@0.203.0/path/mod.ts";
import { Config, Inclusion } from "../../../weave.config.ts"; // Adjust the import path as necessary
import { info, error } from "./logger.ts";

/**
 * Synchronizes files from inclusion sources to the output directory.
 *
 * @param {Config} config - The configuration object containing inclusion sources.
 * @param {string} outputDir - The path to the output directory where files will be synchronized.
 * @param {string} repoDir - The path to the repository directory containing inclusion sources.
 */
export async function synchronizeFiles(
  config: Config,
  outputDir: string,
  repoDir: string,
): Promise<void> {
  try {
    info("Starting file synchronization process...");

    // Ensure the output directory exists
    await ensureDir(outputDir);
    info(`Ensured that output directory "${outputDir}" exists.`);

    for (const inclusion of config.inclusions) {
      const sourcePath = resolve(repoDir, inclusion.path);
      const destinationPath = join(outputDir, inclusion.name);

      info(`Synchronizing "${inclusion.name}" from "${sourcePath}" to "${destinationPath}"...`);

      // Check if the source directory exists
      try {
        const sourceStat = await Deno.stat(sourcePath);
        if (!sourceStat.isDirectory) {
          error(`Source path "${sourcePath}" is not a directory. Skipping.`);
          continue;
        }
      } catch (e) {
        if (e instanceof Deno.errors.NotFound) {
          error(`Source directory "${sourcePath}" does not exist. Skipping.`);
          continue;
        } else {
          throw e; // Re-throw unexpected errors
        }
      }

      // Copy files from source to destination
      try {
        await copy(sourcePath, destinationPath, {
          overwrite: true, // Overwrite existing files
          preserve: true,   // Preserve file attributes
          // Include or exclude specific patterns if needed
        });
        info(`Successfully synchronized "${inclusion.name}".`);
      } catch (copyError) {
        error(`Failed to synchronize "${inclusion.name}": ${copyError.message}`);
      }
    }

    info("File synchronization process completed.");
  } catch (err: unknown) {
    if (err instanceof Error) {
      error(`An unexpected error occurred during synchronization: ${err.message}`);
    } else {
      error(`An unknown error occurred during synchronization: ${err}`);
    }
    throw err; // Re-throw the error after logging
  }
}
