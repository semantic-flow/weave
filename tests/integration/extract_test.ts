import { assertEquals, assertRejects } from "@std/assert";
import { join } from "@std/path";
import {
  executeExtract,
  ExtractRuntimeError,
} from "../../src/runtime/extract/extract.ts";
import {
  materializeMeshAliceBioBranch,
  readMeshAliceBioBranchFile,
} from "../support/mesh_alice_bio_fixture.ts";
import {
  MESH_ALICE_BIO_BASE,
  writeEquivalentMeshMetadata,
} from "../support/mesh_metadata.ts";
import { createTestTmpDir } from "../support/test_tmp.ts";

Deno.test("executeExtract matches the settled bob extracted fixture", async () => {
  const workspaceRoot = await createTestTmpDir("weave-extract-");
  await materializeMeshAliceBioBranch("11-alice-bio-v2-woven", workspaceRoot);

  const result = await executeExtract({
    workspaceRoot,
    request: {
      designatorPath: "bob",
    },
  });

  assertEquals(result.designatorPath, "bob");
  assertEquals(result.referenceTargetDesignatorPath, "alice/bio");
  assertEquals(
    result.referenceCatalogIri,
    "https://semantic-flow.github.io/mesh-alice-bio/bob/_knop/_references",
  );
  assertEquals(
    result.referenceLinkIri,
    "https://semantic-flow.github.io/mesh-alice-bio/bob/_knop/_references#reference001",
  );
  assertEquals(
    result.referenceTargetIri,
    "https://semantic-flow.github.io/mesh-alice-bio/alice/bio",
  );
  assertEquals(
    result.referenceTargetStateIri,
    "https://semantic-flow.github.io/mesh-alice-bio/alice/bio/_history001/_s0002",
  );
  assertEquals(
    [...result.createdPaths].sort(),
    [
      "bob/_knop/_inventory/inventory.ttl",
      "bob/_knop/_meta/meta.ttl",
      "bob/_knop/_references/references.ttl",
    ],
  );
  assertEquals(result.updatedPaths, ["_mesh/_inventory/inventory.ttl"]);

  for (
    const path of [
      "_mesh/_inventory/inventory.ttl",
      "bob/_knop/_meta/meta.ttl",
      "bob/_knop/_inventory/inventory.ttl",
      "bob/_knop/_references/references.ttl",
      "alice-bio.ttl",
      "alice/_knop/_inventory/inventory.ttl",
      "alice/_knop/_references/references.ttl",
      "alice/bio/_knop/_inventory/inventory.ttl",
    ]
  ) {
    assertEquals(
      await Deno.readTextFile(join(workspaceRoot, path)),
      await readMeshAliceBioBranchFile("12-bob-extracted", path),
      path,
    );
  }

  for (
    const absentPath of [
      "bob/index.html",
      "bob/_knop/index.html",
      "bob/_knop/_meta/index.html",
      "bob/_knop/_inventory/index.html",
      "bob/_knop/_references/index.html",
    ]
  ) {
    await assertRejects(
      () => Deno.stat(join(workspaceRoot, absentPath)),
      Deno.errors.NotFound,
      absentPath,
    );
  }
});

Deno.test("executeExtract fails closed when the target Bob support surface already exists", async () => {
  const workspaceRoot = await createTestTmpDir("weave-extract-existing-");
  await materializeMeshAliceBioBranch("11-alice-bio-v2-woven", workspaceRoot);
  await Deno.mkdir(join(workspaceRoot, "bob/_knop/_meta"), {
    recursive: true,
  });
  await Deno.writeTextFile(
    join(workspaceRoot, "bob/_knop/_meta/meta.ttl"),
    "# existing\n",
  );

  await assertRejects(
    () =>
      executeExtract({
        workspaceRoot,
        request: {
          designatorPath: "bob",
        },
      }),
    ExtractRuntimeError,
    "already exists",
  );
});

Deno.test("executeExtract accepts semantically equivalent mesh metadata turtle", async () => {
  const workspaceRoot = await createTestTmpDir("weave-extract-metadata-");
  await materializeMeshAliceBioBranch("11-alice-bio-v2-woven", workspaceRoot);
  await writeEquivalentMeshMetadata(workspaceRoot);

  const result = await executeExtract({
    workspaceRoot,
    request: {
      designatorPath: "bob",
    },
  });

  assertEquals(result.meshBase, MESH_ALICE_BIO_BASE);
  assertEquals(result.referenceTargetDesignatorPath, "alice/bio");
});
