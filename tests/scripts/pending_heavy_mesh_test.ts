import {
  assert,
  assertEquals,
  assertGreater,
  assertStrictEquals,
} from "@std/assert";
import { fromFileUrl, join } from "@std/path";
import {
  generatePendingHeavyMesh,
} from "../../scripts/generate-pending-heavy-mesh.ts";
import type { RuntimeMemoryStatsReport } from "../../src/runtime/weave/memory_stats.ts";
import { loadOperationalLocalPathPolicy } from "../../src/runtime/operational/local_path_policy.ts";
import { loadWeaveableKnopCandidates } from "../../src/runtime/weave/candidate_loader.ts";
import { loadMeshState } from "../../src/runtime/weave/mesh_state.ts";
import {
  applyPlannedFilesToOverlay,
  TextFileOverlay,
} from "../../src/runtime/weave/planning_context.ts";
import { createTestTmpDir } from "../support/test_tmp.ts";

const repoRoot = fromFileUrl(new URL("../../", import.meta.url));
const cliEntrypoint = join(repoRoot, "src/main.ts");

Deno.test("pending-heavy generator enters the instrumented recursive validation loop", async () => {
  const currentOnlyRoot = await createTestTmpDir(
    "weave-pending-heavy-current-only-",
  );
  const currentOnly = await generatePendingHeavyMesh({
    outputPath: currentOnlyRoot,
    count: 3,
    meshInventoryHistoryPolicy: "current-only",
  });
  assertEquals(currentOnly.extractedDesignatorPaths.length, 3);

  const enabled = await runValidate(currentOnlyRoot, "1");
  assert(enabled.output.success, enabled.stderr);
  const currentReport = parseMemoryStats(enabled.stderr);
  assertEquals(currentReport.planningLoopIterations, 3);
  assertEquals(currentReport.createdFiles.count, 0);
  assertEquals(currentReport.createdFiles.bytes, 0);
  assertGreater(currentReport.updatedFileByPath.count, 0);
  assertGreater(currentReport.updatedFileByPath.bytes, 0);
  assertGreater(currentReport.overlayStaged.entries, 0);
  assertGreater(currentReport.overlayStaged.bytes, 0);
  assertGreater(currentReport.readCache.entries, 0);
  assertGreater(currentReport.readCache.bytes, 0);
  assertGreater(currentReport.readCache.hits, 0);
  assertGreater(currentReport.candidateCache.entries, 0);
  assertEquals(
    currentReport.candidateCache.approximateRetainedBytes,
    0,
  );
  assertGreater(currentReport.candidateCache.stores, 0);
  assertGreater(currentReport.candidateCache.invalidations, 0);
  assertEquals(currentReport.candidateLiveSet.entries, 3);
  assertEquals(currentReport.candidateLiveSet.sourceTextReferences, 6);
  assertEquals(
    currentReport.candidateLiveSet.distinctSourceTextIdentities,
    2,
  );
  assertGreater(
    currentReport.candidateLiveSet.approximateRetainedSourceTextBytes,
    0,
  );
  assertGreater(currentReport.maxRssBytes, 0);
  assertGreater(currentReport.v8Heap.usedHeapSize, 0);
  assertEquals(currentReport.v8Heap.postGcUsedHeapSize, null);
  assertGreater(currentReport.v8Heap.heapSizeLimit, 0);
  assertEquals(
    currentReport.createdFiles.byPathClassification
      .meshInventoryHistorySnapshots.count,
    0,
  );

  const gcEnabled = await runValidate(currentOnlyRoot, "1", true);
  assert(gcEnabled.output.success, gcEnabled.stderr);
  const gcReport = parseMemoryStats(gcEnabled.stderr);
  assertEquals(gcReport.planningLoopIterations, 3);
  assertGreater(gcReport.v8Heap.usedHeapSize, 0);
  assertGreater(gcReport.v8Heap.postGcUsedHeapSize!, 0);

  const disabled = await runValidate(currentOnlyRoot, "0");
  assert(disabled.output.success, disabled.stderr);
  assertEquals(disabled.stderr.includes("[memory-stats]"), false);
});

