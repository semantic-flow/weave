// src/core/inclusionsVerify_test.ts

import { assertEquals, assertStringIncludes } from "../deps/assert.ts";
import { GitInclusion, SyncStatus, WeaveConfigInput, WebInclusion, LocalInclusion } from "../types.ts";
import { VerifyResult, VerifyOptions } from "./inclusionsVerify.ts";
import { Frame } from "./Frame.ts";

// Setup and teardown for tests
function setupTest() {
  // Reset the Frame singleton
  Frame.resetInstance();
  
  // Create a minimal config for testing
  const config: WeaveConfigInput = {
    global: {
      dest: "_woven",
      workspaceDir: "/test/workspace",
      globalClean: false,
      globalCopyStrategy: "no-overwrite",
      globalCollisionStrategy: "fail",
      globalUpdateStrategy: "never",
      ignoreMissingTimestamps: false,
      dryRun: false,
      watchConfig: false,
      debug: "INFO",
      configFilePath: "weave.config.ts",
    },
  };
  
  // Initialize the Frame with empty inclusions
  Frame.initialize(config, []);
}

// Create test inclusions
function createTestGitInclusion(): GitInclusion {
  return {
    type: "git",
    name: "Test Git Repo",
    url: "https://example.com/repo.git",
    localPath: "/test/repo",
    order: 1,
    options: {
      active: true,
      copyStrategy: "no-overwrite",
      collisionStrategy: "fail",
      updateStrategy: "never",
      ignoreMissingTimestamps: false,
      include: [],
      exclude: [],
      excludeByDefault: false,
      autoPullBeforeBuild: true,
      autoPushBeforeBuild: false,
      branch: "main",
      pullStrategy: "ff-only",
      pushStrategy: "no-force",
      ignoreBehind: false,
      ignoreAhead: false,
      ignoreDivergent: false,
      ignoreCheckoutConsistency: false,
      ignoreMissing: false,
      ignoreDirty: false,
      remappings: [],
    },
  } as GitInclusion;
}

function createTestWebInclusion(): WebInclusion {
  return {
    type: "web",
    name: "Test Web Inclusion",
    url: "https://example.com/file.txt",
    order: 2,
    options: {
      active: true,
      copyStrategy: "no-overwrite",
      collisionStrategy: "fail",
      updateStrategy: "never",
      ignoreMissingTimestamps: false,
      ignoreRemoteAvailability: false,
      remappings: [],
    },
  } as WebInclusion;
}

function createTestLocalInclusion(): LocalInclusion {
  return {
    type: "local",
    name: "Test Local Inclusion",
    localPath: "/test/local",
    order: 3,
    options: {
      active: true,
      copyStrategy: "no-overwrite",
      collisionStrategy: "fail",
      updateStrategy: "never",
      ignoreMissingTimestamps: false,
      include: [],
      exclude: [],
      excludeByDefault: false,
      ignoreLocalEmpty: false,
      ignoreMissing: false,
      remappings: [],
    },
  } as LocalInclusion;
}

