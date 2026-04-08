import {
  assert,
  assertEquals,
  assertRejects,
  assertStringIncludes,
} from "@std/assert";
import { join } from "@std/path";
import { WeaveInputError } from "../../src/core/weave/weave.ts";
import {
  executeGenerate,
  executeValidate,
  executeVersion,
} from "../../src/runtime/weave/weave.ts";
import {
  materializeMeshAliceBioBranch,
  readMeshAliceBioBranchFile,
} from "../support/mesh_alice_bio_fixture.ts";
import { createTestTmpDir } from "../support/test_tmp.ts";

Deno.test("executeValidate returns structured findings for version-only target fields", async () => {
  const workspaceRoot = await createTestTmpDir("weave-validate-target-fields-");
  await materializeMeshAliceBioBranch("06-alice-bio-integrated", workspaceRoot);

  const request = {
    targets: [{
      designatorPath: "alice/bio",
      stateSegment: "v0.0.1",
    }],
  } as unknown as Parameters<typeof executeValidate>[0]["request"];

  const result = await executeValidate({
    workspaceRoot,
    request,
  });

  assertEquals(result.validatedDesignatorPaths, []);
  assertEquals(result.findings, [{
    severity: "error",
    message: "request.targets[0].stateSegment is not supported",
  }]);
});

Deno.test("executeGenerate rejects version-only target fields", async () => {
  const workspaceRoot = await createTestTmpDir("weave-generate-target-fields-");
  await materializeMeshAliceBioBranch(
    "07-alice-bio-integrated-woven",
    workspaceRoot,
  );

  const request = {
    targets: [{
      designatorPath: "alice/bio",
      historySegment: "releases",
    }],
  } as unknown as Parameters<typeof executeGenerate>[0]["request"];

  await assertRejects(
    () =>
      executeGenerate({
        workspaceRoot,
        request,
      }),
    WeaveInputError,
    "historySegment is not supported",
  );
});

Deno.test("executeVersion accepts version-only target fields", async () => {
  const workspaceRoot = await createTestTmpDir("weave-version-target-fields-");
  await materializeMeshAliceBioBranch("06-alice-bio-integrated", workspaceRoot);

  const result = await executeVersion({
    workspaceRoot,
    request: {
      targets: [{
        designatorPath: "alice/bio",
        historySegment: "releases",
        stateSegment: "v0.0.1",
      }],
    },
  });

  assertEquals(result.versionedDesignatorPaths, ["alice/bio"]);
  assert(
    result.createdPaths.includes(
      "alice/bio/releases/v0.0.1/alice-bio-ttl/alice-bio.ttl",
    ),
  );
});

Deno.test("executeVersion rejects a mismatched payload historySegment on an already-versioned payload", async () => {
  const workspaceRoot = await createTestTmpDir(
    "weave-version-mismatched-history-",
  );
  await materializeMeshAliceBioBranch("10-alice-bio-updated", workspaceRoot);

  await assertRejects(
    () =>
      executeVersion({
        workspaceRoot,
        request: {
          targets: [{
            designatorPath: "alice/bio",
            historySegment: "releases",
            stateSegment: "v0.0.2",
          }],
        },
      }),
    WeaveInputError,
    "does not match the current payload history",
  );
});

