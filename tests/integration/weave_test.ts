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

Deno.test("executeWeave matches the settled alice-bio knop-created-woven fixture", async () => {
  const workspaceRoot = await createTestTmpDir("weave-weave-");
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
