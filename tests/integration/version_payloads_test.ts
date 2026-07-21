import { assert, assertEquals, assertRejects } from "@std/assert";
import { dirname, fromFileUrl, join } from "@std/path";
import {
  versionPayloadsForTesting,
  writeCombinedPlanForTesting,
} from "../../src/api/version_payloads.ts";
import { versionPayloads, WeaveApiError } from "../../src/mod.ts";
import { materializeMeshAliceBioBranch } from "../support/mesh_alice_bio_fixture.ts";
import {
  integrateRootPayload,
  ROOT_PAYLOAD_TURTLE_V2,
} from "../support/root_designator.ts";
import { createTestTmpDir } from "../support/test_tmp.ts";

const meshBase = "https://example.test/version-api/";
const cliEntrypoint = fromFileUrl(
  new URL("../../src/main.ts", import.meta.url),
);

interface PayloadTargetFixture {
  designatorPath: string;
  label: string;
  latestOrdinal: number;
}

const coreTarget: PayloadTargetFixture = {
  designatorPath: "rules/core",
  label: "Core rules",
  latestOrdinal: 1,
};
const shaclTarget: PayloadTargetFixture = {
  designatorPath: "rules/shacl",
  label: "SHACL rules",
  latestOrdinal: 2,
};

Deno.test("versionPayloads defeats old single-target settled refusal with applied then alreadyCurrent retry", async () => {
  const meshRoot = await createTestTmpDir("weave-version-api-single-");
  await materializePayloadMesh(meshRoot, [coreTarget]);
  const bytes = payloadBytes(coreTarget, 2);

  const applied = await versionPayloads({
    meshRoot,
    items: [{ designatorPath: coreTarget.designatorPath, bytes }],
  });

  assertEquals(applied.outcomes, [{
    status: "applied",
    designatorPath: coreTarget.designatorPath,
    payloadArtifactIri: `${meshBase}${coreTarget.designatorPath}`,
    historySegment: "_history001",
    stateSegment: "_s0002",
    manifestationSegment: "ttl",
    snapshotPath:
      `${coreTarget.designatorPath}/_history001/_s0002/ttl/core.ttl`,
  }]);
  assertEquals(
    await Deno.readFile(join(meshRoot, `${coreTarget.designatorPath}.ttl`)),
    bytes,
  );
  assertEquals(
    await Deno.readFile(join(meshRoot, applied.outcomes[0]!.snapshotPath)),
    bytes,
  );
  assertEquals(applied.updatedPaths[0], `${coreTarget.designatorPath}.ttl`);

  const retry = await versionPayloads({
    meshRoot,
    items: [{ designatorPath: coreTarget.designatorPath, bytes }],
  });
  assertEquals(retry.outcomes[0]?.status, "alreadyCurrent");
  assertEquals(retry.createdPaths, []);
  assertEquals(retry.updatedPaths, []);
});

Deno.test("versionPayloads plans a deterministic coherent multi-item batch and no-op rerun", async () => {
  const meshRoot = await createTestTmpDir("weave-version-api-batch-");
  await materializePayloadMesh(meshRoot, [shaclTarget, coreTarget]);
  const request = {
    meshRoot,
    items: [
      {
        designatorPath: shaclTarget.designatorPath,
        bytes: payloadBytes(shaclTarget, 3),
      },
      {
        designatorPath: coreTarget.designatorPath,
        bytes: payloadBytes(coreTarget, 2),
      },
    ],
  };

  const applied = await versionPayloads(request);
  assertEquals(
    applied.outcomes.map((outcome) => [outcome.designatorPath, outcome.status]),
    [
      [coreTarget.designatorPath, "applied"],
      [shaclTarget.designatorPath, "applied"],
    ],
  );
  const beforeRetry = await snapshotWorkspace(meshRoot);
  const retry = await versionPayloads(request);
  assertEquals(
    retry.outcomes.map((outcome) => outcome.status),
    ["alreadyCurrent", "alreadyCurrent"],
  );
  assertEquals(retry.createdPaths, []);
  assertEquals(retry.updatedPaths, []);
  assertEquals(await snapshotWorkspace(meshRoot), beforeRetry);
});

