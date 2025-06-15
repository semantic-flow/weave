import { log } from "@/core/utils/logging.ts";
import { Frame } from "@/core/Frame.ts";
import { RepoGitResult } from "@/types.ts";
import { reposCommit } from "@/core/reposCommit.ts";
import { reposPull } from "@/core/reposPull.ts";
import { reposPush } from "@/core/reposPush.ts";

/**
 * Synchronizes repositories by committing, pulling, and pushing changes.
 * @param {string} commitMessage - Optional commit message to use.
 * @param {string} pullStrategy - Optional pull strategy to override the inclusion's strategy.
 * @param {string} pushStrategy - Optional push strategy to override the inclusion's strategy.
 * @returns {Promise<RepoGitResult[]>} Array of results for each repository operation.
 */
export async function reposSync(commitMessage?: string, pullStrategy?: string, pushStrategy?: string): Promise<RepoGitResult[]> {
  const results: RepoGitResult[] = [];
  // Frame is used for configuration but not directly in this function
  const _frame = Frame.getInstance();

  log.info("Starting repository synchronization...");
  
  // Step 1: Commit changes
  log.info("Step 1: Committing changes...");
  const commitResults = await reposCommit(commitMessage);
  results.push(...commitResults);
  
  // Step 2: Pull changes
  log.info("Step 2: Pulling changes...");
  const pullResults = await reposPull(pullStrategy);
  results.push(...pullResults);
  
  // Step 3: Push changes
  log.info("Step 3: Pushing changes...");
  const pushResults = await reposPush(pushStrategy);
  results.push(...pushResults);
  
  log.info("Repository synchronization completed.");
  
  return results;
}
