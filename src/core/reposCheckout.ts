import { log } from "./utils/logging.ts";
import { RepoGitResult } from "../types.ts";
import { exists } from "../deps/fs.ts";
import { join } from "../deps/path.ts";
import { ensureSparseCheckout } from "./utils/ensureSparseConfig.ts";
import { runGitCommand } from "./utils/runGitCommand.ts";
import { composeSparseCheckoutRules } from "./utils/composeSparseCheckoutRules.ts";
import { handleCaughtError } from "./utils/handleCaughtError.ts";
import { Frame } from "../core/Frame.ts";
import { ensureDir } from "../deps/fs.ts";
import { GitError } from "./errors.ts";
import { determineWorkingBranch } from "./utils/determineWorkingBranch.ts";

export async function reposCheckout(): Promise<RepoGitResult[]> {
  const results: RepoGitResult[] = [];
  const frame = Frame.getInstance();
  const inclusions = frame.resolvedInclusions;
  const workspaceDir = frame.config.global.workspaceDir;

  // Create workspace directory if it doesn't exist
  try {
    await ensureDir(workspaceDir);
    log.debug(`Ensured workspace directory exists: ${workspaceDir}`);
  } catch (error) {
    handleCaughtError(error, `Failed to create workspace directory: ${workspaceDir}`);
    throw new GitError(`Failed to create workspace directory: ${workspaceDir}`, "workspace directory creation");
  }


  // Filter for only git inclusions
  const gitInclusions = inclusions
    .filter(inclusion => inclusion.type === 'git')
    .filter(inclusion => inclusion.options?.active !== false);

  for (const inclusion of gitInclusions) {
    const { url, localPath: workingDir } = inclusion;
    const { include, exclude, excludeByDefault, branch } = inclusion.options;


    if (excludeByDefault && include.length === 0) {
      log.warn(`Excluding all files by default, and no inclusions specified, so nothing to do for ${workingDir}...`);
      continue;
    }

    try {
      // create the directory if it doesn't exist
      ensureDir(workingDir);

      if (!await exists(join(workingDir, ".git"))) {
        log.info(`Initializing working directory at ${workingDir}...`);
        await runGitCommand(workingDir, ["init"]);
        log.info("Git working directory initialized.");

        console.log(`Adding remote origin: ${url}`);
        await runGitCommand(workingDir, ["remote", "add", "origin", url]);
      }

      console.log("Configuring sparse-checkout...");
      await runGitCommand(workingDir, ["config", "core.sparseCheckout", "true"]);

      const sparseCheckoutRules: string[] = composeSparseCheckoutRules(include, exclude, excludeByDefault);
      await ensureSparseCheckout(workingDir, sparseCheckoutRules);

      console.log(`Fetching branch '${branch}'...`);
      await runGitCommand(workingDir, ["fetch", "--depth", "1", "origin", branch]);

      // Check if the repository is already on the correct branch
      let currentBranch = "";
      try {
        currentBranch = await determineWorkingBranch(workingDir);
      } catch (error) {
        // If we can't determine the current branch, proceed with checkout
        log.debug(`Could not determine current branch for ${workingDir}: ${error instanceof Error ? error.message : "Unknown error"}`);
      }

      if (currentBranch === branch) {
        console.log(`Already on branch '${branch}'`);
      } else {
        console.log(`Checking out branch '${branch}'...`);
        await runGitCommand(workingDir, ["checkout", branch]);
      }

      // If all operations are successful, push a success result
      results.push({
        url,
        localPath: workingDir,
        success: true,
        message: 'Repository checkout successfully completed.',
      });
    } catch (error) {
      // If it's already a GitError, use it directly
      if (error instanceof GitError) {
        handleCaughtError(error, `Error processing ${url}`);
        results.push({
          url,
          localPath: workingDir,
          success: false,
          message: error.message,
          error,
        });
      } else {
        // Wrap other errors in GitError with more context
        const gitError = new GitError(
          `Repository checkout failed: ${error instanceof Error ? error.message : "Unknown error"}`,
          "git checkout operations"
        );
        handleCaughtError(gitError, `Error processing ${url}`);
        results.push({
          url,
          localPath: workingDir,
          success: false,
          message: gitError.message,
          error: gitError,
        });
      }
    }
  }
  return results;
}
