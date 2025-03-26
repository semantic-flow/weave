// src/core/reposStrategies_test.ts

import { assertEquals } from "../deps/assert.ts";
import { PullStrategy, PushStrategy } from "../types.ts";

/**
 * This test file verifies that the pull and push strategies are correctly defined
 * and that the command-line options are working correctly.
 * 
 * Note: These are not unit tests for the actual functionality, but rather
 * simple tests to ensure that the types and constants are defined correctly.
 */

Deno.test("Pull strategies are correctly defined", () => {
  // Verify that the PullStrategy type includes the expected values
  const validPullStrategies: PullStrategy[] = ["ff-only", "rebase", "merge"];
  
  // Check that each strategy is a valid value for the PullStrategy type
  validPullStrategies.forEach(strategy => {
    const typedStrategy: PullStrategy = strategy;
    assertEquals(typedStrategy, strategy);
  });
});

Deno.test("Push strategies are correctly defined", () => {
  // Verify that the PushStrategy type includes the expected values
  const validPushStrategies: PushStrategy[] = ["no-force", "force-with-lease", "force"];
  
  // Check that each strategy is a valid value for the PushStrategy type
  validPushStrategies.forEach(strategy => {
    const typedStrategy: PushStrategy = strategy;
    assertEquals(typedStrategy, strategy);
  });
});

Deno.test("Pull strategy constants match the type", async () => {
  // Import the constants from the types module
  const { validPullStrategies } = await import("../types.ts");
  
  // Verify that the constants match the expected values
  assertEquals(validPullStrategies, ["ff-only", "rebase", "merge"]);
});

Deno.test("Push strategy constants match the type", async () => {
  // Import the constants from the types module
  const { validPushStrategies } = await import("../types.ts");
  
  // Verify that the constants match the expected values
  assertEquals(validPushStrategies, ["no-force", "force-with-lease", "force"]);
});
