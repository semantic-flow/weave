import { assertEquals, assertRejects, assertStringIncludes } from "@std/assert";
import { join } from "@std/path";
import { compareRdfContent } from "../../dependencies/github.com/spectacular-voyage/accord/src/checker/compare_rdf.ts";
import {
  executeIntegrate,
  IntegrateRuntimeError,
} from "../../src/runtime/integrate/integrate.ts";
import { executeMeshCreate } from "../../src/runtime/mesh/create.ts";
import {
  materializeMeshAliceBioBranch,
  readMeshAliceBioBranchFile,
} from "../support/mesh_alice_bio_fixture.ts";
import {
  MESH_ALICE_BIO_BASE,
  writeEquivalentMeshMetadata,
} from "../support/mesh_metadata.ts";
import {
  ROOT_PAYLOAD_TURTLE,
  ROOT_WORKING_FILE_PATH,
} from "../support/root_designator.ts";
import { createTestTmpDir } from "../support/test_tmp.ts";

Deno.test("executeIntegrate matches the settled alice-bio integrated fixture", async () => {
  const workspaceRoot = await createTestTmpDir("weave-integrate-");
  await materializeMeshAliceBioBranch(
    "05-alice-knop-created-woven",
    workspaceRoot,
  );

  const result = await executeIntegrate({
    meshRoot: workspaceRoot,
    request: {
      designatorPath: "alice/bio",
      source: "alice-bio.ttl",
    },
  });

  assertEquals(result.designatorPath, "alice/bio");
  assertEquals(result.workingLocalRelativePath, "alice-bio.ttl");
  assertEquals(
    [...result.createdPaths].sort(),
    [
      "alice/bio/_knop/_inventory/inventory.ttl",
      "alice/bio/_knop/_meta/meta.ttl",
    ],
  );
  assertEquals(result.updatedPaths, ["_mesh/_inventory/inventory.ttl"]);
  assertEquals(
    await compareRdfContent({
      left: await Deno.readFile(
        join(workspaceRoot, "_mesh/_inventory/inventory.ttl"),
      ),
      right: encode(
        await readMeshAliceBioBranchFile(
          "06-alice-bio-integrated",
          "_mesh/_inventory/inventory.ttl",
        ),
      ),
      path: "_mesh/_inventory/inventory.ttl",
    }),
    true,
  );
  assertEquals(
    await Deno.readTextFile(
      join(workspaceRoot, "alice/bio/_knop/_meta/meta.ttl"),
    ),
    await readMeshAliceBioBranchFile(
      "06-alice-bio-integrated",
      "alice/bio/_knop/_meta/meta.ttl",
    ),
  );
  assertEquals(
    await Deno.readTextFile(
      join(workspaceRoot, "alice/bio/_knop/_inventory/inventory.ttl"),
    ),
    await readMeshAliceBioBranchFile(
      "06-alice-bio-integrated",
      "alice/bio/_knop/_inventory/inventory.ttl",
    ),
  );
  assertEquals(
    await Deno.readTextFile(join(workspaceRoot, "alice-bio.ttl")),
    await readMeshAliceBioBranchFile(
      "06-alice-bio-integrated",
      "alice-bio.ttl",
    ),
  );
});

Deno.test("executeIntegrate supports the root designator path", async () => {
  const workspaceRoot = await createTestTmpDir("weave-integrate-root-");
  await materializeMeshAliceBioBranch(
    "05-alice-knop-created-woven",
    workspaceRoot,
  );
  await Deno.writeTextFile(
    join(workspaceRoot, ROOT_WORKING_FILE_PATH),
    ROOT_PAYLOAD_TURTLE,
  );

  const result = await executeIntegrate({
    meshRoot: workspaceRoot,
    request: {
      designatorPath: "",
      source: ROOT_WORKING_FILE_PATH,
    },
  });

  assertEquals(result.designatorPath, "");
  assertEquals(result.workingLocalRelativePath, ROOT_WORKING_FILE_PATH);
  assertEquals(
    [...result.createdPaths].sort(),
    [
      "_knop/_inventory/inventory.ttl",
      "_knop/_meta/meta.ttl",
    ],
  );
  assertEquals(result.updatedPaths, ["_mesh/_inventory/inventory.ttl"]);
  assertEquals(
    await Deno.readTextFile(join(workspaceRoot, ROOT_WORKING_FILE_PATH)),
    ROOT_PAYLOAD_TURTLE,
  );
  assertStringIncludes(
    await Deno.readTextFile(
      join(workspaceRoot, "_knop/_inventory/inventory.ttl"),
    ),
    "sflo:hasPayloadArtifact <> .",
  );
  assertStringIncludes(
    await Deno.readTextFile(
      join(workspaceRoot, "_mesh/_inventory/inventory.ttl"),
    ),
    "sflo:hasKnop <_knop>",
  );
});

