import { assertEquals, assertRejects } from "@std/assert";
import { join } from "@std/path";
import {
  executeWeave,
  WeaveRuntimeError,
} from "../../src/runtime/weave/weave.ts";
import {
  materializeMeshAliceBioBranch,
  readMeshAliceBioBranchFile,
} from "../support/mesh_alice_bio_fixture.ts";
import { createTestTmpDir } from "../support/test_tmp.ts";

Deno.test("executeWeave matches the settled alice knop-created-woven fixture", async () => {
  const workspaceRoot = await createTestTmpDir("weave-weave-first-");
  await materializeMeshAliceBioBranch("04-alice-knop-created", workspaceRoot);

  const result = await executeWeave({
    workspaceRoot,
  });

  assertEquals(result.wovenDesignatorPaths, ["alice"]);
  assertEquals(
    [...result.updatedPaths].sort(),
    [
      "_mesh/_inventory/inventory.ttl",
      "alice/_knop/_inventory/inventory.ttl",
    ],
  );
  assertEquals(
    await Deno.readTextFile(
      join(workspaceRoot, "_mesh/_inventory/inventory.ttl"),
    ),
    await readMeshAliceBioBranchFile(
      "05-alice-knop-created-woven",
      "_mesh/_inventory/inventory.ttl",
    ),
  );
  assertEquals(
    await Deno.readTextFile(
      join(workspaceRoot, "alice/_knop/_inventory/inventory.ttl"),
    ),
    await readMeshAliceBioBranchFile(
      "05-alice-knop-created-woven",
      "alice/_knop/_inventory/inventory.ttl",
    ),
  );
  assertEquals(
    await Deno.readTextFile(join(workspaceRoot, "alice/index.html")),
    await readMeshAliceBioBranchFile(
      "05-alice-knop-created-woven",
      "alice/index.html",
    ),
  );
  assertEquals(
    await Deno.readTextFile(join(workspaceRoot, "alice-bio.ttl")),
    await readMeshAliceBioBranchFile(
      "05-alice-knop-created-woven",
      "alice-bio.ttl",
    ),
  );
});

Deno.test("executeWeave matches the settled alice bio integrated-woven fixture", async () => {
  const workspaceRoot = await createTestTmpDir("weave-weave-payload-");
  await materializeMeshAliceBioBranch("06-alice-bio-integrated", workspaceRoot);

  const result = await executeWeave({
    workspaceRoot,
    request: {
      designatorPaths: ["alice/bio"],
    },
  });

  assertEquals(result.wovenDesignatorPaths, ["alice/bio"]);
  assertEquals(
    [...result.updatedPaths].sort(),
    [
      "_mesh/_inventory/inventory.ttl",
      "alice/bio/_knop/_inventory/inventory.ttl",
    ],
  );
  assertEquals(
    await Deno.readTextFile(
      join(workspaceRoot, "_mesh/_inventory/inventory.ttl"),
    ),
    await readMeshAliceBioBranchFile(
      "07-alice-bio-integrated-woven",
      "_mesh/_inventory/inventory.ttl",
    ),
  );
  assertEquals(
    await Deno.readTextFile(
      join(workspaceRoot, "alice/bio/_knop/_inventory/inventory.ttl"),
    ),
    await readMeshAliceBioBranchFile(
      "07-alice-bio-integrated-woven",
      "alice/bio/_knop/_inventory/inventory.ttl",
    ),
  );
  assertEquals(
    await Deno.readTextFile(join(workspaceRoot, "alice/bio/index.html")),
    await readMeshAliceBioBranchFile(
      "07-alice-bio-integrated-woven",
      "alice/bio/index.html",
    ),
  );
  assertEquals(
    await Deno.readTextFile(
      join(
        workspaceRoot,
        "alice/bio/_history001/_s0001/alice-bio-ttl/alice-bio.ttl",
      ),
    ),
    await Deno.readTextFile(join(workspaceRoot, "alice-bio.ttl")),
  );
});

