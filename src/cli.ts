// src/cli.ts

import { Command } from "./deps/cliffy.ts";
import { log } from "./core/utils/logging.ts";
import { InputGlobalOptions, CopyStrategy } from "./types.ts";
import { handleConfigAction } from "./core/utils/configHelpers.ts";
import { reposCommand } from "./cli/reposCommand.ts";
import { watchCommand } from "./cli/watchCommand.ts";
import { LogLevels } from "./deps/log.ts";
import type { LevelName } from "./deps/log.ts";


const weave = new Command()
  .name("weave")
  .version("0.1.0")
  .description("A dynamic CLI tool for remixing static sites")

  .globalOption(
    "--debug <level:string>",
    "Set log level (DEBUG, INFO, WARN, ERROR, CRITICAL)",
    { default: "WARN" }
  )

  .globalOption("-c, --config <file:string>", "Path or URL for config file")

  .globalOption("-d, --dest <directory:string>", "Output directory")

  .globalOption("-r, --workspaceDir <directory:string>", "Repository directory")

  .globalOption(
    "--globalCopyStrategy <strategy:string>",
    "Copy strategy (no-overwrite, overwrite, skip, prompt)"
  )

  .globalOption("--globalClean", "Clean the destination directory before build")

  .globalOption("--watchConfig", "Watch for changes in config files")

  .globalAction(async (options: InputGlobalOptions) => {
    // Safely cast the options to InputGlobalOptions
    const inputOptions: InputGlobalOptions = {
      debug: typeof options.debug === "string" && options.debug.toUpperCase() in LogLevels
        ? options.debug.toUpperCase() as LevelName
        : "DEBUG" as LevelName, // Ensure debug is a valid LogLevel
      configFilePath: options.configFilePath,
      dest: options.dest,
      workspaceDir: options.workspaceDir,
      globalCopyStrategy: options.globalCopyStrategy as CopyStrategy | undefined, // Will validate in handleConfigAction
      globalClean: options.globalClean as boolean | undefined, // TODO: validate in handleConfigAction
      watchConfig: options.watchConfig as boolean | undefined, // TODO: validate in handleConfigAction
    };

    // Delegate the handling to the external function
    await handleConfigAction(inputOptions);
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