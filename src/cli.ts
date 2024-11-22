// src/cli.ts

import { Command } from "./deps/cliffy.ts";
import { log, setLogLevel } from "../src/core/utils/log.ts";
import type { LevelName } from "./deps/log.ts";
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
    // Set the log level based on CLI option
    const level = debug.toUpperCase() as LevelName;
    const validLevels: LevelName[] = ["DEBUG", "INFO", "WARN", "ERROR", "CRITICAL"];
    if (validLevels.includes(level)) {
      setLogLevel(level);
    } else {
      log.warn(`Invalid log level: ${debug}. Defaulting to INFO.`);
      setLogLevel("INFO");
    }
  }))
// Attach subcommands
/*.command("build", buildCommand)
  .command("list", listSubcommand)
  .command("monitor", monitorSubcommand)*/
try {
  await weave.parse(Deno.args);
} catch (error) {
  console.error(Deno.inspect(error, { colors: true }));
  Deno.exit(1);
}
