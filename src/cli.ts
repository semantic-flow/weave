// src/cli.ts

import { Command } from "./deps/cliffy.ts";
import { log, setLogLevelFromCLI } from "../src/core/utils/log.ts";
import type { CommandOptions } from "./types.ts";

// Define the top-level 'weave' command with subcommands
const weave = new Command()
  .name("weave")
  .version("0.1.0")
  .description("A dynamic CLI tool for remixing static sites")
  .globalOption("--debug [level:string]", "Set log level (DEBUG, INFO, WARN, ERROR, CRITICAL)", { default: "INFO" })
  .globalOption("-c, --config <file:string>", "Path to config file", { default: "weave.config.ts" })
  .globalOption("-d, --dest <directory:string>", "Output directory", { default: "_woven" })
  .globalOption("-r, --repoDir <directory:string>", "Repository directory", { default: "_source_repos" })
  .action((async ({ debug }: CommandOptions) => {
    const debugLevel = debug ?? "INFO"; // Default to "INFO" if undefined
    setLogLevelFromCLI(debugLevel);
  }))
// Attach subcommands
/*.command("build", buildCommand)
  .command("list", listSubcommand)
  .command("monitor", monitorSubcommand)*/

try {
  await weave.parse(Deno.args);
} catch (error) {
  if (error instanceof Error) {
    log.error(`Error occurred while parsing the command: ${error.message}`);
    log.debug(Deno.inspect(error, { colors: true }));
  } else {
    log.error("An unknown error occurred.");
  }
  Deno.exit(1);
}