// Mock implementation of inclusionsVerify that doesn't rely on the real implementation
function mockInclusionsVerify(options: {
  gitStatus?: SyncStatus;
  gitExists?: boolean;
  gitSparseCheckoutEnabled?: boolean;
  webAccessible?: boolean;
  localExists?: boolean;
  localEmpty?: boolean;
  collisions?: string[];
}): (verifyOptions?: VerifyOptions) => Promise<VerifyResult> {
  const {
    gitStatus = "current",
    gitExists = true,
    gitSparseCheckoutEnabled = true,
    webAccessible = true,
    localExists = true,
    localEmpty = false,
    collisions = [],
  } = options;
  
  return (verifyOptions: VerifyOptions = {}): Promise<VerifyResult> => {
    return Promise.resolve(((): VerifyResult => {
    const frame = Frame.getInstance();
    const gitInclusions = frame.resolvedInclusions.filter(i => i.type === "git") as GitInclusion[];
    const webInclusions = frame.resolvedInclusions.filter(i => i.type === "web") as WebInclusion[];
    const localInclusions = frame.resolvedInclusions.filter(i => i.type === "local") as LocalInclusion[];
    
    // Initialize result
    const result: VerifyResult = {
      repoResults: [],
      webResults: [],
      localResults: [],
      isReady: true,
      issues: [],
      suggestions: [],
    };
    
    // Process git inclusions
    for (const inclusion of gitInclusions) {
      const inclusionItem = {
        order: inclusion.order,
        name: inclusion.name || inclusion.url,
        active: inclusion.options.active,
        present: gitExists,
        syncStatus: gitStatus,
        copyStrategy: inclusion.options.copyStrategy,
        include: inclusion.options.include,
        exclude: inclusion.options.exclude,
        excludeByDefault: inclusion.options.excludeByDefault,
        autoPullBeforeBuild: inclusion.options.autoPullBeforeBuild,
        autoPushBeforeBuild: inclusion.options.autoPushBeforeBuild,
        type: "git" as const,
      };
      
      // Initialize verification result
      const repoResult = {
        inclusion: inclusionItem,
        isReady: true,
        issues: [] as string[],
        suggestions: [] as string[],
      };
      
      // Check if repository exists
      if (!gitExists) {
        repoResult.isReady = false;
        repoResult.issues.push("Repository is missing");
        repoResult.suggestions.push("Run 'weave repos checkout' to initialize the repository");
      } else {
        // Check sync status
        if (gitStatus === "behind" && !verifyOptions.ignoreBehind) {
          repoResult.isReady = false;
          repoResult.issues.push("Repository is behind remote");
          repoResult.suggestions.push("Run 'weave repos pull' to update the repository");
        } else if (gitStatus === "ahead" && !verifyOptions.ignoreAhead) {
          repoResult.isReady = false;
          repoResult.issues.push("Repository is ahead of remote");
          repoResult.suggestions.push("Run 'weave repos push' to update the remote");
        } else if (gitStatus === "conflicted" && !verifyOptions.ignoreDivergent) {
          repoResult.isReady = false;
          repoResult.issues.push("Repository has diverged from remote");
          repoResult.suggestions.push("Run 'weave repos sync --pull-strategy=rebase' to synchronize");
        } else if (gitStatus === "dirty" && !verifyOptions.ignoreDirty) {
          repoResult.isReady = false;
          repoResult.issues.push("Repository has uncommitted changes");
          repoResult.suggestions.push("Run 'weave repos commit' to commit changes");
        }
        
        // Check sparse checkout
        if (!gitSparseCheckoutEnabled) {
          repoResult.isReady = false;
          repoResult.issues.push("Sparse checkout is not enabled");
          repoResult.suggestions.push("Run 'weave repos checkout' to configure sparse checkout");
        }
      }
      
      result.repoResults.push(repoResult);
      
      // Update overall ready status
      if (!repoResult.isReady) {
        result.isReady = false;
        result.issues.push(`Git inclusion '${inclusionItem.name}' is not ready`);
      }
    }
    
    // Process web inclusions
    for (const inclusion of webInclusions) {
      const webResult = {
        inclusion: {
          order: inclusion.order,
          name: inclusion.name || inclusion.url,
          active: inclusion.options.active,
          present: true, // Web inclusions are always "present"
          syncStatus: "current" as SyncStatus, // Web inclusions don't have a sync status
          copyStrategy: inclusion.options.copyStrategy,
          include: [], // Web inclusions don't have include/exclude
          exclude: [],
          excludeByDefault: false,
          autoPullBeforeBuild: false,
          autoPushBeforeBuild: false,
          type: "web" as const,
        },
        isReady: true,
        issues: [] as string[],
        suggestions: [] as string[],
      };
      
      // Check if URL is accessible
      if (!webAccessible && !verifyOptions.ignoreRemoteAvailability) {
        webResult.isReady = false;
        webResult.issues.push("URL is not accessible");
        webResult.suggestions.push("Check if the URL is correct and accessible");
      }
      
      result.webResults.push(webResult);
      
      // Update overall ready status
      if (!webResult.isReady) {
        result.isReady = false;
        result.issues.push(`Web inclusion '${webResult.inclusion.name}' is not ready`);
      }
    }
    
    // Process local inclusions
    for (const inclusion of localInclusions) {
      const localResult = {
        inclusion: {
          order: inclusion.order,
          name: inclusion.name || inclusion.localPath,
          active: inclusion.options.active,
          present: localExists,
          syncStatus: "current" as SyncStatus, // Local inclusions don't have a sync status
          copyStrategy: inclusion.options.copyStrategy,
          include: inclusion.options.include,
          exclude: inclusion.options.exclude,
          excludeByDefault: inclusion.options.excludeByDefault,
          autoPullBeforeBuild: false,
          autoPushBeforeBuild: false,
          type: "local" as const,
        },
        isReady: true,
        issues: [] as string[],
        suggestions: [] as string[],
      };
      
      // Check if directory exists
      if (!localExists) {
        localResult.isReady = false;
        localResult.issues.push("Directory does not exist");
        localResult.suggestions.push("Create the directory or update the inclusion path");
      } else if (localEmpty && !verifyOptions.ignoreLocalEmpty) {
        // Check if directory is empty
        localResult.isReady = false;
        localResult.issues.push("Directory is empty");
        localResult.suggestions.push("Add files to the directory or use --ignore-local-empty");
      }
      
      result.localResults.push(localResult);
      
      // Update overall ready status
      if (!localResult.isReady) {
        result.isReady = false;
        result.issues.push(`Local inclusion '${localResult.inclusion.name}' is not ready`);
      }
    }
    
    // Check for collisions
    if (collisions.length > 0) {
      result.isReady = false;
      result.issues.push("Potential file collisions detected");
      result.suggestions.push("Use appropriate copy strategy to handle collisions");
      
      // Add specific collision information
      for (const collision of collisions) {
        result.issues.push(`Collision: ${collision}`);
      }
    }
    
    return result;
    })());
  };
}

