import { log } from "@/logging.ts";
import { ResolvedInclusion } from "@/../types.ts";
import { runGitCommand } from "@/runGitCommand.ts";
import { relative } from "@/../deps/path.ts";

/**
 * Compares two Uint8Array objects for equality.
 * @param a First array
 * @param b Second array
 * @returns True if arrays are equal, false otherwise
 */
export function equalUint8Arrays(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) {
    return false;
  }
  
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {
      return false;
    }
  }
  
  return true;
}

/**
 * Determines if the source file is newer than the destination file.
 * For git inclusions, uses git commit timestamp if available.
 * For web inclusions, uses HTTP Last-Modified header if available.
 * For local inclusions, uses file modification timestamp.
 * @param sourcePath Path to the source file
 * @param destPath Path to the destination file
 * @param inclusion The inclusion that contains the source file
 * @param ignoreMissingTimestamps Whether to ignore missing timestamps
 * @returns True if source is newer than destination, false otherwise
 */
export async function isSourceNewer(
  sourcePath: string,
  destPath: string,
  inclusion: ResolvedInclusion,
  ignoreMissingTimestamps: boolean
): Promise<boolean> {
  // Get destination file time
  const destStat = await Deno.stat(destPath);
  const destTime = destStat.mtime?.getTime() || 0;
  
  let sourceTime: number;
  
  // Get source file time based on inclusion type
  switch (inclusion.type) {
    case "git": {
      try {
        // Try to get git commit time
        const relativePath = relative(inclusion.localPath, sourcePath);
        const result = await runGitCommand(
          inclusion.localPath,
          ["log", "-1", "--format=%ct", "--", relativePath]
        );
        
        if (result.trim()) {
          // Convert Unix timestamp to milliseconds
          sourceTime = parseInt(result.trim()) * 1000;
        } else {
          // Fall back to file modification time
          log.warn(`Could not determine git commit time for ${sourcePath}, using file modification time instead.`);
          const sourceStat = await Deno.stat(sourcePath);
          sourceTime = sourceStat.mtime?.getTime() || 0;
        }
      } catch (error) {
        // Fall back to file modification time
        log.warn(`Error determining git commit time for ${sourcePath}: ${error instanceof Error ? error.message : "Unknown error"}`);
        const sourceStat = await Deno.stat(sourcePath);
        sourceTime = sourceStat.mtime?.getTime() || 0;
      }
      break;
    }
    
    case "web": {
      // Web inclusions are not yet implemented
      // For now, default to file modification time
      if (!ignoreMissingTimestamps) {
        throw new Error(`Cannot determine timestamp for web inclusion: ${inclusion.url}`);
      }
      
      // Default to current time if ignoring missing timestamps
      sourceTime = Date.now();
      break;
    }
    
    case "local": {
      // Use file modification time
      const sourceStat = await Deno.stat(sourcePath);
      sourceTime = sourceStat.mtime?.getTime() || 0;
      break;
    }
  }
  
  // Return true if source is newer than destination
  return sourceTime > destTime;
}
