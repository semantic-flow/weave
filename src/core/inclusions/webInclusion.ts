import { WebInclusion } from "../../types.ts";
import { BuildResult } from "../interfaces/build.ts";

/**
 * Processes a web inclusion.
 * Note: This is a placeholder for future implementation.
 */
export function processWebInclusion(inclusion: WebInclusion, _destDir: string, result: BuildResult): void {
  // Web inclusions are not yet implemented
  result.warnings.push(`Web inclusions are not yet implemented: ${inclusion.name || inclusion.url}`);
}