Deno.test("versionPayloads cardinality-one adapter is byte-equivalent to the same member in a coherent batch", async () => {
  const singleRoot = await createTestTmpDir(
    "weave-version-api-cardinality-one-",
  );
  const batchRoot = await createTestTmpDir(
    "weave-version-api-cardinality-many-",
  );
  await materializePayloadMesh(singleRoot, [coreTarget]);
  await materializePayloadMesh(batchRoot, [coreTarget, shaclTarget]);

  const single = await versionPayloads({
    meshRoot: singleRoot,
    items: [{
      designatorPath: coreTarget.designatorPath,
      bytes: payloadBytes(coreTarget, 2),
    }],
  });
  await versionPayloads({
    meshRoot: batchRoot,
    items: [
      {
        designatorPath: coreTarget.designatorPath,
        bytes: payloadBytes(coreTarget, 2),
      },
      {
        designatorPath: shaclTarget.designatorPath,
        bytes: payloadBytes(shaclTarget, 3),
      },
    ],
  });

  await assertWorkspacePathsEqual(
    singleRoot,
    batchRoot,
    single.createdPaths.filter((path) => path.startsWith("rules/core/"))
      .concat(
        single.updatedPaths.filter((path) =>
          path === "rules/core.ttl" || path.startsWith("rules/core/")
        ),
      ),
  );
});

Deno.test("versionPayloads maps the public slash root designator to a real root payload transition", async () => {
  const meshRoot = await createTestTmpDir("weave-version-api-root-");
  await materializeMeshAliceBioBranch(
    "05-alice-knop-created-woven",
    meshRoot,
  );
  await integrateRootPayload(meshRoot);
  const bytes = new TextEncoder().encode(ROOT_PAYLOAD_TURTLE_V2);

  const result = await versionPayloads({
    meshRoot,
    historyTrackingPolicyOverride: "versioned",
    items: [{ designatorPath: "/", bytes }],
  });

  assertEquals(result.outcomes[0]?.designatorPath, "/");
  assertEquals(result.outcomes[0]?.payloadArtifactIri.endsWith("/"), true);
  assertEquals(
    result.outcomes[0]?.snapshotPath,
    "_history001/_s0001/ttl/root.ttl",
  );
  assertEquals(await Deno.readFile(join(meshRoot, "root.ttl")), bytes);
  assertEquals(
    await Deno.readFile(join(meshRoot, result.outcomes[0]!.snapshotPath)),
    bytes,
  );
});

Deno.test("versionPayloads whole-request refusal defeats sequential partial mutation when one batch member is malformed", async () => {
  const meshRoot = await createTestTmpDir("weave-version-api-refusal-");
  await materializePayloadMesh(meshRoot, [coreTarget, shaclTarget]);
  const inventoryPath = join(
    meshRoot,
    `${shaclTarget.designatorPath}/_knop/_inventory/inventory.ttl`,
  );
  await Deno.writeTextFile(
    inventoryPath,
    (await Deno.readTextFile(inventoryPath)).replace(
      `  sflo:latestHistoricalState <${shaclTarget.designatorPath}/_history001/_s0002> ;\n`,
      "",
    ),
  );
  const before = await snapshotWorkspace(meshRoot);

  const error = await assertRejects(
    () =>
      versionPayloads({
        meshRoot,
        items: [
          {
            designatorPath: coreTarget.designatorPath,
            bytes: payloadBytes(coreTarget, 2),
          },
          {
            designatorPath: shaclTarget.designatorPath,
            bytes: payloadBytes(shaclTarget, 3),
          },
        ],
      }),
    WeaveApiError,
  );
  assertEquals(error.stage, "load");
  assertEquals(error.code, "malformed-mesh");
  assertEquals(await snapshotWorkspace(meshRoot), before);
});

Deno.test("versionPayloads overwrites only an explicitly named current single-item state", async () => {
  const meshRoot = await createTestTmpDir("weave-version-api-overwrite-");
  await materializePayloadMesh(meshRoot, [coreTarget]);
  await versionPayloads({
    meshRoot,
    items: [{
      designatorPath: coreTarget.designatorPath,
      bytes: payloadBytes(coreTarget, 2),
    }],
  });
  const overwrittenBytes = new TextEncoder().encode(
    payloadText(coreTarget, 2).replace("Core rules", "Corrected core rules"),
  );

  const result = await versionPayloads({
    meshRoot,
    overwriteExistingState: true,
    items: [{
      designatorPath: coreTarget.designatorPath,
      bytes: overwrittenBytes,
      historySegment: "_history001",
      stateSegment: "_s0002",
    }],
  });

  assertEquals(result.outcomes[0]?.status, "applied");
  assertEquals(result.outcomes[0]?.snapshotPath, snapshotPath(coreTarget, 2));
  assertEquals(result.createdPaths, []);
  assertEquals(
    await Deno.readFile(join(meshRoot, snapshotPath(coreTarget, 2))),
    overwrittenBytes,
  );
  assertEquals(
    await Deno.readFile(join(meshRoot, `${coreTarget.designatorPath}.ttl`)),
    overwrittenBytes,
  );
});

