import { assertEquals, assertRejects } from "@std/assert";
import { join } from "@std/path";
import {
  executeKnopAddReference,
  KnopAddReferenceRuntimeError,
} from "../../src/runtime/knop/add_reference.ts";
import {
  materializeMeshAliceBioBranch,
  readMeshAliceBioBranchFile,
} from "../support/mesh_alice_bio_fixture.ts";
import { createTestTmpDir } from "../support/test_tmp.ts";

Deno.test("executeKnopAddReference matches the settled alice-bio referenced fixture", async () => {
  const workspaceRoot = await createTestTmpDir("weave-knop-add-reference-");
  await materializeMeshAliceBioBranch(
    "07-alice-bio-integrated-woven",
    workspaceRoot,
  );

  const result = await executeKnopAddReference({
    workspaceRoot,
    request: {
      designatorPath: "alice",
      referenceTargetDesignatorPath: "alice/bio",
      referenceRole: "canonical",
    },
  });

  assertEquals(
    result.referenceCatalogIri,
    "https://semantic-flow.github.io/mesh-alice-bio/alice/_knop/_references",
  );
  assertEquals(
    result.referenceLinkIri,
    "https://semantic-flow.github.io/mesh-alice-bio/alice/_knop/_references#reference001",
  );
  assertEquals(
    result.referenceRoleIri,
    "https://semantic-flow.github.io/semantic-flow-ontology/ReferenceRole/Canonical",
  );
  assertEquals(result.createdPaths, ["alice/_knop/_references/references.ttl"]);
  assertEquals(result.updatedPaths, ["alice/_knop/_inventory/inventory.ttl"]);
  assertEquals(
    await Deno.readTextFile(
      join(workspaceRoot, "alice/_knop/_references/references.ttl"),
    ),
    await readMeshAliceBioBranchFile(
      "08-alice-bio-referenced",
      "alice/_knop/_references/references.ttl",
    ),
  );
  assertEquals(
    await Deno.readTextFile(
      join(workspaceRoot, "alice/_knop/_inventory/inventory.ttl"),
    ),
    await readMeshAliceBioBranchFile(
      "08-alice-bio-referenced",
      "alice/_knop/_inventory/inventory.ttl",
    ),
  );
  assertEquals(
    await Deno.readTextFile(
      join(workspaceRoot, "_mesh/_inventory/inventory.ttl"),
    ),
    await readMeshAliceBioBranchFile(
      "08-alice-bio-referenced",
      "_mesh/_inventory/inventory.ttl",
    ),
  );
  assertEquals(
    await Deno.readTextFile(join(workspaceRoot, "alice/_knop/_meta/meta.ttl")),
    await readMeshAliceBioBranchFile(
      "08-alice-bio-referenced",
      "alice/_knop/_meta/meta.ttl",
    ),
  );
});

Deno.test("executeKnopAddReference fails closed when the reference catalog working file already exists", async () => {
  const workspaceRoot = await createTestTmpDir(
    "weave-knop-add-reference-existing-",
  );
  await materializeMeshAliceBioBranch(
    "07-alice-bio-integrated-woven",
    workspaceRoot,
  );
  await Deno.mkdir(join(workspaceRoot, "alice/_knop/_references"), {
    recursive: true,
  });
  await Deno.writeTextFile(
    join(workspaceRoot, "alice/_knop/_references/references.ttl"),
    "# existing\n",
  );

  await assertRejects(
    () =>
      executeKnopAddReference({
        workspaceRoot,
        request: {
          designatorPath: "alice",
          referenceTargetDesignatorPath: "alice/bio",
          referenceRole: "canonical",
        },
      }),
    KnopAddReferenceRuntimeError,
    "already exists",
  );
});
