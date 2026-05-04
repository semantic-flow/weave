import {
  assert,
  assertEquals,
  assertRejects,
  assertStringIncludes,
} from "@std/assert";
import { join } from "@std/path";
import { compareRdfContent } from "../../dependencies/github.com/spectacular-voyage/accord/src/checker/compare_rdf.ts";
import { WeaveInputError } from "../../src/core/weave/weave.ts";
import { executeKnopCreate } from "../../src/runtime/knop/create.ts";
import { executeMeshCreate } from "../../src/runtime/mesh/create.ts";
import {
  executeWeave,
  WeaveRuntimeError,
} from "../../src/runtime/weave/weave.ts";
import {
  materializeMeshAliceBioBranch,
  readMeshAliceBioBranchFile,
} from "../support/mesh_alice_bio_fixture.ts";
import {
  MESH_ALICE_BIO_BASE,
  writeEquivalentMeshMetadata,
} from "../support/mesh_metadata.ts";
import { integrateRootPayload } from "../support/root_designator.ts";
import { createTestTmpDir } from "../support/test_tmp.ts";

Deno.test("executeWeave materializes current support ResourcePages for a docs-rooted sidecar mesh", async () => {
  const workspaceRoot = await createTestTmpDir("weave-weave-sidecar-support-");
  await executeMeshCreate({
    workspaceRoot,
    meshRoot: "docs",
    request: {
      meshBase: "https://semantic-flow.github.io/mesh-sidecar-fantasy-rules/",
    },
  });

  const result = await executeWeave({
    meshRoot: join(workspaceRoot, "docs"),
  });

  assertEquals(result.wovenDesignatorPaths, []);
  assertEquals(
    [...result.createdPaths].sort(),
    [
      "docs/_mesh/_config/_history001/_s0001/config-ttl/config.ttl",
      "docs/_mesh/_config/index.html",
      "docs/_mesh/_config/_history001/index.html",
      "docs/_mesh/_config/_history001/_s0001/index.html",
      "docs/_mesh/_config/_history001/_s0001/config-ttl/index.html",
      "docs/_mesh/_inventory/_history001/_s0001/inventory-ttl/inventory.ttl",
      "docs/_mesh/_inventory/index.html",
      "docs/_mesh/_inventory/_history001/index.html",
      "docs/_mesh/_inventory/_history001/_s0001/index.html",
      "docs/_mesh/_inventory/_history001/_s0001/inventory-ttl/index.html",
      "docs/_mesh/_meta/_history001/_s0001/meta-ttl/meta.ttl",
      "docs/_mesh/_meta/index.html",
      "docs/_mesh/_meta/_history001/index.html",
      "docs/_mesh/_meta/_history001/_s0001/index.html",
      "docs/_mesh/_meta/_history001/_s0001/meta-ttl/index.html",
      "docs/_mesh/index.html",
    ].sort(),
  );
  assertEquals(result.updatedPaths, ["docs/_mesh/_inventory/inventory.ttl"]);
  const inventory = await Deno.readTextFile(
    join(workspaceRoot, "docs/_mesh/_inventory/inventory.ttl"),
  );
  assertStringIncludes(
    inventory,
    "sfcfg:hasConfig <_mesh/_config> ;\n  sflo:hasResourcePage <_mesh/index.html> .",
  );
  assertStringIncludes(
    inventory,
    "sflo:hasWorkingLocatedFile <_mesh/_config/config.ttl> ;\n  sflo:hasResourcePage <_mesh/_config/index.html> ;\n  sflo:hasArtifactHistory <_mesh/_config/_history001> ;",
  );
  await Deno.stat(join(workspaceRoot, "docs/_mesh/_config/index.html"));
});

Deno.test("executeWeave matches the settled alice knop-created-woven fixture", async () => {
  const workspaceRoot = await createTestTmpDir("weave-weave-first-");
  await materializeMeshAliceBioBranch("04-alice-knop-created", workspaceRoot);

  const result = await executeWeave({
    meshRoot: workspaceRoot,
  });

  assertEquals(result.wovenDesignatorPaths, ["alice"]);
  assert(result.updatedPaths.includes("_mesh/_inventory/inventory.ttl"));
  assert(result.updatedPaths.includes("alice/_knop/_inventory/inventory.ttl"));
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
  await Deno.stat(join(workspaceRoot, "alice/index.html"));
  assertEquals(
    await Deno.readTextFile(join(workspaceRoot, "alice-bio.ttl")),
    await readMeshAliceBioBranchFile(
      "05-alice-knop-created-woven",
      "alice-bio.ttl",
    ),
  );
});

Deno.test("executeWeave supports the exact root target", async () => {
  const workspaceRoot = await createTestTmpDir("weave-weave-root-");
  await materializeMeshAliceBioBranch(
    "05-alice-knop-created-woven",
    workspaceRoot,
  );
  await integrateRootPayload(workspaceRoot);

  const result = await executeWeave({
    meshRoot: workspaceRoot,
    request: {
      targets: [{ designatorPath: "" }],
    },
  });

  assertEquals(result.wovenDesignatorPaths, [""]);
  assert(result.createdPaths.includes("index.html"));
  assert(result.createdPaths.includes("_knop/_meta/_history001/index.html"));
  assert(result.updatedPaths.includes("_mesh/_inventory/inventory.ttl"));
  assert(result.updatedPaths.includes("_knop/_inventory/inventory.ttl"));
  await Deno.stat(join(workspaceRoot, "index.html"));
  await Deno.stat(join(workspaceRoot, "_knop/index.html"));
  assertStringIncludes(
    await Deno.readTextFile(
      join(workspaceRoot, "_mesh/_inventory/inventory.ttl"),
    ),
    `sflo:hasKnop <_knop> ;
  sflo:hasResourcePage <_mesh/index.html> .`,
  );
  assertStringIncludes(
    await Deno.readTextFile(
      join(workspaceRoot, "_knop/_inventory/inventory.ttl"),
    ),
    `<> a sflo:PayloadArtifact, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasArtifactHistory <_history001> ;`,
  );
});

