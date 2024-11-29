import { Inclusion } from "../types.ts";
import { ensureLocalRepoPath } from "./utils/ensureLocalRepoPath.ts";
import { determineDefaultBranch } from "./utils/determineDefaultBranch.ts";
import { exists } from "../deps/fs.ts";
import { join } from "../deps/path.ts";

export interface RepoCheckoutResult {
  url: string;
  localPath: string;
  status: 'success' | 'failed';
  message?: string;
  error?: Error;
}

export async function checkoutRepos(repoDir: string, inclusions: Inclusion[]): Promise<RepoCheckoutResult[]> {
  const results: RepoCheckoutResult[] = [];

  // Filter for only git inclusions
  const gitInclusions = inclusions.filter(inclusion => inclusion.type === 'git');

  for (const inclusion of gitInclusions) {
    const { url, options } = inclusion;
    const { include = [], exclude = [], branch: providedBranch } = inclusion.options || {};

    // Determine the actual branch to use
    const branch = providedBranch ?? await determineDefaultBranch(url);

    // Parse the URL and construct the local repository path
    const localRepoPath = await ensureLocalRepoPath(repoDir, url, branch);
    console.log(`Preparing repository at ${localRepoPath}...`);

    try {
      if (await exists(join(localRepoPath, ".git"))) {
        console.log(`Repository already exists at ${localRepoPath}.`);

        // Ensure sparse-checkout matches the desired configuration
        await ensureSparseCheckout(localRepoPath, include);

        // Optionally pull the latest changes
        if (autoPullBeforeBuild) {
          console.log(`Pulling latest changes for ${url}...`);
          await runGitCommand(localRepoPath, ["pull", "origin", branch]);
        }
      } else {
        console.log(`Cloning repository ${url} into ${localRepoPath}...`);
        await cloneAndSetupRepo(url, localRepoPath, include, branch);
      }
    }
  }
  return results;
}