Deno.test("executeWeave matches the settled alice bio referenced-woven fixture", async () => {
  const workspaceRoot = await createTestTmpDir(
    "weave-weave-reference-catalog-",
  );
  await materializeMeshAliceBioBranch("08-alice-bio-referenced", workspaceRoot);

  const result = await executeWeave({
    workspaceRoot,
  });

  assertEquals(result.wovenDesignatorPaths, ["alice"]);
  assertEquals(result.updatedPaths, ["alice/_knop/_inventory/inventory.ttl"]);
  assertEquals(
    await Deno.readTextFile(
      join(workspaceRoot, "alice/_knop/_inventory/inventory.ttl"),
    ),
    await readMeshAliceBioBranchFile(
      "09-alice-bio-referenced-woven",
      "alice/_knop/_inventory/inventory.ttl",
    ),
  );
  assertEquals(
    await Deno.readTextFile(
      join(
        workspaceRoot,
        "alice/_knop/_inventory/_history001/_s0002/inventory-ttl/inventory.ttl",
      ),
    ),
    await readMeshAliceBioBranchFile(
      "09-alice-bio-referenced-woven",
      "alice/_knop/_inventory/_history001/_s0002/inventory-ttl/inventory.ttl",
    ),
  );
  assertEquals(
    await Deno.readTextFile(
      join(workspaceRoot, "alice/_knop/_references/references.ttl"),
    ),
    await readMeshAliceBioBranchFile(
      "09-alice-bio-referenced-woven",
      "alice/_knop/_references/references.ttl",
    ),
  );
  assertEquals(
    await Deno.readTextFile(
      join(
        workspaceRoot,
        "alice/_knop/_references/_history001/_s0001/references-ttl/references.ttl",
      ),
    ),
    await Deno.readTextFile(
      join(workspaceRoot, "alice/_knop/_references/references.ttl"),
    ),
  );
  assertEquals(
    await Deno.readTextFile(
      join(workspaceRoot, "alice/_knop/_references/index.html"),
    ),
    await readMeshAliceBioBranchFile(
      "09-alice-bio-referenced-woven",
      "alice/_knop/_references/index.html",
    ),
  );
  assertEquals(
    await Deno.readTextFile(
      join(workspaceRoot, "_mesh/_inventory/inventory.ttl"),
    ),
    await readMeshAliceBioBranchFile(
      "09-alice-bio-referenced-woven",
      "_mesh/_inventory/inventory.ttl",
    ),
  );
});

Deno.test("executeWeave materializes the second alice bio payload weave slice", async () => {
  const workspaceRoot = await createTestTmpDir("weave-weave-payload-v2-");
  await materializeMeshAliceBioBranch("10-alice-bio-updated", workspaceRoot);

  const result = await executeWeave({
    workspaceRoot,
    request: {
      designatorPaths: ["alice/bio"],
    },
  });

  assertEquals(result.wovenDesignatorPaths, ["alice/bio"]);
  assertEquals(result.updatedPaths, [
    "alice/bio/_knop/_inventory/inventory.ttl",
  ]);
  assertEquals(
    [...result.createdPaths].sort(),
    [
      "alice/bio/_history001/_s0002/alice-bio-ttl/alice-bio.ttl",
      "alice/bio/_history001/_s0002/alice-bio-ttl/index.html",
      "alice/bio/_history001/_s0002/index.html",
      "alice/bio/_knop/_inventory/_history001/_s0002/index.html",
      "alice/bio/_knop/_inventory/_history001/_s0002/inventory-ttl/index.html",
      "alice/bio/_knop/_inventory/_history001/_s0002/inventory-ttl/inventory.ttl",
    ],
  );
  assertEquals(
    await Deno.readTextFile(
      join(workspaceRoot, "alice/bio/_knop/_inventory/inventory.ttl"),
    ),
    await readMeshAliceBioBranchFile(
      "11-alice-bio-v2-woven",
      "alice/bio/_knop/_inventory/inventory.ttl",
    ),
  );
  assertEquals(
    await Deno.readTextFile(
      join(
        workspaceRoot,
        "alice/bio/_history001/_s0002/alice-bio-ttl/alice-bio.ttl",
      ),
    ),
    await Deno.readTextFile(join(workspaceRoot, "alice-bio.ttl")),
  );
  assertEquals(
    await Deno.readTextFile(
      join(
        workspaceRoot,
        "alice/bio/_knop/_inventory/_history001/_s0002/inventory-ttl/inventory.ttl",
      ),
    ),
    await Deno.readTextFile(
      join(workspaceRoot, "alice/bio/_knop/_inventory/inventory.ttl"),
    ),
  );
  await Deno.stat(
    join(workspaceRoot, "alice/bio/_history001/_s0002/index.html"),
  );
  await Deno.stat(
    join(
      workspaceRoot,
      "alice/bio/_history001/_s0002/alice-bio-ttl/index.html",
    ),
  );
  await Deno.stat(
    join(
      workspaceRoot,
      "alice/bio/_knop/_inventory/_history001/_s0002/index.html",
    ),
  );
  await Deno.stat(
    join(
      workspaceRoot,
      "alice/bio/_knop/_inventory/_history001/_s0002/inventory-ttl/index.html",
    ),
  );
  assertEquals(
    await Deno.readTextFile(
      join(workspaceRoot, "_mesh/_inventory/inventory.ttl"),
    ),
    await readMeshAliceBioBranchFile(
      "11-alice-bio-v2-woven",
      "_mesh/_inventory/inventory.ttl",
    ),
  );
});