Deno.test("executeWeave supports a later first root Knop weave against a carried mesh state", async () => {
  const workspaceRoot = await createTestTmpDir("weave-weave-root-knop-later-");
  await materializeMeshAliceBioBranch(
    "21-bob-page-imported-source-woven",
    workspaceRoot,
  );

  await executeKnopCreate({
    workspaceRoot,
    request: {
      designatorPath: "",
    },
  });

  const result = await executeWeave({
    meshRoot: workspaceRoot,
    request: {
      targets: [{ designatorPath: "" }],
    },
  });

  assertEquals(result.wovenDesignatorPaths, [""]);
  assert(
    result.createdPaths.includes(
      "_mesh/_inventory/_history001/_s0006/inventory-ttl/inventory.ttl",
    ),
  );
  assert(
    result.createdPaths.includes(
      "_knop/_inventory/_history001/_s0001/inventory-ttl/inventory.ttl",
    ),
  );
  assert(result.updatedPaths.includes("_mesh/_inventory/inventory.ttl"));
  assert(result.updatedPaths.includes("_knop/_inventory/inventory.ttl"));
  await Deno.stat(join(workspaceRoot, "index.html"));
  await Deno.stat(join(workspaceRoot, "_knop/index.html"));
  assertStringIncludes(
    await Deno.readTextFile(
      join(workspaceRoot, "_mesh/_inventory/inventory.ttl"),
    ),
    "sflo:latestHistoricalState <_mesh/_inventory/_history001/_s0006> ;",
  );
  assertStringIncludes(
    await Deno.readTextFile(
      join(workspaceRoot, "_mesh/_inventory/inventory.ttl"),
    ),
    "<>\n  sflo:hasResourcePage <index.html> .",
  );
});

Deno.test("executeWeave validates malformed shared target requests before planning", async () => {
  const workspaceRoot = await createTestTmpDir("weave-weave-invalid-target-");
  await materializeMeshAliceBioBranch("06-alice-bio-integrated", workspaceRoot);

  const request = {
    targets: [null],
  } as unknown as Parameters<typeof executeWeave>[0]["request"];

  await assertRejects(
    () =>
      executeWeave({
        meshRoot: workspaceRoot,
        request,
      }),
    WeaveInputError,
    "request.targets[0] must be an object",
  );
});

Deno.test("executeWeave matches the settled alice bio integrated-woven fixture", async () => {
  const workspaceRoot = await createTestTmpDir("weave-weave-payload-");
  await materializeMeshAliceBioBranch("06-alice-bio-integrated", workspaceRoot);

  const result = await executeWeave({
    meshRoot: workspaceRoot,
    request: {
      targets: [{ designatorPath: "alice/bio" }],
    },
  });

  assertEquals(result.wovenDesignatorPaths, ["alice/bio"]);
  assert(result.updatedPaths.includes("_mesh/_inventory/inventory.ttl"));
  assert(
    result.updatedPaths.includes("alice/bio/_knop/_inventory/inventory.ttl"),
  );
  assertEquals(
    await Deno.readTextFile(
      join(workspaceRoot, "_mesh/_inventory/inventory.ttl"),
    ),
    await readMeshAliceBioBranchFile(
      "07-alice-bio-integrated-woven",
      "_mesh/_inventory/inventory.ttl",
    ),
  );
  assertEquals(
    await Deno.readTextFile(
      join(workspaceRoot, "alice/bio/_knop/_inventory/inventory.ttl"),
    ),
    await readMeshAliceBioBranchFile(
      "07-alice-bio-integrated-woven",
      "alice/bio/_knop/_inventory/inventory.ttl",
    ),
  );
  await Deno.stat(join(workspaceRoot, "alice/bio/index.html"));
  assertEquals(
    await Deno.readTextFile(
      join(
        workspaceRoot,
        "alice/bio/_history001/_s0001/alice-bio-ttl/alice-bio.ttl",
      ),
    ),
    await Deno.readTextFile(join(workspaceRoot, "alice-bio.ttl")),
  );
});

Deno.test("executeWeave batches recursive targets through validate, version, and generate", async () => {
  const workspaceRoot = await createTestTmpDir("weave-weave-recursive-");
  await materializeMeshAliceBioBranch("04-alice-knop-created", workspaceRoot);
  await addSupplementalKnopToMeshInventory(workspaceRoot, "alice/bio");
  await addSupplementalPayloadArtifactToMeshInventory(
    workspaceRoot,
    "alice/bio",
    "alice-bio.ttl",
  );
  await writeSupplementalKnopSurface(
    workspaceRoot,
    "alice/bio",
    `@base <https://semantic-flow.github.io/mesh-alice-bio/> .
@prefix sflo: <https://semantic-flow.github.io/semantic-flow-ontology/> .

<alice/bio/_knop> a sflo:Knop ;
  sflo:hasKnopMetadata <alice/bio/_knop/_meta> ;
  sflo:hasKnopInventory <alice/bio/_knop/_inventory> ;
  sflo:hasWorkingKnopInventoryFile <alice/bio/_knop/_inventory/inventory.ttl> ;
  sflo:hasPayloadArtifact <alice/bio> .

<alice/bio> a sflo:PayloadArtifact, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasWorkingLocatedFile <alice-bio.ttl> .
`,
  );

  const result = await executeWeave({
    meshRoot: workspaceRoot,
    request: {
      targets: [{ designatorPath: "alice", recursive: true }],
    },
  });

  assertEquals(result.wovenDesignatorPaths, ["alice", "alice/bio"]);
  assertStringIncludes(
    await Deno.readTextFile(
      join(workspaceRoot, "_mesh/_inventory/inventory.ttl"),
    ),
    `sflo:hasKnop <alice/bio/_knop> ;
  sflo:hasResourcePage <_mesh/index.html> .`,
  );
  assertStringIncludes(
    await Deno.readTextFile(
      join(workspaceRoot, "_mesh/_inventory/inventory.ttl"),
    ),
    `sflo:latestHistoricalState <_mesh/_inventory/_history001/_s0003> ;
  sflo:nextStateOrdinal "4"^^xsd:nonNegativeInteger ;`,
  );
  assertStringIncludes(
    await Deno.readTextFile(
      join(workspaceRoot, "alice/_knop/_inventory/inventory.ttl"),
    ),
    `sflo:currentArtifactHistory <alice/_knop/_inventory/_history001> ;
  sflo:nextHistoryOrdinal "2"^^xsd:nonNegativeInteger ;`,
  );
  assertStringIncludes(
    await Deno.readTextFile(
      join(workspaceRoot, "alice/bio/_knop/_inventory/inventory.ttl"),
    ),
    `sflo:currentArtifactHistory <alice/bio/_history001> ;
  sflo:nextHistoryOrdinal "2"^^xsd:nonNegativeInteger ;`,
  );
  assertStringIncludes(
    await Deno.readTextFile(
      join(workspaceRoot, "alice/bio/_knop/_inventory/inventory.ttl"),
    ),
    `sflo:latestHistoricalState <alice/bio/_history001/_s0001> ;
  sflo:nextStateOrdinal "2"^^xsd:nonNegativeInteger ;`,
  );
  await Deno.stat(join(workspaceRoot, "alice/index.html"));
  await Deno.stat(join(workspaceRoot, "alice/bio/index.html"));
});

