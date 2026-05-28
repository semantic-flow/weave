import {
  assertEquals,
  assertFalse,
  assertRejects,
  assertStringIncludes,
} from "@std/assert";
import { dirname, join } from "@std/path";
import {
  renderHostLocalAccessProfileTurtle,
  renderUserSettingsTurtle,
  resolveUserSettingsPaths,
} from "../../src/runtime/settings/user_settings.ts";
import {
  executeExtract,
  executeExtractAllTerms,
  executeSetExtractionSource,
  ExtractRuntimeError,
} from "../../src/runtime/extract/extract.ts";
import { executeWeave } from "../../src/runtime/weave/weave.ts";
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
  assertEquals(result.sourceDesignatorPath, "alice/data");
  assertEquals(
    result.extractionSourceIri,
    "https://semantic-flow.github.io/mesh-alice-bio/bob/_knop/_sources#extraction-source",
  );
  assertEquals(
    result.sourceArtifactIri,
    "https://semantic-flow.github.io/mesh-alice-bio/alice/data",
  );
  assertEquals(result.sourceStateIri, undefined);
  assertEquals(result.sourceResolutionMode, "working");
  assertEquals(
    [...result.createdPaths].sort(),
    [
      "bob/_knop/_inventory/inventory.ttl",
      "bob/_knop/_meta/meta.ttl",
      "bob/_knop/_sources/sources.ttl",
    ],
  );
  assertEquals(result.updatedPaths, ["_mesh/_inventory/inventory.ttl"]);

  for (
    const path of [
      "_mesh/_inventory/inventory.ttl",
      "bob/_knop/_meta/meta.ttl",
      "alice-data.ttl",
      "alice/_knop/_inventory/inventory.ttl",
      "alice/_knop/_references/references.ttl",
      "alice/data/_knop/_inventory/inventory.ttl",
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
  sflo:hasKnopSourceRegistry <bob/_knop/_sources> ;
  sflo:hasExtractionSource <bob/_knop/_sources#extraction-source> ;
  sflo:hasWorkingKnopInventoryFile <bob/_knop/_inventory/inventory.ttl> .

<bob/_knop/_meta> a sflo:KnopMetadata, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasWorkingLocatedFile <bob/_knop/_meta/meta.ttl> .

<bob/_knop/_inventory> a sflo:KnopInventory, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasWorkingLocatedFile <bob/_knop/_inventory/inventory.ttl> .

<bob/_knop/_sources> a sflo:KnopSourceRegistry, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasWorkingLocatedFile <bob/_knop/_sources/sources.ttl> .

<bob/_knop/_meta/meta.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<bob/_knop/_inventory/inventory.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<bob/_knop/_sources/sources.ttl> a sflo:LocatedFile, sflo:RdfDocument .
`,
  );
  assertEquals(
    await Deno.readTextFile(
      join(workspaceRoot, "bob/_knop/_sources/sources.ttl"),
    ),
    `@base <https://semantic-flow.github.io/mesh-alice-bio/> .
@prefix sflo: <https://semantic-flow.github.io/sflo/ontology/> .

<bob/_knop/_sources> a sflo:KnopSourceRegistry, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasWorkingLocatedFile <bob/_knop/_sources/sources.ttl> ;
  sflo:hasSourceBinding <bob/_knop/_sources#extraction-source> .

<bob/_knop/_sources#extraction-source> a sflo:ExtractionSource ;
  sflo:targetArtifact <alice/data> ;
  sflo:hasArtifactResolutionMode <https://semantic-flow.github.io/sflo/ontology/artifactResolutionMode_working> ;
  sflo:hasResolutionObservation <bob/_knop/_sources#extraction-source-observation-001> .

<bob/_knop/_sources#extraction-source-observation-001> a sflo:ArtifactResolutionObservation ;
  sflo:observedArtifactResolutionSpec [
    a sflo:ArtifactResolutionSpec ;
    sflo:targetLocatedFile <alice-data.ttl>
  ] ;
  sflo:observedContentDigest "sha256:6df3896c975b782534c22a389a794512609f92c2eb6bd8550c85efe2564bad68" .

<bob/_knop/_sources/sources.ttl> a sflo:LocatedFile, sflo:RdfDocument .
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
  assertEquals(result.sourceDesignatorPath, "alice/data");
});

