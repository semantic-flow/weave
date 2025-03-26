import { log } from "../core/utils/logging.ts";
import { runGitCommand } from "../core/utils/runGitCommand.ts";
import { Frame } from "../core/Frame.ts";
import { handleCaughtError } from "../core/utils/handleCaughtError.ts";
import { RepoGitResult, GitInclusion } from "../types.ts";
import { getSyncStatus, isGitInclusion } from "../core/utils/gitInclusionUtils.ts";
import { GitError } from "./errors.ts";

/**
 * Pushes local changes to remote repositories for all active git inclusions.
 * @param {string} pushStrategy - Optional push strategy to override the inclusion's strategy.
 * @returns {Promise<RepoGitResult[]>} Array of results for each repository operation.
 */
export async function reposPush(pushStrategy?: string): Promise<RepoGitResult[]> {
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
      
      // If the repo is not ahead or dirty, there's nothing to push
      if (syncStatus !== 'ahead' && syncStatus !== 'dirty') {
        log.info(`Repository ${localPath} has no changes to push. Skipping...`);
        results.push({
          url,
          localPath,
          success: true,
          message: "No changes to push",
        });
        continue;
      }

      // If the repo has uncommitted changes, we should not push
      if (syncStatus === 'dirty') {
        log.warn(`Repository ${localPath} has uncommitted changes. Skipping push...`);
        results.push({
          url,
          localPath,
          success: false,
          message: "Repository has uncommitted changes. Commit changes before pushing.",
        });
        continue;
      }

      // Use the command-line push strategy if provided, otherwise use the inclusion's strategy
      const strategy = pushStrategy || inclusion.options.pushStrategy;
      const pushArgs = ["push"];
      
      // Add the appropriate strategy flag
      if (strategy === "force-with-lease") {
        pushArgs.push("--force-with-lease");
      } else if (strategy === "force") {
        pushArgs.push("--force");
      }
      // "no-force" is the default, so no additional flags needed

      if (frame.config.global.dryRun) {
        log.info(`Dry run: Pushing changes for ${localPath}...`);
        log.info(`Would run: git ${pushArgs.join(" ")}`);
        results.push({
          url,
          localPath,
          success: true,
          message: "Dry run: Would push changes",
        });
      } else {
        log.info(`Pushing changes for ${localPath}...`);
        try {
          const output = await runGitCommand(localPath, pushArgs);
          results.push({
            url,
            localPath,
            success: true,
            message: output,
          });
        } catch (error) {
          // Provide more detailed error messages based on the error
          const errorMessage = error instanceof Error ? error.message : "Unknown error";
          
          // Check for non-fast-forward error
          if (errorMessage.includes("non-fast-forward") || errorMessage.includes("fetch first")) {
            handleCaughtError(error, `Error pushing changes for ${localPath}:`);
            throw new GitError(
              `Cannot push because remote contains work that you do not have locally. Pull the remote changes first or use --push-strategy=force-with-lease to override.`,
              `git push ${strategy === "force-with-lease" ? "--force-with-lease" : strategy === "force" ? "--force" : ""}`
            );
          }
          
          // Generic error
          handleCaughtError(error, `Error pushing changes for ${localPath}:`);
          throw new GitError(
            "Failed to push changes", 
            `git push ${strategy === "force-with-lease" ? "--force-with-lease" : strategy === "force" ? "--force" : ""}`
          );
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
