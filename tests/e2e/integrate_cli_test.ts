import {
  assert,
  assertEquals,
  assertRejects,
  assertStringIncludes,
} from "@std/assert";
import { join, relative, toFileUrl } from "@std/path";
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
import {
  ROOT_PAYLOAD_TURTLE,
  ROOT_WORKING_FILE_PATH,
} from "../support/root_designator.ts";
import { createTestTmpDir } from "../support/test_tmp.ts";
import { resolveUserSettingsPaths } from "../../src/runtime/settings/user_settings.ts";

const repoRoot = new URL("../../", import.meta.url);
const cliPath = new URL("src/main.ts", repoRoot).pathname;

Deno.test("weave integrate matches the manifest-scoped alice-bio integrated fixture as a black-box CLI run", async () => {
  const manifestPath = resolveMeshAliceBioConformanceManifestPath(
    "06-alice-bio-integrated.jsonld",
  );
  const transitionCase = await readSingleTransitionCase(manifestPath);
  assertEquals(transitionCase.operationId, "integrate");
  assertEquals(transitionCase.fromRef, "05-alice-knop-created-woven");
  assertEquals(transitionCase.toRef, "06-alice-bio-integrated");

  const workspaceRoot = await createTestTmpDir("weave-e2e-integrate-");
  await materializeMeshAliceBioBranch(transitionCase.fromRef!, workspaceRoot);

  const command = new Deno.Command("deno", {
    args: [
      "run",
      "--allow-read",
      "--allow-write",
      "--allow-env",
      cliPath,
      "integrate",
      "alice-data.ttl",
      "--designator-path",
      "alice/data",
    ],
    cwd: toFileUrl(`${workspaceRoot}/`),
    stdout: "piped",
    stderr: "piped",
  });
  const output = await command.output();
  const stdout = new TextDecoder().decode(output.stdout);
  const stderr = new TextDecoder().decode(output.stderr);

  assert(output.success, stderr);
  assert(stdout.includes("Integrated"), stdout);

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

    if (fileExpectation.changeType === "absent") {
      await assertPathAbsent(join(workspaceRoot, path));
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
      assert(
        await compareRdfContent({
          left: actualBytes,
          right: expectedBytes,
          path,
        }),
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

Deno.test("weave integrate rejects conflicting designator paths before logging or execution", async () => {
  const workspaceRoot = await createTestTmpDir("weave-e2e-integrate-conflict-");
  await materializeMeshAliceBioBranch(
    "05-alice-knop-created-woven",
    workspaceRoot,
  );

  const command = new Deno.Command("deno", {
    args: [
      "run",
      "--allow-read",
      "--allow-write",
      "--allow-env",
      cliPath,
      "integrate",
      "alice-data.ttl",
      "alice/data",
      "--designator-path",
      "bob/bio",
    ],
    cwd: toFileUrl(`${workspaceRoot}/`),
    stdout: "piped",
    stderr: "piped",
  });
  const output = await command.output();
  const stderr = new TextDecoder().decode(output.stderr);

  assertEquals(output.success, false);
  assert(
    stderr.includes("integrate received conflicting designator paths"),
    stderr,
  );
  await assertRejects(
    () => Deno.stat(join(workspaceRoot, ".weave/logs/security-audit.jsonl")),
    Deno.errors.NotFound,
  );
  await assertPathAbsent(
    join(workspaceRoot, "alice/data/_knop/_inventory/inventory.ttl"),
  );
});

Deno.test("weave integrate accepts the root designator path as a black-box CLI run", async () => {
  const workspaceRoot = await createTestTmpDir("weave-e2e-integrate-root-");
  await materializeMeshAliceBioBranch(
    "05-alice-knop-created-woven",
    workspaceRoot,
  );
  await Deno.writeTextFile(
    join(workspaceRoot, ROOT_WORKING_FILE_PATH),
    ROOT_PAYLOAD_TURTLE,
  );

  const command = new Deno.Command("deno", {
    args: [
      "run",
      "--allow-read",
      "--allow-write",
      "--allow-env",
      cliPath,
      "integrate",
      ROOT_WORKING_FILE_PATH,
      "--designator-path",
      "/",
    ],
    cwd: toFileUrl(`${workspaceRoot}/`),
    stdout: "piped",
    stderr: "piped",
  });
  const output = await command.output();
  const stdout = new TextDecoder().decode(output.stdout);
  const stderr = new TextDecoder().decode(output.stderr);

  assert(output.success, stderr);
  assert(stdout.includes("Integrated"), stdout);
  await Deno.stat(join(workspaceRoot, "_knop/_meta/meta.ttl"));
  await Deno.stat(join(workspaceRoot, "_knop/_inventory/inventory.ttl"));
});

Deno.test("weave integrate grants and uses a repo-adjacent source directory as a black-box CLI run", async () => {
  const tempRepoRoot = await createTestTmpDir("weave-e2e-integrate-policy-");
  const workspaceRoot = join(tempRepoRoot, "mesh");
  await materializeMeshAliceBioBranch(
    "05-alice-knop-created-woven",
    workspaceRoot,
  );
  await Deno.mkdir(join(tempRepoRoot, "documentation"), { recursive: true });
  await Deno.mkdir(join(workspaceRoot, "_mesh/_config"), { recursive: true });
  await Deno.writeTextFile(
    join(workspaceRoot, "_mesh/_config/config.ttl"),
    `@prefix sfcfg: <https://semantic-flow.github.io/sflo/config/> .

<> a sfcfg:MeshConfig ;
  sfcfg:workspaceRootRelativeToMeshRoot "../" .
`,
  );
  await Deno.writeTextFile(
    join(tempRepoRoot, "documentation/alice-data.ttl"),
    await readMeshAliceBioBranchFile(
      "05-alice-knop-created-woven",
      "alice-data.ttl",
    ),
  );

  const command = new Deno.Command("deno", {
    args: [
      "run",
      "--allow-read",
      "--allow-write",
      "--allow-env",
      cliPath,
      "integrate",
      "documentation/alice-data.ttl",
      "--designator-path",
      "alice/data",
      "--mesh-root",
      "mesh",
      "--grant-source-directory",
      "documentation",
    ],
    cwd: toFileUrl(`${tempRepoRoot}/`),
    stdout: "piped",
    stderr: "piped",
  });
  const output = await command.output();
  const stdout = new TextDecoder().decode(output.stdout);
  const stderr = new TextDecoder().decode(output.stderr);

  assert(output.success, stderr);
  assert(stdout.includes("Integrated"), stdout);
  assert(stdout.includes("mesh/_mesh/_config/config.ttl"), stdout);
  const config = await Deno.readTextFile(
    join(workspaceRoot, "_mesh/_config/config.ttl"),
  );
  assert(
    config.includes('sfcfg:pathPrefix "../documentation/"'),
    config,
  );
  const createdInventory = await Deno.readTextFile(
    join(workspaceRoot, "alice/data/_knop/_inventory/inventory.ttl"),
  );
  assert(
    createdInventory.includes(
      'sflo:workingLocalRelativePath "../documentation/alice-data.ttl" .',
    ),
    createdInventory,
  );
  assertEquals(
    createdInventory.includes(
      "sflo:hasWorkingLocatedFile <../documentation/alice-data.ttl> .",
    ),
    false,
  );

  const sources = await Deno.readTextFile(
    join(workspaceRoot, "alice/data/_knop/_sources/sources.ttl"),
  );
  assertStringIncludes(
    sources,
    "<alice/data/_knop/_sources#payload-source> a sflo:IntegrationSource ;",
  );
  assertStringIncludes(
    sources,
    'sflo:targetLocalRelativePath "../documentation/alice-data.ttl" ;',
  );
  assertEquals(sources.includes("sflo:expectsContentDigest"), false);
  assertEquals(sources.includes("sflo:targetRepositorySource"), false);
});

Deno.test("weave integrate records repository-backed source provenance as a black-box CLI run", async () => {
  const tempRepoRoot = await createTestTmpDir("weave-e2e-integrate-source-");
  const workspaceRoot = join(tempRepoRoot, "mesh");
  await materializeMeshAliceBioBranch(
    "05-alice-knop-created-woven",
    workspaceRoot,
  );
  await Deno.mkdir(join(tempRepoRoot, "documentation"), { recursive: true });
  await Deno.mkdir(join(workspaceRoot, "_mesh/_config"), { recursive: true });
  await Deno.writeTextFile(
    join(workspaceRoot, "_mesh/_config/config.ttl"),
    `@prefix sfcfg: <https://semantic-flow.github.io/sflo/config/> .

<> a sfcfg:MeshConfig ;
  sfcfg:workspaceRootRelativeToMeshRoot "../" .
`,
  );
  const sourceBytes = new TextEncoder().encode(
    await readMeshAliceBioBranchFile(
      "05-alice-knop-created-woven",
      "alice-data.ttl",
    ),
  );
  await Deno.writeFile(
    join(tempRepoRoot, "documentation/alice-data.ttl"),
    sourceBytes,
  );
  const expectedDigest = await sha256Digest(sourceBytes);

  const command = new Deno.Command("deno", {
    args: [
      "run",
      "--allow-read",
      "--allow-write",
      "--allow-env",
      cliPath,
      "integrate",
      "documentation/alice-data.ttl",
      "--designator-path",
      "alice/data",
      "--mesh-root",
      "mesh",
      "--grant-source-directory",
      "documentation",
      "--source-repository-url",
      "https://github.com/semantic-flow/mesh-alice-bio.git",
      "--source-repository-ref",
      "main",
      "--source-repository-commit",
      "abc123",
      "--source-repository-path",
      "documentation/alice-data.ttl",
    ],
    cwd: toFileUrl(`${tempRepoRoot}/`),
    stdout: "piped",
    stderr: "piped",
  });
  const output = await command.output();
  const stdout = new TextDecoder().decode(output.stdout);
  const stderr = new TextDecoder().decode(output.stderr);

  assert(output.success, stderr);
  assertStringIncludes(stdout, "mesh/alice/data/_knop/_sources/sources.ttl");
  const inventory = await Deno.readTextFile(
    join(workspaceRoot, "alice/data/_knop/_inventory/inventory.ttl"),
  );
  assertStringIncludes(
    inventory,
    "sflo:hasKnopSourceRegistry <alice/data/_knop/_sources> ;",
  );

  const sources = await Deno.readTextFile(
    join(workspaceRoot, "alice/data/_knop/_sources/sources.ttl"),
  );
  assertStringIncludes(
    sources,
    "<alice/data/_knop/_sources#payload-source> a sflo:IntegrationSource ;",
  );
  assertStringIncludes(
    sources,
    'sflo:targetLocalRelativePath "../documentation/alice-data.ttl" ;',
  );
  assertStringIncludes(
    sources,
    "sflo:hasArtifactResolutionMode <https://semantic-flow.github.io/sflo/ontology/artifactResolutionMode_working> ;",
  );
  assertStringIncludes(
    sources,
    `sflo:expectsContentDigest "${expectedDigest}" ;`,
  );
  assertStringIncludes(
    sources,
    "sflo:hasResolutionObservation <alice/data/_knop/_sources#payload-source-observation-001> ;",
  );
  assertStringIncludes(
    sources,
    'sflo:sourceRepositoryUrl "https://github.com/semantic-flow/mesh-alice-bio.git" ;',
  );
  assertStringIncludes(sources, 'sflo:sourceRepositoryRef "main" ;');
  assertStringIncludes(sources, 'sflo:sourceRepositoryCommit "abc123" ;');
  assertStringIncludes(
    sources,
    'sflo:sourceRepositoryPath "documentation/alice-data.ttl" ;',
  );
  assertStringIncludes(sources, `sflo:hasContentDigest "${expectedDigest}"`);
  assertStringIncludes(
    sources,
    `<alice/data/_knop/_sources#payload-source-observation-001>
  a sflo:ArtifactResolutionObservation ;
  sflo:observedArtifactResolutionSpec [
    a sflo:ArtifactResolutionSpec
  ] ;
  sflo:observedContentDigest "${expectedDigest}" .`,
  );
});

Deno.test("weave integrate records current repository floating source locators as a black-box CLI run", async () => {
  const tempRoot = await createTestTmpDir(
    "weave-e2e-integrate-floating-source-",
  );
  const sourceRoot = join(tempRoot, "source");
  const publicationRoot = join(tempRoot, "publication");
  const homeRoot = join(tempRoot, "home");
  const settingsRoot = join(tempRoot, "settings");
  await materializeMeshAliceBioBranch(
    "05-alice-knop-created-woven",
    publicationRoot,
  );
  await Deno.mkdir(join(sourceRoot, "documentation"), { recursive: true });
  await Deno.mkdir(homeRoot, { recursive: true });
  await runGit(sourceRoot, ["init"]);
  await runGit(sourceRoot, [
    "remote",
    "add",
    "origin",
    "git@github.com:semantic-flow/sflo.git",
  ]);
  await Deno.writeTextFile(
    join(sourceRoot, "documentation/alice-data.ttl"),
    await readMeshAliceBioBranchFile(
      "05-alice-knop-created-woven",
      "alice-data.ttl",
    ),
  );

  const command = new Deno.Command("deno", {
    args: [
      "run",
      "--allow-read",
      "--allow-write",
      "--allow-env",
      "--allow-run=git",
      cliPath,
      "integrate",
      "source/documentation/alice-data.ttl",
      "--designator-path",
      "alice/data",
      "--mesh-root",
      "publication",
      "--grant-source-directory",
      "source",
      "--source-repository-current",
      "--source-repository-url",
      "https://github.com/semantic-flow/sflo.git",
    ],
    cwd: toFileUrl(`${tempRoot}/`),
    env: {
      HOME: homeRoot,
      WEAVE_SETTINGS: settingsRoot,
    },
    stdout: "piped",
    stderr: "piped",
  });
  const output = await command.output();
  const stdout = new TextDecoder().decode(output.stdout);
  const stderr = new TextDecoder().decode(output.stderr);

  assert(output.success, stderr);
  assertStringIncludes(stdout, "alice/data/_knop/_sources/sources.ttl");
  const inventory = await Deno.readTextFile(
    join(publicationRoot, "alice/data/_knop/_inventory/inventory.ttl"),
  );
  assertStringIncludes(
    inventory,
    "sflo:hasRepositorySourceFloatingLocator [",
  );
  assertStringIncludes(
    inventory,
    "a sflo:RepositorySourceFloatingLocator ;",
  );
  assertStringIncludes(
    inventory,
    'sflo:sourceRepositoryUrl "https://github.com/semantic-flow/sflo.git" ;',
  );
  assertStringIncludes(
    inventory,
    'sflo:sourceRepositoryPathFromRoot "documentation/alice-data.ttl"',
  );
  assertEquals(inventory.includes("sflo:workingLocalRelativePath"), false);
  assertEquals(
    inventory.includes("sflo:hasWorkingLocatedFile <../source/"),
    false,
  );

  const sources = await Deno.readTextFile(
    join(publicationRoot, "alice/data/_knop/_sources/sources.ttl"),
  );
  assertStringIncludes(
    sources,
    "<alice/data/_knop/_sources#payload-source> a sflo:IntegrationSource ;",
  );
  assertStringIncludes(
    sources,
    "sflo:hasRepositorySourceFloatingLocator [",
  );
  assertEquals(sources.includes("sflo:targetLocalRelativePath"), false);
  assertEquals(sources.includes("sflo:sourceRepositoryRef"), false);
  assertEquals(sources.includes("sflo:sourceRepositoryCommit"), false);
  assertEquals(sources.includes("sflo:hasContentDigest"), false);
});

Deno.test("weave integrate rejects partial repository-backed source metadata before execution", async () => {
  const workspaceRoot = await createTestTmpDir(
    "weave-e2e-integrate-partial-source-metadata-",
  );
  const command = new Deno.Command("deno", {
    args: [
      "run",
      "--allow-read",
      "--allow-write",
      "--allow-env",
      cliPath,
      "integrate",
      "missing.ttl",
      "alice/data",
      "--source-repository-url",
      "https://github.com/semantic-flow/mesh-alice-bio.git",
    ],
    cwd: toFileUrl(`${workspaceRoot}/`),
    stdout: "piped",
    stderr: "piped",
  });
  const output = await command.output();
  const stderr = new TextDecoder().decode(output.stderr);

  assertEquals(output.success, false);
  assertStringIncludes(
    stderr,
    "repository-backed integrate source bindings require --source-repository-url, --source-repository-ref, and --source-repository-path",
  );
});

Deno.test("weave integrate rejects source digest evidence without repository metadata", async () => {
  const workspaceRoot = await createTestTmpDir(
    "weave-e2e-integrate-digest-without-repo-",
  );
  const command = new Deno.Command("deno", {
    args: [
      "run",
      "--allow-read",
      "--allow-write",
      "--allow-env",
      cliPath,
      "integrate",
      "missing.ttl",
      "alice/data",
      "--source-digest",
      "sha256:not-checked",
    ],
    cwd: toFileUrl(`${workspaceRoot}/`),
    stdout: "piped",
    stderr: "piped",
  });
  const output = await command.output();
  const stderr = new TextDecoder().decode(output.stderr);

  assertEquals(output.success, false);
  assertStringIncludes(
    stderr,
    "integrate source digest requires repository-backed source metadata",
  );
});

Deno.test("weave integrate can grant a separate source checkout through host-local policy", async () => {
  const tempRoot = await createTestTmpDir("weave-e2e-integrate-host-grant-");
  const sourceRoot = join(tempRoot, "source");
  const publicationRoot = join(tempRoot, "publication");
  const homeRoot = join(tempRoot, "home");
  const settingsRoot = join(tempRoot, "settings");
  await materializeMeshAliceBioBranch(
    "05-alice-knop-created-woven",
    publicationRoot,
  );
  await Deno.mkdir(sourceRoot, { recursive: true });
  await Deno.mkdir(homeRoot, { recursive: true });
  await Deno.writeTextFile(
    join(sourceRoot, "alice-data.ttl"),
    await readMeshAliceBioBranchFile(
      "05-alice-knop-created-woven",
      "alice-data.ttl",
    ),
  );

  const command = new Deno.Command("deno", {
    args: [
      "run",
      "--allow-read",
      "--allow-write",
      "--allow-env",
      cliPath,
      "integrate",
      "source/alice-data.ttl",
      "--designator-path",
      "alice/data",
      "--mesh-root",
      "publication",
      "--grant-source-directory",
      "source",
    ],
    cwd: toFileUrl(`${tempRoot}/`),
    env: {
      HOME: homeRoot,
      WEAVE_SETTINGS: settingsRoot,
    },
    stdout: "piped",
    stderr: "piped",
  });
  const output = await command.output();
  const stdout = new TextDecoder().decode(output.stdout);
  const stderr = new TextDecoder().decode(output.stderr);

  assert(output.success, stderr);
  assertStringIncludes(stdout, "access.ttl");

  const settingsPaths = await resolveUserSettingsPaths(
    "https://semantic-flow.github.io/mesh-alice-bio/",
    {
      env: {
        HOME: homeRoot,
        WEAVE_SETTINGS: settingsRoot,
      },
    },
  );
  const localAccess = await Deno.readTextFile(
    settingsPaths.meshSettings.accessProfilePath,
  );
  assertStringIncludes(
    localAccess,
    "weave:HostLocalAccessProfile",
  );
  assertStringIncludes(
    localAccess,
    `weave:allowsLocalPathBase "${sourceRoot}/"`,
  );

  const inventory = await Deno.readTextFile(
    join(publicationRoot, "alice/data/_knop/_inventory/inventory.ttl"),
  );
  assertStringIncludes(
    inventory,
    'sflo:workingLocalRelativePath "../source/alice-data.ttl" .',
  );

  const sources = await Deno.readTextFile(
    join(publicationRoot, "alice/data/_knop/_sources/sources.ttl"),
  );
  assertStringIncludes(
    sources,
    'sflo:targetLocalRelativePath "../source/alice-data.ttl" ;',
  );
  assertStringIncludes(
    sources,
    "<alice/data/_knop/_sources#payload-source> a sflo:IntegrationSource ;",
  );
  assertEquals(sources.includes("sflo:expectsContentDigest"), false);
  assertEquals(sources.includes("sflo:targetRepositorySource"), false);
  assertEquals(sources.includes("sflo:sourceRepository"), false);
});

Deno.test("weave integrate grants the workspace root through host-local policy", async () => {
  const tempRepoRoot = await createTestTmpDir(
    "weave-e2e-integrate-workspace-grant-",
  );
  const workspaceRoot = join(tempRepoRoot, "mesh");
  const homeRoot = join(tempRepoRoot, "home");
  const settingsRoot = join(tempRepoRoot, "settings");
  await materializeMeshAliceBioBranch(
    "05-alice-knop-created-woven",
    workspaceRoot,
  );
  await Deno.mkdir(join(tempRepoRoot, "documentation"), { recursive: true });
  await Deno.mkdir(join(homeRoot), { recursive: true });
  await Deno.mkdir(join(workspaceRoot, "_mesh/_config"), { recursive: true });
  await Deno.writeTextFile(
    join(workspaceRoot, "_mesh/_config/config.ttl"),
    `@prefix sfcfg: <https://semantic-flow.github.io/sflo/config/> .

<> a sfcfg:MeshConfig ;
  sfcfg:workspaceRootRelativeToMeshRoot "../" .
`,
  );
  await Deno.writeTextFile(
    join(tempRepoRoot, "documentation/alice-data.ttl"),
    await readMeshAliceBioBranchFile(
      "05-alice-knop-created-woven",
      "alice-data.ttl",
    ),
  );

  const command = new Deno.Command("deno", {
    args: [
      "run",
      "--allow-read",
      "--allow-write",
      "--allow-env",
      cliPath,
      "integrate",
      "documentation/alice-data.ttl",
      "--designator-path",
      "alice/data",
      "--mesh-root",
      "mesh",
      "--grant-source-directory",
      ".",
    ],
    cwd: toFileUrl(`${tempRepoRoot}/`),
    env: {
      HOME: homeRoot,
      WEAVE_SETTINGS: settingsRoot,
    },
    stdout: "piped",
    stderr: "piped",
  });
  const output = await command.output();
  const stdout = new TextDecoder().decode(output.stdout);
  const stderr = new TextDecoder().decode(output.stderr);

  assert(output.success, stderr);
  assertStringIncludes(stdout, "access.ttl");
  const settingsPaths = await resolveUserSettingsPaths(
    "https://semantic-flow.github.io/mesh-alice-bio/",
    {
      env: {
        HOME: homeRoot,
        WEAVE_SETTINGS: settingsRoot,
      },
    },
  );
  assertStringIncludes(
    await Deno.readTextFile(settingsPaths.meshSettings.accessProfilePath),
    `weave:allowsLocalPathBase "${tempRepoRoot}/"`,
  );
  assertStringIncludes(
    await Deno.readTextFile(
      join(workspaceRoot, "alice/data/_knop/_inventory/inventory.ttl"),
    ),
    'sflo:workingLocalRelativePath "../documentation/alice-data.ttl" .',
  );
});

Deno.test("weave integrate matches the manifest-scoped sidecar Gunaar dataset fixture", async () => {
  const manifestPath = resolveMeshSidecarFantasyRulesConformanceManifestPath(
    "12-gunaar-example-dataset.jsonld",
  );
  const transitionCase = await readSingleTransitionCase(manifestPath);
  assertEquals(transitionCase.operationId, "integrate");
  assertEquals(transitionCase.fromRef, "11-root-knop-woven");
  assertEquals(transitionCase.toRef, "12-gunaar-example-dataset");
  assertEquals(transitionCase.targetDesignatorPath, "examples/gunaar");

  const workspaceRoot = await createTestTmpDir("weave-e2e-integrate-gunaar-");
  await materializeMeshSidecarFantasyRulesBranch(
    transitionCase.fromRef!,
    workspaceRoot,
  );

  const command = new Deno.Command("deno", {
    args: [
      "run",
      "--allow-read",
      "--allow-write",
      "--allow-env",
      cliPath,
      "integrate",
      "examples/gunaar.ttl",
      "examples/gunaar",
      "--mesh-root",
      "docs",
      "--grant-source-directory",
      "examples",
    ],
    cwd: toFileUrl(`${workspaceRoot}/`),
    stdout: "piped",
    stderr: "piped",
  });
  const output = await command.output();
  const stdout = new TextDecoder().decode(output.stdout);
  const stderr = new TextDecoder().decode(output.stderr);

  assert(output.success, stderr);
  assert(stdout.includes("Integrated"), stdout);

  const actualFiles = await listRelativeFiles(workspaceRoot, ".weave/");
  const extraWorkingSourceBindingPath =
    "docs/examples/gunaar/_knop/_sources/sources.ttl";
  assertEquals(
    actualFiles,
    await listMeshSidecarFantasyRulesBranchFiles(transitionCase.toRef!),
  );
  assert(
    actualFiles.includes(extraWorkingSourceBindingPath),
    actualFiles.join(
      "\n",
    ),
  );

  const fileExpectations = getManifestFileExpectations(transitionCase);
  for (const fileExpectation of fileExpectations) {
    const path = fileExpectation.path;
    if (!path) {
      continue;
    }

    if (fileExpectation.changeType === "absent") {
      await assertPathAbsent(join(workspaceRoot, path));
      continue;
    }

    const compareMode = fileExpectation.compareMode;

    if (compareMode === undefined) {
      await Deno.stat(join(workspaceRoot, path));
      continue;
    }

    if (path === "docs/examples/gunaar/_knop/_inventory/inventory.ttl") {
      const inventory = await Deno.readTextFile(join(workspaceRoot, path));
      assertStringIncludes(
        inventory,
        "sflo:hasKnopSourceRegistry <examples/gunaar/_knop/_sources> ;",
      );
      continue;
    }

    const actualBytes = await Deno.readFile(join(workspaceRoot, path));
    const expectedBytes = new TextEncoder().encode(
      await readMeshSidecarFantasyRulesBranchFile(
        transitionCase.toRef!,
        path,
      ),
    );

    if (compareMode === "rdfCanonical") {
      assert(
        await compareRdfContent({
          left: actualBytes,
          right: expectedBytes,
          path,
        }),
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

  const sources = await Deno.readTextFile(
    join(workspaceRoot, extraWorkingSourceBindingPath),
  );
  assertStringIncludes(
    sources,
    "<examples/gunaar/_knop/_sources#payload-source> a sflo:IntegrationSource ;",
  );
  assertStringIncludes(
    sources,
    'sflo:targetLocalRelativePath "../examples/gunaar.ttl" ;',
  );
  assertEquals(sources.includes("sflo:expectsContentDigest"), false);
  assertEquals(sources.includes("sflo:targetRepositorySource"), false);

  await Deno.stat(join(workspaceRoot, ".weave/logs/operational.jsonl"));
  await Deno.stat(join(workspaceRoot, ".weave/logs/security-audit.jsonl"));
});

Deno.test("weave integrate requires a designator path before logging or execution", async () => {
  const workspaceRoot = await createTestTmpDir(
    "weave-e2e-integrate-missing-designator-",
  );
  await materializeMeshAliceBioBranch(
    "05-alice-knop-created-woven",
    workspaceRoot,
  );

  const command = new Deno.Command("deno", {
    args: [
      "run",
      "--allow-read",
      "--allow-write",
      "--allow-env",
      cliPath,
      "integrate",
      "alice-data.ttl",
    ],
    cwd: toFileUrl(`${workspaceRoot}/`),
    stdout: "piped",
    stderr: "piped",
  });
  const output = await command.output();
  const stderr = new TextDecoder().decode(output.stderr);

  assertEquals(output.success, false);
  assert(
    stderr.includes(
      "integrate requires a designator path as [designatorPath] or --designator-path",
    ),
    stderr,
  );
  await assertRejects(
    () => Deno.stat(join(workspaceRoot, ".weave/logs/security-audit.jsonl")),
    Deno.errors.NotFound,
  );
  await assertPathAbsent(
    join(workspaceRoot, "alice/data/_knop/_inventory/inventory.ttl"),
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

async function assertPathAbsent(path: string): Promise<void> {
  await assertRejects(
    () => Deno.stat(path),
    Deno.errors.NotFound,
  );
}

async function sha256Digest(bytes: Uint8Array<ArrayBuffer>): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const hex = [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return `sha256:${hex}`;
}

async function runGit(cwd: string, args: readonly string[]): Promise<void> {
  const command = new Deno.Command("git", {
    args: [...args],
    cwd,
    stdout: "piped",
    stderr: "piped",
  });
  const output = await command.output();
  if (!output.success) {
    throw new Error(new TextDecoder().decode(output.stderr));
  }
}
