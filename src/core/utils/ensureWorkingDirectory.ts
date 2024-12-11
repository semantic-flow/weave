import { determineDefaultWorkingDirectory } from "./determineDefaultWorkingDirectory.ts";
import { ensureDir } from "../../deps/fs.ts";
import { handleCaughtError } from "./handleCaughtError.ts";

/**
 * Parses the URL and constructs the local repository path, ensuring the directory exists.
 *
 * @param {string} workspaceDir - The base directory for repositories.
 * @param {string} url - The repository URL.
 * @param {string} branch - The branch name.
 * @returns {Promise<string>} - The local repository path.
 */
export async function ensureWorkingDirectory(workspaceDir: string, url: string, branch: string): Promise<string> {
  const workingDir = determineDefaultWorkingDirectory(workspaceDir, url, branch);

  // Ensure the directory exists
  try {
    await ensureDir(workingDir);
  } catch (error) {
    handleCaughtError(error, `Error occurred while ensuring ${workingDir}:`);
    throw new Error(`Failed to ensure directory exists: ${workingDir}. ${error.message}`);
  }
  return workingDir;
}
