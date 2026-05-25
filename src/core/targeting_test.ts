import { assertEquals, assertThrows } from "@std/assert";
import {
  findUncoveredRequestedTargets,
  normalizeTargetSpecs,
  normalizeVersionTargetSpecs,
  prepareWeaveTargets,
  resolveTargetSelections,
} from "./targeting.ts";
import { WeaveInputError } from "./weave/weave.ts";

function createError(message: string): Error {
  return new WeaveInputError(message);
}

Deno.test("resolveTargetSelections returns all candidates when no targets are supplied", () => {
  assertEquals(
    resolveTargetSelections(
      ["alice", "alice/data"],
      [],
      createError,
    ),
    [
      { designatorPath: "alice" },
      { designatorPath: "alice/data" },
    ],
  );
});

Deno.test("resolveTargetSelections matches exact targets", () => {
  const targets = normalizeTargetSpecs(
    [{ designatorPath: "alice/data" }],
    "targets",
    createError,
  );

  assertEquals(
    resolveTargetSelections(
      ["alice", "alice/data"],
      targets,
      createError,
    ).map((selection) => selection.designatorPath),
    ["alice/data"],
  );
});

Deno.test("resolveTargetSelections matches the exact root target", () => {
  const targets = normalizeTargetSpecs(
    [{ designatorPath: "" }],
    "targets",
    createError,
  );

  assertEquals(
    resolveTargetSelections(
      ["", "alice", "alice/data"],
      targets,
      createError,
    ).map((selection) => selection.designatorPath),
    [""],
  );
});

Deno.test("resolveTargetSelections matches recursive root targets", () => {
  const targets = normalizeTargetSpecs(
    [{ designatorPath: "", recursive: true }],
    "targets",
    createError,
  );

  assertEquals(
    resolveTargetSelections(
      ["", "alice", "alice/data"],
      targets,
      createError,
    ).map((selection) => selection.designatorPath),
    ["", "alice", "alice/data"],
  );
});

Deno.test("resolveTargetSelections matches recursive targets by most-specific path", () => {
  const targets = normalizeTargetSpecs(
    [
      { designatorPath: "alice", recursive: true },
      { designatorPath: "alice/data" },
    ],
    "targets",
    createError,
  );

  const resolved = resolveTargetSelections(
    ["alice", "alice/data", "alice/data/notes"],
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
      { designatorPath: "alice/data", targetDesignatorPath: "alice/data" },
      {
        designatorPath: "alice/data/notes",
        targetDesignatorPath: "alice",
      },
    ],
  );
});

Deno.test("resolveTargetSelections lets a more-specific descendant target override recursive root", () => {
  const targets = normalizeTargetSpecs(
    [
      { designatorPath: "", recursive: true },
      { designatorPath: "alice/data" },
    ],
    "targets",
    createError,
  );

  const resolved = resolveTargetSelections(
    ["", "alice", "alice/data", "alice/data/notes"],
    targets,
    createError,
  );

  assertEquals(
    resolved.map((selection) => ({
      designatorPath: selection.designatorPath,
      targetDesignatorPath: selection.target?.designatorPath,
    })),
    [
      { designatorPath: "", targetDesignatorPath: "" },
      { designatorPath: "alice", targetDesignatorPath: "" },
      { designatorPath: "alice/data", targetDesignatorPath: "alice/data" },
      { designatorPath: "alice/data/notes", targetDesignatorPath: "" },
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
          designatorPath: "alice/data",
          manifestationSegment: "ttl",
        }],
        "targets",
        createError,
      ),
    WeaveInputError,
    "manifestationSegment is not supported",
  );
});

Deno.test("normalizeVersionTargetSpecs accepts version-only fields", () => {
  assertEquals(
    normalizeVersionTargetSpecs(
      [{
        designatorPath: "alice/data",
        historySegment: "releases",
        stateSegment: "v0.0.1",
        manifestationSegment: "ttl",
      }],
      "targets",
      createError,
    )[0],
    {
      source: {
        designatorPath: "alice/data",
        historySegment: "releases",
        stateSegment: "v0.0.1",
        manifestationSegment: "ttl",
      },
      designatorPath: "alice/data",
      recursive: false,
      historySegment: "releases",
      stateSegment: "v0.0.1",
      manifestationSegment: "ttl",
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

Deno.test("findUncoveredRequestedTargets requires exact targets to be covered directly", () => {
  const targets = normalizeVersionTargetSpecs(
    [
      { designatorPath: "alice" },
      { designatorPath: "alice/data" },
    ],
    "targets",
    createError,
  );

  assertEquals(
    findUncoveredRequestedTargets(targets, ["alice/data"]).map((target) =>
      target.designatorPath
    ),
    ["alice"],
  );
});

Deno.test("findUncoveredRequestedTargets lets recursive targets be covered by descendants", () => {
  const targets = normalizeVersionTargetSpecs(
    [{ designatorPath: "alice", recursive: true }],
    "targets",
    createError,
  );

  assertEquals(
    findUncoveredRequestedTargets(targets, ["alice/data"]),
    [],
  );
});

Deno.test("prepareWeaveTargets derives coherent version and shared phase targets", () => {
  const prepared = prepareWeaveTargets(
    [{
      designatorPath: "alice/data",
      historySegment: "releases",
      stateSegment: "v0.0.1",
      manifestationSegment: "ttl",
    }],
    "request.targets",
    createError,
  );

  assertEquals(prepared.versionTargets, [{
    source: {
      designatorPath: "alice/data",
      historySegment: "releases",
      stateSegment: "v0.0.1",
      manifestationSegment: "ttl",
    },
    designatorPath: "alice/data",
    recursive: false,
    historySegment: "releases",
    stateSegment: "v0.0.1",
    manifestationSegment: "ttl",
  }]);
  assertEquals(prepared.sharedTargets.map((target) => target.source), [
    { designatorPath: "" },
    { designatorPath: "alice" },
    { designatorPath: "alice/data" },
  ]);
});
