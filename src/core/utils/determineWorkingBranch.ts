import { log } from "./logging.ts";
import { runGitCommand } from "./runGitCommand.ts";

export async function determineWorkingBranch(workingDir: string): Promise<string> {
  const branch = await runGitCommand(workingDir, ["rev-parse", "--abbrev-ref", "HEAD"]);
  log.debug(`Working branch: ${branch}`);
  return branch;
}