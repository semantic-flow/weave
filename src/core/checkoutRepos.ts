import { log } from "./utils/logging.ts";
import { Inclusion } from "../types.ts";
import { exists } from "../deps/fs.ts";
import { join } from "../deps/path.ts";
import { ensureLocalRepoPath } from "./utils/ensureLocalRepoPath.ts";
import { determineDefaultBranch } from "./utils/determineDefaultBranch.ts";
import { ensureSparseCheckout } from "./utils/ensureSparseConfig.ts";
import { runGitCommand } from "./utils/runGitCommand.ts";
import { composeSparseCheckoutRules } from "./utils/composeSparseCheckoutRules.ts";

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
  const gitInclusions = inclusions
    .filter(inclusion => inclusion.type === 'git')
    .filter(inclusion => inclusion.options?.active !== false);

  for (const inclusion of gitInclusions) {
    const { url } = inclusion;
    const { include = [], exclude = [], excludeByDefault = false, branch: providedBranch } = inclusion.options || {};

    // Determine the actual branch to use
    const branch = providedBranch ?? await determineDefaultBranch(url);

    // Parse the URL and construct the local repository path
    const localRepoPath = await ensureLocalRepoPath(repoDir, url, branch);
    log.info(`Ensuring repository at ${localRepoPath}...`);

    if (excludeByDefault && include.length === 0) {
      log.warn(`Excluding all files by default, and no inclusions specified, so nothing to do ${url}...`);
      continue;
    }

    try {
      if (!await exists(join(localRepoPath, ".git"))) {
        log.info(`Initializing working directory at ${localRepoPath}...`);
        await runGitCommand(localRepoPath, ["init"]);
        log.info("Git working directory initialized.");

        console.log(`Adding remote origin: ${url}`);
        await runGitCommand(localRepoPath, ["remote", "add", "origin", url]);
      }

      console.log("Configuring sparse-checkout...");
      await runGitCommand(localRepoPath, ["config", "core.sparseCheckout", "true"]);

      const sparseCheckoutRules: string[] = composeSparseCheckoutRules(include, exclude, excludeByDefault);
      await ensureSparseCheckout(localRepoPath, sparseCheckoutRules);

      console.log(`Fetching branch '${branch}'...`);
      await runGitCommand(localRepoPath, ["fetch", "--depth", "1", "origin", branch]);

      console.log(`Checking out branch '${branch}'...`);
      await runGitCommand(localRepoPath, ["checkout", branch]);

      // If all operations are successful, push a success result
      results.push({
        url,
        localPath: localRepoPath,
        status: 'success',
        message: 'Repository checkout successfully completed.',
      });
    } catch (error) {
      if (error instanceof Error) {
        // On any error, log it and push a failure result
        log.error(`Error processing ${url}: ${error.message}`);
        results.push({
          url,
          localPath: localRepoPath,
          status: 'failed',
          message: error.message,
          error,
        });;
        log.debug(Deno.inspect(error, { colors: true }));
      } else {
        log.error("An unknown error occurred.");
        throw error;
      }
    }
  }
  return results;
}