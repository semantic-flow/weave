import { Command } from "../deps/cliffy.ts";
import { handleMonitor } from "../../core/util/fileSync.ts";

export const monitorCommand = new Command()
  .description("Monitor and sync files to the output directory")
  .action(async (options, ...args) => {
    const config = options.parent!.opts(); // Access global options
    await handleMonitor(config);
  });