import { assertEquals, assertThrows } from "@std/assert";
import {
  normalizeTargetSpecs,
  normalizeVersionTargetSpecs,
  resolveTargetSelections,
} from "./targeting.ts";
import { WeaveInputError } from "./weave/weave.ts";

function createError(message: string): Error {
  return new WeaveInputError(message);
}

Deno.test("resolveTargetSelections returns all candidates when no targets are supplied", () => {
  assertEquals(
    resolveTargetSelections(
      ["alice", "alice/bio"],
      [],
      createError,
    ),
    [
      { designatorPath: "alice" },
      { designatorPath: "alice/bio" },
    ],
  );
});

Deno.test("resolveTargetSelections matches exact targets", () => {
  const targets = normalizeTargetSpecs(
    [{ designatorPath: "alice/bio" }],
    "targets",
    createError,
  );

  assertEquals(
    resolveTargetSelections(
      ["alice", "alice/bio"],
      targets,
      createError,
    ).map((selection) => selection.designatorPath),
    ["alice/bio"],
  );
});

Deno.test("resolveTargetSelections matches recursive targets by most-specific path", () => {
  const targets = normalizeTargetSpecs(
    [
      { designatorPath: "alice", recursive: true },
      { designatorPath: "alice/bio" },
    ],
    "targets",
    createError,
  );

  const resolved = resolveTargetSelections(
    ["alice", "alice/bio", "alice/bio/notes"],
    targets,
    createError,
  );

  assertEquals(
    resolved.map((selection) => ({
      designatorPath: selection.designatorPath,
      targetDesignatorPath: selection.target?.designatorPath,
    })),
    [
      { designatorPath: "alice", targetDesignatorPath: "alice" },
      { designatorPath: "alice/bio", targetDesignatorPath: "alice/bio" },
      {
        designatorPath: "alice/bio/notes",
        targetDesignatorPath: "alice",
      },
    ],
  );
});

Deno.test("normalizeTargetSpecs rejects support-artifact-only paths", () => {
  assertThrows(
    () =>
      normalizeTargetSpecs(
        [{ designatorPath: "alice/_knop/_references" }],
        "targets",
        createError,
      ),
    WeaveInputError,
    "reserved path segments",
  );
});

Deno.test("normalizeTargetSpecs rejects version-only fields", () => {
  assertThrows(
    () =>
      normalizeTargetSpecs(
        [{
          designatorPath: "alice/bio",
          stateSegment: "v0.0.1",
        }],
        "targets",
        createError,
      ),
    WeaveInputError,
    "stateSegment is not supported",
  );
});

Deno.test("normalizeVersionTargetSpecs accepts version-only fields", () => {
  assertEquals(
    normalizeVersionTargetSpecs(
      [{
        designatorPath: "alice/bio",
        historySegment: "releases",
        stateSegment: "v0.0.1",
      }],
      "targets",
      createError,
    )[0],
    {
      source: {
        designatorPath: "alice/bio",
        historySegment: "releases",
        stateSegment: "v0.0.1",
      },
      designatorPath: "alice/bio",
      recursive: false,
      historySegment: "releases",
      stateSegment: "v0.0.1",
    },
  );
});

Deno.test("normalizeTargetSpecs rejects ambiguous duplicate target paths", () => {
  assertThrows(
    () =>
      normalizeTargetSpecs(
        [
          { designatorPath: "alice", recursive: true },
          { designatorPath: "alice" },
        ],
        "targets",
        createError,
      ),
    WeaveInputError,
    "ambiguous duplicate designatorPath",
  );
});
