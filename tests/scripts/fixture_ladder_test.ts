import {
  assert,
  assertEquals,
  assertRejects,
  assertStringIncludes,
  assertThrows,
} from "@std/assert";
import {
  ALICE_BIO_FIXTURE_SCENARIO,
  evaluateGeneratedOutputGuardrails,
  executeFixtureTransition,
  materializeFixtureTransitionSource,
  parseFixtureLadderArgs,
  planFixtureLadder,
  renderFixtureExecutionResult,
  renderFixtureLadderPlan,
  renderFixtureMaterializationResult,
  updateFixtureBranchFromWorkspace,
} from "../../scripts/fixture-ladder.ts";

const repoRoot = new URL("../../", import.meta.url).pathname;

Deno.test("parseFixtureLadderArgs accepts dry-run planner options", () => {
  assertEquals(
    parseFixtureLadderArgs([
      "--root",
      "/tmp/weave",
      "--scenario",
      "alice-bio",
      "--format",
      "json",
      "--materialize",
      "02-mesh-created",
      "--workspace-root",
      "/tmp/weave-workspace",
    ]),
    {
      root: "/tmp/weave",
      scenario: "alice-bio",
      format: "json",
      materializeTransitionId: "02-mesh-created",
      workspaceRoot: "/tmp/weave-workspace",
    },
  );

  assertEquals(
    parseFixtureLadderArgs([
      "--root=/tmp/weave",
      "--execute=02-mesh-created",
      "--dry-run",
      "--workspace-root=/tmp/weave-workspace",
    ]),
    {
      root: "/tmp/weave",
      scenario: "alice-bio",
      format: "text",
      executeTransitionId: "02-mesh-created",
      dryRun: true,
      workspaceRoot: "/tmp/weave-workspace",
    },
  );

  assertEquals(
    parseFixtureLadderArgs(["--root=/tmp/weave", "--json"]),
    {
      root: "/tmp/weave",
      scenario: "alice-bio",
      format: "json",
    },
  );
});

Deno.test("parseFixtureLadderArgs rejects unsupported scenarios and formats", () => {
  assertThrows(
    () => parseFixtureLadderArgs(["--scenario", "fantasy-rules"]),
    Error,
    "Unsupported fixture scenario",
  );
  assertThrows(
    () => parseFixtureLadderArgs(["--format", "yaml"]),
    Error,
    "Unsupported fixture plan format",
  );
  assertThrows(
    () => parseFixtureLadderArgs(["--workspace-root", "/tmp/weave"]),
    Error,
    "--workspace-root requires --materialize or --execute",
  );
  assertThrows(
    () =>
      parseFixtureLadderArgs([
        "--materialize",
        "02-mesh-created",
        "--execute",
        "02-mesh-created",
      ]),
    Error,
    "only one of --materialize or --execute",
  );
});

Deno.test("planFixtureLadder exposes the Alice Bio dry-run transition plan", async () => {
  const plan = await planFixtureLadder({
    root: repoRoot,
    scenario: "alice-bio",
    format: "text",
  });

  assertEquals(plan.writesBranches, false);
  assertEquals(
    plan.scenario.fixtureRepo,
    "github.com/semantic-flow/mesh-alice-bio",
  );
  assertEquals(plan.scenario.branchPrefix, "a.");
  assertStringIncludes(plan.assetRoot, "mesh-alice-bio/.assets");
  assertEquals(plan.transitions.length, 25);
  assertEquals(plan.transitions[0]?.id, "01-source-only");
  assertEquals(plan.transitions[0]?.fromRef, "a.00-blank-slate");
  assertEquals(plan.transitions[24]?.id, "25-root-page-customized-woven");
  assertEquals(plan.transitions[24]?.fromRef, "a.24-root-page-customized");

  const meshCreate = plan.transitions[1];
  assertEquals(meshCreate?.operationId, "mesh.create");
  assertEquals(meshCreate?.action.kind, "command");
  if (meshCreate?.action.kind === "command") {
    assertEquals(meshCreate.action.argv, [
      "mesh",
      "create",
      "--workspace",
      ".",
      "--mesh-base",
      "https://semantic-flow.github.io/mesh-alice-bio/",
    ]);
  }

  const firstWeave = plan.transitions[2];
  assertEquals(firstWeave?.operationId, "weave");
  assertEquals(firstWeave?.action.kind, "command");
  if (firstWeave?.action.kind === "command") {
    assertEquals(firstWeave.action.argv, [
      "--history-tracking-policy",
      "versioned",
    ]);
  }

  const pageCustomized = plan.transitions[13];
  assertEquals(pageCustomized?.operationId, "resourcePage.define");
  assertEquals(pageCustomized?.action.kind, "fileOperation");
  if (pageCustomized?.action.kind === "fileOperation") {
    assertEquals(
      pageCustomized.action.sources.map((source) => source.path),
      [
        "alice/_knop/_page/page.ttl",
        "alice/alice.md",
        "mesh-content/sidebar.md",
        "alice/_knop/_assets/alice.css",
      ],
    );
    assertEquals(
      pageCustomized.action.sources[0]?.assetPath,
      "14-alice-page-customized/alice/_knop/_page/page.ttl",
    );
    assertEquals(pageCustomized.action.inventoryPatches.length, 1);
    assertEquals(
      pageCustomized.action.inventoryPatches[0]?.inventoryPath,
      "alice/_knop/_inventory/inventory.ttl",
    );
  }
  assertEquals(
    pageCustomized?.validation.guardrails.includes(
      "generated RDF uses the canonical sflo namespace",
    ),
    true,
  );
});

