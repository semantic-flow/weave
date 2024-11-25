// src/cli.ts

import { Command } from "https://deno.land/x/cliffy@v0.25.7/mod.ts";
import { log, setLogLevelFromCLI } from "./core/utils/logging.ts";
import { CommandOptions, WeaveConfig, CopyStrategy } from "./types.ts";
import { Frame } from "./core/Frame.ts";
import { composeWeaveConfig } from "./cli/configHelper.ts";

const weave = new Command()
  .name("weave")
  .version("0.1.0")
  .description("A dynamic CLI tool for remixing static sites")

  .option(
    "--debug <level:string>",
    "Set log level (DEBUG, INFO, WARN, ERROR, CRITICAL)",
    {
      default: "INFO"
      // Removed 'choices' as it may not be supported or is causing type issues
    }
  )

  .option(
    "-c, --config <file:string>",
    "Path to config file",
    { default: "weave.config.json" }
  )

  .option(
    "-d, --dest <directory:string>",
    "Output directory"
  )

  .option(
    "-r, --repoDir <directory:string>",
    "Repository directory"
  )

  .option(
    "--copyStrategy <strategy:string>",
    "Copy strategy (no-overwrite, overwrite, skip, prompt)"
    // Removed 'choices' to eliminate type assignment issues
  )

  .option(
    "--clean",
    "Clean the destination directory"
    // Removed { type: "boolean" } as flags are inherently boolean
  )

  .action(async (options) => {
    // Safely cast the options to CommandOptions
    const commandOptions: CommandOptions = {
      debug: typeof options.debug === 'string' ? options.debug : "INFO", // Ensure debug is a string
      config: options.config,
      dest: options.dest,
      repoDir: options.repoDir,
      clean: options.clean ?? false, // Default to false if undefined
      copyStrategy: options.copyStrategy as CopyStrategy | undefined, // Will validate below
    };

    // Validate 'copyStrategy' if it's provided
    const validCopyStrategies: CopyStrategy[] = ["no-overwrite", "overwrite", "skip", "prompt"];
    if (commandOptions.copyStrategy && !validCopyStrategies.includes(commandOptions.copyStrategy)) {
      log.error(`Invalid copy strategy: ${commandOptions.copyStrategy}. Must be one of: ${validCopyStrategies.join(", ")}`);
      Deno.exit(1);
    }

    try {
      // Set log level based on the debug option
      setLogLevelFromCLI(commandOptions.debug || "INFO");

      // Compose the WeaveConfig by merging defaults, env, config file, and CLI options
      const weaveConfig: WeaveConfig = await composeWeaveConfig(commandOptions);

      // Initialize the Frame singleton with the composed configuration
      const frame = Frame.getInstance(weaveConfig);

      // Proceed with the rest of your CLI's main functionality using frame.config
      log.info("Configuration successfully loaded and Frame initialized.");
      // Example: log.debug("Detailed config:", frame.getConfig());

      // Placeholder for further actions like building the site
      // await buildSite(frame.getConfig());
    } catch (error) {
      if (error instanceof Error) {
        log.error(`Error occurred during initialization: ${error.message}`);
        log.debug(Deno.inspect(error, { colors: true }));
      } else {
        log.error("An unknown error occurred during initialization.");
      }
      Deno.exit(1);
    }
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