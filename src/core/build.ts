import { Frame } from "../core/Frame.ts";
import { handleCaughtError } from "../core/utils/handleCaughtError.ts";
import { GitInclusion, WebInclusion, LocalInclusion, CopyStrategy, RepoGitResult, ResolvedInclusion } from "../types.ts";
import { log } from "../core/utils/logging.ts";
import { join, relative, dirname } from "../deps/path.ts";
import { exists, ensureDir } from "../deps/fs.ts";
import { inclusionsVerify, VerifyOptions as InclusionsVerifyOptions, VerifyResult as InclusionsVerifyResult } from "./inclusionsVerify.ts";
import { reposPrepare } from "./reposPrepare.ts";
import { applyRemappings } from "./utils/applyRemappings.ts";

export interface BuildOptions extends InclusionsVerifyOptions {
  verify?: boolean;
  prepare?: boolean;
  pullStrategy?: string;
  pushStrategy?: string;
}

export interface BuildResult {
  verifyResult?: InclusionsVerifyResult;
  prepareResults?: RepoGitResult[];
  success: boolean;
  filesCopied: number;
  filesSkipped: number;
  filesOverwritten: number;
  errors: string[];
  warnings: string[];
  collisions?: Map<string, { sourcePath: string; inclusion: ResolvedInclusion }[]>;
}

export interface FileCopyResult {
  source: string;
  destination: string;
  success: boolean;
  skipped: boolean;
  overwritten: boolean;
  error?: string;
}

/**
 * Builds the project by copying files from inclusions to the destination directory.
 * @param options Options to control the build process
 * @returns Build result
 */
export async function build(options: BuildOptions = {}): Promise<BuildResult> {
  const frame = Frame.getInstance();
  const { resolvedInclusions, config } = frame;
  const { dest } = config.global;
  
  // Clear any previous file mappings
  frame.clearFileMappings();
  
  // Initialize result
  const result: BuildResult = {
    success: true,
    filesCopied: 0,
    filesSkipped: 0,
    filesOverwritten: 0,
    errors: [],
    warnings: [],
  };
  
  try {
    // Verify inclusions if not disabled
    if (options.verify !== false) {
      log.info("Verifying inclusions before building...");
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
          await processGitInclusion(inclusion as GitInclusion, dest, result, config.global.globalCopyStrategy);
          break;
        
        case "web":
          await processWebInclusion(inclusion as WebInclusion, dest, result, config.global.globalCopyStrategy);
          break;
        
        case "local":
          await processLocalInclusion(inclusion as LocalInclusion, dest, result, config.global.globalCopyStrategy);
          break;
      }
      } catch (error) {
        handleCaughtError(error, `Failed to process inclusion: ${inclusion.name || "unnamed"}`);
        result.success = false;
        result.errors.push(`Failed to process inclusion ${inclusion.name || "unnamed"}: ${error instanceof Error ? error.message : "Unknown error"}`);
      }
    }
    
    // Check for collisions if using no-overwrite strategy
    if (config.global.globalCopyStrategy === "no-overwrite") {
      const collisions = frame.getCollisions();
      
      if (collisions.size > 0) {
        log.error(`Detected ${collisions.size} file collisions with "no-overwrite" strategy.`);
        result.success = false;
        result.collisions = collisions;
        
        for (const [destPath, mappings] of collisions.entries()) {
          const sourcesList = mappings.map(m => 
            `${m.sourcePath} (from ${m.inclusion.name || m.inclusion.type})`
          ).join(", ");
          
          const errorMessage = `Collision detected: Multiple sources would be copied to ${destPath}: ${sourcesList}`;
          result.errors.push(errorMessage);
          log.error(errorMessage);
        }
      }
    }
    
    // Log summary
    log.info(`Build completed with ${result.filesCopied} files copied, ${result.filesSkipped} skipped, ${result.filesOverwritten} overwritten.`);
    
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

/**
 * Processes a git inclusion by copying files from the repository to the destination directory.
 */
