import { Command } from "../deps/cliffy.ts";
import { inclusionsListCommand } from "./inclusionsListCommand.ts";
import { inclusionsVerifyCommand } from "./inclusionsVerifyCommand.ts";

export const inclusionsCommand = new Command()
  .name("inclusions")
  .description("Inclusion-related subcommands")
  .action(() => { console.log("No subcommand provided. Use 'weave inclusions --help' for available commands."); })
  .command("list", inclusionsListCommand)
  .command("verify", inclusionsVerifyCommand);
