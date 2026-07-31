import { assertEquals } from "@std/assert";
import { classifyCreatedFilePath } from "./memory_stats.ts";

Deno.test("classifyCreatedFilePath separates retained validation plan roles", () => {
  assertEquals(
    classifyCreatedFilePath(
      "_mesh/_inventory/_history001/_s0002/ttl/inventory.ttl",
    ),
    "meshInventoryHistorySnapshots",
  );
  assertEquals(
    classifyCreatedFilePath(
      "term/_knop/_inventory/_history001/_s0001/ttl/inventory.ttl",
    ),
    "knopInventoriesAndMetadata",
  );
  assertEquals(
    classifyCreatedFilePath(
      "term/_knop/_meta/_history001/_s0001/ttl/meta.ttl",
    ),
    "knopInventoriesAndMetadata",
  );
  assertEquals(
    classifyCreatedFilePath("term/_history001/_s0001/ttl/term.ttl"),
    "payloadSnapshots",
  );
  assertEquals(
    classifyCreatedFilePath("term/index.html"),
    "other",
  );
});
