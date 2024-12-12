import { Command } from "../deps/cliffy.ts";
import { log } from "../core/utils/logging.ts";
import { runGitCommand } from "../core/utils/runGitCommand.ts"; // Ensure you have this utility
import { Frame } from "../core/Frame.ts";
import { CommitOptions } from "../types.ts";
import { handleCaughtError } from "../core/utils/handleCaughtError.ts";
import { reposCommit } from "../core/reposCommit.ts";


export const reposCommitCommand = new Command()
  .name("commit")
  .description("Commit changes in the repositories")
  .option("-m, --message <message:string>", "Commit message", { required: false })
  .action(async (options: CommitOptions) => {
    log.info("repos commit action invoked");
    const commitMessage = options.message || "weave repos commit";
    const results = await reposCommit(commitMessage);
    log.debug(`Results: ${JSON.stringify(results)}`);
  });
