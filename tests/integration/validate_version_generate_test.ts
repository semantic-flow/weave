import {
  assert,
  assertEquals,
  assertFalse,
  assertRejects,
  assertStringIncludes,
} from "@std/assert";
import { join } from "@std/path";
import { compareRdfContent } from "../../dependencies/github.com/spectacular-voyage/accord/src/checker/compare_rdf.ts";
import { WeaveInputError } from "../../src/core/weave/weave.ts";
import {
  executeGenerate,
  executeValidate,
  executeVersion as executeRuntimeVersion,
  type ExecuteVersionOptions,
  executeWeave,
} from "../../src/runtime/weave/weave.ts";
import { executeMeshCreate } from "../../src/runtime/mesh/create.ts";
import {
  isMeshAliceBioMeshRoot,
  materializeMeshAliceBioBranch,
  MESH_ALICE_BIO_HISTORY_TRACKING_POLICY,
  readMeshAliceBioBranchFile,
} from "../support/mesh_alice_bio_fixture.ts";
import {
  bootstrapRootWovenWorkspace,
  integrateRootPayload,
} from "../support/root_designator.ts";
import { createTestTmpDir } from "../support/test_tmp.ts";

async function executeVersion(options: ExecuteVersionOptions) {
  if (
    options.historyTrackingPolicyOverride !== undefined ||
    !(await isMeshAliceBioMeshRoot(options.meshRoot))
  ) {
    return await executeRuntimeVersion(options);
  }

  return await executeRuntimeVersion({
    ...options,
    historyTrackingPolicyOverride: MESH_ALICE_BIO_HISTORY_TRACKING_POLICY,
  });
}

Deno.test("executeValidate returns structured findings for version-only target fields", async () => {
  const workspaceRoot = await createTestTmpDir("weave-validate-target-fields-");
  await materializeMeshAliceBioBranch("06-alice-bio-integrated", workspaceRoot);

  const request = {
    targets: [{
      designatorPath: "alice/data",
      stateSegment: "v0.0.1",
    }],
  } as unknown as Parameters<typeof executeValidate>[0]["request"];

  const result = await executeValidate({
    meshRoot: workspaceRoot,
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
      designatorPath: "alice/data",
      historySegment: "releases",
    }],
  } as unknown as Parameters<typeof executeGenerate>[0]["request"];

  await assertRejects(
    () =>
      executeGenerate({
        meshRoot: workspaceRoot,
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
    meshRoot: workspaceRoot,
    request: {
      targets: [{
        designatorPath: "alice/data",
        historySegment: "releases",
        stateSegment: "v0.0.1",
        manifestationSegment: "ttl",
      }],
    },
  });

  assertEquals(result.versionedDesignatorPaths, ["alice/data"]);
  assert(
    result.createdPaths.includes(
      "alice/data/releases/v0.0.1/ttl/alice-data.ttl",
    ),
  );
});

Deno.test("executeVersion reuses custom payload manifestation paths on the next payload version", async () => {
  const workspaceRoot = await createTestTmpDir(
    "weave-version-target-manifestation-",
  );
  await materializeMeshAliceBioBranch("06-alice-bio-integrated", workspaceRoot);

  await executeVersion({
    meshRoot: workspaceRoot,
    request: {
      targets: [{
        designatorPath: "alice/data",
        historySegment: "releases",
        stateSegment: "v0.0.1",
        manifestationSegment: "ttl",
      }],
    },
  });
  await Deno.writeTextFile(
    join(workspaceRoot, "alice-data.ttl"),
    `${await Deno.readTextFile(
      join(workspaceRoot, "alice-data.ttl"),
    )}\n<alice/data> <https://schema.org/version> \"2\" .\n`,
  );

  const result = await executeVersion({
    meshRoot: workspaceRoot,
    request: {
      targets: [{
        designatorPath: "alice/data",
        historySegment: "releases",
        stateSegment: "v0.0.2",
        manifestationSegment: "ttl",
      }],
    },
  });

  assertEquals(result.versionedDesignatorPaths, ["alice/data"]);
  assert(
    result.createdPaths.includes(
      "alice/data/releases/v0.0.2/ttl/alice-data.ttl",
    ),
  );
  assertEquals(
    await Deno.readTextFile(
      join(workspaceRoot, "alice/data/releases/v0.0.2/ttl/alice-data.ttl"),
    ),
    await Deno.readTextFile(join(workspaceRoot, "alice-data.ttl")),
  );
});