Deno.test("planFixtureLadder names existing Alice Bio Accord manifests", async () => {
  const plan = await planFixtureLadder({
    root: repoRoot,
    scenario: "alice-bio",
    format: "text",
  });

  for (const transition of plan.transitions) {
    await Deno.stat(transition.manifestPath);
  }
});

Deno.test("Alice Bio asset-backed transitions point at checked-in deterministic assets", async () => {
  const plan = await planFixtureLadder({
    root: repoRoot,
    scenario: "alice-bio",
    format: "text",
  });
  const assetPaths = plan.transitions.flatMap((transition) =>
    transition.action.kind === "command"
      ? transition.action.inputs.map((input) => input.assetPath)
      : transition.action.sources.map((source) => source.assetPath)
  ).sort();

  assertEquals(assetPaths, [
    "01-source-only/alice-bio.ttl",
    "10-alice-bio-updated/alice-bio-v2.ttl",
    "14-alice-page-customized/alice/_knop/_assets/alice.css",
    "14-alice-page-customized/alice/_knop/_page/page.ttl",
    "14-alice-page-customized/alice/alice.md",
    "14-alice-page-customized/mesh-content/sidebar.md",
    "16-alice-page-main-integrated/alice-page-main.md",
    "18-alice-page-artifact-source/alice/_knop/_page/page.ttl",
    "20-bob-page-imported-source/bob-page-main.md",
    "20-bob-page-imported-source/bob/_knop/_page/page.ttl",
    "24-root-page-customized/_knop/_assets/site.css",
    "24-root-page-customized/_knop/_page/page.ttl",
    "24-root-page-customized/home.md",
    "24-root-page-customized/mesh-content/root-sidebar.md",
  ]);

  for (const assetPath of assetPaths) {
    await Deno.stat(`${plan.assetRoot}/${assetPath}`);
  }

  for (
    const assetPath of assetPaths.filter((path) => path.endsWith("page.ttl"))
  ) {
    const contents = await Deno.readTextFile(`${plan.assetRoot}/${assetPath}`);
    assertStringIncludes(
      contents,
      "https://semantic-flow.github.io/sflo/ontology/",
    );
    assertEquals(
      contents.includes(
        "https://semantic-flow.github.io/semantic-flow-ontology/",
      ),
      false,
    );
  }
});

Deno.test("renderFixtureLadderPlan prints reviewable command and validation details", async () => {
  const plan = await planFixtureLadder({
    root: repoRoot,
    scenario: "alice-bio",
    format: "text",
  });
  const rendered = renderFixtureLadderPlan(plan);

  assertStringIncludes(rendered, "Fixture ladder dry run: Alice Bio");
  assertStringIncludes(rendered, "Asset root:");
  assertStringIncludes(rendered, "Branch writes: disabled");
  assertStringIncludes(rendered, "Transitions: 25");
  assertStringIncludes(
    rendered,
    "2. 02-mesh-created: a.01-source-only -> a.02-mesh-created",
  );
  assertStringIncludes(
    rendered,
    "command: weave mesh create --workspace . --mesh-base https://semantic-flow.github.io/mesh-alice-bio/",
  );
  assertStringIncludes(
    rendered,
    "command: weave --history-tracking-policy versioned",
  );
  assertStringIncludes(
    rendered,
    "file operation: Apply the hand-authored Alice page definition",
  );
  assertStringIncludes(
    rendered,
    "source: alice/_knop/_page/page.ttl <= .assets/14-alice-page-customized/alice/_knop/_page/page.ttl",
  );
  assertStringIncludes(
    rendered,
    "inventory patch: alice/_knop/_inventory/inventory.ttl registers alice/_knop/_page",
  );
  assertStringIncludes(
    rendered,
    "input: alice-bio-v2.ttl <= .assets/10-alice-bio-updated/alice-bio-v2.ttl",
  );
  assertStringIncludes(
    rendered,
    "guardrail: generated MeshInventory progression lives on _mesh/_meta",
  );
});

