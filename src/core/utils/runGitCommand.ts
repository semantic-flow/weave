import { log } from "./logging.ts";
import { handleCaughtError } from "./handleCaughtError.ts";
import { GitError } from "../errors.ts";

/**
 * Executes a Git command within a specified repository path using Deno.Command.
 *
 * @param {string} async function runGitCommand(workingDir: string, args: string[]): Promise<string> {
 - The working directory for the Git command.
 * @param {string[]} args - The Git command arguments.
 * @returns {Promise<string>} - Returns the output if the command succeeds, rejects with an error otherwise.
 * @throws Will throw an error if the Git command fails.
 */

type CommandRunner = (command: string, options: Deno.CommandOptions) => Deno.Command;

export async function runGitCommand(
  workingDir: string,
  args: string[],
  createCommand: CommandRunner = (cmd, opts) => new Deno.Command(cmd, opts)
): Promise<string> {
  const gitCommand = `git ${args.join(' ')}`;
  log.debug(`Executing Git command: ${gitCommand} in ${workingDir}`);

  const command = createCommand("git", {
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
      throw new GitError(`Git command failed with exit code ${code}`, gitCommand);
    }

    log.debug(`Git command succeeded: ${gitCommand}`);
    return output;
  } catch (error) {
    if (error instanceof GitError) {
      handleCaughtError(error, "Error in runGitCommand");
      throw error;
    }
    // If it's not already a GitError, wrap it
    const gitError = new GitError(error instanceof Error ? error.message : "Unknown error", gitCommand);
    handleCaughtError(gitError, "Error in runGitCommand");
    throw gitError;
  }
}