Deno.test("versionPayloads refuses repository/floating payload sources at LOAD", async () => {
  const meshRoot = await createTestTmpDir("weave-version-api-floating-");
  await materializePayloadMesh(meshRoot, [coreTarget]);
  const inventoryPath = join(
    meshRoot,
    `${coreTarget.designatorPath}/_knop/_inventory/inventory.ttl`,
  );
  await Deno.writeTextFile(
    inventoryPath,
    (await Deno.readTextFile(inventoryPath)).replace(
      `  sflo:hasWorkingLocatedFile <${coreTarget.designatorPath}.ttl> .`,
      `  sflo:hasRepositorySourceFloatingLocator [
    a sflo:RepositorySourceFloatingLocator ;
    sflo:sourceRepositoryUrl "https://example.test/rules.git" ;
    sflo:sourceRepositoryPathFromRoot "rules/core.ttl"
  ] .`,
    ),
  );
  const before = await snapshotWorkspace(meshRoot);

  const error = await assertRejects(
    () =>
      versionPayloads({
        meshRoot,
        items: [{
          designatorPath: coreTarget.designatorPath,
          bytes: payloadBytes(coreTarget, 2),
        }],
      }),
    WeaveApiError,
  );
  assertEquals([error.code, error.stage], ["unsupported-source", "load"]);
  assertEquals(await snapshotWorkspace(meshRoot), before);
});

Deno.test("versionPayloads refuses non-text working content and zero-length text at LOAD", async () => {
  const binaryRoot = await createTestTmpDir("weave-version-api-binary-");
  await materializePayloadMesh(binaryRoot, [coreTarget]);
  const inventoryPath = join(
    binaryRoot,
    `${coreTarget.designatorPath}/_knop/_inventory/inventory.ttl`,
  );
  await Deno.writeTextFile(
    inventoryPath,
    (await Deno.readTextFile(inventoryPath)).replaceAll(
      `${coreTarget.designatorPath}.ttl`,
      `${coreTarget.designatorPath}.bin`,
    ),
  );
  await Deno.rename(
    join(binaryRoot, `${coreTarget.designatorPath}.ttl`),
    join(binaryRoot, `${coreTarget.designatorPath}.bin`),
  );

  const binaryError = await assertRejects(
    () =>
      versionPayloads({
        meshRoot: binaryRoot,
        items: [{
          designatorPath: coreTarget.designatorPath,
          bytes: payloadBytes(coreTarget, 2),
        }],
      }),
    WeaveApiError,
  );
  assertEquals(
    [binaryError.code, binaryError.stage],
    ["unsupported-content", "load"],
  );

  const emptyRoot = await createTestTmpDir("weave-version-api-empty-");
  await materializePayloadMesh(emptyRoot, [coreTarget]);
  const emptyError = await assertRejects(
    () =>
      versionPayloads({
        meshRoot: emptyRoot,
        items: [{
          designatorPath: coreTarget.designatorPath,
          bytes: new Uint8Array(),
        }],
      }),
    WeaveApiError,
  );
  assertEquals(
    [emptyError.code, emptyError.stage],
    ["unsupported-content", "load"],
  );
});

Deno.test("versionPayloads single-item output is byte-identical to the CLI update-plus-version path", async () => {
  const apiRoot = await createTestTmpDir("weave-version-api-cli-single-api-");
  const cliRoot = await createTestTmpDir("weave-version-api-cli-single-cli-");
  await materializePayloadMesh(apiRoot, [coreTarget]);
  await materializePayloadMesh(cliRoot, [coreTarget]);
  const items = [{
    designatorPath: coreTarget.designatorPath,
    bytes: payloadBytes(coreTarget, 2),
  }];

  const apiResult = await versionPayloads({ meshRoot: apiRoot, items });
  await runCliTwoStep(cliRoot, items);
  await assertWorkspacePathsEqual(
    apiRoot,
    cliRoot,
    [...apiResult.createdPaths, ...apiResult.updatedPaths],
  );
});

