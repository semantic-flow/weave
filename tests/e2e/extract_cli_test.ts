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
import { materializeMeshSidecarFantasyRulesBranch } from "../support/mesh_sidecar_fantasy_rules_fixture.ts";
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

    const compareMode = fileExpectation.compareMode;

    if (compareMode === undefined) {
      await Deno.stat(join(workspaceRoot, path));
      continue;
    }
    if (path === "bob/_knop/_inventory/inventory.ttl") {
      assert(
        (await Deno.readTextFile(join(workspaceRoot, path))).includes(
          "sflo:hasExtractionSource <bob/_knop/_sources#extraction-source>",
        ),
      );
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
    meshRoot: workspaceRoot,
    request: {
      designatorPath: "alice/bio",
      source: "alice-bio-root.ttl",
    },
  });
  await executeWeave({
    meshRoot: workspaceRoot,
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
  assert(stdout.includes("Extracted / with source"), stdout);
  await Deno.stat(join(workspaceRoot, "_knop/_meta/meta.ttl"));
  await Deno.stat(join(workspaceRoot, "_knop/_inventory/inventory.ttl"));
  await Deno.stat(join(workspaceRoot, "_knop/_sources/sources.ttl"));
  assertEquals(
    await Deno.readTextFile(
      join(workspaceRoot, "_knop/_inventory/inventory.ttl"),
    ),
    `@base <https://semantic-flow.github.io/mesh-alice-bio/> .
@prefix sflo: <https://semantic-flow.github.io/sflo/ontology/> .

<_knop> a sflo:Knop ;
  sflo:hasKnopMetadata <_knop/_meta> ;
  sflo:hasKnopInventory <_knop/_inventory> ;
  sflo:hasKnopSourceRegistry <_knop/_sources> ;
  sflo:hasExtractionSource <_knop/_sources#extraction-source> ;
  sflo:hasWorkingKnopInventoryFile <_knop/_inventory/inventory.ttl> .

<_knop/_meta> a sflo:KnopMetadata, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasWorkingLocatedFile <_knop/_meta/meta.ttl> .

<_knop/_inventory> a sflo:KnopInventory, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasWorkingLocatedFile <_knop/_inventory/inventory.ttl> .

<_knop/_sources> a sflo:KnopSourceRegistry, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasWorkingLocatedFile <_knop/_sources/sources.ttl> .

<_knop/_meta/meta.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<_knop/_inventory/inventory.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<_knop/_sources/sources.ttl> a sflo:LocatedFile, sflo:RdfDocument .
`,
  );
  assertEquals(
    await Deno.readTextFile(join(workspaceRoot, "_knop/_sources/sources.ttl")),
    `@base <https://semantic-flow.github.io/mesh-alice-bio/> .
@prefix sflo: <https://semantic-flow.github.io/sflo/ontology/> .

<_knop/_sources> a sflo:KnopSourceRegistry, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasWorkingLocatedFile <_knop/_sources/sources.ttl> ;
  sflo:hasSourceBinding <_knop/_sources#extraction-source> .

<_knop/_sources#extraction-source> a sflo:ExtractionSource ;
  sflo:hasTargetArtifact <alice/bio> ;
  sflo:hasArtifactResolutionMode <https://semantic-flow.github.io/sflo/ontology/artifactResolutionMode_current> ;
  sflo:hasObservedSourceLocatedFile <alice-bio-root.ttl> ;
  sflo:observedSourceDigest "sha256:b1a7a70dd0f77e16544d0194b12e1bc9993d21470dfba3633bb8ae113834917d" .

<_knop/_sources/sources.ttl> a sflo:LocatedFile, sflo:RdfDocument .
`,
  );
});

