import { Command } from "../deps/cliffy.ts";
import { log } from "../core/utils/logging.ts";
import { reposList } from "../core/reposList.ts";
import { Table } from "../deps/cliffy.ts"; import {
  red,
  /* strikethrough,*/
  yellow,
  green
} from "../deps/colors.ts";

export const reposListCommand = new Command()
  .name("list")
  .description("List repositories in the configuration, and their local status.")
  .option("--format <format:string>", "Output format: json, table", { default: "table" })
  .action(async ({ format }) => {
    log.debug("repos list action invoked");
    const results = await reposList();

    if (format === "json") {
      console.log(JSON.stringify(results, null, 2));
    } else {
      // Output as a table
      // Convert array of objects to array of arrays
      const NAME_MAX_LENGTH = 20;

      const tableData = results.map(item => [
        item.order.toString(),
        item.name.length > NAME_MAX_LENGTH
          ? item.name.substring(0, NAME_MAX_LENGTH) + "…"
          : item.name || "N/A",  // Fallback to "N/A" only if item.name is not defined or empty
        item.present ? "Yes" : red("No"),
        item.syncStatus != "current" ? yellow(item.syncStatus) : green(item.syncStatus),
        item.collisionStrategy,
        item.updateStrategy,
        item.excludeByDefault ? "Exclude" : "Include",
        item.autoPushBeforeBuild ? "Auto" : "No",
        item.autoPullBeforeBuild ? "Auto" : "No",
      ]);

      // Create a Table instance using the transformed data
      const table = new Table()
        .header(["Order", "Name", /* "Active", */ "Present", "Sync Status", "Collision", "Update", "Default", "Push", "Pull"])
        .body(tableData);
      table.sort();
      table.border(true);
      table.render();
    }
  })
