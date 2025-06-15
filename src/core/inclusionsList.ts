import { Frame } from "./Frame.ts";
import { handleCaughtError } from "./utils/handleCaughtError.ts";
import { InclusionListItem, ResolvedInclusion, WebInclusion, LocalInclusion } from "../types.ts";
import { isGitInclusion, checkGitInclusion } from "./utils/gitInclusionUtils.ts";
import { directoryExists } from "./utils/directoryExists.ts";
import { log } from "./utils/logging.ts";

/**
 * Checks if an inclusion is a web inclusion
 * @param inclusion The inclusion to check
 * @returns True if the inclusion is a web inclusion
 */
export function isWebInclusion(inclusion: ResolvedInclusion): inclusion is WebInclusion {
  return inclusion.type === 'web';
}

/**
 * Checks if an inclusion is a local inclusion
 * @param inclusion The inclusion to check
 * @returns True if the inclusion is a local inclusion
 */
export function isLocalInclusion(inclusion: ResolvedInclusion): inclusion is LocalInclusion {
  return inclusion.type === 'local';
}

/**
 * Checks a web inclusion and returns its status
 * @param inclusion The web inclusion to check
 * @returns A promise that resolves to an InclusionListItem
 */
export async function checkWebInclusion(inclusion: WebInclusion): Promise<InclusionListItem> {
  let present = false;
  
  try {
    // Check if the URL is accessible
    const response = await fetch(inclusion.url, { method: 'HEAD' });
    present = response.ok;
  } catch (error) {
    handleCaughtError(error, `Failed to check web inclusion ${inclusion.name || inclusion.url}`);
  }

  return {
    order: inclusion.order,
    name: inclusion.name || inclusion.url,
    active: inclusion.options.active,
    present: present,
    syncStatus: present ? 'current' : 'missing',
    collisionStrategy: inclusion.options.collisionStrategy,
    updateStrategy: inclusion.options.updateStrategy,
    include: [], // Web inclusions don't have include/exclude patterns
    exclude: [],
    excludeByDefault: false,
    autoPullBeforeBuild: false,
    autoPushBeforeBuild: false,
    type: 'web',
  };
}

/**
 * Checks a local inclusion and returns its status
 * @param inclusion The local inclusion to check
 * @returns A promise that resolves to an InclusionListItem
 */
export async function checkLocalInclusion(inclusion: LocalInclusion): Promise<InclusionListItem> {
  const present = await directoryExists(inclusion.localPath);

  return {
    order: inclusion.order,
    name: inclusion.name || inclusion.localPath,
    active: inclusion.options.active,
    present: present,
    syncStatus: present ? 'current' : 'missing',
    collisionStrategy: inclusion.options.collisionStrategy,
    updateStrategy: inclusion.options.updateStrategy,
    include: inclusion.options.include,
    exclude: inclusion.options.exclude,
    excludeByDefault: inclusion.options.excludeByDefault,
    autoPullBeforeBuild: false,
    autoPushBeforeBuild: false,
    type: 'local',
  };
}

/**
 * Lists all inclusions and their statuses
 * @returns A promise that resolves to an array of InclusionListItems
 */
export async function inclusionsList(): Promise<InclusionListItem[]> {
  const results: InclusionListItem[] = [];
  const frame = Frame.getInstance();
  const { resolvedInclusions } = frame;

  // Process all inclusions
  for (const inclusion of resolvedInclusions) {
    try {
      if (isGitInclusion(inclusion)) {
        results.push(await checkGitInclusion(inclusion));
      } else if (isWebInclusion(inclusion)) {
        results.push(await checkWebInclusion(inclusion));
      } else if (isLocalInclusion(inclusion)) {
        results.push(await checkLocalInclusion(inclusion));
      } else {
        // deno-lint-ignore no-explicit-any
        log.warn(`Unknown inclusion type: ${(inclusion as any).type || "unknown"}`);
      }
    } catch (error) {
      handleCaughtError(error, `Failed to process inclusion ${inclusion.name || "unknown"}`);
    }
  }

  // Sort by order
  results.sort((a, b) => a.order - b.order);
  
  return results;
}
