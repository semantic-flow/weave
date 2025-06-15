import { Command } from "@/deps/cliffy.ts";
import { log } from "@/core/utils/logging.ts";
import { reposPull } from "@/core/reposPull.ts";
import { validPullStrategies } from "@/types.ts";

interface PullOptions {
  pullStrategy?: string;
}

export const reposPullCommand = new Command()
  .name("pull")
  .description("Pull latest changes from remote repositories")
  .option("--pull-strategy <strategy:string>", `Pull strategy to use (${validPullStrategies.join(", ")})`, {
    required: false,
  })
  .action(async (options: PullOptions) => {
    // Validate pull strategy if provided
    if (options.pullStrategy && !validPullStrategies.includes(options.pullStrategy)) {
      log.error(`Invalid pull strategy: ${options.pullStrategy}. Must be one of: ${validPullStrategies.join(", ")}`);
      Deno.exit(1);
    }
    log.debug("repos pull action invoked");
    const results = await reposPull(options.pullStrategy);

    // Process results
    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;

    log.info(`Pull operations completed: ${successCount} succeeded, ${failureCount} failed.`);

    results.forEach(result => {
      if (result.success) {
        if (result.message?.includes("Already up to date")) {
          log.info(`✅ ${result.localPath} already up to date`);
        } else {
          log.info(`✅ ${result.localPath} pulled from ${result.url}`);
        }
      } else {
        log.error(`❌ ${result.url} failed: ${result.message}`);
      }
    });

    if (failureCount > 0) {
      Deno.exit(1);
    }
  });