Deno.test("executeWeave honors requested payload history and state naming", async () => {
  const workspaceRoot = await createTestTmpDir("weave-weave-payload-custom-");
  await materializeMeshAliceBioBranch("06-alice-bio-integrated", workspaceRoot);

  const result = await executeWeave({
    meshRoot: workspaceRoot,
    request: {
      targets: [{
        designatorPath: "alice/bio",
        historySegment: "releases",
        stateSegment: "v0.0.1",
        manifestationSegment: "ttl",
      }],
    },
  });

  assertEquals(result.wovenDesignatorPaths, ["alice/bio"]);
  assert(
    result.createdPaths.includes(
      "alice/bio/releases/v0.0.1/ttl/alice-bio.ttl",
    ),
  );
  assertEquals(
    await Deno.readTextFile(
      join(
        workspaceRoot,
        "alice/bio/releases/v0.0.1/ttl/alice-bio.ttl",
      ),
    ),
    await Deno.readTextFile(join(workspaceRoot, "alice-bio.ttl")),
  );
  await Deno.stat(join(workspaceRoot, "alice/bio/releases/index.html"));
  await Deno.stat(join(workspaceRoot, "alice/bio/releases/v0.0.1/index.html"));
  await assertRejects(
    () =>
      Deno.stat(
        join(
          workspaceRoot,
          "alice/bio/_history001/_s0001/ttl/alice-bio.ttl",
        ),
      ),
    Deno.errors.NotFound,
  );
});

Deno.test("executeWeave forwards targets to generate and leaves unrelated pages untouched", async () => {
  const workspaceRoot = await createTestTmpDir(
    "weave-weave-targeted-generate-",
  );
  await materializeMeshAliceBioBranch("06-alice-bio-integrated", workspaceRoot);

  await Deno.writeTextFile(
    join(workspaceRoot, "alice/index.html"),
    "<html>sentinel</html>\n",
  );

  const result = await executeWeave({
    meshRoot: workspaceRoot,
    request: {
      targets: [{ designatorPath: "alice/bio" }],
    },
  });

  assertEquals(result.wovenDesignatorPaths, ["alice/bio"]);
  assertEquals(
    await Deno.readTextFile(join(workspaceRoot, "alice/index.html")),
    "<html>sentinel</html>\n",
  );
  await Deno.stat(join(workspaceRoot, "alice/bio/index.html"));
});

Deno.test("executeWeave matches the settled alice bio referenced-woven fixture", async () => {
  const workspaceRoot = await createTestTmpDir(
    "weave-weave-reference-catalog-",
  );
  await materializeMeshAliceBioBranch("08-alice-bio-referenced", workspaceRoot);

  const result = await executeWeave({
    meshRoot: workspaceRoot,
  });

  assertEquals(result.wovenDesignatorPaths, ["alice"]);
  assert(result.updatedPaths.includes("alice/_knop/_inventory/inventory.ttl"));
  assertEquals(
    await Deno.readTextFile(
      join(workspaceRoot, "alice/_knop/_inventory/inventory.ttl"),
    ),
    await readMeshAliceBioBranchFile(
      "09-alice-bio-referenced-woven",
      "alice/_knop/_inventory/inventory.ttl",
    ),
  );
  assertEquals(
    await Deno.readTextFile(
      join(
        workspaceRoot,
        "alice/_knop/_inventory/_history001/_s0002/inventory-ttl/inventory.ttl",
      ),
    ),
    await readMeshAliceBioBranchFile(
      "09-alice-bio-referenced-woven",
      "alice/_knop/_inventory/_history001/_s0002/inventory-ttl/inventory.ttl",
    ),
  );
  assertEquals(
    await Deno.readTextFile(
      join(workspaceRoot, "alice/_knop/_references/references.ttl"),
    ),
    await readMeshAliceBioBranchFile(
      "09-alice-bio-referenced-woven",
      "alice/_knop/_references/references.ttl",
    ),
  );
  assertEquals(
    await Deno.readTextFile(
      join(
        workspaceRoot,
        "alice/_knop/_references/_history001/_s0001/references-ttl/references.ttl",
      ),
    ),
    await Deno.readTextFile(
      join(workspaceRoot, "alice/_knop/_references/references.ttl"),
    ),
  );
  await Deno.stat(join(workspaceRoot, "alice/_knop/_references/index.html"));
  assertEquals(
    await Deno.readTextFile(
      join(workspaceRoot, "_mesh/_inventory/inventory.ttl"),
    ),
    await readMeshAliceBioBranchFile(
      "09-alice-bio-referenced-woven",
      "_mesh/_inventory/inventory.ttl",
    ),
  );
});

Deno.test("executeWeave matches the settled alice page-customized-woven fixture", async () => {
  const workspaceRoot = await createTestTmpDir("weave-weave-page-definition-");
  await materializeMeshAliceBioBranch(
    "14-alice-page-customized",
    workspaceRoot,
  );

  const result = await executeWeave({
    meshRoot: workspaceRoot,
    request: {
      targets: [{ designatorPath: "alice" }],
    },
  });

  assertEquals(result.wovenDesignatorPaths, ["alice"]);
  assert(
    result.createdPaths.includes(
      "alice/_knop/_page/_history001/_s0001/page-ttl/page.ttl",
    ),
  );
  assert(
    result.createdPaths.includes(
      "alice/_knop/_inventory/_history001/_s0003/inventory-ttl/inventory.ttl",
    ),
  );
  assert(result.updatedPaths.includes("alice/_knop/_inventory/inventory.ttl"));
  assert(
    result.createdPaths.includes("alice/index.html") ||
      result.updatedPaths.includes("alice/index.html"),
  );
  assertEquals(
    await compareRdfContent({
      left: new TextEncoder().encode(
        await Deno.readTextFile(
          join(workspaceRoot, "alice/_knop/_inventory/inventory.ttl"),
        ),
      ),
      right: new TextEncoder().encode(
        await readMeshAliceBioBranchFile(
          "15-alice-page-customized-woven",
          "alice/_knop/_inventory/inventory.ttl",
        ),
      ),
      path: "alice/_knop/_inventory/inventory.ttl",
    }),
    true,
  );
  assertStringIncludes(
    await Deno.readTextFile(join(workspaceRoot, "alice/index.html")),
    `<link rel="stylesheet" href="./_knop/_assets/alice.css">`,
  );
  assertStringIncludes(
    await Deno.readTextFile(join(workspaceRoot, "alice/index.html")),
    `<p>This identifier page is customized by <code>alice/_knop/_page/page.ttl</code>.</p>`,
  );
  assertStringIncludes(
    await Deno.readTextFile(join(workspaceRoot, "alice/index.html")),
    `<a href="./_knop/_page">./_knop/_page</a>`,
  );
  const pageDefinitionHtml = await Deno.readTextFile(
    join(workspaceRoot, "alice/_knop/_page/index.html"),
  );
  assertStringIncludes(pageDefinitionHtml, "<h1>alice/_knop/_page</h1>");
  assertStringIncludes(
    pageDefinitionHtml,
    "Resource page for the alice ResourcePageDefinition artifact.",
  );
  assertStringIncludes(
    pageDefinitionHtml,
    'href="https://semantic-flow.github.io/mesh-alice-bio/alice/_knop/_page"',
  );
});

