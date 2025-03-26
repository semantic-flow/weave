// src/core/reposPush_test.ts

import { assertEquals, assertStringIncludes } from "../deps/assert.ts";
import { GitInclusion, ResolvedInclusion, SyncStatus } from "../types.ts";
import { GitError } from "./errors.ts";

// Mock dependencies
const mockRunGitCommand = {
  lastCommand: { workingDir: "", args: [] as string[] },
  async fn(workingDir: string, args: string[]): Promise<string> {
    mockRunGitCommand.lastCommand = { workingDir, args };
    return "Mock git command output";
  }
};

const mockGetSyncStatus = {
  returnValue: "ahead" as SyncStatus,
  async fn(_localPath: string): Promise<SyncStatus> {
    return mockGetSyncStatus.returnValue;
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
async function testReposPush(pushStrategy?: string): Promise<any[]> {
  // Import the real function but with mocked dependencies
  const { reposPush } = await import("./reposPush.ts");
  
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
    // @ts-ignore - TypeScript doesn't like modifying imports
    utils.getSyncStatus = mockGetSyncStatus.fn;
    // @ts-ignore
    runGitCommandModule.runGitCommand = mockRunGitCommand.fn;
    // @ts-ignore
    frameModule.Frame.getInstance = () => mockFrame;
    
    // Call the function with our mocks in place
    return await reposPush(pushStrategy);
  } finally {
    // Restore original functions
    // @ts-ignore
    utils.getSyncStatus = originalGetSyncStatus;
    // @ts-ignore
    runGitCommandModule.runGitCommand = originalRunGitCommand;
    // @ts-ignore
    frameModule.Frame.getInstance = originalGetInstance;
  }
}

Deno.test({
  name: "reposPush uses no-force strategy by default",
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
      await testReposPush();
      
      // Verify the command that was executed
      assertEquals(mockRunGitCommand.lastCommand.args[0], "push");
      assertEquals(mockRunGitCommand.lastCommand.args.length, 1); // No additional flags for no-force
  },
});

Deno.test({
  name: "reposPush uses force-with-lease strategy when specified in inclusion",
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
            pushStrategy: "force-with-lease",
          },
        } as GitInclusion,
      ];
      
      // Execute the function
      await testReposPush();
      
      // Verify the command that was executed
      assertEquals(mockRunGitCommand.lastCommand.args[0], "push");
      assertEquals(mockRunGitCommand.lastCommand.args[1], "--force-with-lease");
  },
});

Deno.test({
  name: "reposPush uses force strategy when specified in inclusion",
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
            pushStrategy: "force",
          },
        } as GitInclusion,
      ];
      
      // Execute the function
      await testReposPush();
      
      // Verify the command that was executed
      assertEquals(mockRunGitCommand.lastCommand.args[0], "push");
      assertEquals(mockRunGitCommand.lastCommand.args[1], "--force");
  },
});

Deno.test({
  name: "reposPush uses strategy from parameter over inclusion",
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
      await testReposPush("force-with-lease");
      
      // Verify the command that was executed
      assertEquals(mockRunGitCommand.lastCommand.args[0], "push");
      assertEquals(mockRunGitCommand.lastCommand.args[1], "--force-with-lease");
  },
});

Deno.test({
  name: "reposPush skips repositories with dirty status",
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
      const results = await testReposPush();
      
      // Verify that the repository was skipped
      assertEquals(results.length, 1);
      assertEquals(results[0].success, false);
      assertStringIncludes(results[0].message || "", "uncommitted changes");
  },
});

Deno.test({
  name: "reposPush skips repositories with no changes to push",
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
      
      // Set the getSyncStatus mock to return current
      mockGetSyncStatus.returnValue = "current";
      
      // Execute the function
      const results = await testReposPush();
      
      // Verify that the repository was skipped
      assertEquals(results.length, 1);
      assertEquals(results[0].success, true);
      assertStringIncludes(results[0].message || "", "No changes to push");
  },
});