Deno.test("versionPayloads multi-item output is byte-identical to the CLI update-plus-version batch", async () => {
  const apiRoot = await createTestTmpDir("weave-version-api-cli-batch-api-");
  const cliRoot = await createTestTmpDir("weave-version-api-cli-batch-cli-");
  await materializePayloadMesh(apiRoot, [coreTarget, shaclTarget]);
  await materializePayloadMesh(cliRoot, [coreTarget, shaclTarget]);
  const items = [
    {
      designatorPath: coreTarget.designatorPath,
      bytes: payloadBytes(coreTarget, 2),
    },
    {
      designatorPath: shaclTarget.designatorPath,
      bytes: payloadBytes(shaclTarget, 3),
    },
  ];

  const apiResult = await versionPayloads({ meshRoot: apiRoot, items });
  await runCliTwoStep(cliRoot, items);
  await assertWorkspacePathsEqual(
    apiRoot,
    cliRoot,
    [...apiResult.createdPaths, ...apiResult.updatedPaths],
  );
});

Deno.test("versionPayloads admitted overlay defeats post-plan disk mutation as a capture conflict", async () => {
  const meshRoot = await createTestTmpDir("weave-version-api-post-plan-");
  await materializePayloadMesh(meshRoot, [coreTarget]);
  const admittedBytes = payloadBytes(coreTarget, 2);

  const result = await versionPayloadsForTesting(
    {
      meshRoot,
      items: [{
        designatorPath: coreTarget.designatorPath,
        bytes: admittedBytes,
      }],
    },
    {
      afterPlan: async () => {
        await Deno.writeFile(
          join(meshRoot, `${coreTarget.designatorPath}.ttl`),
          payloadBytes(coreTarget, 99),
        );
      },
    },
  );

  assertEquals(result.outcomes[0]?.status, "applied");
  assertEquals(
    await Deno.readFile(join(meshRoot, `${coreTarget.designatorPath}.ttl`)),
    admittedBytes,
  );
  assertEquals(
    await Deno.readFile(join(meshRoot, result.outcomes[0]!.snapshotPath)),
    admittedBytes,
  );
});

for (const phase of ["working-update", "text-create"] as const) {
  Deno.test(`versionPayloads ${phase} failure reports completed paths and permits a narrowed explicit retry`, async () => {
    const meshRoot = await createTestTmpDir(`weave-version-api-fail-${phase}-`);
    await materializePayloadMesh(meshRoot, [coreTarget]);
    const request = {
      meshRoot,
      items: [{
        designatorPath: coreTarget.designatorPath,
        bytes: payloadBytes(coreTarget, 2),
      }],
    };

    const error = await assertRejects(
      () =>
        versionPayloadsForTesting(request, {
          beforeWrite: (candidatePhase) => {
            if (candidatePhase === phase) {
              throw new Error(`injected ${phase} failure`);
            }
          },
        }),
      WeaveApiError,
    );
    assertEquals([error.code, error.stage], ["io-failure", "write"]);
    assertEquals(
      error.completedPaths,
      phase === "working-update" ? [] : [`${coreTarget.designatorPath}.ttl`],
    );
    assertEquals(error.possiblyTouchedPaths, [error.path!]);

    const retry = await versionPayloads(request);
    assertEquals(retry.outcomes[0]?.status, "applied");
  });
}

Deno.test("versionPayloads support-update failure discloses partial paths and narrows retry to explicit repair", async () => {
  const meshRoot = await createTestTmpDir("weave-version-api-fail-support-");
  await materializePayloadMesh(meshRoot, [coreTarget]);
  const request = {
    meshRoot,
    items: [{
      designatorPath: coreTarget.designatorPath,
      bytes: payloadBytes(coreTarget, 2),
    }],
  };

  const error = await assertRejects(
    () =>
      versionPayloadsForTesting(request, {
        beforeWrite: (phase) => {
          if (phase === "support-update") {
            throw new Error("injected support update failure");
          }
        },
      }),
    WeaveApiError,
  );
  assertEquals([error.code, error.stage], ["io-failure", "write"]);
  assert(error.completedPaths?.includes(`${coreTarget.designatorPath}.ttl`));
  assert(error.completedPaths?.includes(snapshotPath(coreTarget, 2)));

  const retryError = await assertRejects(
    () => versionPayloads(request),
    WeaveApiError,
  );
  assertEquals([retryError.code, retryError.stage], ["plan-conflict", "plan"]);
});

