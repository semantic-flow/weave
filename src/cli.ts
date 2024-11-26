// src/cli.ts

import { Command } from "./deps/cliffy.ts";
import { log } from "./core/utils/logging.ts";
import { CommandOptions, CopyStrategy } from "./types.ts";
import { handleConfigAction } from "./cli/configHelper.ts";
import { reposCommand } from "./cli/reposCommand.ts";
import { watchCommand } from "./cli/watchCommand.ts";

const weave = new Command()
  .name("weave")
  .version("0.1.0")
  .description("A dynamic CLI tool for remixing static sites")

  .globalOption(
    "--debug <level:string>",
    "Set log level (DEBUG, INFO, WARN, ERROR, CRITICAL)",
    { default: "INFO" }
  )

  .globalOption("-c, --config <file:string>", "Path or URL for config file")

  .globalOption("-d, --dest <directory:string>", "Output directory")

  .globalOption("-r, --repoDir <directory:string>", "Repository directory")

  .globalOption(
    "--globalCopyStrategy <strategy:string>",
    "Copy strategy (no-overwrite, overwrite, skip, prompt)"
  )

  .globalOption("--globalClean", "Clean the destination directory before build")

  .globalAction(async (options: CommandOptions) => {
    // Safely cast the options to CommandOptions
    const commandOptions: CommandOptions = {
      debug: typeof options.debug === "string" ? options.debug : "INFO", // Ensure debug is a string
      config: options.config,
      dest: options.dest,
      repoDir: options.repoDir,
      globalClean: options.globalClean as boolean | undefined, // TODO: validate in handleConfigAction
      globalCopyStrategy: options.globalCopyStrategy as CopyStrategy | undefined, // Will validate in handleConfigAction
    };

    // Delegate the handling to the external function
    await handleConfigAction(commandOptions);
  })

  // Attach subcommands if any
  .command("repos", reposCommand)
  .command("watch", watchCommand)
//  .command("monitor", monitorSubcommand)



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