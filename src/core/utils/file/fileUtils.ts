import { log } from "../logging.ts";
import { Frame } from "../../Frame.ts";
import { ResolvedInclusion } from "../../../types.ts";
import { join, relative, dirname } from "../../../deps/path.ts";
import { exists, ensureDir } from "../../../deps/fs.ts";
import { BuildResult } from "../../interfaces/build.ts";
import { shouldIncludeFile } from "./patternUtils.ts";
import { equalUint8Arrays, isSourceNewer } from "./compareUtils.ts";
import { applyRemappings } from "../applyRemappings.ts";
import { CollisionStrategy, UpdateStrategy } from "../../../types.ts";

/**
 * Copies files from source to destination directory, respecting include/exclude patterns.
 */
export async function copyFiles(
  sourceDir: string,
  destDir: string,
  includePatterns: string[],
  excludePatterns: string[],
  excludeByDefault: boolean,
  _collisionStrategy: CollisionStrategy,
  updateStrategy: UpdateStrategy,
  ignoreMissingTimestamps: boolean,
  inclusion: ResolvedInclusion,
  result: BuildResult
): Promise<void> {
  // Get all files in the source directory
  const files: string[] = [];

  // Walk the directory tree and collect all files
  async function walkDir(dir: string): Promise<void> {
    try {
      log.debug(`Walking directory: ${dir}`);
      for await (const entry of Deno.readDir(dir)) {
        const entryPath = join(dir, entry.name);

        if (entry.isDirectory) {
          await walkDir(entryPath);
        } else if (entry.isFile) {
          // Get path relative to source directory
          const relativePath = relative(sourceDir, entryPath);

          // Check if file should be included
          const included = shouldIncludeFile(relativePath, includePatterns, excludePatterns, excludeByDefault);
          log.debug(`File ${relativePath}: ${included ? 'included' : 'excluded'}`);
          if (included) {
            files.push(relativePath);
          }
        }
      }
    } catch (error) {
      log.error(`Error walking directory ${dir}: ${error instanceof Error ? error.message : "Unknown error"}`);
      throw error;
    }
  }

  log.info(`Copying files from ${sourceDir} to ${destDir}`);
  log.debug(`Include patterns: ${includePatterns.join(', ') || 'none'}`);
  log.debug(`Exclude patterns: ${excludePatterns.join(', ') || 'none'}`);
  log.debug(`Exclude by default: ${excludeByDefault}`);

  await walkDir(sourceDir);

  const frame = Frame.getInstance();

  // Copy each file
  for (const file of files) {
    const sourcePath = join(sourceDir, file);

    // Apply remappings to the relative path
    let remappedRelativePath = file;
    if (inclusion.options.remappings && inclusion.options.remappings.length > 0) {
      remappedRelativePath = applyRemappings(file, inclusion.options.remappings);
      log.debug(`Applied remapping: ${file} -> ${remappedRelativePath}`);
    }

    const destPath = join(destDir, remappedRelativePath);

    // Register this file mapping in the Frame
    frame.registerFileMapping(sourcePath, destPath, inclusion);

    try {
      // Create destination directory if it doesn't exist
      await ensureDir(dirname(destPath));

      // Check if destination file already exists
      const destExists = await exists(destPath);

      if (destExists) {
        // Check if the file should be updated based on the update strategy
        let shouldUpdate = false;
        
        switch (updateStrategy) {
          case "always":
            // Always update the file
            shouldUpdate = true;
            log.debug(`Update strategy is 'always', updating: ${destPath}`);
            break;
            
          case "if-different":
            // Update if content is different
            try {
              const sourceContent = await Deno.readFile(sourcePath);
              const destContent = await Deno.readFile(destPath);
              
              // Compare file contents
              shouldUpdate = !equalUint8Arrays(sourceContent, destContent);
              
              if (shouldUpdate) {
                log.debug(`File content differs, updating: ${destPath}`);
              } else {
                log.debug(`File content is identical, skipping: ${destPath}`);
              }
            } catch (error) {
              log.error(`Error comparing file contents: ${error instanceof Error ? error.message : "Unknown error"}`);
              // Default to updating if comparison fails
              shouldUpdate = true;
            }
            break;
            
          case "if-newer":
            // Update if source is newer than destination
            try {
              shouldUpdate = await isSourceNewer(sourcePath, destPath, inclusion, ignoreMissingTimestamps);
              
              if (shouldUpdate) {
                log.debug(`Source is newer, updating: ${destPath}`);
              } else {
                log.debug(`Source is not newer, skipping: ${destPath}`);
              }
            } catch (error) {
              log.error(`Error comparing file timestamps: ${error instanceof Error ? error.message : "Unknown error"}`);
              // Default to not updating if timestamp comparison fails
              shouldUpdate = false;
              result.warnings.push(`Error comparing file timestamps for ${destPath}: ${error instanceof Error ? error.message : "Unknown error"}`);
            }
            break;
            
          case "never":
            // Never update existing files
            shouldUpdate = false;
            log.debug(`Update strategy is 'never', skipping: ${destPath}`);
            break;
            
          case "prompt":
            // Prompt is not implemented in non-interactive mode
            log.warn(`Prompt update strategy not implemented, defaulting to 'never' for ${destPath}`);
            result.warnings.push(`Prompt update strategy not implemented, defaulting to 'never' for ${destPath}`);
            shouldUpdate = false;
            break;
        }
        
        if (shouldUpdate) {
          // Update the file
          await Deno.copyFile(sourcePath, destPath);
          result.filesUpdated++;
          log.info(`Updated: ${sourcePath} -> ${destPath}`);
        } else {
          // Skip the file
          result.filesSkipped++;
          log.debug(`Skipped: ${sourcePath} -> ${destPath}`);
        }
      } else {
        // Destination file doesn't exist, copy it
        await Deno.copyFile(sourcePath, destPath);
        result.filesCopied++;
        log.info(`Copied: ${sourcePath} -> ${destPath}`);
      }
    } catch (error) {
      result.errors.push(`Failed to copy file ${sourcePath} to ${destPath}: ${error instanceof Error ? error.message : "Unknown error"}`);
      log.error(`Failed to copy file ${sourcePath} to ${destPath}: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }
}
