import { assertEquals, assertThrows } from "@std/assert";
import {
  admitVersionPayloadsRequest,
  mapPreparationError,
  WeaveApiError,
} from "./version_payloads.ts";

const meshRoot = Deno.build.os === "windows" ? "C:\\mesh" : "/mesh";
const text = new TextEncoder().encode("payload\n");

function assertApiError(
  operation: () => unknown,
  code: WeaveApiError["code"],
  stage: WeaveApiError["stage"],
): WeaveApiError {
  const error = assertThrows(operation, WeaveApiError);
  assertEquals(error.code, code);
  assertEquals(error.stage, stage);
  return error;
}

Deno.test("admission defeats the old implicit all-target behavior by refusing an empty payload request", () => {
  assertApiError(
    () => admitVersionPayloadsRequest({ meshRoot, items: [] }),
    "invalid-request",
    "admit",
  );
});

Deno.test("admission refuses normalized duplicate payload designators", () => {
  assertApiError(
    () =>
      admitVersionPayloadsRequest({
        meshRoot,
        items: [
          { designatorPath: "rules/core", bytes: text },
          { designatorPath: " rules/core ", bytes: text },
        ],
      }),
    "invalid-request",
    "admit",
  );
});

Deno.test("admission refuses multi-item overwrite before any load", () => {
  assertApiError(
    () =>
      admitVersionPayloadsRequest({
        meshRoot,
        overwriteExistingState: true,
        items: [
          {
            designatorPath: "rules/core",
            bytes: text,
            historySegment: "releases",
            stateSegment: "v1",
          },
          {
            designatorPath: "rules/shacl",
            bytes: text,
            historySegment: "releases",
            stateSegment: "v1",
          },
        ],
      }),
    "invalid-request",
    "admit",
  );
});

Deno.test("admission refuses overwrite segments supplied only by defaults", () => {
  assertApiError(
    () =>
      admitVersionPayloadsRequest({
        meshRoot,
        overwriteExistingState: true,
        defaults: {
          historySegment: "_history001",
          stateSegment: "_s0001",
        },
        items: [{ designatorPath: "rules/core", bytes: text }],
      }),
    "invalid-request",
    "admit",
  );
});

Deno.test("admission maps fatal UTF-8 decoding to unsupported-content at admit", () => {
  assertApiError(
    () =>
      admitVersionPayloadsRequest({
        meshRoot,
        items: [{
          designatorPath: "rules/core",
          bytes: new Uint8Array([0xc3, 0x28]),
        }],
      }),
    "unsupported-content",
    "admit",
  );
});

Deno.test("admission preserves the ruled zero-length policy by deferring emptiness to LOAD", () => {
  const admitted = admitVersionPayloadsRequest({
    meshRoot,
    items: [{ designatorPath: "rules/core", bytes: new Uint8Array() }],
  });
  assertEquals(admitted.items[0]?.bytes.byteLength, 0);
  assertEquals(admitted.items[0]?.text, "");
});

Deno.test("admission copies each shared-buffer view using its own offset and length", () => {
  const shared = new Uint8Array([65, 66, 67, 68]);
  const admitted = admitVersionPayloadsRequest({
    meshRoot,
    items: [
      { designatorPath: "rules/core", bytes: shared.subarray(0, 2) },
      { designatorPath: "rules/shacl", bytes: shared.subarray(2, 4) },
    ],
  });
  shared.fill(90);

  assertEquals([...admitted.items[0]!.bytes], [65, 66]);
  assertEquals([...admitted.items[1]!.bytes], [67, 68]);
  assertEquals(admitted.items.map((item) => item.text), ["AB", "CD"]);
});

Deno.test("admission makes caller mutation after the call boundary invisible", () => {
  const bytes = new TextEncoder().encode("before");
  const admitted = admitVersionPayloadsRequest({
    meshRoot,
    items: [{ designatorPath: "rules/core", bytes }],
  });
  bytes.set(new TextEncoder().encode("after!"));

  assertEquals(admitted.items[0]?.text, "before");
});

Deno.test("admission resolves per-item segment precedence over batch defaults independently", () => {
  const admitted = admitVersionPayloadsRequest({
    meshRoot,
    defaults: {
      historySegment: "default-history",
      stateSegment: "default-state",
      manifestationSegment: "default-format",
    },
    items: [{
      designatorPath: "rules/core",
      bytes: text,
      stateSegment: "item-state",
    }],
  });
  const target = admitted.targets[0]!;

  assertEquals(target.historySegment, "default-history");
  assertEquals(target.stateSegment, "item-state");
  assertEquals(target.manifestationSegment, "default-format");
});

Deno.test("admission exposes slash as the only public root representation", () => {
  const admitted = admitVersionPayloadsRequest({
    meshRoot,
    items: [{ designatorPath: "/", bytes: text }],
  });
  assertEquals(admitted.targets[0]?.designatorPath, "");
  assertApiError(
    () =>
      admitVersionPayloadsRequest({
        meshRoot,
        items: [{ designatorPath: "", bytes: text }],
      }),
    "invalid-request",
    "admit",
  );
});

Deno.test("preparation error mapping keeps policy, malformed-mesh, and plan conflicts machine-distinct", () => {
  const policy = mapPreparationError(
    new Error("requires consistent target-scoped planning policies"),
  );
  assertEquals([policy.code, policy.stage], ["inconsistent-policy", "load"]);

  const malformed = mapPreparationError(
    new Error("Could not parse the current KnopInventory"),
  );
  assertEquals([malformed.code, malformed.stage], ["malformed-mesh", "load"]);

  const plan = mapPreparationError(new Error("requested state already exists"));
  assertEquals([plan.code, plan.stage], ["plan-conflict", "plan"]);
});
