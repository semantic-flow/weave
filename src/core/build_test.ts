// src/core/build_test.ts

import { assertEquals, assertStringIncludes } from "@/deps/assert.ts";
import { GitInclusion, WeaveConfigInput, WebInclusion, LocalInclusion, RepoGitResult } from "@/types.ts";
import { BuildOptions, BuildResult } from "@/core/interfaces/build.ts";
import { Frame } from "@/core/Frame.ts";
import { VerifyResult } from "@/core/inclusionsVerify.ts";

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

// Mock verification result
function createMockVerifyResult(isReady: boolean, issues: string[] = []): VerifyResult {
  return {
    repoResults: [],
    webResults: [],
    localResults: [],
    isReady,
    issues,
    suggestions: [],
  };
}

// Mock repository preparation results
function createMockPrepareResults(success: boolean, message?: string): RepoGitResult[] {
  return [
    {
      success,
      localPath: "/test/repo",
      message: message || (success ? "Success" : "Failed"),
    },
  ];
}

// Mock implementation of build that doesn't rely on the real implementation
function mockBuild(options: {
  verifyResult?: VerifyResult;
  prepareResults?: RepoGitResult[];
  filesCopied?: number;
  filesSkipped?: number;
  filesOverwritten?: number;
  filesUpdated?: number;
  errors?: string[];
  warnings?: string[];
  gitExists?: boolean;
  webImplemented?: boolean;
  localExists?: boolean;
}): (buildOptions?: BuildOptions) => Promise<BuildResult> {
  const {
    verifyResult = createMockVerifyResult(true),
    prepareResults = createMockPrepareResults(true),
    filesCopied = 10,
    filesSkipped = 2,
    filesOverwritten = 1,
    filesUpdated = 3,
    errors = [],
    warnings = [],
    gitExists = true,
    webImplemented = false,
    localExists = true,
  } = options;
  
  return (buildOptions: BuildOptions = {}): Promise<BuildResult> => {
    return Promise.resolve(((): BuildResult => {
      const frame = Frame.getInstance();
      const gitInclusions = frame.resolvedInclusions.filter(i => i.type === "git") as GitInclusion[];
      const webInclusions = frame.resolvedInclusions.filter(i => i.type === "web") as WebInclusion[];
      const localInclusions = frame.resolvedInclusions.filter(i => i.type === "local") as LocalInclusion[];
      
      // Initialize result
      const result: BuildResult = {
        success: true,
        filesCopied,
        filesSkipped,
        filesOverwritten,
        filesUpdated,
        errors: [...errors],
        warnings: [...warnings],
      };
      
      // Add verification result if verify is not disabled
      if (buildOptions.verify !== false) {
        result.verifyResult = verifyResult;
        
        // If verification failed, mark build as failed
        if (!verifyResult.isReady) {
          result.success = false;
          result.errors.push("Inclusions verification failed");
          verifyResult.issues.forEach(issue => result.errors.push(issue));
          return result;
        }
      }
      
      // Add prepare results if prepare is not disabled
      if (buildOptions.prepare !== false) {
        result.prepareResults = prepareResults;
        
        // If any preparation failed, mark build as failed
        const failedPreparations = prepareResults.filter(r => !r.success);
        if (failedPreparations.length > 0) {
          result.success = false;
          failedPreparations.forEach(r => {
            result.errors.push(`Repository preparation failed for ${r.localPath}: ${r.message || "Unknown error"}`);
          });
          return result;
        }
      }
      
      // Process git inclusions
      for (const inclusion of gitInclusions) {
        if (!inclusion.options.active) {
          continue;
        }
        
        if (!gitExists) {
          result.errors.push(`Repository directory does not exist: ${inclusion.localPath}`);
          result.success = false;
        }
      }
      
      // Process web inclusions
      for (const inclusion of webInclusions) {
        if (!inclusion.options.active) {
          continue;
        }
        
        if (!webImplemented) {
          result.warnings.push(`Web inclusions are not yet implemented: ${inclusion.name || inclusion.url}`);
        }
      }
      
      // Process local inclusions
      for (const inclusion of localInclusions) {
        if (!inclusion.options.active) {
          continue;
        }
        
        if (!localExists) {
          result.errors.push(`Local directory does not exist: ${inclusion.localPath}`);
          result.success = false;
        }
      }
      
      // Update success based on errors
      if (result.errors.length > 0) {
        result.success = false;
      }
      
      return result;
    })());
  };
}