Deno.test("executeWeave materializes the extracted bob woven slice", async () => {
  const workspaceRoot = await createTestTmpDir("weave-weave-bob-extracted-");
  await materializeMeshAliceBioBranch("12-bob-extracted", workspaceRoot);

  const result = await executeWeave({
    workspaceRoot,
    request: {
      designatorPaths: ["bob"],
    },
  });

  assertEquals(result.wovenDesignatorPaths, ["bob"]);
  assertEquals(
    [...result.updatedPaths].sort(),
    [
      "_mesh/_inventory/_history001/index.html",
      "_mesh/_inventory/inventory.ttl",
      "alice/index.html",
      "bob/_knop/_inventory/inventory.ttl",
    ],
  );
  assertEquals(
    [...result.createdPaths].sort(),
    [
      "_mesh/_inventory/_history001/_s0004/index.html",
      "_mesh/_inventory/_history001/_s0004/inventory-ttl/index.html",
      "_mesh/_inventory/_history001/_s0004/inventory-ttl/inventory.ttl",
      "bob/index.html",
      "bob/_knop/index.html",
      "bob/_knop/_inventory/_history001/index.html",
      "bob/_knop/_inventory/_history001/_s0001/index.html",
      "bob/_knop/_inventory/_history001/_s0001/inventory-ttl/index.html",
      "bob/_knop/_inventory/_history001/_s0001/inventory-ttl/inventory.ttl",
      "bob/_knop/_inventory/index.html",
      "bob/_knop/_meta/_history001/index.html",
      "bob/_knop/_meta/_history001/_s0001/index.html",
      "bob/_knop/_meta/_history001/_s0001/meta-ttl/index.html",
      "bob/_knop/_meta/_history001/_s0001/meta-ttl/meta.ttl",
      "bob/_knop/_meta/index.html",
      "bob/_knop/_references/_history001/index.html",
      "bob/_knop/_references/_history001/_s0001/index.html",
      "bob/_knop/_references/_history001/_s0001/references-ttl/index.html",
      "bob/_knop/_references/_history001/_s0001/references-ttl/references.ttl",
      "bob/_knop/_references/index.html",
    ].sort(),
  );
  assertEquals(
    await Deno.readTextFile(
      join(workspaceRoot, "_mesh/_inventory/inventory.ttl"),
    ),
    await readMeshAliceBioBranchFile(
      "13-bob-extracted-woven",
      "_mesh/_inventory/inventory.ttl",
    ),
  );
  assertEquals(
    await Deno.readTextFile(
      join(workspaceRoot, "bob/_knop/_inventory/inventory.ttl"),
    ),
    await readMeshAliceBioBranchFile(
      "13-bob-extracted-woven",
      "bob/_knop/_inventory/inventory.ttl",
    ),
  );
  assertEquals(
    await Deno.readTextFile(
      join(
        workspaceRoot,
        "bob/_knop/_meta/_history001/_s0001/meta-ttl/meta.ttl",
      ),
    ),
    await readMeshAliceBioBranchFile(
      "13-bob-extracted-woven",
      "bob/_knop/_meta/_history001/_s0001/meta-ttl/meta.ttl",
    ),
  );
  assertEquals(
    await Deno.readTextFile(
      join(
        workspaceRoot,
        "bob/_knop/_references/_history001/_s0001/references-ttl/references.ttl",
      ),
    ),
    await readMeshAliceBioBranchFile(
      "13-bob-extracted-woven",
      "bob/_knop/_references/_history001/_s0001/references-ttl/references.ttl",
    ),
  );
  assertEquals(
    await Deno.readTextFile(
      join(workspaceRoot, "_mesh/_inventory/_history001/index.html"),
    ),
    await readMeshAliceBioBranchFile(
      "13-bob-extracted-woven",
      "_mesh/_inventory/_history001/index.html",
    ),
  );
  assertEquals(
    await Deno.readTextFile(join(workspaceRoot, "alice/index.html")),
    await readMeshAliceBioBranchFile(
      "13-bob-extracted-woven",
      "alice/index.html",
    ),
  );
  assertEquals(
    await Deno.readTextFile(join(workspaceRoot, "bob/index.html")),
    await readMeshAliceBioBranchFile(
      "13-bob-extracted-woven",
      "bob/index.html",
    ),
  );
  assertEquals(
    await Deno.readTextFile(join(workspaceRoot, "alice-bio.ttl")),
    await readMeshAliceBioBranchFile(
      "13-bob-extracted-woven",
      "alice-bio.ttl",
    ),
  );
});