Deno.test("executeVersion batches recursive targets through staged current state", async () => {
  const workspaceRoot = await createTestTmpDir("weave-version-recursive-");
  await materializeMeshAliceBioBranch("04-alice-knop-created", workspaceRoot);
  await addSupplementalKnopToMeshInventory(workspaceRoot, "alice/bio");
  await addSupplementalPayloadArtifactToMeshInventory(
    workspaceRoot,
    "alice/bio",
    "alice-bio.ttl",
  );
  await writeSupplementalKnopSurface(
    workspaceRoot,
    "alice/bio",
    `@base <https://semantic-flow.github.io/mesh-alice-bio/> .
@prefix sflo: <https://semantic-flow.github.io/semantic-flow-ontology/> .

<alice/bio/_knop> a sflo:Knop ;
  sflo:hasKnopMetadata <alice/bio/_knop/_meta> ;
  sflo:hasKnopInventory <alice/bio/_knop/_inventory> ;
  sflo:hasWorkingKnopInventoryFile <alice/bio/_knop/_inventory/inventory.ttl> ;
  sflo:hasPayloadArtifact <alice/bio> .

<alice/bio> a sflo:PayloadArtifact, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasWorkingLocatedFile <alice-bio.ttl> .
`,
  );

  const result = await executeVersion({
    workspaceRoot,
    request: {
      targets: [{ designatorPath: "alice", recursive: true }],
    },
  });

  assertEquals(result.versionedDesignatorPaths, ["alice", "alice/bio"]);
  assertEquals(
    result.updatedPaths.filter((path) =>
      path === "_mesh/_inventory/inventory.ttl"
    )
      .length,
    1,
  );
  assert(
    result.createdPaths.includes(
      "_mesh/_inventory/_history001/_s0003/inventory-ttl/inventory.ttl",
    ),
  );
  assert(
    result.createdPaths.includes(
      "alice/bio/_history001/_s0001/alice-bio-ttl/alice-bio.ttl",
    ),
  );
  assertStringIncludes(
    await Deno.readTextFile(
      join(workspaceRoot, "_mesh/_inventory/inventory.ttl"),
    ),
    `sflo:hasKnop <alice/bio/_knop> ;
  sflo:hasResourcePage <_mesh/index.html> .`,
  );
  assertStringIncludes(
    await Deno.readTextFile(
      join(workspaceRoot, "_mesh/_inventory/inventory.ttl"),
    ),
    `sflo:latestHistoricalState <_mesh/_inventory/_history001/_s0003> ;
  sflo:nextStateOrdinal "4"^^xsd:nonNegativeInteger ;`,
  );
  assertStringIncludes(
    await Deno.readTextFile(
      join(workspaceRoot, "alice/_knop/_inventory/inventory.ttl"),
    ),
    `sflo:currentArtifactHistory <alice/_knop/_inventory/_history001> ;
  sflo:nextHistoryOrdinal "2"^^xsd:nonNegativeInteger ;`,
  );
  assertStringIncludes(
    await Deno.readTextFile(
      join(workspaceRoot, "alice/bio/_knop/_inventory/inventory.ttl"),
    ),
    `sflo:currentArtifactHistory <alice/bio/_history001> ;
  sflo:nextHistoryOrdinal "2"^^xsd:nonNegativeInteger ;`,
  );
  assertStringIncludes(
    await Deno.readTextFile(
      join(workspaceRoot, "alice/bio/_knop/_inventory/inventory.ttl"),
    ),
    `sflo:latestHistoricalState <alice/bio/_history001/_s0001> ;
  sflo:nextStateOrdinal "2"^^xsd:nonNegativeInteger ;`,
  );
  await assertRejects(
    () => Deno.stat(join(workspaceRoot, "alice/bio/index.html")),
    Deno.errors.NotFound,
  );
});

Deno.test("executeVersion fails closed when a later batch target becomes invalid in staged state", async () => {
  const workspaceRoot = await createTestTmpDir(
    "weave-version-recursive-fail-closed-",
  );
  await materializeMeshAliceBioBranch("10-alice-bio-updated", workspaceRoot);
  await addSupplementalKnopToMeshInventory(workspaceRoot, "bob");
  await writeSupplementalKnopSurface(
    workspaceRoot,
    "bob",
    await readMeshAliceBioBranchFile(
      "12-bob-extracted",
      "bob/_knop/_inventory/inventory.ttl",
    ),
  );
  await Deno.writeTextFile(
    join(workspaceRoot, "bob/_knop/_references/references.ttl"),
    (
      await readMeshAliceBioBranchFile(
        "12-bob-extracted",
        "bob/_knop/_references/references.ttl",
      )
    ).replace(
      "alice/bio/_history001/_s0002",
      "alice/bio/_history001/_s0001",
    ),
  );

  const meshInventoryBefore = await Deno.readTextFile(
    join(workspaceRoot, "_mesh/_inventory/inventory.ttl"),
  );
  const aliceBioInventoryBefore = await Deno.readTextFile(
    join(workspaceRoot, "alice/bio/_knop/_inventory/inventory.ttl"),
  );

  await assertRejects(
    () =>
      executeVersion({
        workspaceRoot,
        request: {
          targets: [
            { designatorPath: "alice/bio" },
            { designatorPath: "bob" },
          ],
        },
      }),
    WeaveInputError,
    "did not resolve the expected source payload state",
  );

  assertEquals(
    await Deno.readTextFile(
      join(workspaceRoot, "_mesh/_inventory/inventory.ttl"),
    ),
    meshInventoryBefore,
  );
  assertEquals(
    await Deno.readTextFile(
      join(workspaceRoot, "alice/bio/_knop/_inventory/inventory.ttl"),
    ),
    aliceBioInventoryBefore,
  );
  await assertRejects(
    () =>
      Deno.stat(
        join(
          workspaceRoot,
          "alice/bio/_history001/_s0002/alice-bio-ttl/alice-bio.ttl",
        ),
      ),
    Deno.errors.NotFound,
  );
});

