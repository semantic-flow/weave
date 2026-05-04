import { assertEquals, assertRejects } from "@std/assert";
import { join } from "@std/path";
import {
  executeExtract,
  ExtractRuntimeError,
} from "../../src/runtime/extract/extract.ts";
import {
  materializeMeshAliceBioBranch,
  readMeshAliceBioBranchFile,
} from "../support/mesh_alice_bio_fixture.ts";
import {
  materializeMeshSidecarFantasyRulesBranch,
  readMeshSidecarFantasyRulesBranchFile,
} from "../support/mesh_sidecar_fantasy_rules_fixture.ts";
import {
  MESH_ALICE_BIO_BASE,
  writeEquivalentMeshMetadata,
} from "../support/mesh_metadata.ts";
import { createTestTmpDir } from "../support/test_tmp.ts";

Deno.test("executeExtract matches the settled bob extracted fixture", async () => {
  const workspaceRoot = await createTestTmpDir("weave-extract-");
  await materializeMeshAliceBioBranch("11-alice-bio-v2-woven", workspaceRoot);

  const result = await executeExtract({
    workspaceRoot,
    request: {
      designatorPath: "bob",
    },
  });

  assertEquals(result.designatorPath, "bob");
  assertEquals(result.referenceTargetDesignatorPath, "alice/bio");
  assertEquals(
    result.referenceCatalogIri,
    "https://semantic-flow.github.io/mesh-alice-bio/bob/_knop/_references",
  );
  assertEquals(
    result.referenceLinkIri,
    "https://semantic-flow.github.io/mesh-alice-bio/bob/_knop/_references#reference001",
  );
  assertEquals(
    result.referenceTargetIri,
    "https://semantic-flow.github.io/mesh-alice-bio/alice/bio",
  );
  assertEquals(
    result.referenceTargetStateIri,
    "https://semantic-flow.github.io/mesh-alice-bio/alice/bio/_history001/_s0002",
  );
  assertEquals(
    [...result.createdPaths].sort(),
    [
      "bob/_knop/_inventory/inventory.ttl",
      "bob/_knop/_meta/meta.ttl",
      "bob/_knop/_references/references.ttl",
    ],
  );
  assertEquals(result.updatedPaths, ["_mesh/_inventory/inventory.ttl"]);

  for (
    const path of [
      "_mesh/_inventory/inventory.ttl",
      "bob/_knop/_meta/meta.ttl",
      "bob/_knop/_inventory/inventory.ttl",
      "bob/_knop/_references/references.ttl",
      "alice-bio.ttl",
      "alice/_knop/_inventory/inventory.ttl",
      "alice/_knop/_references/references.ttl",
      "alice/bio/_knop/_inventory/inventory.ttl",
    ]
  ) {
    assertEquals(
      await Deno.readTextFile(join(workspaceRoot, path)),
      await readMeshAliceBioBranchFile("12-bob-extracted", path),
      path,
    );
  }

  for (
    const absentPath of [
      "bob/index.html",
      "bob/_knop/index.html",
      "bob/_knop/_meta/index.html",
      "bob/_knop/_inventory/index.html",
      "bob/_knop/_references/index.html",
    ]
  ) {
    await assertRejects(
      () => Deno.stat(join(workspaceRoot, absentPath)),
      Deno.errors.NotFound,
      absentPath,
    );
  }
});

Deno.test("executeExtract fails closed when the target Bob support surface already exists", async () => {
  const workspaceRoot = await createTestTmpDir("weave-extract-existing-");
  await materializeMeshAliceBioBranch("11-alice-bio-v2-woven", workspaceRoot);
  await Deno.mkdir(join(workspaceRoot, "bob/_knop/_meta"), {
    recursive: true,
  });
  await Deno.writeTextFile(
    join(workspaceRoot, "bob/_knop/_meta/meta.ttl"),
    "# existing\n",
  );

  await assertRejects(
    () =>
      executeExtract({
        workspaceRoot,
        request: {
          designatorPath: "bob",
        },
      }),
    ExtractRuntimeError,
    "already exists",
  );
});

Deno.test("executeExtract accepts semantically equivalent mesh metadata turtle", async () => {
  const workspaceRoot = await createTestTmpDir("weave-extract-metadata-");
  await materializeMeshAliceBioBranch("11-alice-bio-v2-woven", workspaceRoot);
  await writeEquivalentMeshMetadata(workspaceRoot);

  const result = await executeExtract({
    workspaceRoot,
    request: {
      designatorPath: "bob",
    },
  });

  assertEquals(result.meshBase, MESH_ALICE_BIO_BASE);
  assertEquals(result.referenceTargetDesignatorPath, "alice/bio");
});

