import { calculateLocalRepoPath } from "./calculateLocalRepoPath.ts";
import { ensureDir } from "../../deps/fs.ts";
import { log } from "./logging.ts";

/**
 * Parses the URL and constructs the local repository path, ensuring the directory exists.
 *
 * @param {string} repoDir - The base directory for repositories.
 * @param {string} url - The repository URL.
 * @param {string} branch - The branch name.
 * @returns {Promise<string>} - The local repository path.
 */
export async function ensureLocalRepoPath(repoDir: string, url: string, branch: string): Promise<string> {
  const localRepoPath = await calculateLocalRepoPath(repoDir, url, branch);

  // Ensure the directory exists
  try {
    await ensureDir(localRepoPath);
  } catch (error) {
    if (error instanceof Error) {
      log.error(`Error occurred while ensuring ${localRepoPath}: ${error.message}`);
      log.debug(Deno.inspect(error, { colors: true }));
      throw new Error(`Failed to ensure directory exists: ${localRepoPath}. ${error.message}`);
    } else {
      log.error("An unknown error occurred.");
    }
  }
  return localRepoPath;
}