Deno.test("weave extract supports docs-rooted sidecar meshes with an explicit source selector", async () => {
  const workspaceRoot = await createTestTmpDir("weave-e2e-extract-sidecar-");
  await materializeMeshSidecarFantasyRulesBranch(
    "a.07-shacl-integrated-woven",
    workspaceRoot,
  );

  const command = new Deno.Command("deno", {
    args: [
      "run",
      "--allow-read",
      "--allow-write",
      "--allow-env",
      "src/main.ts",
      "extract",
      "ontology/CharacterShape",
      "--mesh-root",
      join(workspaceRoot, "docs"),
      "--source",
      "shacl",
    ],
    cwd: new URL(".", repoRoot),
    stdout: "piped",
    stderr: "piped",
  });
  const output = await command.output();
  const stdout = new TextDecoder().decode(output.stdout);
  const stderr = new TextDecoder().decode(output.stderr);

  assert(output.success, stderr);
  assert(stdout.includes("Extracted ontology/CharacterShape"), stdout);
  assert(stdout.includes("docs/ontology/CharacterShape/_knop/_meta/meta.ttl"));
  assert(
    stdout.includes("docs/ontology/CharacterShape/_knop/_sources/sources.ttl"),
  );
  assertEquals(
    await Deno.readTextFile(
      join(
        workspaceRoot,
        "docs/ontology/CharacterShape/_knop/_inventory/inventory.ttl",
      ),
    ),
    `@base <https://semantic-flow.github.io/mesh-sidecar-fantasy-rules/> .
@prefix sflo: <https://semantic-flow.github.io/sflo/ontology/> .

<ontology/CharacterShape/_knop> a sflo:Knop ;
  sflo:hasKnopMetadata <ontology/CharacterShape/_knop/_meta> ;
  sflo:hasKnopInventory <ontology/CharacterShape/_knop/_inventory> ;
  sflo:hasKnopSourceRegistry <ontology/CharacterShape/_knop/_sources> ;
  sflo:hasExtractionSource <ontology/CharacterShape/_knop/_sources#extraction-source> ;
  sflo:hasWorkingKnopInventoryFile <ontology/CharacterShape/_knop/_inventory/inventory.ttl> .

<ontology/CharacterShape/_knop/_meta> a sflo:KnopMetadata, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasWorkingLocatedFile <ontology/CharacterShape/_knop/_meta/meta.ttl> .

<ontology/CharacterShape/_knop/_inventory> a sflo:KnopInventory, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasWorkingLocatedFile <ontology/CharacterShape/_knop/_inventory/inventory.ttl> .

<ontology/CharacterShape/_knop/_sources> a sflo:KnopSourceRegistry, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasWorkingLocatedFile <ontology/CharacterShape/_knop/_sources/sources.ttl> .

<ontology/CharacterShape/_knop/_meta/meta.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<ontology/CharacterShape/_knop/_inventory/inventory.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<ontology/CharacterShape/_knop/_sources/sources.ttl> a sflo:LocatedFile, sflo:RdfDocument .
`,
  );
  assertEquals(
    await Deno.readTextFile(
      join(
        workspaceRoot,
        "docs/ontology/CharacterShape/_knop/_sources/sources.ttl",
      ),
    ),
    `@base <https://semantic-flow.github.io/mesh-sidecar-fantasy-rules/> .
@prefix sflo: <https://semantic-flow.github.io/sflo/ontology/> .

<ontology/CharacterShape/_knop/_sources> a sflo:KnopSourceRegistry, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasWorkingLocatedFile <ontology/CharacterShape/_knop/_sources/sources.ttl> ;
  sflo:hasSourceBinding <ontology/CharacterShape/_knop/_sources#extraction-source> .

<ontology/CharacterShape/_knop/_sources#extraction-source> a sflo:ExtractionSource ;
  sflo:hasTargetArtifact <shacl> ;
  sflo:hasArtifactResolutionMode <https://semantic-flow.github.io/sflo/ontology/artifactResolutionMode_current> ;
  sflo:observedSourceLocalRelativePath "../shacl/fantasy-rules-shacl.ttl" ;
  sflo:observedSourceDigest "sha256:349f1ad30fb4b2f20cc9c9e5f6febae09c6adb2148bc6b62c81905c9da9cc011" .

<ontology/CharacterShape/_knop/_sources/sources.ttl> a sflo:LocatedFile, sflo:RdfDocument .
`,
  );
});

