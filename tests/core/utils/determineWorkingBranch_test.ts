// src/core/utils/determineWorkingBranch_test.ts

import { assertEquals, assertRejects } from "../../../src/deps/assert.ts";
import { determineWorkingBranch } from "../../../src/core/utils/determineWorkingBranch.ts";
import { GitError } from "../../../src/core/errors.ts";
import { runGitCommand } from "../../../src/core/utils/runGitCommand.ts";

// Mock data
const MOCK_WORKING_DIR = "/test/repo";

type GitRunner = typeof runGitCommand;

function createMockRunner(output: string | Error): GitRunner {
  return async (_workingDir: string, _args: string[]) => {
    if (output instanceof Error) {
      throw output;
    }
    return output;
  };
}

Deno.test("determineWorkingBranch correctly identifies 'main' branch", async () => {
  const mockRunner = createMockRunner("main");
  const branch = await determineWorkingBranch(MOCK_WORKING_DIR, mockRunner);
  assertEquals(branch, "main");
});

Deno.test("determineWorkingBranch correctly identifies 'master' branch", async () => {
  const mockRunner = createMockRunner("master");
  const branch = await determineWorkingBranch(MOCK_WORKING_DIR, mockRunner);
  assertEquals(branch, "master");
});

Deno.test("determineWorkingBranch correctly identifies feature branches", async () => {
  const mockRunner = createMockRunner("feature/new-feature");
  const branch = await determineWorkingBranch(MOCK_WORKING_DIR, mockRunner);
  assertEquals(branch, "feature/new-feature");
});

Deno.test("determineWorkingBranch trims whitespace from branch names", async () => {
  const mockRunner = createMockRunner("main  \n");
  const branch = await determineWorkingBranch(MOCK_WORKING_DIR, mockRunner);
  assertEquals(branch, "main");
});

Deno.test("determineWorkingBranch handles empty git command output", async () => {
  const mockRunner = createMockRunner("");
  await assertRejects(
    () => determineWorkingBranch(MOCK_WORKING_DIR, mockRunner),
    GitError,
    "No branch name returned"
  );
});

Deno.test("determineWorkingBranch handles git command failures", async () => {
  const mockRunner = createMockRunner(
    new GitError("Git command failed with exit code 1", "git rev-parse --abbrev-ref HEAD")
  );
  await assertRejects(
    () => determineWorkingBranch(MOCK_WORKING_DIR, mockRunner),
    GitError,
    "Git command failed with exit code 1"
  );
});

Deno.test("determineWorkingBranch handles general errors", async () => {
  const mockRunner = createMockRunner(new Error("Unexpected error"));
  await assertRejects(
    () => determineWorkingBranch(MOCK_WORKING_DIR, mockRunner),
    GitError,
    "Unable to determine working branch: Unexpected error"
  );
});

Deno.test("determineWorkingBranch handles detached HEAD state", async () => {
  const mockRunner = createMockRunner("HEAD");
  const branch = await determineWorkingBranch(MOCK_WORKING_DIR, mockRunner);
  assertEquals(branch, "HEAD");
});
