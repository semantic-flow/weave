import { Command } from "../deps/cliffy.ts";
import { log } from "../core/utils/logging.ts";
import { reposPrepare } from "../core/reposPrepare.ts";
import { validPullStrategies, validPushStrategies } from "../types.ts";

interface PrepareOptions {
  pullStrategy?: string;
  pushStrategy?: string;
}

export const reposPrepareCommand = new Command()
  .name("prepare")
  .description("Prepare repositories by checking out, pulling, and pushing as configured")
  .option("--pull-strategy <strategy:string>", `Pull strategy to use (${validPullStrategies.join(", ")})`, {
    required: false,
  })
  .option("--push-strategy <strategy:string>", `Push strategy to use (${validPushStrategies.join(", ")})`, {
    required: false,
  })
  .action(async (options: PrepareOptions) => {
    // Validate pull strategy if provided
    if (options.pullStrategy && !validPullStrategies.includes(options.pullStrategy)) {
      log.error(`Invalid pull strategy: ${options.pullStrategy}. Must be one of: ${validPullStrategies.join(", ")}`);
      Deno.exit(1);
    }
    
    // Validate push strategy if provided
    if (options.pushStrategy && !validPushStrategies.includes(options.pushStrategy)) {
      log.error(`Invalid push strategy: ${options.pushStrategy}. Must be one of: ${validPushStrategies.join(", ")}`);
      Deno.exit(1);
    }
    log.debug("repos prepare action invoked");
    const results = await reposPrepare(options.pullStrategy, options.pushStrategy);

    // Process results
    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;

    log.info(`Prepare operations completed: ${successCount} succeeded, ${failureCount} failed.`);

    // Group results by repository
    const resultsByRepo = new Map<string, { success: boolean; messages: string[] }>();
    
    results.forEach(result => {
      const repoKey = `${result.localPath}`;
      if (!resultsByRepo.has(repoKey)) {
        resultsByRepo.set(repoKey, { success: true, messages: [] });
      }
      
      const repoResult = resultsByRepo.get(repoKey)!;
      
      if (!result.success) {
        repoResult.success = false;
      }
      
      if (result.message) {
        repoResult.messages.push(result.message);
      }
    });
    
    // Log results by repository
    resultsByRepo.forEach((repoResult, repoKey) => {
      if (repoResult.success) {
        log.info(`✅ ${repoKey} prepared successfully`);
      } else {
        log.error(`❌ ${repoKey} preparation failed:`);
        repoResult.messages.forEach(message => {
          log.error(`   - ${message}`);
        });
      }
    });

    if (failureCount > 0) {
      Deno.exit(1);
    }
  });