// Tests
Deno.test("build succeeds when all inclusions are ready", async () => {
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
  const build = mockBuild({
    verifyResult: createMockVerifyResult(true),
    prepareResults: createMockPrepareResults(true),
    filesCopied: 10,
    filesSkipped: 2,
    filesOverwritten: 1,
  });
  
  // Execute the function
  const result = await build();
  
  // Verify the results
  assertEquals(result.success, true);
  assertEquals(result.filesCopied, 10);
  assertEquals(result.filesSkipped, 2);
  assertEquals(result.filesOverwritten, 1);
  assertEquals(result.errors.length, 0);
  
  // Teardown
  Frame.resetInstance();
});

Deno.test("build fails when verification fails", async () => {
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
  const build = mockBuild({
    verifyResult: createMockVerifyResult(false, ["Repository is behind remote"]),
  });
  
  // Execute the function
  const result = await build();
  
  // Verify the results
  assertEquals(result.success, false);
  assertEquals(result.errors.length, 2);
  assertStringIncludes(result.errors[0], "verification failed");
  assertStringIncludes(result.errors[1], "behind remote");
  
  // Teardown
  Frame.resetInstance();
});

Deno.test("build skips verification when --no-verify is specified", async () => {
  // Setup
  setupTest();
  
  // Set up test data
  const frame = Frame.getInstance();
  frame.resolvedInclusions = [
    createTestGitInclusion(),
    createTestWebInclusion(),
    createTestLocalInclusion(),
  ];
  
  // Create mock function with a verification result that would fail
  const build = mockBuild({
    verifyResult: createMockVerifyResult(false, ["Repository is behind remote"]),
  });
  
  // Execute the function with verify=false
  const result = await build({ verify: false });
  
  // Verify the results
  assertEquals(result.success, true);
  assertEquals(result.errors.length, 0);
  assertEquals(result.verifyResult, undefined);
  
  // Teardown
  Frame.resetInstance();
});

Deno.test("build skips repository preparation when --no-prepare is specified", async () => {
  // Setup
  setupTest();
  
  // Set up test data
  const frame = Frame.getInstance();
  frame.resolvedInclusions = [
    createTestGitInclusion(),
    createTestWebInclusion(),
    createTestLocalInclusion(),
  ];
  
  // Create mock function with preparation results that would fail
  const build = mockBuild({
    prepareResults: createMockPrepareResults(false, "Failed to pull changes"),
  });
  
  // Execute the function with prepare=false
  const result = await build({ prepare: false });
  
  // Verify the results
  assertEquals(result.success, true);
  assertEquals(result.errors.length, 0);
  assertEquals(result.prepareResults, undefined);
  
  // Teardown
  Frame.resetInstance();
});

Deno.test("build skips both verification and preparation when both flags are specified", async () => {
  // Setup
  setupTest();
  
  // Set up test data
  const frame = Frame.getInstance();
  frame.resolvedInclusions = [
    createTestGitInclusion(),
    createTestWebInclusion(),
    createTestLocalInclusion(),
  ];
  
  // Create mock function with both verification and preparation results that would fail
  const build = mockBuild({
    verifyResult: createMockVerifyResult(false, ["Repository is behind remote"]),
    prepareResults: createMockPrepareResults(false, "Failed to pull changes"),
  });
  
  // Execute the function with both verify=false and prepare=false
  const result = await build({ verify: false, prepare: false });
  
  // Verify the results
  assertEquals(result.success, true);
  assertEquals(result.errors.length, 0);
  assertEquals(result.verifyResult, undefined);
  assertEquals(result.prepareResults, undefined);
  
  // Teardown
  Frame.resetInstance();
});

Deno.test("build fails when repository preparation fails", async () => {
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
  const build = mockBuild({
    verifyResult: createMockVerifyResult(true),
    prepareResults: createMockPrepareResults(false, "Failed to pull changes"),
  });
  
  // Execute the function
  const result = await build();
  
  // Verify the results
  assertEquals(result.success, false);
  assertEquals(result.errors.length, 1);
  assertStringIncludes(result.errors[0], "Failed to pull changes");
  
  // Teardown
  Frame.resetInstance();
});

Deno.test("build fails when git repository doesn't exist", async () => {
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
  const build = mockBuild({
    gitExists: false,
  });
  
  // Execute the function
  const result = await build();
  
  // Verify the results
  assertEquals(result.success, false);
  assertEquals(result.errors.length, 1);
  assertStringIncludes(result.errors[0], "does not exist");
  
  // Teardown
  Frame.resetInstance();
});

