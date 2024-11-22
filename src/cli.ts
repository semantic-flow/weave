// src/cli.ts

import { Command } from "jsr:@cliffy/command@^1.0.0-rc.7";
import { listCommand } from "./cli/listCommand.ts";
import { buildCommand } from "./cli/buildCommand.ts";
import { monitorCommand } from "./cli/monitorCommand.ts";
import { repoInitCommand } from "./cli/repo/init.ts";
import { setLogLevel, LogLevel } from "./core/utils/logger.ts";

// Define 'list' subcommand
const listSubcommand = new Command()
  .name("list")
  .description("List all inclusion sources")
  .action((options: { config: string }) => listCommand(options));

// Define 'build' subcommand
const buildSubcommand = new Command()
  .name("build")
  .description("Build the static site from the woven directory")
  .action((options: { out: string }) => buildCommand(options));

// Define 'monitor' subcommand
const monitorSubcommand = new Command()
  .name("monitor")
  .description("Monitor and sync files to the output directory")
  .action((options: { config: string; out: string; repoDir: string }) => monitorCommand(options));



// Define the top-level 'weave' command with subcommands
await new Command()
  .name("weave")
  .version("1.0.0")
  .description("A dynamic CLI tool for remixing static sites")
  .globalOption("-c, --config <file:string>", "Path to config file", { default: "weave.config.ts" })
  .option("-o, --out <directory:string>", "Output directory", { default: "_woven" })
  .option("-r, --repoDir <directory:string>", "Repository directory", { default: "repos" })
  .option("--log-level <level:string>", "Set log level (INFO, WARN, ERROR)", { default: "INFO" })
  .action((options) => {
    // Set the log level based on CLI option
    const level = options.logLevel.toUpperCase() as LogLevel;
    if (Object.values(LogLevel).includes(level)) {
      setLogLevel(level);
    } else {
      console.warn(`Invalid log level: ${options.logLevel}. Defaulting to INFO.`);
      setLogLevel(LogLevel.INFO);
    }
  })
  // Attach subcommands
  .command("list", listSubcommand)
  .command("build", buildSubcommand)
  .command("monitor", monitorSubcommand)
  .parse(Deno.args);