Deno.test("executeWeave resolves current artifact-backed page sources through hasTargetArtifact", async () => {
  const workspaceRoot = await createTestTmpDir(
    "weave-weave-page-definition-artifact-source-",
  );
  await materializeMeshAliceBioBranch(
    "14-alice-page-customized",
    workspaceRoot,
  );
  await Deno.writeTextFile(
    join(workspaceRoot, "artifact-sidebar.md"),
    `Artifact-backed sidebar

- from governed source
`,
  );
  await addArtifactBackedPageSource(
    workspaceRoot,
    "alice/source",
    `@base <https://semantic-flow.github.io/mesh-alice-bio/> .
@prefix sflo: <https://semantic-flow.github.io/semantic-flow-ontology/> .

<alice/source/_knop> a sflo:Knop ;
  sflo:hasKnopMetadata <alice/source/_knop/_meta> ;
  sflo:hasKnopInventory <alice/source/_knop/_inventory> ;
  sflo:hasWorkingKnopInventoryFile <alice/source/_knop/_inventory/inventory.ttl> ;
  sflo:hasPayloadArtifact <alice/source> .

<alice/source> a sflo:PayloadArtifact, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasWorkingLocatedFile <artifact-sidebar.md> .
`,
    "artifact-sidebar.md",
  );
  await replaceAliceSidebarPageSource(
    workspaceRoot,
    `<#sidebar-source> a sfc:ResourcePageSource ;
  sfc:hasTargetArtifact <https://semantic-flow.github.io/mesh-alice-bio/alice/source> ;
  sfc:hasArtifactResolutionMode <https://semantic-flow.github.io/ontology/core/ArtifactResolutionMode/Current> .`,
  );

  const result = await executeWeave({
    meshRoot: workspaceRoot,
    request: {
      targets: [{ designatorPath: "alice" }],
    },
  });

  assertEquals(result.wovenDesignatorPaths, ["alice"]);
  assertStringIncludes(
    await Deno.readTextFile(join(workspaceRoot, "alice/index.html")),
    "Artifact-backed sidebar",
  );
  assertStringIncludes(
    await Deno.readTextFile(join(workspaceRoot, "alice/index.html")),
    "from governed source",
  );
});

Deno.test("executeWeave versions a later page-definition revision that repoints Alice to alice/page-main", async () => {
  const workspaceRoot = await createTestTmpDir(
    "weave-weave-page-definition-follow-on-",
  );
  await materializeMeshAliceBioBranch(
    "17-alice-page-main-integrated-woven",
    workspaceRoot,
  );
  await replaceFileText(
    join(workspaceRoot, "alice/_knop/_page/page.ttl"),
    `<#main-source> a sfc:ResourcePageSource ;
  sfc:targetLocalRelativePath "alice/alice.md" .`,
    `<#main-source> a sfc:ResourcePageSource ;
  sfc:hasTargetArtifact <https://semantic-flow.github.io/mesh-alice-bio/alice/page-main> ;
  sfc:hasArtifactResolutionMode <https://semantic-flow.github.io/ontology/core/ArtifactResolutionMode/Current> .`,
  );

  const result = await executeWeave({
    meshRoot: workspaceRoot,
    request: {
      targets: [{ designatorPath: "alice" }],
    },
  });

  assertEquals(result.wovenDesignatorPaths, ["alice"]);
  assert(result.createdPaths.includes(
    "alice/_knop/_page/_history001/_s0002/page-ttl/page.ttl",
  ));
  assert(result.createdPaths.includes(
    "alice/_knop/_inventory/_history001/_s0004/inventory-ttl/inventory.ttl",
  ));
  assert(result.updatedPaths.includes("alice/_knop/_inventory/inventory.ttl"));
  assertStringIncludes(
    await Deno.readTextFile(join(workspaceRoot, "alice/index.html")),
    "governed Markdown source for Alice's main page region",
  );
  assertStringIncludes(
    await Deno.readTextFile(
      join(workspaceRoot, "alice/_knop/_inventory/inventory.ttl"),
    ),
    "sflo:latestHistoricalState <alice/_knop/_page/_history001/_s0002> ;",
  );
  assertStringIncludes(
    await Deno.readTextFile(
      join(workspaceRoot, "alice/_knop/_inventory/inventory.ttl"),
    ),
    "sflo:latestHistoricalState <alice/_knop/_inventory/_history001/_s0004> ;",
  );
});

Deno.test("executeWeave versions the first root page-definition revision", async () => {
  const workspaceRoot = await createTestTmpDir(
    "weave-weave-root-page-definition-",
  );
  await materializeMeshAliceBioBranch("24-root-page-customized", workspaceRoot);

  const result = await executeWeave({
    meshRoot: workspaceRoot,
    request: {
      targets: [{ designatorPath: "" }],
    },
  });

  assertEquals(result.wovenDesignatorPaths, [""]);
  assert(result.createdPaths.includes(
    "_knop/_page/_history001/_s0001/page-ttl/page.ttl",
  ));
  assert(result.createdPaths.includes(
    "_knop/_inventory/_history001/_s0002/inventory-ttl/inventory.ttl",
  ));
  assert(result.updatedPaths.includes("_knop/_inventory/inventory.ttl"));
  assertStringIncludes(
    await Deno.readTextFile(join(workspaceRoot, "index.html")),
    "Tour of the repo",
  );
  assertStringIncludes(
    await Deno.readTextFile(join(workspaceRoot, "index.html")),
    "Knop-backed identifiers",
  );
  assertStringIncludes(
    await Deno.readTextFile(join(workspaceRoot, "index.html")),
    "./_knop/_assets/site.css",
  );
  assertStringIncludes(
    await Deno.readTextFile(
      join(workspaceRoot, "_knop/_inventory/inventory.ttl"),
    ),
    "sflo:latestHistoricalState <_knop/_page/_history001/_s0001> ;",
  );
  assertStringIncludes(
    await Deno.readTextFile(
      join(workspaceRoot, "_knop/_inventory/inventory.ttl"),
    ),
    "sflo:latestHistoricalState <_knop/_inventory/_history001/_s0002> ;",
  );
  await assertRejects(
    () => Deno.stat(join(workspaceRoot, "_knop/_references/index.html")),
    Deno.errors.NotFound,
  );
});

