import { Command } from "./deps/cliffy.ts";
import { getConfigFile } from "./core/utils/weave_config.ts";
import { monitorCommand } from "./cli/monitor.ts";

const command = new Command()
  .name("weave")
  .version("0.1.0")
  .description("A dynamic tool for remixing static sites.")
  .option("-c, --config <file>", "Path to config file", { default: "weave.config.ts" })
  .option("-o, --out <directory>", "Output directory", { default: "_woven" })
  .option("-r, --repoDir <directory>", "Repository directory", { default: "repos" })
  .command("monitor", monitorCommand)
  // Add other commands here
  .parse(Deno.args);


await command.parse(Deno.args);
