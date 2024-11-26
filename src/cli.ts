// src/cli.ts

import { Command } from "https://deno.land/x/cliffy@v0.25.7/mod.ts";
import { log } from "./core/utils/logging.ts";
import { CommandOptions, CopyStrategy } from "./types.ts";
import { handleConfigAction } from "./cli/configHelper.ts"; // Import the updated handler

const weave = new Command()
  .name("weave")
  .version("0.1.0")
  .description("A dynamic CLI tool for remixing static sites")

  .option(
    "--debug <level:string>",
    "Set log level (DEBUG, INFO, WARN, ERROR, CRITICAL)",
    { default: "INFO" }
  )

  .option("-c, --config <file:string>", "Path or URL for config file")

  .option("-d, --dest <directory:string>", "Output directory")

  .option("-r, --repoDir <directory:string>", "Repository directory")

  .option(
    "--copyStrategy <strategy:string>",
    "Copy strategy (no-overwrite, overwrite, skip, prompt)"
  )

  .option("--clean", "Clean the destination directory")

  .action(async (options) => {
    // Safely cast the options to CommandOptions
    const commandOptions: CommandOptions = {
      debug: typeof options.debug === "string" ? options.debug : "INFO", // Ensure debug is a string
      config: options.config,
      dest: options.dest,
      repoDir: options.repoDir,
      clean: options.clean ?? false, // Default to false if undefined
      copyStrategy: options.copyStrategy as CopyStrategy | undefined, // Will validate in handleConfigAction
    };

    // Delegate the handling to the external function
    await handleConfigAction(commandOptions);
  });

// Attach subcommands if any
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