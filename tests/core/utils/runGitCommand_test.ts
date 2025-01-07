// src/core/utils/runGitCommand_test.ts

import { assertEquals, assertRejects } from "../../../src/deps/assert.ts";
import { assertSpyCalls, spy } from "../../../src/deps/testing.ts";
import { runGitCommand } from "../../../src/core/utils/runGitCommand.ts";
import { GitError } from "../../../src/core/errors.ts";
import { setupLogCapture, restoreLogStubs } from "../../../src/testUtils.ts";

interface MockCommandOptions {
  code: number;
  output: string;
  validateOptions?: (cmd: string, opts: Deno.CommandOptions) => void;
}

function createMockCommand({ code, output, validateOptions }: MockCommandOptions): (cmd: string, opts: Deno.CommandOptions) => Deno.Command {
  return (cmd: string, opts: Deno.CommandOptions) => {
    validateOptions?.(cmd, opts);
    const encoder = new TextEncoder();
    return {
      output: async () => ({
        code,
        stdout: encoder.encode(output),
        stderr: new Uint8Array(),
      }),
    } as unknown as Deno.Command;
  };
}

const { capture, restore } = setupLogCapture();

Deno.test({
  name: "runGitCommand",
  async fn(t) {
    await t.step("executes git commands with correct options", async () => {
      const validateSpy = spy((cmd: string, opts: Deno.CommandOptions) => {
        assertEquals(cmd, "git");
        assertEquals(opts, {
          args: ["status"],
          cwd: "test-repo",
          stdout: "piped",
          stderr: "inherit",
        });
      });

      const mockCommand = createMockCommand({
        code: 0,
        output: "On branch main",
        validateOptions: validateSpy,
      });

      const output = await runGitCommand("test-repo", ["status"], mockCommand);
      assertEquals(output, "On branch main");
      assertSpyCalls(validateSpy, 1);
    });

    await t.step("handles successful git commands with multiple arguments", async () => {
      const validateSpy = spy((cmd: string, opts: Deno.CommandOptions) => {
        assertEquals(opts.args, ["commit", "-m", "test commit"]);
      });

      const mockCommand = createMockCommand({
        code: 0,
        output: "[main abc1234] test commit\n1 file changed",
        validateOptions: validateSpy,
      });

      const output = await runGitCommand(
        "test-repo",
        ["commit", "-m", "test commit"],
        mockCommand
      );
      assertEquals(output, "[main abc1234] test commit\n1 file changed");
      assertSpyCalls(validateSpy, 1);
    });

    await t.step("handles 'nothing to commit' special case", async () => {
      const validateSpy = spy((cmd: string, opts: Deno.CommandOptions) => {
        assertEquals(opts.args, ["commit", "-m", "empty commit"]);
      });

      const mockCommand = createMockCommand({
        code: 1,
        output: "nothing to commit, working tree clean",
        validateOptions: validateSpy,
      });

      const output = await runGitCommand(
        "test-repo",
        ["commit", "-m", "empty commit"],
        mockCommand
      );
      assertEquals(output, "nothing to commit, working tree clean");
      assertSpyCalls(validateSpy, 1);
    });

    await t.step("throws GitError for non-zero exit codes", async () => {
      const mockCommand = createMockCommand({
        code: 128,
        output: "fatal: not a git repository",
      });

      const error = await assertRejects(
        async () => await runGitCommand("invalid-repo", ["status"], mockCommand),
        GitError,
        "Git command failed with exit code 128"
      );

      assertEquals(error.command, "git status");
    });

    await t.step("throws GitError for authentication failures", async () => {
      const mockCommand = createMockCommand({
        code: 128,
        output: "fatal: Authentication failed for 'https://github.com/user/repo.git'",
      });

      const error = await assertRejects(
        async () => await runGitCommand("repo", ["push"], mockCommand),
        GitError,
        "Git command failed with exit code 128"
      );

      assertEquals(error.command, "git push");
    });

    await t.step("handles system errors", async () => {
      const mockCommand = () => {
        throw new Error("ENOENT: git executable not found");
      };

      const error = await assertRejects(
        async () => await runGitCommand("repo", ["status"], mockCommand),
        GitError,
        "ENOENT: git executable not found"
      );

      assertEquals(error.command, "git status");
    });

    await t.step("handles non-Error thrown objects", async () => {
      const mockCommand = () => {
        // deno-lint-ignore no-explicit-any
        throw "Unexpected error" as any;
      };

      const error = await assertRejects(
        async () => await runGitCommand("repo", ["status"], mockCommand),
        GitError,
        "Unknown error"
      );

      assertEquals(error.command, "git status");
    });
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

// Clean up log capture
Deno.test({
  name: "cleanup",
  fn: () => restore(),
  sanitizeResources: false,
  sanitizeOps: false,
});