Deno.test("Alice Bio fixture scenario has sequential transition indexes", () => {
  assertEquals(
    ALICE_BIO_FIXTURE_SCENARIO.transitions.map((transition) =>
      transition.index
    ),
    Array.from({ length: 25 }, (_, index) => index + 1),
  );
});

Deno.test("materializeFixtureTransitionSource copies a transition source ref into an empty workspace", async () => {
  const { root, workspaceRoot } = await setupSourceOnlyFileOperationFixture({
    createTargetRef: true,
  });

  const result = await materializeFixtureTransitionSource({
    root,
    scenario: "alice-bio",
    transitionId: "02-mesh-created",
    workspaceRoot,
  });

  assertEquals(result.transitionId, "02-mesh-created");
  assertEquals(result.fromRef, "a.01-source-only");
  assertEquals(result.toRef, "a.02-mesh-created");
  assertEquals(result.writesBranches, false);
  assertEquals(result.materializedPaths.includes("alice-bio.ttl"), true);
  assertStringIncludes(
    await Deno.readTextFile(`${workspaceRoot}/alice-bio.ttl`),
    "fixture source",
  );
});

Deno.test("materializeFixtureTransitionSource rejects non-empty workspace roots", async () => {
  const workspaceRoot = await Deno.makeTempDir({
    prefix: "weave-fixture-ladder-nonempty-",
  });
  await Deno.writeTextFile(`${workspaceRoot}/existing.txt`, "keep me\n");

  await assertRejects(
    () =>
      materializeFixtureTransitionSource({
        root: repoRoot,
        scenario: "alice-bio",
        transitionId: "02-mesh-created",
        workspaceRoot,
      }),
    Error,
    "workspace root must be empty",
  );
});

Deno.test("renderFixtureMaterializationResult prints workspace and next action", async () => {
  const { root, workspaceRoot } = await setupSourceOnlyFileOperationFixture({
    createTargetRef: true,
  });
  const result = await materializeFixtureTransitionSource({
    root,
    scenario: "alice-bio",
    transitionId: "02-mesh-created",
    workspaceRoot,
  });

  const rendered = renderFixtureMaterializationResult(result);
  assertStringIncludes(rendered, "Fixture source materialized: alice-bio");
  assertStringIncludes(rendered, "Transition: 02-mesh-created");
  assertStringIncludes(rendered, "Asset root:");
  assertStringIncludes(rendered, `Workspace root: ${workspaceRoot}`);
  assertStringIncludes(rendered, "- alice-bio.ttl");
  assertStringIncludes(
    rendered,
    "Next command: weave mesh create --workspace . --mesh-base https://semantic-flow.github.io/mesh-alice-bio/",
  );
});