Deno.test("executeIntegrate fails closed when source is outside the allowed local boundary", async () => {
  const workspaceRoot = await createTestTmpDir("weave-integrate-workspace-");
  await materializeMeshAliceBioBranch(
    "05-alice-knop-created-woven",
    workspaceRoot,
  );

  const externalRoot = await createTestTmpDir("weave-integrate-external-");
  const externalSourcePath = join(externalRoot, "alice-bio.ttl");
  await Deno.writeTextFile(
    externalSourcePath,
    await readMeshAliceBioBranchFile(
      "05-alice-knop-created-woven",
      "alice-bio.ttl",
    ),
  );

  await assertRejects(
    () =>
      executeIntegrate({
        meshRoot: workspaceRoot,
        request: {
          designatorPath: "alice/bio",
          source: externalSourcePath,
        },
      }),
    IntegrateRuntimeError,
    "outside the allowed local-path boundary",
  );
});

Deno.test("executeIntegrate suggests a source directory grant for adjacent workspace sources", async () => {
  const repoRoot = await createTestTmpDir("weave-integrate-grant-suggestion-");
  const workspaceRoot = join(repoRoot, "mesh");
  await materializeMeshAliceBioBranch(
    "05-alice-knop-created-woven",
    workspaceRoot,
  );
  await Deno.mkdir(join(repoRoot, "documentation"), { recursive: true });
  await Deno.mkdir(join(workspaceRoot, "_mesh/_config"), { recursive: true });
  await Deno.writeTextFile(
    join(workspaceRoot, "_mesh/_config/config.ttl"),
    `@prefix sfcfg: <https://semantic-flow.github.io/ontology/config/> .

<> a sfcfg:MeshConfig ;
  sfcfg:workspaceRootRelativeToMeshRoot "../" .
`,
  );
  await Deno.writeTextFile(
    join(repoRoot, "documentation/alice-bio.ttl"),
    await readMeshAliceBioBranchFile(
      "05-alice-knop-created-woven",
      "alice-bio.ttl",
    ),
  );

  await assertRejects(
    () =>
      executeIntegrate({
        meshRoot: workspaceRoot,
        sourceBaseDirectory: repoRoot,
        request: {
          designatorPath: "alice/bio",
          source: "documentation/alice-bio.ttl",
        },
      }),
    IntegrateRuntimeError,
    "--grant-source-directory documentation",
  );
});

