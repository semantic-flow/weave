// src/core/inclusionsList_test.ts

import { assertEquals } from "../deps/assert.ts";
import { checkWebInclusion, isWebInclusion, isLocalInclusion } from "./inclusionsList.ts";
import { WebInclusion, LocalInclusion, GitInclusion } from "../types.ts";

// Mock data
const mockGitInclusion: GitInclusion = {
  type: "git",
  name: "Test Git Repo",
  url: "git@github.com:test/repo.git",
  order: 10,
  localPath: "/test/path",
  options: {
    active: true,
    copyStrategy: "overwrite",
    include: ["src"],
    exclude: ["tests"],
    excludeByDefault: false,
    autoPullBeforeBuild: true,
    autoPushBeforeBuild: false,
    branch: "main",
    pullStrategy: "ff-only",
    pushStrategy: "no-force",
    // Verification options
    ignoreBehind: false,
    ignoreAhead: false,
    ignoreDivergent: false,
    ignoreCheckoutConsistency: false,
    ignoreMissing: false,
    ignoreDirty: false,
    remappings: []
  }
};

const mockWebInclusion: WebInclusion = {
  type: "web",
  name: "Test Web Resource",
  url: "https://example.com/resource.md",
  order: 20,
  options: {
    active: true,
    copyStrategy: "no-overwrite",
    // Verification options
    ignoreRemoteAvailability: false,
    remappings: []
  }
};

const mockLocalInclusion: LocalInclusion = {
  type: "local",
  name: "Test Local Directory",
  localPath: "/test/local",
  order: 5,
  options: {
    active: true,
    copyStrategy: "skip",
    include: ["docs"],
    exclude: ["private"],
    excludeByDefault: true,
    // Verification options
    ignoreLocalEmpty: false,
    ignoreMissing: false,
    remappings: []
  }
};

// Type checking tests
Deno.test("isWebInclusion correctly identifies web inclusions", () => {
  assertEquals(isWebInclusion(mockWebInclusion), true);
  assertEquals(isWebInclusion(mockGitInclusion), false);
  assertEquals(isWebInclusion(mockLocalInclusion), false);
});

Deno.test("isLocalInclusion correctly identifies local inclusions", () => {
  assertEquals(isLocalInclusion(mockLocalInclusion), true);
  assertEquals(isLocalInclusion(mockGitInclusion), false);
  assertEquals(isLocalInclusion(mockWebInclusion), false);
});

// Web inclusion tests
Deno.test("checkWebInclusion handles accessible URLs", async () => {
  const originalFetch = globalThis.fetch;
  
  try {
    // Mock fetch to return success
    globalThis.fetch = () => {
      return Promise.resolve({
        ok: true,
      } as Response);
    };
    
    const result = await checkWebInclusion(mockWebInclusion);
    
    assertEquals(result.name, mockWebInclusion.name);
    assertEquals(result.order, mockWebInclusion.order);
    assertEquals(result.active, mockWebInclusion.options.active);
    assertEquals(result.present, true);
    assertEquals(result.syncStatus, "current");
    assertEquals(result.copyStrategy, mockWebInclusion.options.copyStrategy);
    assertEquals(result.type, "web");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

Deno.test("checkWebInclusion handles inaccessible URLs", async () => {
  const originalFetch = globalThis.fetch;
  
  try {
    // Mock fetch to return failure
    globalThis.fetch = () => {
      return Promise.resolve({
        ok: false,
      } as Response);
    };
    
    const result = await checkWebInclusion(mockWebInclusion);
    
    assertEquals(result.present, false);
    assertEquals(result.syncStatus, "missing");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

Deno.test("checkWebInclusion handles fetch errors", async () => {
  const originalFetch = globalThis.fetch;
  const originalConsoleError = console.error;
  
  try {
    // Suppress console errors during test
    console.error = () => {};
    
    // Mock fetch to throw an error
    globalThis.fetch = () => {
      return Promise.reject(new Error("Network error"));
    };
    
    const result = await checkWebInclusion(mockWebInclusion);
    
    assertEquals(result.present, false);
    assertEquals(result.syncStatus, "missing");
  } finally {
    globalThis.fetch = originalFetch;
    console.error = originalConsoleError;
  }
});

// Local inclusion tests - skipping due to file system access issues
// These tests would verify that checkLocalInclusion correctly processes local inclusions
// and handles both existing and non-existent directories

// inclusionsList tests - skipping due to module mocking issues
// These tests would verify that inclusionsList correctly processes all inclusion types,
// sorts them by order, and handles errors gracefully
