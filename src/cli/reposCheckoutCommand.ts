import { Command } from "../deps/cliffy.ts";
import { log } from "../core/utils/logging.ts";
import { checkoutRepos, RepoCheckoutResult } from "../core/checkoutRepos.ts";
import { Frame } from "../core/Frame.ts";

export const reposCheckoutCommand = new Command()
  .name("checkout")
  .description("for missing repos, checkout (when no inclusions or exclusions specified and excludeByDefault is false) or sparse checkout otherwise.")
  .action(async () => {
    try {
      log.info("repos checkout action invoked");

      const frame = Frame.getInstance();
      const repoDir = frame.config.global.repoDir;
      const inclusions = frame.config.inclusions; // Assuming `inclusions` is part of the config

      if (frame.config.global.repoDir === undefined) {
        log.error("repoDir is not defined in the configuration.");
        Deno.exit(1);
      }
      const results: RepoCheckoutResult[] = await checkoutRepos(repoDir as string, inclusions);

      // Process results
      const successCount = results.filter(r => r.status === 'success').length;
      const failureCount = results.filter(r => r.status === 'failed').length;

      log.info(`Checkout completed: ${successCount} succeeded, ${failureCount} failed.`);

      results.forEach(result => {
        if (result.status === 'success') {
          log.info(`✅ ${result.url} checked out to ${result.localPath}`);
        } else {
          log.error(`❌ ${result.url} failed: ${result.message}`);
        }
      });

      if (failureCount > 0) {
        Deno.exit(1); // exit with error code
      }
    } catch (error) {
      log.error(`An unexpected error occurred during checkout: ${error}`);
      Deno.exit(1);
    }
  });