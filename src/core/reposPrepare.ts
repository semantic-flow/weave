import { log } from "../core/utils/logging.ts";
import { Frame } from "../core/Frame.ts";
import { RepoGitResult, GitInclusion } from "../types.ts";
import { isGitInclusion } from "../core/utils/gitInclusionUtils.ts";
import { reposCheckout } from "./reposCheckout.ts";
import { reposPull } from "./reposPull.ts";
import { reposPush } from "./reposPush.ts";

/**
 * Prepares repositories by checking them out if necessary, pulling if autoPullBeforeBuild is true,
 * and pushing if autoPushBeforeBuild is true.
 * @param {string} pullStrategy - Optional pull strategy to override the inclusion's strategy.
 * @param {string} pushStrategy - Optional push strategy to override the inclusion's strategy.
 * @returns {Promise<RepoGitResult[]>} Array of results for each repository operation.
 */
export async function reposPrepare(pullStrategy?: string, pushStrategy?: string): Promise<RepoGitResult[]> {
  const results: RepoGitResult[] = [];
  const frame = Frame.getInstance();

  log.info("Preparing repositories...");
  
  // Step 1: Checkout repositories if necessary
  log.info("Step 1: Checking out repositories...");
  const checkoutResults = await reposCheckout();
  results.push(...checkoutResults);
  
  // Filter for only active git inclusions
  const gitInclusions = frame.resolvedInclusions
    .filter((inclusion): inclusion is GitInclusion => 
      isGitInclusion(inclusion) && inclusion.options.active);
  
  // Step 2: Pull changes if autoPullBeforeBuild is true
  const pullInclusions = gitInclusions.filter(inclusion => inclusion.options.autoPullBeforeBuild);
  if (pullInclusions.length > 0) {
    log.info("Step 2: Pulling changes for repositories with autoPullBeforeBuild=true...");
    const pullResults = await reposPull(pullStrategy);
    results.push(...pullResults);
  } else {
    log.info("Step 2: No repositories with autoPullBeforeBuild=true. Skipping pull...");
  }
  
  // Step 3: Push changes if autoPushBeforeBuild is true
  const pushInclusions = gitInclusions.filter(inclusion => inclusion.options.autoPushBeforeBuild);
  if (pushInclusions.length > 0) {
    log.info("Step 3: Pushing changes for repositories with autoPushBeforeBuild=true...");
    const pushResults = await reposPush(pushStrategy);
    results.push(...pushResults);
  } else {
    log.info("Step 3: No repositories with autoPushBeforeBuild=true. Skipping push...");
  }
  
  log.info("Repository preparation completed.");
  
  return results;
}
