import { exists } from "https://deno.land/std/fs/mod.ts";
import { join } from "https://deno.land/std/path/mod.ts";

import { ensureSparseCheckout } from "./ensureSparseCheckout.ts";
import { copyIncludedPaths } from "./copyIncludedPaths.ts";
import { determineBranch } from "./determineBranch.ts";
import { getLocalRepoPath } from "./getLocalRepoPath.ts"

/**
 * Handles repository preparation, including initialization, sparse-checkout configuration,
 * and optionally pulling updates.
 */
export async function prepareInclusions(
  repoDir: string,
  wovenDir: string,
  inclusions: Array<{ url: string; options?: { include?: string[]; autoPullBeforeBuild?: boolean } }>
) {
  for (const { url, options = {} } of inclusions) {
    const { include = [], autoPullBeforeBuild = false } = options;

    // Parse the URL and construct the local repository path
    const localRepoPath = await getLocalRepoPath(repoDir, url, await determineBranch(url, "main"));
    console.log(`Preparing repository at ${localRepoPath}...`);

    try {
      if (await exists(join(localRepoPath, ".git"))) {
        console.log(`Repository already exists at ${localRepoPath}.`);

        // Ensure sparse-checkout matches the desired configuration
        await ensureSparseCheckout(localRepoPath, include);

        // Optionally pull the latest changes
        if (autoPullBeforeBuild) {
          console.log(`Pulling latest changes for ${url}...`);
          await new Deno.Command("/usr/bin/git", {
            args: ["pull", "origin", await determineBranch(url, "main")],
            cwd: localRepoPath,
          }).output();
        }
      } else {
        console.log(`Initializing repository at ${localRepoPath}...`);
        await new Deno.Command("/usr/bin/git", { args: ["init"], cwd: localRepoPath }).output();
        console.log("Git repository initialized.");

        console.log(`Adding remote origin: ${url}`);
        await new Deno.Command("/usr/bin/git", {
          args: ["remote", "add", "origin", url],
          cwd: localRepoPath,
        }).output();

        console.log("Configuring sparse-checkout...");
        await new Deno.Command("/usr/bin/git", {
          args: ["config", "core.sparseCheckout", "true"],
          cwd: localRepoPath,
        }).output();

        // Set sparse-checkout paths during initialization
        await ensureSparseCheckout(localRepoPath, include);

        console.log(`Fetching branch '${await determineBranch(url, "main")}'...`);
        await new Deno.Command("/usr/bin/git", {
          args: ["fetch", "--depth", "1", "origin", await determineBranch(url, "main")],
          cwd: localRepoPath,
        }).output();

        console.log(`Checking out branch '${await determineBranch(url, "main")}'...`);
        await new Deno.Command("/usr/bin/git", {
          args: ["checkout", await determineBranch(url, "main")],
          cwd: localRepoPath,
        }).output();
      }

      // Copy included paths into the combined directory
      await copyIncludedPaths(localRepoPath, wovenDir, options);
    } catch (err) {
      console.error(`Error processing repository ${url}:`, err);
    }
  }
}
