import { assertEquals, assertRejects } from "@std/assert";
import { join } from "@std/path";
import {
  executeExtract,
  executeExtractAllTerms,
  executeSetExtractionSource,
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
  assertEquals(result.sourceDesignatorPath, "alice/bio");
  assertEquals(
    result.extractionSourceIri,
    "https://semantic-flow.github.io/mesh-alice-bio/bob/_knop/_inventory#extraction-source",
  );
  assertEquals(
    result.sourceArtifactIri,
    "https://semantic-flow.github.io/mesh-alice-bio/alice/bio",
  );
  assertEquals(result.sourceStateIri, undefined);
  assertEquals(result.sourceResolutionMode, "current");
  assertEquals(
    [...result.createdPaths].sort(),
    [
      "bob/_knop/_inventory/inventory.ttl",
      "bob/_knop/_meta/meta.ttl",
    ],
  );
  assertEquals(result.updatedPaths, ["_mesh/_inventory/inventory.ttl"]);

  for (
    const path of [
      "_mesh/_inventory/inventory.ttl",
      "bob/_knop/_meta/meta.ttl",
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
  assertEquals(
    await Deno.readTextFile(
      join(workspaceRoot, "bob/_knop/_inventory/inventory.ttl"),
    ),
    `@base <https://semantic-flow.github.io/mesh-alice-bio/> .
@prefix sflo: <https://semantic-flow.github.io/sflo/ontology/> .

<bob/_knop> a sflo:Knop ;
  sflo:hasKnopMetadata <bob/_knop/_meta> ;
  sflo:hasKnopInventory <bob/_knop/_inventory> ;
  sflo:hasExtractionSource <bob/_knop/_inventory#extraction-source> ;
  sflo:hasWorkingKnopInventoryFile <bob/_knop/_inventory/inventory.ttl> .

<bob/_knop/_inventory#extraction-source> a sflo:ExtractionSource ;
  sflo:hasTargetArtifact <alice/bio> ;
  sflo:hasArtifactResolutionMode <https://semantic-flow.github.io/sflo/ontology/ArtifactResolutionMode/Current> .

<bob/_knop/_meta> a sflo:KnopMetadata, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasWorkingLocatedFile <bob/_knop/_meta/meta.ttl> .

<bob/_knop/_inventory> a sflo:KnopInventory, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasWorkingLocatedFile <bob/_knop/_inventory/inventory.ttl> .

<bob/_knop/_meta/meta.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<bob/_knop/_inventory/inventory.ttl> a sflo:LocatedFile, sflo:RdfDocument .
`,
  );

  for (
    const absentPath of [
      "bob/index.html",
      "bob/_knop/index.html",
      "bob/_knop/_meta/index.html",
      "bob/_knop/_inventory/index.html",
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
  assertEquals(result.sourceDesignatorPath, "alice/bio");
});

Deno.test("executeExtractAllTerms extracts only new named mesh terms and skips support artifacts", async () => {
  const workspaceRoot = await createTestTmpDir("weave-extract-all-terms-");
  await materializeMeshAliceBioBranch("11-alice-bio-v2-woven", workspaceRoot);
  await Deno.writeTextFile(
    join(workspaceRoot, "alice-bio.ttl"),
    `@base <${MESH_ALICE_BIO_BASE}> .
@prefix schema: <https://schema.org/> .

<alice/bio> schema:about <bob>, <carol>, <bob/_knop>, <_mesh>, <bob/index.html>, <bob/source.ttl> ;
  schema:mentions [
    schema:name "Blank node support is intentionally ignored"
  ] .

<alice> schema:name "Alice" .
<carol> schema:name "Carol" .
`,
  );

  const result = await executeExtractAllTerms({
    workspaceRoot,
    request: {
      sourceDesignatorPath: "alice/bio",
    },
  });

  assertEquals(result.extractedDesignatorPaths, ["bob", "carol"]);
  assertEquals(result.skippedExistingDesignatorPaths, ["alice", "alice/bio"]);
  assertEquals(
    result.skippedSupportDesignatorPaths,
    ["_mesh", "bob/_knop", "bob/index.html", "bob/source.ttl"],
  );
  assertEquals(
    [...result.createdPaths].sort(),
    [
      "bob/_knop/_inventory/inventory.ttl",
      "bob/_knop/_meta/meta.ttl",
      "carol/_knop/_inventory/inventory.ttl",
      "carol/_knop/_meta/meta.ttl",
    ],
  );
  assertEquals(result.updatedPaths, ["_mesh/_inventory/inventory.ttl"]);
  await Deno.stat(join(workspaceRoot, "bob/_knop/_meta/meta.ttl"));
  await Deno.stat(join(workspaceRoot, "carol/_knop/_meta/meta.ttl"));
  await assertRejects(
    () => Deno.stat(join(workspaceRoot, "bob/_knop/_knop/_meta/meta.ttl")),
    Deno.errors.NotFound,
  );
});

Deno.test("executeExtractAllTerms fails closed for unsafe mesh-scoped term IRIs", async () => {
  const workspaceRoot = await createTestTmpDir(
    "weave-extract-all-terms-unsafe-",
  );
  await materializeMeshAliceBioBranch("11-alice-bio-v2-woven", workspaceRoot);
  await Deno.writeTextFile(
    join(workspaceRoot, "alice-bio.ttl"),
    `@base <${MESH_ALICE_BIO_BASE}> .
@prefix schema: <https://schema.org/> .

<alice/bio> schema:about <bad#fragment> .
`,
  );

  await assertRejects(
    () =>
      executeExtractAllTerms({
        workspaceRoot,
        request: {
          sourceDesignatorPath: "alice/bio",
        },
      }),
    ExtractRuntimeError,
    "cannot be converted to a safe designator path",
  );
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
    assertEquals(result.sourceDesignatorPath, sourceDesignatorPath);
    assertEquals(
      [...result.createdPaths].sort(),
      [
        `docs/${designatorPath}/_knop/_inventory/inventory.ttl`,
        `docs/${designatorPath}/_knop/_meta/meta.ttl`,
      ],
    );
    assertEquals(result.updatedPaths, ["docs/_mesh/_inventory/inventory.ttl"]);
  }

  for (
    const path of [
      "docs/_mesh/_inventory/inventory.ttl",
      "docs/ontology/AbilityScore/_knop/_meta/meta.ttl",
      "docs/ontology/Alignment/_knop/_meta/meta.ttl",
      "docs/ontology/Character/_knop/_meta/meta.ttl",
      "docs/ontology/PlayerCharacter/_knop/_meta/meta.ttl",
      "docs/ontology/CharacterShape/_knop/_meta/meta.ttl",
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
  assertEquals(
    (await Deno.readTextFile(
      join(
        workspaceRoot,
        "docs/ontology/AbilityScore/_knop/_inventory/inventory.ttl",
      ),
    )).includes("ArtifactResolutionMode/Current"),
    true,
  );
  assertEquals(
    (await Deno.readTextFile(
      join(
        workspaceRoot,
        "docs/ontology/CharacterShape/_knop/_inventory/inventory.ttl",
      ),
    )).includes("sflo:hasTargetArtifact <shacl>"),
    true,
  );

  for (
    const absentPath of [
      "docs/ontology/AbilityScore/index.html",
      "docs/ontology/CharacterShape/index.html",
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

Deno.test("executeSetExtractionSource replaces an existing pinned source binding with current", async () => {
  const workspaceRoot = await createTestTmpDir("weave-set-extraction-source-");
  await materializeMeshAliceBioBranch("11-alice-bio-v2-woven", workspaceRoot);

  await executeExtract({
    workspaceRoot,
    request: {
      designatorPath: "bob",
      sourceStatePath: "alice/bio/_history001/_s0002",
    },
  });

  const result = await executeSetExtractionSource({
    workspaceRoot,
    request: {
      designatorPath: "bob",
      sourceDesignatorPath: "alice/bio",
    },
  });

  assertEquals(result.sourceResolutionMode, "current");
  assertEquals(result.updatedPaths, ["bob/_knop/_inventory/inventory.ttl"]);
  const inventoryTurtle = await Deno.readTextFile(
    join(workspaceRoot, "bob/_knop/_inventory/inventory.ttl"),
  );
  assertEquals(
    inventoryTurtle.includes("ArtifactResolutionMode/Current"),
    true,
  );
  assertEquals(
    inventoryTurtle.includes("hasRequestedTargetState"),
    false,
  );
  assertEquals(
    inventoryTurtle.match(/sflo:hasExtractionSource/g)?.length,
    1,
  );
});

Deno.test("executeExtract wraps invalid mesh metadata as ExtractRuntimeError", async () => {
  const workspaceRoot = await createTestTmpDir(
    "weave-extract-invalid-metadata-",
  );
  await materializeMeshAliceBioBranch("11-alice-bio-v2-woven", workspaceRoot);
  await Deno.writeTextFile(
    join(workspaceRoot, "_mesh/_meta/meta.ttl"),
    `@prefix sflo: <https://semantic-flow.github.io/sflo/ontology/> .

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
