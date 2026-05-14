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
      "--workspace-root=/tmp/weave-workspace",
    ]),
    {
      root: "/tmp/weave",
      scenario: "alice-bio",
      format: "text",
      executeTransitionId: "02-mesh-created",
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

Deno.test("planFixtureLadder exposes the Alice Bio dry-run transition plan", () => {
  const plan = planFixtureLadder({
    root: repoRoot,
    scenario: "alice-bio",
    format: "text",
  });

  assertEquals(plan.writesBranches, false);
  assertEquals(
    plan.scenario.fixtureRepo,
    "github.com/semantic-flow/mesh-alice-bio",
  );
  assertEquals(plan.transitions.length, 25);
  assertEquals(plan.transitions[0]?.id, "01-source-only");
  assertEquals(plan.transitions[0]?.fromRef, "00-blank-slate");
  assertEquals(plan.transitions[24]?.id, "25-root-page-customized-woven");
  assertEquals(plan.transitions[24]?.fromRef, "24-root-page-customized");

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
    assertEquals(firstWeave.action.argv, []);
  }

  const pageCustomized = plan.transitions[13];
  assertEquals(pageCustomized?.operationId, "resourcePage.define");
  assertEquals(pageCustomized?.action.kind, "fileOperation");
  assertEquals(
    pageCustomized?.validation.guardrails.includes(
      "generated RDF uses the canonical sflo namespace",
    ),
    true,
  );
});

Deno.test("planFixtureLadder names existing Alice Bio Accord manifests", async () => {
  const plan = planFixtureLadder({
    root: repoRoot,
    scenario: "alice-bio",
    format: "text",
  });

  for (const transition of plan.transitions) {
    await Deno.stat(transition.manifestPath);
  }
});

Deno.test("renderFixtureLadderPlan prints reviewable command and validation details", () => {
  const plan = planFixtureLadder({
    root: repoRoot,
    scenario: "alice-bio",
    format: "text",
  });
  const rendered = renderFixtureLadderPlan(plan);

  assertStringIncludes(rendered, "Fixture ladder dry run: Alice Bio");
  assertStringIncludes(rendered, "Branch writes: disabled");
  assertStringIncludes(rendered, "Transitions: 25");
  assertStringIncludes(
    rendered,
    "2. 02-mesh-created: 01-source-only -> 02-mesh-created",
  );
  assertStringIncludes(
    rendered,
    "command: weave mesh create --workspace . --mesh-base https://semantic-flow.github.io/mesh-alice-bio/",
  );
  assertStringIncludes(rendered, "command: weave\n");
  assertStringIncludes(
    rendered,
    "file operation: Apply the hand-authored Alice page definition",
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
  const workspaceRoot = await Deno.makeTempDir({
    prefix: "weave-fixture-ladder-materialize-",
  });

  const result = await materializeFixtureTransitionSource({
    root: repoRoot,
    scenario: "alice-bio",
    transitionId: "02-mesh-created",
    workspaceRoot,
  });

  assertEquals(result.transitionId, "02-mesh-created");
  assertEquals(result.fromRef, "01-source-only");
  assertEquals(result.toRef, "02-mesh-created");
  assertEquals(result.writesBranches, false);
  assertEquals(result.materializedPaths.includes("alice-bio.ttl"), true);
  assertStringIncludes(
    await Deno.readTextFile(`${workspaceRoot}/alice-bio.ttl`),
    ":alice a schema:Person ;",
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
  const workspaceRoot = await Deno.makeTempDir({
    prefix: "weave-fixture-ladder-render-",
  });
  const result = await materializeFixtureTransitionSource({
    root: repoRoot,
    scenario: "alice-bio",
    transitionId: "02-mesh-created",
    workspaceRoot,
  });

  const rendered = renderFixtureMaterializationResult(result);
  assertStringIncludes(rendered, "Fixture source materialized: alice-bio");
  assertStringIncludes(rendered, "Transition: 02-mesh-created");
  assertStringIncludes(rendered, `Workspace root: ${workspaceRoot}`);
  assertStringIncludes(rendered, "- alice-bio.ttl");
  assertStringIncludes(
    rendered,
    "Next command: weave mesh create --workspace . --mesh-base https://semantic-flow.github.io/mesh-alice-bio/",
  );
});

Deno.test("executeFixtureTransition runs the first command and validates the workspace against its manifest", async () => {
  const workspaceRoot = await Deno.makeTempDir({
    prefix: "weave-fixture-ladder-execute-",
  });

  const result = await executeFixtureTransition({
    root: repoRoot,
    scenario: "alice-bio",
    transitionId: "02-mesh-created",
    workspaceRoot,
  });

  assertEquals(result.transitionId, "02-mesh-created");
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
      check.kind === "rdf_compare" && check.path === "_mesh/_meta/meta.ttl"
    ),
  );
  assert(
    result.validation.checks.some((check) =>
      check.kind === "sparql_ask" &&
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

Deno.test("executeFixtureTransition rejects file-operation transitions", async () => {
  await assertRejects(
    () =>
      executeFixtureTransition({
        root: repoRoot,
        scenario: "alice-bio",
        transitionId: "01-source-only",
      }),
    Error,
    "can only execute command transitions",
  );
});

Deno.test("renderFixtureExecutionResult prints command and validation status", async () => {
  const workspaceRoot = await Deno.makeTempDir({
    prefix: "weave-fixture-ladder-execution-render-",
  });
  const result = await executeFixtureTransition({
    root: repoRoot,
    scenario: "alice-bio",
    transitionId: "02-mesh-created",
    workspaceRoot,
  });

  const rendered = renderFixtureExecutionResult(result);
  assertStringIncludes(rendered, "Fixture transition executed: alice-bio");
  assertStringIncludes(rendered, "Transition: 02-mesh-created");
  assertStringIncludes(
    rendered,
    "Command: deno run --allow-read --allow-write --allow-env",
  );
  assertStringIncludes(rendered, "Validation:");
  assertStringIncludes(rendered, "status:");
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
