import { assertEquals, assertRejects, assertStringIncludes } from "@std/assert";
import { join } from "@std/path";
import {
  executeKnopCreate,
  KnopCreateRuntimeError,
} from "../../src/runtime/knop/create.ts";
import {
  materializeMeshAliceBioBranch,
  readMeshAliceBioBranchFile,
} from "../support/mesh_alice_bio_fixture.ts";
import {
  MESH_ALICE_BIO_BASE,
  writeEquivalentMeshMetadata,
} from "../support/mesh_metadata.ts";
import { createTestTmpDir } from "../support/test_tmp.ts";

Deno.test("executeKnopCreate matches the settled alice-bio knop-created fixture", async () => {
  const workspaceRoot = await createTestTmpDir("weave-knop-create-");
  await materializeMeshAliceBioBranch("03-mesh-created-woven", workspaceRoot);

  const result = await executeKnopCreate({
    workspaceRoot,
    request: {
      designatorPath: "alice",
    },
  });

  assertEquals(
    result.knopIri,
    "https://semantic-flow.github.io/mesh-alice-bio/alice/_knop",
  );
  assertEquals(
    [...result.createdPaths].sort(),
    [
      "alice/_knop/_inventory/inventory.ttl",
      "alice/_knop/_meta/meta.ttl",
    ],
  );
  assertEquals(result.updatedPaths, ["_mesh/_inventory/inventory.ttl"]);
  assertEquals(
    await Deno.readTextFile(join(workspaceRoot, "alice/_knop/_meta/meta.ttl")),
    await readMeshAliceBioBranchFile(
      "04-alice-knop-created",
      "alice/_knop/_meta/meta.ttl",
    ),
  );
  assertEquals(
    await Deno.readTextFile(
      join(workspaceRoot, "alice/_knop/_inventory/inventory.ttl"),
    ),
    await readMeshAliceBioBranchFile(
      "04-alice-knop-created",
      "alice/_knop/_inventory/inventory.ttl",
    ),
  );
  assertEquals(
    await Deno.readTextFile(
      join(workspaceRoot, "_mesh/_inventory/inventory.ttl"),
    ),
    await readMeshAliceBioBranchFile(
      "04-alice-knop-created",
      "_mesh/_inventory/inventory.ttl",
    ),
  );
});

Deno.test("executeKnopCreate creates root-owned support artifacts without leading slashes", async () => {
  const workspaceRoot = await createTestTmpDir("weave-knop-create-root-");
  await materializeMeshAliceBioBranch("03-mesh-created-woven", workspaceRoot);

  const result = await executeKnopCreate({
    workspaceRoot,
    request: {
      designatorPath: "",
    },
  });

  assertEquals(result.designatorPath, "");
  assertEquals(
    [...result.createdPaths].sort(),
    [
      "_knop/_inventory/inventory.ttl",
      "_knop/_meta/meta.ttl",
    ],
  );
  assertEquals(result.updatedPaths, ["_mesh/_inventory/inventory.ttl"]);
  assertStringIncludes(
    await Deno.readTextFile(join(workspaceRoot, "_knop/_meta/meta.ttl")),
    'sflo:designatorPath ""',
  );
  assertStringIncludes(
    await Deno.readTextFile(
      join(workspaceRoot, "_knop/_inventory/inventory.ttl"),
    ),
    "<_knop> a sflo:Knop ;",
  );
  assertStringIncludes(
    await Deno.readTextFile(
      join(workspaceRoot, "_knop/_inventory/inventory.ttl"),
    ),
    "sflo:hasWorkingKnopInventoryFile <_knop/_inventory/inventory.ttl> .",
  );
});

Deno.test("executeKnopCreate fails closed when knop support artifacts already exist", async () => {
  const workspaceRoot = await createTestTmpDir("weave-knop-create-existing-");
  await materializeMeshAliceBioBranch("03-mesh-created-woven", workspaceRoot);
  await Deno.mkdir(join(workspaceRoot, "alice/_knop/_meta"), {
    recursive: true,
  });
  await Deno.writeTextFile(
    join(workspaceRoot, "alice/_knop/_meta/meta.ttl"),
    "# existing\n",
  );

  await assertRejects(
    () =>
      executeKnopCreate({
        workspaceRoot,
        request: {
          designatorPath: "alice",
        },
      }),
    KnopCreateRuntimeError,
    "already exists",
  );
});

Deno.test("executeKnopCreate accepts semantically equivalent mesh metadata turtle", async () => {
  const workspaceRoot = await createTestTmpDir("weave-knop-create-metadata-");
  await materializeMeshAliceBioBranch("03-mesh-created-woven", workspaceRoot);
  await writeEquivalentMeshMetadata(workspaceRoot);

  const result = await executeKnopCreate({
    workspaceRoot,
    request: {
      designatorPath: "alice",
    },
  });

  assertEquals(result.meshBase, MESH_ALICE_BIO_BASE);
  assertEquals(result.updatedPaths, ["_mesh/_inventory/inventory.ttl"]);
});
