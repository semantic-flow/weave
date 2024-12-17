import { ResolvedInclusion, InclusionListItem, GitInclusion, SyncStatus } from "../../types.ts";
import { directoryExists } from "./directoryExists.ts";
import { runGitCommand } from "./runGitCommand.ts";
import { handleCaughtError } from "./handleCaughtError.ts";

export function isGitInclusion(inclusion: ResolvedInclusion): inclusion is GitInclusion {
  return inclusion.type === 'git';
}

export async function getSyncStatus(localPath: string): Promise<SyncStatus> {
  try {
    // Use git status to check the current status of the working directory
    const statusOutput = await runGitCommand(localPath, ["status", "--branch", "--porcelain"]);

    const lines = statusOutput.trim().split('\n');
    const branchStatus = lines.shift() || '';

    // Check for the "up-to-date" status in the branch line
    if (branchStatus.includes('ahead') && branchStatus.includes('behind')) {
      return 'conflicted';
    }

    if (branchStatus.includes('ahead')) {
      return 'ahead';
    }

    if (branchStatus.includes('behind')) {
      return 'behind';
    }

    // If there are modifications
    if (lines.length > 0) {
      return 'dirty'; // Local uncommitted changes
    }

    return 'current'; // No changes and not ahead/behind
  } catch (error) {
    if (error instanceof Error) {
      handleCaughtError(error, `Failed to get Sync Status for ${localPath}: ${error.message}`);
    }
    return 'unknown'; // Default to 'unknown' in case of error
  }
}

export async function checkGitInclusion(inclusion: GitInclusion): Promise<InclusionListItem> {
  // Construct the directory path
  const present = await directoryExists(inclusion.localPath);
  let syncStatus: SyncStatus;
  if (!present) {
    syncStatus = "missing";
  } else {
    syncStatus = await getSyncStatus(inclusion.localPath);
  }
  const listItem: InclusionListItem = {
    order: inclusion.order,
    name: inclusion.name || inclusion.url,
    active: inclusion.options.active !== false,
    present: present,
    syncStatus: syncStatus,
    copyStrategy: inclusion.options.copyStrategy,
    include: inclusion.options.include,
    exclude: inclusion.options.exclude,
    excludeByDefault: inclusion.options.excludeByDefault,
    autoPullBeforeBuild: inclusion.options.autoPullBeforeBuild,
    autoPushBeforeBuild: inclusion.options.autoPushBeforeBuild,
  };

  return listItem;
}