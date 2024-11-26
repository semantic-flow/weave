import { Command } from "../deps/cliffy.ts";
import { log } from "../core/utils/logging.ts";

export const reposListCommand = new Command()
  .name("list")
  .description("List repositories in the configuration, and their local status.")