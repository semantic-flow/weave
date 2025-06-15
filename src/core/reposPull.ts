import { log } from "@/core/utils/logging.ts";
import { runGitCommand } from "@/core/utils/runGitCommand.ts";
import { Frame } from "@/core/Frame.ts";
import { handleCaughtError } from "@/core/utils/handleCaughtError.ts";
import { RepoGitResult, GitInclusion } from "@/types.ts";
import { getSyncStatus, isGitInclusion } from "@/core/utils/gitInclusionUtils.ts";
import { GitError } from "@/core/errors.ts";

/**
 * Pulls the latest changes from remote repositories for all active git inclusions.
 * @param {string} pullStrategy - Optional pull strategy to override the inclusion's strategy.
 * @returns {Promise<RepoGitResult[]>} Array of results for each repository operation.
 */
export async function reposPull(pullStrategy?: string): Promise<RepoGitResult[]> {
  const results: RepoGitResult[] = [];
  const frame = Frame.getInstance();

  // Filter for only active git inclusions
  const gitInclusions = frame.resolvedInclusions
    .filter((inclusion): inclusion is GitInclusion => 
      isGitInclusion(inclusion) && inclusion.options.active);

  for (const inclusion of gitInclusions) {
    const { localPath, url } = inclusion;
    try {
      const syncStatus = await getSyncStatus(localPath);
      
      // If the repo has local changes, we should not pull as it might cause conflicts
      if (syncStatus === 'dirty') {
        log.warn(`Repository ${localPath} has uncommitted changes. Skipping pull...`);
        results.push({
          url,
          localPath,
          success: false,
          message: "Repository has uncommitted changes. Commit or stash changes before pulling.",
        });
        continue;
      }

      // Use the command-line pull strategy if provided, otherwise use the inclusion's strategy
      const strategy = pullStrategy || inclusion.options.pullStrategy;
      const pullArgs = ["pull"];
      
      // Add the appropriate strategy flag
      if (strategy === "ff-only") {
        pullArgs.push("--ff-only");
      } else if (strategy === "rebase") {
        pullArgs.push("--rebase");
      } else if (strategy === "merge") {
        pullArgs.push("--no-rebase");
      }

      if (frame.config.global.dryRun) {
        log.info(`Dry run: Pulling latest changes for ${localPath}...`);
        log.info(`Would run: git ${pullArgs.join(" ")}`);
        results.push({
          url,
          localPath,
          success: true,
          message: "Dry run: Would pull latest changes",
        });
      } else {
        log.info(`Pulling latest changes for ${localPath}...`);
        try {
          const output = await runGitCommand(localPath, pullArgs);
          results.push({
            url,
            localPath,
            success: true,
            message: output,
          });
        } catch (error) {
          // Provide more detailed error messages based on the error
          const errorMessage = error instanceof Error ? error.message : "Unknown error";
          
          // Check for divergent branches error
          if (errorMessage.includes("divergent branches") || errorMessage.includes("need to specify how to reconcile")) {
            const strategyMessage = strategy === "ff-only" 
              ? "Consider using --pull-strategy=rebase or --pull-strategy=merge, or resolve manually."
              : "Please resolve conflicts manually in the repository.";
            
            handleCaughtError(error, `Error pulling changes for ${localPath}:`);
            throw new GitError(
              `Branches have diverged and cannot be fast-forwarded. ${strategyMessage}`,
              `git pull ${strategy === "ff-only" ? "--ff-only" : strategy === "rebase" ? "--rebase" : "--no-rebase"}`
            );
          }
          
          // Check for conflicts error
          if (errorMessage.includes("CONFLICT") || errorMessage.includes("Automatic merge failed")) {
            handleCaughtError(error, `Error pulling changes for ${localPath}:`);
            throw new GitError(
              `Conflicts detected during ${strategy === "rebase" ? "rebase" : "merge"}. Please resolve conflicts manually in the repository.`,
              `git pull ${strategy === "rebase" ? "--rebase" : "--no-rebase"}`
            );
          }
          
          // Generic error
          handleCaughtError(error, `Error pulling changes for ${localPath}:`);
          throw new GitError("Failed to pull changes", `git pull ${strategy === "ff-only" ? "--ff-only" : strategy === "rebase" ? "--rebase" : "--no-rebase"}`);
        }
      }
    } catch (error) {
      // If it's already a GitError, use it directly
      if (error instanceof GitError) {
        handleCaughtError(error, `Error processing ${url}`);
        results.push({
          url,
          localPath,
          success: false,
          message: error.message,
          error,
        });
      } else {
        // Wrap other errors in GitError
        const gitError = new GitError(
          `Error processing repository: ${error instanceof Error ? error.message : "Unknown error"}`,
          "git operations"
        );
        handleCaughtError(gitError, `Error processing ${url}`);
        results.push({
          url,
          localPath,
          success: false,
          message: gitError.message,
          error: gitError,
        });
      }
    }
  }
  return results;
}