Deno.test("executeVersion fails closed before auto-advancing a named payload state", async () => {
  const workspaceRoot = await createTestTmpDir(
    "weave-version-named-state-requires-target-",
  );
  await materializeMeshAliceBioBranch("06-alice-bio-integrated", workspaceRoot);

  await executeVersion({
    meshRoot: workspaceRoot,
    request: {
      targets: [{
        designatorPath: "alice/data",
        historySegment: "releases",
        stateSegment: "v0.0.1",
        manifestationSegment: "ttl",
      }],
    },
  });
  await Deno.writeTextFile(
    join(workspaceRoot, "alice-data.ttl"),
    `${await Deno.readTextFile(
      join(workspaceRoot, "alice-data.ttl"),
    )}\n<alice/data> <https://schema.org/version> \"2\" .\n`,
  );

  await assertRejects(
    () =>
      executeVersion({
        meshRoot: workspaceRoot,
        request: {
          targets: [{ designatorPath: "alice/data" }],
        },
      }),
    WeaveInputError,
    "Provide stateSegment on the target",
  );
});

Deno.test("executeVersion fails closed on duplicate explicit payload state before writing", async () => {
  const workspaceRoot = await createTestTmpDir(
    "weave-version-duplicate-explicit-state-",
  );
  await materializeMeshAliceBioBranch("06-alice-bio-integrated", workspaceRoot);

  const request = {
    targets: [{
      designatorPath: "alice/data",
      historySegment: "releases",
      stateSegment: "v0.0.1",
      manifestationSegment: "ttl",
    }],
  };
  await executeVersion({
    meshRoot: workspaceRoot,
    request,
  });

  const inventoryPath = join(
    workspaceRoot,
    "alice/data/_knop/_inventory/inventory.ttl",
  );
  const snapshotPath = join(
    workspaceRoot,
    "alice/data/releases/v0.0.1/ttl/alice-data.ttl",
  );
  const inventoryBefore = await Deno.readTextFile(inventoryPath);
  const snapshotBefore = await Deno.readTextFile(snapshotPath);

  await assertRejects(
    () =>
      executeVersion({
        meshRoot: workspaceRoot,
        request,
      }),
    WeaveInputError,
    "already names the current historical state",
  );
  assertEquals(await Deno.readTextFile(inventoryPath), inventoryBefore);
  assertEquals(await Deno.readTextFile(snapshotPath), snapshotBefore);
});

Deno.test("executeVersion overwrites an explicit current payload state when requested", async () => {
  const workspaceRoot = await createTestTmpDir(
    "weave-version-overwrite-explicit-state-",
  );
  await materializeMeshAliceBioBranch("06-alice-bio-integrated", workspaceRoot);

  const target = {
    designatorPath: "alice/data",
    historySegment: "releases",
    stateSegment: "v0.0.1",
    manifestationSegment: "ttl",
  };
  await executeVersion({
    meshRoot: workspaceRoot,
    request: { targets: [target] },
  });

  const workingPayloadPath = join(workspaceRoot, "alice-data.ttl");
  const updatedPayload = `${await Deno.readTextFile(workingPayloadPath)}
<alice/data> <https://schema.org/version> "overwrite" .
`;
  await Deno.writeTextFile(workingPayloadPath, updatedPayload);

  const inventoryPath = join(
    workspaceRoot,
    "alice/data/_knop/_inventory/inventory.ttl",
  );
  const inventoryBefore = await Deno.readTextFile(inventoryPath);
  const result = await executeVersion({
    meshRoot: workspaceRoot,
    request: {
      targets: [target],
      overwriteExistingState: true,
    },
  });

  assertEquals(result.versionedDesignatorPaths, ["alice/data"]);
  assertEquals(result.createdPaths, []);
  assertEquals(result.updatedPaths, [
    "alice/data/releases/v0.0.1/ttl/alice-data.ttl",
  ]);
  assertEquals(
    await Deno.readTextFile(
      join(workspaceRoot, "alice/data/releases/v0.0.1/ttl/alice-data.ttl"),
    ),
    updatedPayload,
  );
  assertEquals(await Deno.readTextFile(inventoryPath), inventoryBefore);
});

