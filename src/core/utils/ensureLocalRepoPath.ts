import { join } from "../../deps/path.ts";
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
  const urlForParsing = url.startsWith("git@")
    ? new URL(`https://${url.replace("git@", "").replace(":", "/")}`)
    : new URL(url);

  const hostname = urlForParsing.hostname;
  const parent = urlForParsing.pathname.split("/")[1];
  const repoName = urlForParsing.pathname.split("/")[2].replace(".git", "");

  const localRepoPath = join(repoDir, `${hostname}/${parent}/${repoName}.${branch}`);

  // Ensure the directory exists
  try {
    await ensureDir(localRepoPath);
  } catch (error) {
    if (error instanceof Error) {
      log.error(`Error occurred while ensuring ${localRepoPath}: ${error.message}`);
      log.debug(Deno.inspect(error, { colors: true }));
    } else {
      log.error("An unknown error occurred.");
    }
  }
  return localRepoPath;
}
