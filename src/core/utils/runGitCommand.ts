// src/core/utils/runGitCommand.ts

import { log } from "./logging.ts";
import { handleCaughtError } from "./handleCaughtError.ts";

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
  log.debug(`Executing Git command: ${gitCommand} in ${workingDir}`);

  const command = new Deno.Command("git", {
    args: args,
    cwd: workingDir, // Change to reflect the working directory context
    stdout: "piped", // Use "piped" to capture the output
    stderr: "inherit",
  });

  try {
    const { code, stdout } = await command.output();
    const output = new TextDecoder().decode(stdout);
    if (code !== 0) {
      if (code === 1 && output.includes("nothing to commit")) {
        log.info(`Git command returned code 1 but output indicates nothing to commit: ${gitCommand}`);
        return output;
      }
      throw new Error(`Git command failed with exit code ${code}: ${gitCommand}`);
    }

    log.debug(`Git command succeeded: ${gitCommand}`);
    return output;
  } catch (error) {
    handleCaughtError(error, `Error in runGitCommand: ${gitCommand}`);
    throw error; // Re-throw the error to allow handling by caller
  }
}

export { runGitCommand };