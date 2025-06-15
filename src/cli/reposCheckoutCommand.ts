import { Command } from "@/deps/cliffy.ts";
import { log } from "@/core/utils/logging.ts";
import { reposCheckout } from "@/core/reposCheckout.ts";
import { handleCaughtError } from "@/core/utils/handleCaughtError.ts";
import { RepoGitResult } from "@/types.ts";

export const reposCheckoutCommand = new Command()
  .name("checkout")
  .description("for missing repos, checkout (when no inclusions or exclusions specified and excludeByDefault is false) or sparse checkout otherwise.")
  .action(async () => {
    try {
      log.debug("repos checkout action invoked");

      const results: RepoGitResult[] = await reposCheckout();

      // Process results
      const successCount = results.filter(r => r.success).length;
      const failureCount = results.filter(r => !r.success).length;

      log.info(`weave repos checkout completed: ${successCount} succeeded, ${failureCount} failed.`);

      results.forEach(result => {
        if (result.success) {
          log.info(`✅ ${result.localPath} ready`);
        } else {
          log.error(`❌ ${result.localPath} not ready: ${result.message}`);
        }
      });

      if (failureCount > 0) {
        Deno.exit(1);
      }
    } catch (error) {
      handleCaughtError(error, "An unexpected error occurred during checkout:");
      Deno.exit(1);
    }
  });
