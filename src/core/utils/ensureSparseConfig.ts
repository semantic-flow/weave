// src/core/utils/ensureSparseCongif.ts

import { log } from "@/core/utils/logging.ts";
import { runGitCommand } from "@/core/utils/runGitCommand.ts";
import { handleCaughtError } from "@/core/utils/handleCaughtError.ts";
import { GitError } from "@/core/errors.ts";
import { join } from "@/deps/path.ts";
import { ensureDir } from "@/deps/fs.ts";

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
    // Ensure the .git/info directory exists
    const gitInfoDir = join(workingDir, ".git", "info");
    try {
      await ensureDir(gitInfoDir);
      log.debug(`Ensured .git/info directory exists: ${gitInfoDir}`);
    } catch (error) {
      log.warn(`Could not ensure .git/info directory: ${error instanceof Error ? error.message : "Unknown error"}`);
      // Continue anyway, as the directory might already exist
    }

    // Try to get the current sparse-checkout configuration
    let currentSparseConfig: string[] = [];
    try {
      const listCommand = ["sparse-checkout", "list"];
      log.info(`Running command: git ${listCommand.join(' ')} in ${workingDir}`);
      const command = new Deno.Command("git", {
        args: listCommand,
        cwd: workingDir,
        stdout: "piped",
        stderr: "piped", // Capture stderr to check for errors
      });

      const { code, stdout } = await command.output();

      if (code === 0) {
        currentSparseConfig = new TextDecoder().decode(stdout).trim().split("\n").filter(line => line !== "");
        log.info(`Current sparse-checkout paths: ${currentSparseConfig.join(', ')}`);
      } else {
        // If sparse-checkout list fails, try to read the file directly
        log.warn("Git sparse-checkout list failed, trying to read sparse-checkout file directly");
        try {
          const sparseCheckoutFile = join(gitInfoDir, "sparse-checkout");
          const fileContent = await Deno.readTextFile(sparseCheckoutFile);
          currentSparseConfig = fileContent.trim().split("\n").filter(line => line !== "");
          log.info(`Read sparse-checkout file directly: ${currentSparseConfig.join(', ')}`);
        } catch (readError) {
          log.warn(`Could not read sparse-checkout file: ${readError instanceof Error ? readError.message : "Unknown error"}`);
          // If we can't read the file, assume it doesn't exist or is empty
          currentSparseConfig = [];
        }
      }
    } catch (error) {
      log.warn(`Error checking sparse-checkout configuration: ${error instanceof Error ? error.message : "Unknown error"}`);
      // If we can't check the configuration, assume it needs to be updated
      currentSparseConfig = [];
    }

    // Compare with the desired include paths
    const missingPaths = sparseCheckoutRules.filter(path => !currentSparseConfig.includes(path));
    const extraPaths = currentSparseConfig.filter(path => !sparseCheckoutRules.includes(path));

    if (missingPaths.length > 0 || extraPaths.length > 0 || currentSparseConfig.length === 0) {
      log.info("Sparse-checkout configuration needs to be updated.");

      if (missingPaths.length > 0) {
        log.info(`Missing paths: ${missingPaths.join(", ")}`);
      }
      if (extraPaths.length > 0) {
        log.warn(`Extra paths: ${extraPaths.join(", ")}`);
      }

      // Try to update using sparse-checkout command
      try {
        log.info("Updating sparse-checkout paths using git sparse-checkout set...");
        await runGitCommand(workingDir, ["sparse-checkout", "set", ...sparseCheckoutRules]);
        log.info("Sparse-checkout configuration updated.");
      } catch (error) {
        // If sparse-checkout set fails, try to write the file directly
        log.warn(`Could not update sparse-checkout using git command: ${error instanceof Error ? error.message : "Unknown error"}`);
        log.info("Trying to write sparse-checkout file directly...");
        
        try {
          const sparseCheckoutFile = join(gitInfoDir, "sparse-checkout");
          await Deno.writeTextFile(sparseCheckoutFile, sparseCheckoutRules.join("\n") + "\n");
          log.info("Sparse-checkout file written directly.");
        } catch (writeError) {
          throw new GitError(
            `Failed to write sparse-checkout file: ${writeError instanceof Error ? writeError.message : "Unknown error"}`,
            "write sparse-checkout file"
          );
        }
      }
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
