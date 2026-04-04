import { assertEquals, assertRejects } from "@std/assert";
import { join } from "@std/path";
import {
  executeIntegrate,
  IntegrateRuntimeError,
} from "../../src/runtime/integrate/integrate.ts";
import {
  materializeMeshAliceBioBranch,
  readMeshAliceBioBranchFile,
} from "../support/mesh_alice_bio_fixture.ts";
import { createTestTmpDir } from "../support/test_tmp.ts";

Deno.test("executeIntegrate matches the settled alice-bio integrated fixture", async () => {
  const workspaceRoot = await createTestTmpDir("weave-integrate-");
  await materializeMeshAliceBioBranch(
    "05-alice-knop-created-woven",
    workspaceRoot,
  );

  const result = await executeIntegrate({
    workspaceRoot,
    request: {
      designatorPath: "alice/bio",
      source: "alice-bio.ttl",
    },
  });

  assertEquals(result.designatorPath, "alice/bio");
  assertEquals(result.workingFilePath, "alice-bio.ttl");
  assertEquals(
    [...result.createdPaths].sort(),
    [
      "alice/bio/_knop/_inventory/inventory.ttl",
      "alice/bio/_knop/_meta/meta.ttl",
    ],
  );
  assertEquals(result.updatedPaths, ["_mesh/_inventory/inventory.ttl"]);
  assertEquals(
    await Deno.readTextFile(
      join(workspaceRoot, "_mesh/_inventory/inventory.ttl"),
    ),
    await readMeshAliceBioBranchFile(
      "06-alice-bio-integrated",
      "_mesh/_inventory/inventory.ttl",
    ),
  );
  assertEquals(
    await Deno.readTextFile(
      join(workspaceRoot, "alice/bio/_knop/_meta/meta.ttl"),
    ),
    await readMeshAliceBioBranchFile(
      "06-alice-bio-integrated",
      "alice/bio/_knop/_meta/meta.ttl",
    ),
  );
  assertEquals(
    await Deno.readTextFile(
      join(workspaceRoot, "alice/bio/_knop/_inventory/inventory.ttl"),
    ),
    await readMeshAliceBioBranchFile(
      "06-alice-bio-integrated",
      "alice/bio/_knop/_inventory/inventory.ttl",
    ),
  );
  assertEquals(
    await Deno.readTextFile(join(workspaceRoot, "alice-bio.ttl")),
    await readMeshAliceBioBranchFile(
      "06-alice-bio-integrated",
      "alice-bio.ttl",
    ),
  );
});

Deno.test("executeIntegrate rejects a source file outside the workspace", async () => {
  const workspaceRoot = await createTestTmpDir("weave-integrate-workspace-");
  await materializeMeshAliceBioBranch(
    "05-alice-knop-created-woven",
    workspaceRoot,
  );

  const externalRoot = await createTestTmpDir("weave-integrate-external-");
  const externalSourcePath = join(externalRoot, "alice-bio.ttl");
  await Deno.writeTextFile(
    externalSourcePath,
    await readMeshAliceBioBranchFile(
      "05-alice-knop-created-woven",
      "alice-bio.ttl",
    ),
  );

  await assertRejects(
    () =>
      executeIntegrate({
        workspaceRoot,
        request: {
          designatorPath: "alice/bio",
          source: externalSourcePath,
        },
      }),
    IntegrateRuntimeError,
    "inside the workspace",
  );
});