Deno.test("executeFixtureTransition runs the first command and validates the workspace against its manifest", async () => {
  const { root, workspaceRoot } = await setupSourceOnlyFileOperationFixture({
    createTargetRef: true,
    createMeshCreatedRef: true,
    createDummyCli: true,
  });

  const result = await executeFixtureTransition({
    root,
    scenario: "alice-bio",
    transitionId: "02-mesh-created",
    workspaceRoot,
    dryRun: true,
  });

  assertEquals(result.transitionId, "02-mesh-created");
  if (result.actionKind !== "command") {
    throw new Error("expected command transition execution");
  }
  assertEquals(result.writesBranches, false);
  assertEquals(result.branchUpdate.updated, false);
  if (result.branchUpdate.updated) {
    throw new Error("dry-run execution should not update a branch");
  }
  assertEquals(result.branchUpdate.reason, "dry run requested");
  assertEquals(result.command.success, true, result.command.stderr);
  assertStringIncludes(
    result.command.stdout,
    "Created 3 mesh support artifacts",
  );
  await Deno.stat(`${workspaceRoot}/.weave/logs/security-audit.jsonl`);

  assert(result.validation.checks.length > 0);
  assertEquals(
    result.validation.summary.pass + result.validation.summary.fail +
      result.validation.summary.error,
    result.validation.checks.length,
  );
  assert(
    result.validation.checks.some((check) =>
      check.kind === "file_compare" && check.path === "_mesh/_meta/meta.ttl"
    ),
  );
  assert(
    result.validation.checks.some((check) =>
      check.kind === "file_compare" &&
      check.path === "_mesh/_inventory/inventory.ttl"
    ),
  );
  const guardrailChecks = result.validation.checks.filter((check) =>
    check.kind === "setup"
  );
  assertEquals(guardrailChecks.length, 3);
  assertEquals(
    guardrailChecks.every((check) => check.status === "pass"),
    true,
  );
});

Deno.test("executeFixtureTransition applies file-operation assets", async () => {
  const { root, workspaceRoot } = await setupSourceOnlyFileOperationFixture({
    createTargetRef: true,
  });

  const result = await executeFixtureTransition({
    root,
    scenario: "alice-bio",
    transitionId: "01-source-only",
    workspaceRoot,
    dryRun: true,
  });

  assertEquals(result.actionKind, "fileOperation");
  if (result.actionKind !== "fileOperation") {
    throw new Error("expected file operation transition execution");
  }
  assertEquals(result.fileOperation.success, true);
  assertEquals(result.fileOperation.files.length, 1);
  assertEquals(
    result.fileOperation.files[0]?.assetPath,
    "01-source-only/alice-bio.ttl",
  );
  assertEquals(
    await Deno.readTextFile(`${workspaceRoot}/alice-bio.ttl`),
    "fixture source\n",
  );
  assertEquals(result.validation.status, "pass");
  assertEquals(result.branchUpdate.updated, false);
  if (result.branchUpdate.updated) {
    throw new Error("dry-run file operation should not update a branch");
  }
  assertEquals(result.branchUpdate.reason, "dry run requested");
});

Deno.test("executeFixtureTransition reports toRef drift without blocking branch updates", async () => {
  const { root, workspaceRoot, fixtureRepoPath } =
    await setupSourceOnlyFileOperationFixture({
      createTargetRef: false,
    });

  const result = await executeFixtureTransition({
    root,
    scenario: "alice-bio",
    transitionId: "01-source-only",
    workspaceRoot,
  });

  assertEquals(result.actionKind, "fileOperation");
  if (result.actionKind !== "fileOperation") {
    throw new Error("expected file operation transition execution");
  }
  assertEquals(result.fileOperation.success, true);
  assertEquals(result.validation.status, "fail");
  assert(
    result.validation.checks.some((check) =>
      check.code === "git_ref_unresolved" &&
      check.message.includes("toRef a.01-source-only")
    ),
  );
  assertEquals(result.branchUpdate.updated, true);
  if (!result.branchUpdate.updated) {
    throw new Error("expected drifted toRef to allow a branch update");
  }
  assertEquals(result.branchUpdate.parentRef, "a.00-blank-slate");
  assertEquals(
    await gitOutput(fixtureRepoPath, [
      "show",
      "a.01-source-only:alice-bio.ttl",
    ]),
    "fixture source\n",
  );
});

Deno.test("renderFixtureExecutionResult prints command and validation status", async () => {
  const { root, workspaceRoot } = await setupSourceOnlyFileOperationFixture({
    createTargetRef: true,
    createMeshCreatedRef: true,
    createDummyCli: true,
  });
  const result = await executeFixtureTransition({
    root,
    scenario: "alice-bio",
    transitionId: "02-mesh-created",
    workspaceRoot,
    dryRun: true,
  });
  if (result.actionKind !== "command") {
    throw new Error("expected command transition execution");
  }

  const rendered = renderFixtureExecutionResult(result);
  assertStringIncludes(rendered, "Fixture transition executed: alice-bio");
  assertStringIncludes(rendered, "Transition: 02-mesh-created");
  assertStringIncludes(
    rendered,
    "Command: deno run --allow-read --allow-write --allow-env",
  );
  assertStringIncludes(rendered, "Validation:");
  assertStringIncludes(rendered, "status:");
  assertStringIncludes(rendered, "Branch update:");
  assertStringIncludes(rendered, "skipped: dry run requested");
});

