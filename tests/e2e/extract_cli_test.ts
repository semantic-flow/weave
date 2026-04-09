import { assert, assertEquals, assertRejects, fail } from "@std/assert";
import { join } from "@std/path";
import { executeIntegrate } from "../../src/runtime/integrate/integrate.ts";
import { executeWeave } from "../../src/runtime/weave/weave.ts";
import { compareRdfContent } from "../../dependencies/github.com/spectacular-voyage/accord/src/checker/compare_rdf.ts";
import {
  getManifestFileExpectations,
  readSingleTransitionCase,
} from "../support/accord_manifest.ts";
import {
  materializeMeshAliceBioBranch,
  readMeshAliceBioBranchFile,
  resolveMeshAliceBioConformanceManifestPath,
} from "../support/mesh_alice_bio_fixture.ts";
import { ROOT_PERSON_SOURCE_TURTLE } from "../support/root_designator.ts";
import { createTestTmpDir } from "../support/test_tmp.ts";

const repoRoot = new URL("../../", import.meta.url);

Deno.test("weave extract matches the manifest-scoped bob extracted fixture as a black-box CLI run", async () => {
  const manifestPath = resolveMeshAliceBioConformanceManifestPath(
    "12-bob-extracted.jsonld",
  );
  const transitionCase = await readSingleTransitionCase(manifestPath);
  assertEquals(transitionCase.operationId, "extract");
  assertEquals(transitionCase.fromRef, "11-alice-bio-v2-woven");
  assertEquals(transitionCase.toRef, "12-bob-extracted");

  const workspaceRoot = await createTestTmpDir("weave-e2e-extract-");
  await materializeMeshAliceBioBranch(transitionCase.fromRef!, workspaceRoot);

  const command = new Deno.Command("deno", {
    args: [
      "run",
      "--allow-read",
      "--allow-write",
      "--allow-env",
      "src/main.ts",
      "extract",
      transitionCase.targetDesignatorPath!,
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
  assert(stdout.includes("Extracted"), stdout);

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
        path,
      );
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
      assertEquals(
        new TextDecoder().decode(actualBytes),
        new TextDecoder().decode(expectedBytes),
      );
      continue;
    }

    assertEquals(actualBytes, expectedBytes);
  }

  await assertPathExists(
    join(workspaceRoot, ".weave/logs/operational.jsonl"),
    `expected log file .weave/logs/operational.jsonl to exist under ${workspaceRoot}`,
  );
  await assertPathExists(
    join(workspaceRoot, ".weave/logs/security-audit.jsonl"),
    `expected log file .weave/logs/security-audit.jsonl to exist under ${workspaceRoot}`,
  );
});

Deno.test("weave extract accepts the root designator path as a black-box CLI run", async () => {
  const workspaceRoot = await createTestTmpDir("weave-e2e-extract-root-");
  await materializeMeshAliceBioBranch(
    "05-alice-knop-created-woven",
    workspaceRoot,
  );
  await Deno.writeTextFile(
    join(workspaceRoot, "alice-bio-root.ttl"),
    ROOT_PERSON_SOURCE_TURTLE,
  );
  await executeIntegrate({
    workspaceRoot,
    request: {
      designatorPath: "alice/bio",
      source: "alice-bio-root.ttl",
    },
  });
  await executeWeave({
    workspaceRoot,
    request: {
      targets: [{ designatorPath: "alice/bio" }],
    },
  });

  const command = new Deno.Command("deno", {
    args: [
      "run",
      "--allow-read",
      "--allow-write",
      "--allow-env",
      "src/main.ts",
      "extract",
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
  assert(stdout.includes("Extracted / into"), stdout);
  await Deno.stat(join(workspaceRoot, "_knop/_meta/meta.ttl"));
  await Deno.stat(join(workspaceRoot, "_knop/_inventory/inventory.ttl"));
  assertEquals(
    await Deno.readTextFile(
      join(workspaceRoot, "_knop/_references/references.ttl"),
    ),
    `@base <https://semantic-flow.github.io/mesh-alice-bio/> .
@prefix sflo: <https://semantic-flow.github.io/semantic-flow-ontology/> .

<> sflo:hasReferenceLink <_knop/_references#reference001> .

<_knop/_references#reference001> a sflo:ReferenceLink ;
  sflo:referenceLinkFor <> ;
  sflo:hasReferenceRole <https://semantic-flow.github.io/semantic-flow-ontology/ReferenceRole/Supplemental> ;
  sflo:referenceTarget <alice/bio> ;
  sflo:referenceTargetState <alice/bio/_history001/_s0001> .
`,
  );
});

Deno.test("weave extract rejects a whitespace-only positional designatorPath before logging or execution", async () => {
  const workspaceRoot = await createTestTmpDir("weave-e2e-extract-empty-");
  await materializeMeshAliceBioBranch("11-alice-bio-v2-woven", workspaceRoot);

  const command = new Deno.Command("deno", {
    args: [
      "run",
      "--allow-read",
      "--allow-write",
      "--allow-env",
      "src/main.ts",
      "extract",
      "   ",
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
    stderr.includes("extract requires a positional designatorPath"),
    stderr,
  );
  await assertRejects(
    () => Deno.stat(join(workspaceRoot, ".weave/logs/security-audit.jsonl")),
    Deno.errors.NotFound,
  );
  await assertRejects(
    () => Deno.stat(join(workspaceRoot, "bob/_knop/_meta/meta.ttl")),
    Deno.errors.NotFound,
  );
});

async function assertPathExists(
  path: string,
  errorMessage: string,
): Promise<void> {
  try {
    await Deno.stat(path);
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      fail(errorMessage);
    }
    throw error;
  }
}
