import { assert, assertEquals } from "@std/assert";
import { join, relative } from "@std/path";
import { compareRdfContent } from "../../dependencies/github.com/spectacular-voyage/accord/src/checker/compare_rdf.ts";
import {
  getManifestFileExpectations,
  readSingleTransitionCase,
} from "../support/accord_manifest.ts";
import {
  readMeshAliceBioBranchFile,
  resolveMeshAliceBioConformanceManifestPath,
} from "../support/mesh_alice_bio_fixture.ts";
import { createTestTmpDir } from "../support/test_tmp.ts";

const repoRoot = new URL("../../", import.meta.url);

Deno.test("weave mesh create matches the manifest-scoped alice-bio fixture as a black-box CLI run", async () => {
  const manifestPath = resolveMeshAliceBioConformanceManifestPath(
    "02-mesh-created.jsonld",
  );
  const transitionCase = await readSingleTransitionCase(manifestPath);
  assertEquals(transitionCase.operationId, "mesh.create");
  assertEquals(transitionCase.fromRef, "01-source-only");
  assertEquals(transitionCase.toRef, "02-mesh-created");

  const workspaceRoot = await createTestTmpDir("weave-e2e-mesh-create-");
  await Deno.writeTextFile(
    join(workspaceRoot, "alice-bio.ttl"),
    await readMeshAliceBioBranchFile(transitionCase.fromRef!, "alice-bio.ttl"),
  );

  const command = new Deno.Command("deno", {
    args: [
      "run",
      "--allow-read",
      "--allow-write",
      "--allow-env",
      "src/main.ts",
      "mesh",
      "create",
      "--workspace",
      workspaceRoot,
      "--mesh-base",
      "https://semantic-flow.github.io/mesh-alice-bio/",
    ],
    cwd: new URL(".", repoRoot),
    stdout: "piped",
    stderr: "piped",
  });
  const output = await command.output();
  const stdout = new TextDecoder().decode(output.stdout);
  const stderr = new TextDecoder().decode(output.stderr);

  assert(output.success, stderr);
  assert(stdout.includes("Created 2 mesh support artifacts"), stdout);

  const fileExpectations = getManifestFileExpectations(transitionCase);
  const expectedPaths = fileExpectations
    .map((expectation) => expectation.path)
    .filter((path): path is string => typeof path === "string")
    .sort();

  assertEquals(
    await listRelativeFiles(workspaceRoot, ".weave/"),
    expectedPaths,
  );

  for (const fileExpectation of fileExpectations) {
    const path = fileExpectation.path;
    if (!path) {
      continue;
    }

    const compareMode = fileExpectation.compareMode;

    if (compareMode === undefined) {
      await Deno.stat(join(workspaceRoot, path));
      continue;
    }

    const actualBytes = await Deno.readFile(join(workspaceRoot, path));
    const expectedBytes = new TextEncoder().encode(
      await readMeshAliceBioBranchFile(transitionCase.toRef!, path),
    );

    if (compareMode === "rdfCanonical") {
      assertEquals(
        await compareRdfContent({
          left: actualBytes,
          right: expectedBytes,
          path,
        }),
        true,
      );
      continue;
    }

    if (compareMode === "text") {
      assertEquals(
        new TextDecoder().decode(actualBytes),
        new TextDecoder().decode(expectedBytes),
      );
      continue;
    }

    if (compareMode === "bytes") {
      assertEquals(actualBytes, expectedBytes);
      continue;
    }

    throw new Error(`Unsupported compare mode ${compareMode} for ${path}`);
  }

  await Deno.stat(join(workspaceRoot, ".weave/logs/operational.jsonl"));
  await Deno.stat(join(workspaceRoot, ".weave/logs/security-audit.jsonl"));
});

async function listRelativeFiles(
  root: string,
  excludedPrefix: string,
): Promise<string[]> {
  const paths: string[] = [];

  for await (const entry of walkFiles(root)) {
    const rel = relative(root, entry).replaceAll("\\", "/");
    if (rel.startsWith(excludedPrefix)) {
      continue;
    }
    paths.push(rel);
  }

  return paths.sort();
}

async function* walkFiles(root: string): AsyncGenerator<string> {
  for await (const entry of Deno.readDir(root)) {
    const path = join(root, entry.name);
    if (entry.isDirectory) {
      yield* walkFiles(path);
      continue;
    }
    if (entry.isFile) {
      yield path;
    }
  }
}
