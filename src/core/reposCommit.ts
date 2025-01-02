import { log } from "../core/utils/logging.ts";
import { runGitCommand } from "../core/utils/runGitCommand.ts";
import { Frame } from "../core/Frame.ts";
import { handleCaughtError } from "../core/utils/handleCaughtError.ts";
import { RepoGitResult } from "../types.ts";
import { getSyncStatus } from "../core/utils/gitInclusionUtils.ts";
import { GitError } from "./errors.ts";



export async function reposCommit(commitMessage?: string): Promise<RepoGitResult[]> {
  const results: RepoGitResult[] = [];
  const frame = Frame.getInstance();
  ;

  // Filter for only git inclusions
  const gitInclusions = frame.resolvedInclusions
    .filter(inclusion => inclusion.type === 'git');

  for (const  inclusion of gitInclusions) {
    const { localPath, url } = inclusion;
    try {
      if (await getSyncStatus(localPath) !== 'dirty') {
        log.info(`No changes to commit in ${localPath}. Skipping...`);
        continue;
      }

      const commitArgs = ["commit", "-m", '"' + (commitMessage || "Weave commit") + '"'];

      if (frame.config.global.dryRun) {
        log.info(`Dry run: Committing changes in ${localPath}...`);
        log.info(`Would run: git add .`);
        log.info(`Would run: git ${commitArgs.join(" ")}`);
      } else {
        log.info(`Committing changes in ${localPath}...`);
        try {
          await runGitCommand(localPath, ["add", "."]);
        } catch (error) {
          handleCaughtError(error, `Error adding changes in ${localPath}:`);
          throw new GitError("Failed to stage changes", "git add .");
        }
        try {
          const output = await runGitCommand(localPath, commitArgs);
          // If all operations are successful, push a success result
          results.push({
            url,
            localPath: localPath,
            success: true,
            message: output,
          });
        } catch (error) {
          handleCaughtError(error, `Error committing changes in ${localPath}:`);
          throw new GitError("Failed to commit changes", `git commit -m "${commitMessage || "Weave commit"}"`);
        }

      }
    } catch (error) {
      // If it's already a GitError, use it directly
      if (error instanceof GitError) {
        handleCaughtError(error, `Error processing ${url}`);
        results.push({
          url,
          localPath: localPath,
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
          localPath: localPath,
          success: false,
          message: gitError.message,
          error: gitError,
        });
      }
    }
  }
  return results;
}
