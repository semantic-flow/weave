// src/core/utils/composeSparseCheckoutRules_test.ts

import { assertEquals } from "../../../src/deps/assert.ts";
import { composeSparseCheckoutRules } from "../../../src/core/utils/composeSparseCheckoutRules.ts";

Deno.test("composeSparseCheckoutRules with excludeByDefault=false includes everything by default", () => {
  const rules = composeSparseCheckoutRules([], [], false);
  assertEquals(rules, ["/*"]);
});

Deno.test("composeSparseCheckoutRules with excludeByDefault=true excludes everything by default", () => {
  const rules = composeSparseCheckoutRules([], [], true);
  assertEquals(rules, []);
});

Deno.test("composeSparseCheckoutRules adds include patterns", () => {
  const rules = composeSparseCheckoutRules(
    ["src/*", "docs/*.md"],
    [],
    true
  );
  assertEquals(rules, ["src/*", "docs/*.md"]);
});

Deno.test("composeSparseCheckoutRules adds exclude patterns with ! prefix", () => {
  const rules = composeSparseCheckoutRules(
    [],
    ["node_modules/*", "dist/*"],
    false
  );
  assertEquals(rules, ["/*", "!node_modules/*", "!dist/*"]);
});

Deno.test("composeSparseCheckoutRules combines include and exclude patterns", () => {
  const rules = composeSparseCheckoutRules(
    ["src/*", "docs/*"],
    ["src/test/*", "docs/internal/*"],
    true
  );
  assertEquals(rules, [
    "src/*",
    "docs/*",
    "!src/test/*",
    "!docs/internal/*"
  ]);
});

Deno.test("composeSparseCheckoutRules handles complex patterns", () => {
  const rules = composeSparseCheckoutRules(
    [
      "src/**/*.ts",
      "packages/*/src/**/*.ts",
      "docs/**/*.md",
    ],
    [
      "**/*.test.ts",
      "**/node_modules/**",
      "**/dist/**",
    ],
    false
  );
  assertEquals(rules, [
    "/*",
    "src/**/*.ts",
    "packages/*/src/**/*.ts",
    "docs/**/*.md",
    "!**/*.test.ts",
    "!**/node_modules/**",
    "!**/dist/**",
  ]);
});

Deno.test("composeSparseCheckoutRules preserves pattern order", () => {
  const rules = composeSparseCheckoutRules(
    ["1", "2", "3"],
    ["4", "5", "6"],
    true
  );
  assertEquals(rules, [
    "1",
    "2", 
    "3",
    "!4",
    "!5",
    "!6"
  ]);
});

Deno.test("composeSparseCheckoutRules with empty arrays and excludeByDefault=false", () => {
  const rules = composeSparseCheckoutRules([], [], false);
  assertEquals(rules, ["/*"]);
});

Deno.test("composeSparseCheckoutRules with empty arrays and excludeByDefault=true", () => {
  const rules = composeSparseCheckoutRules([], [], true);
  assertEquals(rules, []);
});
