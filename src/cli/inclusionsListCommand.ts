import { Command } from "../deps/cliffy.ts";
import { log } from "../core/utils/logging.ts";
import { inclusionsList } from "../core/inclusionsList.ts";
import { Table } from "../deps/cliffy.ts";
import {
  red,
  yellow,
  green
} from "../deps/colors.ts";

export const inclusionsListCommand = new Command()
  .name("list")
  .description("List all inclusions in the configuration, and their status.")
  .option("--format <format:string>", "Output format: json, table", { default: "table" })
  .action(async ({ format }: { format: string }) => {
    log.debug("inclusions list action invoked");
    const results = await inclusionsList();

    if (format === "json") {
      console.log(JSON.stringify(results, null, 2));
    } else {
      // Output as a table
      const NAME_MAX_LENGTH = 20;

      const tableData = results.map(item => [
        item.order.toString(),
        item.name.length > NAME_MAX_LENGTH
          ? item.name.substring(0, NAME_MAX_LENGTH) + "…"
          : item.name || "N/A",
        item.type || "N/A", // Add type column to distinguish between git, web, local
        item.present ? "Yes" : red("No"),
        item.syncStatus != "current" ? yellow(item.syncStatus) : green(item.syncStatus),
        item.copyStrategy,
        item.excludeByDefault ? "Exclude" : "Include",
        item.include.length > 0 ? item.include.join(", ") : "-",
        item.exclude.length > 0 ? item.exclude.join(", ") : "-",
      ]);

      // Create a Table instance using the transformed data
      const table = new Table()
        .header(["Order", "Name", "Type", "Present", "Status", "Copy Strategy", "Default", "Include", "Exclude"])
        .body(tableData);
      table.sort();
      table.border(true);
      table.render();
    }
  });
