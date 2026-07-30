import { assert, assertEquals, assertGreater } from "@std/assert";
import { fromFileUrl, join } from "@std/path";
import {
  generatePendingHeavyMesh,
} from "../../scripts/generate-pending-heavy-mesh.ts";
import type { RuntimeMemoryStatsReport } from "../../src/runtime/weave/memory_stats.ts";
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
  assertGreater(currentReport.maxRssBytes, 0);
  assertGreater(currentReport.v8Heap.usedHeapSize, 0);
  assertGreater(currentReport.v8Heap.heapSizeLimit, 0);
  assertEquals(
    currentReport.createdFiles.byPathClassification
      .meshInventoryHistorySnapshots.count,
    0,
  );

  const disabled = await runValidate(currentOnlyRoot, "0");
  assert(disabled.output.success, disabled.stderr);
  assertEquals(disabled.stderr.includes("[memory-stats]"), false);
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

async function runValidate(
  meshRoot: string,
  memoryStatsValue: string,
): Promise<{ output: Deno.CommandOutput; stderr: string }> {
  const output = await new Deno.Command(Deno.execPath(), {
    args: [
      "run",
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

function parseMemoryStats(stderr: string): RuntimeMemoryStatsReport {
  const prefix = "[memory-stats] ";
  const line = stderr.split("\n").find((candidate) =>
    candidate.startsWith(prefix)
  );
  assert(line !== undefined, stderr);
  return JSON.parse(line.slice(prefix.length)) as RuntimeMemoryStatsReport;
}
