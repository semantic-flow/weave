import { assert, assertEquals, assertRejects } from "@std/assert";
import { fromFileUrl, join, relative, toFileUrl } from "@std/path";
import { compareRdfContent } from "../../dependencies/github.com/spectacular-voyage/accord/src/checker/compare_rdf.ts";
import {
  getManifestFileExpectations,
  readSingleTransitionCase,
} from "../support/accord_manifest.ts";
import {
  listMeshAliceBioBranchFiles,
  materializeMeshAliceBioBranch,
  MESH_ALICE_BIO_HISTORY_TRACKING_POLICY,
  readMeshAliceBioBranchFile,
  resolveMeshAliceBioConformanceManifestPath,
} from "../support/mesh_alice_bio_fixture.ts";
import {
  listMeshSidecarFantasyRulesBranchFiles,
  materializeMeshSidecarFantasyRulesBranch,
  readMeshSidecarFantasyRulesBranchFile,
  resolveMeshSidecarFantasyRulesConformanceManifestPath,
} from "../support/mesh_sidecar_fantasy_rules_fixture.ts";
import {
  bootstrapRootWovenWorkspace,
  integrateRootPayload,
} from "../support/root_designator.ts";
import { createTestTmpDir } from "../support/test_tmp.ts";
import { WEAVE_VERSION } from "../../src/version.ts";

const repoRoot = new URL("../../", import.meta.url);
const cliEntrypoint = fromFileUrl(
  new URL("../../src/main.ts", import.meta.url),
);

type PathReplacement = readonly [from: string, to: string];

const firstAliceBioDefaultManifestation: readonly PathReplacement[] = [[
  "alice/bio/_history001/_s0001/alice-bio-ttl",
  "alice/bio/_history001/_s0001/ttl",
]];

const secondAliceBioDefaultManifestation: readonly PathReplacement[] = [[
  "alice/bio/_history001/_s0002/alice-bio-ttl",
  "alice/bio/_history001/_s0002/ttl",
]];

const aliceReferenceDefaultManifestation: readonly PathReplacement[] = [[
  "alice/_knop/_references/_history001/_s0001/ttl",
  "alice/_knop/_references/_history001/_s0001/ttl",
]];

const gunaarDefaultManifestation: readonly PathReplacement[] = [[
  "docs/examples/gunaar/_history001/_s0001/gunaar-ttl",
  "docs/examples/gunaar/_history001/_s0001/ttl",
], [
  "examples/gunaar/_history001/_s0001/gunaar-ttl",
  "examples/gunaar/_history001/_s0001/ttl",
]];

function replaceFixturePaths(
  contents: string,
  replacements: readonly PathReplacement[],
): string {
  return replacements.reduce(
    (updated, [from, to]) => updated.replaceAll(from, to),
    contents,
  );
}

function replaceFixturePathList(
  paths: readonly string[],
  replacements: readonly PathReplacement[],
): string[] {
  return paths.map((path) => replaceFixturePaths(path, replacements)).sort();
}

Deno.test("weave --version reports the root package version", async () => {
  const output = await runCliCommand(["--version"]);
  const stdout = new TextDecoder().decode(output.stdout);
  const stderr = new TextDecoder().decode(output.stderr);

  assert(output.success, stderr);
  assertEquals(stdout.trim(), `weave ${WEAVE_VERSION}`);
});

Deno.test("weave matches the manifest-scoped alice knop-created-woven fixture as a black-box CLI run", async () => {
  await assertWeaveTransitionMatchesManifest({
    manifestName: "05-alice-knop-created-woven.jsonld",
    expectedStdoutFragment: "Wove 1 designator path",
  });
});

