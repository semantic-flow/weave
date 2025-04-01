// src/core/utils/applyRemappings.ts

import { Remapping } from "../../types.ts";
import { log } from "./logging.ts";

/**
 * Applies remappings to a file path.
 * @param filePath The relative file path to remap
 * @param remappings Array of remapping rules to apply
 * @returns The remapped file path
 */
export function applyRemappings(filePath: string, remappings: Remapping[]): string {
  if (!remappings || remappings.length === 0) {
    return filePath;
  }
  
  const remappedPath = filePath;
  
  for (const remap of remappings) {
    // Simple string replacement for exact matches
    if (filePath === remap.source) {
      log.debug(`Remapping exact match: ${filePath} -> ${remap.target}`);
      return remap.target;
    }
    
    // Handle directory remappings (source ends with /)
    if (remap.source.endsWith('/') && filePath.startsWith(remap.source)) {
      const newPath = filePath.replace(remap.source, remap.target);
      log.debug(`Remapping directory: ${filePath} -> ${newPath}`);
      return newPath;
    }
    
    // Handle pattern remappings with wildcards
    if (remap.source.includes('*')) {
      try {
        // Convert glob pattern to regex
        const regexPattern = remap.source
          .replace(/\./g, '\\.')
          .replace(/\*/g, '(.*)');
        
        const regex = new RegExp(`^${regexPattern}$`);
        const match = filePath.match(regex);
        
        if (match) {
          // Replace wildcards in target with captured groups
          let targetPath = remap.target;
          for (let i = 1; i < match.length; i++) {
            targetPath = targetPath.replace(`$${i}`, match[i]);
          }
          log.debug(`Remapping pattern: ${filePath} -> ${targetPath}`);
          return targetPath;
        }
      } catch (error) {
        log.error(`Error applying remapping pattern "${remap.source}": ${error instanceof Error ? error.message : "Unknown error"}`);
      }
    }
  }
  
  return remappedPath;
}