Deno.test("executeExtract extracts selected sidecar ontology and SHACL terms with explicit sources", async () => {
  const workspaceRoot = await createTestTmpDir("weave-extract-sidecar-terms-");
  const meshRoot = join(workspaceRoot, "docs");
  await materializeMeshSidecarFantasyRulesBranch(
    "07-shacl-integrated-woven",
    workspaceRoot,
  );

  const extractRequests = [
    ["ontology/AbilityScore", "ontology"],
    ["ontology/Alignment", "ontology"],
    ["ontology/Character", "ontology"],
    ["ontology/PlayerCharacter", "ontology"],
    ["ontology/CharacterShape", "shacl"],
  ] as const;
  for (const [designatorPath, sourceDesignatorPath] of extractRequests) {
    const result = await executeExtract({
      meshRoot,
      request: { designatorPath, sourceDesignatorPath },
    });
    assertEquals(result.designatorPath, designatorPath);
    assertEquals(result.referenceTargetDesignatorPath, sourceDesignatorPath);
    assertEquals(
      [...result.createdPaths].sort(),
      [
        `docs/${designatorPath}/_knop/_inventory/inventory.ttl`,
        `docs/${designatorPath}/_knop/_meta/meta.ttl`,
        `docs/${designatorPath}/_knop/_references/references.ttl`,
      ],
    );
    assertEquals(result.updatedPaths, ["docs/_mesh/_inventory/inventory.ttl"]);
  }

  for (
    const path of [
      "docs/_mesh/_inventory/inventory.ttl",
      "docs/ontology/AbilityScore/_knop/_meta/meta.ttl",
      "docs/ontology/AbilityScore/_knop/_inventory/inventory.ttl",
      "docs/ontology/AbilityScore/_knop/_references/references.ttl",
      "docs/ontology/Alignment/_knop/_meta/meta.ttl",
      "docs/ontology/Alignment/_knop/_inventory/inventory.ttl",
      "docs/ontology/Alignment/_knop/_references/references.ttl",
      "docs/ontology/Character/_knop/_meta/meta.ttl",
      "docs/ontology/Character/_knop/_inventory/inventory.ttl",
      "docs/ontology/Character/_knop/_references/references.ttl",
      "docs/ontology/PlayerCharacter/_knop/_meta/meta.ttl",
      "docs/ontology/PlayerCharacter/_knop/_inventory/inventory.ttl",
      "docs/ontology/PlayerCharacter/_knop/_references/references.ttl",
      "docs/ontology/CharacterShape/_knop/_meta/meta.ttl",
      "docs/ontology/CharacterShape/_knop/_inventory/inventory.ttl",
      "docs/ontology/CharacterShape/_knop/_references/references.ttl",
      "ontology/fantasy-rules-ontology.ttl",
      "shacl/fantasy-rules-shacl.ttl",
      "docs/_mesh/_config/config.ttl",
    ]
  ) {
    assertEquals(
      await Deno.readTextFile(join(workspaceRoot, path)),
      await readMeshSidecarFantasyRulesBranchFile(
        "08-ontology-and-shacl-terms-extracted",
        path,
      ),
      path,
    );
  }

  for (
    const absentPath of [
      "docs/ontology/AbilityScore/index.html",
      "docs/ontology/CharacterShape/index.html",
      "docs/ontology/AbilityScore/_knop/_references/index.html",
    ]
  ) {
    await assertRejects(
      () => Deno.stat(join(workspaceRoot, absentPath)),
      Deno.errors.NotFound,
      absentPath,
    );
  }
});

Deno.test("executeExtract fails closed for ambiguous sidecar term sources without an explicit source", async () => {
  const workspaceRoot = await createTestTmpDir(
    "weave-extract-sidecar-ambiguous-",
  );
  await materializeMeshSidecarFantasyRulesBranch(
    "07-shacl-integrated-woven",
    workspaceRoot,
  );

  await assertRejects(
    () =>
      executeExtract({
        meshRoot: join(workspaceRoot, "docs"),
        request: { designatorPath: "ontology/AbilityScore" },
      }),
    ExtractRuntimeError,
    "Ambiguous extract source",
  );
});

Deno.test("executeExtract wraps invalid mesh metadata as ExtractRuntimeError", async () => {
  const workspaceRoot = await createTestTmpDir(
    "weave-extract-invalid-metadata-",
  );
  await materializeMeshAliceBioBranch("11-alice-bio-v2-woven", workspaceRoot);
  await Deno.writeTextFile(
    join(workspaceRoot, "_mesh/_meta/meta.ttl"),
    `@prefix sflo: <https://semantic-flow.github.io/semantic-flow-ontology/> .

<_mesh> sflo:meshBase "https://semantic-flow.github.io/mesh-alice-bio/" .
`,
  );

  await assertRejects(
    () =>
      executeExtract({
        workspaceRoot,
        request: {
          designatorPath: "bob",
        },
      }),
    ExtractRuntimeError,
    "Could not resolve meshBase from _mesh/_meta/meta.ttl",
  );
});
