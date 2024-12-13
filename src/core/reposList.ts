import { log } from "../core/utils/logging.ts";
import { runGitCommand } from "../core/utils/runGitCommand.ts"; // Ensure you have this utility
import { Frame } from "../core/Frame.ts";
import { handleCaughtError } from "../core/utils/handleCaughtError.ts";
import { ResolvedInclusion, InclusionListItem, GitInclusion } from "../types.ts";
import { isGitInclusion, checkGitInclusion } from "../core/utils/gitInclusionUtils.ts";


export async function reposList(): Promise<InclusionListItem[]> {
  const results: InclusionListItem[] = [];
  const frame = Frame.getInstance();
  const { inclusions } = frame.config;

  // Filter for only git inclusions
  const gitInclusions = inclusions
    .filter(isGitInclusion)
    .filter(inclusion => inclusion.options?.active !== false);

  for (const inclusion of gitInclusions) {
    try {
      results.push(await checkGitInclusion(inclusion));
    } catch (error) {
      handleCaughtError(error, `Failed to construct InclusionListItem ${inclusion.name || inclusion.url}`)
    }
  }
  return results;
}