import { assertEquals } from "@std/assert";
import { join } from "@std/path";
import { executePayloadUpdate } from "../../src/runtime/payload/update.ts";
import {
  materializeMeshAliceBioBranch,
  readMeshAliceBioBranchFile,
} from "../support/mesh_alice_bio_fixture.ts";
import { createTestTmpDir } from "../support/test_tmp.ts";

Deno.test("executePayloadUpdate matches the settled alice-bio updated fixture", async () => {
  const workspaceRoot = await createTestTmpDir("weave-payload-update-");
  await materializeMeshAliceBioBranch(
    "09-alice-bio-referenced-woven",
    workspaceRoot,
  );

  const sourceRoot = await createTestTmpDir("weave-payload-update-source-");
  const sourcePath = join(sourceRoot, "alice-bio-v2.ttl");
  await Deno.writeTextFile(
    sourcePath,
    await readMeshAliceBioBranchFile("10-alice-bio-updated", "alice-bio.ttl"),
  );

  const result = await executePayloadUpdate({
    workspaceRoot,
    request: {
      designatorPath: "alice/bio",
      source: sourcePath,
    },
  });

  assertEquals(result.designatorPath, "alice/bio");
  assertEquals(result.workingFilePath, "alice-bio.ttl");
  assertEquals(result.updatedPaths, ["alice-bio.ttl"]);
  assertEquals(
    await Deno.readTextFile(join(workspaceRoot, "alice-bio.ttl")),
    await readMeshAliceBioBranchFile("10-alice-bio-updated", "alice-bio.ttl"),
  );
  assertEquals(
    await Deno.readTextFile(
      join(
        workspaceRoot,
        "alice/bio/_history001/_s0001/alice-bio-ttl/alice-bio.ttl",
      ),
    ),
    await readMeshAliceBioBranchFile(
      "10-alice-bio-updated",
      "alice/bio/_history001/_s0001/alice-bio-ttl/alice-bio.ttl",
    ),
  );
  assertEquals(
    await Deno.readTextFile(
      join(workspaceRoot, "_mesh/_inventory/inventory.ttl"),
    ),
    await readMeshAliceBioBranchFile(
      "10-alice-bio-updated",
      "_mesh/_inventory/inventory.ttl",
    ),
  );
  assertEquals(
    await Deno.readTextFile(
      join(workspaceRoot, "alice/_knop/_references/index.html"),
    ),
    await readMeshAliceBioBranchFile(
      "10-alice-bio-updated",
      "alice/_knop/_references/index.html",
    ),
  );
});
