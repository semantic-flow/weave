import { join } from "https://deno.land/std/path/mod.ts";
import { ensureDir } from "https://deno.land/std/fs/mod.ts";

/**
 * Parses the URL and constructs the local repository path, ensuring the directory exists.
 *
 * @param {string} repoDir - The base directory for repositories.
 * @param {string} url - The repository URL.
 * @param {string} branch - The branch name.
 * @returns {Promise<string>} - The local repository path.
 */
export async function getLocalRepoPath(repoDir: string, url: string, branch: string): Promise<string> {
  const urlForParsing = url.startsWith("git@")
    ? new URL(`https://${url.replace("git@", "").replace(":", "/")}`)
    : new URL(url);

  const hostname = urlForParsing.hostname;
  const parent = urlForParsing.pathname.split("/")[1];
  const repoName = urlForParsing.pathname.split("/")[2].replace(".git", "");

  const localRepoPath = join(repoDir, `${hostname}/${parent}/${repoName}.${branch}`);

  // Ensure the directory exists
  await ensureDir(localRepoPath);

  return localRepoPath;
}
