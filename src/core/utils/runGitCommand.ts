// src/core/utils/runGitCommand.ts

import { log } from "./log.ts";

/**
 * Executes a Git command within a specified repository path using Deno.Command.
 *
 * @param {string} repoPath - The working directory for the Git command.
 * @param {string[]} args - The Git command arguments.
 * @returns {Promise<void>} - Resolves if the command succeeds, rejects with an error otherwise.
 * @throws Will throw an error if the Git command fails.
 */
export async function runGitCommand(repoPath: string, args: string[]): Promise<void> {
  const gitCommand = `git ${args.join(' ')}`;
  log.info(`Executing Git command: ${gitCommand} in ${repoPath}`);

  const command = new Deno.Command("git", {
    args: args,
    cwd: repoPath,
    stdout: "inherit",
    stderr: "inherit",
  });

  try {
    const { code } = await command.output();

    if (code !== 0) {
      log.error(`Git command failed with exit code ${code}: ${gitCommand}`);
      throw new Error(`Git command failed: git ${args.join(' ')}`);
    }

    log.info(`Git command succeeded: ${gitCommand}`);
  } catch (error) {
    if (error instanceof Error) {
      log.error(`Error in runGitCommand: ${error.message}`);
      log.debug(Deno.inspect(error, { colors: true }));
    } else {
      log.error("An unknown error occurred.");
    }
  }
}