Deno.test("executeVersion rejects overwrite without an explicit history and state", async () => {
  const workspaceRoot = await createTestTmpDir(
    "weave-version-overwrite-validation-",
  );
  await materializeMeshAliceBioBranch("06-alice-bio-integrated", workspaceRoot);

  await assertRejects(
    () =>
      executeVersion({
        meshRoot: workspaceRoot,
        request: {
          overwriteExistingState: true,
          targets: [{
            designatorPath: "alice/data",
            stateSegment: "v0.0.1",
          }],
        },
      }),
    WeaveInputError,
    "overwriteExistingState requires request.targets[0].historySegment",
  );
});

Deno.test("executeVersion rejects mixed requested targets when some are not currently weaveable", async () => {
  const workspaceRoot = await createTestTmpDir("weave-version-mixed-targets-");
  await materializeMeshAliceBioBranch("06-alice-bio-integrated", workspaceRoot);

  const meshInventoryBefore = await Deno.readTextFile(
    join(workspaceRoot, "_mesh/_inventory/inventory.ttl"),
  );
  const aliceBioInventoryBefore = await Deno.readTextFile(
    join(workspaceRoot, "alice/data/_knop/_inventory/inventory.ttl"),
  );

  await assertRejects(
    () =>
      executeVersion({
        meshRoot: workspaceRoot,
        request: {
          targets: [
            { designatorPath: "alice" },
            { designatorPath: "alice/data" },
          ],
        },
      }),
    WeaveInputError,
    "Requested targets are not currently weaveable: alice.",
  );

  assertEquals(
    await Deno.readTextFile(
      join(workspaceRoot, "_mesh/_inventory/inventory.ttl"),
    ),
    meshInventoryBefore,
  );
  assertEquals(
    await Deno.readTextFile(
      join(workspaceRoot, "alice/data/_knop/_inventory/inventory.ttl"),
    ),
    aliceBioInventoryBefore,
  );
  await assertRejects(
    () =>
      Deno.stat(
        join(
          workspaceRoot,
          "alice/data/_history001/_s0001/ttl/alice-data.ttl",
        ),
      ),
    Deno.errors.NotFound,
  );
});

Deno.test("executeValidate accepts the exact root target", async () => {
  const workspaceRoot = await createTestTmpDir("weave-validate-root-");
  await materializeMeshAliceBioBranch(
    "05-alice-knop-created-woven",
    workspaceRoot,
  );
  await integrateRootPayload(workspaceRoot);

  const result = await executeValidate({
    meshRoot: workspaceRoot,
    request: {
      targets: [{ designatorPath: "" }],
    },
  });

  assertEquals(result.validatedDesignatorPaths, [""]);
  assertEquals(result.findings, []);
});

Deno.test("executeValidate publication checks GitHub Pages .nojekyll", async () => {
  const workspaceRoot = await createTestTmpDir(
    "weave-validate-publication-",
  );
  await executeMeshCreate({
    workspaceRoot,
    request: {
      meshBase: "https://semantic-flow.github.io/mesh-alice-bio/",
      publicationProfile: "githubPages",
    },
  });

  const successResult = await executeValidate({
    meshRoot: workspaceRoot,
    scope: "publication",
  });

  assertEquals(successResult.scope, "publication");
  assertEquals(successResult.validatedDesignatorPaths, []);
  assertEquals(successResult.findings, []);

  await Deno.remove(join(workspaceRoot, ".nojekyll"));
  const failureResult = await executeValidate({
    meshRoot: workspaceRoot,
    scope: "publication",
  });

  assertEquals(failureResult.scope, "publication");
  assertEquals(failureResult.findings, [{
    severity: "error",
    message:
      "GitHub Pages publication profile requires .nojekyll at the mesh root.",
  }]);
});

