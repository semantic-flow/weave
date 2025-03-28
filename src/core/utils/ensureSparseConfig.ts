// src/core/utils/ensureSparseCongif.ts

import { log } from "./logging.ts";
import { runGitCommand } from "./runGitCommand.ts";
import { handleCaughtError } from "./handleCaughtError.ts";
import { GitError } from "../errors.ts";

/**
 * Ensures the sparse-checkout configuration matches the desired include paths.
 * If there are differences, the configuration is updated.
 *
 * @param {string} workingDir - The local repository path.
 * @param {string[]} sparseCheckoutRules - The desired sparse-checkout include paths.
 * @throws Will throw an error if Git commands fail.
 */
export async function ensureSparseCheckout(workingDir: string, sparseCheckoutRules: string[]): Promise<void> {
  log.info("Checking sparse-checkout configuration...");

  try {
    // Get the current sparse-checkout configuration
    const listCommand = ["sparse-checkout", "list"];
    log.info(`Running command: git ${listCommand.join(' ')} in ${workingDir}`);
    const command = new Deno.Command("git", {
      args: listCommand,
      cwd: workingDir,
      stdout: "piped",
      stderr: "inherit",
    });

    const { code, stdout } = await command.output();

    if (code !== 0) {
      log.error(`Git sparse-checkout list failed with exit code ${code}`);
      throw new GitError("Failed to list sparse-checkout configuration", `git ${listCommand.join(' ')}`);
    }

    const currentSparseConfig = new TextDecoder().decode(stdout).trim().split("\n").filter(line => line !== "");
    log.info(`Current sparse-checkout paths: ${currentSparseConfig.join(', ')}`);

    // Compare with the desired include paths
    const missingPaths = sparseCheckoutRules.filter(path => !currentSparseConfig.includes(path));
    const extraPaths = currentSparseConfig.filter(path => !sparseCheckoutRules.includes(path));

    if (missingPaths.length > 0 || extraPaths.length > 0) {
      log.info("Sparse-checkout configuration has changed.");

      if (missingPaths.length > 0) {
        log.info(`Missing paths: ${missingPaths.join(", ")}`);
      }
      if (extraPaths.length > 0) {
        log.warn(`Extra paths: ${extraPaths.join(", ")}`);
      }

      log.info("Updating sparse-checkout paths...");
      await runGitCommand(workingDir, ["sparse-checkout", "set", ...sparseCheckoutRules]);
      log.info("Sparse-checkout configuration updated.");
    } else {
      log.info("Sparse-checkout configuration is already up to date.");
    }
  } catch (error) {
    if (error instanceof GitError) {
      handleCaughtError(error, `Error occurred while ensuring sparse checkout config for ${workingDir}`);
      throw error;
    }
    const gitError = new GitError(
      `Failed to configure sparse-checkout: ${error instanceof Error ? error.message : "Unknown error"}`,
      "git sparse-checkout operations"
    );
    handleCaughtError(gitError, `Error occurred while ensuring sparse checkout config for ${workingDir}`);
    throw gitError;
  }
}