Deno.test("updateFixtureBranchFromWorkspace writes generated output to a local fixture branch", async () => {
  const fixtureRepoPath = await Deno.makeTempDir({
    prefix: "weave-fixture-ladder-repo-",
  });
  const workspaceRoot = await Deno.makeTempDir({
    prefix: "weave-fixture-ladder-branch-workspace-",
  });
  await initTestGitRepo(fixtureRepoPath);
  await Deno.writeTextFile(`${fixtureRepoPath}/alice-bio.ttl`, "old\n");
  await runTestGit(fixtureRepoPath, ["add", "."]);
  await runTestGit(fixtureRepoPath, [
    "-c",
    "user.name=Test",
    "-c",
    "user.email=test@example.invalid",
    "commit",
    "-m",
    "seed fixture",
  ]);
  await runTestGit(fixtureRepoPath, ["branch", "a.02-mesh-created"]);

  await Deno.writeTextFile(`${workspaceRoot}/alice-bio.ttl`, "new\n");
  await Deno.mkdir(`${workspaceRoot}/_mesh/_meta`, { recursive: true });
  await Deno.writeTextFile(
    `${workspaceRoot}/_mesh/_meta/meta.ttl`,
    "@prefix sflo: <https://semantic-flow.github.io/sflo/ontology/> .\n",
  );
  await Deno.mkdir(`${workspaceRoot}/.weave/logs`, { recursive: true });
  await Deno.writeTextFile(`${workspaceRoot}/.weave/logs/audit.jsonl`, "{}\n");

  const result = await updateFixtureBranchFromWorkspace({
    fixtureRepoPath,
    workspaceRoot,
    targetRef: "a.02-mesh-created",
    message: "regenerate test branch",
  });

  assertEquals(result.updated, true);
  if (!result.updated) {
    throw new Error("expected branch update to write a commit");
  }
  assertEquals(result.branchRef, "refs/heads/a.02-mesh-created");
  assertEquals(result.pushed, false);
  assertEquals(
    await gitOutput(fixtureRepoPath, [
      "show",
      "a.02-mesh-created:alice-bio.ttl",
    ]),
    "new\n",
  );
  assertEquals(
    await gitSucceeds(fixtureRepoPath, [
      "show",
      "a.02-mesh-created:.weave/logs/audit.jsonl",
    ]),
    false,
  );
});

Deno.test("evaluateGeneratedOutputGuardrails catches stale namespace and inventory-owned progression", async () => {
  const workspaceRoot = await Deno.makeTempDir({
    prefix: "weave-fixture-ladder-guardrail-",
  });
  await Deno.mkdir(`${workspaceRoot}/_mesh/_inventory/_history001/_s0001`, {
    recursive: true,
  });
  await Deno.writeTextFile(
    `${workspaceRoot}/_mesh/_inventory/inventory.ttl`,
    `@prefix sflo: <https://semantic-flow.github.io/semantic-flow-ontology/> .

<_mesh/_inventory> a sflo:MeshInventory ;
  sflo:hasArtifactHistory <_mesh/_inventory/_history001> ;
  sflo:currentArtifactHistory <_mesh/_inventory/_history001> .
`,
  );
  await Deno.writeTextFile(
    `${workspaceRoot}/_mesh/_inventory/_history001/_s0001/inventory.ttl`,
    `@prefix sflo: <https://semantic-flow.github.io/sflo/ontology/> .

<_mesh/_inventory/_history001/_s0001> a sflo:HistoricalState .
`,
  );

  const checks = await evaluateGeneratedOutputGuardrails(workspaceRoot);

  assertEquals(checks.filter((check) => check.status === "fail").length, 3);
  assert(
    checks.some((check) =>
      check.status === "fail" &&
      check.message.includes("retired namespace")
    ),
  );
  assert(
    checks.some((check) =>
      check.status === "fail" &&
      check.message.includes("Stale MeshInventory progression facts")
    ),
  );
  assert(
    checks.some((check) =>
      check.status === "fail" &&
      check.message.includes("_mesh/_meta/meta.ttl does not anchor")
    ),
  );
});

