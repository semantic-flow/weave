import { Frame } from "../core/Frame.ts";
import { handleCaughtError } from "../core/utils/handleCaughtError.ts";
import { InclusionListItem, GitInclusion } from "../types.ts";
import { isGitInclusion, checkGitInclusion } from "../core/utils/gitInclusionUtils.ts";
import { log } from "../core/utils/logging.ts";
import { join } from "../deps/path.ts";
import { exists } from "../deps/fs.ts";
import { runGitCommand } from "./utils/runGitCommand.ts";

export interface VerifyOptions {
  ignoreBehind?: boolean;
  ignoreAhead?: boolean;
  ignoreDivergent?: boolean;
  ignoreCheckoutConsistency?: boolean;
  ignoreMissing?: boolean;
  ignoreDirty?: boolean;
}

export interface VerifyResult {
  inclusion: InclusionListItem;
  isReady: boolean;
  issues: string[];
  suggestions: string[];
}

/**
 * Verifies that git repositories are ready for building.
 * @param options Options to control verification behavior
 * @returns Array of verification results for each repository
 */
export async function reposVerify(options: VerifyOptions = {}): Promise<VerifyResult[]> {
  const results: VerifyResult[] = [];
  const frame = Frame.getInstance();
  const { resolvedInclusions } = frame;

  // Filter for only git inclusions
  const gitInclusions = resolvedInclusions
    .filter(isGitInclusion);

  for (const inclusion of gitInclusions) {
    try {
      // Get basic inclusion info
      const inclusionInfo = await checkGitInclusion(inclusion);
      
      // Initialize verification result
      const verifyResult: VerifyResult = {
        inclusion: inclusionInfo,
        isReady: true,
        issues: [],
        suggestions: [],
      };

      // Check if repository exists
      if (!inclusionInfo.present) {
        verifyResult.isReady = false;
        verifyResult.issues.push("Repository is missing");
        verifyResult.suggestions.push("Run 'weave repos checkout' to initialize the repository");
        
        // If repository is missing and we're not ignoring missing repos (both global and per-inclusion), mark as not ready
        if (!options.ignoreMissing && !inclusion.options.ignoreMissing) {
          results.push(verifyResult);
          continue;
        }
      }

      // Check sync status
      await verifySyncStatus(inclusion, verifyResult, options);
      
      // Check sparse checkout settings
      await verifySparseCheckout(inclusion, verifyResult, options);

      // Update overall ready status based on issues
      verifyResult.isReady = verifyResult.issues.length === 0;
      
      results.push(verifyResult);
    } catch (error) {
      handleCaughtError(error, `Failed to verify repository ${inclusion.name || inclusion.url}`);
      
      // Add a failed result
      const failedResult: VerifyResult = {
        inclusion: {
          order: inclusion.order,
          name: inclusion.name || inclusion.url,
          active: inclusion.options.active,
          present: false,
          syncStatus: "unknown",
          collisionStrategy: inclusion.options.collisionStrategy,
          updateStrategy: inclusion.options.updateStrategy,
          include: inclusion.options.include,
          exclude: inclusion.options.exclude,
          excludeByDefault: inclusion.options.excludeByDefault,
          autoPullBeforeBuild: inclusion.options.autoPullBeforeBuild,
          autoPushBeforeBuild: inclusion.options.autoPushBeforeBuild,
          type: "git",
        },
        isReady: false,
        issues: [`Error verifying repository: ${error instanceof Error ? error.message : "Unknown error"}`],
        suggestions: ["Check repository configuration and permissions"],
      };
      
      results.push(failedResult);
    }
  }
  
  return results;
}

/**
 * Verifies the sync status of a repository
 */
