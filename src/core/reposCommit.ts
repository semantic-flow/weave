import { log } from "../core/utils/logging.ts";
import { runGitCommand } from "../core/utils/runGitCommand.ts"; // Ensure you have this utility
import { Frame } from "../core/Frame.ts";
import { handleCaughtError } from "../core/utils/handleCaughtError.ts";
import { RepoGitResult } from "../types.ts";
import { getSyncStatus } from "../core/utils/gitInclusionUtils.ts";



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
          throw new Error(`Error adding changes to commit.`);
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
          throw new Error(`Error committing changes.`);
        }

      }
    } catch (error) {
      handleCaughtError(error, `Error processing ${url}:`);
      if (error instanceof Error) {
        // On any error, log it and push a failure result
        results.push({
          url,
          localPath: localPath,
          success: false,
          message: error.message,
          error,
        });
      }
    }
  }
  return results;
}