Deno.test("weave reports progress by default and --silent suppresses progress", async () => {
  const verboseWorkspaceRoot = await createTestTmpDir(
    "weave-e2e-progress-",
  );
  await materializeMeshAliceBioBranch(
    "06-alice-bio-integrated",
    verboseWorkspaceRoot,
  );

  const verboseOutput = await runCliCommand([
    "--target",
    "designatorPath=alice/bio",
  ], verboseWorkspaceRoot);
  const verboseStdout = new TextDecoder().decode(verboseOutput.stdout);
  const verboseStderr = new TextDecoder().decode(verboseOutput.stderr);

  assert(verboseOutput.success, verboseStderr);
  assert(
    verboseStdout.includes("[100%] Wove 1/1: alice/bio"),
    verboseStdout,
  );
  assertEquals(
    [...verboseStdout.matchAll(/\[100%\] Wove 1\/1: alice\/bio/g)].length,
    1,
  );
  assert(verboseStdout.includes("Wove 1 designator path"), verboseStdout);

  const silentWorkspaceRoot = await createTestTmpDir(
    "weave-e2e-progress-silent-",
  );
  await materializeMeshAliceBioBranch(
    "06-alice-bio-integrated",
    silentWorkspaceRoot,
  );

  const silentOutput = await runCliCommand([
    "--silent",
    "--target",
    "designatorPath=alice/bio",
  ], silentWorkspaceRoot);
  const silentStdout = new TextDecoder().decode(silentOutput.stdout);
  const silentStderr = new TextDecoder().decode(silentOutput.stderr);

  assert(silentOutput.success, silentStderr);
  assert(
    !silentStdout.includes("[100%] Wove 1/1: alice/bio"),
    silentStdout,
  );
  assert(silentStdout.includes("Wove 1 designator path"), silentStdout);
});

Deno.test("weave validate succeeds as a black-box CLI run", async () => {
  const workspaceRoot = await createTestTmpDir("weave-e2e-validate-");
  await materializeMeshAliceBioBranch("06-alice-bio-integrated", workspaceRoot);

  const output = await runCliCommand([
    "validate",
    "--target",
    "designatorPath=alice/bio",
  ], workspaceRoot);
  const stdout = new TextDecoder().decode(output.stdout);
  const stderr = new TextDecoder().decode(output.stderr);

  assert(output.success, stderr);
  assert(stdout.includes("Validated 1 designator path"), stdout);
});

Deno.test("weave validate mesh succeeds as a black-box CLI run", async () => {
  const workspaceRoot = await createTestTmpDir("weave-e2e-validate-mesh-");
  await materializeMeshAliceBioBranch("06-alice-bio-integrated", workspaceRoot);

  const output = await runCliCommand([
    "validate",
    "mesh",
    "--target",
    "designatorPath=alice/bio",
  ], workspaceRoot);
  const stdout = new TextDecoder().decode(output.stdout);
  const stderr = new TextDecoder().decode(output.stderr);

  assert(output.success, stderr);
  assert(stdout.includes("Validated 1 designator path"), stdout);
});

Deno.test("weave validate publication checks the selected host preset", async () => {
  const workspaceRoot = await createTestTmpDir(
    "weave-e2e-validate-publication-",
  );

  const createOutput = await runCliCommand([
    "mesh",
    "create",
    "--workspace",
    workspaceRoot,
    "--mesh-base",
    "https://semantic-flow.github.io/mesh-alice-bio/",
    "--publication-profile",
    "github-pages",
  ]);
  const createStderr = new TextDecoder().decode(createOutput.stderr);
  assert(createOutput.success, createStderr);

  const successOutput = await runCliCommand([
    "validate",
    "publication",
    "--mesh-root",
    workspaceRoot,
  ]);
  const successStdout = new TextDecoder().decode(successOutput.stdout);
  const successStderr = new TextDecoder().decode(successOutput.stderr);

  assert(successOutput.success, successStderr);
  assert(
    successStdout.includes("Validated publication surface and found 0 issues"),
    successStdout,
  );

  await Deno.remove(join(workspaceRoot, ".nojekyll"));
  const failureOutput = await runCliCommand([
    "validate",
    "publication",
    "--mesh-root",
    workspaceRoot,
  ]);
  const failureStdout = new TextDecoder().decode(failureOutput.stdout);
  const failureStderr = new TextDecoder().decode(failureOutput.stderr);

  assert(!failureOutput.success, failureStdout);
  assert(
    failureStderr.includes(
      "GitHub Pages publication profile requires .nojekyll at the mesh root.",
    ),
    failureStderr,
  );
});

