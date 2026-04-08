import { assert, assertEquals, assertRejects } from "@std/assert";
import { join } from "@std/path";
import { WeaveInputError } from "../../src/core/weave/weave.ts";
import {
  executeGenerate,
  executeValidate,
  executeVersion,
} from "../../src/runtime/weave/weave.ts";
import { materializeMeshAliceBioBranch } from "../support/mesh_alice_bio_fixture.ts";
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
