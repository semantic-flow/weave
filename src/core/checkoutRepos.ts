import { Frame } from "./Frame.ts";
import { WeaveConfig } from "../types.ts";

export function checkoutRepos(config: WeaveConfig) {
  const { repoDir, dest } = config.global;
  const { inclusions } = config;

  for (const inclusion of inclusions) {
    const { url, options } = inclusion;
    const { include = [], autoPullBeforeBuild = false, exclude = [], excludeByDefault = false, autoPushBeforeBuild = false } = options;

    // Determine the branch
    const branch = await determineBranch(url, "main");

    // Parse the URL and construct the local repository path
    const localRepoPath = await getLocalRepoPath(repoDir, url, branch);
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
}