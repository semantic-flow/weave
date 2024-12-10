// src/cli.ts

import { Command } from "./deps/cliffy.ts";
import { log } from "./core/utils/logging.ts";
import { InputGlobalOptions, CopyStrategy } from "./types.ts";
import { handleConfigAction } from "./core/utils//configHelpers.ts";
import { reposCommand } from "./cli/reposCommand.ts";
import { watchCommand } from "./cli/watchCommand.ts";

const weave = new Command()
  .name("weave")
  .version("0.1.0")
  .description("A dynamic CLI tool for remixing static sites")

  .globalOption(
    "--debug <level:string>",
    "Set log level (DEBUG, INFO, WARN, ERROR, CRITICAL)",
    { default: "ERROR" }
  )

  .globalOption("-c, --config <file:string>", "Path or URL for config file")

  .globalOption("-d, --dest <directory:string>", "Output directory")

  .globalOption("-r, --workspaceDir <directory:string>", "Repository directory")

  .globalOption(
    "--globalCopyStrategy <strategy:string>",
    "Copy strategy (no-overwrite, overwrite, skip, prompt)"
  )

  .globalOption("--globalClean", "Clean the destination directory before build")

  .globalAction(async (options: InputGlobalOptions) => {
    // Safely cast the options to InputGlobalOptions
    const InputGlobalOptions: InputGlobalOptions = {
      workspaceDir: options.workspaceDir,
      dest: options.dest,
      globalCopyStrategy: options.globalCopyStrategy as CopyStrategy | undefined, // Will validate in handleConfigAction
      globalClean: options.globalClean as boolean | undefined, // TODO: validate in handleConfigAction
      watchConfig: options.watchConfig as boolean | undefined, // TODO: validate in handleConfigAction
      configFilePath: options.configFilePath,
      debug: typeof options.debug === "string" ? options.debug : "ERROR", // Ensure debug is a string
    };

    // Delegate the handling to the external function
    await handleConfigAction(InputGlobalOptions);
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