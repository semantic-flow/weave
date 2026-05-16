import {
  assert,
  assertEquals,
  assertRejects,
  assertStringIncludes,
} from "@std/assert";
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
import {
  listMeshSidecarFantasyRulesBranchFiles,
  materializeMeshSidecarFantasyRulesBranch,
  readMeshSidecarFantasyRulesBranchFile,
  resolveMeshSidecarFantasyRulesConformanceManifestPath,
} from "../support/mesh_sidecar_fantasy_rules_fixture.ts";
import { createTestTmpDir } from "../support/test_tmp.ts";

const repoRoot = new URL("../../", import.meta.url);

Deno.test("weave knop create matches the manifest-scoped alice-bio fixture as a black-box CLI run", async () => {
  const manifestPath = resolveMeshAliceBioConformanceManifestPath(
    "04-alice-knop-created.jsonld",
  );
  const transitionCase = await readSingleTransitionCase(manifestPath);
  assertEquals(transitionCase.operationId, "knop.create");
  assertEquals(transitionCase.fromRef, "03-mesh-created-woven");
  assertEquals(transitionCase.toRef, "04-alice-knop-created");

  const workspaceRoot = await createTestTmpDir("weave-e2e-knop-create-");
  await materializeMeshAliceBioBranch(transitionCase.fromRef!, workspaceRoot);

  const command = new Deno.Command("deno", {
    args: [
      "run",
      "--allow-read",
      "--allow-write",
      "--allow-env",
      "src/main.ts",
      "knop",
      "create",
      transitionCase.targetDesignatorPath!,
      "--mesh-root",
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
  assert(stdout.includes("Created 2 knop support artifacts"), stdout);

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

Deno.test("weave knop create accepts the root designator path as a black-box CLI run", async () => {
  const workspaceRoot = await createTestTmpDir("weave-e2e-knop-create-root-");
  await materializeMeshAliceBioBranch("03-mesh-created-woven", workspaceRoot);

  const command = new Deno.Command("deno", {
    args: [
      "run",
      "--allow-read",
      "--allow-write",
      "--allow-env",
      "src/main.ts",
      "knop",
      "create",
      "/",
      "--mesh-root",
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
  assert(stdout.includes("Created 2 knop support artifacts"), stdout);
  assertStringIncludes(
    await Deno.readTextFile(join(workspaceRoot, "_knop/_meta/meta.ttl")),
    'sflo:designatorPath ""',
  );
  await Deno.stat(join(workspaceRoot, "_knop/_inventory/inventory.ttl"));
});

Deno.test("weave CLI honors WEAVE_LOG_DIR for runtime logs", async () => {
  const workspaceRoot = await createTestTmpDir("weave-e2e-knop-create-log-");
  const logRoot = await createTestTmpDir("weave-e2e-log-root-");
  await materializeMeshAliceBioBranch("03-mesh-created-woven", workspaceRoot);

  const command = new Deno.Command("deno", {
    args: [
      "run",
      "--allow-read",
      "--allow-write",
      "--allow-env",
      "src/main.ts",
      "knop",
      "create",
      "alice",
      "--mesh-root",
      workspaceRoot,
    ],
    cwd: new URL(".", repoRoot),
    env: {
      WEAVE_LOG_DIR: logRoot,
    },
    stdout: "piped",
    stderr: "piped",
  });
  const output = await command.output();
  const stderr = new TextDecoder().decode(output.stderr);

  assert(output.success, stderr);
  await Deno.stat(join(logRoot, "operational.jsonl"));
  await Deno.stat(join(logRoot, "security-audit.jsonl"));
  await assertRejects(
    () => Deno.stat(join(workspaceRoot, ".weave/logs/operational.jsonl")),
    Deno.errors.NotFound,
  );
});

Deno.test("weave knop create matches the manifest-scoped sidecar root and examples Knop fixture", async () => {
  const manifestPath = resolveMeshSidecarFantasyRulesConformanceManifestPath(
    "10-root-knop.jsonld",
  );
  const transitionCase = await readSingleTransitionCase(manifestPath);
  assertEquals(transitionCase.operationId, "knop.create");
  assertEquals(
    transitionCase.fromRef,
    "09-ontology-and-shacl-terms-extracted-woven",
  );
  assertEquals(transitionCase.toRef, "10-root-knop");

  const targetDesignatorPaths = transitionCase.targetDesignatorPaths;
  assert(Array.isArray(targetDesignatorPaths));
  assertEquals(targetDesignatorPaths, ["/", "examples"]);

  const workspaceRoot = await createTestTmpDir(
    "weave-e2e-knop-create-sidecar-",
  );
  await materializeMeshSidecarFantasyRulesBranch(
    transitionCase.fromRef!,
    workspaceRoot,
  );

  for (const targetDesignatorPath of targetDesignatorPaths) {
    const command = new Deno.Command("deno", {
      args: [
        "run",
        "--allow-read",
        "--allow-write",
        "--allow-env",
        "src/main.ts",
        "knop",
        "create",
        targetDesignatorPath,
        "--mesh-root",
        join(workspaceRoot, "docs"),
      ],
      cwd: new URL(".", repoRoot),
      stdout: "piped",
      stderr: "piped",
    });
    const output = await command.output();
    const stdout = new TextDecoder().decode(output.stdout);
    const stderr = new TextDecoder().decode(output.stderr);

    assert(output.success, stderr);
    assert(stdout.includes("Created 2 knop support artifacts"), stdout);
  }

  assertEquals(
    await listRelativeFiles(workspaceRoot, ".weave/"),
    await listMeshSidecarFantasyRulesBranchFiles(transitionCase.toRef!),
  );

  const fileExpectations = getManifestFileExpectations(transitionCase);
  for (const fileExpectation of fileExpectations) {
    const path = fileExpectation.path;
    if (!path) {
      continue;
    }

    if (fileExpectation.changeType === "absent") {
      await assertRejects(
        () => Deno.stat(join(workspaceRoot, path)),
        Deno.errors.NotFound,
      );
      continue;
    }

    const compareMode = fileExpectation.compareMode;
    if (compareMode === undefined) {
      await Deno.stat(join(workspaceRoot, path));
      continue;
    }

    const actualBytes = await Deno.readFile(join(workspaceRoot, path));
    const expectedBytes = new TextEncoder().encode(
      await readMeshSidecarFantasyRulesBranchFile(transitionCase.toRef!, path),
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
