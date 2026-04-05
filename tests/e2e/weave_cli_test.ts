import { assert, assertEquals } from "@std/assert";
import { join, relative } from "@std/path";
import { compareRdfContent } from "../../dependencies/github.com/spectacular-voyage/accord/src/checker/compare_rdf.ts";
import {
  getManifestFileExpectations,
  readSingleTransitionCase,
} from "../support/accord_manifest.ts";
import {
  listMeshAliceBioBranchFiles,
  materializeMeshAliceBioBranch,
  readMeshAliceBioBranchFile,
  resolveMeshAliceBioConformanceManifestPath,
} from "../support/mesh_alice_bio_fixture.ts";
import { createTestTmpDir } from "../support/test_tmp.ts";

const repoRoot = new URL("../../", import.meta.url);

Deno.test("weave matches the manifest-scoped alice knop-created-woven fixture as a black-box CLI run", async () => {
  await assertWeaveTransitionMatchesManifest({
    manifestName: "05-alice-knop-created-woven.jsonld",
    expectedStdoutFragment: "Wove 1 designator path",
  });
});

Deno.test("weave matches the manifest-scoped alice bio integrated-woven fixture as a black-box CLI run", async () => {
  await assertWeaveTransitionMatchesManifest({
    manifestName: "07-alice-bio-integrated-woven.jsonld",
    expectedStdoutFragment: "Wove 1 designator path",
  });
});

Deno.test("weave matches the manifest-scoped alice bio referenced-woven fixture as a black-box CLI run", async () => {
  await assertWeaveTransitionMatchesManifest({
    manifestName: "09-alice-bio-referenced-woven.jsonld",
    expectedStdoutFragment: "Wove 1 designator path",
  });
});

Deno.test("weave matches the manifest-scoped alice bio v2 woven fixture as a black-box CLI run", async () => {
  await assertWeaveTransitionMatchesManifest({
    manifestName: "11-alice-bio-v2-woven.jsonld",
    expectedStdoutFragment: "Wove 1 designator path",
    compareTextFiles: false,
  });
});

async function assertWeaveTransitionMatchesManifest(
  options: {
    manifestName: string;
    expectedStdoutFragment: string;
    compareTextFiles?: boolean;
  },
): Promise<void> {
  const manifestPath = resolveMeshAliceBioConformanceManifestPath(
    options.manifestName,
  );
  const transitionCase = await readSingleTransitionCase(manifestPath);
  assertEquals(transitionCase.operationId, "weave");

  const workspaceRoot = await createTestTmpDir(
    `weave-e2e-${options.manifestName}-`,
  );
  await materializeMeshAliceBioBranch(transitionCase.fromRef!, workspaceRoot);

  const command = new Deno.Command("deno", {
    args: [
      "run",
      "--allow-read",
      "--allow-write",
      "--allow-env",
      "src/main.ts",
      "--workspace",
      workspaceRoot,
    ],
    cwd: new URL(".", repoRoot),
    stdout: "piped",
    stderr: "piped",
  });
  const output = await command.output();
  const stdout = new TextDecoder().decode(output.stdout);
  const stderr = new TextDecoder().decode(output.stderr);

  assert(output.success, stderr);
  assert(stdout.includes(options.expectedStdoutFragment), stdout);

  assertEquals(
    await listRelativeFiles(workspaceRoot, ".weave/"),
    await listMeshAliceBioBranchFiles(transitionCase.toRef!),
  );

  const fileExpectations = getManifestFileExpectations(transitionCase);
  for (const fileExpectation of fileExpectations) {
    const path = fileExpectation.path;
    if (!path) {
      continue;
    }

    const actualBytes = await Deno.readFile(join(workspaceRoot, path));
    const expectedBytes = new TextEncoder().encode(
      await readMeshAliceBioBranchFile(transitionCase.toRef!, path),
    );
    const compareMode = fileExpectation.compareMode ?? "bytes";

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
      if (options.compareTextFiles === false) {
        await Deno.stat(join(workspaceRoot, path));
        continue;
      }
      assertEquals(
        new TextDecoder().decode(actualBytes),
        new TextDecoder().decode(expectedBytes),
      );
      continue;
    }

    assertEquals(actualBytes, expectedBytes);
  }

  await Deno.stat(join(workspaceRoot, ".weave/logs/operational.jsonl"));
  await Deno.stat(join(workspaceRoot, ".weave/logs/security-audit.jsonl"));
}

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
