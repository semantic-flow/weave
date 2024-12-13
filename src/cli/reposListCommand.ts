import { Command } from "../deps/cliffy.ts";
import { log } from "../core/utils/logging.ts";
import { reposList } from "../core/reposList.ts";
import { Table } from "../deps/cliffy.ts";

export const reposListCommand = new Command()
  .name("list")
  .description("List repositories in the configuration, and their local status.")
  .option("--format <format:string>", "Output format: json, yaml, table", { default: "table" })
  .action(async () => {
    log.info("repos list action invoked");
    const results = await reposList();

    // Convert array of objects to array of arrays
    const tableData = results.map(item => [
      item.order.toString(),
      item.name || "N/A",
      item.active ? "Yes" : "No",
      item.present ? "Yes" : "No",
      item.syncStatus,
      item.copyStrategy
    ]);

    // Create a Table instance using the transformed data
    const table = new Table()
      .header(["Order", "Name", "Active", "Present", "Sync Status", "Copy Strategy"])
      .body(tableData);
    table.sort;
    table.border(true);
    table.render();
  })
