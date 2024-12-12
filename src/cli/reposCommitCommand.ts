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
    log.debug("repos commit action invoked");
    const commitMessage = options.message || "weave repos commit";
    const results = await reposCommit(commitMessage);

    // Process results
    const successCount = results.filter(r => r.status === 'success').length;
    const failureCount = results.filter(r => r.status === 'failed').length;

    log.info(`Commits completed: ${successCount} succeeded, ${failureCount} failed.`);

    results.forEach(result => {
      if (result.status === 'success') {
        if (result.message?.includes("nothing to commit")) {
          log.info(`✅ ${result.localPath} no changes to commit`);
        } else {
          log.info(`✅ ${result.localPath} committed to ${result.url}`);
        }
      } else {
        log.error(`❌ ${result.url} failed: ${result.message}`);
      }
    });
  });
