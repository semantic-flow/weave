// src/core/utils/gitInclusionUtils_test.ts

import { assertEquals } from "../../../src/deps/assert.ts";
import { isGitInclusion, getSyncStatus, checkGitInclusion } from "../../../src/core/utils/gitInclusionUtils.ts";
import { GitInclusion, WebInclusion } from "../../../src/types.ts";
import { GitError } from "../../../src/core/errors.ts";

// Mock data
const mockGitInclusion: GitInclusion = {
  type: "git",
  name: "test-repo",
  url: "https://github.com/test/repo.git",
  localPath: "/test/path",
  order: 1,
  options: {
    active: true,
    copyStrategy: "overwrite",
    include: ["src/*"],
    exclude: ["node_modules/*"],
    excludeByDefault: false,
    autoPullBeforeBuild: true,
    autoPushBeforeBuild: false,
    branch: "main",
  },
};

const mockWebInclusion: WebInclusion = {
  type: "web",
  name: "test-web",
  url: "https://example.com",
  order: 2,
  options: {
    active: true,
    copyStrategy: "overwrite",
  },
};

// Tests for isGitInclusion
Deno.test("isGitInclusion correctly identifies git inclusions", () => {
  assertEquals(isGitInclusion(mockGitInclusion), true);
});

Deno.test("isGitInclusion correctly identifies non-git inclusions", () => {
  assertEquals(isGitInclusion(mockWebInclusion), false);
});

// Tests for getSyncStatus
Deno.test("getSyncStatus returns 'current' for up-to-date repo", async () => {
  const mockGitRunner = async () => "## main...origin/main";

  const status = await getSyncStatus("/test/path", mockGitRunner);
  assertEquals(status, "current");
});

Deno.test("getSyncStatus returns 'ahead' when local commits exist", async () => {
  const mockGitRunner = async () => "## main...origin/main [ahead 2]";

  const status = await getSyncStatus("/test/path", mockGitRunner);
  assertEquals(status, "ahead");
});

Deno.test("getSyncStatus returns 'behind' when remote commits exist", async () => {
  const mockGitRunner = async () => "## main...origin/main [behind 3]";

  const status = await getSyncStatus("/test/path", mockGitRunner);
  assertEquals(status, "behind");
});

Deno.test("getSyncStatus returns 'conflicted' when both ahead and behind", async () => {
  const mockGitRunner = async () => "## main...origin/main [ahead 2, behind 3]";

  const status = await getSyncStatus("/test/path", mockGitRunner);
  assertEquals(status, "conflicted");
});

Deno.test("getSyncStatus returns 'dirty' when there are uncommitted changes", async () => {
  const mockGitRunner = async () => "## main...origin/main\n M src/file.ts";

  const status = await getSyncStatus("/test/path", mockGitRunner);
  assertEquals(status, "dirty");
});

Deno.test("getSyncStatus returns 'unknown' on git failure", async () => {
  const mockGitRunner = async () => {
    throw new GitError("Git command failed", "git status");
  };

  const status = await getSyncStatus("/test/path", mockGitRunner);
  assertEquals(status, "unknown");
});

Deno.test("getSyncStatus returns 'unknown' on general failure", async () => {
  const mockGitRunner = async () => {
    throw new Error("Unexpected error");
  };

  const status = await getSyncStatus("/test/path", mockGitRunner);
  assertEquals(status, "unknown");
});

// Tests for checkGitInclusion
Deno.test("checkGitInclusion handles missing repository", async () => {
  const mockDirectoryExists = async () => false;
  const mockSyncStatus = async () => "missing" as const;

  const result = await checkGitInclusion(mockGitInclusion, mockDirectoryExists, mockSyncStatus);
  assertEquals(result.present, false);
  assertEquals(result.syncStatus, "missing");
  assertEquals(result.name, mockGitInclusion.name);
  assertEquals(result.order, mockGitInclusion.order);
  assertEquals(result.active, mockGitInclusion.options.active);
  assertEquals(result.copyStrategy, mockGitInclusion.options.copyStrategy);
  assertEquals(result.include, mockGitInclusion.options.include);
  assertEquals(result.exclude, mockGitInclusion.options.exclude);
  assertEquals(result.excludeByDefault, mockGitInclusion.options.excludeByDefault);
  assertEquals(result.autoPullBeforeBuild, mockGitInclusion.options.autoPullBeforeBuild);
  assertEquals(result.autoPushBeforeBuild, mockGitInclusion.options.autoPushBeforeBuild);
});

Deno.test("checkGitInclusion handles existing repository", async () => {
  const mockDirectoryExists = async () => true;
  const mockSyncStatus = async () => "current" as const;

  const result = await checkGitInclusion(mockGitInclusion, mockDirectoryExists, mockSyncStatus);
  assertEquals(result.present, true);
  assertEquals(result.syncStatus, "current");
  assertEquals(result.name, mockGitInclusion.name);
});

Deno.test("checkGitInclusion uses URL as name when name is not provided", async () => {
  const inclusionWithoutName = {
    ...mockGitInclusion,
    name: undefined,
  };
  const mockDirectoryExists = async () => true;
  const mockSyncStatus = async () => "current" as const;

  const result = await checkGitInclusion(inclusionWithoutName, mockDirectoryExists, mockSyncStatus);
  assertEquals(result.name, inclusionWithoutName.url);
});