Deno.test("executeValidate publication reports host-local path leakage", async () => {
  const workspaceRoot = await createTestTmpDir(
    "weave-validate-publication-leakage-",
  );
  await executeMeshCreate({
    workspaceRoot,
    request: {
      meshBase: "https://example.org/mesh/",
      publicationProfile: "none",
    },
  });
  await Deno.writeTextFile(
    join(workspaceRoot, "leaky.html"),
    `<a href="file://${workspaceRoot}/private.ttl">local</a>`,
  );
  await Deno.writeTextFile(
    join(workspaceRoot, "leaky.ttl"),
    `<> <https://example.org/path> "${workspaceRoot}/private.ttl" .`,
  );

  const result = await executeValidate({
    meshRoot: workspaceRoot,
    scope: "publication",
  });

  assertEquals(result.scope, "publication");
  assertEquals(result.findings, [
    {
      severity: "error",
      message: "Publication file leaky.html contains a host-local file URL.",
    },
    {
      severity: "error",
      message:
        "Publication file leaky.ttl contains an absolute host-local path.",
    },
  ]);
});

Deno.test("executeValidate mesh includes configured publication checks", async () => {
  const workspaceRoot = await createTestTmpDir(
    "weave-validate-mesh-publication-",
  );
  await materializeMeshAliceBioBranch("06-alice-bio-integrated", workspaceRoot);
  await Deno.mkdir(join(workspaceRoot, "_mesh/_config"), { recursive: true });
  await Deno.writeTextFile(
    join(workspaceRoot, "_mesh/_config/config.ttl"),
    `@prefix sfcfg: <https://semantic-flow.github.io/sflo/config/> .

<> a sfcfg:MeshConfig ;
  sfcfg:hasPublicationProfile sfcfg:publicationProfile_githubPages .
`,
  );
  try {
    await Deno.remove(join(workspaceRoot, ".nojekyll"));
  } catch (error) {
    if (!(error instanceof Deno.errors.NotFound)) {
      throw error;
    }
  }

  const result = await executeValidate({
    meshRoot: workspaceRoot,
    request: {
      targets: [{ designatorPath: "alice/data" }],
    },
  });

  assertEquals(result.scope, "mesh");
  assertEquals(result.validatedDesignatorPaths, ["alice/data"]);
  assertEquals(result.findings, [{
    severity: "error",
    message:
      "GitHub Pages publication profile requires .nojekyll at the mesh root.",
  }]);
});

Deno.test("executeValidate mesh reruns cleanly without writing files", async () => {
  const workspaceRoot = await createTestTmpDir("weave-validate-rerun-");
  await materializeMeshAliceBioBranch("13-bob-extracted-woven", workspaceRoot);

  const inventoryPath = join(workspaceRoot, "_mesh/_inventory/inventory.ttl");
  const pagePath = join(workspaceRoot, "alice/data/index.html");
  const inventoryBefore = await Deno.readTextFile(inventoryPath);
  const pageBefore = await Deno.readTextFile(pagePath);

  const firstResult = await executeValidate({
    meshRoot: workspaceRoot,
    scope: "mesh",
  });
  const secondResult = await executeValidate({
    meshRoot: workspaceRoot,
    scope: "mesh",
  });

  assertEquals(firstResult.findings, []);
  assertEquals(secondResult.findings, []);
  assertEquals(await Deno.readTextFile(inventoryPath), inventoryBefore);
  assertEquals(await Deno.readTextFile(pagePath), pageBefore);
});