Deno.test("weave supports validation before and after as a black-box CLI run", async () => {
  const workspaceRoot = await createTestTmpDir("weave-e2e-validate-around-");
  await materializeMeshAliceBioBranch("06-alice-bio-integrated", workspaceRoot);

  const output = await runCliCommand([
    "--validate-before",
    "--validate-after",
    "--silent",
    "--target",
    "designatorPath=alice/bio",
  ], workspaceRoot);
  const stdout = new TextDecoder().decode(output.stdout);
  const stderr = new TextDecoder().decode(output.stderr);

  assert(output.success, stderr);
  assert(stdout.includes("Wove 1 designator path"), stdout);
});

Deno.test("weave validate accepts the exact root target as a black-box CLI run", async () => {
  const workspaceRoot = await createTestTmpDir("weave-e2e-validate-root-");
  await materializeMeshAliceBioBranch(
    "05-alice-knop-created-woven",
    workspaceRoot,
  );
  await integrateRootPayload(workspaceRoot);

  const output = await runCliCommand([
    "validate",
    "--target",
    "designatorPath=/",
  ], workspaceRoot);
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
    "--payload-manifestation-segment",
    "ttl",
  ], workspaceRoot);
  const stdout = new TextDecoder().decode(output.stdout);
  const stderr = new TextDecoder().decode(output.stderr);

  assert(output.success, stderr);
  assert(stdout.includes("Versioned 1 designator path"), stdout);
  await Deno.stat(
    join(
      workspaceRoot,
      "alice/bio/releases/v0.0.1/ttl/alice-bio.ttl",
    ),
  );
  await assertRejects(
    () => Deno.stat(join(workspaceRoot, "alice/bio/releases/index.html")),
    Deno.errors.NotFound,
  );
});

Deno.test("weave accepts per-target payload version fields as a black-box CLI run", async () => {
  const workspaceRoot = await createTestTmpDir("weave-e2e-target-version-");
  await materializeMeshAliceBioBranch("06-alice-bio-integrated", workspaceRoot);

  const output = await runCliCommand([
    "version",
    "--target",
    "designatorPath=alice/bio,historySegment=releases,stateSegment=v0.0.1,manifestationSegment=ttl",
  ], workspaceRoot);
  const stdout = new TextDecoder().decode(output.stdout);
  const stderr = new TextDecoder().decode(output.stderr);

  assert(output.success, stderr);
  assert(stdout.includes("Versioned 1 designator path"), stdout);
  await Deno.stat(
    join(
      workspaceRoot,
      "alice/bio/releases/v0.0.1/ttl/alice-bio.ttl",
    ),
  );
});

Deno.test("weave applies general payload version fields to included targets", async () => {
  const workspaceRoot = await createTestTmpDir("weave-e2e-general-version-");
  await materializeMeshAliceBioBranch("06-alice-bio-integrated", workspaceRoot);

  const output = await runCliCommand([
    "version",
    "--payload-history-segment",
    "releases",
    "--payload-state-segment",
    "v0.0.1",
    "--payload-manifestation-segment",
    "ttl",
  ], workspaceRoot);
  const stdout = new TextDecoder().decode(output.stdout);
  const stderr = new TextDecoder().decode(output.stderr);

  assert(output.success, stderr);
  assert(stdout.includes("Versioned 1 designator path"), stdout);
  await Deno.stat(
    join(
      workspaceRoot,
      "alice/bio/releases/v0.0.1/ttl/alice-bio.ttl",
    ),
  );
});

