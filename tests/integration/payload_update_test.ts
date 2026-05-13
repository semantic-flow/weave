import { assertEquals, assertRejects } from "@std/assert";
import { join } from "@std/path";
import { executePayloadUpdate } from "../../src/runtime/payload/update.ts";
import {
  materializeMeshAliceBioBranch,
  readMeshAliceBioBranchFile,
} from "../support/mesh_alice_bio_fixture.ts";
import {
  MESH_ALICE_BIO_BASE,
  writeEquivalentMeshMetadata,
} from "../support/mesh_metadata.ts";
import {
  bootstrapRootWovenWorkspace,
  ROOT_PAYLOAD_TURTLE_V2,
} from "../support/root_designator.ts";
import { createTestTmpDir } from "../support/test_tmp.ts";
import { PayloadUpdateRuntimeError } from "../../src/runtime/payload/update.ts";

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
  assertEquals(result.workingLocalRelativePath, "alice-bio.ttl");
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

Deno.test("executePayloadUpdate supports the root designator path", async () => {
  const workspaceRoot = await createTestTmpDir("weave-payload-update-root-");
  await materializeMeshAliceBioBranch(
    "05-alice-knop-created-woven",
    workspaceRoot,
  );
  await bootstrapRootWovenWorkspace(workspaceRoot);

  const sourceRoot = await createTestTmpDir(
    "weave-payload-update-root-source-",
  );
  const sourcePath = join(sourceRoot, "root-v2.ttl");
  await Deno.writeTextFile(sourcePath, ROOT_PAYLOAD_TURTLE_V2);

  const result = await executePayloadUpdate({
    workspaceRoot,
    request: {
      designatorPath: "",
      source: sourcePath,
    },
  });

  assertEquals(result.designatorPath, "");
  assertEquals(result.workingLocalRelativePath, "root.ttl");
  assertEquals(result.updatedPaths, ["root.ttl"]);
  assertEquals(
    await Deno.readTextFile(join(workspaceRoot, "root.ttl")),
    ROOT_PAYLOAD_TURTLE_V2,
  );
});

Deno.test("executePayloadUpdate accepts a file URL source", async () => {
  const workspaceRoot = await createTestTmpDir(
    "weave-payload-update-file-url-",
  );
  await materializeMeshAliceBioBranch(
    "09-alice-bio-referenced-woven",
    workspaceRoot,
  );

  const sourceRoot = await createTestTmpDir(
    "weave-payload-update-file-url-source-",
  );
  const sourcePath = join(sourceRoot, "alice-bio-v2.ttl");
  await Deno.writeTextFile(
    sourcePath,
    await readMeshAliceBioBranchFile("10-alice-bio-updated", "alice-bio.ttl"),
  );

  const result = await executePayloadUpdate({
    workspaceRoot,
    request: {
      designatorPath: "alice/bio",
      source: new URL(`file://${sourcePath}`).href,
    },
  });

  assertEquals(result.updatedPaths, ["alice-bio.ttl"]);
  assertEquals(
    await Deno.readTextFile(join(workspaceRoot, "alice-bio.ttl")),
    await readMeshAliceBioBranchFile("10-alice-bio-updated", "alice-bio.ttl"),
  );
});

Deno.test("executePayloadUpdate treats colon-containing source filenames as filesystem paths", async () => {
  const workspaceRoot = await createTestTmpDir(
    "weave-payload-update-colon-path-",
  );
  await materializeMeshAliceBioBranch(
    "09-alice-bio-referenced-woven",
    workspaceRoot,
  );

  const sourceRoot = await createTestTmpDir(
    "weave-payload-update-colon-path-source-",
  );
  const sourcePath = join(sourceRoot, "alice:bio-v2.ttl");
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

  assertEquals(result.updatedPaths, ["alice-bio.ttl"]);
  assertEquals(
    await Deno.readTextFile(join(workspaceRoot, "alice-bio.ttl")),
    await readMeshAliceBioBranchFile("10-alice-bio-updated", "alice-bio.ttl"),
  );
});

Deno.test("executePayloadUpdate rejects remote source URLs before touching the workspace", async () => {
  const workspaceRoot = await createTestTmpDir(
    "weave-payload-update-remote-url-",
  );
  await materializeMeshAliceBioBranch(
    "09-alice-bio-referenced-woven",
    workspaceRoot,
  );

  const originalPayload = await Deno.readTextFile(
    join(workspaceRoot, "alice-bio.ttl"),
  );

  await assertRejects(
    () =>
      executePayloadUpdate({
        workspaceRoot,
        request: {
          designatorPath: "alice/bio",
          source: "https://example.com/alice-bio.ttl",
        },
      }),
    PayloadUpdateRuntimeError,
    "only supports local filesystem sources",
  );

  assertEquals(
    await Deno.readTextFile(join(workspaceRoot, "alice-bio.ttl")),
    originalPayload,
  );
});

Deno.test("executePayloadUpdate rejects invalid Turtle and preserves the working payload file", async () => {
  const workspaceRoot = await createTestTmpDir(
    "weave-payload-update-invalid-rdf-",
  );
  await materializeMeshAliceBioBranch(
    "09-alice-bio-referenced-woven",
    workspaceRoot,
  );

  const sourceRoot = await createTestTmpDir(
    "weave-payload-update-invalid-rdf-source-",
  );
  const sourcePath = join(sourceRoot, "alice-bio-invalid.ttl");
  await Deno.writeTextFile(
    sourcePath,
    `@base <https://semantic-flow.github.io/mesh-alice-bio/> .
@prefix schema: <https://schema.org/> .

<alice> a schema:Person
`,
  );

  const originalPayload = await Deno.readTextFile(
    join(workspaceRoot, "alice-bio.ttl"),
  );

  await assertRejects(
    () =>
      executePayloadUpdate({
        workspaceRoot,
        request: {
          designatorPath: "alice/bio",
          source: sourcePath,
        },
      }),
    PayloadUpdateRuntimeError,
    "Generated RDF did not parse",
  );

  assertEquals(
    await Deno.readTextFile(join(workspaceRoot, "alice-bio.ttl")),
    originalPayload,
  );
});

Deno.test("executePayloadUpdate accepts semantically equivalent mesh metadata turtle", async () => {
  const workspaceRoot = await createTestTmpDir(
    "weave-payload-update-metadata-",
  );
  await materializeMeshAliceBioBranch(
    "09-alice-bio-referenced-woven",
    workspaceRoot,
  );
  await writeEquivalentMeshMetadata(workspaceRoot);

  const sourceRoot = await createTestTmpDir(
    "weave-payload-update-metadata-source-",
  );
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

  assertEquals(result.meshBase, MESH_ALICE_BIO_BASE);
  assertEquals(result.updatedPaths, ["alice-bio.ttl"]);
});