Deno.test("executeWeave supports whole-mesh validation before and after weaving", async () => {
  const workspaceRoot = await createTestTmpDir("weave-validate-around-");
  await materializeMeshAliceBioBranch("06-alice-bio-integrated", workspaceRoot);

  const result = await executeWeave({
    meshRoot: workspaceRoot,
    request: {
      targets: [{ designatorPath: "alice/data" }],
    },
    validateBefore: true,
    validateAfter: true,
    historyTrackingPolicyOverride: MESH_ALICE_BIO_HISTORY_TRACKING_POLICY,
  });

  assertEquals(result.wovenDesignatorPaths, ["alice/data"]);
});

Deno.test("executeVersion accepts the exact root target", async () => {
  const workspaceRoot = await createTestTmpDir("weave-version-root-");
  await materializeMeshAliceBioBranch(
    "05-alice-knop-created-woven",
    workspaceRoot,
  );
  await integrateRootPayload(workspaceRoot);

  const result = await executeVersion({
    meshRoot: workspaceRoot,
    request: {
      targets: [{
        designatorPath: "",
        historySegment: "releases",
        stateSegment: "v0.0.1",
      }],
    },
  });

  assertEquals(result.versionedDesignatorPaths, [""]);
  assert(
    result.createdPaths.includes(
      "releases/v0.0.1/ttl/root.ttl",
    ),
  );
  await Deno.stat(join(workspaceRoot, "releases/v0.0.1/ttl/root.ttl"));
});

Deno.test("executeGenerate accepts the exact root target", async () => {
  const workspaceRoot = await createTestTmpDir("weave-generate-root-");
  await materializeMeshAliceBioBranch(
    "05-alice-knop-created-woven",
    workspaceRoot,
  );
  await bootstrapRootWovenWorkspace(workspaceRoot);

  const result = await executeGenerate({
    meshRoot: workspaceRoot,
    request: {
      targets: [{ designatorPath: "" }],
    },
  });

  assertEquals(result.generatedDesignatorPaths, [""]);
  await Deno.stat(join(workspaceRoot, "index.html"));
  await Deno.stat(join(workspaceRoot, "_knop/index.html"));
});

Deno.test("executeGenerate renders a mesh-root favicon when present", async () => {
  const workspaceRoot = await createTestTmpDir("weave-generate-favicon-");
  await materializeMeshAliceBioBranch(
    "07-alice-bio-integrated-woven",
    workspaceRoot,
  );
  await Deno.writeTextFile(join(workspaceRoot, "favicon.ico"), "test-icon");

  const result = await executeGenerate({
    meshRoot: workspaceRoot,
    request: {
      targets: [{ designatorPath: "alice/data" }],
    },
  });

  assertEquals(result.generatedDesignatorPaths, ["alice/data"]);
  const html = await Deno.readTextFile(
    join(workspaceRoot, "alice/data/index.html"),
  );
  assertStringIncludes(
    html,
    '<link rel="icon" href="/mesh-alice-bio/favicon.ico">',
  );
  assertStringIncludes(
    html,
    '<img class="wf-mesh-favicon" src="/mesh-alice-bio/favicon.ico" alt="">',
  );
});

