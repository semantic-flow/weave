import { determineDefaultWorkingDirectory } from "./determineDefaultWorkingDirectory.ts";
import { ensureDir } from "../../deps/fs.ts";
import { log } from "./logging.ts";

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
    if (error instanceof Error) {
      log.error(`Error occurred while ensuring ${workingDir}: ${error.message}`);
      log.debug(Deno.inspect(error, { colors: true }));
      throw new Error(`Failed to ensure directory exists: ${workingDir}. ${error.message}`);
    } else {
      log.error("An unknown error occurred.");
    }
  }
  return workingDir;
}
