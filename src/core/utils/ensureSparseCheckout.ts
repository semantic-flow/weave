// src/core/utils/ensureSparseCheckout.ts

import { runGitCommand } from "./runGitCommand.ts";
import { info, warn, error } from "./logger.ts";

/**
 * Ensures the sparse-checkout configuration matches the desired include paths.
 * If there are differences, the configuration is updated.
 *
 * @param {string} localRepoPath - The local repository path.
 * @param {string[]} includePaths - The desired sparse-checkout include paths.
 * @throws Will throw an error if Git commands fail.
 */
export async function ensureSparseCheckout(localRepoPath: string, includePaths: string[]): Promise<void> {
  info("Checking sparse-checkout configuration...");

  try {
    // Get the current sparse-checkout configuration
    const listCommand = ["sparse-checkout", "list"];
    info(`Running command: git ${listCommand.join(' ')} in ${localRepoPath}`);
    const command = new Deno.Command("git", {
      args: listCommand,
      cwd: localRepoPath,
      stdout: "piped",
      stderr: "inherit",
    });

    const { code, stdout } = await command.output();

    if (code !== 0) {
      error(`Git sparse-checkout list failed with exit code ${code}`);
      throw new Error(`Git sparse-checkout list failed: git ${listCommand.join(' ')}`);
    }

    const currentSparseConfig = new TextDecoder().decode(stdout).trim().split("\n").filter(line => line !== "");
    info(`Current sparse-checkout paths: ${currentSparseConfig.join(', ')}`);

    // Compare with the desired include paths
    const missingPaths = includePaths.filter(path => !currentSparseConfig.includes(path));
    const extraPaths = currentSparseConfig.filter(path => !includePaths.includes(path));

    if (missingPaths.length > 0 || extraPaths.length > 0) {
      info("Sparse-checkout configuration has changed.");

      if (missingPaths.length > 0) {
        info(`Missing paths: ${missingPaths.join(", ")}`);
      }
      if (extraPaths.length > 0) {
        warn(`Extra paths: ${extraPaths.join(", ")}`);
      }

      info("Updating sparse-checkout paths...");
      await runGitCommand(localRepoPath, ["sparse-checkout", "set", ...includePaths]);
      info("Sparse-checkout configuration updated.");
    } else {
      info("Sparse-checkout configuration is already up to date.");
    }
  } catch (err) {
    error(`Failed to check or update sparse-checkout configuration: ${err.message}`);
    throw err; // Propagate the error to the caller
  }
}
