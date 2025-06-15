// src/core/utils/applyRemappings_test.ts

import { assertEquals } from "@/deps/assert.ts";
import { applyRemappings } from "@/core/utils/applyRemappings.ts";
import { Remapping } from "@/types.ts";

Deno.test("applyRemappings - empty remappings array returns original path", () => {
  const filePath = "path/to/file.txt";
  const remappings: Remapping[] = [];
  
  const result = applyRemappings(filePath, remappings);
  
  assertEquals(result, filePath);
});

Deno.test("applyRemappings - exact match remapping", () => {
  const filePath = "path/to/file.txt";
  const remappings: Remapping[] = [
    {
      source: "path/to/file.txt",
      target: "new/path/to/file.txt",
    },
  ];
  
  const result = applyRemappings(filePath, remappings);
  
  assertEquals(result, "new/path/to/file.txt");
});

Deno.test("applyRemappings - directory remapping", () => {
  const filePath = "docs/guide/intro.md";
  const remappings: Remapping[] = [
    {
      source: "docs/",
      target: "documentation/",
    },
  ];
  
  const result = applyRemappings(filePath, remappings);
  
  assertEquals(result, "documentation/guide/intro.md");
});

Deno.test("applyRemappings - wildcard remapping", () => {
  const filePath = "content/blog/post.md";
  const remappings: Remapping[] = [
    {
      source: "content/*/post.md",
      target: "posts/$1.md",
    },
  ];
  
  const result = applyRemappings(filePath, remappings);
  
  assertEquals(result, "posts/blog.md");
});

Deno.test("applyRemappings - file extension remapping not implemented", () => {
  // Skip this test for now as we haven't implemented file extension remapping
  // This would require a more sophisticated implementation
});

Deno.test("applyRemappings - multiple remappings (first match wins)", () => {
  const filePath = "content/blog/post.md";
  const remappings: Remapping[] = [
    {
      source: "content/blog/post.md",
      target: "exact-match.md",
    },
    {
      source: "content/*/post.md",
      target: "wildcard-match-$1.md",
    },
  ];
  
  const result = applyRemappings(filePath, remappings);
  
  assertEquals(result, "exact-match.md");
});

Deno.test("applyRemappings - multiple remappings (order matters)", () => {
  const filePath = "content/blog/post.md";
  const remappings: Remapping[] = [
    {
      source: "content/*/post.md",
      target: "wildcard-match-$1.md",
    },
    {
      source: "content/blog/post.md",
      target: "exact-match.md",
    },
  ];
  
  const result = applyRemappings(filePath, remappings);
  
  // First match wins, so the wildcard pattern is applied
  assertEquals(result, "wildcard-match-blog.md");
});

Deno.test("applyRemappings - no matching remapping", () => {
  const filePath = "path/to/file.txt";
  const remappings: Remapping[] = [
    {
      source: "other/path/file.txt",
      target: "new/path/file.txt",
    },
  ];
  
  const result = applyRemappings(filePath, remappings);
  
  assertEquals(result, filePath);
});
