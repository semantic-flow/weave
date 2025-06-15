import { Frame } from "../core/Frame.ts";
import { handleCaughtError } from "../core/utils/handleCaughtError.ts";
import { 
  GitInclusion, 
  WebInclusion, 
  LocalInclusion 
} from "../types.ts";
import { log } from "../core/utils/logging.ts";
import { exists, ensureDir } from "../deps/fs.ts";
import { inclusionsVerify } from "./inclusionsVerify.ts";
import { reposPrepare } from "./reposPrepare.ts";
import { processGitInclusion, processWebInclusion, processLocalInclusion } from "./inclusions/index.ts";
import { BuildOptions, BuildResult } from "./interfaces/build.ts";

/**
 * Builds the project by copying files from inclusions to the destination directory.
 * @param options Options to control the build process
 * @returns Build result
 */
export async function build(options: BuildOptions = {}): Promise<BuildResult> {
  const frame = Frame.getInstance();
  const { resolvedInclusions, config } = frame;
  const { dest, workspaceDir } = config.global;

  // Clear any previous file mappings
  frame.clearFileMappings();

  // Initialize result
  const result: BuildResult = {
    success: true,
    filesCopied: 0,
    filesSkipped: 0,
    filesOverwritten: 0,
    filesUpdated: 0,
    errors: [],
    warnings: [],
  };

  try {
    // Create workspace directory if it doesn't exist
    try {
      await ensureDir(workspaceDir);
      log.debug(`Ensured workspace directory exists: ${workspaceDir}`);
    } catch (error) {
      const errorMessage = `Failed to create workspace directory: ${error instanceof Error ? error.message : "Unknown error"}`;
      log.error(errorMessage);
      result.errors.push(errorMessage);
      result.success = false;
      return result;
    }

    // Prepare repositories if not disabled
    if (options.prepare !== false) {
      log.info("Preparing repositories...");
      const prepareResults = await reposPrepare(options.pullStrategy, options.pushStrategy);
      result.prepareResults = prepareResults;

      // Check if any repository preparation failed
      const failedPreparations = prepareResults.filter(r => !r.success);
      if (failedPreparations.length > 0) {
        log.error("Repository preparation failed for some repositories.");
        result.success = false;
        failedPreparations.forEach(r => {
          result.errors.push(`Repository preparation failed for ${r.localPath}: ${r.message || "Unknown error"}`);
        });
        return result;
      }

      log.info("Repositories prepared successfully.");
    } else {
      log.info("Skipping repository preparation.");
    }

    // Verify inclusions if not disabled
    if (options.verify !== false) {
      log.info("Verifying inclusions after repository preparation...");
      result.verifyResult = await inclusionsVerify(options);

      if (!result.verifyResult.isReady) {
        log.error("Inclusions verification failed. Use --no-verify to skip verification.");
        result.success = false;
        result.errors.push("Inclusions verification failed");
        result.verifyResult.issues.forEach(issue => result.errors.push(issue));
        return result;
      }

      log.info("Inclusions verification passed.");
    } else {
      log.info("Skipping inclusions verification.");
    }

    // Always show the destination directory message
    log.info(`Destination directory: ${dest}`);
    
    // Clean destination directory if globalClean is true
    if (config.global.globalClean) {
      log.info(`Cleaning destination directory: ${dest}`);
      try {
        // Check if the directory exists before attempting to remove it
        if (await exists(dest)) {
          // Remove the directory and all its contents
          await Deno.remove(dest, { recursive: true });
          log.info(`Destination directory cleaned`);
        }
      } catch (error) {
        const errorMessage = `Failed to clean destination directory: ${error instanceof Error ? error.message : "Unknown error"}`;
        log.error(errorMessage);
        result.errors.push(errorMessage);
        result.success = false;
        return result;
      }
    }

    // Ensure destination directory exists
    await ensureDir(dest);

    // Sort inclusions by order
    const sortedInclusions = [...resolvedInclusions].sort((a, b) => a.order - b.order);

    // Process each inclusion
    for (const inclusion of sortedInclusions) {
      // Skip inactive inclusions
      if (!inclusion.options.active) {
        log.debug(`Skipping inactive inclusion: ${inclusion.name || "unnamed"}`);
        continue;
      }

      log.info(`Processing inclusion: ${inclusion.name || "unnamed"} (${inclusion.type})`);

      try {
        // Process inclusion based on type
        switch (inclusion.type) {
          case "git":
            await processGitInclusion(inclusion as GitInclusion, dest, result);
            break;

          case "web":
            await processWebInclusion(inclusion as WebInclusion, dest, result);
            break;

          case "local":
            await processLocalInclusion(inclusion as LocalInclusion, dest, result);
            break;
        }
      } catch (error) {
        handleCaughtError(error, `Failed to process inclusion: ${inclusion.name || "unnamed"}`);
        result.success = false;
        result.errors.push(`Failed to process inclusion ${inclusion.name || "unnamed"}: ${error instanceof Error ? error.message : "Unknown error"}`);
      }
    }

    // Check for collisions
    const collisions = frame.getCollisions();
    
    if (collisions.size > 0) {
      log.info(`Detected ${collisions.size} file collisions.`);
      result.collisions = collisions;
      
      // Handle collisions based on the global collision strategy
      const collisionStrategy = config.global.globalCollisionStrategy;
      
      for (const [destPath, mappings] of collisions.entries()) {
        const sourcesList = mappings.map(m => 
          `${m.sourcePath} (from ${m.inclusion.name || m.inclusion.type})`
        ).join(", ");
        
        log.info(`Collision for ${destPath}: ${sourcesList}`);
        
        switch (collisionStrategy) {
          case "fail": {
            // Fail the build if any collisions are detected
            const errorMessage = `Collision detected: Multiple sources would be copied to ${destPath}: ${sourcesList}`;
            result.errors.push(errorMessage);
            log.error(errorMessage);
            result.success = false;
            break;
          }
            
          case "no-overwrite": {
            // Use the first inclusion (lowest order) - don't overwrite
            log.info(`Using first inclusion for ${destPath}: ${mappings[0].sourcePath} (from ${mappings[0].inclusion.name || mappings[0].inclusion.type})`);
            // Other mappings will be ignored during copy
            break;
          }
            
          case "overwrite": {
            // Use the last inclusion (highest order) - overwrite with latest
            log.info(`Using last inclusion for ${destPath}: ${mappings[mappings.length - 1].sourcePath} (from ${mappings[mappings.length - 1].inclusion.name || mappings[mappings.length - 1].inclusion.type})`);
            // Other mappings will be ignored during copy
            break;
          }
            
          case "prompt": {
            // Prompt is not implemented in non-interactive mode
            log.warn(`Prompt collision strategy not implemented, defaulting to "first" for ${destPath}`);
            result.warnings.push(`Prompt collision strategy not implemented, defaulting to "first" for ${destPath}`);
            break;
          }
        }
      }
      
      // If collision strategy is "fail" and there are collisions, stop the build
      if (collisionStrategy === "fail" && collisions.size > 0) {
        log.error(`Build failed due to file collisions with "fail" collision strategy.`);
        return result;
      }
    }

    // Log summary
    log.info(`Build completed with ${result.filesCopied} files copied, ${result.filesSkipped} skipped, ${result.filesOverwritten} overwritten, ${result.filesUpdated} updated.`);

    if (result.errors.length > 0) {
      log.error(`Build completed with ${result.errors.length} errors.`);
      result.success = false;
    }

    if (result.warnings.length > 0) {
      log.warn(`Build completed with ${result.warnings.length} warnings.`);
    }

    return result;
  } catch (error) {
    handleCaughtError(error, "Failed to build project");

    // Return a failed result
    result.success = false;
    result.errors.push(`Error building project: ${error instanceof Error ? error.message : "Unknown error"}`);

    return result;
  }
}