Deno.test("weave extract --all-terms previews and creates new terms with --accept-preview", async () => {
  const workspaceRoot = await createTestTmpDir("weave-e2e-extract-all-terms-");
  await materializeMeshAliceBioBranch("11-alice-bio-v2-woven", workspaceRoot);
  await Deno.writeTextFile(
    join(workspaceRoot, "alice-bio.ttl"),
    `@base <https://semantic-flow.github.io/mesh-alice-bio/> .
@prefix schema: <https://schema.org/> .

<alice/bio> schema:about <bob>, <carol>, <bob/_knop> .
<carol> schema:name "Carol" .
`,
  );

  const command = new Deno.Command("deno", {
    args: [
      "run",
      "--allow-read",
      "--allow-write",
      "--allow-env",
      "src/main.ts",
      "extract",
      "--all-terms",
      "--accept-preview",
      "--source",
      "alice/bio",
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
  assert(
    stdout.includes("All-terms extract will create 2 identifiers"),
    stdout,
  );
  assert(stdout.includes("- bob"), stdout);
  assert(stdout.includes("- carol"), stdout);
  assert(stdout.includes("Extracted 2 new terms from alice/bio"), stdout);
  await Deno.stat(join(workspaceRoot, "bob/_knop/_meta/meta.ttl"));
  await Deno.stat(join(workspaceRoot, "carol/_knop/_meta/meta.ttl"));
});

Deno.test("weave extract --all-terms requires an explicit source selector", async () => {
  const workspaceRoot = await createTestTmpDir(
    "weave-e2e-extract-all-terms-source-",
  );
  await materializeMeshAliceBioBranch("11-alice-bio-v2-woven", workspaceRoot);

  const command = new Deno.Command("deno", {
    args: [
      "run",
      "--allow-read",
      "--allow-write",
      "--allow-env",
      "src/main.ts",
      "extract",
      "--all-terms",
      "--mesh-root",
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
    stderr.includes("extract --all-terms requires --source or --source-state"),
    stderr,
  );
});

Deno.test("weave extract --all-terms rejects a positional designator path", async () => {
  const workspaceRoot = await createTestTmpDir(
    "weave-e2e-extract-all-terms-positional-",
  );
  await materializeMeshAliceBioBranch("11-alice-bio-v2-woven", workspaceRoot);

  const command = new Deno.Command("deno", {
    args: [
      "run",
      "--allow-read",
      "--allow-write",
      "--allow-env",
      "src/main.ts",
      "extract",
      "bob",
      "--all-terms",
      "--accept-preview",
      "--source",
      "alice/bio",
      "--mesh-root",
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
      "extract --all-terms does not accept a positional designatorPath",
    ),
    stderr,
  );
});

Deno.test("weave extract --all-terms rejects removed --yes alias", async () => {
  const workspaceRoot = await createTestTmpDir(
    "weave-e2e-extract-all-terms-yes-",
  );
  await materializeMeshAliceBioBranch("11-alice-bio-v2-woven", workspaceRoot);

  const command = new Deno.Command("deno", {
    args: [
      "run",
      "--allow-read",
      "--allow-write",
      "--allow-env",
      "src/main.ts",
      "extract",
      "--all-terms",
      "--yes",
      "--source",
      "alice/bio",
      "--mesh-root",
      workspaceRoot,
    ],
    cwd: new URL(".", repoRoot),
    stdout: "piped",
    stderr: "piped",
  });
  const output = await command.output();
  const stderr = new TextDecoder().decode(output.stderr);

  assertEquals(output.success, false);
  assert(stderr.includes('Unknown option "--yes"'), stderr);
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
      "--mesh-root",
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
