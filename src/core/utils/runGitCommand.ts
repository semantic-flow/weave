// src/core/utils/runGitCommand.ts

import { log } from "./logging.ts";
import { handleCaughtError } from "./handleCaughtError.ts";
import { RepoGitResult } from "../../types.ts";

/**
 * Executes a Git command within a specified repository path using Deno.Command.
 *
 * @param {string} async function runGitCommand(workingDir: string, args: string[]): Promise<string> {
 - The working directory for the Git command.
 * @param {string[]} args - The Git command arguments.
 * @returns {Promise<string>} - Returns the output if the command succeeds, rejects with an error otherwise.
 * @throws Will throw an error if the Git command fails.
 */

export async function runGitCommand(workingDir: string, args: string[]): Promise<string> {
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



/**
 * Executes a Git command and returns a RepoGitResult.
 *
 * @param {string} localPath - The local path of the repository.
 * @param {string[]} args - The arguments for the Git command.
 * @param {string} [url] - The optional URL of the repository.
 * @returns {Promise<RepoGitResult>} - The result of the Git command.
 */
export async function runGitCommandForResults(localPath: string, args: string[], url?: string): Promise<RepoGitResult> {
  const gitCommand = `git ${args.join(' ')}`;
  log.info(`Executing Git command: ${gitCommand} in ${localPath}`);

  const command = new Deno.Command("git", {
    args: args,
    cwd: localPath,
    stdout: "piped",
    stderr: "piped",
  });

  try {
    const { code, stdout, stderr } = await command.output();
    const output = new TextDecoder().decode(stdout);
    const errorOutput = new TextDecoder().decode(stderr);

    if (code !== 0) {
      return {
        url,
        localPath,
        success: false,
        message: errorOutput,
        error: new Error(`Git command failed with exit code ${code}: ${gitCommand}`),
      };
    }

    return {
      url,
      localPath,
      success: true,
      message: output,
    };
  } catch (error) {
    return {
      url,
      localPath,
      success: false,
      message: (error as Error).message,
      error: error as Error,
    };
  }
}