Deno.test("weave version accepts the exact root target as a black-box CLI run", async () => {
  const workspaceRoot = await createTestTmpDir("weave-e2e-version-root-");
  await materializeMeshAliceBioBranch(
    "05-alice-knop-created-woven",
    workspaceRoot,
  );
  await integrateRootPayload(workspaceRoot);

  const output = await runCliCommand([
    "version",
    "--target",
    "designatorPath=/",
    "--payload-history-segment",
    "releases",
    "--payload-state-segment",
    "v0.0.1",
    "--payload-manifestation-segment",
    "ttl",
  ], workspaceRoot);
  const stdout = new TextDecoder().decode(output.stdout);
  const stderr = new TextDecoder().decode(output.stderr);

  assert(output.success, stderr);
  assert(stdout.includes("Versioned 1 designator path"), stdout);
  await Deno.stat(join(workspaceRoot, "releases/v0.0.1/ttl/root.ttl"));
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
  ], workspaceRoot);
  const stdout = new TextDecoder().decode(output.stdout);
  const stderr = new TextDecoder().decode(output.stderr);

  assert(output.success, stderr);
  assert(stdout.includes("Generated 1 designator path"), stdout);
  const page = await Deno.readTextFile(
    join(workspaceRoot, "alice/bio/index.html"),
  );
  assert(!page.includes("Semantic Flow metadata"), page);
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

Deno.test("weave generate can include Semantic Flow metadata", async () => {
  const workspaceRoot = await createTestTmpDir(
    "weave-e2e-generate-semantic-flow-metadata-",
  );
  await materializeMeshAliceBioBranch("10-alice-bio-updated", workspaceRoot);

  const output = await runCliCommand([
    "generate",
    "--include-semantic-flow-metadata",
    "--target",
    "designatorPath=alice/bio",
  ], workspaceRoot);
  const stdout = new TextDecoder().decode(output.stdout);
  const stderr = new TextDecoder().decode(output.stderr);

  assert(output.success, stderr);
  assert(stdout.includes("Generated 1 designator path"), stdout);
  const page = await Deno.readTextFile(
    join(workspaceRoot, "alice/bio/index.html"),
  );
  assert(page.includes("<summary>Semantic Flow metadata</summary>"), page);
  assert(
    page.includes(
      '<tr><th scope="row">Knop</th><td><a href="/mesh-alice-bio/alice/bio/_knop">alice/bio/_knop</a></td></tr>',
    ),
    page,
  );
});

Deno.test("weave generate accepts the exact root target as a black-box CLI run", async () => {
  const workspaceRoot = await createTestTmpDir("weave-e2e-generate-root-");
  await materializeMeshAliceBioBranch(
    "05-alice-knop-created-woven",
    workspaceRoot,
  );
  await bootstrapRootWovenWorkspace(workspaceRoot);

  const output = await runCliCommand([
    "generate",
    "--target",
    "designatorPath=/",
  ], workspaceRoot);
  const stdout = new TextDecoder().decode(output.stdout);
  const stderr = new TextDecoder().decode(output.stderr);

  assert(output.success, stderr);
  assert(stdout.includes("Generated 1 designator path"), stdout);
  await Deno.stat(join(workspaceRoot, "index.html"));
  await Deno.stat(join(workspaceRoot, "_knop/index.html"));
});

Deno.test("weave matches the manifest-scoped alice bio integrated-woven fixture as a black-box CLI run", async () => {
  await assertWeaveTransitionMatchesManifest({
    manifestName: "07-alice-bio-integrated-woven.jsonld",
    expectedStdoutFragment: "Wove 1 designator path",
    fixturePathReplacements: firstAliceBioDefaultManifestation,
  });
});

Deno.test("weave accepts an exact --target spec as a black-box CLI run", async () => {
  await assertWeaveTransitionMatchesManifest({
    manifestName: "07-alice-bio-integrated-woven.jsonld",
    expectedStdoutFragment: "Wove 1 designator path",
    cliArgs: ["--target", "designatorPath=alice/bio"],
    fixturePathReplacements: firstAliceBioDefaultManifestation,
  });
});

Deno.test("weave accepts an exact root --target spec as a black-box CLI run", async () => {
  const workspaceRoot = await createTestTmpDir("weave-e2e-weave-root-");
  await materializeMeshAliceBioBranch(
    "05-alice-knop-created-woven",
    workspaceRoot,
  );
  await integrateRootPayload(workspaceRoot);

  const output = await runCliCommand([
    "--target",
    "designatorPath=/",
  ], workspaceRoot);
  const stdout = new TextDecoder().decode(output.stdout);
  const stderr = new TextDecoder().decode(output.stderr);

  assert(output.success, stderr);
  assert(stdout.includes("Wove 1 designator path"), stdout);
  await Deno.stat(join(workspaceRoot, "index.html"));
  await Deno.stat(join(workspaceRoot, "_history001/_s0001/ttl/root.ttl"));
});

