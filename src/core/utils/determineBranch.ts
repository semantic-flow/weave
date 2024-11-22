/**
 * Determines the branch to use for a repository.
 * @param {string} repoUrl - The repository URL.
 * @param {string} [defaultBranch="main"] - The fallback branch if detection fails.
 * @returns {Promise<string>} - The determined branch.
 */
export async function determineBranch(repoUrl: string, defaultBranch = "main"): Promise<string> {
  console.log(`Determining branch for ${repoUrl}...`);

  try {
    const remoteInfo = await new Deno.Command("/usr/bin/git", {
      args: ["ls-remote", "--symref", repoUrl, "HEAD"],
    }).output();
    const remoteOutput = new TextDecoder().decode(remoteInfo.stdout);

    const branchMatch = remoteOutput.match(/ref: refs\/heads\/([^\t\n]+)/);
    if (branchMatch) {
      const branch = branchMatch[1].trim();
      console.log(`Branch determined: ${branch}`);
      return branch;
    }
  } catch (err) {
    console.error(`Failed to determine branch for ${repoUrl}:`, err);
  }

  console.log(`Defaulting to branch: ${defaultBranch}`);
  return defaultBranch;
}
