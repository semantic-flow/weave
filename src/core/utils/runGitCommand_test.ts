// src/core/utils/runGitCommand_test.ts

import {
  assertEquals,
  assertRejects,
} from "../../deps/assert.ts";
import { runGitCommand } from "./runGitCommand.ts";

// Helper function to create mock command outputs
function createMockCommand(code: number, output: string): Deno.Command {
  const encoder = new TextEncoder();
  return {
    output: async () => ({
      code,
      stdout: encoder.encode(output),
      stderr: new Uint8Array(),
    }),
  } as unknown as Deno.Command;
}

Deno.test("runGitCommand - successful execution", async () => {
  const mockCommand = (_cmd: string, _opts: Deno.CommandOptions) => 
    createMockCommand(0, "On branch main\nnothing to commit");
  
  const output = await runGitCommand("valid-repo", ["status"], mockCommand);
  assertEquals(output, "On branch main\nnothing to commit");
});

Deno.test("runGitCommand - handles 'nothing to commit' special case", async () => {
  const mockCommand = (_cmd: string, _opts: Deno.CommandOptions) => 
    createMockCommand(1, "nothing to commit, working tree clean");
  
  const output = await runGitCommand("nothing-to-commit", ["status"], mockCommand);
  assertEquals(output, "nothing to commit, working tree clean");
});

Deno.test("runGitCommand - throws on command failure", async () => {
  const mockCommand = (_cmd: string, _opts: Deno.CommandOptions) => 
    createMockCommand(128, "fatal: not a git repository");
  
  await assertRejects(
    async () => {
      await runGitCommand("error-repo", ["status"], mockCommand);
    },
    Error,
    "Git command failed with exit code 128"
  );
});
