import { Command } from "../deps/cliffy.ts";
import { log } from "../core/utils/logging.ts";
import { reposListCommand } from "./reposListCommand.ts";
import { reposCheckoutCommand } from "./reposCheckoutCommand.ts";

export const reposCommand = new Command()
  .name("repos")
  .description("Repo-related subcommands")
  .action(() => { console.log("No subcommand provided."); })
  .command("list", reposListCommand)
  .command("checkout", reposCheckoutCommand)
