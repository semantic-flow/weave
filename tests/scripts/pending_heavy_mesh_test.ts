import {
  assert,
  assertEquals,
  assertGreater,
  assertRejects,
  assertStrictEquals,
} from "@std/assert";
import { fromFileUrl, join, relative } from "@std/path";
import {
  generatePendingHeavyMesh,
} from "../../scripts/generate-pending-heavy-mesh.ts";
import { normalizeVersionRequest } from "../../src/runtime/weave/request_normalization.ts";
import {
  executeGenerate,
  executeVersion,
} from "../../src/runtime/weave/weave.ts";
import type { RuntimeMemoryStatsReport } from "../../src/runtime/weave/memory_stats.ts";
import { loadOperationalLocalPathPolicy } from "../../src/runtime/operational/local_path_policy.ts";
import { loadWeaveableKnopCandidates } from "../../src/runtime/weave/candidate_loader.ts";
import { loadMeshState } from "../../src/runtime/weave/mesh_state.ts";
import {
  applyPlannedFilesToOverlay,
  TextFileOverlay,
} from "../../src/runtime/weave/planning_context.ts";
import { prepareVersionExecution } from "../../src/runtime/weave/version_execution.ts";
import type {
  RuntimeTiming,
  RuntimeTimingField,
} from "../../src/runtime/timing.ts";
import {
  hasNamedNodeFact,
  parseWeaveShapeQuads,
} from "../../src/core/weave/rdf_helpers.ts";
import { SFLO_NAMESPACE } from "../../src/core/rdf/namespaces.ts";
import { createTestTmpDir } from "../support/test_tmp.ts";

const repoRoot = fromFileUrl(new URL("../../", import.meta.url));
const cliEntrypoint = join(repoRoot, "src/main.ts");
const sfloHasResourcePageIri = `${SFLO_NAMESPACE}hasResourcePage`;

