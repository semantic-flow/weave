// src/core/reposPull_test.ts

import { assertEquals, assertStringIncludes } from "../deps/assert.ts";
import { GitInclusion, ResolvedInclusion, SyncStatus, RepoGitResult } from "../types.ts";
// GitError is imported but not used directly in this file
import { GitError as _GitError } from "./errors.ts";

// Mock dependencies
const mockRunGitCommand = {
  lastCommand: { workingDir: "", args: [] as string[] },
  // Using Promise.resolve to satisfy the require-await rule
  fn(workingDir: string, args: string[]): Promise<string> {
    mockRunGitCommand.lastCommand = { workingDir, args };
    return Promise.resolve("Mock git command output");
  }
};

const mockGetSyncStatus = {
  returnValue: "current" as SyncStatus,
  // Using Promise.resolve to satisfy the require-await rule
  fn(_localPath: string): Promise<SyncStatus> {
    return Promise.resolve(mockGetSyncStatus.returnValue);
  }
};

const mockFrame = {
  config: {
    global: {
      dryRun: false,
    },
  },
  resolvedInclusions: [] as ResolvedInclusion[],
};

// Create a testable wrapper function that uses our mocks
async function testReposPull(pullStrategy?: string): Promise<RepoGitResult[]> {
  // Import the real function but with mocked dependencies
  const { reposPull } = await import("./reposPull.ts");
  
  // Mock the dependencies
  const utils = await import("./utils/gitInclusionUtils.ts");
  const runGitCommandModule = await import("./utils/runGitCommand.ts");
  const frameModule = await import("./Frame.ts");
  
  // Save original functions
  const originalGetSyncStatus = utils.getSyncStatus;
  const originalRunGitCommand = runGitCommandModule.runGitCommand;
  const originalGetInstance = frameModule.Frame.getInstance;
  
  try {
    // Replace with mocks
    // @ts-ignore: Need to modify imported module for testing
    utils.getSyncStatus = mockGetSyncStatus.fn;
    // @ts-ignore: Need to modify imported module for testing
    runGitCommandModule.runGitCommand = mockRunGitCommand.fn;
    // @ts-ignore: Need to modify imported module for testing
    frameModule.Frame.getInstance = () => mockFrame;
    
    // Call the function with our mocks in place
    return await reposPull(pullStrategy);
  } finally {
    // Restore original functions
    // @ts-ignore: Need to modify imported module for testing
    utils.getSyncStatus = originalGetSyncStatus;
    // @ts-ignore: Need to modify imported module for testing
    runGitCommandModule.runGitCommand = originalRunGitCommand;
    // @ts-ignore: Need to modify imported module for testing
    frameModule.Frame.getInstance = originalGetInstance;
  }
}

Deno.test({
  name: "reposPull uses ff-only strategy by default",
  fn: async () => {
      // Setup test data
      mockFrame.resolvedInclusions = [
        {
          type: "git",
          name: "Test Repo",
          url: "https://example.com/repo.git",
          localPath: "/test/repo",
          order: 1,
          options: {
            active: true,
            copyStrategy: "no-overwrite",
            include: [],
            exclude: [],
            excludeByDefault: false,
            autoPullBeforeBuild: true,
            autoPushBeforeBuild: false,
            branch: "main",
            pullStrategy: "ff-only",
            pushStrategy: "no-force",
          },
        } as GitInclusion,
      ];
      
      // Execute the function
      await testReposPull();
      
      // Verify the command that was executed
      assertEquals(mockRunGitCommand.lastCommand.args[0], "pull");
      assertEquals(mockRunGitCommand.lastCommand.args[1], "--ff-only");
  },
});

Deno.test({
  name: "reposPull uses rebase strategy when specified in inclusion",
  fn: async () => {
      // Setup test data
      mockFrame.resolvedInclusions = [
        {
          type: "git",
          name: "Test Repo",
          url: "https://example.com/repo.git",
          localPath: "/test/repo",
          order: 1,
          options: {
            active: true,
            copyStrategy: "no-overwrite",
            include: [],
            exclude: [],
            excludeByDefault: false,
            autoPullBeforeBuild: true,
            autoPushBeforeBuild: false,
            branch: "main",
            pullStrategy: "rebase",
            pushStrategy: "no-force",
          },
        } as GitInclusion,
      ];
      
      // Execute the function
      await testReposPull();
      
      // Verify the command that was executed
      assertEquals(mockRunGitCommand.lastCommand.args[0], "pull");
      assertEquals(mockRunGitCommand.lastCommand.args[1], "--rebase");
  },
});

Deno.test({
  name: "reposPull uses merge strategy when specified in inclusion",
  fn: async () => {
      // Setup test data
      mockFrame.resolvedInclusions = [
        {
          type: "git",
          name: "Test Repo",
          url: "https://example.com/repo.git",
          localPath: "/test/repo",
          order: 1,
          options: {
            active: true,
            copyStrategy: "no-overwrite",
            include: [],
            exclude: [],
            excludeByDefault: false,
            autoPullBeforeBuild: true,
            autoPushBeforeBuild: false,
            branch: "main",
            pullStrategy: "merge",
            pushStrategy: "no-force",
          },
        } as GitInclusion,
      ];
      
      // Execute the function
      await testReposPull();
      
      // Verify the command that was executed
      assertEquals(mockRunGitCommand.lastCommand.args[0], "pull");
      assertEquals(mockRunGitCommand.lastCommand.args[1], "--no-rebase");
  },
});

Deno.test({
  name: "reposPull uses strategy from parameter over inclusion",
  fn: async () => {
      // Setup test data
      mockFrame.resolvedInclusions = [
        {
          type: "git",
          name: "Test Repo",
          url: "https://example.com/repo.git",
          localPath: "/test/repo",
          order: 1,
          options: {
            active: true,
            copyStrategy: "no-overwrite",
            include: [],
            exclude: [],
            excludeByDefault: false,
            autoPullBeforeBuild: true,
            autoPushBeforeBuild: false,
            branch: "main",
            pullStrategy: "ff-only",
            pushStrategy: "no-force",
          },
        } as GitInclusion,
      ];
      
      // Execute the function with a parameter
      await testReposPull("rebase");
      
      // Verify the command that was executed
      assertEquals(mockRunGitCommand.lastCommand.args[0], "pull");
      assertEquals(mockRunGitCommand.lastCommand.args[1], "--rebase");
  },
});

Deno.test({
  name: "reposPull skips repositories with dirty status",
  fn: async () => {
      // Setup test data
      mockFrame.resolvedInclusions = [
        {
          type: "git",
          name: "Test Repo",
          url: "https://example.com/repo.git",
          localPath: "/test/repo",
          order: 1,
          options: {
            active: true,
            copyStrategy: "no-overwrite",
            include: [],
            exclude: [],
            excludeByDefault: false,
            autoPullBeforeBuild: true,
            autoPushBeforeBuild: false,
            branch: "main",
            pullStrategy: "ff-only",
            pushStrategy: "no-force",
          },
        } as GitInclusion,
      ];
      
      // Set the getSyncStatus mock to return dirty
      mockGetSyncStatus.returnValue = "dirty";
      
      // Execute the function
      const results = await testReposPull();
      
      // Verify that the repository was skipped
      assertEquals(results.length, 1);
      assertEquals(results[0].success, false);
      assertStringIncludes(results[0].message || "", "uncommitted changes");
  },
});