Deno.test("executeWeave fails closed when a created weave target already exists", async () => {
  const workspaceRoot = await createTestTmpDir("weave-weave-existing-");
  await materializeMeshAliceBioBranch("04-alice-knop-created", workspaceRoot);
  await Deno.mkdir(join(workspaceRoot, "alice"), { recursive: true });
  await Deno.writeTextFile(
    join(workspaceRoot, "alice/index.html"),
    "existing\n",
  );

  await assertRejects(
    () =>
      executeWeave({
        workspaceRoot,
      }),
    WeaveRuntimeError,
    "already exists",
  );
});

Deno.test("executeWeave ignores settled Knops before loading missing working artifacts", async () => {
  const workspaceRoot = await createTestTmpDir("weave-weave-settled-ignore-");
  await materializeMeshAliceBioBranch("04-alice-knop-created", workspaceRoot);
  await addSupplementalKnopToMeshInventory(workspaceRoot, "bob/bio");
  await writeSupplementalKnopSurface(
    workspaceRoot,
    "bob/bio",
    `@base <https://semantic-flow.github.io/mesh-alice-bio/> .
@prefix sflo: <https://semantic-flow.github.io/semantic-flow-ontology/> .

<bob/bio/_knop> a sflo:Knop ;
  sflo:hasKnopMetadata <bob/bio/_knop/_meta> ;
  sflo:hasKnopInventory <bob/bio/_knop/_inventory> ;
  sflo:hasWorkingKnopInventoryFile <bob/bio/_knop/_inventory/inventory.ttl> ;
  sflo:hasPayloadArtifact <bob/bio> .

<bob/bio> a sflo:PayloadArtifact, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasArtifactHistory <bob/bio/_history001> ;
  sflo:hasWorkingLocatedFile <missing-bob-bio.ttl> .

<bob/bio/_knop/_inventory> a sflo:KnopInventory, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasArtifactHistory <bob/bio/_knop/_inventory/_history001> .
`,
  );

  const result = await executeWeave({
    workspaceRoot,
  });

  assertEquals(result.wovenDesignatorPaths, ["alice"]);
});

Deno.test("executeWeave ignores non-requested weave candidates before loading working artifacts", async () => {
  const workspaceRoot = await createTestTmpDir("weave-weave-requested-ignore-");
  await materializeMeshAliceBioBranch("04-alice-knop-created", workspaceRoot);
  await addSupplementalKnopToMeshInventory(workspaceRoot, "bob/bio");
  await writeSupplementalKnopSurface(
    workspaceRoot,
    "bob/bio",
    `@base <https://semantic-flow.github.io/mesh-alice-bio/> .
@prefix sflo: <https://semantic-flow.github.io/semantic-flow-ontology/> .

<bob/bio/_knop> a sflo:Knop ;
  sflo:hasKnopMetadata <bob/bio/_knop/_meta> ;
  sflo:hasKnopInventory <bob/bio/_knop/_inventory> ;
  sflo:hasWorkingKnopInventoryFile <bob/bio/_knop/_inventory/inventory.ttl> ;
  sflo:hasPayloadArtifact <bob/bio> .

<bob/bio> a sflo:PayloadArtifact, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasWorkingLocatedFile <missing-bob-bio.ttl> .
`,
  );

  const result = await executeWeave({
    workspaceRoot,
    request: {
      designatorPaths: ["alice"],
    },
  });

  assertEquals(result.wovenDesignatorPaths, ["alice"]);
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

async function writeSupplementalKnopSurface(
  workspaceRoot: string,
  designatorPath: string,
  inventoryTurtle: string,
): Promise<void> {
  const knopPath = join(workspaceRoot, `${designatorPath}/_knop`);
  await Deno.mkdir(join(knopPath, "_meta"), { recursive: true });
  await Deno.mkdir(join(knopPath, "_inventory"), { recursive: true });
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