Deno.test("executeIntegrate allows repo-adjacent local sources when repo policy permits them", async () => {
  const repoRoot = await createTestTmpDir("weave-integrate-policy-");
  const workspaceRoot = join(repoRoot, "mesh");
  await materializeMeshAliceBioBranch(
    "05-alice-knop-created-woven",
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
  const sharedSourcePath = join(repoRoot, "documentation/alice-bio.ttl");
  await Deno.writeTextFile(
    sharedSourcePath,
    await readMeshAliceBioBranchFile(
      "05-alice-knop-created-woven",
      "alice-bio.ttl",
    ),
  );

  const result = await executeIntegrate({
    meshRoot: workspaceRoot,
    sourceBaseDirectory: repoRoot,
    request: {
      designatorPath: "alice/bio",
      source: "documentation/alice-bio.ttl",
    },
  });

  assertEquals(result.designatorPath, "alice/bio");
  assertEquals(
    result.workingLocalRelativePath,
    "../documentation/alice-bio.ttl",
  );
  const createdInventory = await Deno.readTextFile(
    join(workspaceRoot, "alice/bio/_knop/_inventory/inventory.ttl"),
  );
  const updatedMeshInventory = await Deno.readTextFile(
    join(workspaceRoot, "_mesh/_inventory/inventory.ttl"),
  );
  assertStringIncludes(
    createdInventory,
    `sflo:workingLocalRelativePath "../documentation/alice-bio.ttl" .`,
  );
  assertStringIncludes(
    updatedMeshInventory,
    `sflo:workingLocalRelativePath "../documentation/alice-bio.ttl" .`,
  );
  assertEquals(
    createdInventory.includes(
      "sflo:hasWorkingLocatedFile <../documentation/alice-bio.ttl> .",
    ),
    false,
  );
  assertEquals(
    updatedMeshInventory.includes(
      "sflo:hasWorkingLocatedFile <../documentation/alice-bio.ttl> .",
    ),
    false,
  );
});

Deno.test("executeIntegrate can add a constrained repo-adjacent source directory grant", async () => {
  const repoRoot = await createTestTmpDir("weave-integrate-grant-");
  const workspaceRoot = join(repoRoot, "mesh");
  await materializeMeshAliceBioBranch(
    "05-alice-knop-created-woven",
    workspaceRoot,
  );
  await Deno.mkdir(join(repoRoot, "documentation"), { recursive: true });
  await Deno.mkdir(join(workspaceRoot, "_mesh/_config"), { recursive: true });
  await Deno.writeTextFile(
    join(workspaceRoot, "_mesh/_config/config.ttl"),
    `@prefix sfcfg: <https://semantic-flow.github.io/ontology/config/> .

<> a sfcfg:MeshConfig ;
  sfcfg:workspaceRootRelativeToMeshRoot "../" .
`,
  );
  await Deno.writeTextFile(
    join(repoRoot, "documentation/alice-bio.ttl"),
    await readMeshAliceBioBranchFile(
      "05-alice-knop-created-woven",
      "alice-bio.ttl",
    ),
  );

  const result = await executeIntegrate({
    meshRoot: workspaceRoot,
    sourceBaseDirectory: repoRoot,
    sourceAccessDirectory: "documentation",
    request: {
      designatorPath: "alice/bio",
      source: "documentation/alice-bio.ttl",
    },
  });

  assertEquals(
    result.workingLocalRelativePath,
    "../documentation/alice-bio.ttl",
  );
  assertEquals(
    [...result.updatedPaths].sort(),
    [
      "mesh/_mesh/_config/config.ttl",
      "mesh/_mesh/_inventory/inventory.ttl",
    ],
  );
  const config = await Deno.readTextFile(
    join(workspaceRoot, "_mesh/_config/config.ttl"),
  );
  assertStringIncludes(
    config,
    'sfcfg:pathPrefix "../documentation/"',
  );
  assertStringIncludes(
    config,
    "sfcfg:hasLocalPathLocatorKind <https://semantic-flow.github.io/ontology/config/workingLocalRelativePathLocatorKind>",
  );
});

Deno.test("executeIntegrate can introduce the first payload into a docs-rooted sidecar mesh", async () => {
  const repoRoot = await createTestTmpDir("weave-integrate-sidecar-first-");
  const meshRoot = join(repoRoot, "docs");
  await executeMeshCreate({
    workspaceRoot: repoRoot,
    meshRoot: "docs",
    request: {
      meshBase: "https://semantic-flow.github.io/mesh-sidecar-fantasy-rules/",
    },
  });
  await Deno.mkdir(join(repoRoot, "ontology"), { recursive: true });
  await Deno.writeTextFile(
    join(repoRoot, "ontology/fantasy-rules-ontology.ttl"),
    `@prefix owl: <http://www.w3.org/2002/07/owl#> .

<https://semantic-flow.github.io/mesh-sidecar-fantasy-rules/ontology> a owl:Ontology .
`,
  );

  const result = await executeIntegrate({
    meshRoot,
    sourceBaseDirectory: repoRoot,
    sourceAccessDirectory: "ontology",
    request: {
      designatorPath: "ontology",
      source: "ontology/fantasy-rules-ontology.ttl",
    },
  });

  assertEquals(result.designatorPath, "ontology");
  assertEquals(
    result.workingLocalRelativePath,
    "../ontology/fantasy-rules-ontology.ttl",
  );
  assertEquals(
    [...result.createdPaths].sort(),
    [
      "docs/ontology/_knop/_inventory/inventory.ttl",
      "docs/ontology/_knop/_meta/meta.ttl",
    ],
  );
  assertEquals(
    [...result.updatedPaths].sort(),
    [
      "docs/_mesh/_config/config.ttl",
      "docs/_mesh/_inventory/inventory.ttl",
    ],
  );
  assertStringIncludes(
    await Deno.readTextFile(join(meshRoot, "_mesh/_inventory/inventory.ttl")),
    'sflo:workingLocalRelativePath "../ontology/fantasy-rules-ontology.ttl" .',
  );
  assertStringIncludes(
    await Deno.readTextFile(join(meshRoot, "_mesh/_config/config.ttl")),
    'sfcfg:pathPrefix "../ontology/"',
  );
});

Deno.test("executeIntegrate accepts semantically equivalent mesh metadata turtle", async () => {
  const workspaceRoot = await createTestTmpDir("weave-integrate-metadata-");
  await materializeMeshAliceBioBranch(
    "05-alice-knop-created-woven",
    workspaceRoot,
  );
  await writeEquivalentMeshMetadata(workspaceRoot);

  const result = await executeIntegrate({
    meshRoot: workspaceRoot,
    request: {
      designatorPath: "alice/bio",
      source: "alice-bio.ttl",
    },
  });

  assertEquals(result.meshBase, MESH_ALICE_BIO_BASE);
  assertEquals(result.workingLocalRelativePath, "alice-bio.ttl");
});

function encode(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}
