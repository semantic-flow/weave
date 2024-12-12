import { Command } from "../deps/cliffy.ts";
import { log } from "../core/utils/logging.ts";
import { reposCheckout } from "../core/reposCheckout.ts";
import { Frame } from "../core/Frame.ts";
import { handleCaughtError } from "../core/utils/handleCaughtError.ts";
import { RepoGitResult } from "../types.ts";

export const reposCheckoutCommand = new Command()
  .name("checkout")
  .description("for missing repos, checkout (when no inclusions or exclusions specified and excludeByDefault is false) or sparse checkout otherwise.")
  .action(async () => {
    try {
      log.info("repos checkout action invoked");

      const frame = Frame.getInstance();
      const workspaceDir = frame.config.global.workspaceDir;
      const inclusions = frame.config.inclusions; // Assuming `inclusions` is part of the config

      if (frame.config.global.workspaceDir === undefined) {
        log.error("workspaceDir is not defined in the configuration.");
        Deno.exit(1);
      }
      const results: RepoGitResult[] = await reposCheckout(workspaceDir as string, inclusions);

      // Process results
      const successCount = results.filter(r => r.status === 'success').length;
      const failureCount = results.filter(r => r.status === 'failed').length;

      log.info(`Checkout completed: ${successCount} succeeded, ${failureCount} failed.`);

      results.forEach(result => {
        if (result.status === 'success') {
          log.info(`✅ ${result.url} ready at ${result.localPath}`);
        } else {
          log.error(`❌ ${result.url} failed: ${result.message}`);
        }
      });

      if (failureCount > 0) {
        Deno.exit(1); // exit with error code
      }
    } catch (error) {
      handleCaughtError(error, "An unexpected error occurred during checkout:");
      Deno.exit(1);
    }
  });