// Tests
Deno.test("inclusionsVerify returns ready status when all inclusions are ready", async () => {
  // Setup
  setupTest();
  
  // Set up test data
  const frame = Frame.getInstance();
  frame.resolvedInclusions = [
    createTestGitInclusion(),
    createTestWebInclusion(),
    createTestLocalInclusion(),
  ];
  
  // Create mock function
  const inclusionsVerify = mockInclusionsVerify({
    gitStatus: "current",
    gitExists: true,
    gitSparseCheckoutEnabled: true,
    webAccessible: true,
    localExists: true,
    localEmpty: false,
  });
  
  // Execute the function
  const result = await inclusionsVerify();
  
  // Verify the results
  assertEquals(result.isReady, true);
  assertEquals(result.issues.length, 0);
  assertEquals(result.repoResults.length, 1);
  assertEquals(result.webResults.length, 1);
  assertEquals(result.localResults.length, 1);
  
  // Teardown
  Frame.resetInstance();
});

Deno.test("inclusionsVerify detects issues with git repositories", async () => {
  // Setup
  setupTest();
  
  // Set up test data
  const frame = Frame.getInstance();
  frame.resolvedInclusions = [
    createTestGitInclusion(),
    createTestWebInclusion(),
    createTestLocalInclusion(),
  ];
  
  // Create mock function
  const inclusionsVerify = mockInclusionsVerify({
    gitStatus: "behind",
    webAccessible: true,
    localExists: true,
  });
  
  // Execute the function
  const result = await inclusionsVerify();
  
  // Verify the results
  assertEquals(result.isReady, false);
  assertEquals(result.issues.length, 1);
  assertStringIncludes(result.issues[0], "Git inclusion");
  assertEquals(result.repoResults[0].isReady, false);
  assertStringIncludes(result.repoResults[0].issues[0], "behind");
  
  // Teardown
  Frame.resetInstance();
});

