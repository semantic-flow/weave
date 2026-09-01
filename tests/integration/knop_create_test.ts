import {
  assert,
  assertEquals,
  assertRejects,
  assertStringIncludes,
} from "@std/assert";
import { join } from "@std/path";
import { Parser, type Quad } from "n3";
import { KnopCreateInputError } from "../../src/core/knop/create.ts";
import {
  executeKnopCreate,
  executeKnopCreateForTesting,
  KnopCreateRuntimeError,
  readFoundingDataVersionSource,
  readKnopCreateFoundingDataSource,
} from "../../src/runtime/knop/create.ts";
import {
  materializeMeshAliceBioBranch,
  readMeshAliceBioBranchFile,
} from "../support/mesh_alice_bio_fixture.ts";
import {
  MESH_ALICE_BIO_BASE,
  writeEquivalentMeshMetadata,
} from "../support/mesh_metadata.ts";
import { createTestTmpDir } from "../support/test_tmp.ts";

Deno.test("executeKnopCreate preserves Alice first-Knop inventory and creates fixture support artifacts", async () => {
  const workspaceRoot = await createTestTmpDir("weave-knop-create-");
  await materializeMeshAliceBioBranch("03-mesh-created-woven", workspaceRoot);
  const meshInventoryPath = join(
    workspaceRoot,
    "_mesh/_inventory/inventory.ttl",
  );
  const currentMeshInventoryTurtle = await Deno.readTextFile(
    meshInventoryPath,
  );

  const result = await executeKnopCreate({
    workspaceRoot,
    request: {
      designatorPath: "alice",
    },
  });

  assertEquals(
    result.knopIri,
    "https://semantic-flow.github.io/mesh-alice-bio/alice/_knop",
  );
  assertEquals(
    [...result.createdPaths].sort(),
    [
      "alice/_knop/_inventory/inventory.ttl",
      "alice/_knop/_meta/meta.ttl",
    ],
  );
  assertEquals(result.updatedPaths, ["_mesh/_inventory/inventory.ttl"]);
  assertEquals(
    await Deno.readTextFile(join(workspaceRoot, "alice/_knop/_meta/meta.ttl")),
    await readMeshAliceBioBranchFile(
      "04-alice-knop-created",
      "alice/_knop/_meta/meta.ttl",
    ),
  );
  assertEquals(
    await Deno.readTextFile(
      join(workspaceRoot, "alice/_knop/_inventory/inventory.ttl"),
    ),
    await readMeshAliceBioBranchFile(
      "04-alice-knop-created",
      "alice/_knop/_inventory/inventory.ttl",
    ),
  );
  const updatedMeshInventoryTurtle = await Deno.readTextFile(
    meshInventoryPath,
  );
  assert(updatedMeshInventoryTurtle.startsWith(currentMeshInventoryTurtle));
  const updatedQuads = new Parser({ baseIRI: MESH_ALICE_BIO_BASE }).parse(
    updatedMeshInventoryTurtle,
  );
  assert(
    updatedQuads.some((quad: Quad) =>
      quad.subject.value === `${MESH_ALICE_BIO_BASE}_mesh` &&
      quad.predicate.value ===
        "https://semantic-flow.github.io/sflo/ontology/hasKnop" &&
      quad.object.value === `${MESH_ALICE_BIO_BASE}alice/_knop`
    ),
  );
  assert(
    updatedQuads.some((quad: Quad) =>
      quad.subject.value === `${MESH_ALICE_BIO_BASE}_mesh` &&
      quad.predicate.value ===
        "https://semantic-flow.github.io/sflo/config/hasConfig" &&
      quad.object.value === `${MESH_ALICE_BIO_BASE}_mesh/_config`
    ),
  );
});