Deno.test("executeVersion versions the first alice page-definition support artifact state", async () => {
  const workspaceRoot = await createTestTmpDir(
    "weave-version-page-definition-",
  );
  await materializeMeshAliceBioBranch(
    "14-alice-page-customized",
    workspaceRoot,
  );

  const result = await executeVersion({
    meshRoot: workspaceRoot,
    request: {
      targets: [{ designatorPath: "alice" }],
    },
  });

  assertEquals(result.versionedDesignatorPaths, ["alice"]);
  assert(
    result.createdPaths.includes(
      "alice/_knop/_page/_history001/_s0001/ttl/page.ttl",
    ),
  );
  assert(
    result.createdPaths.includes(
      "alice/_knop/_inventory/_history001/_s0003/ttl/inventory.ttl",
    ),
  );
  assert(result.updatedPaths.includes("alice/_knop/_inventory/inventory.ttl"));
  assertEquals(
    await Deno.readTextFile(join(workspaceRoot, "alice/index.html")),
    await readMeshAliceBioBranchFile(
      "14-alice-page-customized",
      "alice/index.html",
    ),
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
  assertEquals(
    await Deno.readTextFile(
      join(
        workspaceRoot,
        "alice/_knop/_page/_history001/_s0001/ttl/page.ttl",
      ),
    ),
    await readMeshAliceBioBranchFile(
      "14-alice-page-customized",
      "alice/_knop/_page/page.ttl",
    ),
  );
});

Deno.test("executeGenerate renders the customized alice identifier page after page-definition weave", async () => {
  const workspaceRoot = await createTestTmpDir(
    "weave-generate-page-definition-",
  );
  await materializeMeshAliceBioBranch(
    "15-alice-page-customized-woven",
    workspaceRoot,
  );

  const result = await executeGenerate({
    meshRoot: workspaceRoot,
    request: {
      targets: [{ designatorPath: "alice" }],
    },
  });

  assertEquals(result.generatedDesignatorPaths, ["alice"]);
  await Deno.stat(join(workspaceRoot, "alice/index.html"));
  await Deno.stat(join(workspaceRoot, "alice/_knop/_page/index.html"));
  assertStringIncludes(
    await Deno.readTextFile(join(workspaceRoot, "alice/index.html")),
    `<link rel="stylesheet" href="./_knop/_assets/alice.css">`,
  );
  assertStringIncludes(
    await Deno.readTextFile(join(workspaceRoot, "alice/index.html")),
    `is an IRI which identifies Alice, the person`,
  );
  const alicePageHtml = await Deno.readTextFile(
    join(workspaceRoot, "alice/index.html"),
  );
  assertFalse(
    alicePageHtml.includes(`<a href="./_knop/_page">./_knop/_page</a>`),
  );
  assertFalse(
    alicePageHtml.includes(`<th scope="row">ResourcePageDefinition</th>`),
  );
  const pageDefinitionHtml = await Deno.readTextFile(
    join(workspaceRoot, "alice/_knop/_page/index.html"),
  );
  assertStringIncludes(pageDefinitionHtml, "<h1>_page</h1>");
  assertStringIncludes(
    pageDefinitionHtml,
    "Resource page definition for alice",
  );
  assertStringIncludes(
    pageDefinitionHtml,
    'href="https://semantic-flow.github.io/mesh-alice-bio/alice/_knop/_page"',
  );
});

Deno.test("executeVersion can start a named payload history on an already-versioned payload", async () => {
  const workspaceRoot = await createTestTmpDir(
    "weave-version-new-history-",
  );
  await materializeMeshAliceBioBranch("10-alice-bio-updated", workspaceRoot);

  const result = await executeVersion({
    meshRoot: workspaceRoot,
    request: {
      targets: [{
        designatorPath: "alice/data",
        historySegment: "releases",
        stateSegment: "v0.0.2",
        manifestationSegment: "ttl",
      }],
    },
  });

  assertEquals(result.versionedDesignatorPaths, ["alice/data"]);
  assert(
    result.createdPaths.includes(
      "alice/data/releases/v0.0.2/ttl/alice-data.ttl",
    ),
  );
  await Deno.stat(
    join(workspaceRoot, "alice/data/releases/v0.0.2/ttl/alice-data.ttl"),
  );
  const inventory = await Deno.readTextFile(
    join(workspaceRoot, "alice/data/_knop/_inventory/inventory.ttl"),
  );
  assertStringIncludes(
    inventory,
    `sflo:nextStateOrdinal "1"^^xsd:nonNegativeInteger ;`,
  );
  assert(
    !inventory.includes(
      "<alice/data/releases/v0.0.2> a sflo:HistoricalState ;\n  sflo:stateOrdinal",
    ),
  );
});

Deno.test("executeVersion batches recursive targets through staged current state", async () => {
  const workspaceRoot = await createTestTmpDir("weave-version-recursive-");
  await materializeMeshAliceBioBranch("04-alice-knop-created", workspaceRoot);
  await addSupplementalKnopToMeshInventory(workspaceRoot, "alice/data");
  await addSupplementalPayloadArtifactToMeshInventory(
    workspaceRoot,
    "alice/data",
    "alice-data.ttl",
  );
  await writeSupplementalKnopSurface(
    workspaceRoot,
    "alice/data",
    `@base <https://semantic-flow.github.io/mesh-alice-bio/> .
@prefix sflo: <https://semantic-flow.github.io/sflo/ontology/> .

<alice/data/_knop> a sflo:Knop ;
  sflo:hasKnopMetadata <alice/data/_knop/_meta> ;
  sflo:hasKnopInventory <alice/data/_knop/_inventory> ;
  sflo:hasWorkingKnopInventoryFile <alice/data/_knop/_inventory/inventory.ttl> ;
  sflo:hasPayloadArtifact <alice/data> .

<alice/data> a sflo:PayloadArtifact, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasWorkingLocatedFile <alice-data.ttl> .
`,
  );

  const result = await executeVersion({
    meshRoot: workspaceRoot,
    request: {
      targets: [{ designatorPath: "alice", recursive: true }],
    },
  });

  assertEquals(result.versionedDesignatorPaths, ["alice", "alice/data"]);
  assertEquals(
    result.updatedPaths.filter((path) =>
      path === "_mesh/_inventory/inventory.ttl"
    )
      .length,
    1,
  );
  assert(
    result.createdPaths.includes(
      "_mesh/_inventory/_history001/_s0003/ttl/inventory.ttl",
    ),
  );
  assert(
    result.createdPaths.includes(
      "alice/data/_history001/_s0001/ttl/alice-data.ttl",
    ),
  );
  assertStringIncludes(
    await Deno.readTextFile(
      join(workspaceRoot, "_mesh/_inventory/inventory.ttl"),
    ),
    `sflo:hasKnop <alice/data/_knop> ;
  sflo:hasResourcePage <_mesh/index.html> .`,
  );
  assertStringIncludes(
    await Deno.readTextFile(
      join(workspaceRoot, "_mesh/_inventory/inventory.ttl"),
    ),
    `sflo:hasHistoricalState <_mesh/_inventory/_history001/_s0003> ;`,
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
      join(workspaceRoot, "alice/data/_knop/_inventory/inventory.ttl"),
    ),
    `sflo:currentArtifactHistory <alice/data/_history001> ;
  sflo:nextHistoryOrdinal "2"^^xsd:nonNegativeInteger ;`,
  );
  assertStringIncludes(
    await Deno.readTextFile(
      join(workspaceRoot, "alice/data/_knop/_inventory/inventory.ttl"),
    ),
    `sflo:latestHistoricalState <alice/data/_history001/_s0001> ;
  sflo:nextStateOrdinal "2"^^xsd:nonNegativeInteger ;`,
  );
  await assertRejects(
    () => Deno.stat(join(workspaceRoot, "alice/data/index.html")),
    Deno.errors.NotFound,
  );
});

