import { assertEquals, assertRejects } from "@std/assert";
import { join } from "@std/path";
import {
  executeKnopAddReference,
  KnopAddReferenceRuntimeError,
} from "../../src/runtime/knop/add_reference.ts";
import { AuditLogger } from "../../src/runtime/logging/audit_logger.ts";
import { StructuredLogger } from "../../src/runtime/logging/logger.ts";
import {
  materializeMeshAliceBioBranch,
  readMeshAliceBioBranchFile,
} from "../support/mesh_alice_bio_fixture.ts";
import {
  MESH_ALICE_BIO_BASE,
  writeEquivalentMeshMetadata,
} from "../support/mesh_metadata.ts";
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

Deno.test("executeKnopAddReference rejects unsafe designator segments before touching the workspace", async () => {
  const workspaceRoot = await createTestTmpDir("weave-knop-add-reference-bad-");
  await materializeMeshAliceBioBranch(
    "07-alice-bio-integrated-woven",
    workspaceRoot,
  );

  await assertRejects(
    () =>
      executeKnopAddReference({
        workspaceRoot,
        request: {
          designatorPath: "alice:bio",
          referenceTargetDesignatorPath: "alice/bio",
          referenceRole: "canonical",
        },
      }),
    KnopAddReferenceRuntimeError,
    'normalizeDesignatorPath rejected segment "alice:bio"',
  );

  await assertRejects(
    () =>
      Deno.stat(
        join(workspaceRoot, "alice:bio/_knop/_references/references.ttl"),
      ),
    Deno.errors.NotFound,
  );
});

Deno.test("executeKnopAddReference preserves the original failure when failed-path logging also throws", async () => {
  const workspaceRoot = await createTestTmpDir(
    "weave-knop-add-reference-failed-logging-",
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

  const throwingOperationalLogger = new StructuredLogger([{
    write(record: { event: string }) {
      if (record.event === "knop.addReference.failed") {
        throw new Error("operational failed log failed");
      }
    },
  }], {
    channel: "operational",
  });
  const throwingAuditLogger = new AuditLogger(
    new StructuredLogger([{
      write(record: { event: string }) {
        if (record.event === "knop.addReference.failed") {
          throw new Error("audit failed log failed");
        }
      },
    }], {
      channel: "security-audit",
    }),
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
        operationalLogger: throwingOperationalLogger,
        auditLogger: throwingAuditLogger,
      }),
    KnopAddReferenceRuntimeError,
    "already exists",
  );
});

Deno.test("executeKnopAddReference treats success logging failures as best-effort after commit", async () => {
  const workspaceRoot = await createTestTmpDir(
    "weave-knop-add-reference-logging-",
  );
  await materializeMeshAliceBioBranch(
    "07-alice-bio-integrated-woven",
    workspaceRoot,
  );

  const throwingOperationalLogger = new StructuredLogger([{
    write(record: { event: string }) {
      if (record.event === "knop.addReference.succeeded") {
        throw new Error("operational success log failed");
      }
    },
  }], {
    channel: "operational",
  });
  const throwingAuditLogger = new AuditLogger(
    new StructuredLogger([{
      write(record: { event: string }) {
        if (record.event === "knop.addReference.succeeded") {
          throw new Error("audit success log failed");
        }
      },
    }], {
      channel: "security-audit",
    }),
  );

  const result = await executeKnopAddReference({
    workspaceRoot,
    request: {
      designatorPath: "alice",
      referenceTargetDesignatorPath: "alice/bio",
      referenceRole: "canonical",
    },
    operationalLogger: throwingOperationalLogger,
    auditLogger: throwingAuditLogger,
  });

  assertEquals(
    result.createdPaths,
    ["alice/_knop/_references/references.ttl"],
  );
  assertEquals(
    await Deno.readTextFile(
      join(workspaceRoot, "alice/_knop/_references/references.ttl"),
    ),
    await readMeshAliceBioBranchFile(
      "08-alice-bio-referenced",
      "alice/_knop/_references/references.ttl",
    ),
  );
});

Deno.test("executeKnopAddReference accepts semantically equivalent mesh metadata turtle", async () => {
  const workspaceRoot = await createTestTmpDir(
    "weave-knop-add-reference-metadata-",
  );
  await materializeMeshAliceBioBranch(
    "07-alice-bio-integrated-woven",
    workspaceRoot,
  );
  await writeEquivalentMeshMetadata(workspaceRoot);

  const result = await executeKnopAddReference({
    workspaceRoot,
    request: {
      designatorPath: "alice",
      referenceTargetDesignatorPath: "alice/bio",
      referenceRole: "canonical",
    },
  });

  assertEquals(result.meshBase, MESH_ALICE_BIO_BASE);
  assertEquals(result.createdPaths, ["alice/_knop/_references/references.ttl"]);
});