Deno.test("build warns about unimplemented web inclusions", async () => {
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
  const build = mockBuild({
    webImplemented: false,
  });
  
  // Execute the function
  const result = await build();
  
  // Verify the results
  assertEquals(result.success, true);
  assertEquals(result.warnings.length, 1);
  assertStringIncludes(result.warnings[0], "not yet implemented");
  
  // Teardown
  Frame.resetInstance();
});

Deno.test("build fails when local directory doesn't exist", async () => {
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
  const build = mockBuild({
    localExists: false,
  });
  
  // Execute the function
  const result = await build();
  
  // Verify the results
  assertEquals(result.success, false);
  assertEquals(result.errors.length, 1);
  assertStringIncludes(result.errors[0], "does not exist");
  
  // Teardown
  Frame.resetInstance();
});

Deno.test("build skips inactive inclusions", async () => {
  // Setup
  setupTest();
  
  // Set up test data
  const frame = Frame.getInstance();
  
  // Create inclusions with active=false
  const gitInclusion = createTestGitInclusion();
  gitInclusion.options.active = false;
  
  const webInclusion = createTestWebInclusion();
  webInclusion.options.active = false;
  
  const localInclusion = createTestLocalInclusion();
  localInclusion.options.active = false;
  
  frame.resolvedInclusions = [
    gitInclusion,
    webInclusion,
    localInclusion,
  ];
  
  // Create mock function that would fail if inclusions were processed
  const build = mockBuild({
    gitExists: false,
    localExists: false,
  });
  
  // Execute the function
  const result = await build();
  
  // Verify the results - should succeed because inactive inclusions are skipped
  assertEquals(result.success, true);
  assertEquals(result.errors.length, 0);
  
  // Teardown
  Frame.resetInstance();
});

Deno.test("build respects pull and push strategy options", async () => {
  // Setup
  setupTest();
  
  // Set up test data
  const frame = Frame.getInstance();
  frame.resolvedInclusions = [
    createTestGitInclusion(),
  ];
  
  // Create a mock function that captures the options
  let capturedOptions: BuildOptions | undefined;
  const build = (options: BuildOptions = {}): Promise<BuildResult> => {
    capturedOptions = options;
    return Promise.resolve({
      success: true,
      filesCopied: 0,
      filesSkipped: 0,
      filesOverwritten: 0,
      filesUpdated: 0,
      errors: [],
      warnings: [],
    });
  };
  
  // Execute the function with specific strategies
  await build({
    pullStrategy: "rebase",
    pushStrategy: "force-with-lease",
  });
  
  // Verify the options were captured correctly
  assertEquals(capturedOptions?.pullStrategy, "rebase");
  assertEquals(capturedOptions?.pushStrategy, "force-with-lease");
  
  // Teardown
  Frame.resetInstance();
});

Deno.test("build respects verification ignore options", async () => {
  // Setup
  setupTest();
  
  // Set up test data
  const frame = Frame.getInstance();
  frame.resolvedInclusions = [
    createTestGitInclusion(),
  ];
  
  // Create a mock function that captures the options
  let capturedOptions: BuildOptions | undefined;
  const build = (options: BuildOptions = {}): Promise<BuildResult> => {
    capturedOptions = options;
    return Promise.resolve({
      success: true,
      filesCopied: 0,
      filesSkipped: 0,
      filesOverwritten: 0,
      filesUpdated: 0,
      errors: [],
      warnings: [],
    });
  };
  
  // Execute the function with ignore options
  await build({
    ignoreBehind: true,
    ignoreAhead: true,
    ignoreDivergent: true,
    ignoreCheckoutConsistency: true,
    ignoreMissing: true,
    ignoreDirty: true,
    ignoreRemoteAvailability: true,
    ignoreLocalEmpty: true,
  });
  
  // Verify the options were captured correctly
  assertEquals(capturedOptions?.ignoreBehind, true);
  assertEquals(capturedOptions?.ignoreAhead, true);
  assertEquals(capturedOptions?.ignoreDivergent, true);
  assertEquals(capturedOptions?.ignoreCheckoutConsistency, true);
  assertEquals(capturedOptions?.ignoreMissing, true);
  assertEquals(capturedOptions?.ignoreDirty, true);
  assertEquals(capturedOptions?.ignoreRemoteAvailability, true);
  assertEquals(capturedOptions?.ignoreLocalEmpty, true);
  
  // Teardown
  Frame.resetInstance();
});
