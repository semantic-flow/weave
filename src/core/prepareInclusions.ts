import { exists } from "https://deno.land/std/fs/mod.ts";
import { join } from "https://deno.land/std/path/mod.ts";

import { ensureSparseCheckout } from "./utils/ensureSparseCheckout.ts";
import { copyIncludedPaths } from "./utils/copyIncludedPaths.ts";
import { determineBranch } from "./utils/determineBranch.ts";
import { getLocalRepoPath } from "./utils/getLocalRepoPath.ts"
import { Inclusion, WeaveConfig } from "./utils/weave_config.ts";

/**
 * Handles repository preparation, including initialization, sparse-checkout configuration,
 * and optionally pulling updates.
 */
export async function prepareInclusions(config: WeaveConfig): Promise<void> {
  const { repoDir, wovenDir } = config.global;
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

      // Copy included paths into the woven directory
      await copyIncludedPaths(localRepoPath, wovenDir, { include, exclude, excludeByDefault });

      // Optionally handle autoPushBeforeBuild
      if (autoPushBeforeBuild) {
        console.log(`Pushing changes in ${localRepoPath}...`);
        await runGitCommand(localRepoPath, ["push", "origin", branch]);
      }

    } catch (err) {
      console.error(`Error processing repository ${url}:`, err);
    }
  }
}

/**
 * Clones and sets up a repository with sparse-checkout.
 */
async function cloneAndSetupRepo(url: string, localRepoPath: string, includePaths: string[], branch: string): Promise<void> {
  console.log(`Initializing repository at ${localRepoPath}...`);
  await runGitCommand(localRepoPath, ["init"]);
  console.log("Git repository initialized.");

  console.log(`Adding remote origin: ${url}`);
  await runGitCommand(localRepoPath, ["remote", "add", "origin", url]);

  console.log("Configuring sparse-checkout...");
  await runGitCommand(localRepoPath, ["config", "core.sparseCheckout", "true"]);

  // Set sparse-checkout paths during initialization
  await ensureSparseCheckout(localRepoPath, includePaths);

  console.log(`Fetching branch '${branch}'...`);
  await runGitCommand(localRepoPath, ["fetch", "--depth", "1", "origin", branch]);

  console.log(`Checking out branch '${branch}'...`);
  await runGitCommand(localRepoPath, ["checkout", branch]);
}

