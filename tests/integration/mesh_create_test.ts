import { assertEquals, assertRejects } from "@std/assert";
import { join } from "@std/path";
import {
  executeMeshCreate,
  MeshCreateRuntimeError,
} from "../../src/runtime/mesh/create.ts";
import { readMeshAliceBioBranchFile } from "../support/mesh_alice_bio_fixture.ts";
import { createTestTmpDir } from "../support/test_tmp.ts";

Deno.test("executeMeshCreate matches the settled alice-bio mesh-created fixture", async () => {
  const workspaceRoot = await createTestTmpDir("weave-mesh-create-");
  await Deno.writeTextFile(
    join(workspaceRoot, "alice-bio.ttl"),
    await readMeshAliceBioBranchFile("01-source-only", "alice-bio.ttl"),
  );

  const result = await executeMeshCreate({
    workspaceRoot,
    request: {
      meshBase: "https://semantic-flow.github.io/mesh-alice-bio/",
    },
  });

  assertEquals(
    result.meshIri,
    "https://semantic-flow.github.io/mesh-alice-bio/_mesh",
  );
  assertEquals(
    [...result.createdPaths].sort(),
    [
      "_mesh/_inventory/inventory.ttl",
      "_mesh/_meta/meta.ttl",
    ],
  );
  assertEquals(
    await Deno.readTextFile(join(workspaceRoot, "alice-bio.ttl")),
    await readMeshAliceBioBranchFile("02-mesh-created", "alice-bio.ttl"),
  );
  assertEquals(
    await Deno.readTextFile(join(workspaceRoot, "_mesh/_meta/meta.ttl")),
    await readMeshAliceBioBranchFile("02-mesh-created", "_mesh/_meta/meta.ttl"),
  );
  assertEquals(
    await Deno.readTextFile(
      join(workspaceRoot, "_mesh/_inventory/inventory.ttl"),
    ),
    await readMeshAliceBioBranchFile(
      "02-mesh-created",
      "_mesh/_inventory/inventory.ttl",
    ),
  );
});

Deno.test("executeMeshCreate fails closed when mesh support artifacts already exist", async () => {
  const workspaceRoot = await createTestTmpDir("weave-mesh-create-existing-");
  await Deno.mkdir(join(workspaceRoot, "_mesh", "_meta"), { recursive: true });
  await Deno.writeTextFile(
    join(workspaceRoot, "_mesh/_meta/meta.ttl"),
    "# existing\n",
  );

  await assertRejects(
    () =>
      executeMeshCreate({
        workspaceRoot,
        request: {
          meshBase: "https://semantic-flow.github.io/mesh-alice-bio/",
        },
      }),
    MeshCreateRuntimeError,
    "already exists",
  );
});
