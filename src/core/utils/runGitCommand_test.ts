// src/core/utils/runGitCommand_test.ts

import {
  assertEquals,
  assertRejects,
} from "../../deps/assert.ts";
import { runGitCommand } from "./runGitCommand.ts";

// Mock Deno.Command implementation
class MockDenoCommand {
  constructor(
    private command: string,
    private options: Deno.CommandOptions,
  ) {}

  async output(): Promise<{
    code: number;
    stdout: Uint8Array;
    stderr: Uint8Array;
  }> {
    const encoder = new TextEncoder();

    if (this.command === "git" && this.options.args?.includes("status")) {
      if (this.options.cwd === "valid-repo") {
        return {
          code: 0,
          stdout: encoder.encode("On branch main\nnothing to commit"),
          stderr: new Uint8Array(),
        };
      } else if (this.options.cwd === "nothing-to-commit") {
        return {
          code: 1,
          stdout: encoder.encode("nothing to commit, working tree clean"),
          stderr: new Uint8Array(),
        };
      } else if (this.options.cwd === "error-repo") {
        return {
          code: 128,
          stdout: new Uint8Array(),
          stderr: encoder.encode("fatal: not a git repository"),
        };
      }
    }

    throw new Error("Command not found");
  }
}

Deno.test({
  name: "runGitCommand - successful execution",
  fn: async () => {
    const originalCommand = Deno.Command;
    // deno-lint-ignore no-explicit-any
    (Deno as any).Command = MockDenoCommand;

    try {
      const output = await runGitCommand("valid-repo", ["status"]);
      assertEquals(output, "On branch main\nnothing to commit");
    } finally {
      Deno.Command = originalCommand;
    }
  },
});

Deno.test({
  name: "runGitCommand - handles 'nothing to commit' special case",
  fn: async () => {
    const originalCommand = Deno.Command;
    // deno-lint-ignore no-explicit-any
    (Deno as any).Command = MockDenoCommand;

    try {
      const output = await runGitCommand("nothing-to-commit", ["status"]);
      assertEquals(output, "nothing to commit, working tree clean");
    } finally {
      Deno.Command = originalCommand;
    }
  },
});

Deno.test({
  name: "runGitCommand - throws on command failure",
  fn: async () => {
    const originalCommand = Deno.Command;
    // deno-lint-ignore no-explicit-any
    (Deno as any).Command = MockDenoCommand;

    try {
      await assertRejects(
        async () => {
          await runGitCommand("error-repo", ["status"]);
        },
        Error,
        "Git command failed with exit code 128"
      );
    } finally {
      Deno.Command = originalCommand;
    }
  },
});
