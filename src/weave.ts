// src/cli.ts

import { Command } from "./deps/cliffy.ts";
import { InputGlobalOptions, CopyStrategy } from "./types.ts";
import { handleConfigAction } from "./core/utils/configHelpers.ts";
import { reposCommand } from "./cli/reposCommand.ts";
import { watchCommand } from "./cli/watchCommand.ts";
import { LogLevels } from "./deps/log.ts";
import { handleCaughtError } from "./core/utils/handleCaughtError.ts";
import type { LevelName } from "./deps/log.ts";


const weave = new Command()
  .name("weave")
  .version("0.1.0")
  .description("A dynamic CLI tool for remixing static sites")

  .globalOption("-c, --config <file:string>", "Path or URL for config file")

  .globalOption(
    "--debug <level:string>",
    "Set log level (DEBUG, INFO, WARN, ERROR, CRITICAL)",
    { default: "WARN" }
  )

  .globalOption("-d, --dest <directory:string>", "Output directory")

  .globalOption("--dryRun", "Don't copy any files or perform any mutating git actions, just log those operations")

  .globalOption("--globalClean", "Clean the destination directory before build")

  .globalOption(
    "--globalCopyStrategy <strategy:string>",
    "Copy strategy (no-overwrite, overwrite, skip, prompt)"
  )

  .globalOption("--watchConfig", "Watch for changes in config files")

  .globalOption("-r, --workspaceDir <directory:string>", "Repository directory")

  .globalAction(async (options: InputGlobalOptions) => {
    // Safely cast the options to InputGlobalOptions
    const inputOptions: InputGlobalOptions = {
      configFilePath: options.configFilePath as string | undefined,
      debug: typeof options.debug === "string" && options.debug.toUpperCase() in LogLevels
        ? options.debug.toUpperCase() as LevelName
        : "DEBUG" as LevelName, // Ensure debug is a valid LogLevel
      dest: options.dest as string | undefined,
      dryRun: options.dryRun as boolean | undefined,
      globalClean: options.globalClean as boolean | undefined, // TODO: validate in handleConfigAction
      globalCopyStrategy: options.globalCopyStrategy as CopyStrategy | undefined,
      watchConfig: options.watchConfig as boolean | undefined, // TODO: validate in handleConfigAction
      workspaceDir: options.workspaceDir as string | undefined,
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
  handleCaughtError(error, "Error occurred while parsing the command:");
  Deno.exit(1);
}