Deno.test("pending extracted candidates share cached source text and capture both payload dependencies", async () => {
  const meshRoot = await createTestTmpDir(
    "weave-pending-heavy-shared-source-",
  );
  await generatePendingHeavyMesh({
    outputPath: meshRoot,
    count: 2,
    meshInventoryHistoryPolicy: "current-only",
    termContentBytes: 256,
  });

  const meshState = await loadMeshState(meshRoot);
  const localPathPolicy = await loadOperationalLocalPathPolicy(meshRoot);
  const overlay = new TextFileOverlay();
  const candidates = await loadWeaveableKnopCandidates(
    meshRoot,
    localPathPolicy,
    meshState.meshBase,
    meshState.currentMeshInventoryTurtle,
    [],
    new Map(),
    overlay,
  );
  assertEquals(candidates.length, 2);

  const firstSource = candidates[0]!.referenceTargetSourcePayloadArtifact!;
  const secondSource = candidates[1]!.referenceTargetSourcePayloadArtifact!;
  assertStrictEquals(
    firstSource.currentPayloadTurtle,
    secondSource.currentPayloadTurtle,
  );
  assertStrictEquals(
    firstSource.latestHistoricalSnapshotTurtle,
    secondSource.latestHistoricalSnapshotTurtle,
  );

  const sourceBytes = new TextEncoder().encode(firstSource.currentPayloadTurtle)
    .byteLength;
  assertEquals(
    overlay.retainedCandidateLiveSetMemoryStats(meshRoot, candidates),
    {
      entries: 2,
      sourceTextReferences: 4,
      distinctSourceTextIdentities: 2,
      approximateRetainedSourceTextBytes: sourceBytes * 2,
    },
  );

  applyPlannedFilesToOverlay(meshRoot, overlay, [{
    path: firstSource.workingLocalRelativePath,
    contents: firstSource.currentPayloadTurtle,
  }]);
  assert(
    overlay.candidateCacheInvalidationCount >= candidates.length,
    "Expected the shared working payload path to invalidate every extracted candidate.",
  );
  const workingPayloadInvalidations = overlay.candidateCacheInvalidationCount;

  await loadWeaveableKnopCandidates(
    meshRoot,
    localPathPolicy,
    meshState.meshBase,
    meshState.currentMeshInventoryTurtle,
    [],
    new Map(),
    overlay,
  );
  applyPlannedFilesToOverlay(meshRoot, overlay, [{
    path: firstSource.latestHistoricalSnapshotPath!,
    contents: firstSource.latestHistoricalSnapshotTurtle!,
  }]);
  assert(
    overlay.candidateCacheInvalidationCount - workingPayloadInvalidations >=
      candidates.length,
    "Expected the shared historical snapshot path to invalidate every extracted candidate.",
  );
});

Deno.test("candidate live-set retained source bytes stay flat as pending count grows", async () => {
  const twenty = await generateAndMeasureCandidateSourceRetention(20, 1024);
  const sixty = await generateAndMeasureCandidateSourceRetention(60, 278);

  assertEquals(twenty.report.candidateLiveSet.entries, 20);
  assertEquals(sixty.report.candidateLiveSet.entries, 60);
  assertEquals(twenty.report.candidateLiveSet.sourceTextReferences, 40);
  assertEquals(sixty.report.candidateLiveSet.sourceTextReferences, 120);
  assertEquals(
    twenty.report.candidateLiveSet.distinctSourceTextIdentities,
    2,
  );
  assertEquals(
    sixty.report.candidateLiveSet.distinctSourceTextIdentities,
    2,
  );
  assertEquals(
    twenty.report.candidateLiveSet.approximateRetainedSourceTextBytes,
    twenty.sourceBytes * 2,
  );
  assertEquals(
    sixty.report.candidateLiveSet.approximateRetainedSourceTextBytes,
    sixty.sourceBytes * 2,
  );
  assert(
    Math.abs(
      twenty.report.candidateLiveSet.approximateRetainedSourceTextBytes -
        sixty.report.candidateLiveSet.approximateRetainedSourceTextBytes,
    ) <= 128,
    `Expected near-identical retained source bytes, got ${twenty.report.candidateLiveSet.approximateRetainedSourceTextBytes} and ${sixty.report.candidateLiveSet.approximateRetainedSourceTextBytes}.`,
  );
});

