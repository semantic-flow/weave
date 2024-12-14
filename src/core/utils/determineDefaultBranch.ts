import { log } from "./logging.ts";
import { runGitCommand } from "./runGitCommand.ts";
import { handleCaughtError } from "./handleCaughtError.ts";

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
      throw new Error(`No output returned for ${repoUrl}.`);
    }


    log.error(`Failed to match the branch for ${repoUrl}. Exiting.`);
  } catch (error) {
    handleCaughtError(error, `Error determining branch for ${repoUrl}:`);
  }
  throw new Error(`Unable to determine the default branch for ${repoUrl}.`);
}