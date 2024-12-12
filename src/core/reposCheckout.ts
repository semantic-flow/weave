import { log } from "./utils/logging.ts";
import { RepoGitResult } from "../types.ts";
import { exists } from "../deps/fs.ts";
import { join } from "../deps/path.ts";
import { ensureWorkingDirectory } from "./utils/ensureWorkingDirectory.ts";
import { ensureSparseCheckout } from "./utils/ensureSparseConfig.ts";
import { runGitCommand } from "./utils/runGitCommand.ts";
import { composeSparseCheckoutRules } from "./utils/composeSparseCheckoutRules.ts";
import { handleCaughtError } from "./utils/handleCaughtError.ts";
import { Frame } from "../core/Frame.ts";

export async function reposCheckout(): Promise<RepoGitResult[]> {
  const results: RepoGitResult[] = [];
  const frame = Frame.getInstance();
  const workspaceDir = frame.config.global.workspaceDir;
  const inclusions = frame.config.inclusions;


  // Filter for only git inclusions
  const gitInclusions = inclusions
    .filter(inclusion => inclusion.type === 'git')
    .filter(inclusion => inclusion.options?.active !== false);

  for (const inclusion of gitInclusions) {
    const { url } = inclusion;
    const { include, exclude, excludeByDefault, branch } = inclusion.options;

    // Parse the URL and construct the local repository path
    const workingDir = await ensureWorkingDirectory(workspaceDir, url, branch);
    log.info(`Ensuring repository at ${workingDir}...`);

    if (excludeByDefault && include.length === 0) {
      log.warn(`Excluding all files by default, and no inclusions specified, so nothing to do for ${url}...`);
      continue;
    }

    try {
      if (!await exists(join(workingDir, ".git"))) {
        log.info(`Initializing working directory at ${workingDir}...`);
        await runGitCommand(workingDir, ["init"]);
        log.info("Git working directory initialized.");

        console.log(`Adding remote origin: ${url}`);
        await runGitCommand(workingDir, ["remote", "add", "origin", url]);
      }

      console.log("Configuring sparse-checkout...");
      await runGitCommand(workingDir, ["config", "core.sparseCheckout", "true"]);

      const sparseCheckoutRules: string[] = composeSparseCheckoutRules(include, exclude, excludeByDefault);
      await ensureSparseCheckout(workingDir, sparseCheckoutRules);

      console.log(`Fetching branch '${branch}'...`);
      await runGitCommand(workingDir, ["fetch", "--depth", "1", "origin", branch]);

      console.log(`Checking out branch '${branch}'...`);
      await runGitCommand(workingDir, ["checkout", branch]);

      // If all operations are successful, push a success result
      results.push({
        url,
        localPath: workingDir,
        status: 'success',
        message: 'Repository checkout successfully completed.',
      });
    } catch (error) {
      handleCaughtError(error, `Error processing ${url}:`);
      if (error instanceof Error) {
        // On any error, log it and push a failure result
        results.push({
          url,
          localPath: workingDir,
          status: 'failed',
          message: error.message,
          error,
        });
      }
    }
  }
  return results;
}