Deno.test("pending-heavy generator materializes mesh-inventory history when requested", async () => {
  const versionedRoot = await createTestTmpDir(
    "weave-pending-heavy-versioned-",
  );
  const generated = await generatePendingHeavyMesh({
    outputPath: versionedRoot,
    count: 2,
    meshInventoryHistoryPolicy: "versioned",
  });
  assertEquals(generated.extractedDesignatorPaths.length, 2);
  assert(
    (await Deno.readTextFile(
      join(versionedRoot, "_mesh/_config/config.ttl"),
    )).includes("sfcfg:historyTrackingPolicy_versioned"),
  );

  const enabled = await runValidate(versionedRoot, "1");
  assert(enabled.output.success, enabled.stderr);
  const report = parseMemoryStats(enabled.stderr);
  assertEquals(report.planningLoopIterations, 2);
  assertGreater(
    report.createdFiles.byPathClassification
      .meshInventoryHistorySnapshots.count,
    0,
  );
  assertGreater(
    report.createdFiles.byPathClassification
      .meshInventoryHistorySnapshots.bytes,
    0,
  );
});

Deno.test("pending-heavy generator adds deterministic per-term content", async () => {
  const meshRoot = await createTestTmpDir(
    "weave-pending-heavy-content-",
  );
  const generated = await generatePendingHeavyMesh({
    outputPath: meshRoot,
    count: 2,
    meshInventoryHistoryPolicy: "current-only",
    termContentBytes: 128,
  });
  assertEquals(generated.termContentBytes, 128);

  const source = await Deno.readTextFile(join(meshRoot, "source.ttl"));
  assert(
    source.includes(
      `schema:description "Term 000001:${"x".repeat(116)}"`,
    ),
  );
  assert(
    source.includes(
      `schema:description "Term 000002:${"x".repeat(116)}"`,
    ),
  );

  const enabled = await runValidate(meshRoot, "1");
  assert(enabled.output.success, enabled.stderr);
  assertEquals(parseMemoryStats(enabled.stderr).planningLoopIterations, 2);
});

async function runValidate(
  meshRoot: string,
  memoryStatsValue: string,
  exposeGc = false,
): Promise<{ output: Deno.CommandOutput; stderr: string }> {
  const output = await new Deno.Command(Deno.execPath(), {
    args: [
      "run",
      ...(exposeGc ? ["--v8-flags=--expose-gc"] : []),
      "-A",
      cliEntrypoint,
      "validate",
      "mesh",
      "--mesh-root",
      meshRoot,
    ],
    cwd: repoRoot,
    env: { WEAVE_MEMORY_STATS: memoryStatsValue },
    stdout: "piped",
    stderr: "piped",
  }).output();
  return {
    output,
    stderr: new TextDecoder().decode(output.stderr),
  };
}

async function generateAndMeasureCandidateSourceRetention(
  count: number,
  termContentBytes: number,
): Promise<{ report: RuntimeMemoryStatsReport; sourceBytes: number }> {
  const meshRoot = await createTestTmpDir(
    `weave-pending-heavy-proportionality-${count}-`,
  );
  await generatePendingHeavyMesh({
    outputPath: meshRoot,
    count,
    meshInventoryHistoryPolicy: "current-only",
    termContentBytes,
  });
  const sourceBytes = (await Deno.stat(join(meshRoot, "source.ttl"))).size;
  const validated = await runValidate(meshRoot, "1");
  assert(validated.output.success, validated.stderr);
  return { report: parseMemoryStats(validated.stderr), sourceBytes };
}

function parseMemoryStats(stderr: string): RuntimeMemoryStatsReport {
  const prefix = "[memory-stats] ";
  const line = stderr.split("\n").find((candidate) =>
    candidate.startsWith(prefix)
  );
  assert(line !== undefined, stderr);
  return JSON.parse(line.slice(prefix.length)) as RuntimeMemoryStatsReport;
}
