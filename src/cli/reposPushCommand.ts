import { Command } from "../deps/cliffy.ts";
import { log } from "../core/utils/logging.ts";
import { reposPush } from "../core/reposPush.ts";
import { validPushStrategies } from "../types.ts";

interface PushOptions {
  pushStrategy?: string;
}

export const reposPushCommand = new Command()
  .name("push")
  .description("Push local changes to remote repositories")
  .option("--push-strategy <strategy:string>", `Push strategy to use (${validPushStrategies.join(", ")})`, {
    required: false,
  })
  .action(async (options: PushOptions) => {
    // Validate push strategy if provided
    if (options.pushStrategy && !validPushStrategies.includes(options.pushStrategy)) {
      log.error(`Invalid push strategy: ${options.pushStrategy}. Must be one of: ${validPushStrategies.join(", ")}`);
      Deno.exit(1);
    }
    log.debug("repos push action invoked");
    const results = await reposPush(options.pushStrategy);

    // Process results
    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;

    log.info(`Push operations completed: ${successCount} succeeded, ${failureCount} failed.`);

    results.forEach(result => {
      if (result.success) {
        if (result.message?.includes("No changes to push")) {
          log.info(`✅ ${result.localPath} no changes to push`);
        } else {
          log.info(`✅ ${result.localPath} pushed to ${result.url}`);
        }
      } else {
        log.error(`❌ ${result.url} failed: ${result.message}`);
      }
    });

    if (failureCount > 0) {
      Deno.exit(1);
    }
  });