Deno.test("untargeted extracted candidates use one instrumented coherent batch and regenerate byte-stably", async () => {
  const meshRoot = await createTestTmpDir(
    "weave-pending-heavy-extracted-batch-",
  );
  const generated = await generatePendingHeavyMesh({
    outputPath: meshRoot,
    count: 3,
    meshInventoryHistoryPolicy: "versioned",
    sourceDesignatorPath: "catalog/source",
  });
  const meshState = await loadMeshState(meshRoot);
  const localPathPolicy = await loadOperationalLocalPathPolicy(meshRoot);
  const pendingBefore = await loadWeaveableKnopCandidates(
    meshRoot,
    localPathPolicy,
    meshState.meshBase,
    meshState.currentMeshInventoryTurtle,
    [],
    new Map(),
    new TextFileOverlay(),
  );
  const sourceArtifact = pendingBefore[0]!
    .referenceTargetSourcePayloadArtifact!;
  const protectedSourcePaths = [
    sourceArtifact.workingLocalRelativePath,
    sourceArtifact.latestHistoricalSnapshotPath!,
  ];
  const sourceDigestsBefore = await digestWorkspacePaths(
    meshRoot,
    protectedSourcePaths,
  );

  const timing = new RecordingRuntimeTiming();
  const prepared = await prepareVersionExecution(
    meshRoot,
    [],
    localPathPolicy,
    false,
    undefined,
    undefined,
    timing,
  );

  assertEquals(
    timing.fields.get("payloadBatchCandidates"),
    generated.count,
  );
  assertEquals(
    prepared.plan.versionedDesignatorPaths,
    generated.extractedDesignatorPaths,
  );
  assertEquals(
    prepared.plan.createdFiles.filter((file) =>
      /^_mesh\/_inventory\/_history[^/]+\/_s[^/]+\/ttl\/inventory\.ttl$/
        .test(file.path)
    ).length,
    1,
  );
  assertEquals(
    prepared.plan.updatedFiles.filter((file) =>
      file.path === "_mesh/_inventory/inventory.ttl"
    ).length,
    1,
  );
  assertEquals(prepared.plan.regeneratedPagePaths, [
    "_mesh/_inventory/_history001/index.html",
  ]);

  const fixedNow = () => new Date("2026-08-06T12:00:00.000Z");
  const woven = await executeVersion({ meshRoot });
  assertEquals(
    woven.versionedDesignatorPaths,
    generated.extractedDesignatorPaths,
  );
  assertEquals(
    await digestWorkspacePaths(meshRoot, protectedSourcePaths),
    sourceDigestsBefore,
  );

  const wovenMeshState = await loadMeshState(meshRoot);
  const pendingAfter = await loadWeaveableKnopCandidates(
    meshRoot,
    localPathPolicy,
    wovenMeshState.meshBase,
    wovenMeshState.currentMeshInventoryTurtle,
    [],
    new Map(),
    new TextFileOverlay(),
  );
  assertEquals(pendingAfter, []);
  const meshInventoryQuads = parseWeaveShapeQuads(
    wovenMeshState.meshBase,
    wovenMeshState.currentMeshInventoryTurtle,
    "Could not parse woven pending-heavy MeshInventory.",
  );
  for (const designatorPath of generated.extractedDesignatorPaths) {
    assert(
      hasNamedNodeFact(
        meshInventoryQuads,
        wovenMeshState.meshBase,
        designatorPath,
        sfloHasResourcePageIri,
        `${designatorPath}/index.html`,
      ),
      `Missing canonical ResourcePage claim for ${designatorPath}.`,
    );
    assert(
      hasNamedNodeFact(
        meshInventoryQuads,
        wovenMeshState.meshBase,
        `${designatorPath}/_knop`,
        sfloHasResourcePageIri,
        `${designatorPath}/_knop/index.html`,
      ),
      `Missing canonical Knop ResourcePage claim for ${designatorPath}.`,
    );
  }

  const meshInventoryHistoryIndexPath =
    "_mesh/_inventory/_history001/index.html";
  const historyIndexDigestAfterVersion = await sha256(
    await Deno.readFile(join(meshRoot, meshInventoryHistoryIndexPath)),
  );
  const generatedAfterVersion = await executeGenerate({
    meshRoot,
    now: fixedNow,
  });
  assertEquals(
    generatedAfterVersion.updatedPaths.filter((path) =>
      path === meshInventoryHistoryIndexPath
    ),
    [],
  );
  assertEquals(
    await sha256(
      await Deno.readFile(join(meshRoot, meshInventoryHistoryIndexPath)),
    ),
    historyIndexDigestAfterVersion,
  );

  const workspaceDigestsBeforeRegenerate = await digestWorkspaceFiles(
    meshRoot,
  );
  const generatedAgain = await executeGenerate({ meshRoot, now: fixedNow });
  assertEquals(generatedAgain.createdPaths, []);
  assertEquals(generatedAgain.updatedPaths, []);
  assertEquals(
    await digestWorkspaceFiles(meshRoot),
    workspaceDigestsBeforeRegenerate,
  );
});

