import { Command } from "@/deps/cliffy.ts";
import { log } from "@/core/utils/logging.ts";
import { build, BuildOptions } from "@/core/build.ts";
import {
  red,
  yellow,
  green,
  bold,
} from "@/deps/colors.ts";

export const buildCommand = new Command()
  .name("build")
  .description("Build the project by copying files from inclusions to the destination directory")
  .option("--no-verify", "Skip verification of inclusions before building")
  .option("--no-prepare", "Skip preparation of repositories before building")
  .option("--pull-strategy <strategy:string>", "Pull strategy to use for git repositories (ff-only, rebase, merge)")
  .option("--push-strategy <strategy:string>", "Push strategy to use for git repositories (no-force, force-with-lease, force)")
  // Verification ignore options
  .option("--ignore-behind", "Ignore repositories that are behind remote")
  .option("--ignore-ahead", "Ignore repositories that are ahead of remote")
  .option("--ignore-divergent", "Ignore repositories that have diverged from remote")
  .option("--ignore-checkout-consistency", "Ignore sparse checkout consistency issues")
  .option("--ignore-missing", "Ignore missing repositories or directories")
  .option("--ignore-dirty", "Ignore repositories with uncommitted changes")
  .option("--ignore-remote-availability", "Ignore remote URL availability checks")
  .option("--ignore-local-empty", "Ignore empty local directories")
  .action(async (options) => {
    log.debug("build action invoked");
    
    // Convert command options to build options
    const buildOptions: BuildOptions = {
      verify: options.verify !== false,
      prepare: options.prepare !== false,
      pullStrategy: options.pullStrategy,
      pushStrategy: options.pushStrategy,
      // Verification options
      ignoreBehind: options.ignoreBehind,
      ignoreAhead: options.ignoreAhead,
      ignoreDivergent: options.ignoreDivergent,
      ignoreCheckoutConsistency: options.ignoreCheckoutConsistency,
      ignoreMissing: options.ignoreMissing,
      ignoreDirty: options.ignoreDirty,
      ignoreRemoteAvailability: options.ignoreRemoteAvailability,
      ignoreLocalEmpty: options.ignoreLocalEmpty,
    };
    
    // Execute build
    const result = await build(buildOptions);
    
    // Display verification results if available
    if (result.verifyResult) {
      // Count inclusions by type
      const gitCount = result.verifyResult.repoResults.length;
      const webCount = result.verifyResult.webResults.length;
      const localCount = result.verifyResult.localResults.length;
      
      // Count ready and not ready inclusions
      const gitReadyCount = result.verifyResult.repoResults.filter(r => r.isReady).length;
      const webReadyCount = result.verifyResult.webResults.filter(r => r.isReady).length;
      const localReadyCount = result.verifyResult.localResults.filter(r => r.isReady).length;
      
      console.log(bold("\nVerification Summary:"));
      console.log(`  Git inclusions: ${gitReadyCount}/${gitCount} ready`);
      console.log(`  Web inclusions: ${webReadyCount}/${webCount} ready`);
      console.log(`  Local inclusions: ${localReadyCount}/${localCount} ready`);
    }
    
    // Display results
    if (result.success) {
      console.log(green(bold(`\n✓ Build completed successfully.`)));
    } else {
      console.log(red(bold(`\n✗ Build failed.`)));
    }

    // Display file statistics (common to both success and failure)
    console.log(`Files copied: ${result.filesCopied}`);
    console.log(`Files skipped: ${result.filesSkipped}`);
    console.log(`Files overwritten: ${result.filesOverwritten}`);

    // Display errors only if build failed
    if (!result.success && result.errors.length > 0) {
      console.log(bold("\nErrors:"));
      for (const error of result.errors) {
        console.log(`  ${red("•")} ${error}`);
      }
    }
    
    // Display warnings
    if (result.warnings.length > 0) {
      console.log(bold("\nWarnings:"));
      for (const warning of result.warnings) {
        console.log(`  ${yellow("•")} ${warning}`);
      }
    }
    
    // Exit with error code if build failed
    if (!result.success) {
      Deno.exit(1);
    }
  });