Deno.test("executeWeave resolves artifact-backed page sources through workingLocalRelativePath when repo policy permits them", async () => {
  const repoRoot = await createTestTmpDir(
    "weave-weave-page-definition-artifact-working-file-allow-",
  );
  const workspaceRoot = join(repoRoot, "mesh");
  await materializeMeshAliceBioBranch(
    "14-alice-page-customized",
    workspaceRoot,
  );
  await Deno.mkdir(join(repoRoot, "documentation"), { recursive: true });
  await Deno.mkdir(join(workspaceRoot, "_mesh/_config"), { recursive: true });
  await Deno.writeTextFile(
    join(workspaceRoot, "_mesh/_config/config.ttl"),
    `@prefix sfcfg: <https://semantic-flow.github.io/ontology/config/> .

<> a sfcfg:MeshConfig ;
  sfcfg:workspaceRootRelativeToMeshRoot "../" ;
  sfcfg:hasLocalPathAccessRule [
    a sfcfg:LocalPathAccessRule ;
    sfcfg:hasLocalPathBase <https://semantic-flow.github.io/ontology/config/meshRootPathBase> ;
    sfcfg:pathPrefix "../documentation/" ;
    sfcfg:hasLocalPathLocatorKind <https://semantic-flow.github.io/ontology/config/workingLocalRelativePathLocatorKind>
  ] .
`,
  );
  await Deno.writeTextFile(
    join(repoRoot, "documentation/sidebar.md"),
    `Policy-backed artifact sidebar

- from extra-mesh workingLocalRelativePath
`,
  );
  await addArtifactBackedPageSource(
    workspaceRoot,
    "alice/source",
    `@base <https://semantic-flow.github.io/mesh-alice-bio/> .
@prefix sflo: <https://semantic-flow.github.io/semantic-flow-ontology/> .

<alice/source/_knop> a sflo:Knop ;
  sflo:hasKnopMetadata <alice/source/_knop/_meta> ;
  sflo:hasKnopInventory <alice/source/_knop/_inventory> ;
  sflo:hasWorkingKnopInventoryFile <alice/source/_knop/_inventory/inventory.ttl> ;
  sflo:hasPayloadArtifact <alice/source> .

<alice/source> a sflo:PayloadArtifact, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:workingLocalRelativePath "../documentation/sidebar.md" .
`,
    "../documentation/sidebar.md",
  );
  await replaceAliceSidebarPageSource(
    workspaceRoot,
    `<#sidebar-source> a sfc:ResourcePageSource ;
  sfc:hasTargetArtifact <https://semantic-flow.github.io/mesh-alice-bio/alice/source> .`,
  );

  const result = await executeWeave({
    meshRoot: workspaceRoot,
    request: {
      targets: [{ designatorPath: "alice" }],
    },
  });

  assertEquals(result.wovenDesignatorPaths, ["alice"]);
  assertStringIncludes(
    await Deno.readTextFile(join(workspaceRoot, "alice/index.html")),
    "Policy-backed artifact sidebar",
  );
  assertStringIncludes(
    await Deno.readTextFile(join(workspaceRoot, "alice/index.html")),
    "extra-mesh workingLocalRelativePath",
  );
});

Deno.test("executeWeave fails closed when artifact-backed page sources request pinned resolution", async () => {
  const workspaceRoot = await createTestTmpDir(
    "weave-weave-page-definition-artifact-pinned-",
  );
  await materializeMeshAliceBioBranch(
    "14-alice-page-customized",
    workspaceRoot,
  );
  await Deno.writeTextFile(
    join(workspaceRoot, "artifact-sidebar.md"),
    "Artifact-backed sidebar\n",
  );
  await addArtifactBackedPageSource(
    workspaceRoot,
    "alice/source",
    `@base <https://semantic-flow.github.io/mesh-alice-bio/> .
@prefix sflo: <https://semantic-flow.github.io/semantic-flow-ontology/> .

<alice/source/_knop> a sflo:Knop ;
  sflo:hasKnopMetadata <alice/source/_knop/_meta> ;
  sflo:hasKnopInventory <alice/source/_knop/_inventory> ;
  sflo:hasWorkingKnopInventoryFile <alice/source/_knop/_inventory/inventory.ttl> ;
  sflo:hasPayloadArtifact <alice/source> .

<alice/source> a sflo:PayloadArtifact, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasWorkingLocatedFile <artifact-sidebar.md> .
`,
    "artifact-sidebar.md",
  );
  await replaceAliceSidebarPageSource(
    workspaceRoot,
    `<#sidebar-source> a sfc:ResourcePageSource ;
  sfc:hasTargetArtifact <https://semantic-flow.github.io/mesh-alice-bio/alice/source> ;
  sfc:hasArtifactResolutionMode <https://semantic-flow.github.io/ontology/core/ArtifactResolutionMode/Pinned> .`,
  );

  await assertRejects(
    () =>
      executeWeave({
        meshRoot: workspaceRoot,
        request: {
          targets: [{ designatorPath: "alice" }],
        },
      }),
    WeaveRuntimeError,
    "non-Current artifact resolution mode",
  );
});

Deno.test("executeWeave resolves payload current files from workingLocalRelativePath literals", async () => {
  const workspaceRoot = await createTestTmpDir(
    "weave-weave-working-file-path-",
  );
  await materializeMeshAliceBioBranch("10-alice-bio-updated", workspaceRoot);
  await replaceFileText(
    join(workspaceRoot, "alice/bio/_knop/_inventory/inventory.ttl"),
    `sflo:hasWorkingLocatedFile <alice-bio.ttl> ;`,
    `sflo:workingLocalRelativePath "alice-bio.ttl" ;`,
  );

  const result = await executeWeave({
    meshRoot: workspaceRoot,
    request: {
      targets: [{ designatorPath: "alice/bio" }],
    },
  });

  assertEquals(result.wovenDesignatorPaths, ["alice/bio"]);
  assert(
    result.updatedPaths.includes("alice/bio/_knop/_inventory/inventory.ttl"),
  );
  assertStringIncludes(
    await Deno.readTextFile(join(workspaceRoot, "alice/bio/index.html")),
    `../../alice-bio.ttl`,
  );
});

Deno.test("executeWeave resolves page definitions from workingLocalRelativePath literals", async () => {
  const workspaceRoot = await createTestTmpDir(
    "weave-weave-page-definition-working-file-path-",
  );
  await materializeMeshAliceBioBranch(
    "14-alice-page-customized",
    workspaceRoot,
  );
  await replaceFileText(
    join(workspaceRoot, "alice/_knop/_inventory/inventory.ttl"),
    `sflo:hasWorkingLocatedFile <alice/_knop/_page/page.ttl> .`,
    `sflo:workingLocalRelativePath "alice/_knop/_page/page.ttl" .`,
  );

  const result = await executeWeave({
    meshRoot: workspaceRoot,
    request: {
      targets: [{ designatorPath: "alice" }],
    },
  });

  assertEquals(result.wovenDesignatorPaths, ["alice"]);
  assertStringIncludes(
    await Deno.readTextFile(join(workspaceRoot, "alice/index.html")),
    `<p>This identifier page is customized by <code>alice/_knop/_page/page.ttl</code>.</p>`,
  );
});