Deno.test("executeKnopCreate creates root-owned support artifacts without leading slashes", async () => {
  const workspaceRoot = await createTestTmpDir("weave-knop-create-root-");
  await materializeMeshAliceBioBranch("03-mesh-created-woven", workspaceRoot);

  const result = await executeKnopCreate({
    workspaceRoot,
    request: {
      designatorPath: "",
    },
  });

  assertEquals(result.designatorPath, "");
  assertEquals(
    [...result.createdPaths].sort(),
    [
      "_knop/_inventory/inventory.ttl",
      "_knop/_meta/meta.ttl",
    ],
  );
  assertEquals(result.updatedPaths, ["_mesh/_inventory/inventory.ttl"]);
  assertStringIncludes(
    await Deno.readTextFile(join(workspaceRoot, "_knop/_meta/meta.ttl")),
    'sflo:designatorPath ""',
  );
  assertStringIncludes(
    await Deno.readTextFile(
      join(workspaceRoot, "_knop/_inventory/inventory.ttl"),
    ),
    "<_knop> a sflo:Knop ;",
  );
  assertStringIncludes(
    await Deno.readTextFile(
      join(workspaceRoot, "_knop/_inventory/inventory.ttl"),
    ),
    "sflo:hasWorkingKnopInventoryFile <_knop/_inventory/inventory.ttl> .",
  );
});

Deno.test("executeKnopCreate fails closed when knop support artifacts already exist", async () => {
  const workspaceRoot = await createTestTmpDir("weave-knop-create-existing-");
  await materializeMeshAliceBioBranch("03-mesh-created-woven", workspaceRoot);
  await Deno.mkdir(join(workspaceRoot, "alice/_knop/_meta"), {
    recursive: true,
  });
  await Deno.writeTextFile(
    join(workspaceRoot, "alice/_knop/_meta/meta.ttl"),
    "# existing\n",
  );

  await assertRejects(
    () =>
      executeKnopCreate({
        workspaceRoot,
        request: {
          designatorPath: "alice",
        },
      }),
    KnopCreateRuntimeError,
    "already exists",
  );
});

Deno.test("executeKnopCreate accepts semantically equivalent mesh metadata turtle", async () => {
  const workspaceRoot = await createTestTmpDir("weave-knop-create-metadata-");
  await materializeMeshAliceBioBranch("03-mesh-created-woven", workspaceRoot);
  await writeEquivalentMeshMetadata(workspaceRoot);

  const result = await executeKnopCreate({
    workspaceRoot,
    request: {
      designatorPath: "alice",
    },
  });

  assertEquals(result.meshBase, MESH_ALICE_BIO_BASE);
  assertEquals(result.updatedPaths, ["_mesh/_inventory/inventory.ttl"]);
});

Deno.test("executeKnopCreate supports the root Knop in a later carried mesh state", async () => {
  const workspaceRoot = await createTestTmpDir("weave-knop-create-root-later-");
  await materializeMeshAliceBioBranch(
    "21-bob-page-imported-source-woven",
    workspaceRoot,
  );

  const result = await executeKnopCreate({
    workspaceRoot,
    request: {
      designatorPath: "",
    },
  });

  assertEquals(result.designatorPath, "");
  assertEquals(
    [...result.createdPaths].sort(),
    [
      "_knop/_inventory/inventory.ttl",
      "_knop/_meta/meta.ttl",
    ],
  );
  assertEquals(result.updatedPaths, ["_mesh/_inventory/inventory.ttl"]);
  const meshInventoryTurtle = await Deno.readTextFile(
    join(workspaceRoot, "_mesh/_inventory/inventory.ttl"),
  );
  assert(
    new Parser({
      baseIRI: "https://semantic-flow.github.io/mesh-alice-bio/",
    }).parse(meshInventoryTurtle).some((quad: Quad) =>
      quad.subject.value ===
        "https://semantic-flow.github.io/mesh-alice-bio/_mesh" &&
      quad.predicate.value ===
        "https://semantic-flow.github.io/sflo/ontology/hasKnop" &&
      quad.object.termType === "NamedNode" &&
      quad.object.value ===
        "https://semantic-flow.github.io/mesh-alice-bio/_knop"
    ),
  );
  assert(
    new Parser({
      baseIRI: "https://semantic-flow.github.io/mesh-alice-bio/",
    }).parse(meshInventoryTurtle).some((quad: Quad) =>
      quad.subject.value ===
        "https://semantic-flow.github.io/mesh-alice-bio/_mesh/_inventory/_history001" &&
      quad.predicate.value ===
        "https://semantic-flow.github.io/sflo/ontology/hasHistoricalState" &&
      quad.object.termType === "NamedNode" &&
      quad.object.value ===
        "https://semantic-flow.github.io/mesh-alice-bio/_mesh/_inventory/_history001/_s0005"
    ),
  );
});

