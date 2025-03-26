import { Frame } from "../core/Frame.ts";
import { handleCaughtError } from "../core/utils/handleCaughtError.ts";
import { InclusionListItem, ResolvedInclusion, WebInclusion, LocalInclusion } from "../types.ts";
// isGitInclusion is imported but not used directly in this file
import { isGitInclusion as _isGitInclusion } from "../core/utils/gitInclusionUtils.ts";
import { log } from "../core/utils/logging.ts";
import { reposVerify, VerifyOptions as ReposVerifyOptions, VerifyResult as ReposVerifyResult } from "./reposVerify.ts";
import { exists } from "../deps/fs.ts";

export interface VerifyOptions extends ReposVerifyOptions {
  ignoreRemoteAvailability?: boolean;
  ignoreLocalEmpty?: boolean;
}

export interface VerifyResult {
  repoResults: ReposVerifyResult[];
  webResults: WebVerifyResult[];
  localResults: LocalVerifyResult[];
  isReady: boolean;
  issues: string[];
  suggestions: string[];
}

export interface WebVerifyResult {
  inclusion: InclusionListItem;
  isReady: boolean;
  issues: string[];
  suggestions: string[];
}

export interface LocalVerifyResult {
  inclusion: InclusionListItem;
  isReady: boolean;
  issues: string[];
  suggestions: string[];
}

/**
 * Verifies that all inclusions are ready for building.
 * @param options Options to control verification behavior
 * @returns Verification result
 */
export async function inclusionsVerify(options: VerifyOptions = {}): Promise<VerifyResult> {
  const frame = Frame.getInstance();
  const { resolvedInclusions } = frame;
  
  // Initialize result
  const result: VerifyResult = {
    repoResults: [],
    webResults: [],
    localResults: [],
    isReady: true,
    issues: [],
    suggestions: [],
  };
  
  try {
    // Verify git repositories
    result.repoResults = await reposVerify(options);
    
    // Check if any repositories are not ready
    if (result.repoResults.some(r => !r.isReady)) {
      result.isReady = false;
      result.issues.push("One or more git repositories are not ready");
      result.suggestions.push("Run 'weave repos verify' for details");
    }
    
    // Verify web inclusions
    for (const inclusion of resolvedInclusions.filter(i => i.type === "web")) {
      const webInclusion = inclusion as WebInclusion;
      const webResult = await verifyWebInclusion(webInclusion, options);
      result.webResults.push(webResult);
      
      if (!webResult.isReady) {
        result.isReady = false;
        result.issues.push(`Web inclusion '${webInclusion.name || webInclusion.url}' is not ready`);
      }
    }
    
    // Verify local inclusions
    for (const inclusion of resolvedInclusions.filter(i => i.type === "local")) {
      const localInclusion = inclusion as LocalInclusion;
      const localResult = await verifyLocalInclusion(localInclusion, options);
      result.localResults.push(localResult);
      
      if (!localResult.isReady) {
        result.isReady = false;
        result.issues.push(`Local inclusion '${localInclusion.name || localInclusion.localPath}' is not ready`);
      }
    }
    
    // Check for potential collisions
    const collisions = await checkForCollisions(resolvedInclusions);
    if (collisions.length > 0) {
      result.isReady = false;
      result.issues.push("Potential file collisions detected");
      result.suggestions.push("Use appropriate copy strategy to handle collisions");
      
      // Add specific collision information
      for (const collision of collisions) {
        result.issues.push(`Collision: ${collision}`);
      }
    }
    
    return result;
  } catch (error) {
    handleCaughtError(error, "Failed to verify inclusions");
    
    // Return a failed result
    result.isReady = false;
    result.issues.push(`Error verifying inclusions: ${error instanceof Error ? error.message : "Unknown error"}`);
    result.suggestions.push("Check inclusion configuration and permissions");
    
    return result;
  }
}

/**
 * Verifies a web inclusion
 */
