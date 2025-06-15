import { Command } from "@/deps/cliffy.ts";
import { log } from "@/core/utils/logging.ts";
import { CommitOptions } from "@/types.ts";
import { reposSync } from "@/core/reposSync.ts";
import { validPullStrategies, validPushStrategies } from "@/types.ts";

interface SyncOptions extends CommitOptions {
  pullStrategy?: string;
  pushStrategy?: string;
}

export const reposSyncCommand = new Command()
  .name("sync")
  .description("Synchronize repositories by committing, pulling, and pushing changes")
  .option("-m, --message <message:string>", "Commit message", { required: false })
  .option("--pull-strategy <strategy:string>", `Pull strategy to use (${validPullStrategies.join(", ")})`, {
    required: false,
  })
  .option("--push-strategy <strategy:string>", `Push strategy to use (${validPushStrategies.join(", ")})`, {
    required: false,
  })
  .action(async (options: SyncOptions) => {
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
    log.debug("repos sync action invoked");
    const commitMessage = options.message || "weave repos sync";
    const results = await reposSync(commitMessage, options.pullStrategy, options.pushStrategy);

    // Process results
    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;

    if (failureCount === 0) {
      log.info(`✅ Sync operations completed successfully: ${successCount} operations performed.`);
    } else {
      log.info(`Sync operations completed: ${successCount} succeeded, ${failureCount} failed.`);
    }

    // Group results by repository
    const resultsByRepo = new Map<string, { 
      success: boolean; 
      errorMessages: string[]; 
      infoMessages: string[];
    }>();
    
    results.forEach(result => {
      const repoKey = `${result.localPath}`;
      if (!resultsByRepo.has(repoKey)) {
        resultsByRepo.set(repoKey, { 
          success: true, 
          errorMessages: [], 
          infoMessages: [] 
        });
      }
      
      const repoResult = resultsByRepo.get(repoKey)!;
      
      if (!result.success) {
        repoResult.success = false;
      }
      
      if (result.message) {
        // Identify informational messages vs error messages
        if (!result.success && !isInformationalMessage(result.message)) {
          repoResult.errorMessages.push(result.message);
        } else {
          repoResult.infoMessages.push(result.message);
        }
      }
    });
    
    // Log results by repository
    resultsByRepo.forEach((repoResult, repoKey) => {
      if (repoResult.success) {
        log.info(`✅ ${repoKey} synchronized successfully`);
        // Show informational messages for successful repos
        repoResult.infoMessages.forEach(message => {
          log.info(`   - ${message}`);
        });
      } else {
        log.error(`❌ ${repoKey} synchronization failed:`);
        // Show error messages
        repoResult.errorMessages.forEach(message => {
          log.error(`   - ${message}`);
        });
        // Show informational messages separately
        if (repoResult.infoMessages.length > 0) {
          log.info(`   Additional information for ${repoKey}:`);
          repoResult.infoMessages.forEach(message => {
            log.info(`   - ${message}`);
          });
        }
      }
    });

    // Helper function to identify informational messages
    function isInformationalMessage(message: string): boolean {
      const infoMessages = [
        "No changes to push",
        "Already up to date",
        "Everything up-to-date"
      ];
      
      return infoMessages.some(infoMsg => message.includes(infoMsg));
    }

    if (failureCount > 0) {
      Deno.exit(1);
    }
  });
