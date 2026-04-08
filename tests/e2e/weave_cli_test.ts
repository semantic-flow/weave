import { assert, assertEquals, assertRejects } from "@std/assert";
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

Deno.test("weave validate succeeds as a black-box CLI run", async () => {
  const workspaceRoot = await createTestTmpDir("weave-e2e-validate-");
  await materializeMeshAliceBioBranch("06-alice-bio-integrated", workspaceRoot);

  const output = await runCliCommand([
    "validate",
    "--target",
    "designatorPath=alice/bio",
    "--workspace",
    workspaceRoot,
  ]);
  const stdout = new TextDecoder().decode(output.stdout);
  const stderr = new TextDecoder().decode(output.stderr);

  assert(output.success, stderr);
  assert(stdout.includes("Validated 1 designator path"), stdout);
});

Deno.test("weave version succeeds as a black-box CLI run", async () => {
  const workspaceRoot = await createTestTmpDir("weave-e2e-version-");
  await materializeMeshAliceBioBranch("06-alice-bio-integrated", workspaceRoot);

  const output = await runCliCommand([
    "version",
    "--target",
    "designatorPath=alice/bio",
    "--payload-history-segment",
    "releases",
    "--payload-state-segment",
    "v0.0.1",
    "--workspace",
    workspaceRoot,
  ]);
  const stdout = new TextDecoder().decode(output.stdout);
  const stderr = new TextDecoder().decode(output.stderr);

  assert(output.success, stderr);
  assert(stdout.includes("Versioned 1 designator path"), stdout);
  await Deno.stat(
    join(
      workspaceRoot,
      "alice/bio/releases/v0.0.1/alice-bio-ttl/alice-bio.ttl",
    ),
  );
  await assertRejects(
    () => Deno.stat(join(workspaceRoot, "alice/bio/releases/index.html")),
    Deno.errors.NotFound,
  );
});

Deno.test("weave generate succeeds as a black-box CLI run", async () => {
  const workspaceRoot = await createTestTmpDir("weave-e2e-generate-");
  await materializeMeshAliceBioBranch("10-alice-bio-updated", workspaceRoot);

  const meshInventoryBefore = await Deno.readTextFile(
    join(workspaceRoot, "_mesh/_inventory/inventory.ttl"),
  );
  const output = await runCliCommand([
    "generate",
    "--target",
    "designatorPath=alice/bio",
    "--workspace",
    workspaceRoot,
  ]);
  const stdout = new TextDecoder().decode(output.stdout);
  const stderr = new TextDecoder().decode(output.stderr);

  assert(output.success, stderr);
  assert(stdout.includes("Generated 1 designator path"), stdout);
  await Deno.stat(join(workspaceRoot, "alice/bio/index.html"));
  await assertRejects(
    () =>
      Deno.stat(
        join(workspaceRoot, "alice/bio/_history001/_s0002/index.html"),
      ),
    Deno.errors.NotFound,
  );
  assertEquals(
    await Deno.readTextFile(
      join(workspaceRoot, "_mesh/_inventory/inventory.ttl"),
    ),
    meshInventoryBefore,
  );
});

Deno.test("weave matches the manifest-scoped alice bio integrated-woven fixture as a black-box CLI run", async () => {
  await assertWeaveTransitionMatchesManifest({
    manifestName: "07-alice-bio-integrated-woven.jsonld",
    expectedStdoutFragment: "Wove 1 designator path",
  });
});

Deno.test("weave accepts an exact --target spec as a black-box CLI run", async () => {
  await assertWeaveTransitionMatchesManifest({
    manifestName: "07-alice-bio-integrated-woven.jsonld",
    expectedStdoutFragment: "Wove 1 designator path",
    cliArgs: ["--target", "designatorPath=alice/bio"],
  });
});

Deno.test("weave accepts a recursive --target spec as a black-box CLI run", async () => {
  await assertWeaveTransitionMatchesManifest({
    manifestName: "07-alice-bio-integrated-woven.jsonld",
    expectedStdoutFragment: "Wove 1 designator path",
    cliArgs: ["--target", "designatorPath=alice,recursive=true"],
  });
});

Deno.test("weave accepts payload history/state naming flags as a black-box CLI run", async () => {
  const workspaceRoot = await createTestTmpDir("weave-e2e-payload-naming-");
  await materializeMeshAliceBioBranch("06-alice-bio-integrated", workspaceRoot);

  const command = new Deno.Command("deno", {
    args: [
      "run",
      "--allow-read",
      "--allow-write",
      "--allow-env",
      "src/main.ts",
      "--target",
      "designatorPath=alice/bio",
      "--payload-history-segment",
      "releases",
      "--payload-state-segment",
      "v0.0.1",
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
  assert(stdout.includes("Wove 1 designator path"), stdout);
  await Deno.stat(
    join(
      workspaceRoot,
      "alice/bio/releases/v0.0.1/alice-bio-ttl/alice-bio.ttl",
    ),
  );
  await Deno.stat(join(workspaceRoot, "alice/bio/releases/index.html"));
  await Deno.stat(join(workspaceRoot, "alice/bio/releases/v0.0.1/index.html"));
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

Deno.test("weave matches the manifest-scoped bob extracted woven fixture as a black-box CLI run", async () => {
  await assertWeaveTransitionMatchesManifest({
    manifestName: "13-bob-extracted-woven.jsonld",
    expectedStdoutFragment: "Wove 1 designator path",
    compareWorkspaceTree: false,
  });
});

Deno.test("weave rejects unsupported --target fields", async () => {
  const workspaceRoot = await createTestTmpDir("weave-e2e-target-parse-");
  await materializeMeshAliceBioBranch("06-alice-bio-integrated", workspaceRoot);

  const command = new Deno.Command("deno", {
    args: [
      "run",
      "--allow-read",
      "--allow-write",
      "--allow-env",
      "src/main.ts",
      "--target",
      "designatorPath=alice/bio,stateSegment=v0.0.1",
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
    stderr.includes("weave --target[0].stateSegment is not supported"),
    stderr,
  );
});

async function assertWeaveTransitionMatchesManifest(
  options: {
    manifestName: string;
    expectedStdoutFragment: string;
    compareTextFiles?: boolean;
    compareWorkspaceTree?: boolean;
    cliArgs?: readonly string[];
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

  const output = await runCliCommand([
    ...(options.cliArgs ?? []),
    "--workspace",
    workspaceRoot,
  ]);
  const stdout = new TextDecoder().decode(output.stdout);
  const stderr = new TextDecoder().decode(output.stderr);

  assert(output.success, stderr);
  assert(stdout.includes(options.expectedStdoutFragment), stdout);

  if (options.compareWorkspaceTree !== false) {
    assertEquals(
      await listRelativeFiles(workspaceRoot, ".weave/"),
      await listMeshAliceBioBranchFiles(transitionCase.toRef!),
    );
  }

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
      if (options.compareTextFiles === false || path.endsWith(".html")) {
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

function runCliCommand(args: readonly string[]): Promise<Deno.CommandOutput> {
  const command = new Deno.Command("deno", {
    args: [
      "run",
      "--allow-read",
      "--allow-write",
      "--allow-env",
      "src/main.ts",
      ...args,
    ],
    cwd: new URL(".", repoRoot),
    stdout: "piped",
    stderr: "piped",
  });

  return command.output();
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