Deno.test("executeGenerate does not mutate RDF artifacts", async () => {
  const workspaceRoot = await createTestTmpDir("weave-generate-rdf-stable-");
  await materializeMeshAliceBioBranch("13-bob-extracted-woven", workspaceRoot);

  const meshInventoryBefore = await Deno.readTextFile(
    join(workspaceRoot, "_mesh/_inventory/inventory.ttl"),
  );
  const bobInventoryBefore = await Deno.readTextFile(
    join(workspaceRoot, "bob/_knop/_inventory/inventory.ttl"),
  );

  const result = await executeGenerate({
    workspaceRoot,
  });

  assert(result.createdPaths.every((path) => path.endsWith(".html")));
  assert(result.updatedPaths.every((path) => path.endsWith(".html")));
  assertEquals(
    await Deno.readTextFile(
      join(workspaceRoot, "_mesh/_inventory/inventory.ttl"),
    ),
    meshInventoryBefore,
  );
  assertEquals(
    await Deno.readTextFile(
      join(workspaceRoot, "bob/_knop/_inventory/inventory.ttl"),
    ),
    bobInventoryBefore,
  );
});

Deno.test("executeGenerate reads only the settled current workspace state", async () => {
  const workspaceRoot = await createTestTmpDir("weave-generate-settled-state-");
  await materializeMeshAliceBioBranch("10-alice-bio-updated", workspaceRoot);

  await executeGenerate({
    workspaceRoot,
    request: {
      targets: [{ designatorPath: "alice/bio" }],
    },
  });

  await assertRejects(
    () =>
      Deno.stat(
        join(
          workspaceRoot,
          "alice/bio/_history001/_s0002/index.html",
        ),
      ),
    Deno.errors.NotFound,
  );
});

async function addSupplementalKnopToMeshInventory(
  workspaceRoot: string,
  designatorPath: string,
): Promise<void> {
  const meshInventoryPath = join(
    workspaceRoot,
    "_mesh/_inventory/inventory.ttl",
  );
  const current = await Deno.readTextFile(meshInventoryPath);
  await Deno.writeTextFile(
    meshInventoryPath,
    `${current.trimEnd()}

<${designatorPath}/_knop> a sflo:Knop ;
  sflo:hasWorkingKnopInventoryFile <${designatorPath}/_knop/_inventory/inventory.ttl> .
`,
  );
}

async function addSupplementalPayloadArtifactToMeshInventory(
  workspaceRoot: string,
  designatorPath: string,
  workingFilePath: string,
): Promise<void> {
  const meshInventoryPath = join(
    workspaceRoot,
    "_mesh/_inventory/inventory.ttl",
  );
  const current = await Deno.readTextFile(meshInventoryPath);
  await Deno.writeTextFile(
    meshInventoryPath,
    `${current.trimEnd()}

<${designatorPath}> a sflo:PayloadArtifact, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasWorkingLocatedFile <${workingFilePath}> .
`,
  );
}

async function writeSupplementalKnopSurface(
  workspaceRoot: string,
  designatorPath: string,
  inventoryTurtle: string,
): Promise<void> {
  const knopPath = join(workspaceRoot, `${designatorPath}/_knop`);
  await Deno.mkdir(join(knopPath, "_meta"), { recursive: true });
  await Deno.mkdir(join(knopPath, "_inventory"), { recursive: true });
  await Deno.mkdir(join(knopPath, "_references"), { recursive: true });
  await Deno.writeTextFile(
    join(knopPath, "_meta/meta.ttl"),
    `@base <https://semantic-flow.github.io/mesh-alice-bio/> .
@prefix sflo: <https://semantic-flow.github.io/semantic-flow-ontology/> .

<${designatorPath}/_knop> a sflo:Knop ;
  sflo:designatorPath "${designatorPath}" ;
  sflo:hasWorkingKnopInventoryFile <${designatorPath}/_knop/_inventory/inventory.ttl> .
`,
  );
  await Deno.writeTextFile(
    join(knopPath, "_inventory/inventory.ttl"),
    inventoryTurtle,
  );
}