async function setupSourceOnlyFileOperationFixture(options: {
  createTargetRef: boolean;
  createMeshCreatedRef?: boolean;
  createDummyCli?: boolean;
}): Promise<{
  root: string;
  workspaceRoot: string;
  fixtureRepoPath: string;
}> {
  const meshMeta =
    `@prefix sflo: <https://semantic-flow.github.io/sflo/ontology/> .

<_mesh/_meta> a sflo:MeshMetadata .
`;
  const meshInventory =
    `@prefix sflo: <https://semantic-flow.github.io/sflo/ontology/> .

<_mesh/_inventory> a sflo:MeshInventory .
`;
  const root = await Deno.makeTempDir({
    prefix: "weave-fixture-ladder-file-operation-root-",
  });
  const workspaceRoot = await Deno.makeTempDir({
    prefix: "weave-fixture-ladder-file-operation-workspace-",
  });
  const fixtureRepoPath =
    `${root}/dependencies/github.com/semantic-flow/mesh-alice-bio`;
  const manifestRoot =
    `${root}/dependencies/github.com/semantic-flow/semantic-flow-framework/examples/alice-bio/conformance`;
  const assetRoot = `${fixtureRepoPath}/.assets`;
  await Deno.mkdir(fixtureRepoPath, { recursive: true });
  await Deno.mkdir(manifestRoot, { recursive: true });
  await Deno.mkdir(`${assetRoot}/01-source-only`, {
    recursive: true,
  });
  await Deno.writeTextFile(
    `${assetRoot}/01-source-only/alice-bio.ttl`,
    "fixture source\n",
  );
  await Deno.writeTextFile(
    `${fixtureRepoPath}/README.md`,
    "# fixture control\n",
  );
  await Deno.writeTextFile(
    `${fixtureRepoPath}/.gitignore`,
    ".weave/\n",
  );
  await initTestGitRepo(fixtureRepoPath);
  await runTestGit(fixtureRepoPath, ["add", "."]);
  await runTestGit(fixtureRepoPath, [
    "-c",
    "user.name=Test",
    "-c",
    "user.email=test@example.invalid",
    "commit",
    "--allow-empty",
    "-m",
    "blank fixture",
  ]);
  await runTestGit(fixtureRepoPath, ["branch", "a.00-blank-slate"]);
  if (options.createTargetRef) {
    await Deno.writeTextFile(
      `${fixtureRepoPath}/alice-bio.ttl`,
      "fixture source\n",
    );
    await runTestGit(fixtureRepoPath, ["add", "."]);
    await runTestGit(fixtureRepoPath, [
      "-c",
      "user.name=Test",
      "-c",
      "user.email=test@example.invalid",
      "commit",
      "-m",
      "source fixture",
    ]);
    await runTestGit(fixtureRepoPath, ["branch", "a.01-source-only"]);
  }

  if (options.createMeshCreatedRef) {
    await Deno.mkdir(`${fixtureRepoPath}/_mesh/_meta`, { recursive: true });
    await Deno.mkdir(`${fixtureRepoPath}/_mesh/_inventory`, {
      recursive: true,
    });
    await Deno.writeTextFile(
      `${fixtureRepoPath}/_mesh/_meta/meta.ttl`,
      meshMeta,
    );
    await Deno.writeTextFile(
      `${fixtureRepoPath}/_mesh/_inventory/inventory.ttl`,
      meshInventory,
    );
    await runTestGit(fixtureRepoPath, ["add", "."]);
    await runTestGit(fixtureRepoPath, [
      "-c",
      "user.name=Test",
      "-c",
      "user.email=test@example.invalid",
      "commit",
      "-m",
      "mesh created fixture",
    ]);
    await runTestGit(fixtureRepoPath, ["branch", "a.02-mesh-created"]);
  }

  if (options.createDummyCli) {
    await Deno.mkdir(`${root}/src`, { recursive: true });
    await Deno.writeTextFile(
      `${root}/src/main.ts`,
      [
        `if (Deno.args.join(" ") !== "mesh create --workspace . --mesh-base https://semantic-flow.github.io/mesh-alice-bio/") {`,
        `  console.error(\`unexpected args: \${Deno.args.join(" ")}\`);`,
        `  Deno.exit(2);`,
        `}`,
        `await Deno.mkdir("_mesh/_meta", { recursive: true });`,
        `await Deno.mkdir("_mesh/_inventory", { recursive: true });`,
        `await Deno.mkdir(".weave/logs", { recursive: true });`,
        `await Deno.writeTextFile("_mesh/_meta/meta.ttl", ${
          JSON.stringify(meshMeta)
        });`,
        `await Deno.writeTextFile("_mesh/_inventory/inventory.ttl", ${
          JSON.stringify(meshInventory)
        });`,
        `await Deno.writeTextFile(".weave/logs/security-audit.jsonl", "{}\\n");`,
        `console.log("Created 3 mesh support artifacts");`,
      ].join("\n"),
    );
  }

  await Deno.writeTextFile(
    `${manifestRoot}/01-source-only.jsonld`,
    JSON.stringify(
      {
        "@context": {
          "@vocab": "https://spectacular-voyage.github.io/accord/ns#",
          id: "@id",
          type: "@type",
          changeType: { "@type": "@vocab" },
          compareMode: { "@type": "@vocab" },
        },
        type: "Manifest",
        id: "urn:test:fixture-ladder:01-source-only",
        hasCase: [
          {
            type: "TransitionCase",
            id: "#source-only",
            fixtureRepo: "github.com/semantic-flow/mesh-alice-bio",
            operationId: "fixture.seedSourceOnly",
            fromRef: "a.00-blank-slate",
            toRef: "a.01-source-only",
            hasFileExpectation: [
              {
                id: "#source",
                type: "FileExpectation",
                path: "alice-bio.ttl",
                changeType: "added",
                compareMode: "text",
              },
            ],
          },
        ],
      },
      null,
      2,
    ),
  );
  await Deno.writeTextFile(
    `${manifestRoot}/02-mesh-created.jsonld`,
    JSON.stringify(
      {
        "@context": {
          "@vocab": "https://spectacular-voyage.github.io/accord/ns#",
          id: "@id",
          type: "@type",
          changeType: { "@type": "@vocab" },
          compareMode: { "@type": "@vocab" },
        },
        type: "Manifest",
        id: "urn:test:fixture-ladder:02-mesh-created",
        hasCase: [
          {
            type: "TransitionCase",
            id: "#mesh-created",
            fixtureRepo: "github.com/semantic-flow/mesh-alice-bio",
            operationId: "mesh.create",
            fromRef: "a.01-source-only",
            toRef: "a.02-mesh-created",
            hasReplayProfile: {
              type: "ReplayProfile",
              workspaceRoot: ".",
              hasCommandInvocation: {
                type: "CommandInvocation",
                executable: "weave",
                argv: [
                  "mesh",
                  "create",
                  "--workspace",
                  ".",
                  "--mesh-base",
                  "https://semantic-flow.github.io/mesh-alice-bio/",
                ],
                workingDirectory: "workspace",
                promptPolicy: "nonInteractive",
                expectedExitCode: 0,
                expectsOperationalLogs: true,
                expectsAuditLogs: true,
              },
            },
            hasFileExpectation: [
              {
                id: "#mesh-meta",
                type: "FileExpectation",
                path: "_mesh/_meta/meta.ttl",
                changeType: "added",
                compareMode: "text",
              },
              {
                id: "#mesh-inventory",
                type: "FileExpectation",
                path: "_mesh/_inventory/inventory.ttl",
                changeType: "added",
                compareMode: "text",
              },
            ],
          },
        ],
      },
      null,
      2,
    ),
  );
  return { root, workspaceRoot, fixtureRepoPath };
}

async function initTestGitRepo(repoPath: string): Promise<void> {
  await runTestGit(repoPath, ["init"]);
}

async function gitOutput(
  cwd: string,
  args: readonly string[],
): Promise<string> {
  const output = await runTestGit(cwd, args);
  return new TextDecoder().decode(output.stdout);
}

async function gitSucceeds(
  cwd: string,
  args: readonly string[],
): Promise<boolean> {
  const output = await new Deno.Command("git", {
    cwd,
    args: [...args],
    stdout: "piped",
    stderr: "piped",
  }).output();
  return output.success;
}

async function runTestGit(
  cwd: string,
  args: readonly string[],
): Promise<Deno.CommandOutput> {
  const output = await new Deno.Command("git", {
    cwd,
    args: [...args],
    stdout: "piped",
    stderr: "piped",
  }).output();

  if (!output.success) {
    throw new Error(
      `git ${args.join(" ")} failed: ${
        new TextDecoder().decode(output.stderr)
      }`,
    );
  }

  return output;
}