Deno.test("versionPayloads writer reports the binary-create phase even though v1 payload admission rejects binary content", async () => {
  const meshRoot = await createTestTmpDir("weave-version-api-fail-binary-");
  await writeText(join(meshRoot, "working.txt"), "before");
  await writeText(join(meshRoot, "support.txt"), "before");
  const prepared = {
    meshState: {
      meshBase,
      currentMeshMetadataTurtle: "",
      currentMeshInventoryTurtle: "",
    },
    plan: {
      meshBase,
      versionedDesignatorPaths: [],
      createdFiles: [{ path: "created.txt", contents: "created" }],
      createdBinaryFiles: [{
        path: "created.bin",
        contents: new Uint8Array([1, 2, 3]),
      }],
      updatedFiles: [{ path: "support.txt", contents: "after" }],
    },
    candidates: [],
  };

  const error = await assertRejects(
    () =>
      writeCombinedPlanForTesting(
        meshRoot,
        [{ path: "working.txt", contents: "after" }],
        prepared,
        {
          beforeWrite: (phase) => {
            if (phase === "binary-create") {
              throw new Error("injected binary create failure");
            }
          },
        },
      ),
    WeaveApiError,
  );
  assertEquals([error.code, error.stage], ["io-failure", "write"]);
  assertEquals(error.path, "created.bin");
  assertEquals(error.completedPaths, ["working.txt", "created.txt"]);
  assertEquals(await Deno.readTextFile(join(meshRoot, "working.txt")), "after");
  assertEquals(
    await Deno.readTextFile(join(meshRoot, "created.txt")),
    "created",
  );
});

async function materializePayloadMesh(
  meshRoot: string,
  targets: readonly PayloadTargetFixture[],
): Promise<void> {
  await writeText(
    join(meshRoot, "_mesh/_meta/meta.ttl"),
    `@base <${meshBase}> .
@prefix sflo: <https://semantic-flow.github.io/sflo/ontology/> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

<_mesh> a sflo:SemanticMesh ;
  sflo:meshBase "${meshBase}"^^xsd:anyURI ;
  sflo:hasMeshMetadata <_mesh/_meta> ;
  sflo:hasMeshInventory <_mesh/_inventory> .

<_mesh/_meta> a sflo:MeshMetadata, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasWorkingLocatedFile <_mesh/_meta/meta.ttl> .

<_mesh/_inventory> a sflo:MeshInventory, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasWorkingLocatedFile <_mesh/_inventory/inventory.ttl> .
`,
  );
  await writeText(
    join(meshRoot, "_mesh/_inventory/inventory.ttl"),
    `@base <${meshBase}> .
@prefix sflo: <https://semantic-flow.github.io/sflo/ontology/> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

<_mesh> a sflo:SemanticMesh ;
  sflo:meshBase "${meshBase}"^^xsd:anyURI ;
  sflo:hasMeshMetadata <_mesh/_meta> ;
  sflo:hasMeshInventory <_mesh/_inventory> ;
  ${
      targets.map((target) => `sflo:hasKnop <${target.designatorPath}/_knop>`)
        .join(" ;\n  ")
    } .

<_mesh/_inventory> a sflo:MeshInventory, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasWorkingLocatedFile <_mesh/_inventory/inventory.ttl> .

${
      targets.map((target) =>
        `<${target.designatorPath}/_knop> a sflo:Knop ;
  sflo:hasWorkingKnopInventoryFile <${target.designatorPath}/_knop/_inventory/inventory.ttl> .`
      ).join("\n\n")
    }
`,
  );

  for (const target of targets) {
    await materializePayloadTarget(meshRoot, target);
  }
}

