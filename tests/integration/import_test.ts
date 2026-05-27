import {
  assert,
  assertEquals,
  assertRejects,
  assertStringIncludes,
} from "@std/assert";
import { join, toFileUrl } from "@std/path";
import {
  executeImport,
  ImportRuntimeError,
} from "../../src/runtime/import/import.ts";
import { executeMeshCreate } from "../../src/runtime/mesh/create.ts";
import { createTestTmpDir } from "../support/test_tmp.ts";

Deno.test("executeImport imports local Markdown into a governed payload without RDF typing", async () => {
  const workspaceRoot = await createTestTmpDir("weave-import-local-");
  await executeMeshCreate({
    workspaceRoot,
    meshRoot: ".",
    request: {
      meshBase: "https://semantic-flow.github.io/mesh-alice-bio/",
    },
  });
  const sourceRoot = await createTestTmpDir("weave-import-local-source-");
  await Deno.writeTextFile(join(sourceRoot, "bob.md"), "# Bob\n");
  const expectedDigest = await sha256Digest(encode("# Bob\n"));

  const result = await executeImport({
    meshRoot: workspaceRoot,
    sourceBaseDirectory: sourceRoot,
    now: () => new Date("2026-05-24T20:00:00.000Z"),
    request: {
      source: "bob.md",
      designatorPath: "bob/page-main",
      workingFile: "bob-page-main.md",
    },
  });

  assertEquals(result.designatorPath, "bob/page-main");
  assertEquals(result.workingLocalRelativePath, "bob-page-main.md");
  assertEquals(result.observedContentDigest, expectedDigest);
  assertEquals(
    [...result.createdPaths].sort(),
    [
      "bob-page-main.md",
      "bob/page-main/_knop/_inventory/inventory.ttl",
      "bob/page-main/_knop/_meta/meta.ttl",
      "bob/page-main/_knop/_sources/sources.ttl",
    ],
  );
  assertEquals(result.updatedPaths, ["_mesh/_inventory/inventory.ttl"]);
  assertEquals(
    await Deno.readTextFile(join(workspaceRoot, "bob-page-main.md")),
    "# Bob\n",
  );

  const inventory = await Deno.readTextFile(
    join(workspaceRoot, "bob/page-main/_knop/_inventory/inventory.ttl"),
  );
  assertStringIncludes(
    inventory,
    "<bob/page-main> a sflo:PayloadArtifact, sflo:DigitalArtifact ;",
  );
  assertStringIncludes(inventory, "<bob-page-main.md> a sflo:LocatedFile .");
  assertEquals(
    inventory.includes(
      "bob-page-main.md> a sflo:LocatedFile, sflo:RdfDocument",
    ),
    false,
  );

  const sources = await Deno.readTextFile(
    join(workspaceRoot, "bob/page-main/_knop/_sources/sources.ttl"),
  );
  assertStringIncludes(
    sources,
    "<bob/page-main/_knop/_sources#payload-source> a sflo:ImportSource ;",
  );
  assertEquals(sources.includes("weave-import-local-source"), false);
  assertStringIncludes(
    sources,
    `sflo:observedContentDigest "${expectedDigest}" ;`,
  );
  assertStringIncludes(
    sources,
    `sflo:observedArtifactResolutionSpec [
    a sflo:ArtifactResolutionSpec ;
    sflo:targetLocalRelativePath "bob-page-main.md"
  ] ;`,
  );
  assertStringIncludes(
    sources,
    'sflo:observedAt "2026-05-24T20:00:00.000Z"^^<http://www.w3.org/2001/XMLSchema#dateTime> .',
  );
});

Deno.test("executeImport accepts file URL sources and verifies expected digest", async () => {
  const workspaceRoot = await createTestTmpDir("weave-import-file-url-");
  await executeMeshCreate({
    workspaceRoot,
    meshRoot: ".",
    request: {
      meshBase: "https://semantic-flow.github.io/mesh-alice-bio/",
    },
  });
  const sourcePath = join(workspaceRoot, "incoming.ttl");
  const sourceBytes = encode("@prefix schema: <https://schema.org/> .\n");
  await Deno.writeFile(sourcePath, sourceBytes);
  const expectedDigest = await sha256Digest(sourceBytes);

  const result = await executeImport({
    meshRoot: workspaceRoot,
    request: {
      source: toFileUrl(sourcePath).href,
      designatorPath: "alice/data",
      workingFile: "alice-data.ttl",
      expectedDigest,
    },
    now: () => new Date("2026-05-24T20:00:00.000Z"),
  });

  assertEquals(result.observedContentDigest, expectedDigest);
  assertEquals(
    await Deno.readTextFile(join(workspaceRoot, "alice-data.ttl")),
    "@prefix schema: <https://schema.org/> .\n",
  );
  const inventory = await Deno.readTextFile(
    join(workspaceRoot, "alice/data/_knop/_inventory/inventory.ttl"),
  );
  assertStringIncludes(
    inventory,
    "<alice/data> a sflo:PayloadArtifact, sflo:DigitalArtifact, sflo:RdfDocument ;",
  );
});

