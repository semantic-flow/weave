import { log } from "../logging.ts";

/**
 * Determines if a file should be included based on include/exclude patterns.
 */
export function shouldIncludeFile(
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
export function matchPattern(filePath: string, pattern: string): boolean {
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