Deno.test("executeKnopCreate conflict writes no files and preserves MeshInventory bytes", async () => {
  const workspaceRoot = await createTestTmpDir(
    "weave-knop-create-conflict-no-write-",
  );
  await materializeMeshAliceBioBranch("03-mesh-created-woven", workspaceRoot);
  const meshInventoryPath = join(
    workspaceRoot,
    "_mesh/_inventory/inventory.ttl",
  );
  const conflictedMeshInventoryTurtle = `${await Deno.readTextFile(
    meshInventoryPath,
  )}
<conflict/_knop> sflo:hasWorkingKnopInventoryFile <conflict/_knop/_inventory/carried.ttl> .
`;
  await Deno.writeTextFile(
    meshInventoryPath,
    conflictedMeshInventoryTurtle,
  );

  await assertRejects(
    () =>
      executeKnopCreate({
        workspaceRoot,
        request: { designatorPath: "conflict" },
      }),
    KnopCreateInputError,
    "conflicts with existing fact",
  );
  assertEquals(
    await Deno.readTextFile(meshInventoryPath),
    conflictedMeshInventoryTurtle,
  );
  await assertRejects(
    () => Deno.stat(join(workspaceRoot, "conflict")),
    Deno.errors.NotFound,
  );
});

Deno.test("executeKnopCreate preserves exact founding bytes and rolls back an injected mid-write failure", async () => {
  const workspaceRoot = await createTestTmpDir(
    "weave-knop-create-founding-rollback-",
  );
  await materializeMeshAliceBioBranch("03-mesh-created-woven", workspaceRoot);
  const meshInventoryPath = join(
    workspaceRoot,
    "_mesh/_inventory/inventory.ttl",
  );
  const meshInventoryBefore = await Deno.readFile(meshInventoryPath);
  const bytes = new TextEncoder().encode(
    `\uFEFF<${MESH_ALICE_BIO_BASE}founding-demo> <https://example.test/vocab/value> "exact" .\r\n`,
  );

  await assertRejects(
    () =>
      executeKnopCreateForTesting(
        {
          workspaceRoot,
          request: {
            designatorPath: "founding-demo",
            foundingData: bytes,
          },
        },
        {
          beforeWrite(write) {
            if (write.phase === "binary-create") throw new Error("injected");
          },
        },
      ),
  );
  assertEquals(await Deno.readFile(meshInventoryPath), meshInventoryBefore);
  await assertRejects(
    () => Deno.stat(join(workspaceRoot, "founding-demo")),
    Deno.errors.NotFound,
  );

  let fetchCalled = false;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (() => {
    fetchCalled = true;
    throw new Error("network must not be used");
  }) as typeof fetch;
  let result;
  try {
    result = await executeKnopCreate({
      workspaceRoot,
      request: { designatorPath: "founding-demo", foundingData: bytes },
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
  assertEquals(fetchCalled, false);
  assertEquals(
    result.foundingWorkingLocatedFilePath,
    "founding-demo/_knop/_founding/data.ttl",
  );
  assertEquals(
    await Deno.readFile(
      join(workspaceRoot, result.foundingWorkingLocatedFilePath!),
    ),
    bytes,
  );
  await assertRejects(
    () => Deno.stat(join(workspaceRoot, "founding-demo/index.html")),
    Deno.errors.NotFound,
  );
  await assertRejects(
    () =>
      Deno.stat(
        join(workspaceRoot, "founding-demo/_knop/_founding/_history001"),
      ),
    Deno.errors.NotFound,
  );
});

Deno.test("executeKnopCreate never adopts or overwrites a pre-existing founding target", async () => {
  const workspaceRoot = await createTestTmpDir(
    "weave-knop-create-founding-existing-",
  );
  await materializeMeshAliceBioBranch("03-mesh-created-woven", workspaceRoot);
  const targetPath = join(
    workspaceRoot,
    "founding-demo/_knop/_founding/data.ttl",
  );
  await Deno.mkdir(join(workspaceRoot, "founding-demo/_knop/_founding"), {
    recursive: true,
  });
  await Deno.writeTextFile(targetPath, "pre-existing bytes\n");
  const meshInventoryPath = join(
    workspaceRoot,
    "_mesh/_inventory/inventory.ttl",
  );
  const meshInventoryBefore = await Deno.readFile(meshInventoryPath);

  await assertRejects(
    () =>
      executeKnopCreate({
        workspaceRoot,
        request: {
          designatorPath: "founding-demo",
          foundingData: new TextEncoder().encode(
            `<${MESH_ALICE_BIO_BASE}founding-demo> <https://example.test/vocab/value> "new" .\n`,
          ),
        },
      }),
    KnopCreateRuntimeError,
  );
  assertEquals(await Deno.readTextFile(targetPath), "pre-existing bytes\n");
  assertEquals(await Deno.readFile(meshInventoryPath), meshInventoryBefore);
  await assertRejects(
    () =>
      Deno.stat(
        join(workspaceRoot, "founding-demo/_knop/_inventory/inventory.ttl"),
      ),
    Deno.errors.NotFound,
  );
});

Deno.test("founding source readers allow ruled workspace paths and reject workspace escape", async () => {
  const repoRoot = await createTestTmpDir("weave-founding-source-policy-");
  const meshRoot = join(repoRoot, "mesh");
  const sourceDirectory = join(repoRoot, "sources");
  const outsideRoot = await createTestTmpDir(
    "weave-founding-source-outside-workspace-",
  );
  await materializeMeshAliceBioBranch("03-mesh-created-woven", meshRoot);
  await Deno.mkdir(sourceDirectory, { recursive: true });
  await Deno.writeTextFile(
    join(meshRoot, "_mesh/_config/config.ttl"),
    `@prefix sfcfg: <https://semantic-flow.github.io/sflo/config/> .

<> a sfcfg:MeshConfig ;
  sfcfg:workspaceRootRelativeToMeshRoot "../" ;
  sfcfg:hasMeshWorkspacePathRule [
    a sfcfg:MeshWorkspacePathRule ;
    sfcfg:workspacePathPrefix "../sources/" ;
    sfcfg:appliesToLocalPathLocatorKind <https://semantic-flow.github.io/sflo/config/localPathLocatorKind_workingLocalRelativePath>
  ] .
`,
  );
  const bytes = new TextEncoder().encode(
    `<${MESH_ALICE_BIO_BASE}founding-demo> <https://example.test/vocab/value> "allowed" .\n`,
  );
  await Deno.writeFile(join(sourceDirectory, "founding.ttl"), bytes);
  const outsidePath = join(outsideRoot, "founding.ttl");
  await Deno.writeFile(outsidePath, bytes);

  for (
    const readSource of [
      readKnopCreateFoundingDataSource,
      readFoundingDataVersionSource,
    ]
  ) {
    assertEquals(
      await readSource({
        meshRoot,
        designatorPath: "founding-demo",
        sourcePath: "sources/founding.ttl",
        commandWorkingDirectory: repoRoot,
      }),
      bytes,
    );
    await assertRejects(
      () =>
        readSource({
          meshRoot,
          designatorPath: "founding-demo",
          sourcePath: outsidePath,
          commandWorkingDirectory: repoRoot,
        }),
      KnopCreateRuntimeError,
      "outside the allowed local-path boundary",
    );
  }
});