Deno.test("executeImport rejects expected digest mismatches before writing", async () => {
  const workspaceRoot = await createTestTmpDir("weave-import-digest-");
  await executeMeshCreate({
    workspaceRoot,
    meshRoot: ".",
    request: {
      meshBase: "https://semantic-flow.github.io/mesh-alice-bio/",
    },
  });
  await Deno.writeTextFile(join(workspaceRoot, "source.md"), "# Bob\n");

  await assertRejects(
    () =>
      executeImport({
        meshRoot: workspaceRoot,
        request: {
          source: "source.md",
          designatorPath: "bob/page-main",
          workingFile: "bob-page-main.md",
          expectedDigest: "sha256:not-the-current-file",
        },
      }),
    ImportRuntimeError,
    "import source digest mismatch",
  );
  await assertRejects(
    () => Deno.stat(join(workspaceRoot, "bob-page-main.md")),
    Deno.errors.NotFound,
  );
});

Deno.test("executeImport fetches bounded HTTP sources through the explicit import path", async () => {
  const workspaceRoot = await createTestTmpDir("weave-import-http-");
  await executeMeshCreate({
    workspaceRoot,
    meshRoot: ".",
    request: {
      meshBase: "https://semantic-flow.github.io/mesh-alice-bio/",
    },
  });
  const sourceBytes = encode("# Bob from HTTP\n");
  const expectedDigest = await sha256Digest(sourceBytes);

  const result = await executeImport({
    meshRoot: workspaceRoot,
    sourceFetch: (input: string | URL | Request) => {
      assertEquals(String(input), "https://example.com/bob.md");
      return Promise.resolve(
        new Response("# Bob from HTTP\n", {
          status: 200,
          headers: {
            "content-type": "text/markdown",
          },
        }),
      );
    },
    now: () => new Date("2026-05-24T20:00:00.000Z"),
    request: {
      source: "https://example.com/bob.md",
      designatorPath: "bob/page-main",
      workingFile: "bob-page-main.md",
      expectedDigest,
    },
  });

  assertEquals(result.observedContentDigest, expectedDigest);
  assertEquals(
    await Deno.readTextFile(join(workspaceRoot, "bob-page-main.md")),
    "# Bob from HTTP\n",
  );
  const sources = await Deno.readTextFile(
    join(workspaceRoot, "bob/page-main/_knop/_sources/sources.ttl"),
  );
  assertStringIncludes(
    sources,
    'sflo:targetAccessUrl "https://example.com/bob.md" ;',
  );
  assertStringIncludes(
    sources,
    `sflo:expectsContentDigest "${expectedDigest}" ;`,
  );
  assertEquals(sources.includes("sflo:workingAccessUrl"), false);
});

Deno.test("executeImport can introduce payloads into docs-rooted sidecar meshes", async () => {
  const workspaceRoot = await createTestTmpDir("weave-import-sidecar-");
  const sourceRoot = join(workspaceRoot, "content");
  await Deno.mkdir(sourceRoot, { recursive: true });
  await Deno.writeTextFile(join(sourceRoot, "gunaar.md"), "# Gunaar\n");
  await executeMeshCreate({
    workspaceRoot,
    meshRoot: "docs",
    request: {
      meshBase: "https://semantic-flow.github.io/mesh-sidecar-fantasy-rules/",
      publicationProfile: "githubPages",
    },
  });

  const result = await executeImport({
    meshRoot: join(workspaceRoot, "docs"),
    sourceBaseDirectory: sourceRoot,
    now: () => new Date("2026-05-24T20:00:00.000Z"),
    request: {
      source: "gunaar.md",
      designatorPath: "characters/gunaar/page-main",
      workingFile: "pages/gunaar.md",
    },
  });

  assert(result.createdPaths.includes("docs/pages/gunaar.md"));
  assertEquals(result.updatedPaths, ["docs/_mesh/_inventory/inventory.ttl"]);
  assertEquals(
    await Deno.readTextFile(join(workspaceRoot, "docs/pages/gunaar.md")),
    "# Gunaar\n",
  );
  const sources = await Deno.readTextFile(
    join(
      workspaceRoot,
      "docs/characters/gunaar/page-main/_knop/_sources/sources.ttl",
    ),
  );
  assertEquals(sources.includes("weave-import-sidecar"), false);
  assertStringIncludes(
    sources,
    'sflo:targetLocalRelativePath "pages/gunaar.md"',
  );
});