Deno.test("executeExtract omits local path evidence for floating repository source payloads", async () => {
  const tempRoot = await createTestTmpDir(
    "weave-extract-floating-repository-source-",
  );
  const sourceRoot = join(tempRoot, "source");
  const workspaceRoot = join(tempRoot, "publication");
  const homeRoot = join(tempRoot, "home");
  const settingsRoot = join(tempRoot, "settings");
  await materializeMeshAliceBioBranch("11-alice-bio-v2-woven", workspaceRoot);
  await Deno.mkdir(sourceRoot, { recursive: true });
  await Deno.mkdir(homeRoot, { recursive: true });
  await runGit(sourceRoot, ["init"]);
  await runGit(sourceRoot, [
    "remote",
    "add",
    "origin",
    "https://github.com/semantic-flow/mesh-alice-bio.git",
  ]);
  await Deno.writeTextFile(
    join(sourceRoot, "alice-data.ttl"),
    await readMeshAliceBioBranchFile("11-alice-bio-v2-woven", "alice-data.ttl"),
  );
  await writeSettingsAccessGrant(settingsRoot, sourceRoot);

  const inventoryPath = join(
    workspaceRoot,
    "alice/data/_knop/_inventory/inventory.ttl",
  );
  await Deno.writeTextFile(
    inventoryPath,
    (await Deno.readTextFile(inventoryPath)).replace(
      "sflo:hasWorkingLocatedFile <alice-data.ttl> ;",
      `sflo:hasRepositorySourceFloatingLocator [
    a sflo:RepositorySourceFloatingLocator ;
    sflo:sourceRepositoryUrl "https://github.com/semantic-flow/mesh-alice-bio.git" ;
    sflo:sourceRepositoryPathFromRoot "alice-data.ttl"
  ] ;`,
    ),
  );

  const previousHome = Deno.env.get("HOME");
  const previousWeaveSettings = Deno.env.get("WEAVE_SETTINGS");
  Deno.env.set("HOME", homeRoot);
  Deno.env.set("WEAVE_SETTINGS", settingsRoot);
  try {
    await executeExtract({
      workspaceRoot,
      request: {
        designatorPath: "bob",
      },
    });
  } finally {
    if (previousHome === undefined) {
      Deno.env.delete("HOME");
    } else {
      Deno.env.set("HOME", previousHome);
    }
    if (previousWeaveSettings === undefined) {
      Deno.env.delete("WEAVE_SETTINGS");
    } else {
      Deno.env.set("WEAVE_SETTINGS", previousWeaveSettings);
    }
  }

  const sourcesTurtle = await Deno.readTextFile(
    join(workspaceRoot, "bob/_knop/_sources/sources.ttl"),
  );
  assertStringIncludes(sourcesTurtle, "sflo:observedContentDigest");
  assertFalse(
    sourcesTurtle.includes("sflo:targetLocalRelativePath"),
    sourcesTurtle,
  );
  assertFalse(sourcesTurtle.includes(sourceRoot), sourcesTurtle);
});

async function writeSettingsAccessGrant(
  settingsRoot: string,
  allowedPathRoot: string,
): Promise<void> {
  const paths = await resolveUserSettingsPaths(MESH_ALICE_BIO_BASE, {
    env: {
      WEAVE_SETTINGS: settingsRoot,
      HOME: "/tmp/weave-test-home",
    },
  });
  await Deno.mkdir(dirname(paths.meshSettings.accessProfilePath), {
    recursive: true,
  });
  await Deno.writeTextFile(paths.settingsPath, renderUserSettingsTurtle(paths));
  await Deno.writeTextFile(
    paths.meshSettings.accessProfilePath,
    renderHostLocalAccessProfileTurtle([`${allowedPathRoot}/`]),
  );
}