async function processGitInclusion(inclusion: GitInclusion, destDir: string, result: BuildResult, globalCopyStrategy: CopyStrategy): Promise<void> {
  const { localPath, options, url, name } = inclusion;
  
  log.info(`Processing git inclusion: ${name || url}`);
  log.info(`Local path: ${localPath}`);
  log.info(`Include patterns: ${options.include.join(', ') || 'none'}`);
  log.info(`Exclude patterns: ${options.exclude.join(', ') || 'none'}`);
  log.info(`Exclude by default: ${options.excludeByDefault}`);
  
  // List files in the repository directory
  try {
    log.info(`Listing files in ${localPath}:`);
    for await (const entry of Deno.readDir(localPath)) {
      log.info(`  ${entry.name} (${entry.isDirectory ? 'directory' : 'file'})`);
    }
  } catch (error) {
    log.error(`Error listing files in ${localPath}: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
  
  // Skip if repository doesn't exist
  if (!await exists(localPath)) {
    result.errors.push(`Repository directory does not exist: ${localPath}`);
    return;
  }
  
  // Use inclusion's copy strategy or fall back to global
  const copyStrategy = options.copyStrategy || globalCopyStrategy;
  
  // Copy files from repository to destination
  await copyFiles(localPath, destDir, options.include, options.exclude, options.excludeByDefault, copyStrategy, inclusion, result);
}

/**
 * Processes a web inclusion.
 * Note: This is a placeholder for future implementation.
 */
function processWebInclusion(inclusion: WebInclusion, _destDir: string, result: BuildResult, _globalCopyStrategy: CopyStrategy): void {
  // Web inclusions are not yet implemented
  result.warnings.push(`Web inclusions are not yet implemented: ${inclusion.name || inclusion.url}`);
}

/**
 * Processes a local inclusion by copying files from the local directory to the destination directory.
 */
async function processLocalInclusion(inclusion: LocalInclusion, destDir: string, result: BuildResult, globalCopyStrategy: CopyStrategy): Promise<void> {
  const { localPath, options } = inclusion;
  
  // Skip if directory doesn't exist
  if (!await exists(localPath)) {
    result.errors.push(`Local directory does not exist: ${localPath}`);
    return;
  }
  
  // Use inclusion's copy strategy or fall back to global
  const copyStrategy = options.copyStrategy || globalCopyStrategy;
  
  // Copy files from local directory to destination
  await copyFiles(localPath, destDir, options.include, options.exclude, options.excludeByDefault, copyStrategy, inclusion, result);
}

/**
 * Copies files from source to destination directory, respecting include/exclude patterns.
 */
async function copyFiles(
  sourceDir: string,
  destDir: string,
  includePatterns: string[],
  excludePatterns: string[],
  excludeByDefault: boolean,
  copyStrategy: CopyStrategy,
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
        // Handle existing file based on copy strategy
        switch (copyStrategy) {
          case "no-overwrite":
            log.warn(`File already exists, not overwriting: ${destPath}`);
            result.warnings.push(`File already exists, not overwriting: ${destPath}`);
            result.filesSkipped++;
            continue;
          
          case "skip":
            log.debug(`File already exists, skipping: ${destPath}`);
            result.filesSkipped++;
            continue;
          
          case "overwrite":
            log.debug(`File already exists, overwriting: ${destPath}`);
            result.filesOverwritten++;
            break;
          
          case "prompt":
            // Prompt is not implemented in non-interactive mode
            log.warn(`Prompt strategy not implemented, defaulting to no-overwrite: ${destPath}`);
            result.warnings.push(`Prompt strategy not implemented, defaulting to no-overwrite: ${destPath}`);
            result.filesSkipped++;
            continue;
        }
      }
      
      // Copy the file
      await Deno.copyFile(sourcePath, destPath);
      result.filesCopied++;
      log.info(`Copied: ${sourcePath} -> ${destPath}`);
    } catch (error) {
      result.errors.push(`Failed to copy file ${sourcePath} to ${destPath}: ${error instanceof Error ? error.message : "Unknown error"}`);
      log.error(`Failed to copy file ${sourcePath} to ${destPath}: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }
}

/**
 * Determines if a file should be included based on include/exclude patterns.
 */
function shouldIncludeFile(
  filePath: string,
  includePatterns: string[],
  excludePatterns: string[],
  excludeByDefault: boolean
): boolean {
  // Convert file path to use forward slashes for pattern matching
  const normalizedPath = filePath.replace(/\\/g, "/");
  
  log.debug(`Checking if file should be included: ${normalizedPath}`);
  log.debug(`Include patterns: ${includePatterns.join(', ') || 'none'}`);
  log.debug(`Exclude patterns: ${excludePatterns.join(', ') || 'none'}`);
  log.debug(`Exclude by default: ${excludeByDefault}`);
  
  // Check exclude patterns first
  for (const pattern of excludePatterns) {
    if (matchPattern(normalizedPath, pattern)) {
      log.debug(`File ${normalizedPath} matches exclude pattern ${pattern}, excluding`);
      return false;
    }
  }
  
  // If excludeByDefault is true, file must match an include pattern
  if (excludeByDefault) {
    // If no include patterns, nothing is included
    if (includePatterns.length === 0) {
      log.debug(`No include patterns and excludeByDefault is true, excluding ${normalizedPath}`);
      return false;
    }
    
    // Special case: if include pattern is just a directory name without wildcards,
    // include all files in that directory and its subdirectories
    for (const pattern of includePatterns) {
      if (!pattern.includes("*") && !pattern.includes("?")) {
        if (normalizedPath === pattern || normalizedPath.startsWith(pattern + "/")) {
          log.debug(`File ${normalizedPath} is in directory ${pattern}, including`);
          return true;
        }
      }
    }
    
    // Check if file matches any include pattern
    for (const pattern of includePatterns) {
      if (matchPattern(normalizedPath, pattern)) {
        log.debug(`File ${normalizedPath} matches include pattern ${pattern}, including`);
        return true;
      }
    }
    
    // No include pattern matched
    log.debug(`File ${normalizedPath} doesn't match any include pattern, excluding`);
    return false;
  }
  
  // If excludeByDefault is false, include everything not explicitly excluded
  log.debug(`File ${normalizedPath} is included by default`);
  return true;
}

/**
 * Matches a file path against a pattern.
 * Supports basic glob patterns with * and **.
 */
function matchPattern(filePath: string, pattern: string): boolean {
  // Log the pattern and file path for debugging
  log.debug(`Matching pattern: "${pattern}" against file: "${filePath}"`);
  
  // Handle special case: if pattern is just "*" or "**", match everything
  if (pattern === "*" || pattern === "**") {
    return true;
  }
  
  // Handle special case: if pattern is just a file extension like "*.js"
  if (pattern.startsWith("*.")) {
    const extension = pattern.substring(1); // Get ".js"
    return filePath.endsWith(extension);
  }
  
  // Handle special case: if pattern is a directory like "dir/**"
  if (pattern.endsWith("/**")) {
    const dir = pattern.substring(0, pattern.length - 3);
    return filePath.startsWith(dir);
  }
  
  // Handle special case: if pattern is a directory and file extension like "dir/*.js"
  if (pattern.includes("/*")) {
    const parts = pattern.split("/*");
    const dir = parts[0];
    const rest = parts[1];
    
    if (filePath.startsWith(dir + "/")) {
      const fileName = filePath.substring(dir.length + 1);
      // If rest is a file extension like ".js", match any file with that extension
      if (rest.startsWith(".")) {
        return fileName.endsWith(rest);
      }
      // Otherwise, match the rest of the pattern
      return matchPattern(fileName, "*" + rest);
    }
    return false;
  }
  
  // Convert pattern to regex
  let regexPattern = pattern.replace(/\\/g, "/"); // Normalize backslashes
  
  // Escape special regex characters except * and ?
  regexPattern = regexPattern.replace(/[.+^${}()|[\]]/g, "\\$&");
  
  // Replace ** with a placeholder
  regexPattern = regexPattern.replace(/\*\*/g, "###GLOBSTAR###");
  
  // Replace * with a regex for "any character except /"
  regexPattern = regexPattern.replace(/\*/g, "[^/]*");
  
  // Replace ? with a regex for "any single character except /"
  regexPattern = regexPattern.replace(/\?/g, "[^/]");
  
  // Replace the placeholder with a regex for "any character"
  regexPattern = regexPattern.replace(/###GLOBSTAR###/g, ".*");
  
  // Anchor the pattern to the start and end of the string
  regexPattern = `^${regexPattern}$`;
  
  // Log the regex pattern for debugging
  log.debug(`Regex pattern: ${regexPattern}`);
  
  try {
    const regex = new RegExp(regexPattern);
    const result = regex.test(filePath);
    log.debug(`Match result: ${result}`);
    return result;
  } catch (error) {
    log.error(`Error creating regex from pattern "${pattern}": ${error instanceof Error ? error.message : "Unknown error"}`);
    // Fall back to simple string comparison
    return filePath === pattern;
  }
}