Deno.test("executeImport can copy from a separate source checkout into a branch-style mesh", async () => {
  const workspaceRoot = await createTestTmpDir("weave-import-branch-");
  const sourceRoot = join(workspaceRoot, "source-worktree");
  await Deno.mkdir(join(sourceRoot, "profiles"), { recursive: true });
  await Deno.writeTextFile(join(sourceRoot, "profiles/bob.md"), "# Bob\n");
  await executeMeshCreate({
    workspaceRoot,
    meshRoot: "publication",
    request: {
      meshBase: "https://semantic-flow.github.io/mesh-branch-fantasy-rules/",
      publicationProfile: "githubPages",
    },
  });

  const result = await executeImport({
    meshRoot: join(workspaceRoot, "publication"),
    sourceBaseDirectory: sourceRoot,
    now: () => new Date("2026-05-24T20:00:00.000Z"),
    request: {
      source: "profiles/bob.md",
      designatorPath: "bob/page-main",
      workingFile: "bob/page-main.md",
    },
  });

  assert(result.createdPaths.includes("publication/bob/page-main.md"));
  assertEquals(
    await Deno.readTextFile(
      join(workspaceRoot, "publication/bob/page-main.md"),
    ),
    "# Bob\n",
  );
  assertEquals(
    await Deno.readTextFile(join(sourceRoot, "profiles/bob.md")),
    "# Bob\n",
  );
  const sources = await Deno.readTextFile(
    join(workspaceRoot, "publication/bob/page-main/_knop/_sources/sources.ttl"),
  );
  assertEquals(sources.includes("source-worktree"), false);
  assertStringIncludes(
    sources,
    'sflo:targetLocalRelativePath "bob/page-main.md"',
  );
});

Deno.test("executeImport replaceWorking refreshes working bytes and import provenance", async () => {
  const workspaceRoot = await createTestTmpDir("weave-import-replace-");
  await executeMeshCreate({
    workspaceRoot,
    meshRoot: ".",
    request: {
      meshBase: "https://semantic-flow.github.io/mesh-alice-bio/",
    },
  });
  await Deno.writeTextFile(join(workspaceRoot, "bob-v1.md"), "# Bob v1\n");
  await executeImport({
    meshRoot: workspaceRoot,
    now: () => new Date("2026-05-24T20:00:00.000Z"),
    request: {
      source: "bob-v1.md",
      designatorPath: "bob/page-main",
      workingFile: "bob-page-main.md",
    },
  });

  await Deno.writeTextFile(join(workspaceRoot, "bob-v2.md"), "# Bob v2\n");
  const secondDigest = await sha256Digest(encode("# Bob v2\n"));
  const result = await executeImport({
    meshRoot: workspaceRoot,
    now: () => new Date("2026-05-24T21:00:00.000Z"),
    request: {
      source: "bob-v2.md",
      designatorPath: "bob/page-main",
      workingFile: "bob-page-main.md",
      replaceWorking: true,
    },
  });

  assertEquals(result.createdPaths, []);
  assertEquals(
    [...result.updatedPaths].sort(),
    [
      "bob-page-main.md",
      "bob/page-main/_knop/_sources/sources.ttl",
    ],
  );
  assertEquals(
    await Deno.readTextFile(join(workspaceRoot, "bob-page-main.md")),
    "# Bob v2\n",
  );
  const sources = await Deno.readTextFile(
    join(workspaceRoot, "bob/page-main/_knop/_sources/sources.ttl"),
  );
  assertStringIncludes(
    sources,
    `sflo:observedContentDigest "${secondDigest}" ;`,
  );
  assertStringIncludes(
    sources,
    'sflo:observedAt "2026-05-24T21:00:00.000Z"^^<http://www.w3.org/2001/XMLSchema#dateTime> .',
  );
});

function encode(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

async function sha256Digest(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new Uint8Array(bytes));
  const hex = [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return `sha256:${hex}`;
}
