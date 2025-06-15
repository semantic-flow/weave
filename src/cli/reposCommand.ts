import { Command } from "@/deps/cliffy.ts";
import { reposListCommand } from "@/cli/reposListCommand.ts";
import { reposCheckoutCommand } from "@/cli/reposCheckoutCommand.ts";
import { reposCommitCommand } from "@/cli/reposCommitCommand.ts";
import { reposPullCommand } from "@/cli/reposPullCommand.ts";
import { reposPushCommand } from "@/cli/reposPushCommand.ts";
import { reposSyncCommand } from "@/cli/reposSyncCommand.ts";
import { reposPrepareCommand } from "@/cli/reposPrepareCommand.ts";
import { reposVerifyCommand } from "@/cli/reposVerifyCommand.ts";

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