async function materializePayloadTarget(
  meshRoot: string,
  target: PayloadTargetFixture,
): Promise<void> {
  const { designatorPath, latestOrdinal } = target;
  const knopPath = `${designatorPath}/_knop`;
  await writeText(
    join(meshRoot, `${knopPath}/_meta/meta.ttl`),
    `@base <${meshBase}> .
@prefix sflo: <https://semantic-flow.github.io/sflo/ontology/> .

<${knopPath}> a sflo:Knop ;
  sflo:designatorPath "${designatorPath}" ;
  sflo:hasWorkingKnopInventoryFile <${knopPath}/_inventory/inventory.ttl> .
`,
  );
  await writeText(
    join(meshRoot, `${knopPath}/_inventory/inventory.ttl`),
    payloadInventoryTurtle(target),
  );
  await writeText(
    join(meshRoot, `${designatorPath}.ttl`),
    payloadText(target, latestOrdinal),
  );
  await writeText(
    join(meshRoot, `${knopPath}/_sources/sources.ttl`),
    `@base <${meshBase}> .
@prefix sflo: <https://semantic-flow.github.io/sflo/ontology/> .

<${knopPath}/_sources> a sflo:KnopSourceRegistry .
`,
  );
  await writeText(
    join(meshRoot, `${knopPath}/_references/references.ttl`),
    `@base <${meshBase}> .
@prefix sflo: <https://semantic-flow.github.io/sflo/ontology/> .

<${knopPath}/_references> a sflo:ReferenceCatalog .
`,
  );
  for (let ordinal = 1; ordinal <= latestOrdinal; ordinal += 1) {
    await writeText(
      join(meshRoot, snapshotPath(target, ordinal)),
      payloadText(target, ordinal),
    );
  }
}

function payloadInventoryTurtle(target: PayloadTargetFixture): string {
  const { designatorPath, latestOrdinal } = target;
  const knopPath = `${designatorPath}/_knop`;
  const historyPath = `${designatorPath}/_history001`;
  const fileName = `${designatorPath.split("/").at(-1)}.ttl`;
  const states = Array.from({ length: latestOrdinal }, (_, index) => {
    const ordinal = index + 1;
    const statePath = `${historyPath}/${stateSegment(ordinal)}`;
    const previous = ordinal === 1 ? "" : `
  sflo:previousHistoricalState <${historyPath}/${stateSegment(ordinal - 1)}> ;`;
    return `<${statePath}> a sflo:HistoricalState ;
  sflo:stateOrdinal "${ordinal}"^^xsd:nonNegativeInteger ;${previous}
  sflo:hasManifestation <${statePath}/ttl> ;
  sflo:locatedFileForState <${statePath}/ttl/${fileName}> .

<${statePath}/ttl> a sflo:ArtifactManifestation, sflo:RdfDocument ;
  sflo:locatedFileForManifestation <${statePath}/ttl/${fileName}> .`;
  }).join("\n\n");
  const historyStates = Array.from(
    { length: latestOrdinal },
    (_, index) =>
      `  sflo:hasHistoricalState <${historyPath}/${stateSegment(index + 1)}> ;`,
  ).join("\n");

  return `@base <${meshBase}> .
@prefix sflo: <https://semantic-flow.github.io/sflo/ontology/> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

<${knopPath}> a sflo:Knop ;
  sflo:hasKnopMetadata <${knopPath}/_meta> ;
  sflo:hasKnopInventory <${knopPath}/_inventory> ;
  sflo:hasWorkingKnopInventoryFile <${knopPath}/_inventory/inventory.ttl> ;
  sflo:hasPayloadArtifact <${designatorPath}> ;
  sflo:hasKnopSourceRegistry <${knopPath}/_sources> ;
  sflo:hasReferenceCatalog <${knopPath}/_references> ;
  sflo:hasResourcePage <${knopPath}/index.html> .

<${designatorPath}> a sflo:PayloadArtifact, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasArtifactHistory <${historyPath}> ;
  sflo:currentArtifactHistory <${historyPath}> ;
  sflo:nextHistoryOrdinal "2"^^xsd:nonNegativeInteger ;
  sflo:hasWorkingLocatedFile <${designatorPath}.ttl> .

<${historyPath}> a sflo:ArtifactHistory ;
  sflo:historyOrdinal "1"^^xsd:nonNegativeInteger ;
${historyStates}
  sflo:latestHistoricalState <${historyPath}/${stateSegment(latestOrdinal)}> ;
  sflo:nextStateOrdinal "${latestOrdinal + 1}"^^xsd:nonNegativeInteger .

${states}

<${knopPath}/_meta> a sflo:KnopMetadata, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasWorkingLocatedFile <${knopPath}/_meta/meta.ttl> .

<${knopPath}/_inventory> a sflo:KnopInventory, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasWorkingLocatedFile <${knopPath}/_inventory/inventory.ttl> ;
  sflo:hasResourcePage <${knopPath}/_inventory/index.html> .

<${knopPath}/_sources> a sflo:KnopSourceRegistry, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasWorkingLocatedFile <${knopPath}/_sources/sources.ttl> .

<${knopPath}/_references> a sflo:ReferenceCatalog, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasWorkingLocatedFile <${knopPath}/_references/references.ttl> ;
  sflo:hasResourcePage <${knopPath}/_references/index.html> .

<${designatorPath}.ttl> a sflo:LocatedFile, sflo:RdfDocument .
`;
}