Deno.test("sequential extracted versions regenerate a named MeshInventory history index from settled states", async () => {
  const meshRoot = await createTestTmpDir(
    "weave-pending-heavy-sequential-history-index-",
  );
  const generated = await generatePendingHeavyMesh({
    outputPath: meshRoot,
    count: 4,
    meshInventoryHistoryPolicy: "versioned",
    sourceDesignatorPath: "catalog/source",
  });

  for (const designatorPath of generated.extractedDesignatorPaths.slice(0, 3)) {
    await executeVersion({
      meshRoot,
      request: { targets: [{ designatorPath }] },
    });
  }

  const metadataPath = join(meshRoot, "_mesh/_meta/meta.ttl");
  const metadataBeforeNamedProgression = await Deno.readTextFile(metadataPath);
  const metadataWithNamedProgression = metadataBeforeNamedProgression
    .replace(
      "@prefix sflo: <https://semantic-flow.github.io/sflo/ontology/> .",
      `@prefix sflo: <https://semantic-flow.github.io/sflo/ontology/> .
@prefix sfcfg: <https://semantic-flow.github.io/sflo/config/> .`,
    )
    .replace(
      '  sflo:nextStateOrdinal "6"^^xsd:nonNegativeInteger .',
      `  sflo:nextStateOrdinal "6"^^xsd:nonNegativeInteger ;
  sfcfg:hasNextStateSegmentHint "release-6" .`,
    );
  assert(
    metadataWithNamedProgression !== metadataBeforeNamedProgression,
    metadataBeforeNamedProgression,
  );
  await Deno.writeTextFile(metadataPath, metadataWithNamedProgression);

  const finalDesignatorPath = generated.extractedDesignatorPaths[3]!;
  const localPathPolicy = await loadOperationalLocalPathPolicy(meshRoot);
  const timing = new RecordingRuntimeTiming();
  const prepared = await prepareVersionExecution(
    meshRoot,
    normalizeVersionRequest({
      targets: [{ designatorPath: finalDesignatorPath }],
    }).targets,
    localPathPolicy,
    false,
    undefined,
    undefined,
    timing,
  );
  assertEquals(timing.phaseCount("prepare.planPayloadBatch"), 0);
  assertEquals(timing.phaseCount("prepare.loop.planVersion"), 1);

  const versioned = await executeVersion({
    meshRoot,
    request: { targets: [{ designatorPath: finalDesignatorPath }] },
  });
  const historyIndexPath = "_mesh/_inventory/_history001/index.html";
  const historyIndexAbsolutePath = join(meshRoot, historyIndexPath);
  const historyIndex = await Deno.readTextFile(historyIndexAbsolutePath);
  const pageStateSegments = [
    ...historyIndex.matchAll(
      /<summary class="wf-history-node-header"><a href="[^"]+\/_history001\/([^"/]+)">([^<]+)<\/a><\/summary>/g,
    ),
  ].filter((match) => match[1] === match[2]).map((match) => match[1]!).sort();
  const diskStateSegments: string[] = [];
  for await (
    const entry of Deno.readDir(
      join(meshRoot, "_mesh/_inventory/_history001"),
    )
  ) {
    if (entry.isDirectory) {
      diskStateSegments.push(entry.name);
    }
  }
  diskStateSegments.sort();

  assertEquals(pageStateSegments, diskStateSegments);
  assertEquals(pageStateSegments, [
    "_s0001",
    "_s0002",
    "_s0003",
    "_s0004",
    "_s0005",
    "release-6",
  ]);
  assertEquals(prepared.plan.regeneratedPagePaths, [historyIndexPath]);
  assert(versioned.updatedPaths.includes(historyIndexPath));

  const digestAfterVersion = await sha256(
    await Deno.readFile(historyIndexAbsolutePath),
  );
  const generatedAfterVersion = await executeGenerate({
    meshRoot,
    now: () => new Date("2026-08-07T12:00:00.000Z"),
  });
  assertEquals(
    generatedAfterVersion.updatedPaths.filter((path) =>
      path === historyIndexPath
    ),
    [],
  );
  assertEquals(
    await sha256(await Deno.readFile(historyIndexAbsolutePath)),
    digestAfterVersion,
  );
});

Deno.test("untargeted multi-candidate extracted batch restructures a current-only MeshInventory once", async () => {
  const meshRoot = await createTestTmpDir(
    "weave-pending-heavy-current-only-extracted-batch-",
  );
  const generated = await generatePendingHeavyMesh({
    outputPath: meshRoot,
    count: 3,
    meshInventoryHistoryPolicy: "current-only",
    sourceDesignatorPath: "catalog/source",
  });
  const localPathPolicy = await loadOperationalLocalPathPolicy(meshRoot);
  const timing = new RecordingRuntimeTiming();
  const prepared = await prepareVersionExecution(
    meshRoot,
    [],
    localPathPolicy,
    false,
    undefined,
    undefined,
    timing,
  );

  assertEquals(
    timing.fields.get("payloadBatchCandidates"),
    generated.count,
  );
  assertEquals(timing.phaseCount("prepare.planPayloadBatch"), 1);
  assertEquals(timing.phaseCount("prepare.loop.planVersion"), 0);
  assertEquals(prepared.plan.versionedDesignatorPaths, [
    "term-000001",
    "term-000002",
    "term-000003",
  ]);
  assertEquals(prepared.plan.createdFiles, []);
  assertEquals(prepared.plan.regeneratedPagePaths, undefined);

  const meshInventoryUpdates = prepared.plan.updatedFiles.filter((file) =>
    file.path === "_mesh/_inventory/inventory.ttl"
  );
  assertEquals(meshInventoryUpdates.length, 1);
  const meshInventory = meshInventoryUpdates[0]!.contents;
  assert(
    meshInventory.includes(
      `<_mesh/_inventory> a sflo:MeshInventory, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasWorkingLocatedFile <_mesh/_inventory/inventory.ttl> ;
  sflo:hasResourcePage <_mesh/_inventory/index.html> .`,
    ),
    meshInventory,
  );
  assertEquals(meshInventory.includes("_mesh/_inventory/_history"), false);
  for (const designatorPath of generated.extractedDesignatorPaths) {
    assert(
      meshInventory.includes(
        `<${designatorPath}/_knop> a sflo:Knop ;
  sflo:hasWorkingKnopInventoryFile <${designatorPath}/_knop/_inventory/inventory.ttl> ;
  sflo:hasResourcePage <${designatorPath}/_knop/index.html> .`,
      ),
      `Missing restructured current-only Knop block for ${designatorPath}.`,
    );
  }
});

Deno.test("mixed and recursive extracted candidate sets retain sequential planning", async () => {
  const mixedRoot = await createTestTmpDir(
    "weave-pending-heavy-mixed-sequential-",
  );
  await generatePendingHeavyMesh({
    outputPath: mixedRoot,
    count: 2,
    meshInventoryHistoryPolicy: "current-only",
    sourceDesignatorPath: "catalog/source",
  });
  await Deno.writeTextFile(
    join(mixedRoot, "source.ttl"),
    `${await Deno.readTextFile(
      join(mixedRoot, "source.ttl"),
    )}\n<catalog/source> <https://schema.org/version> "2" .\n`,
  );
  const mixedTiming = new RecordingRuntimeTiming();
  const mixedPolicy = await loadOperationalLocalPathPolicy(mixedRoot);
  await prepareVersionExecution(
    mixedRoot,
    [],
    mixedPolicy,
    false,
    undefined,
    undefined,
    mixedTiming,
  );
  assertEquals(mixedTiming.phaseCount("prepare.planPayloadBatch"), 0);
  assertEquals(mixedTiming.phaseCount("prepare.loop.planVersion"), 3);

  const recursiveRoot = await createTestTmpDir(
    "weave-pending-heavy-recursive-sequential-",
  );
  await generatePendingHeavyMesh({
    outputPath: recursiveRoot,
    count: 2,
    meshInventoryHistoryPolicy: "current-only",
    sourceDesignatorPath: "catalog/source",
  });
  const recursiveTiming = new RecordingRuntimeTiming();
  const recursivePolicy = await loadOperationalLocalPathPolicy(recursiveRoot);
  const recursiveTargets = normalizeVersionRequest({
    targets: [{ designatorPath: "", recursive: true }],
  }).targets;
  await prepareVersionExecution(
    recursiveRoot,
    recursiveTargets,
    recursivePolicy,
    false,
    undefined,
    undefined,
    recursiveTiming,
  );
  assertEquals(recursiveTiming.phaseCount("prepare.planPayloadBatch"), 0);
  assertEquals(recursiveTiming.phaseCount("prepare.loop.planVersion"), 2);
});

Deno.test("pending-heavy generator enters the instrumented coherent batch path", async () => {
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
  assertEquals(currentReport.planningLoopIterations, 0);
  assertEquals(currentReport.createdFiles.count, 0);
  assertEquals(currentReport.createdFiles.bytes, 0);
  assertGreater(currentReport.updatedFileByPath.count, 0);
  assertGreater(currentReport.updatedFileByPath.bytes, 0);
  assertEquals(currentReport.overlayStaged.entries, 0);
  assertEquals(currentReport.overlayStaged.bytes, 0);
  assertGreater(currentReport.readCache.entries, 0);
  assertGreater(currentReport.readCache.bytes, 0);
  assertGreater(currentReport.readCache.hits, 0);
  assertGreater(currentReport.candidateCache.entries, 0);
  assertGreater(currentReport.candidateCache.approximateRetainedBytes, 0);
  assertGreater(currentReport.candidateCache.stores, 0);
  assertEquals(currentReport.candidateCache.invalidations, 0);
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
  assertEquals(gcReport.planningLoopIterations, 0);
  assertGreater(gcReport.v8Heap.usedHeapSize, 0);
  assertGreater(gcReport.v8Heap.postGcUsedHeapSize!, 0);

  const disabled = await runValidate(currentOnlyRoot, "0");
  assert(disabled.output.success, disabled.stderr);
  assertEquals(disabled.stderr.includes("[memory-stats]"), false);
});

Deno.test("pending-heavy generator preserves a nested source without an ancestor Knop", async () => {
  const meshRoot = await createTestTmpDir(
    "weave-pending-heavy-nested-source-",
  );
  const options = {
    outputPath: meshRoot,
    count: 3,
    meshInventoryHistoryPolicy: "current-only" as const,
    sourceDesignatorPath: "catalog/source",
  };
  const generated = await generatePendingHeavyMesh(options);

  assertEquals(generated.sourceDesignatorPath, "catalog/source");
  assertEquals(generated.extractedDesignatorPaths, [
    "term-000001",
    "term-000002",
    "term-000003",
  ]);
  assert(
    (await Deno.stat(
      join(
        meshRoot,
        "catalog/source/_knop/_inventory/inventory.ttl",
      ),
    )).isFile,
  );
  await assertRejects(
    () => Deno.stat(join(meshRoot, "catalog/_knop")),
    Deno.errors.NotFound,
  );

  const meshInventoryTurtle = await Deno.readTextFile(
    join(meshRoot, "_mesh/_inventory/inventory.ttl"),
  );
  assertEquals(
    meshInventoryTurtle.includes("catalog/_knop"),
    false,
    meshInventoryTurtle,
  );

  const meshState = await loadMeshState(meshRoot);
  const localPathPolicy = await loadOperationalLocalPathPolicy(meshRoot);
  const candidates = await loadWeaveableKnopCandidates(
    meshRoot,
    localPathPolicy,
    meshState.meshBase,
    meshState.currentMeshInventoryTurtle,
    [],
    new Map(),
    new TextFileOverlay(),
  );
  assertEquals(
    candidates.map((candidate) => candidate.designatorPath),
    generated.extractedDesignatorPaths,
  );
  for (const candidate of candidates) {
    assertEquals(
      candidate.referenceTargetSourcePayloadArtifact?.designatorPath,
      "catalog/source",
    );
  }
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
  assertEquals(report.planningLoopIterations, 0);
  assertEquals(
    report.createdFiles.byPathClassification
      .meshInventoryHistorySnapshots.count,
    1,
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
  assertEquals(parseMemoryStats(enabled.stderr).planningLoopIterations, 0);
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

class RecordingRuntimeTiming implements RuntimeTiming {
  readonly enabled = true;
  readonly fields = new Map<string, RuntimeTimingField>();
  readonly #phaseCounts = new Map<string, number>();

  setField(key: string, value: RuntimeTimingField): void {
    this.fields.set(key, value);
  }

  async time<T>(phase: string, operation: () => Promise<T>): Promise<T> {
    this.#recordPhase(phase);
    return await operation();
  }

  timeSync<T>(phase: string, operation: () => T): T {
    this.#recordPhase(phase);
    return operation();
  }

  finish(_fields?: Record<string, RuntimeTimingField>): void {
  }

  phaseCount(phase: string): number {
    return this.#phaseCounts.get(phase) ?? 0;
  }

  #recordPhase(phase: string): void {
    this.#phaseCounts.set(phase, this.phaseCount(phase) + 1);
  }
}

async function digestWorkspacePaths(
  workspaceRoot: string,
  paths: readonly string[],
): Promise<Map<string, string>> {
  const digests = new Map<string, string>();
  for (const path of paths) {
    digests.set(
      path,
      await sha256(await Deno.readFile(join(workspaceRoot, path))),
    );
  }
  return digests;
}

async function digestWorkspaceFiles(
  workspaceRoot: string,
): Promise<Map<string, string>> {
  const digests = new Map<string, string>();
  for (const absolutePath of await listWorkspaceFiles(workspaceRoot)) {
    const path = relative(workspaceRoot, absolutePath).replaceAll("\\", "/");
    digests.set(path, await sha256(await Deno.readFile(absolutePath)));
  }
  return digests;
}

async function sha256(bytes: Uint8Array): Promise<string> {
  const digestInput = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(digestInput).set(bytes);
  const digest = await crypto.subtle.digest("SHA-256", digestInput);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function listWorkspaceFiles(root: string): Promise<string[]> {
  const files: string[] = [];
  const directories = [root];
  while (directories.length > 0) {
    const directory = directories.pop()!;
    for await (const entry of Deno.readDir(directory)) {
      const path = join(directory, entry.name);
      if (entry.isDirectory) {
        directories.push(path);
      } else if (entry.isFile) {
        files.push(path);
      }
    }
  }
  return files.sort();
}
