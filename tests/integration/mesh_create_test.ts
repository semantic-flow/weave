import { assertEquals, assertRejects } from "@std/assert";
import { join } from "@std/path";
import {
  executeMeshCreate,
  MeshCreateRuntimeError,
} from "../../src/runtime/mesh/create.ts";
import { readMeshAliceBioBranchFile } from "../support/mesh_alice_bio_fixture.ts";
import { createTestTmpDir } from "../support/test_tmp.ts";

Deno.test("executeMeshCreate creates core mesh support artifacts without a host preset", async () => {
  const workspaceRoot = await createTestTmpDir("weave-mesh-create-");
  await Deno.writeTextFile(
    join(workspaceRoot, "alice-data.ttl"),
    await readMeshAliceBioBranchFile("01-source-only", "alice-data.ttl"),
  );

  const result = await executeMeshCreate({
    workspaceRoot,
    request: {
      meshBase: "https://semantic-flow.github.io/mesh-alice-bio/",
    },
  });

  assertEquals(
    result.meshIri,
    "https://semantic-flow.github.io/mesh-alice-bio/_mesh",
  );
  assertEquals(
    [...result.createdPaths].sort(),
    [
      "_mesh/_inventory/inventory.ttl",
      "_mesh/_meta/meta.ttl",
    ],
  );
  assertEquals(
    await Deno.readTextFile(join(workspaceRoot, "alice-data.ttl")),
    await readMeshAliceBioBranchFile("02-mesh-created", "alice-data.ttl"),
  );
  assertEquals(
    await Deno.readTextFile(join(workspaceRoot, "_mesh/_meta/meta.ttl")),
    await readMeshAliceBioBranchFile("02-mesh-created", "_mesh/_meta/meta.ttl"),
  );
  assertEquals(
    await Deno.readTextFile(
      join(workspaceRoot, "_mesh/_inventory/inventory.ttl"),
    ),
    `@base <https://semantic-flow.github.io/mesh-alice-bio/> .
@prefix sflo: <https://semantic-flow.github.io/sflo/ontology/> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

<_mesh> a sflo:SemanticMesh ;
  sflo:meshBase "https://semantic-flow.github.io/mesh-alice-bio/"^^xsd:anyURI ;
  sflo:hasMeshMetadata <_mesh/_meta> ;
  sflo:hasMeshInventory <_mesh/_inventory> .

<_mesh/_meta> a sflo:MeshMetadata, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasWorkingLocatedFile <_mesh/_meta/meta.ttl> .

<_mesh/_inventory> a sflo:MeshInventory, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasWorkingLocatedFile <_mesh/_inventory/inventory.ttl> .

<_mesh/_meta/meta.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<_mesh/_inventory/inventory.ttl> a sflo:LocatedFile, sflo:RdfDocument .
`,
  );
  await assertRejects(
    () => Deno.stat(join(workspaceRoot, ".nojekyll")),
    Deno.errors.NotFound,
  );
});

Deno.test("executeMeshCreate fails closed when mesh support artifacts already exist", async () => {
  const workspaceRoot = await createTestTmpDir("weave-mesh-create-existing-");
  await Deno.mkdir(join(workspaceRoot, "_mesh", "_meta"), { recursive: true });
  await Deno.writeTextFile(
    join(workspaceRoot, "_mesh/_meta/meta.ttl"),
    "# existing\n",
  );

  await assertRejects(
    () =>
      executeMeshCreate({
        workspaceRoot,
        request: {
          meshBase: "https://semantic-flow.github.io/mesh-alice-bio/",
        },
      }),
    MeshCreateRuntimeError,
    "already exists",
  );
});

Deno.test("executeMeshCreate can reuse matching bootstrap artifacts", async () => {
  const workspaceRoot = await createTestTmpDir(
    "weave-mesh-create-existing-matching-",
  );
  const request = {
    meshBase: "https://semantic-flow.github.io/mesh-sidecar-fantasy-rules/",
    publicationProfile: "githubPages" as const,
  };

  const firstResult = await executeMeshCreate({
    workspaceRoot,
    request,
  });
  const secondResult = await executeMeshCreate({
    workspaceRoot,
    request,
    existingFilePolicy: "reuseMatching",
  });

  assertEquals(
    [...firstResult.createdPaths].sort(),
    [
      ".nojekyll",
      "_mesh/_config/config.ttl",
      "_mesh/_inventory/inventory.ttl",
      "_mesh/_meta/meta.ttl",
    ],
  );
  assertEquals(secondResult.createdPaths, []);
  assertEquals(
    await Deno.readTextFile(join(workspaceRoot, "_mesh/_config/config.ttl")),
    `@prefix sfcfg: <https://semantic-flow.github.io/sflo/config/> .

<> a sfcfg:MeshConfig ;
  sfcfg:hasPublicationProfile sfcfg:publicationProfile_githubPages .
`,
  );
});

Deno.test("executeMeshCreate can create a docs-rooted sidecar mesh", async () => {
  const workspaceRoot = await createTestTmpDir("weave-mesh-create-sidecar-");
  await Deno.mkdir(join(workspaceRoot, "ontology"), { recursive: true });
  await Deno.writeTextFile(
    join(workspaceRoot, "ontology/fantasy-rules-ontology.ttl"),
    "# source stays outside docs\n",
  );

  const result = await executeMeshCreate({
    workspaceRoot,
    meshRoot: "docs",
    request: {
      meshBase: "https://semantic-flow.github.io/mesh-sidecar-fantasy-rules/",
      publicationProfile: "githubPages",
    },
  });

  assertEquals(
    result.meshIri,
    "https://semantic-flow.github.io/mesh-sidecar-fantasy-rules/_mesh",
  );
  assertEquals(
    [...result.createdPaths].sort(),
    [
      "docs/.nojekyll",
      "docs/_mesh/_config/config.ttl",
      "docs/_mesh/_inventory/inventory.ttl",
      "docs/_mesh/_meta/meta.ttl",
    ],
  );
  await Deno.stat(join(workspaceRoot, "docs/.nojekyll"));
  const config = await Deno.readTextFile(
    join(workspaceRoot, "docs/_mesh/_config/config.ttl"),
  );
  assertEquals(
    config,
    `@prefix sfcfg: <https://semantic-flow.github.io/sflo/config/> .

<> a sfcfg:MeshConfig ;
  sfcfg:workspaceRootRelativeToMeshRoot "../" ;
  sfcfg:hasPublicationProfile sfcfg:publicationProfile_githubPages .
`,
  );
  await Deno.stat(join(workspaceRoot, "docs/_mesh/_meta/meta.ttl"));
  await Deno.stat(join(workspaceRoot, "docs/_mesh/_inventory/inventory.ttl"));
  assertEquals(
    await Deno.readTextFile(
      join(workspaceRoot, "ontology/fantasy-rules-ontology.ttl"),
    ),
    "# source stays outside docs\n",
  );
});

Deno.test("executeMeshCreate rejects mesh roots outside the workspace", async () => {
  const workspaceRoot = await createTestTmpDir("weave-mesh-create-escape-");

  await assertRejects(
    () =>
      executeMeshCreate({
        workspaceRoot,
        meshRoot: "../docs",
        request: {
          meshBase:
            "https://semantic-flow.github.io/mesh-sidecar-fantasy-rules/",
        },
      }),
    MeshCreateRuntimeError,
    "meshRoot must stay within the workspace root",
  );
});
