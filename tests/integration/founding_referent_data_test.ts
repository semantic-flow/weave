import {
  assert,
  assertEquals,
  assertRejects,
  assertStringIncludes,
} from "@std/assert";
import { join } from "@std/path";
import { versionFoundingReferentData } from "../../src/api/version_founding_referent_data.ts";
import { executeKnopAddReference } from "../../src/runtime/knop/add_reference.ts";
import { executeKnopCreate } from "../../src/runtime/knop/create.ts";
import {
  executeValidate,
  executeWeave,
} from "../../src/runtime/weave/weave.ts";
import { materializeMeshAliceBioBranch } from "../support/mesh_alice_bio_fixture.ts";
import { createTestTmpDir } from "../support/test_tmp.ts";

const meshBase = "https://semantic-flow.github.io/mesh-alice-bio/";
const encode = (text: string) => new TextEncoder().encode(text);

async function createFoundingMesh(prefix: string) {
  const meshRoot = await createTestTmpDir(prefix);
  await materializeMeshAliceBioBranch("03-mesh-created-woven", meshRoot);
  const bytes = encode(
    `<${meshBase}founding-demo> <https://example.test/vocab/value> "one" .\n`,
  );
  await executeKnopCreate({
    workspaceRoot: meshRoot,
    request: { designatorPath: "founding-demo", foundingData: bytes },
  });
  return { meshRoot, bytes };
}

Deno.test("publication validation requires settlement while authoring allows pending working bytes", async () => {
  const { meshRoot } = await createFoundingMesh("founding-validation-");

  const before = await executeValidate({ meshRoot, scope: "publication" });
  assertEquals(
    before.findings.some((finding) =>
      finding.code === "unsettled-founding-referent-data"
    ),
    true,
  );

  await versionFoundingReferentData({
    meshRoot,
    designatorPath: "founding-demo",
  });
  const settled = await executeValidate({ meshRoot, scope: "publication" });
  assertEquals(
    settled.findings.some((finding) =>
      finding.code === "unsettled-founding-referent-data"
    ),
    false,
  );

  await Deno.writeTextFile(
    join(meshRoot, "founding-demo/_knop/_founding/data.ttl"),
    `<${meshBase}founding-demo> <https://example.test/vocab/value> "pending" .\n`,
  );
  const authoring = await executeValidate({ meshRoot, scope: "mesh" });
  assertEquals(
    authoring.findings.some((finding) =>
      finding.code === "unsettled-founding-referent-data"
    ),
    false,
  );
  const pendingPublication = await executeValidate({
    meshRoot,
    scope: "publication",
  });
  assertEquals(
    pendingPublication.findings.some((finding) =>
      finding.code === "unsettled-founding-referent-data"
    ),
    true,
  );
});

Deno.test("founding snapshot digest validation honors exact target selection", async () => {
  const { meshRoot } = await createFoundingMesh("founding-digest-");
  const initial = await versionFoundingReferentData({
    meshRoot,
    designatorPath: "founding-demo",
  });
  await executeKnopCreate({
    workspaceRoot: meshRoot,
    request: { designatorPath: "other" },
  });
  await Deno.writeTextFile(join(meshRoot, initial.snapshotPath), "corrupt\n");

  const whole = await executeValidate({ meshRoot, scope: "mesh" });
  assertEquals(
    whole.findings.some((finding) =>
      finding.code === "content-digest-mismatch"
    ),
    true,
  );
  const otherOnly = await executeValidate({
    meshRoot,
    scope: "mesh",
    request: { targets: [{ designatorPath: "other" }] },
  });
  assertEquals(
    otherOnly.findings.some((finding) =>
      finding.code === "content-digest-mismatch"
    ),
    false,
  );
});

Deno.test("ordinary weave and knop add-reference preserve complete founding history without a founding page", async () => {
  const { meshRoot, bytes } = await createFoundingMesh("founding-preserve-");
  const initial = await versionFoundingReferentData({
    meshRoot,
    designatorPath: "founding-demo",
  });

  await executeWeave({
    meshRoot,
    request: { targets: [{ designatorPath: "founding-demo" }] },
    historyTrackingPolicyOverride: "versioned",
  });
  const inventoryPath = join(
    meshRoot,
    "founding-demo/_knop/_inventory/inventory.ttl",
  );
  let inventory = await Deno.readTextFile(inventoryPath);
  assertStringIncludes(inventory, "sflo:hasFoundingReferentData");
  assertStringIncludes(inventory, initial.contentDigest);
  assertEquals(
    await Deno.readFile(join(meshRoot, initial.snapshotPath)),
    bytes,
  );
  await assertRejects(
    () => Deno.stat(join(meshRoot, "founding-demo/_knop/_founding/index.html")),
    Deno.errors.NotFound,
  );

  await executeKnopAddReference({
    workspaceRoot: meshRoot,
    request: {
      designatorPath: "founding-demo",
      referenceTargetDesignatorPath: "founding-demo",
      referenceRole: "canonical",
    },
  });
  inventory = await Deno.readTextFile(inventoryPath);
  assertStringIncludes(inventory, "sflo:hasFoundingReferentData");
  assertStringIncludes(inventory, initial.contentDigest);
  assert(await Deno.stat(join(meshRoot, initial.snapshotPath)));
});
