import { Command } from "../deps/cliffy.ts";
import { log } from "../core/utils/logging.ts";
import { checkoutRepos } from "../core/checkoutRepos.ts";
import { Frame } from "../core/Frame.ts";

export const reposCheckoutCommand = new Command()
  .name("checkout")
  .description("for missing repos, checkout (when no inclusions or exclusions specified and excludeByDefault is false) or sparse checkout otherwise.")
  .action(() => {
    log.info("repos checkout action invoked");
    checkoutRepos(Frame.getInstance().config);
  })
