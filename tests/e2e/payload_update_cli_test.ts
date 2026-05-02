import { assert, assertEquals, assertRejects } from "@std/assert";
import { join, relative } from "@std/path";
import { compareRdfContent } from "../../dependencies/github.com/spectacular-voyage/accord/src/checker/compare_rdf.ts";
import {
  getManifestFileExpectations,
  readSingleTransitionCase,
  shouldCompareManifestTextFileContents,
} from "../support/accord_manifest.ts";
import {
  listMeshAliceBioBranchFiles,
  materializeMeshAliceBioBranch,
  readMeshAliceBioBranchFile,
  resolveMeshAliceBioConformanceManifestPath,
} from "../support/mesh_alice_bio_fixture.ts";
import {
  bootstrapRootWovenWorkspace,
  ROOT_PAYLOAD_TURTLE_V2,
} from "../support/root_designator.ts";
import { createTestTmpDir } from "../support/test_tmp.ts";

const repoRoot = new URL("../../", import.meta.url);

Deno.test("weave payload update matches the manifest-scoped alice-bio updated fixture as a black-box CLI run", async () => {
  const manifestPath = resolveMeshAliceBioConformanceManifestPath(
    "10-alice-bio-updated.jsonld",
  );
  const transitionCase = await readSingleTransitionCase(manifestPath);
  assertEquals(transitionCase.operationId, "payload.update");

  const workspaceRoot = await createTestTmpDir("weave-e2e-payload-update-");
  await materializeMeshAliceBioBranch(transitionCase.fromRef!, workspaceRoot);

  const sourceRoot = await createTestTmpDir(
    "weave-e2e-payload-update-source-",
  );
  const sourcePath = join(sourceRoot, "alice-bio-v2.ttl");
  await Deno.writeTextFile(
    sourcePath,
    await readMeshAliceBioBranchFile(transitionCase.toRef!, "alice-bio.ttl"),
  );

  const command = new Deno.Command("deno", {
    args: [
      "run",
      "--allow-read",
      "--allow-write",
      "--allow-env",
      "src/main.ts",
      "payload",
      "update",
      sourcePath,
      "--designator-path",
      "alice/bio",
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
  assert(stdout.includes("Updated payload"), stdout);

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
      if (!shouldCompareManifestTextFileContents(path)) {
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
});

Deno.test("weave payload update accepts the root designator path as a black-box CLI run", async () => {
  const workspaceRoot = await createTestTmpDir(
    "weave-e2e-payload-update-root-",
  );
  await materializeMeshAliceBioBranch(
    "05-alice-knop-created-woven",
    workspaceRoot,
  );
  await bootstrapRootWovenWorkspace(workspaceRoot);

  const sourceRoot = await createTestTmpDir(
    "weave-e2e-payload-update-root-source-",
  );
  const sourcePath = join(sourceRoot, "root-v2.ttl");
  await Deno.writeTextFile(sourcePath, ROOT_PAYLOAD_TURTLE_V2);

  const command = new Deno.Command("deno", {
    args: [
      "run",
      "--allow-read",
      "--allow-write",
      "--allow-env",
      "src/main.ts",
      "payload",
      "update",
      sourcePath,
      "/",
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
  assert(stdout.includes("Updated payload"), stdout);
  assertEquals(
    await Deno.readTextFile(join(workspaceRoot, "root.ttl")),
    ROOT_PAYLOAD_TURTLE_V2,
  );
});

Deno.test("weave payload update rejects conflicting designator paths before logging or execution", async () => {
  const workspaceRoot = await createTestTmpDir(
    "weave-e2e-payload-update-conflict-",
  );
  await materializeMeshAliceBioBranch(
    "09-alice-bio-referenced-woven",
    workspaceRoot,
  );

  const sourceRoot = await createTestTmpDir(
    "weave-e2e-payload-update-conflict-source-",
  );
  const sourcePath = join(sourceRoot, "alice-bio-v2.ttl");
  await Deno.writeTextFile(
    sourcePath,
    await readMeshAliceBioBranchFile("10-alice-bio-updated", "alice-bio.ttl"),
  );

  const command = new Deno.Command("deno", {
    args: [
      "run",
      "--allow-read",
      "--allow-write",
      "--allow-env",
      "src/main.ts",
      "payload",
      "update",
      sourcePath,
      "alice/bio",
      "--designator-path",
      "bob/bio",
      "--workspace",
      workspaceRoot,
    ],
    cwd: new URL(".", repoRoot),
    stdout: "piped",
    stderr: "piped",
  });
  const output = await command.output();
  const stderr = new TextDecoder().decode(output.stderr);

  assertEquals(output.success, false);
  assert(
    stderr.includes("payload update received conflicting designator paths"),
    stderr,
  );
  await assertRejects(
    () => Deno.stat(join(workspaceRoot, ".weave/logs/security-audit.jsonl")),
    Deno.errors.NotFound,
  );
  assertEquals(
    await Deno.readTextFile(join(workspaceRoot, "alice-bio.ttl")),
    await readMeshAliceBioBranchFile(
      "09-alice-bio-referenced-woven",
      "alice-bio.ttl",
    ),
  );
});

Deno.test("weave payload update requires a designator path before logging or execution", async () => {
  const workspaceRoot = await createTestTmpDir(
    "weave-e2e-payload-update-missing-designator-",
  );
  await materializeMeshAliceBioBranch(
    "09-alice-bio-referenced-woven",
    workspaceRoot,
  );

  const sourceRoot = await createTestTmpDir(
    "weave-e2e-payload-update-missing-designator-source-",
  );
  const sourcePath = join(sourceRoot, "alice-bio-v2.ttl");
  await Deno.writeTextFile(
    sourcePath,
    await readMeshAliceBioBranchFile("10-alice-bio-updated", "alice-bio.ttl"),
  );

  const command = new Deno.Command("deno", {
    args: [
      "run",
      "--allow-read",
      "--allow-write",
      "--allow-env",
      "src/main.ts",
      "payload",
      "update",
      sourcePath,
      "--workspace",
      workspaceRoot,
    ],
    cwd: new URL(".", repoRoot),
    stdout: "piped",
    stderr: "piped",
  });
  const output = await command.output();
  const stderr = new TextDecoder().decode(output.stderr);

  assertEquals(output.success, false);
  assert(
    stderr.includes(
      "payload update requires a designator path as [designatorPath] or --designator-path",
    ),
    stderr,
  );
  await assertRejects(
    () => Deno.stat(join(workspaceRoot, ".weave/logs/security-audit.jsonl")),
    Deno.errors.NotFound,
  );
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