function verifySyncStatus(inclusion: GitInclusion, result: VerifyResult, options: VerifyOptions): void {
  // Skip if repository is missing
  if (!result.inclusion.present) {
    return;
  }

  // Check sync status
  switch (result.inclusion.syncStatus) {
    case "behind":
      // Check both global and per-inclusion options
      if (!options.ignoreBehind && !inclusion.options.ignoreBehind) {
        result.isReady = false;
        result.issues.push("Repository is behind remote");
        result.suggestions.push("Run 'weave repos pull' to update the repository");
      }
      break;
    
    case "ahead":
      // Check both global and per-inclusion options
      if (!options.ignoreAhead && !inclusion.options.ignoreAhead) {
        result.isReady = false;
        result.issues.push("Repository is ahead of remote");
        result.suggestions.push("Run 'weave repos push' to update the remote");
      }
      break;
    
    case "conflicted":
      // Check both global and per-inclusion options
      if (!options.ignoreDivergent && !inclusion.options.ignoreDivergent) {
        result.isReady = false;
        result.issues.push("Repository has diverged from remote");
        result.suggestions.push("Run 'weave repos sync --pull-strategy=rebase' to synchronize");
      }
      break;
    
    case "dirty":
      // Check both global and per-inclusion options
      if (!options.ignoreDirty && !inclusion.options.ignoreDirty) {
        result.isReady = false;
        result.issues.push("Repository has uncommitted changes");
        result.suggestions.push("Run 'weave repos commit' to commit changes");
      }
      break;
    
    case "unknown":
      result.isReady = false;
      result.issues.push("Repository status could not be determined");
      result.suggestions.push("Check repository configuration and permissions");
      break;
  }
}

/**
 * Verifies sparse checkout settings
 */
async function verifySparseCheckout(inclusion: GitInclusion, result: VerifyResult, verifyOptions: VerifyOptions = {}): Promise<void> {
  // Skip if ignoreCheckoutConsistency is true in the global options or inclusion options
  if (verifyOptions.ignoreCheckoutConsistency || inclusion.options.ignoreCheckoutConsistency) {
    return;
  }
  // Skip if repository is missing
  if (!result.inclusion.present) {
    return;
  }

  const { localPath, options: inclusionOptions } = inclusion;
  const gitDir = join(localPath, ".git");
  
  try {
    // Check if sparse checkout is enabled
    if (await exists(gitDir)) {
      // Check if sparse checkout is enabled
      const sparseCheckoutEnabled = await runGitCommand(localPath, ["config", "core.sparseCheckout"]);
      
      if (sparseCheckoutEnabled.trim() !== "true") {
        result.isReady = false;
        result.issues.push("Sparse checkout is not enabled");
        result.suggestions.push("Run 'weave repos checkout' to configure sparse checkout");
        return;
      }
      
      // Check sparse checkout rules
      const sparseCheckoutFile = join(gitDir, "info", "sparse-checkout");
      
      if (!await exists(sparseCheckoutFile)) {
        result.isReady = false;
        result.issues.push("Sparse checkout file is missing");
        result.suggestions.push("Run 'weave repos checkout' to configure sparse checkout");
        return;
      }
      
      // Get current sparse checkout rules
      const currentRules = await runGitCommand(localPath, ["sparse-checkout", "list"]);
      const currentRulesArray = currentRules.trim().split("\n").filter(rule => rule.trim() !== "");
      
      // Check if rules match configuration
      const { include, excludeByDefault } = inclusionOptions;
      
      // Simple check: if excludeByDefault is true, there should be rules
      if (excludeByDefault && include.length === 0 && currentRulesArray.length === 0) {
        result.isReady = false;
        result.issues.push("Sparse checkout is configured to exclude by default, but no include rules are specified");
        result.suggestions.push("Add include rules to the repository configuration");
      }
      
      // Note: A more comprehensive check would compare the actual rules,
      // but that's complex due to pattern matching and would require parsing the sparse checkout file
    }
  } catch (error) {
    log.debug(`Error checking sparse checkout for ${localPath}: ${error instanceof Error ? error.message : "Unknown error"}`);
    result.issues.push("Could not verify sparse checkout settings");
    result.suggestions.push("Run 'weave repos checkout' to reconfigure sparse checkout");
  }
}
