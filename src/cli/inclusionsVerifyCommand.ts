import { Command } from "../deps/cliffy.ts";
import { log } from "../core/utils/logging.ts";
import { inclusionsVerify, VerifyOptions } from "../core/inclusionsVerify.ts";
import { Table } from "../deps/cliffy.ts";
import {
  red,
  yellow,
  green,
  bold,
} from "../deps/colors.ts";

export const inclusionsVerifyCommand = new Command()
  .name("verify")
  .description("Verify that all inclusions are ready for building")
  .option("--format <format:string>", "Output format: json, table", { default: "table" })
  .option("--ignore-behind", "Ignore repositories that are behind remote")
  .option("--ignore-ahead", "Ignore repositories that are ahead of remote")
  .option("--ignore-divergent", "Ignore repositories that have diverged from remote")
  .option("--ignore-checkout-consistency", "Ignore sparse checkout consistency issues")
  .option("--ignore-missing", "Ignore missing repositories or directories")
  .option("--ignore-dirty", "Ignore repositories with uncommitted changes")
  .option("--ignore-remote-availability", "Ignore remote URL availability checks")
  .option("--ignore-local-empty", "Ignore empty local directories")
  .action(async (options) => {
    log.debug("inclusions verify action invoked");
    
    // Convert command options to verify options
    const verifyOptions: VerifyOptions = {
      ignoreBehind: options.ignoreBehind,
      ignoreAhead: options.ignoreAhead,
      ignoreDivergent: options.ignoreDivergent,
      ignoreCheckoutConsistency: options.ignoreCheckoutConsistency,
      ignoreMissing: options.ignoreMissing,
      ignoreDirty: options.ignoreDirty,
      ignoreRemoteAvailability: options.ignoreRemoteAvailability,
      ignoreLocalEmpty: options.ignoreLocalEmpty,
    };
    
    const result = await inclusionsVerify(verifyOptions);
    
    // Count inclusions by type
    const gitCount = result.repoResults.length;
    const webCount = result.webResults.length;
    const localCount = result.localResults.length;
    const totalCount = gitCount + webCount + localCount;
    
    // Count ready and not ready inclusions
    const gitReadyCount = result.repoResults.filter(r => r.isReady).length;
    const webReadyCount = result.webResults.filter(r => r.isReady).length;
    const localReadyCount = result.localResults.filter(r => r.isReady).length;
    const totalReadyCount = gitReadyCount + webReadyCount + localReadyCount;
    
    if (options.format === "json") {
      console.log(JSON.stringify(result, null, 2));
    } else {
      // Output as tables
      const NAME_MAX_LENGTH = 20;
      const ISSUE_MAX_LENGTH = 40;
      
      // Create a table for git inclusions
      if (gitCount > 0) {
        console.log(bold("\nGit Inclusions:"));
        
        const gitTableData = result.repoResults.map(r => [
          r.inclusion.order.toString(),
          r.inclusion.name.length > NAME_MAX_LENGTH
            ? r.inclusion.name.substring(0, NAME_MAX_LENGTH) + "…"
            : r.inclusion.name,
          r.inclusion.present ? "Yes" : red("No"),
          r.inclusion.syncStatus !== "current" ? yellow(r.inclusion.syncStatus) : green(r.inclusion.syncStatus),
          r.isReady ? green("✓ Ready") : red("✗ Not Ready"),
          r.issues.length > 0 
            ? r.issues.join(", ").length > ISSUE_MAX_LENGTH
              ? r.issues.join(", ").substring(0, ISSUE_MAX_LENGTH) + "…"
              : r.issues.join(", ")
            : "",
        ]);
        
        const gitTable = new Table()
          .header(["Order", "Name", "Present", "Sync Status", "Ready", "Issues"])
          .body(gitTableData);
        gitTable.sort();
        gitTable.border(true);
        gitTable.render();
      }
      
      // Create a table for web inclusions
      if (webCount > 0) {
        console.log(bold("\nWeb Inclusions:"));
        
        const webTableData = result.webResults.map(r => [
          r.inclusion.order.toString(),
          r.inclusion.name.length > NAME_MAX_LENGTH
            ? r.inclusion.name.substring(0, NAME_MAX_LENGTH) + "…"
            : r.inclusion.name,
          r.isReady ? green("✓ Ready") : red("✗ Not Ready"),
          r.issues.length > 0 
            ? r.issues.join(", ").length > ISSUE_MAX_LENGTH
              ? r.issues.join(", ").substring(0, ISSUE_MAX_LENGTH) + "…"
              : r.issues.join(", ")
            : "",
        ]);
        
        const webTable = new Table()
          .header(["Order", "Name", "Ready", "Issues"])
          .body(webTableData);
        webTable.sort();
        webTable.border(true);
        webTable.render();
      }
      
      // Create a table for local inclusions
      if (localCount > 0) {
        console.log(bold("\nLocal Inclusions:"));
        
        const localTableData = result.localResults.map(r => [
          r.inclusion.order.toString(),
          r.inclusion.name.length > NAME_MAX_LENGTH
            ? r.inclusion.name.substring(0, NAME_MAX_LENGTH) + "…"
            : r.inclusion.name,
          r.inclusion.present ? "Yes" : red("No"),
          r.isReady ? green("✓ Ready") : red("✗ Not Ready"),
          r.issues.length > 0 
            ? r.issues.join(", ").length > ISSUE_MAX_LENGTH
              ? r.issues.join(", ").substring(0, ISSUE_MAX_LENGTH) + "…"
              : r.issues.join(", ")
            : "",
        ]);
        
        const localTable = new Table()
          .header(["Order", "Name", "Present", "Ready", "Issues"])
          .body(localTableData);
        localTable.sort();
        localTable.border(true);
        localTable.render();
      }
      
      // Display summary
      console.log("");
      if (result.isReady) {
        console.log(green(bold(`✓ All inclusions (${totalCount}) are ready for building.`)));
        console.log(`  - Git: ${gitReadyCount}/${gitCount}`);
        console.log(`  - Web: ${webReadyCount}/${webCount}`);
        console.log(`  - Local: ${localReadyCount}/${localCount}`);
      } else {
        const notReadyCount = totalCount - totalReadyCount;
        console.log(red(bold(`✗ ${notReadyCount} of ${totalCount} inclusions are not ready for building.`)));
        console.log(`  - Git: ${gitReadyCount}/${gitCount}`);
        console.log(`  - Web: ${webReadyCount}/${webCount}`);
        console.log(`  - Local: ${localReadyCount}/${localCount}`);
        
        // Display issues and suggestions
        if (result.issues.length > 0) {
          console.log("\nOverall issues:");
          
          for (let i = 0; i < result.issues.length; i++) {
            console.log(`  ${red("•")} ${result.issues[i]}`);
            if (result.suggestions[i]) {
              console.log(`    ${green("→")} ${result.suggestions[i]}`);
            }
          }
        }
        
        // Display detailed issues for each inclusion type
        let hasDetailedIssues = false;
        
        // Git issues
        const gitIssues = result.repoResults.filter(r => !r.isReady);
        if (gitIssues.length > 0) {
          if (!hasDetailedIssues) {
            console.log("\nDetailed issues:");
            hasDetailedIssues = true;
          }
          
          console.log(`\n${bold("Git Inclusions:")} (${gitIssues.length} with issues)`);
          
          for (const r of gitIssues) {
            console.log(`\n  ${bold(r.inclusion.name)}:`);
            
            for (let i = 0; i < r.issues.length; i++) {
              console.log(`    ${red("•")} ${r.issues[i]}`);
              if (r.suggestions[i]) {
                console.log(`      ${green("→")} ${r.suggestions[i]}`);
              }
            }
          }
        }
        
        // Web issues
        const webIssues = result.webResults.filter(r => !r.isReady);
        if (webIssues.length > 0) {
          if (!hasDetailedIssues) {
            console.log("\nDetailed issues:");
            hasDetailedIssues = true;
          }
          
          console.log(`\n${bold("Web Inclusions:")} (${webIssues.length} with issues)`);
          
          for (const r of webIssues) {
            console.log(`\n  ${bold(r.inclusion.name)}:`);
            
            for (let i = 0; i < r.issues.length; i++) {
              console.log(`    ${red("•")} ${r.issues[i]}`);
              if (r.suggestions[i]) {
                console.log(`      ${green("→")} ${r.suggestions[i]}`);
              }
            }
          }
        }
        
        // Local issues
        const localIssues = result.localResults.filter(r => !r.isReady);
        if (localIssues.length > 0) {
          if (!hasDetailedIssues) {
            console.log("\nDetailed issues:");
            hasDetailedIssues = true;
          }
          
          console.log(`\n${bold("Local Inclusions:")} (${localIssues.length} with issues)`);
          
          for (const r of localIssues) {
            console.log(`\n  ${bold(r.inclusion.name)}:`);
            
            for (let i = 0; i < r.issues.length; i++) {
              console.log(`    ${red("•")} ${r.issues[i]}`);
              if (r.suggestions[i]) {
                console.log(`      ${green("→")} ${r.suggestions[i]}`);
              }
            }
          }
        }
        
        // Display command suggestions
        console.log("\nSuggested commands:");
        
        // Check if any git repositories have issues
        if (gitIssues.length > 0) {
          console.log(`  ${green("→")} Run 'weave repos verify' for detailed git repository status`);
        }
        
        // Check if any repositories are missing
        if (result.repoResults.some(r => !r.inclusion.present)) {
          console.log(`  ${green("→")} Run 'weave repos checkout' to initialize missing repositories`);
        }
        
        // Check if any local inclusions are missing
        if (result.localResults.some(r => !r.inclusion.present)) {
          console.log(`  ${green("→")} Create missing local directories`);
        }
        
        // Suggest using ignore flags
        console.log(`  ${green("→")} Use --ignore-* flags to ignore specific issues`);
      }
    }
    
    // Exit with error code if not ready
    if (!result.isReady) {
      Deno.exit(1);
    }
  });
