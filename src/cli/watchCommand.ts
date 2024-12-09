import { Command } from "../deps/cliffy.ts";
import { log } from "../core/utils/logging.ts";
import { Frame } from "../core/Frame.ts";
import { watchConfigFile } from "../core/utils/configUtils.ts";
import { InputGlobalOptions } from "../types.ts";


/**
 * The watch command.
 *
 * This command watches the inclusions (and optionally the configuration file) for changes.
 * If the configuration file is changed, it reloads the configuration.
 * If a file within an inclusion is changed, it tries to copy the file to the desination
 *
 */

export const watchCommand = new Command()
  .name("watch")
  .description("Watch the inclusions (and optionally the configuration file) for changes")
  .action(async () => {
    const frame = Frame.getInstance();

    // Retrieve commandOptions from Frame or from the action's options
    // Depending on your implementation, you might need to extract them differently
    const commandOptions: InputGlobalOptions | undefined = frame.commandOptions;

    // Start watching the configuration file if the path is available and option set
    if (frame.config.global?.configFilePath && frame.config.global.watchConfig) {
      // Start watching in a separate, non-blocking async task
      try {
        watchConfigFile(frame.config.global.configFilePath, commandOptions);
      } catch (error) {
        if (error instanceof Error) {
          log.error(`Failed to watch config file: ${(error as Error).message}`);
          log.debug(Deno.inspect(error, { colors: true }));
        } else {
          log.error("An unknown error occurred.");
        }
        Deno.exit(1);
      };
      log.info("Watching the configuration file for changes...");
    }

    // Start watching the inclusions

  });





