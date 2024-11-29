// src/core/utils/runGitCommand.ts

import { log } from "./logging.ts";

/**
 * Executes a Git command within a specified repository path using Deno.Command.
 *
 * @param {string} async function runGitCommand(workingDir: string, args: string[]): Promise<string> {
 - The working directory for the Git command.
 * @param {string[]} args - The Git command arguments.
 * @returns {Promise<string>} - Returns the output if the command succeeds, rejects with an error otherwise.
 * @throws Will throw an error if the Git command fails.
 */

async function runGitCommand(workingDir: string, args: string[]): Promise<string> {
  const gitCommand = `git ${args.join(' ')}`;
  log.info(`Executing Git command: ${gitCommand} in ${workingDir}`);

  const command = new Deno.Command("git", {
    args: args,
    cwd: workingDir, // Change to reflect the working directory context
    stdout: "piped", // Use "piped" to capture the output
    stderr: "inherit",
  });

  try {
    const { code, stdout } = await command.output();

    if (code !== 0) {
      throw new Error(`Git command failed with exit code ${code}: ${gitCommand}`);
    }

    const output = new TextDecoder().decode(stdout);
    log.info(`Git command succeeded: ${gitCommand}`);
    return output;
  } catch (error) {
    if (error instanceof Error) {
      log.error(`Error in runGitCommand: ${error.message}`);
      log.debug(Deno.inspect(error, { colors: true }));
    } else {
      log.error("An unknown error occurred.");
    }
    throw error; // Re-throw the error to allow handling by caller
  }
}

export { runGitCommand };