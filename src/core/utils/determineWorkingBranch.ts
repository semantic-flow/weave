import { log } from "./logging.ts";
import { runGitCommand } from "./runGitCommand.ts";
import { GitError } from "../errors.ts";

export async function determineWorkingBranch(workingDir: string): Promise<string> {
  try {
    const branch = await runGitCommand(workingDir, ["rev-parse", "--abbrev-ref", "HEAD"]);
    if (!branch) {
      throw new GitError("No branch name returned", "git rev-parse --abbrev-ref HEAD");
    }
    log.debug(`Working branch: ${branch}`);
    return branch.trim();
  } catch (error) {
    if (error instanceof GitError) {
      throw error;
    }
    throw new GitError(
      `Unable to determine working branch: ${error instanceof Error ? error.message : "Unknown error"}`,
      "git rev-parse --abbrev-ref HEAD"
    );
  }
}
