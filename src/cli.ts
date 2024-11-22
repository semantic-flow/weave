// src/cli.ts

import { Command } from "jsr:@cliffy/command@^1.0.0-rc.7";
import { setLogLevel, LogLevel } from "./utils/logger.ts";

// Define the top-level 'weave' command with subcommands
const { options } = await new Command()
  .name("weave")
  .version("0.1.0")
  .description("A dynamic CLI tool for remixing static sites")
  .globalOption("-c, --config <file:string>", "Path to config file", { default: "weave.config.ts" })
  .globalOption("-d, --dest <directory:string>", "Output directory", { default: "_woven" })
  .globalOption("-r, --repoDir <directory:string>", "Repository directory", { default: "_source_repos" })
  .option("--debug [level:string]", "Set log level (INFO, WARN, ERROR)", { default: "INFO" })
  //deno-lint-ignore no-explicit-any
  .action((options: any) => {
    // Set the log level based on CLI option
    const level = options.debug.toUpperCase() as LogLevel;
    if (Object.values(LogLevel).includes(level)) {
      setLogLevel(level);
    } else {
      console.warn(`Invalid log level: ${options.logLevel}. Defaulting to INFO.`);
      setLogLevel(LogLevel.INFO);
    }
  })
  // Attach subcommands
  /*  .command("list", listSubcommand)
    .command("build", buildSubcommand)
    .command("monitor", monitorSubcommand)*/
  .parse(Deno.args);

if (options.debug) console.log(options)
