import { log } from "./logging.ts";
import { runGitCommand } from "./runGitCommand.ts";
import { handleCaughtError } from "./handleCaughtError.ts";
import { GitError } from "../errors.ts";

/**
 * Determines the branch to use for a repository.
 * @param {string} repoUrl - The repository URL.
 * @returns {Promise<string>} - The determined branch.
 */

export async function determineDefaultBranch(repoUrl: string): Promise<string> {
  log.debug(`Determining branch for ${repoUrl}...`);

  try {
    const args = ["ls-remote", "--symref", repoUrl, "HEAD"];

    let remoteOutput;

    // Retrieve output using runGitCommand, executed from the current directory
    try {
      remoteOutput = await runGitCommand('.', args);
    } catch (error) {
      handleCaughtError(
        error,
        `Error running git ls-remote for ${repoUrl}:`
      );
      throw error;
    }
    
    if (remoteOutput) {
      const branchMatch = remoteOutput.match(/ref: refs\/heads\/([^\t\n]+)/);

      if (branchMatch) {
        const branch = branchMatch[1].trim();
        log.info(`Default branch determined for ${repoUrl}: ${branch}`);
        return branch;
      }
    } else {
      throw new GitError(`No output returned from ls-remote`, `ls-remote --symref ${repoUrl} HEAD`);
    }


    throw new GitError(`Failed to match the branch in ls-remote output`, `ls-remote --symref ${repoUrl} HEAD`);
  } catch (error) {
    if (error instanceof GitError) {
      throw error;
    }
    throw new GitError(
      `Unable to determine the default branch: ${error instanceof Error ? error.message : "Unknown error"}`,
      `ls-remote --symref ${repoUrl} HEAD`
    );
  }
}