Deno.test("executeWeave fails closed when targetLocalRelativePath escapes the mesh root without operational policy", async () => {
  const repoRoot = await createTestTmpDir("weave-weave-target-mesh-path-deny-");
  const workspaceRoot = join(repoRoot, "mesh");
  await materializeMeshAliceBioBranch(
    "14-alice-page-customized",
    workspaceRoot,
  );
  await Deno.mkdir(join(repoRoot, "documentation"), { recursive: true });
  await Deno.writeTextFile(
    join(repoRoot, "documentation/sidebar.md"),
    "Repo-level sidebar\n",
  );
  await replaceAliceSidebarPageSource(
    workspaceRoot,
    `<#sidebar-source> a sfc:ResourcePageSource ;
  sfc:targetLocalRelativePath "../documentation/sidebar.md" .`,
  );

  await assertRejects(
    () =>
      executeWeave({
        meshRoot: workspaceRoot,
        request: {
          targets: [{ designatorPath: "alice" }],
        },
      }),
    WeaveRuntimeError,
    "outside the allowed local-path boundary",
  );
});

Deno.test("executeWeave allows repo-adjacent targetLocalRelativePath values when repo policy permits them", async () => {
  const repoRoot = await createTestTmpDir(
    "weave-weave-target-mesh-path-allow-",
  );
  const workspaceRoot = join(repoRoot, "mesh");
  await materializeMeshAliceBioBranch(
    "14-alice-page-customized",
    workspaceRoot,
  );
  await Deno.mkdir(join(repoRoot, "documentation"), { recursive: true });
  await Deno.mkdir(join(workspaceRoot, "_mesh/_config"), { recursive: true });
  await Deno.writeTextFile(
    join(workspaceRoot, "_mesh/_config/config.ttl"),
    `@prefix sfcfg: <https://semantic-flow.github.io/ontology/config/> .

<> a sfcfg:MeshConfig ;
  sfcfg:workspaceRootRelativeToMeshRoot "../" ;
  sfcfg:hasLocalPathAccessRule [
    a sfcfg:LocalPathAccessRule ;
    sfcfg:hasLocalPathBase <https://semantic-flow.github.io/ontology/config/meshRootPathBase> ;
    sfcfg:pathPrefix "../documentation/" ;
    sfcfg:hasLocalPathLocatorKind <https://semantic-flow.github.io/ontology/config/targetLocalRelativePathLocatorKind>
  ] .
`,
  );
  await Deno.writeTextFile(
    join(repoRoot, "documentation/sidebar.md"),
    "Repo-level sidebar\n\n- sibling source\n",
  );
  await replaceAliceSidebarPageSource(
    workspaceRoot,
    `<#sidebar-source> a sfc:ResourcePageSource ;
  sfc:targetLocalRelativePath "../documentation/sidebar.md" .`,
  );

  const result = await executeWeave({
    meshRoot: workspaceRoot,
    request: {
      targets: [{ designatorPath: "alice" }],
    },
  });

  assertEquals(result.wovenDesignatorPaths, ["alice"]);
  assertStringIncludes(
    await Deno.readTextFile(join(workspaceRoot, "alice/index.html")),
    "Repo-level sidebar",
  );
});

Deno.test("executeWeave allows repo-adjacent workingLocalRelativePath values when repo policy permits them", async () => {
  const repoRoot = await createTestTmpDir("weave-weave-working-file-allow-");
  const workspaceRoot = join(repoRoot, "mesh");
  await materializeMeshAliceBioBranch("10-alice-bio-updated", workspaceRoot);
  await Deno.mkdir(join(repoRoot, "documentation"), { recursive: true });
  await Deno.mkdir(join(workspaceRoot, "_mesh/_config"), { recursive: true });
  await Deno.writeTextFile(
    join(workspaceRoot, "_mesh/_config/config.ttl"),
    `@prefix sfcfg: <https://semantic-flow.github.io/ontology/config/> .

<> a sfcfg:MeshConfig ;
  sfcfg:workspaceRootRelativeToMeshRoot "../" ;
  sfcfg:hasLocalPathAccessRule [
    a sfcfg:LocalPathAccessRule ;
    sfcfg:hasLocalPathBase <https://semantic-flow.github.io/ontology/config/meshRootPathBase> ;
    sfcfg:pathPrefix "../documentation/" ;
    sfcfg:hasLocalPathLocatorKind <https://semantic-flow.github.io/ontology/config/workingLocalRelativePathLocatorKind>
  ] .
`,
  );
  const sharedPayloadPath = join(repoRoot, "documentation/alice-bio.ttl");
  await Deno.writeTextFile(
    sharedPayloadPath,
    await Deno.readTextFile(join(workspaceRoot, "alice-bio.ttl")),
  );
  await replaceFileText(
    join(workspaceRoot, "alice/bio/_knop/_inventory/inventory.ttl"),
    `sflo:hasWorkingLocatedFile <alice-bio.ttl> ;`,
    `sflo:workingLocalRelativePath "../documentation/alice-bio.ttl" ;`,
  );

  const result = await executeWeave({
    meshRoot: workspaceRoot,
    request: {
      targets: [{ designatorPath: "alice/bio" }],
    },
  });

  assertEquals(result.wovenDesignatorPaths, ["alice/bio"]);
  const updatedInventory = await Deno.readTextFile(
    join(workspaceRoot, "alice/bio/_knop/_inventory/inventory.ttl"),
  );
  assertStringIncludes(
    updatedInventory,
    `sflo:workingLocalRelativePath "../documentation/alice-bio.ttl" ;`,
  );
  assert(
    !updatedInventory.includes(
      `sflo:hasWorkingLocatedFile <../documentation/alice-bio.ttl> ;`,
    ),
  );
  assertEquals(
    await Deno.readTextFile(
      join(
        workspaceRoot,
        "alice/bio/_history001/_s0002/alice-bio-ttl/alice-bio.ttl",
      ),
    ),
    await Deno.readTextFile(sharedPayloadPath),
  );
});

