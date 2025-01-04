// src/core/utils/determineDefaultBranch_test.ts

import {
  assertEquals,
  assertRejects,
} from "../../deps/assert.ts";
import { determineDefaultBranch } from "./determineDefaultBranch.ts";
import { GitError } from "../errors.ts";

// Mock data
const MOCK_REPO_URL = "https://github.com/test/repo.git";

Deno.test("determineDefaultBranch correctly identifies 'main' branch", async () => {
  const mockGitRunner = async () => "ref: refs/heads/main\tHEAD\n123abc\tHEAD";
  const branch = await determineDefaultBranch(MOCK_REPO_URL, mockGitRunner);
  assertEquals(branch, "main");
});

Deno.test("determineDefaultBranch correctly identifies custom branch names", async () => {
  const mockGitRunner = async () => "ref: refs/heads/develop\tHEAD\n789ghi\tHEAD";
  const branch = await determineDefaultBranch(MOCK_REPO_URL, mockGitRunner);
  assertEquals(branch, "develop");
});

Deno.test("determineDefaultBranch handles empty git command output", async () => {
  const mockGitRunner = async () => "";
  await assertRejects(
    async () => {
      await determineDefaultBranch(MOCK_REPO_URL, mockGitRunner);
    },
    GitError,
    "No output returned from ls-remote"
  );
});

Deno.test("determineDefaultBranch handles invalid output format", async () => {
  const mockGitRunner = async () => "invalid-output-format";
  await assertRejects(
    async () => {
      await determineDefaultBranch(MOCK_REPO_URL, mockGitRunner);
    },
    GitError,
    "Failed to match the branch in ls-remote output"
  );
});

Deno.test("determineDefaultBranch handles git command failures", async () => {
  const mockGitRunner = async () => {
    throw new GitError("Command failed", "ls-remote --symref");
  };
  await assertRejects(
    async () => {
      await determineDefaultBranch(MOCK_REPO_URL, mockGitRunner);
    },
    GitError,
    "Command failed"
  );
});

Deno.test("determineDefaultBranch handles general errors", async () => {
  const mockGitRunner = async () => {
    throw new Error("Network error");
  };
  await assertRejects(
    async () => {
      await determineDefaultBranch(MOCK_REPO_URL, mockGitRunner);
    },
    GitError,
    "Unable to determine the default branch: Network error"
  );
});

Deno.test("determineDefaultBranch handles complex ref outputs", async () => {
  const complexOutput = `ref: refs/heads/feature/branch-name\tHEAD
123abc\tHEAD
ref: refs/heads/other-branch\trefs/remotes/origin/HEAD`;

  const mockGitRunner = async () => complexOutput;
  const branch = await determineDefaultBranch(MOCK_REPO_URL, mockGitRunner);
  assertEquals(branch, "feature/branch-name");
});

Deno.test("determineDefaultBranch trims whitespace from branch names", async () => {
  const mockGitRunner = async () => "ref: refs/heads/main  \tHEAD\n123abc\tHEAD";
  const branch = await determineDefaultBranch(MOCK_REPO_URL, mockGitRunner);
  assertEquals(branch, "main");
});
