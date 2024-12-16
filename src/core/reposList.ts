import { Frame } from "../core/Frame.ts";
import { handleCaughtError } from "../core/utils/handleCaughtError.ts";
import { InclusionListItem, GitInclusion } from "../types.ts";
import { isGitInclusion, checkGitInclusion } from "../core/utils/gitInclusionUtils.ts";


export async function reposList(): Promise<InclusionListItem[]> {
  const results: InclusionListItem[] = [];
  const frame = Frame.getInstance();
  const { resolvedInclusions } = frame; // <-- Correctly access resolvedInclusions

  // Filter for only git inclusions
  const gitInclusions = resolvedInclusions
    .filter(isGitInclusion);

  for (const inclusion of gitInclusions) {
    try {
      results.push(await checkGitInclusion(inclusion));
    } catch (error) {
      handleCaughtError(error, `Failed to construct InclusionListItem ${inclusion.name || inclusion.url}`)
    }
  }
  return results;
}