Deno.test("executeWeave materializes the second alice bio payload weave slice", async () => {
  const workspaceRoot = await createTestTmpDir("weave-weave-payload-v2-");
  await materializeMeshAliceBioBranch("10-alice-bio-updated", workspaceRoot);

  const result = await executeWeave({
    meshRoot: workspaceRoot,
    request: {
      targets: [{ designatorPath: "alice/bio" }],
    },
  });

  assertEquals(result.wovenDesignatorPaths, ["alice/bio"]);
  assert(
    result.updatedPaths.includes("alice/bio/_knop/_inventory/inventory.ttl"),
  );
  assert(
    result.createdPaths.includes(
      "alice/bio/_knop/_inventory/_history001/_s0002/inventory-ttl/inventory.ttl",
    ),
  );
  assert(
    result.createdPaths.includes(
      "alice/bio/_history001/_s0002/alice-bio-ttl/alice-bio.ttl",
    ),
  );
  assertEquals(
    await Deno.readTextFile(
      join(workspaceRoot, "alice/bio/_knop/_inventory/inventory.ttl"),
    ),
    await readMeshAliceBioBranchFile(
      "11-alice-bio-v2-woven",
      "alice/bio/_knop/_inventory/inventory.ttl",
    ),
  );
  assertEquals(
    await Deno.readTextFile(
      join(
        workspaceRoot,
        "alice/bio/_history001/_s0002/alice-bio-ttl/alice-bio.ttl",
      ),
    ),
    await Deno.readTextFile(join(workspaceRoot, "alice-bio.ttl")),
  );
  assertEquals(
    await Deno.readTextFile(
      join(
        workspaceRoot,
        "alice/bio/_knop/_inventory/_history001/_s0002/inventory-ttl/inventory.ttl",
      ),
    ),
    await Deno.readTextFile(
      join(workspaceRoot, "alice/bio/_knop/_inventory/inventory.ttl"),
    ),
  );
  await Deno.stat(
    join(workspaceRoot, "alice/bio/_history001/_s0002/index.html"),
  );
  await Deno.stat(
    join(
      workspaceRoot,
      "alice/bio/_history001/_s0002/alice-bio-ttl/index.html",
    ),
  );
  await Deno.stat(
    join(
      workspaceRoot,
      "alice/bio/_knop/_inventory/_history001/_s0002/index.html",
    ),
  );
  await Deno.stat(
    join(
      workspaceRoot,
      "alice/bio/_knop/_inventory/_history001/_s0002/inventory-ttl/index.html",
    ),
  );
  assertEquals(
    await Deno.readTextFile(
      join(workspaceRoot, "_mesh/_inventory/inventory.ttl"),
    ),
    await readMeshAliceBioBranchFile(
      "11-alice-bio-v2-woven",
      "_mesh/_inventory/inventory.ttl",
    ),
  );
});

Deno.test("executeWeave materializes the extracted bob woven slice", async () => {
  const workspaceRoot = await createTestTmpDir("weave-weave-bob-extracted-");
  await materializeMeshAliceBioBranch("12-bob-extracted", workspaceRoot);

  const result = await executeWeave({
    meshRoot: workspaceRoot,
    request: {
      targets: [{ designatorPath: "bob" }],
    },
  });

  assertEquals(result.wovenDesignatorPaths, ["bob"]);
  assert(result.updatedPaths.includes("_mesh/_inventory/inventory.ttl"));
  assert(result.updatedPaths.includes("bob/_knop/_inventory/inventory.ttl"));
  assert(
    result.createdPaths.includes(
      "_mesh/_inventory/_history001/_s0004/inventory-ttl/inventory.ttl",
    ),
  );
  assert(
    result.createdPaths.includes(
      "bob/_knop/_meta/_history001/_s0001/meta-ttl/meta.ttl",
    ),
  );
  assert(
    result.createdPaths.includes(
      "bob/_knop/_references/_history001/_s0001/references-ttl/references.ttl",
    ),
  );
  assertEquals(
    await Deno.readTextFile(
      join(workspaceRoot, "_mesh/_inventory/inventory.ttl"),
    ),
    await readMeshAliceBioBranchFile(
      "13-bob-extracted-woven",
      "_mesh/_inventory/inventory.ttl",
    ),
  );
  assertEquals(
    await Deno.readTextFile(
      join(workspaceRoot, "bob/_knop/_inventory/inventory.ttl"),
    ),
    await readMeshAliceBioBranchFile(
      "13-bob-extracted-woven",
      "bob/_knop/_inventory/inventory.ttl",
    ),
  );
  assertEquals(
    await Deno.readTextFile(
      join(
        workspaceRoot,
        "bob/_knop/_meta/_history001/_s0001/meta-ttl/meta.ttl",
      ),
    ),
    await readMeshAliceBioBranchFile(
      "13-bob-extracted-woven",
      "bob/_knop/_meta/_history001/_s0001/meta-ttl/meta.ttl",
    ),
  );
  assertEquals(
    await Deno.readTextFile(
      join(
        workspaceRoot,
        "bob/_knop/_references/_history001/_s0001/references-ttl/references.ttl",
      ),
    ),
    await readMeshAliceBioBranchFile(
      "13-bob-extracted-woven",
      "bob/_knop/_references/_history001/_s0001/references-ttl/references.ttl",
    ),
  );
  await Deno.stat(
    join(workspaceRoot, "_mesh/_inventory/_history001/index.html"),
  );
  await Deno.stat(join(workspaceRoot, "alice/index.html"));
  await Deno.stat(join(workspaceRoot, "bob/index.html"));
  assertEquals(
    await Deno.readTextFile(join(workspaceRoot, "alice-bio.ttl")),
    await readMeshAliceBioBranchFile(
      "13-bob-extracted-woven",
      "alice-bio.ttl",
    ),
  );
});

Deno.test("executeWeave fails closed when bob's woven source payload has no current history", async () => {
  const workspaceRoot = await createTestTmpDir(
    "weave-weave-bob-extracted-missing-history-",
  );
  await materializeMeshAliceBioBranch("12-bob-extracted", workspaceRoot);

  await replaceFileText(
    join(workspaceRoot, "alice/bio/_knop/_inventory/inventory.ttl"),
    `sflo:currentArtifactHistory <alice/bio/_history001> ;
  sflo:nextHistoryOrdinal "2"^^xsd:nonNegativeInteger ;`,
    `sflo:nextHistoryOrdinal "2"^^xsd:nonNegativeInteger ;`,
  );

  await assertRejects(
    () =>
      executeWeave({
        meshRoot: workspaceRoot,
        request: {
          targets: [{ designatorPath: "bob" }],
        },
      }),
    WeaveInputError,
    "missing a woven current payload history",
  );
});

Deno.test("executeWeave fails closed when a created weave target already exists", async () => {
  const workspaceRoot = await createTestTmpDir("weave-weave-existing-");
  await materializeMeshAliceBioBranch("04-alice-knop-created", workspaceRoot);
  await Deno.mkdir(
    join(
      workspaceRoot,
      "alice/_knop/_meta/_history001/_s0001/meta-ttl",
    ),
    { recursive: true },
  );
  await Deno.writeTextFile(
    join(
      workspaceRoot,
      "alice/_knop/_meta/_history001/_s0001/meta-ttl/meta.ttl",
    ),
    "existing\n",
  );

  await assertRejects(
    () =>
      executeWeave({
        meshRoot: workspaceRoot,
      }),
    WeaveRuntimeError,
    "already exists",
  );
});

