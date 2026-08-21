import { assertEquals } from "@std/assert";
import type { WeaveableKnopCandidate } from "../../core/weave/candidates.ts";
import { TextFileOverlay } from "./planning_context.ts";

Deno.test("candidate retention accounting counts shared source text once", async () => {
  const overlay = new TextFileOverlay();
  const sharedSource = "source🙂";
  const candidate = (
    designatorPath: string,
  ): WeaveableKnopCandidate => ({
    designatorPath,
    currentKnopMetadataTurtle: `meta-${designatorPath}`,
    currentKnopInventoryTurtle: `inventory-${designatorPath}`,
    referenceTargetSourcePayloadArtifact: {
      designatorPath: "catalog/source",
      workingLocalRelativePath: "source.ttl",
      currentPayloadTurtle: sharedSource,
      latestHistoricalSnapshotPath: "catalog/source/history/source.ttl",
      latestHistoricalSnapshotTurtle: sharedSource,
      latestHistoricalStatePath: "catalog/source/history/state",
    },
  });

  await overlay.loadCandidate("term-a", () => Promise.resolve(candidate("a")));
  await overlay.loadCandidate("term-b", () => Promise.resolve(candidate("b")));

  assertEquals(
    overlay.retainedMemoryStats().candidateCacheApproxRetainedBytes,
    new TextEncoder().encode(
      `${sharedSource}meta-ainventory-ameta-binventory-b`,
    ).byteLength,
  );
});