Deno.test("weave accepts a recursive --target spec as a black-box CLI run", async () => {
  await assertWeaveTransitionMatchesManifest({
    manifestName: "07-alice-bio-integrated-woven.jsonld",
    expectedStdoutFragment: "Wove 1 designator path",
    cliArgs: ["--target", "designatorPath=alice,recursive=true"],
    fixturePathReplacements: firstAliceBioDefaultManifestation,
  });
});

Deno.test("weave infers workspace root from docs-rooted mesh config as a black-box CLI run", async () => {
  const workspaceRoot = await createTestTmpDir("weave-e2e-sidecar-root-");
  const meshRoot = join(workspaceRoot, "docs");
  await materializeMeshAliceBioBranch("06-alice-bio-integrated", meshRoot);
  await writeSidecarMeshConfig(meshRoot);

  const output = await runCliCommand([
    "--mesh-root",
    "docs",
    "--target",
    "designatorPath=alice/bio",
  ], workspaceRoot);
  const stdout = new TextDecoder().decode(output.stdout);
  const stderr = new TextDecoder().decode(output.stderr);

  assert(output.success, stderr);
  assert(stdout.includes("Wove 1 designator path"), stdout);
  assert(stdout.includes("docs/alice/bio/index.html"), stdout);
  await Deno.stat(join(meshRoot, "alice/bio/index.html"));
  await Deno.stat(join(workspaceRoot, ".weave/logs/operational.jsonl"));
  await Deno.stat(join(workspaceRoot, ".weave/logs/security-audit.jsonl"));
});

Deno.test("weave materializes support ResourcePages for a docs-rooted sidecar mesh as a black-box CLI run", async () => {
  const workspaceRoot = await createTestTmpDir("weave-e2e-sidecar-support-");
  const createOutput = await runCliCommand([
    "mesh",
    "create",
    "--mesh-root",
    "docs",
    "--mesh-base",
    "https://semantic-flow.github.io/mesh-sidecar-fantasy-rules/",
  ], workspaceRoot);
  assert(createOutput.success, new TextDecoder().decode(createOutput.stderr));

  const output = await runCliCommand(["--mesh-root", "docs"], workspaceRoot);
  const stdout = new TextDecoder().decode(output.stdout);
  const stderr = new TextDecoder().decode(output.stderr);

  assert(output.success, stderr);
  assert(stdout.includes("Wove 0 designator path"), stdout);
  assert(stdout.includes("docs/_mesh/index.html"), stdout);
  assert(stdout.includes("docs/_mesh/_config/index.html"), stdout);
  await Deno.stat(join(workspaceRoot, "docs/_mesh/index.html"));
  await Deno.stat(join(workspaceRoot, "docs/_mesh/_config/index.html"));
  await Deno.stat(join(workspaceRoot, ".weave/logs/operational.jsonl"));
});

Deno.test("weave accepts payload version naming flags as a black-box CLI run", async () => {
  const workspaceRoot = await createTestTmpDir("weave-e2e-payload-naming-");
  await materializeMeshAliceBioBranch("06-alice-bio-integrated", workspaceRoot);

  const output = await runCliCommand([
    "--target",
    "designatorPath=alice/bio",
    "--payload-history-segment",
    "releases",
    "--payload-state-segment",
    "v0.0.1",
    "--payload-manifestation-segment",
    "ttl",
  ], workspaceRoot);
  const stdout = new TextDecoder().decode(output.stdout);
  const stderr = new TextDecoder().decode(output.stderr);

  assert(output.success, stderr);
  assert(stdout.includes("Wove 1 designator path"), stdout);
  await Deno.stat(
    join(
      workspaceRoot,
      "alice/bio/releases/v0.0.1/ttl/alice-bio.ttl",
    ),
  );
  await Deno.stat(join(workspaceRoot, "alice/bio/releases/index.html"));
  await Deno.stat(join(workspaceRoot, "alice/bio/releases/v0.0.1/index.html"));
});