Deno.test("executeWeave ignores settled Knops before loading missing working artifacts", async () => {
  const workspaceRoot = await createTestTmpDir("weave-weave-settled-ignore-");
  await materializeMeshAliceBioBranch("04-alice-knop-created", workspaceRoot);
  await addSupplementalKnopToMeshInventory(workspaceRoot, "bob/bio");
  await writeSupplementalKnopSurface(
    workspaceRoot,
    "bob/bio",
    `@base <https://semantic-flow.github.io/mesh-alice-bio/> .
@prefix sflo: <https://semantic-flow.github.io/semantic-flow-ontology/> .

<bob/bio/_knop> a sflo:Knop ;
  sflo:hasKnopMetadata <bob/bio/_knop/_meta> ;
  sflo:hasKnopInventory <bob/bio/_knop/_inventory> ;
  sflo:hasWorkingKnopInventoryFile <bob/bio/_knop/_inventory/inventory.ttl> ;
  sflo:hasPayloadArtifact <bob/bio> .

<bob/bio> a sflo:PayloadArtifact, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasArtifactHistory <bob/bio/_history001> ;
  sflo:hasWorkingLocatedFile <missing-bob-bio.ttl> .

<bob/bio/_knop/_inventory> a sflo:KnopInventory, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasArtifactHistory <bob/bio/_knop/_inventory/_history001> .
`,
  );

  const result = await executeWeave({
    meshRoot: workspaceRoot,
  });

  assertEquals(result.wovenDesignatorPaths, ["alice"]);
});

Deno.test("executeWeave ignores non-requested weave candidates before loading working artifacts", async () => {
  const workspaceRoot = await createTestTmpDir("weave-weave-requested-ignore-");
  await materializeMeshAliceBioBranch("04-alice-knop-created", workspaceRoot);
  await addSupplementalKnopToMeshInventory(workspaceRoot, "bob/bio");
  await writeSupplementalKnopSurface(
    workspaceRoot,
    "bob/bio",
    `@base <https://semantic-flow.github.io/mesh-alice-bio/> .
@prefix sflo: <https://semantic-flow.github.io/semantic-flow-ontology/> .

<bob/bio/_knop> a sflo:Knop ;
  sflo:hasKnopMetadata <bob/bio/_knop/_meta> ;
  sflo:hasKnopInventory <bob/bio/_knop/_inventory> ;
  sflo:hasWorkingKnopInventoryFile <bob/bio/_knop/_inventory/inventory.ttl> ;
  sflo:hasPayloadArtifact <bob/bio> .

<bob/bio> a sflo:PayloadArtifact, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasWorkingLocatedFile <missing-bob-bio.ttl> .
`,
  );

  const result = await executeWeave({
    meshRoot: workspaceRoot,
    request: {
      targets: [{ designatorPath: "alice" }],
    },
  });

  assertEquals(result.wovenDesignatorPaths, ["alice"]);
});

Deno.test("executeWeave accepts semantically equivalent mesh metadata turtle", async () => {
  const workspaceRoot = await createTestTmpDir("weave-weave-metadata-");
  await materializeMeshAliceBioBranch("04-alice-knop-created", workspaceRoot);
  await writeEquivalentMeshMetadata(workspaceRoot);

  const result = await executeWeave({
    meshRoot: workspaceRoot,
  });

  assertEquals(result.meshBase, MESH_ALICE_BIO_BASE);
  assertEquals(result.wovenDesignatorPaths, ["alice"]);
});

async function addSupplementalKnopToMeshInventory(
  workspaceRoot: string,
  designatorPath: string,
): Promise<void> {
  const meshInventoryPath = join(
    workspaceRoot,
    "_mesh/_inventory/inventory.ttl",
  );
  const current = await Deno.readTextFile(meshInventoryPath);
  await Deno.writeTextFile(
    meshInventoryPath,
    `${current.trimEnd()}

<${designatorPath}/_knop> a sflo:Knop ;
  sflo:hasWorkingKnopInventoryFile <${designatorPath}/_knop/_inventory/inventory.ttl> .
`,
  );
}

async function addSupplementalPayloadArtifactToMeshInventory(
  workspaceRoot: string,
  designatorPath: string,
  workingLocalRelativePath: string,
): Promise<void> {
  const meshInventoryPath = join(
    workspaceRoot,
    "_mesh/_inventory/inventory.ttl",
  );
  const current = await Deno.readTextFile(meshInventoryPath);
  await Deno.writeTextFile(
    meshInventoryPath,
    `${current.trimEnd()}

<${designatorPath}> a sflo:PayloadArtifact, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasWorkingLocatedFile <${workingLocalRelativePath}> .
`,
  );
}

async function writeSupplementalKnopSurface(
  workspaceRoot: string,
  designatorPath: string,
  inventoryTurtle: string,
): Promise<void> {
  const knopPath = join(workspaceRoot, `${designatorPath}/_knop`);
  await Deno.mkdir(join(knopPath, "_meta"), { recursive: true });
  await Deno.mkdir(join(knopPath, "_inventory"), { recursive: true });
  await Deno.writeTextFile(
    join(knopPath, "_meta/meta.ttl"),
    `@base <https://semantic-flow.github.io/mesh-alice-bio/> .
@prefix sflo: <https://semantic-flow.github.io/semantic-flow-ontology/> .

<${designatorPath}/_knop> a sflo:Knop ;
  sflo:designatorPath "${designatorPath}" ;
  sflo:hasWorkingKnopInventoryFile <${designatorPath}/_knop/_inventory/inventory.ttl> .
`,
  );
  await Deno.writeTextFile(
    join(knopPath, "_inventory/inventory.ttl"),
    inventoryTurtle,
  );
}

async function addArtifactBackedPageSource(
  workspaceRoot: string,
  designatorPath: string,
  inventoryTurtle: string,
  workingLocalRelativePath: string,
): Promise<void> {
  await addSupplementalKnopToMeshInventory(workspaceRoot, designatorPath);
  await addSupplementalPayloadArtifactToMeshInventory(
    workspaceRoot,
    designatorPath,
    workingLocalRelativePath,
  );
  await writeSupplementalKnopSurface(
    workspaceRoot,
    designatorPath,
    inventoryTurtle,
  );
}

const ALICE_SIDEBAR_TARGET_MESH_PATH_SOURCE =
  `<#sidebar-source> a sfc:ResourcePageSource ;
  sfc:targetLocalRelativePath "mesh-content/sidebar.md" .`;

async function replaceAliceSidebarPageSource(
  workspaceRoot: string,
  after: string,
): Promise<void> {
  await replaceFileText(
    join(workspaceRoot, "alice/_knop/_page/page.ttl"),
    ALICE_SIDEBAR_TARGET_MESH_PATH_SOURCE,
    after,
  );
}

async function replaceFileText(
  path: string,
  before: string,
  after: string,
): Promise<void> {
  const current = await Deno.readTextFile(path);
  if (!current.includes(before)) {
    throw new Error(`Failed to find expected text in ${path}`);
  }
  await Deno.writeTextFile(path, current.replace(before, after));
}