Deno.test("executeExtractAllTerms extracts only new named mesh terms and skips support artifacts", async () => {
  const workspaceRoot = await createTestTmpDir("weave-extract-all-terms-");
  await materializeMeshAliceBioBranch("11-alice-bio-v2-woven", workspaceRoot);
  await Deno.writeTextFile(
    join(workspaceRoot, "alice-data.ttl"),
    `@base <${MESH_ALICE_BIO_BASE}> .
@prefix schema: <https://schema.org/> .
@prefix sflo: <https://semantic-flow.github.io/sflo/ontology/> .

<alice/data> schema:about <bob>, <carol>, <bob/_knop>, <_mesh>, <bob/index.html>, <bob/source.ttl> ;
  schema:mentions [
    schema:name "Blank node support is intentionally ignored"
  ] .

<alice> schema:name "Alice" .
<carol> schema:name "Carol" .
<bob/_knop> a sflo:Knop .
<_mesh> a sflo:SemanticMesh .
<bob/index.html> a sflo:ResourcePage .
<bob/source.ttl> a sflo:LocatedFile .
`,
  );

  const result = await executeExtractAllTerms({
    workspaceRoot,
    request: {
      sourceDesignatorPath: "alice/data",
    },
  });

  assertEquals(result.extractedDesignatorPaths, ["bob", "carol"]);
  assertEquals(result.skippedExistingDesignatorPaths, ["alice", "alice/data"]);
  assertEquals(
    result.skippedSupportDesignatorPaths,
    ["_mesh", "bob/_knop", "bob/index.html", "bob/source.ttl"],
  );
  assertEquals(
    [...result.createdPaths].sort(),
    [
      "bob/_knop/_inventory/inventory.ttl",
      "bob/_knop/_meta/meta.ttl",
      "bob/_knop/_sources/sources.ttl",
      "carol/_knop/_inventory/inventory.ttl",
      "carol/_knop/_meta/meta.ttl",
      "carol/_knop/_sources/sources.ttl",
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

async function runGit(cwd: string, args: readonly string[]): Promise<void> {
  const command = new Deno.Command("git", {
    args: [...args],
    cwd,
    stdout: "piped",
    stderr: "piped",
  });
  const output = await command.output();
  if (!output.success) {
    throw new Error(new TextDecoder().decode(output.stderr));
  }
}

Deno.test("executeExtractAllTerms skips LocatedFile IRIs reached through file-link predicates", async () => {
  const workspaceRoot = await createTestTmpDir(
    "weave-extract-all-terms-located-files-",
  );
  await materializeMeshAliceBioBranch("11-alice-bio-v2-woven", workspaceRoot);
  await Deno.writeTextFile(
    join(workspaceRoot, "alice-data.ttl"),
    `@base <${MESH_ALICE_BIO_BASE}> .
@prefix dcat: <http://www.w3.org/ns/dcat#> .
@prefix schema: <https://schema.org/> .
@prefix sflo: <https://semantic-flow.github.io/sflo/ontology/> .

<alice/data> schema:about <release>, <release/ttl>, <release/ttl/source.ttl>, <release/ttl/alternate.ttl>, <release/html/index.html> .

<release> schema:name "Release" .
<release/ttl> dcat:downloadURL <release/ttl/source.ttl> ;
  schema:contentUrl <release/ttl/alternate.ttl> .

<release/ttl/source.ttl> a sflo:LocatedFile .
<release/ttl/alternate.ttl> a sflo:LocatedFile .
<release/html/index.html> a sflo:ResourcePage, sflo:LocatedFile .
`,
  );

  const result = await executeExtractAllTerms({
    workspaceRoot,
    request: {
      sourceDesignatorPath: "alice/data",
      addSourceReferences: true,
      referenceRole: "canonical",
    },
  });

  assertEquals(result.extractedDesignatorPaths, ["release", "release/ttl"]);
  assertEquals(result.sourceReferencedDesignatorPaths, [
    "release",
    "release/ttl",
  ]);
  assertEquals(result.skippedExistingDesignatorPaths, ["alice/data"]);
  assertEquals(
    result.skippedSupportDesignatorPaths,
    [
      "release/html/index.html",
      "release/ttl/alternate.ttl",
      "release/ttl/source.ttl",
    ],
  );
  await assertRejects(
    () => Deno.stat(join(workspaceRoot, "release/ttl/source.ttl/_knop")),
    Deno.errors.NotFound,
  );
  await assertRejects(
    () => Deno.stat(join(workspaceRoot, "release/ttl/alternate.ttl/_knop")),
    Deno.errors.NotFound,
  );
});

Deno.test("executeExtractAllTerms skips unsafe LocatedFile IRIs before designator validation", async () => {
  const workspaceRoot = await createTestTmpDir(
    "weave-extract-all-terms-unsafe-located-file-",
  );
  await materializeMeshAliceBioBranch("11-alice-bio-v2-woven", workspaceRoot);
  await Deno.writeTextFile(
    join(workspaceRoot, "alice-data.ttl"),
    `@base <${MESH_ALICE_BIO_BASE}> .
@prefix schema: <https://schema.org/> .
@prefix sflo: <https://semantic-flow.github.io/sflo/ontology/> .

<alice/data> schema:about <bob>, <bob/source.ttl?rev=1> .
<bob> schema:name "Bob" .
<bob/source.ttl?rev=1> a sflo:LocatedFile .
`,
  );

  const result = await executeExtractAllTerms({
    workspaceRoot,
    request: {
      sourceDesignatorPath: "alice/data",
    },
  });

  assertEquals(result.extractedDesignatorPaths, ["bob"]);
  assertEquals(result.skippedSupportDesignatorPaths, [
    "bob/source.ttl?rev=1",
  ]);
});

Deno.test("executeExtractAllTerms creates source references only for newly extracted terms", async () => {
  const workspaceRoot = await createTestTmpDir(
    "weave-extract-all-terms-references-",
  );
  await materializeMeshAliceBioBranch("11-alice-bio-v2-woven", workspaceRoot);
  await Deno.writeTextFile(
    join(workspaceRoot, "alice-data.ttl"),
    `@base <${MESH_ALICE_BIO_BASE}> .
@prefix schema: <https://schema.org/> .

<alice/data> schema:about <bob>, <carol> .
<carol> schema:name "Carol" .
`,
  );

  const result = await executeExtractAllTerms({
    workspaceRoot,
    request: {
      sourceDesignatorPath: "alice/data",
      addSourceReferences: true,
      referenceRole: "canonical",
    },
  });

  assertEquals(result.extractedDesignatorPaths, ["bob", "carol"]);
  assertEquals(result.sourceReferencesRequested, true);
  assertEquals(result.sourceReferencedDesignatorPaths, ["bob", "carol"]);
  assertEquals(
    result.sourceReferenceRoleIri,
    "https://semantic-flow.github.io/sflo/ontology/referenceRole_canonical",
  );
  assertEquals(
    [...result.sourceReferenceCreatedPaths].sort(),
    [
      "bob/_knop/_references/references.ttl",
      "carol/_knop/_references/references.ttl",
    ],
  );
  assertEquals(
    [...result.createdPaths].sort(),
    [
      "bob/_knop/_inventory/inventory.ttl",
      "bob/_knop/_meta/meta.ttl",
      "bob/_knop/_references/references.ttl",
      "bob/_knop/_sources/sources.ttl",
      "carol/_knop/_inventory/inventory.ttl",
      "carol/_knop/_meta/meta.ttl",
      "carol/_knop/_references/references.ttl",
      "carol/_knop/_sources/sources.ttl",
    ],
  );
  assertEquals(result.updatedPaths, ["_mesh/_inventory/inventory.ttl"]);

  const bobReferencesPath = join(
    workspaceRoot,
    "bob/_knop/_references/references.ttl",
  );
  const bobReferencesTurtle = await Deno.readTextFile(bobReferencesPath);
  assertStringIncludes(
    bobReferencesTurtle,
    "<bob> sflo:hasReferenceLink <bob/_knop/_references#reference001> .",
  );
  assertStringIncludes(
    bobReferencesTurtle,
    "sflo:hasReferenceRole <https://semantic-flow.github.io/sflo/ontology/referenceRole_canonical> ;",
  );
  assertStringIncludes(
    bobReferencesTurtle,
    "sflo:hasReferenceSource <bob/_knop/_references#reference001-source> .",
  );
  assertStringIncludes(
    bobReferencesTurtle,
    "sflo:targetArtifact <alice/data> .",
  );
  assertFalse(bobReferencesTurtle.includes("sflo:targetHistoricalState"));
  const bobInventoryAfterExtractAll = await Deno.readTextFile(
    join(workspaceRoot, "bob/_knop/_inventory/inventory.ttl"),
  );
  assertStringIncludes(
    bobInventoryAfterExtractAll,
    "sflo:hasReferenceCatalog <bob/_knop/_references>",
  );
  assertFalse(
    bobInventoryAfterExtractAll.includes(
      "<https://semantic-flow.github.io/sflo/ontology/hasReferenceCatalog>",
    ),
  );

  await executeWeave({
    meshRoot: workspaceRoot,
    request: { targets: [{ designatorPath: "bob" }] },
    now: () => new Date("2026-05-04T00:00:00.000Z"),
  });

  const bobInventoryAfterWeave = await Deno.readTextFile(
    join(workspaceRoot, "bob/_knop/_inventory/inventory.ttl"),
  );
  assertStringIncludes(
    bobInventoryAfterWeave,
    "sflo:hasReferenceCatalog <bob/_knop/_references>",
  );
  assertFalse(
    bobInventoryAfterWeave.includes(
      "<https://semantic-flow.github.io/sflo/ontology/hasReferenceCatalog>",
    ),
  );
  const bobPageHtml = await Deno.readTextFile(
    join(workspaceRoot, "bob/index.html"),
  );
  assertStringIncludes(bobPageHtml, '<details class="wf-references">');
  assertStringIncludes(bobPageHtml, "<summary>Canonical</summary>");
  assertStringIncludes(
    bobPageHtml,
    '<li><a href="https://semantic-flow.github.io/mesh-alice-bio/alice/data">https://semantic-flow.github.io/mesh-alice-bio/alice/data</a></li>',
  );

  const rerunResult = await executeExtractAllTerms({
    workspaceRoot,
    request: {
      sourceDesignatorPath: "alice/data",
      addSourceReferences: true,
      referenceRole: "canonical",
    },
  });

  assertEquals(rerunResult.extractedDesignatorPaths, []);
  assertEquals(rerunResult.sourceReferencedDesignatorPaths, []);
  assertEquals(rerunResult.sourceReferenceCreatedPaths, []);
  assertEquals(rerunResult.createdPaths, []);
  assertEquals(rerunResult.updatedPaths, []);
  assertEquals(
    await Deno.readTextFile(bobReferencesPath),
    bobReferencesTurtle,
  );
});

Deno.test("executeExtractAllTerms records exact source references when extracting from a source state", async () => {
  const workspaceRoot = await createTestTmpDir(
    "weave-extract-all-terms-exact-references-",
  );
  await materializeMeshAliceBioBranch("11-alice-bio-v2-woven", workspaceRoot);

  const result = await executeExtractAllTerms({
    workspaceRoot,
    request: {
      sourceStatePath: "alice/data/_history001/_s0002",
      addSourceReferences: true,
      referenceRole: "canonical",
    },
  });

  assertEquals(result.sourceResolutionMode, "exact");
  assertEquals(result.sourceDesignatorPath, "alice/data");
  assertEquals(result.extractedDesignatorPaths, ["alice/bio", "bob"]);
  assertEquals(result.sourceReferencedDesignatorPaths, ["alice/bio", "bob"]);
  assertEquals(
    result.sourceReferenceTargetStateIri,
    "https://semantic-flow.github.io/mesh-alice-bio/alice/data/_history001/_s0002",
  );

  for (const designatorPath of result.sourceReferencedDesignatorPaths) {
    const referencesTurtle = await Deno.readTextFile(
      join(workspaceRoot, `${designatorPath}/_knop/_references/references.ttl`),
    );
    assertStringIncludes(
      referencesTurtle,
      "sflo:targetArtifact <alice/data> ;\n  sflo:targetHistoricalState <alice/data/_history001/_s0002> .",
    );
  }
});

Deno.test("executeExtractAllTerms with source-state does not require working source resolution", async () => {
  const workspaceRoot = await createTestTmpDir(
    "weave-extract-all-terms-exact-local-state-",
  );
  await materializeMeshAliceBioBranch("11-alice-bio-v2-woven", workspaceRoot);

  const inventoryPath = join(
    workspaceRoot,
    "alice/data/_knop/_inventory/inventory.ttl",
  );
  const inventoryTurtle = await Deno.readTextFile(inventoryPath);
  await Deno.writeTextFile(
    inventoryPath,
    inventoryTurtle.replace(
      "sflo:hasWorkingLocatedFile <alice-data.ttl> ;",
      `sflo:hasRepositorySourceFloatingLocator [
    a sflo:RepositorySourceFloatingLocator ;
    sflo:sourceRepositoryUrl "https://example.invalid/alice.git" ;
    sflo:sourceRepositoryPathFromRoot "alice-data.ttl"
  ] ;`,
    ),
  );

  const result = await executeExtractAllTerms({
    workspaceRoot,
    request: {
      sourceStatePath: "alice/data/_history001/_s0002",
      addSourceReferences: true,
      referenceRole: "canonical",
    },
  });

  assertEquals(result.sourceResolutionMode, "exact");
  assertEquals(result.sourceDesignatorPath, "alice/data");
  assertEquals(result.extractedDesignatorPaths, ["alice/bio", "bob"]);
});

Deno.test("executeExtractAllTerms fails closed for unsafe mesh-scoped term IRIs", async () => {
  const workspaceRoot = await createTestTmpDir(
    "weave-extract-all-terms-unsafe-",
  );
  await materializeMeshAliceBioBranch("11-alice-bio-v2-woven", workspaceRoot);
  await Deno.writeTextFile(
    join(workspaceRoot, "alice-data.ttl"),
    `@base <${MESH_ALICE_BIO_BASE}> .
@prefix schema: <https://schema.org/> .

<alice/data> schema:about <bad#fragment> .
`,
  );

  await assertRejects(
    () =>
      executeExtractAllTerms({
        workspaceRoot,
        request: {
          sourceDesignatorPath: "alice/data",
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
    "a.07-shacl-integrated-woven",
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
        `docs/${designatorPath}/_knop/_sources/sources.ttl`,
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
        "a.08-ontology-and-shacl-terms-extracted",
        path,
      ),
      path,
    );
  }
  assertEquals(
    (await Deno.readTextFile(
      join(
        workspaceRoot,
        "docs/ontology/AbilityScore/_knop/_sources/sources.ttl",
      ),
    )).includes("artifactResolutionMode_working"),
    true,
  );
  assertEquals(
    (await Deno.readTextFile(
      join(
        workspaceRoot,
        "docs/ontology/CharacterShape/_knop/_sources/sources.ttl",
      ),
    )).includes("sflo:targetArtifact <shacl>"),
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
    "a.07-shacl-integrated-woven",
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

Deno.test("executeSetExtractionSource replaces an existing exact source binding with working", async () => {
  const workspaceRoot = await createTestTmpDir("weave-set-extraction-source-");
  await materializeMeshAliceBioBranch("11-alice-bio-v2-woven", workspaceRoot);

  await executeExtract({
    workspaceRoot,
    request: {
      designatorPath: "bob",
      sourceStatePath: "alice/data/_history001/_s0002",
    },
  });
  const sourcesPath = join(workspaceRoot, "bob/_knop/_sources/sources.ttl");
  await Deno.writeTextFile(
    sourcesPath,
    (await Deno.readTextFile(sourcesPath)).replace(
      " a sflo:ExtractionSource ;",
      " <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> sflo:ExtractionSource ;",
    ),
  );

  const result = await executeSetExtractionSource({
    workspaceRoot,
    request: {
      designatorPath: "bob",
      sourceDesignatorPath: "alice/data",
    },
  });

  assertEquals(result.sourceResolutionMode, "working");
  assertEquals(result.updatedPaths, ["bob/_knop/_sources/sources.ttl"]);
  const sourcesTurtle = await Deno.readTextFile(sourcesPath);
  const inventoryTurtle = await Deno.readTextFile(
    join(workspaceRoot, "bob/_knop/_inventory/inventory.ttl"),
  );
  assertEquals(
    sourcesTurtle.includes("artifactResolutionMode_working"),
    true,
  );
  assertEquals(
    sourcesTurtle.includes("targetHistoricalState"),
    false,
  );
  assertEquals(
    sourcesTurtle.match(
      /^<bob\/_knop\/_sources#extraction-source-observation-001>/gm,
    )?.length,
    1,
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
