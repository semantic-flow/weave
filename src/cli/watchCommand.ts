import { Command } from "../deps/cliffy.ts";
import { log } from "../core/utils/logging.ts";
import { Frame } from "../core/Frame.ts";
import { watchConfigFile } from "../core/utils/config_utils.ts";

export const watchCommand = new Command()
  .name("watch")
  .description("Watch the inclusions (and optionally the configuration file) for changes")
  .action(async () => {
    const frame = Frame.getInstance();
    // Start watching the configuration file if the path is available
    if (frame.config.global?.configFilePath && frame.config.global.watchConfig) {
      // Start watching in a separate, non-blocking async task
      try {
        watchConfigFile(frame.config.global.configFilePath);
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
  });