Deno.test("weave applies payload version naming flags without explicit targets", async () => {
  const workspaceRoot = await createTestTmpDir(
    "weave-e2e-payload-naming-all-targets-",
  );
  await materializeMeshAliceBioBranch("06-alice-bio-integrated", workspaceRoot);

  const output = await runCliCommand([
    "--payload-history-segment",
    "releases",
    "--payload-state-segment",
    "v0.0.1",
    "--payload-manifestation-segment",
    "ttl",
  ], workspaceRoot);
  const stdout = new TextDecoder().decode(output.stdout);
  const stderr = new TextDecoder().decode(output.stderr);

  assert(output.success, stderr);
  assert(stdout.includes("Wove 1 designator path"), stdout);
  await Deno.stat(
    join(
      workspaceRoot,
      "alice/bio/releases/v0.0.1/ttl/alice-bio.ttl",
    ),
  );
});

Deno.test("weave applies payload version naming flags across multiple targets", async () => {
  const workspaceRoot = await createTestTmpDir(
    "weave-e2e-payload-naming-many-targets-",
  );
  await materializeMeshAliceBioBranch("06-alice-bio-integrated", workspaceRoot);

  const output = await runCliCommand([
    "--target",
    "designatorPath=alice,recursive=true",
    "--target",
    "designatorPath=alice/bio",
    "--payload-history-segment",
    "releases",
    "--payload-state-segment",
    "v0.0.1",
    "--payload-manifestation-segment",
    "ttl",
  ], workspaceRoot);
  const stdout = new TextDecoder().decode(output.stdout);
  const stderr = new TextDecoder().decode(output.stderr);

  assert(output.success, stderr);
  assert(stdout.includes("Wove 1 designator path"), stdout);
  await Deno.stat(
    join(
      workspaceRoot,
      "alice/bio/releases/v0.0.1/ttl/alice-bio.ttl",
    ),
  );
});

Deno.test("weave matches the manifest-scoped alice bio referenced-woven fixture as a black-box CLI run", async () => {
  await assertWeaveTransitionMatchesManifest({
    manifestName: "09-alice-bio-referenced-woven.jsonld",
    expectedStdoutFragment: "Wove 1 designator path",
    fixturePathReplacements: aliceReferenceDefaultManifestation,
  });
});

Deno.test("weave matches the manifest-scoped alice bio v2 woven fixture as a black-box CLI run", async () => {
  await assertWeaveTransitionMatchesManifest({
    manifestName: "11-alice-bio-v2-woven.jsonld",
    expectedStdoutFragment: "Wove 1 designator path",
    fixturePathReplacements: secondAliceBioDefaultManifestation,
  });
});

Deno.test("weave matches the manifest-scoped bob extracted woven fixture as a black-box CLI run", async () => {
  await assertWeaveTransitionMatchesManifest({
    manifestName: "13-bob-extracted-woven.jsonld",
    expectedStdoutFragment: "Wove 1 designator path",
    compareWorkspaceTree: false,
  });
});

