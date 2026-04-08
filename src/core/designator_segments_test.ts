import { assertEquals, assertThrows } from "@std/assert";
import {
  appendMeshPath,
  formatDesignatorPathForDisplay,
  isDirectChildMeshPath,
  normalizeCliDesignatorPath,
  normalizeSafeDesignatorPath,
  toDesignatorResourcePagePath,
  toKnopPath,
  toReferenceCatalogPath,
} from "./designator_segments.ts";

function createError(message: string): Error {
  return new Error(message);
}

Deno.test("normalizeSafeDesignatorPath allows the root path when configured", () => {
  assertEquals(
    normalizeSafeDesignatorPath(
      "   ",
      "designatorPath",
      createError,
      { allowRoot: true },
    ),
    "",
  );
});

Deno.test("normalizeCliDesignatorPath maps the CLI root sentinel to the internal root path", () => {
  assertEquals(
    normalizeCliDesignatorPath("/", "designatorPath", createError),
    "",
  );
});

Deno.test("normalizeCliDesignatorPath rejects a missing value", () => {
  assertThrows(
    () => normalizeCliDesignatorPath("   ", "designatorPath", createError),
    Error,
    "designatorPath is required",
  );
});

Deno.test("root-aware path helpers do not add leading slashes", () => {
  assertEquals(appendMeshPath("", "_knop"), "_knop");
  assertEquals(toKnopPath(""), "_knop");
  assertEquals(toReferenceCatalogPath(""), "_knop/_references");
  assertEquals(toDesignatorResourcePagePath(""), "index.html");
  assertEquals(formatDesignatorPathForDisplay(""), "/");
});

Deno.test("isDirectChildMeshPath treats the root as the parent of single-segment paths", () => {
  assertEquals(isDirectChildMeshPath("", "_history001"), true);
  assertEquals(isDirectChildMeshPath("", "alice"), true);
  assertEquals(isDirectChildMeshPath("", "alice/bio"), false);
  assertEquals(isDirectChildMeshPath("alice", "alice/bio"), true);
  assertEquals(isDirectChildMeshPath("alice", "alice/bio/notes"), false);
});
