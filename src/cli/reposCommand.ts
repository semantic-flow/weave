import { Command } from "../deps/cliffy.ts";
import { reposListCommand } from "./reposListCommand.ts";
import { reposCheckoutCommand } from "./reposCheckoutCommand.ts";
import { reposCommitCommand } from "./reposCommitCommand.ts";
import { reposPullCommand } from "./reposPullCommand.ts";
import { reposPushCommand } from "./reposPushCommand.ts";
import { reposSyncCommand } from "./reposSyncCommand.ts";
import { reposPrepareCommand } from "./reposPrepareCommand.ts";
import { reposVerifyCommand } from "./reposVerifyCommand.ts";

export const reposCommand = new Command()
  .name("repos")
  .description("Repo-related subcommands")
  .action(() => { console.log("No subcommand provided."); })
  .command("list", reposListCommand)
  .command("checkout", reposCheckoutCommand)
  .command("commit", reposCommitCommand)
  .command("pull", reposPullCommand)
  .command("push", reposPushCommand)
  .command("sync", reposSyncCommand)
  .command("prepare", reposPrepareCommand)
  .command("verify", reposVerifyCommand)
