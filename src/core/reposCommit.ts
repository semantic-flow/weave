import { log } from "../core/utils/logging.ts";
import { runGitCommand } from "../core/utils/runGitCommand.ts"; // Ensure you have this utility
import { Frame } from "../core/Frame.ts";
import { handleCaughtError } from "../core/utils/handleCaughtError.ts";
import { ResolvedInclusion, RepoGitResult } from "../types.ts";



export async function reposCommit(commitMessage?: string): Promise<RepoGitResult[]> {
  const results: RepoGitResult[] = [];
  const frame = Frame.getInstance();
  const { inclusions } = frame.config;

  // Filter for only git inclusions
  const gitInclusions = inclusions
    .filter(inclusion => inclusion.type === 'git')
    .filter(inclusion => inclusion.options?.active !== false);

  for (const inclusion of gitInclusions) {
    const { localPath, url } = inclusion;
    try {
      log.info(`Committing changes in ${localPath}...`);
      await runGitCommand(localPath, ["add", "."]);
      const output = await runGitCommand(localPath, ["commit", "-m", "\"" + (commitMessage || "reposCommit()") + "\""]);
      // If all operations are successful, push a success result
      results.push({
        url,
        localPath: localPath,
        status: 'success',
        message: output,
      });
    } catch (error) {
      handleCaughtError(error, `Error processing ${url}:`);
      if (error instanceof Error) {
        // On any error, log it and push a failure result
        results.push({
          url,
          localPath: localPath,
          status: 'failed',
          message: error.message,
          error,
        });
      }
    }
  }
  return results;
}