async function verifyWebInclusion(inclusion: WebInclusion, options: VerifyOptions): Promise<WebVerifyResult> {
  const result: WebVerifyResult = {
    inclusion: {
      order: inclusion.order,
      name: inclusion.name || inclusion.url,
      active: inclusion.options.active,
      present: true, // Web inclusions are always "present"
      syncStatus: "current", // Web inclusions don't have a sync status
      copyStrategy: inclusion.options.copyStrategy,
      include: [], // Web inclusions don't have include/exclude
      exclude: [],
      excludeByDefault: false,
      autoPullBeforeBuild: false,
      autoPushBeforeBuild: false,
      type: "web",
    },
    isReady: true,
    issues: [],
    suggestions: [],
  };
  
  // Skip URL availability check if ignoreRemoteAvailability is true
  if (options.ignoreRemoteAvailability) {
    return result;
  }
  
  try {
    // Check if URL is accessible
    // Note: This is a simple HEAD request and may not work for all URLs
    // A more robust solution would handle different protocols, authentication, etc.
    const response = await fetch(inclusion.url, { method: "HEAD" });
    
    if (!response.ok) {
      result.isReady = false;
      result.issues.push(`URL returned status ${response.status}: ${response.statusText}`);
      result.suggestions.push("Check if the URL is correct and accessible");
    }
  } catch (error) {
    result.isReady = false;
    result.issues.push(`Failed to access URL: ${error instanceof Error ? error.message : "Unknown error"}`);
    result.suggestions.push("Check network connectivity and URL validity");
    
    // Log the error for debugging
    log.debug(`Error checking URL ${inclusion.url}: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
  
  return result;
}

/**
 * Verifies a local inclusion
 */
async function verifyLocalInclusion(inclusion: LocalInclusion, options: VerifyOptions): Promise<LocalVerifyResult> {
  const result: LocalVerifyResult = {
    inclusion: {
      order: inclusion.order,
      name: inclusion.name || inclusion.localPath,
      active: inclusion.options.active,
      present: false,
      syncStatus: "current", // Local inclusions don't have a sync status
      copyStrategy: inclusion.options.copyStrategy,
      include: inclusion.options.include,
      exclude: inclusion.options.exclude,
      excludeByDefault: inclusion.options.excludeByDefault,
      autoPullBeforeBuild: false,
      autoPushBeforeBuild: false,
      type: "local",
    },
    isReady: true,
    issues: [],
    suggestions: [],
  };
  
  try {
    // Check if directory exists
    const directoryExists = await exists(inclusion.localPath);
    result.inclusion.present = directoryExists;
    
    if (!directoryExists) {
      result.isReady = false;
      result.issues.push("Directory does not exist");
      result.suggestions.push("Create the directory or update the inclusion path");
      return result;
    }
    
    // Check if directory is empty
    if (!options.ignoreLocalEmpty) {
      try {
        const dirEntries = [...Deno.readDirSync(inclusion.localPath)];
        if (dirEntries.length === 0) {
          result.isReady = false;
          result.issues.push("Directory is empty");
          result.suggestions.push("Add files to the directory or use --ignore-local-empty");
        }
      } catch (error) {
        result.isReady = false;
        result.issues.push(`Failed to read directory: ${error instanceof Error ? error.message : "Unknown error"}`);
        result.suggestions.push("Check directory permissions");
      }
    }
  } catch (error) {
    result.isReady = false;
    result.issues.push(`Error checking directory: ${error instanceof Error ? error.message : "Unknown error"}`);
    result.suggestions.push("Check if the path is correct and accessible");
    
    // Log the error for debugging
    log.debug(`Error checking directory ${inclusion.localPath}: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
  
  return result;
}

/**
 * Checks for potential file collisions between inclusions
 * Note: This is a simplified implementation that doesn't actually check file paths
 * A more robust implementation would need to:
 * 1. List all files in each inclusion (respecting include/exclude rules)
 * 2. Compare file paths to detect collisions
 * 3. Consider copy strategies when determining if a collision is problematic
 */
function checkForCollisions(_inclusions: ResolvedInclusion[]): Promise<string[]> {
  // This is a placeholder for a more robust collision detection algorithm
  // For now, we'll just return an empty array indicating no collisions
  return Promise.resolve([]);
}