function payloadText(target: PayloadTargetFixture, ordinal: number): string {
  return `@base <${meshBase}> .
@prefix dcterms: <http://purl.org/dc/terms/> .

<${target.designatorPath}> dcterms:title "${target.label} v${ordinal}" .
`;
}

function payloadBytes(
  target: PayloadTargetFixture,
  ordinal: number,
): Uint8Array {
  return new TextEncoder().encode(payloadText(target, ordinal));
}

function snapshotPath(target: PayloadTargetFixture, ordinal: number): string {
  const fileName = `${target.designatorPath.split("/").at(-1)}.ttl`;
  return `${target.designatorPath}/_history001/${
    stateSegment(ordinal)
  }/ttl/${fileName}`;
}

function stateSegment(ordinal: number): string {
  return `_s${String(ordinal).padStart(4, "0")}`;
}

async function writeText(path: string, contents: string): Promise<void> {
  await Deno.mkdir(dirname(path), { recursive: true });
  await Deno.writeTextFile(path, contents);
}

async function snapshotWorkspace(
  root: string,
): Promise<Map<string, Uint8Array>> {
  const snapshot = new Map<string, Uint8Array>();
  for (const path of await listFiles(root)) {
    snapshot.set(path, await Deno.readFile(join(root, path)));
  }
  return snapshot;
}

async function listFiles(root: string, prefix = ""): Promise<string[]> {
  const files: string[] = [];
  for await (const entry of Deno.readDir(join(root, prefix))) {
    const path = prefix.length === 0 ? entry.name : `${prefix}/${entry.name}`;
    if (entry.isDirectory) {
      files.push(...await listFiles(root, path));
    } else if (entry.isFile) {
      files.push(path);
    }
  }
  return files.sort();
}

async function runCliTwoStep(
  meshRoot: string,
  items: readonly { designatorPath: string; bytes: Uint8Array }[],
): Promise<void> {
  const inputRoot = join(meshRoot, ".version-api-inputs");
  await Deno.mkdir(inputRoot, { recursive: true });
  for (const [index, item] of items.entries()) {
    const sourcePath = join(inputRoot, `${index}.ttl`);
    await Deno.writeFile(sourcePath, item.bytes);
    const update = await runCli([
      "payload",
      "update",
      sourcePath,
      item.designatorPath,
      "--mesh-root",
      meshRoot,
    ], meshRoot);
    assert(update.success, new TextDecoder().decode(update.stderr));
  }
  const version = await runCli([
    "version",
    "--mesh-root",
    meshRoot,
    ...items.flatMap((item) => [
      "--target",
      `designatorPath=${item.designatorPath}`,
    ]),
  ], meshRoot);
  assert(version.success, new TextDecoder().decode(version.stderr));
}

function runCli(
  args: readonly string[],
  cwd: string,
): Promise<Deno.CommandOutput> {
  return new Deno.Command("deno", {
    args: [
      "run",
      "--allow-read",
      "--allow-write",
      "--allow-env",
      cliEntrypoint,
      ...args,
    ],
    cwd,
    stdout: "piped",
    stderr: "piped",
  }).output();
}

async function assertWorkspacePathsEqual(
  leftRoot: string,
  rightRoot: string,
  paths: readonly string[],
): Promise<void> {
  for (const path of paths) {
    assertEquals(
      await Deno.readFile(join(leftRoot, path)),
      await Deno.readFile(join(rightRoot, path)),
      path,
    );
  }
}