Deno.test("executeVersion fails closed when a later batch target becomes invalid in staged state", async () => {
  const workspaceRoot = await createTestTmpDir(
    "weave-version-recursive-fail-closed-",
  );
  await materializeMeshAliceBioBranch("10-alice-bio-updated", workspaceRoot);
  await addSupplementalKnopToMeshInventory(workspaceRoot, "bob");
  await writeSupplementalKnopSurface(
    workspaceRoot,
    "bob",
    await readMeshAliceBioBranchFile(
      "12-bob-extracted",
      "bob/_knop/_inventory/inventory.ttl",
    ),
    (
      await readMeshAliceBioBranchFile(
        "12-bob-extracted",
        "bob/_knop/_sources/sources.ttl",
      )
    ).replace(
      "<bob/_knop/_sources#extraction-source> a sflo:ExtractionSource ;",
      "<bob/_knop/_sources#extraction-source> a sflo:UnknownExtractionSource ;",
    ),
  );

  const meshInventoryBefore = await Deno.readTextFile(
    join(workspaceRoot, "_mesh/_inventory/inventory.ttl"),
  );
  const aliceBioInventoryBefore = await Deno.readTextFile(
    join(workspaceRoot, "alice/data/_knop/_inventory/inventory.ttl"),
  );

  await assertRejects(() =>
    executeVersion({
      meshRoot: workspaceRoot,
      request: {
        targets: [
          { designatorPath: "alice/data" },
          { designatorPath: "bob" },
        ],
      },
    })
  );

  assertEquals(
    await Deno.readTextFile(
      join(workspaceRoot, "_mesh/_inventory/inventory.ttl"),
    ),
    meshInventoryBefore,
  );
  assertEquals(
    await Deno.readTextFile(
      join(workspaceRoot, "alice/data/_knop/_inventory/inventory.ttl"),
    ),
    aliceBioInventoryBefore,
  );
  await assertRejects(
    () =>
      Deno.stat(
        join(
          workspaceRoot,
          "alice/data/_history001/_s0002/ttl/alice-data.ttl",
        ),
      ),
    Deno.errors.NotFound,
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
    meshRoot: workspaceRoot,
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

Deno.test("executeGenerate skips timestamp-only reruns without rewriting pages", async () => {
  const workspaceRoot = await createTestTmpDir(
    "weave-generate-timestamp-only-rerun-",
  );
  await materializeMeshAliceBioBranch(
    "07-alice-bio-integrated-woven",
    workspaceRoot,
  );

  await executeGenerate({
    meshRoot: workspaceRoot,
    request: {
      targets: [{ designatorPath: "alice/data" }],
    },
    now: () => new Date("2026-05-03T00:00:00.000Z"),
  });
  const pagePath = join(workspaceRoot, "alice/data/index.html");
  const htmlBefore = await Deno.readTextFile(pagePath);

  const result = await executeGenerate({
    meshRoot: workspaceRoot,
    request: {
      targets: [{ designatorPath: "alice/data" }],
    },
    now: () => new Date("2026-05-21T12:34:56.000Z"),
  });

  assertEquals(result.createdPaths, []);
  assertEquals(result.updatedPaths, []);
  assert(
    result.skippedTimestampOnlyPaths.includes("alice/data/index.html"),
    result.skippedTimestampOnlyPaths.join("\n"),
  );
  assertEquals(await Deno.readTextFile(pagePath), htmlBefore);
});

Deno.test("executeGenerate reads only the settled current workspace state", async () => {
  const workspaceRoot = await createTestTmpDir("weave-generate-settled-state-");
  await materializeMeshAliceBioBranch("10-alice-bio-updated", workspaceRoot);

  await executeGenerate({
    meshRoot: workspaceRoot,
    request: {
      targets: [{ designatorPath: "alice/data" }],
    },
  });

  await assertRejects(
    () =>
      Deno.stat(
        join(
          workspaceRoot,
          "alice/data/_history001/_s0002/index.html",
        ),
      ),
    Deno.errors.NotFound,
  );
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
  sourcesTurtle?: string,
): Promise<void> {
  const knopPath = join(workspaceRoot, `${designatorPath}/_knop`);
  await Deno.mkdir(join(knopPath, "_meta"), { recursive: true });
  await Deno.mkdir(join(knopPath, "_inventory"), { recursive: true });
  await Deno.mkdir(join(knopPath, "_references"), { recursive: true });
  if (sourcesTurtle !== undefined) {
    await Deno.mkdir(join(knopPath, "_sources"), { recursive: true });
  }
  await Deno.writeTextFile(
    join(knopPath, "_meta/meta.ttl"),
    `@base <https://semantic-flow.github.io/mesh-alice-bio/> .
@prefix sflo: <https://semantic-flow.github.io/sflo/ontology/> .

<${designatorPath}/_knop> a sflo:Knop ;
  sflo:designatorPath "${designatorPath}" ;
  sflo:hasWorkingKnopInventoryFile <${designatorPath}/_knop/_inventory/inventory.ttl> .
`,
  );
  await Deno.writeTextFile(
    join(knopPath, "_inventory/inventory.ttl"),
    inventoryTurtle,
  );
  if (sourcesTurtle !== undefined) {
    await Deno.writeTextFile(
      join(knopPath, "_sources/sources.ttl"),
      sourcesTurtle,
    );
  }
}
