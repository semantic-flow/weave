// src/core/utils/determineDefaultBranch_test.ts

import { assertEquals, assertRejects } from "../../deps/assert.ts";
import { determineDefaultBranch } from "./determineDefaultBranch.ts";
import { GitError } from "../errors.ts";

// Mock data
const MOCK_REPO_URL = "https://github.com/test/repo.git";

function createMockRunner(output: string | Error): () => Promise<string> {
  return async () => {
    if (output instanceof Error) {
      throw output;
    }
    return output;
  };
}

Deno.test("determineDefaultBranch correctly identifies 'main' branch", async () => {
  const mockRunner = createMockRunner("ref: refs/heads/main\tHEAD\n123abc\tHEAD");
  const branch = await determineDefaultBranch(MOCK_REPO_URL, mockRunner);
  assertEquals(branch, "main");
});

Deno.test("determineDefaultBranch correctly identifies custom branch names", async () => {
  const mockRunner = createMockRunner("ref: refs/heads/develop\tHEAD\n789ghi\tHEAD");
  const branch = await determineDefaultBranch(MOCK_REPO_URL, mockRunner);
  assertEquals(branch, "develop");
});

Deno.test("determineDefaultBranch handles empty git command output", async () => {
  const mockRunner = createMockRunner("");
  await assertRejects(
    () => determineDefaultBranch(MOCK_REPO_URL, mockRunner),
    GitError,
    "No output returned from ls-remote"
  );
});

Deno.test("determineDefaultBranch handles invalid output format", async () => {
  const mockRunner = createMockRunner("invalid-output-format");
  await assertRejects(
    () => determineDefaultBranch(MOCK_REPO_URL, mockRunner),
    GitError,
    "Failed to match the branch in ls-remote output"
  );
});

Deno.test("determineDefaultBranch handles git command failures", async () => {
  const mockRunner = createMockRunner(new GitError("Command failed", "ls-remote --symref"));
  await assertRejects(
    () => determineDefaultBranch(MOCK_REPO_URL, mockRunner),
    GitError,
    "Command failed"
  );
});

Deno.test("determineDefaultBranch handles general errors", async () => {
  const mockRunner = createMockRunner(new Error("Network error"));
  await assertRejects(
    () => determineDefaultBranch(MOCK_REPO_URL, mockRunner),
    GitError,
    "Unable to determine the default branch: Network error"
  );
});

Deno.test("determineDefaultBranch handles complex ref outputs", async () => {
  const complexOutput = `ref: refs/heads/feature/branch-name\tHEAD
123abc\tHEAD
ref: refs/heads/other-branch\trefs/remotes/origin/HEAD`;

  const mockRunner = createMockRunner(complexOutput);
  const branch = await determineDefaultBranch(MOCK_REPO_URL, mockRunner);
  assertEquals(branch, "feature/branch-name");
});

Deno.test("determineDefaultBranch trims whitespace from branch names", async () => {
  const mockRunner = createMockRunner("ref: refs/heads/main  \tHEAD\n123abc\tHEAD");
  const branch = await determineDefaultBranch(MOCK_REPO_URL, mockRunner);
  assertEquals(branch, "main");
});
