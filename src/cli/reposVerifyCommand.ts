import { Command } from "@/deps/cliffy.ts";
import { log } from "@/core/utils/logging.ts";
import { reposVerify, VerifyOptions } from "@/core/reposVerify.ts";
import { Table } from "@/deps/cliffy.ts";
import {
  red,
  yellow,
  green,
  bold,
} from "@/deps/colors.ts";

export const reposVerifyCommand = new Command()
  .name("verify")
  .description("Verify that repositories are ready for building")
  .option("--format <format:string>", "Output format: json, table", { default: "table" })
  .option("--ignore-behind", "Ignore repositories that are behind remote")
  .option("--ignore-ahead", "Ignore repositories that are ahead of remote")
  .option("--ignore-divergent", "Ignore repositories that have diverged from remote")
  .option("--ignore-checkout-consistency", "Ignore sparse checkout consistency issues")
  .option("--ignore-missing", "Ignore missing repositories")
  .option("--ignore-dirty", "Ignore repositories with uncommitted changes")
  .action(async (options) => {
    log.debug("repos verify action invoked");
    
    // Convert command options to verify options
    const verifyOptions: VerifyOptions = {
      ignoreBehind: options.ignoreBehind,
      ignoreAhead: options.ignoreAhead,
      ignoreDivergent: options.ignoreDivergent,
      ignoreCheckoutConsistency: options.ignoreCheckoutConsistency,
      ignoreMissing: options.ignoreMissing,
      ignoreDirty: options.ignoreDirty,
    };
    
    const results = await reposVerify(verifyOptions);
    
    // Count ready and not ready repositories
    const readyCount = results.filter(r => r.isReady).length;
    const notReadyCount = results.filter(r => !r.isReady).length;
    
    if (options.format === "json") {
      console.log(JSON.stringify(results, null, 2));
    } else {
      // Output as a table
      const NAME_MAX_LENGTH = 20;
      const ISSUE_MAX_LENGTH = 40;
      
      // Create a table for repository status
      const tableData = results.map(result => [
        result.inclusion.order.toString(),
        result.inclusion.name.length > NAME_MAX_LENGTH
          ? result.inclusion.name.substring(0, NAME_MAX_LENGTH) + "…"
          : result.inclusion.name,
        result.inclusion.present ? "Yes" : red("No"),
        result.inclusion.syncStatus !== "current" ? yellow(result.inclusion.syncStatus) : green(result.inclusion.syncStatus),
        result.isReady ? green("✓ Ready") : red("✗ Not Ready"),
        result.issues.length > 0 
          ? result.issues.join(", ").length > ISSUE_MAX_LENGTH
            ? result.issues.join(", ").substring(0, ISSUE_MAX_LENGTH) + "…"
            : result.issues.join(", ")
          : "",
      ]);
      
      // Create a Table instance using the transformed data
      const table = new Table()
        .header(["Order", "Name", "Present", "Sync Status", "Ready", "Issues"])
        .body(tableData);
      table.sort();
      table.border(true);
      table.render();
      
      // Display summary
      console.log("");
      if (notReadyCount === 0) {
        console.log(green(bold(`✓ All repositories (${readyCount}) are ready for building.`)));
      } else {
        console.log(red(bold(`✗ ${notReadyCount} of ${results.length} repositories are not ready for building.`)));
        
        // Display issues and suggestions for repositories that are not ready
        console.log("\nIssues and suggestions:");
        
        for (const result of results.filter(r => !r.isReady)) {
          console.log(`\n${bold(result.inclusion.name)}:`);
          
          for (let i = 0; i < result.issues.length; i++) {
            console.log(`  ${red("•")} ${result.issues[i]}`);
            if (result.suggestions[i]) {
              console.log(`    ${green("→")} ${result.suggestions[i]}`);
            }
          }
        }
        
        // Display command suggestions
        console.log("\nSuggested commands:");
        
        // Check if any repositories are missing
        if (results.some(r => !r.inclusion.present)) {
          console.log(`  ${green("→")} Run 'weave repos checkout' to initialize missing repositories`);
        }
        
        // Check if any repositories are behind
        if (results.some(r => r.inclusion.syncStatus === "behind")) {
          console.log(`  ${green("→")} Run 'weave repos pull' to update repositories that are behind`);
        }
        
        // Check if any repositories are ahead
        if (results.some(r => r.inclusion.syncStatus === "ahead")) {
          console.log(`  ${green("→")} Run 'weave repos push' to push local changes`);
        }
        
        // Check if any repositories are diverged
        if (results.some(r => r.inclusion.syncStatus === "conflicted")) {
          console.log(`  ${green("→")} Run 'weave repos sync --pull-strategy=rebase' to synchronize diverged repositories`);
        }
        
        // Check if any repositories have uncommitted changes
        if (results.some(r => r.inclusion.syncStatus === "dirty")) {
          console.log(`  ${green("→")} Run 'weave repos commit -m \"Your commit message\"' to commit changes`);
        }
        
        // Suggest using ignore flags
        console.log(`  ${green("→")} Use --ignore-* flags to ignore specific issues`);
      }
    }
    
    // Exit with error code if any repositories are not ready
    if (notReadyCount > 0) {
      Deno.exit(1);
    }
  });
