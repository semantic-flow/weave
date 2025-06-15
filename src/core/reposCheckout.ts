import { log } from "@/core/utils/logging.ts";
import { RepoGitResult } from "@/types.ts";
import { exists } from "@/deps/fs.ts";
import { join } from "@/deps/path.ts";
import { ensureSparseCheckout } from "@/core/utils/ensureSparseConfig.ts";
import { runGitCommand } from "@/core/utils/runGitCommand.ts";
import { composeSparseCheckoutRules } from "@/core/utils/composeSparseCheckoutRules.ts";
import { handleCaughtError } from "@/core/utils/handleCaughtError.ts";
import { Frame } from "@/core/Frame.ts";
import { ensureDir } from "@/deps/fs.ts";
import { GitError } from "@/core/errors.ts";
import { determineWorkingBranch } from "@/core/utils/determineWorkingBranch.ts";

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
      await ensureDir(workingDir);

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
      // Fetch only the specific branch and update only that ref
      await runGitCommand(workingDir, ["fetch", "--depth", "1", "origin", `${branch}:refs/remotes/origin/${branch}`]);

      // Create a local branch that tracks the remote branch
      console.log(`Creating local branch '${branch}' that tracks 'origin/${branch}'...`);
      try {
        // Check if the branch already exists
        const branchExists = await runGitCommand(workingDir, ["branch", "--list", branch]);
        
        if (!branchExists.trim()) {
          // Branch doesn't exist, create it
          await runGitCommand(workingDir, ["branch", "--track", branch, `origin/${branch}`]);
        }
      } catch (error) {
        log.warn(`Could not create tracking branch: ${error instanceof Error ? error.message : "Unknown error"}`);
        // Continue anyway, as checkout might still work
      }

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