Deno.test("weave matches the manifest-scoped sidecar root Knop woven fixture", async () => {
  const manifestPath = resolveMeshSidecarFantasyRulesConformanceManifestPath(
    "11-root-knop-woven.jsonld",
  );
  const transitionCase = await readSingleTransitionCase(manifestPath);
  assertEquals(transitionCase.operationId, "weave");
  assertEquals(transitionCase.fromRef, "10-root-knop");
  assertEquals(transitionCase.toRef, "11-root-knop-woven");

  const targetDesignatorPaths = transitionCase.targetDesignatorPaths;
  assert(Array.isArray(targetDesignatorPaths));
  assertEquals(targetDesignatorPaths, ["/", "examples"]);

  const workspaceRoot = await createTestTmpDir(
    "weave-e2e-sidecar-root-knop-woven-",
  );
  await materializeMeshSidecarFantasyRulesBranch(
    transitionCase.fromRef!,
    workspaceRoot,
  );

  const output = await runCliCommand([
    "--mesh-root",
    "docs",
    ...targetDesignatorPaths.flatMap((designatorPath) => [
      "--target",
      `designatorPath=${designatorPath}`,
    ]),
  ], workspaceRoot);
  const stdout = new TextDecoder().decode(output.stdout);
  const stderr = new TextDecoder().decode(output.stderr);

  assert(output.success, stderr);
  assert(stdout.includes("Wove 2 designator path"), stdout);
  assertEquals(
    await listRelativeFiles(workspaceRoot, ".weave/"),
    replaceFixturePathList(
      await listMeshSidecarFantasyRulesBranchFiles(transitionCase.toRef!),
      gunaarDefaultManifestation,
    ),
  );

  const fileExpectations = getManifestFileExpectations(transitionCase);
  for (const fileExpectation of fileExpectations) {
    const fixturePath = fileExpectation.path;
    if (!fixturePath) {
      continue;
    }
    const path = replaceFixturePaths(fixturePath, gunaarDefaultManifestation);

    const compareMode = fileExpectation.compareMode;

    if (compareMode === undefined) {
      await Deno.stat(join(workspaceRoot, path));
      continue;
    }

    const actualBytes = await Deno.readFile(join(workspaceRoot, path));
    const expectedBytes = new TextEncoder().encode(
      replaceFixturePaths(
        await readMeshSidecarFantasyRulesBranchFile(
          transitionCase.toRef!,
          fixturePath,
        ),
        gunaarDefaultManifestation,
      ),
    );

    if (compareMode === "rdfCanonical") {
      assertEquals(
        await compareRdfContent({
          left: actualBytes,
          right: expectedBytes,
          path,
        }),
        true,
        path,
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

Deno.test("weave matches the manifest-scoped sidecar Gunaar dataset woven fixture", async () => {
  const manifestPath = resolveMeshSidecarFantasyRulesConformanceManifestPath(
    "13-gunaar-example-dataset-woven.jsonld",
  );
  const transitionCase = await readSingleTransitionCase(manifestPath);
  assertEquals(transitionCase.operationId, "weave");
  assertEquals(transitionCase.fromRef, "12-gunaar-example-dataset");
  assertEquals(transitionCase.toRef, "13-gunaar-example-dataset-woven");
  assertEquals(transitionCase.targetDesignatorPath, "examples/gunaar");

  const workspaceRoot = await createTestTmpDir(
    "weave-e2e-sidecar-gunaar-woven-",
  );
  await materializeMeshSidecarFantasyRulesBranch(
    transitionCase.fromRef!,
    workspaceRoot,
  );

  const output = await runCliCommand([
    "--mesh-root",
    "docs",
    "--target",
    `designatorPath=${transitionCase.targetDesignatorPath}`,
  ], workspaceRoot);
  const stdout = new TextDecoder().decode(output.stdout);
  const stderr = new TextDecoder().decode(output.stderr);

  assert(output.success, stderr);
  assert(stdout.includes("Wove 1 designator path"), stdout);
  assertEquals(
    await listRelativeFiles(workspaceRoot, ".weave/"),
    replaceFixturePathList(
      await listMeshSidecarFantasyRulesBranchFiles(transitionCase.toRef!),
      gunaarDefaultManifestation,
    ),
  );

  const fileExpectations = getManifestFileExpectations(transitionCase);
  for (const fileExpectation of fileExpectations) {
    const fixturePath = fileExpectation.path;
    if (!fixturePath) {
      continue;
    }
    const path = replaceFixturePaths(fixturePath, gunaarDefaultManifestation);

    const compareMode = fileExpectation.compareMode;

    if (compareMode === undefined) {
      await Deno.stat(join(workspaceRoot, path));
      continue;
    }

    const actualBytes = await Deno.readFile(join(workspaceRoot, path));
    const expectedBytes = new TextEncoder().encode(
      replaceFixturePaths(
        await readMeshSidecarFantasyRulesBranchFile(
          transitionCase.toRef!,
          fixturePath,
        ),
        gunaarDefaultManifestation,
      ),
    );

    if (compareMode === "rdfCanonical") {
      assertEquals(
        await compareRdfContent({
          left: actualBytes,
          right: expectedBytes,
          path,
        }),
        true,
        path,
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

Deno.test("weave validate rejects version-only --target fields", async () => {
  const workspaceRoot = await createTestTmpDir("weave-e2e-target-parse-");
  await materializeMeshAliceBioBranch("06-alice-bio-integrated", workspaceRoot);

  const command = new Deno.Command("deno", {
    args: [
      "run",
      "--allow-read",
      "--allow-write",
      "--allow-env",
      cliEntrypoint,
      "validate",
      "--target",
      "designatorPath=alice/bio,stateSegment=v0.0.1",
    ],
    cwd: toFileUrl(`${workspaceRoot}/`),
    stdout: "piped",
    stderr: "piped",
  });
  const output = await command.output();
  const stderr = new TextDecoder().decode(output.stderr);

  assertEquals(output.success, false);
  assert(
    stderr.includes("validate --target[0].stateSegment is not supported"),
    stderr,
  );
});

Deno.test("weave reports a per-field error when a target field value is missing", async () => {
  const workspaceRoot = await createTestTmpDir("weave-e2e-target-missing-");
  await materializeMeshAliceBioBranch("06-alice-bio-integrated", workspaceRoot);

  const output = await runCliCommand([
    "--target",
    "designatorPath=alice/bio,recursive=",
  ], workspaceRoot);
  const stderr = new TextDecoder().decode(output.stderr);

  assertEquals(output.success, false);
  assert(
    stderr.includes("weave --target[0].recursive is required"),
    stderr,
  );
});

async function assertWeaveTransitionMatchesManifest(
  options: {
    manifestName: string;
    expectedStdoutFragment: string;
    compareWorkspaceTree?: boolean;
    cliArgs?: readonly string[];
    fixturePathReplacements?: readonly PathReplacement[];
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
    "--history-tracking-policy",
    MESH_ALICE_BIO_HISTORY_TRACKING_POLICY,
    ...(options.cliArgs ?? []),
  ], workspaceRoot);
  const stdout = new TextDecoder().decode(output.stdout);
  const stderr = new TextDecoder().decode(output.stderr);

  assert(output.success, stderr);
  assert(stdout.includes(options.expectedStdoutFragment), stdout);
  const fixturePathReplacements = options.fixturePathReplacements ?? [];

  if (options.compareWorkspaceTree !== false) {
    assertEquals(
      await listRelativeFiles(workspaceRoot, ".weave/"),
      replaceFixturePathList(
        await listMeshAliceBioBranchFiles(transitionCase.toRef!),
        fixturePathReplacements,
      ),
    );
  }

  const fileExpectations = getManifestFileExpectations(transitionCase);
  for (const fileExpectation of fileExpectations) {
    const fixturePath = fileExpectation.path;
    if (!fixturePath) {
      continue;
    }
    const path = replaceFixturePaths(fixturePath, fixturePathReplacements);

    const compareMode = fileExpectation.compareMode;

    if (compareMode === undefined) {
      await Deno.stat(join(workspaceRoot, path));
      continue;
    }

    const actualBytes = await Deno.readFile(join(workspaceRoot, path));
    const expectedBytes = new TextEncoder().encode(
      replaceFixturePaths(
        await readMeshAliceBioBranchFile(transitionCase.toRef!, fixturePath),
        fixturePathReplacements,
      ),
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
}

function runCliCommand(
  args: readonly string[],
  cwd?: string,
): Promise<Deno.CommandOutput> {
  const command = new Deno.Command("deno", {
    args: [
      "run",
      "--allow-read",
      "--allow-write",
      "--allow-env",
      cliEntrypoint,
      ...args,
    ],
    cwd: cwd ? toFileUrl(`${cwd}/`) : new URL(".", repoRoot),
    stdout: "piped",
    stderr: "piped",
  });

  return command.output();
}

async function writeSidecarMeshConfig(meshRoot: string): Promise<void> {
  await Deno.mkdir(join(meshRoot, "_mesh/_config"), { recursive: true });
  await Deno.writeTextFile(
    join(meshRoot, "_mesh/_config/config.ttl"),
    `@prefix sfcfg: <https://semantic-flow.github.io/sflo/config/> .

<> a sfcfg:MeshConfig ;
  sfcfg:workspaceRootRelativeToMeshRoot "../" .
`,
  );
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
