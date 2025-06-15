// src/core/Frame_test.ts

import { assertEquals, assertThrows } from "@/deps/assert.ts";
import { Frame } from "@/core/Frame.ts";
import { GitInclusion, LocalInclusion, WebInclusion } from "@/types.ts";

// Setup and teardown for tests
function setupTest() {
  // Reset the Frame singleton
  Frame.resetInstance();
  
  // Create a minimal config for testing
  const config = {
    global: {
      configFilePath: "weave.config.ts",
      debug: "ERROR",
      dest: "_woven",
      dryRun: false,
      globalClean: false,
      globalCollisionStrategy: "no-overwrite",
      globalUpdateStrategy: "never",
      ignoreMissingTimestamps: false,
      watchConfig: false,
      workspaceDir: "_source-repos",
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

function _createTestWebInclusion(): WebInclusion {
  return {
    type: "web",
    name: "Test Web Inclusion",
    url: "https://example.com/file.txt",
    order: 2,
    options: {
      active: true,
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

Deno.test("Frame - registerFileMapping adds a mapping", () => {
  setupTest();
  
  const frame = Frame.getInstance();
  const inclusion = createTestGitInclusion();
  
  frame.registerFileMapping("/source/file.txt", "/dest/file.txt", inclusion);
  
  const mappings = frame.getFileMappings();
  assertEquals(mappings.size, 1);
  assertEquals(mappings.has("/dest/file.txt"), true);
  
  const fileMapping = mappings.get("/dest/file.txt")!;
  assertEquals(fileMapping.length, 1);
  assertEquals(fileMapping[0].sourcePath, "/source/file.txt");
  assertEquals(fileMapping[0].inclusion, inclusion);
  
  Frame.resetInstance();
});

Deno.test("Frame - registerFileMapping adds multiple mappings to the same destination", () => {
  setupTest();
  
  const frame = Frame.getInstance();
  const gitInclusion = createTestGitInclusion();
  const localInclusion = createTestLocalInclusion();
  
  frame.registerFileMapping("/source/git/file.txt", "/dest/file.txt", gitInclusion);
  frame.registerFileMapping("/source/local/file.txt", "/dest/file.txt", localInclusion);
  
  const mappings = frame.getFileMappings();
  assertEquals(mappings.size, 1);
  
  const fileMapping = mappings.get("/dest/file.txt")!;
  assertEquals(fileMapping.length, 2);
  assertEquals(fileMapping[0].sourcePath, "/source/git/file.txt");
  assertEquals(fileMapping[0].inclusion, gitInclusion);
  assertEquals(fileMapping[1].sourcePath, "/source/local/file.txt");
  assertEquals(fileMapping[1].inclusion, localInclusion);
  
  Frame.resetInstance();
});

Deno.test("Frame - getCollisions returns only destinations with multiple sources", () => {
  setupTest();
  
  const frame = Frame.getInstance();
  const gitInclusion = createTestGitInclusion();
  const localInclusion = createTestLocalInclusion();
  
  // Add a file with no collision
  frame.registerFileMapping("/source/git/file1.txt", "/dest/file1.txt", gitInclusion);
  
  // Add a file with a collision
  frame.registerFileMapping("/source/git/file2.txt", "/dest/file2.txt", gitInclusion);
  frame.registerFileMapping("/source/local/file2.txt", "/dest/file2.txt", localInclusion);
  
  const collisions = frame.getCollisions();
  assertEquals(collisions.size, 1);
  assertEquals(collisions.has("/dest/file2.txt"), true);
  assertEquals(collisions.has("/dest/file1.txt"), false);
  
  const fileMapping = collisions.get("/dest/file2.txt")!;
  assertEquals(fileMapping.length, 2);
  
  Frame.resetInstance();
});

Deno.test("Frame - clearFileMappings removes all mappings", () => {
  setupTest();
  
  const frame = Frame.getInstance();
  const inclusion = createTestGitInclusion();
  
  frame.registerFileMapping("/source/file1.txt", "/dest/file1.txt", inclusion);
  frame.registerFileMapping("/source/file2.txt", "/dest/file2.txt", inclusion);
  
  let mappings = frame.getFileMappings();
  assertEquals(mappings.size, 2);
  
  frame.clearFileMappings();
  
  mappings = frame.getFileMappings();
  assertEquals(mappings.size, 0);
  
  Frame.resetInstance();
});

Deno.test("Frame - getInstance throws if not initialized", () => {
  Frame.resetInstance();
  
  assertThrows(
    () => Frame.getInstance(),
    Error,
    "Frame has not been initialized yet"
  );
});

Deno.test("Frame - initialize throws if already initialized", () => {
  setupTest();
  
  assertThrows(
    () => Frame.initialize({ global: {} }, []),
    Error,
    "Frame has already been initialized"
  );
  
  Frame.resetInstance();
});

Deno.test("Frame - isInitialized returns correct state", () => {
  Frame.resetInstance();
  assertEquals(Frame.isInitialized(), false);
  
  setupTest();
  assertEquals(Frame.isInitialized(), true);
  
  Frame.resetInstance();
  assertEquals(Frame.isInitialized(), false);
});