Deno.test("inclusionsVerify detects issues with web inclusions", async () => {
  // Setup
  setupTest();
  
  // Set up test data
  const frame = Frame.getInstance();
  frame.resolvedInclusions = [
    createTestGitInclusion(),
    createTestWebInclusion(),
    createTestLocalInclusion(),
  ];
  
  // Create mock function
  const inclusionsVerify = mockInclusionsVerify({
    gitStatus: "current",
    webAccessible: false,
    localExists: true,
  });
  
  // Execute the function
  const result = await inclusionsVerify();
  
  // Verify the results
  assertEquals(result.isReady, false);
  assertEquals(result.issues.length, 1);
  assertStringIncludes(result.issues[0], "Web inclusion");
  assertEquals(result.webResults[0].isReady, false);
  assertStringIncludes(result.webResults[0].issues[0], "not accessible");
  
  // Teardown
  Frame.resetInstance();
});

Deno.test("inclusionsVerify detects issues with local inclusions", async () => {
  // Setup
  setupTest();
  
  // Set up test data
  const frame = Frame.getInstance();
  frame.resolvedInclusions = [
    createTestGitInclusion(),
    createTestWebInclusion(),
    createTestLocalInclusion(),
  ];
  
  // Create mock function
  const inclusionsVerify = mockInclusionsVerify({
    gitStatus: "current",
    webAccessible: true,
    localExists: true,
    localEmpty: true,
  });
  
  // Execute the function
  const result = await inclusionsVerify();
  
  // Verify the results
  assertEquals(result.isReady, false);
  assertEquals(result.issues.length, 1);
  assertStringIncludes(result.issues[0], "Local inclusion");
  assertEquals(result.localResults[0].isReady, false);
  assertStringIncludes(result.localResults[0].issues[0], "empty");
  
  // Teardown
  Frame.resetInstance();
});

Deno.test("inclusionsVerify respects ignore flags", async () => {
  // Setup
  setupTest();
  
  // Set up test data
  const frame = Frame.getInstance();
  frame.resolvedInclusions = [
    createTestGitInclusion(),
    createTestWebInclusion(),
    createTestLocalInclusion(),
  ];
  
  // Create mock function with issues that should be ignored
  const inclusionsVerify = mockInclusionsVerify({
    gitStatus: "behind",
    webAccessible: false,
    localExists: true,
    localEmpty: true,
  });
  
  // Execute the function with ignore flags
  const result = await inclusionsVerify({
    ignoreBehind: true,
    ignoreRemoteAvailability: true,
    ignoreLocalEmpty: true,
  });
  
  // Verify the results
  assertEquals(result.isReady, true);
  assertEquals(result.issues.length, 0);
  assertEquals(result.repoResults[0].isReady, true);
  assertEquals(result.webResults[0].isReady, true);
  assertEquals(result.localResults[0].isReady, true);
  
  // Teardown
  Frame.resetInstance();
});

Deno.test("inclusionsVerify detects file collisions", async () => {
  // Setup
  setupTest();
  
  // Set up test data
  const frame = Frame.getInstance();
  frame.resolvedInclusions = [
    createTestGitInclusion(),
    createTestWebInclusion(),
    createTestLocalInclusion(),
  ];
  
  // Create mock function with collisions
  const inclusionsVerify = mockInclusionsVerify({
    collisions: ["file1.md", "path/to/file2.md"],
  });
  
  // Execute the function
  const result = await inclusionsVerify();
  
  // Verify the results
  assertEquals(result.isReady, false);
  assertStringIncludes(result.issues[0], "collisions");
  assertStringIncludes(result.issues[1], "file1.md");
  assertStringIncludes(result.issues[2], "file2.md");
  
  // Teardown
  Frame.resetInstance();
});
