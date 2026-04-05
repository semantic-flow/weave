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
