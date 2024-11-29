import { log } from "./logging.ts";
import { runGitCommand } from "./runGitCommand.ts";

/**
 * Determines the branch to use for a repository.
 * @param {string} repoUrl - The repository URL.
 * @returns {Promise<string>} - The determined branch.
 */

export async function determineDefaultBranch(repoUrl: string): Promise<string> {
  log.info(`Determining branch for ${repoUrl}...`);

  try {
    const args = ["ls-remote", "--symref", repoUrl, "HEAD"];

    // Retrieve output using runGitCommand, executed from the current directory
    const remoteOutput = await runGitCommand('.', args);

    const branchMatch = remoteOutput.match(/ref: refs\/heads\/([^\t\n]+)/);

    if (branchMatch) {
      const branch = branchMatch[1].trim();
      log.info(`Branch determined: ${branch}`);
      return branch;
    }

    log.error(`Failed to match the branch for ${repoUrl}. Exiting.`);
  } catch (err) {
    if (err instanceof Error) {
      log.error(`Error determining branch for ${repoUrl}: ${err.message}`);
      log.debug(Deno.inspect(err, { colors: true }));
    } else {
      log.error("An unknown error occurred.");
    }
  }
  throw new Error(`Unable to determine the default branch for ${repoUrl}.`);
}