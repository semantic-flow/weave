import { Command } from "../deps/cliffy.ts";
import { log } from "../core/utils/logging.ts";
import { reposListCommand } from "./reposListCommand.ts";

export const reposCommand = new Command()
  .name("repos")
  .description("Repo-related subcommands")
  .action(() => { log.info("No subcommand provided."); })
  .command("list", reposListCommand);
