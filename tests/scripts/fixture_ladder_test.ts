import {
  assert,
  assertEquals,
  assertRejects,
  assertStringIncludes,
  assertThrows,
} from "@std/assert";
import {
  ALICE_BIO_FIXTURE_SCENARIO,
  BRANCH_FANTASY_RULES_FIXTURE_SCENARIO,
  branchPublicationTransition,
  checkFixtureScenarioIndex,
  commandTransition,
  evaluateGeneratedOutputGuardrails,
  executeFixtureTransition,
  fileOperationTransition,
  fixtureAssetSource,
  materializeFixtureTransitionSource,
  parseFixtureLadderArgs,
  planFixtureLadder,
  renderFixtureExecutionResult,
  renderFixtureLadderPlan,
  renderFixtureMaterializationResult,
  renderFixtureScenarioIndexDocument,
  renderFixtureSourceSeedResult,
  seedFixtureSourceBranch,
  SIDECAR_FANTASY_RULES_FIXTURE_SCENARIO,
  updateFixtureBranchFromWorkspace,
} from "../../scripts/fixture-ladder.ts";
import type { FixtureLadderPlan } from "../../scripts/fixture-ladder.ts";
import { readMeshBranchFantasyRulesBranchFile } from "../support/mesh_branch_fantasy_rules_fixture.ts";

const repoRoot = new URL("../../", import.meta.url).pathname;

function fixtureAssetPathsForPlan(plan: FixtureLadderPlan): string[] {
  return plan.transitions.flatMap((transition) => {
    if (transition.action.kind === "command") {
      return transition.action.inputs.map((input) => input.assetPath);
    }
    if (transition.action.kind === "fileOperation") {
      return transition.action.sources.map((source) => source.assetPath);
    }
    return [];
  }).sort();
}

function targetSpecsFromArgv(argv: readonly string[]): string[] {
  return argv.filter((arg) => arg.startsWith("designatorPath="));
}

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

  assertEquals(
    parseFixtureLadderArgs([
      "--root=/tmp/weave",
      "--branch-prefix",
      "b.",
    ]),
    {
      root: "/tmp/weave",
      scenario: "alice-bio",
      format: "text",
      branchPrefix: "b.",
    },
  );

  assertEquals(
    parseFixtureLadderArgs([
      "--root=/tmp/weave",
      "--branch-prefix=b.",
      "--seed-source-ref=main",
      "--workspace-root=/tmp/weave-seed",
      "--dry-run",
    ]),
    {
      root: "/tmp/weave",
      scenario: "alice-bio",
      format: "text",
      branchPrefix: "b.",
      seedSourceRef: "main",
      workspaceRoot: "/tmp/weave-seed",
      dryRun: true,
    },
  );

  assertEquals(
    parseFixtureLadderArgs([
      "--root=/tmp/weave",
      "--scenario=sidecar-fantasy-rules",
    ]),
    {
      root: "/tmp/weave",
      scenario: "sidecar-fantasy-rules",
      format: "text",
    },
  );

  assertEquals(
    parseFixtureLadderArgs([
      "--root=/tmp/weave",
      "--scenario=branch-fantasy-rules",
    ]),
    {
      root: "/tmp/weave",
      scenario: "branch-fantasy-rules",
      format: "text",
    },
  );

  assertEquals(
    parseFixtureLadderArgs([
      "--root=/tmp/weave",
      "--scenario=branch-fantasy-rules",
      "--check-scenario-index",
    ]),
    {
      root: "/tmp/weave",
      scenario: "branch-fantasy-rules",
      format: "text",
      scenarioIndexMode: "check",
    },
  );

  assertEquals(
    parseFixtureLadderArgs([
      "--root=/tmp/weave",
      "--scenario=alice-bio",
      "--write-scenario-index",
      "--json",
    ]),
    {
      root: "/tmp/weave",
      scenario: "alice-bio",
      format: "json",
      scenarioIndexMode: "write",
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
    () => parseFixtureLadderArgs(["--branch-prefix", "bad prefix"]),
    Error,
    "Unsupported fixture branch prefix",
  );
  assertThrows(
    () => parseFixtureLadderArgs(["--workspace-root", "/tmp/weave"]),
    Error,
    "--workspace-root requires --materialize, --execute, or --seed-source-ref",
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
    "only one of --materialize, --execute, or --seed-source-ref",
  );
  assertThrows(
    () =>
      parseFixtureLadderArgs([
        "--seed-source-ref",
        "main",
        "--execute",
        "02-mesh-created",
      ]),
    Error,
    "only one of --materialize, --execute, or --seed-source-ref",
  );
  assertThrows(
    () =>
      parseFixtureLadderArgs([
        "--check-scenario-index",
        "--write-scenario-index",
      ]),
    Error,
    "only one scenario-index mode",
  );
  assertThrows(
    () =>
      parseFixtureLadderArgs([
        "--execute",
        "02-mesh-created",
        "--check-scenario-index",
      ]),
    Error,
    "scenario-index options cannot be combined",
  );
  assertThrows(
    () =>
      parseFixtureLadderArgs([
        "--branch-prefix",
        "b.",
        "--check-scenario-index",
      ]),
    Error,
    "--branch-prefix cannot be combined",
  );
});

Deno.test("fixture transition builders keep repeated asset and branch shapes explicit", () => {
  const fileOperation = fileOperationTransition(
    99,
    "99-custom-assets",
    "98-before-custom-assets",
    {
      description: "Apply custom assets.",
      sources: [
        fixtureAssetSource(
          "content/example.ttl",
          "default transition-scoped asset path",
        ),
        fixtureAssetSource(
          "content/explicit.ttl",
          "explicit shared asset path",
          { assetPath: "shared/explicit.ttl" },
        ),
      ],
    },
    "fixture.customAssets",
    { branchPrefix: "z." },
  );

  assertEquals(fileOperation.fromRef, "z.98-before-custom-assets");
  assertEquals(fileOperation.toRef, "z.99-custom-assets");
  assertEquals(fileOperation.operationId, "fixture.customAssets");
  assertEquals(fileOperation.action.kind, "fileOperation");
  if (fileOperation.action.kind !== "fileOperation") {
    throw new Error("expected file operation action");
  }
  assertEquals(fileOperation.action.sources, [
    {
      path: "content/example.ttl",
      assetPath: "99-custom-assets/content/example.ttl",
      provenance: "default transition-scoped asset path",
    },
    {
      path: "content/explicit.ttl",
      assetPath: "shared/explicit.ttl",
      provenance: "explicit shared asset path",
    },
  ]);

  const command = commandTransition(
    100,
    "100-command",
    "99-custom-assets",
    "weave",
    { branchPrefix: "z." },
  );
  assertEquals(command.fromRef, "z.99-custom-assets");
  assertEquals(command.toRef, "z.100-command");
  assertEquals(command.action.kind, "command");

  const branchPublication = branchPublicationTransition(
    101,
    "101-publication",
    "10-source",
    {
      description: "Publish from a source lane.",
      publicationFromRef: "100-command",
      publicationBranch: "gh-pages",
    },
    "publication.sequence",
    { branchPrefix: "z." },
  );
  assertEquals(branchPublication.fromRef, "z.100-command");
  assertEquals(branchPublication.toRef, "z.101-publication");
  assertEquals(branchPublication.action.kind, "branchPublication");
  if (branchPublication.action.kind !== "branchPublication") {
    throw new Error("expected branch publication action");
  }
  assertEquals(branchPublication.action.sourceRef, "z.10-source");
  assertEquals(branchPublication.action.publicationFromRef, "z.100-command");
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
  assertEquals(plan.transitions.length, 27);
  assertEquals(plan.transitions[0]?.id, "01-source-only");
  assertEquals(plan.transitions[0]?.fromRef, "a.00-blank-slate");
  assertEquals(plan.transitions[24]?.id, "25-root-page-customized-woven");
  assertEquals(plan.transitions[24]?.fromRef, "a.24-root-page-customized");
  assertEquals(plan.transitions[25]?.id, "26-carol");
  assertEquals(
    plan.transitions[25]?.fromRef,
    "a.25-root-page-customized-woven",
  );
  assertEquals(plan.transitions[26]?.id, "27-carol-woven");
  assertEquals(plan.transitions[26]?.fromRef, "a.26-carol");

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
      "--publication-profile",
      "github-pages",
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

  const aliceBioImported = plan.transitions[13];
  assertEquals(aliceBioImported?.id, "14-alice-bio-imported");
  assertEquals(aliceBioImported?.operationId, "fixture.aliceBioImported");
  assertEquals(aliceBioImported?.action.kind, "command");
  if (aliceBioImported?.action.kind === "command") {
    assertEquals(
      aliceBioImported.action.inputs.map((source) => source.path),
      ["mesh-content/sidebar.md"],
    );
    assertEquals(aliceBioImported.action.invocations?.[1]?.argv, [
      "integrate",
      "mesh-content/sidebar.md",
      "--designator-path",
      "mesh-content/sidebar",
    ]);
  }

  const pageCustomized = plan.transitions[15];
  assertEquals(pageCustomized?.id, "16-alice-page-customized");
  assertEquals(pageCustomized?.operationId, "resourcePage.define");
  assertEquals(pageCustomized?.action.kind, "fileOperation");
  if (pageCustomized?.action.kind === "fileOperation") {
    assertEquals(
      pageCustomized.action.sources.map((source) => source.path),
      [
        "alice/_knop/_page/page.ttl",
        "alice/_knop/_assets/alice.css",
      ],
    );
    assertEquals(
      pageCustomized.action.sources[0]?.assetPath,
      "16-alice-page-customized/alice/_knop/_page/page.ttl",
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

  const faviconIntegrated = plan.transitions[17];
  assertEquals(faviconIntegrated?.id, "18-favicon-integrated");
  assertEquals(faviconIntegrated?.operationId, "integrate");
  assertEquals(faviconIntegrated?.action.kind, "command");
  if (faviconIntegrated?.action.kind === "command") {
    assertEquals(faviconIntegrated.action.argv, [
      "integrate",
      "favicon.ico",
      "--designator-path",
      "mesh-content/favicon",
    ]);
  }
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

Deno.test("planFixtureLadder applies a branch-prefix override", async () => {
  const plan = await planFixtureLadder({
    root: repoRoot,
    scenario: "alice-bio",
    format: "text",
    branchPrefix: "b.",
  });

  assertEquals(plan.scenario.branchPrefix, "b.");
  assertEquals(plan.transitions[0]?.fromRef, "b.00-blank-slate");
  assertEquals(plan.transitions[0]?.toRef, "b.01-source-only");
  assertEquals(plan.transitions[26]?.toRef, "b.27-carol-woven");

  const branchPlan = await planFixtureLadder({
    root: repoRoot,
    scenario: "branch-fantasy-rules",
    format: "text",
    branchPrefix: "c.",
  });
  const publication = branchPlan.transitions[1];
  assertEquals(publication?.fromRef, "c.01-source-only");
  assertEquals(publication?.toRef, "c.02-publication-bootstrapped-woven");
  assertEquals(publication?.action.kind, "branchPublication");
  if (publication?.action.kind === "branchPublication") {
    assertEquals(publication.action.sourceRef, "c.01-source-only");
    assertEquals(publication.action.publicationBranch, "gh-pages");
  }
});

Deno.test("planFixtureLadder exposes the Sidecar Fantasy Rules transition sequence", async () => {
  const plan = await planFixtureLadder({
    root: repoRoot,
    scenario: "sidecar-fantasy-rules",
    format: "text",
  });

  assertEquals(plan.writesBranches, false);
  assertEquals(
    plan.scenario.fixtureRepo,
    "github.com/semantic-flow/mesh-sidecar-fantasy-rules",
  );
  assertEquals(plan.scenario.branchPrefix, "a.");
  assertStringIncludes(plan.assetRoot, "mesh-sidecar-fantasy-rules/.assets");
  assertEquals(plan.transitions.length, 17);
  assertEquals(plan.transitions[0]?.id, "01-source-only");
  assertEquals(plan.transitions[0]?.fromRef, "a.00-blank-slate");
  assertEquals(plan.transitions[0]?.toRef, "a.01-source-only");
  assertEquals(plan.transitions[0]?.operationId, "fixture.seedSourceOnly");
  assertEquals(plan.transitions[0]?.action.kind, "fileOperation");
  if (plan.transitions[0]?.action.kind === "fileOperation") {
    assertEquals(
      plan.transitions[0].action.sources.map((source) => source.path),
      [
        "NOTICE.md",
        "ontology/fantasy-rules-ontology.ttl",
        "shacl/fantasy-rules-shacl.ttl",
        "examples/gunaar.ttl",
      ],
    );
  }

  assertEquals(plan.transitions[1]?.id, "02-sidecar-mesh-created");
  assertEquals(plan.transitions[1]?.fromRef, "a.01-source-only");
  assertEquals(plan.transitions[1]?.toRef, "a.02-sidecar-mesh-created");
  assertEquals(plan.transitions[1]?.operationId, "mesh.create");
  assertEquals(plan.transitions[1]?.action.kind, "command");
  if (plan.transitions[1]?.action.kind === "command") {
    assertEquals(plan.transitions[1].action.argv, [
      "mesh",
      "create",
      "--workspace",
      ".",
      "--mesh-root",
      "docs",
      "--mesh-base",
      "https://semantic-flow.github.io/mesh-sidecar-fantasy-rules/",
      "--publication-profile",
      "github-pages",
    ]);
  }

  assertEquals(plan.transitions[2]?.id, "03-sidecar-mesh-created-woven");
  assertEquals(plan.transitions[2]?.fromRef, "a.02-sidecar-mesh-created");
  assertEquals(plan.transitions[2]?.toRef, "a.03-sidecar-mesh-created-woven");
  assertEquals(plan.transitions[2]?.operationId, "weave");
  assertEquals(plan.transitions[2]?.action.kind, "command");
  if (plan.transitions[2]?.action.kind === "command") {
    assertEquals(plan.transitions[2].action.argv, [
      "--mesh-root",
      "docs",
    ]);
  }

  assertEquals(plan.transitions[3]?.id, "04-ontology-integrated");
  assertEquals(
    plan.transitions[3]?.fromRef,
    "a.03-sidecar-mesh-created-woven",
  );
  assertEquals(plan.transitions[3]?.toRef, "a.04-ontology-integrated");
  assertEquals(plan.transitions[3]?.operationId, "integrate");
  assertEquals(plan.transitions[3]?.action.kind, "command");
  if (plan.transitions[3]?.action.kind === "command") {
    assertEquals(plan.transitions[3].action.argv, [
      "integrate",
      "./ontology/fantasy-rules-ontology.ttl",
      "ontology",
      "--mesh-root",
      "docs",
      "--grant-source-directory",
      "ontology",
    ]);
  }

  assertEquals(plan.transitions[4]?.id, "05-ontology-integrated-woven");
  assertEquals(plan.transitions[4]?.fromRef, "a.04-ontology-integrated");
  assertEquals(plan.transitions[4]?.toRef, "a.05-ontology-integrated-woven");
  assertEquals(plan.transitions[4]?.operationId, "weave");
  assertEquals(plan.transitions[4]?.action.kind, "command");
  if (plan.transitions[4]?.action.kind === "command") {
    assertEquals(plan.transitions[4].action.argv, [
      "--mesh-root",
      "docs",
    ]);
  }

  assertEquals(plan.transitions[5]?.id, "06-shacl-integrated");
  assertEquals(
    plan.transitions[5]?.fromRef,
    "a.05-ontology-integrated-woven",
  );
  assertEquals(plan.transitions[5]?.toRef, "a.06-shacl-integrated");
  assertEquals(plan.transitions[5]?.operationId, "integrate");
  assertEquals(plan.transitions[5]?.action.kind, "command");
  if (plan.transitions[5]?.action.kind === "command") {
    assertEquals(plan.transitions[5].action.argv, [
      "integrate",
      "./shacl/fantasy-rules-shacl.ttl",
      "shacl",
      "--mesh-root",
      "docs",
      "--grant-source-directory",
      "shacl",
    ]);
  }

  assertEquals(plan.transitions[6]?.id, "07-shacl-integrated-woven");
  assertEquals(plan.transitions[6]?.fromRef, "a.06-shacl-integrated");
  assertEquals(plan.transitions[6]?.toRef, "a.07-shacl-integrated-woven");
  assertEquals(plan.transitions[6]?.operationId, "weave");
  assertEquals(plan.transitions[6]?.action.kind, "command");
  if (plan.transitions[6]?.action.kind === "command") {
    assertEquals(plan.transitions[6].action.argv, [
      "--mesh-root",
      "docs",
    ]);
  }

  assertEquals(
    plan.transitions[7]?.id,
    "08-ontology-and-shacl-terms-extracted",
  );
  assertEquals(
    plan.transitions[7]?.fromRef,
    "a.07-shacl-integrated-woven",
  );
  assertEquals(
    plan.transitions[7]?.toRef,
    "a.08-ontology-and-shacl-terms-extracted",
  );
  assertEquals(plan.transitions[7]?.operationId, "extract");
  assertEquals(plan.transitions[7]?.action.kind, "command");
  if (plan.transitions[7]?.action.kind === "command") {
    assertEquals(plan.transitions[7].action.invocations?.length, 5);
    assertEquals(plan.transitions[7].action.argv, [
      "extract",
      "ontology/AbilityScore",
      "--mesh-root",
      "docs",
      "--source",
      "ontology",
    ]);
    assertEquals(plan.transitions[7].action.invocations?.[4]?.argv, [
      "extract",
      "ontology/CharacterShape",
      "--mesh-root",
      "docs",
      "--source",
      "shacl",
    ]);
  }

  assertEquals(
    plan.transitions[8]?.id,
    "09-ontology-and-shacl-terms-extracted-woven",
  );
  assertEquals(
    plan.transitions[8]?.fromRef,
    "a.08-ontology-and-shacl-terms-extracted",
  );
  assertEquals(
    plan.transitions[8]?.toRef,
    "a.09-ontology-and-shacl-terms-extracted-woven",
  );
  assertEquals(plan.transitions[8]?.operationId, "weave");
  assertEquals(plan.transitions[8]?.action.kind, "command");
  if (plan.transitions[8]?.action.kind === "command") {
    assertEquals(plan.transitions[8].action.argv, [
      "--mesh-root",
      "docs",
      "--target",
      "designatorPath=ontology/AbilityScore",
      "--target",
      "designatorPath=ontology/Alignment",
      "--target",
      "designatorPath=ontology/Character",
      "--target",
      "designatorPath=ontology/PlayerCharacter",
      "--target",
      "designatorPath=ontology/CharacterShape",
    ]);
  }

  assertEquals(plan.transitions[9]?.id, "10-root-knop");
  assertEquals(
    plan.transitions[9]?.fromRef,
    "a.09-ontology-and-shacl-terms-extracted-woven",
  );
  assertEquals(plan.transitions[9]?.toRef, "a.10-root-knop");
  assertEquals(plan.transitions[9]?.operationId, "knop.create");
  assertEquals(plan.transitions[9]?.action.kind, "command");
  if (plan.transitions[9]?.action.kind === "command") {
    assertEquals(plan.transitions[9].action.invocations?.length, 2);
    assertEquals(plan.transitions[9].action.argv, [
      "knop",
      "create",
      "/",
      "--mesh-root",
      "docs",
    ]);
  }

  assertEquals(plan.transitions[13]?.id, "14-first-release");
  assertEquals(
    plan.transitions[13]?.fromRef,
    "a.13-gunaar-example-dataset-woven",
  );
  assertEquals(plan.transitions[13]?.toRef, "a.14-first-release");
  assertEquals(plan.transitions[13]?.operationId, "source.update");
  assertEquals(plan.transitions[13]?.action.kind, "fileOperation");

  assertEquals(plan.transitions[14]?.id, "15-first-release-woven");
  assertEquals(plan.transitions[14]?.fromRef, "a.14-first-release");
  assertEquals(plan.transitions[14]?.toRef, "a.15-first-release-woven");
  assertEquals(plan.transitions[14]?.operationId, "weave");
  assertEquals(plan.transitions[14]?.action.kind, "command");
  if (plan.transitions[14]?.action.kind === "command") {
    assertEquals(plan.transitions[14].action.argv, [
      "--mesh-root",
      "docs",
      "--payload-history-segment",
      "releases",
      "--payload-state-segment",
      "v0.0.2",
      "--payload-manifestation-segment",
      "ttl",
      "--target",
      "designatorPath=ontology",
      "--target",
      "designatorPath=shacl",
    ]);
  }

  assertEquals(plan.transitions[15]?.id, "16-all-remaining-terms-extracted");
  assertEquals(plan.transitions[15]?.fromRef, "a.15-first-release-woven");
  assertEquals(
    plan.transitions[15]?.toRef,
    "a.16-all-remaining-terms-extracted",
  );
  assertEquals(plan.transitions[15]?.operationId, "extract");
  assertEquals(plan.transitions[15]?.action.kind, "command");
  if (plan.transitions[15]?.action.kind === "command") {
    assertEquals(plan.transitions[15].action.invocations?.length, 3);
    assertEquals(plan.transitions[15].action.argv, [
      "extract",
      "--all-terms",
      "--accept-preview",
      "--source",
      "ontology",
      "--mesh-root",
      "docs",
    ]);
    assertEquals(plan.transitions[15].action.invocations?.[2]?.argv, [
      "extract",
      "--all-terms",
      "--accept-preview",
      "--source",
      "examples/gunaar",
      "--mesh-root",
      "docs",
    ]);
  }

  assertEquals(plan.transitions[16]?.id, "17-all-remaining-terms-woven");
  assertEquals(
    plan.transitions[16]?.fromRef,
    "a.16-all-remaining-terms-extracted",
  );
  assertEquals(plan.transitions[16]?.toRef, "a.17-all-remaining-terms-woven");
  assertEquals(plan.transitions[16]?.operationId, "weave");
  assertEquals(plan.transitions[16]?.action.kind, "command");
  if (plan.transitions[16]?.action.kind === "command") {
    const argv = plan.transitions[16].action.argv;
    assertEquals(argv.slice(0, 2), [
      "--mesh-root",
      "docs",
    ]);
    const targetSpecs = targetSpecsFromArgv(argv);
    assertEquals(targetSpecs.length, 61);
    assert(targetSpecs.includes(
      "designatorPath=examples/gunaar/ability-score/strength",
    ));
    assert(targetSpecs.includes("designatorPath=ontology/Ability"));
    assert(targetSpecs.includes("designatorPath=ontology/wizard"));
  }

  for (const transition of plan.transitions) {
    await Deno.stat(transition.manifestPath);
  }
});

Deno.test("planFixtureLadder exposes the Branch-Published Fantasy Rules source transition", async () => {
  const plan = await planFixtureLadder({
    root: repoRoot,
    scenario: "branch-fantasy-rules",
    format: "text",
  });

  assertEquals(plan.writesBranches, false);
  assertEquals(
    plan.scenario.fixtureRepo,
    "github.com/semantic-flow/mesh-branch-fantasy-rules",
  );
  assertEquals(plan.scenario.branchPrefix, "a.");
  assertStringIncludes(plan.assetRoot, "mesh-branch-fantasy-rules/.assets");
  assertEquals(plan.transitions.length, 15);
  assertEquals(plan.transitions[0]?.id, "01-source-only");
  assertEquals(plan.transitions[0]?.fromRef, "a.00-blank-slate");
  assertEquals(plan.transitions[0]?.toRef, "a.01-source-only");
  assertEquals(plan.transitions[0]?.operationId, "fixture.seedSourceOnly");
  assertEquals(plan.transitions[0]?.action.kind, "fileOperation");
  if (plan.transitions[0]?.action.kind === "fileOperation") {
    assertEquals(
      plan.transitions[0].action.sources.map((source) => source.path),
      [
        "NOTICE.md",
        "ontology/fantasy-rules-ontology.ttl",
        "shacl/fantasy-rules-shacl.ttl",
        "examples/gunaar.ttl",
      ],
    );
  }
  assertEquals(plan.transitions[1]?.id, "02-publication-bootstrapped-woven");
  assertEquals(plan.transitions[1]?.fromRef, "a.01-source-only");
  assertEquals(
    plan.transitions[1]?.toRef,
    "a.02-publication-bootstrapped-woven",
  );
  assertEquals(plan.transitions[1]?.operationId, "publication.sequence");
  assertEquals(plan.transitions[1]?.action.kind, "branchPublication");
  if (plan.transitions[1]?.action.kind === "branchPublication") {
    assertEquals(plan.transitions[1].action.sourceRef, "a.01-source-only");
    assertEquals(plan.transitions[1].action.publicationFromRef, undefined);
    assertEquals(plan.transitions[1].action.publicationBranch, "gh-pages");
    assertEquals(plan.transitions[1].action.invocations.length, 2);
    assertEquals(plan.transitions[1].action.invocations[0]?.argv, [
      "mesh",
      "create",
      "--workspace",
      ".",
      "--mesh-root",
      "{publicationRoot}",
      "--mesh-base",
      "https://semantic-flow.github.io/mesh-branch-fantasy-rules/",
      "--publication-profile",
      "github-pages",
    ]);
    assertEquals(plan.transitions[1].action.invocations[1]?.argv, [
      "--mesh-root",
      "{publicationRoot}",
    ]);
  }
  assertEquals(plan.transitions[2]?.id, "03-ontology-integrated-woven");
  assertEquals(
    plan.transitions[2]?.fromRef,
    "a.02-publication-bootstrapped-woven",
  );
  assertEquals(plan.transitions[2]?.toRef, "a.03-ontology-integrated-woven");
  assertEquals(plan.transitions[2]?.operationId, "publication.sequence");
  assertEquals(plan.transitions[2]?.action.kind, "branchPublication");
  if (plan.transitions[2]?.action.kind === "branchPublication") {
    assertEquals(plan.transitions[2].action.sourceRef, "a.01-source-only");
    assertEquals(
      plan.transitions[2].action.publicationFromRef,
      "a.02-publication-bootstrapped-woven",
    );
    assertEquals(plan.transitions[2].action.publicationBranch, "gh-pages");
    assertEquals(plan.transitions[2].action.invocations.length, 2);
    assertEquals(plan.transitions[2].action.invocations[0]?.argv, [
      "integrate",
      "{sourceRoot}/ontology/fantasy-rules-ontology.ttl",
      "ontology",
      "--mesh-root",
      "{publicationRoot}",
      "--grant-source-directory",
      "{sourceRoot}",
    ]);
    assertEquals(plan.transitions[2].action.invocations[1]?.argv, [
      "--mesh-root",
      "{publicationRoot}",
      "--target",
      "designatorPath=ontology",
    ]);
  }
  assertEquals(plan.transitions[3]?.id, "04-shacl-integrated-woven");
  assertEquals(plan.transitions[3]?.fromRef, "a.03-ontology-integrated-woven");
  assertEquals(plan.transitions[3]?.toRef, "a.04-shacl-integrated-woven");
  assertEquals(plan.transitions[3]?.operationId, "publication.sequence");
  assertEquals(plan.transitions[3]?.action.kind, "branchPublication");
  if (plan.transitions[3]?.action.kind === "branchPublication") {
    assertEquals(plan.transitions[3].action.sourceRef, "a.01-source-only");
    assertEquals(
      plan.transitions[3].action.publicationFromRef,
      "a.03-ontology-integrated-woven",
    );
    assertEquals(plan.transitions[3].action.publicationBranch, "gh-pages");
    assertEquals(plan.transitions[3].action.invocations.length, 2);
    assertEquals(plan.transitions[3].action.invocations[0]?.argv, [
      "integrate",
      "{sourceRoot}/shacl/fantasy-rules-shacl.ttl",
      "shacl",
      "--mesh-root",
      "{publicationRoot}",
      "--grant-source-directory",
      "{sourceRoot}",
    ]);
    assertEquals(plan.transitions[3].action.invocations[1]?.argv, [
      "--mesh-root",
      "{publicationRoot}",
      "--target",
      "designatorPath=shacl",
    ]);
  }
  assertEquals(
    plan.transitions[4]?.id,
    "05-ontology-and-shacl-terms-extracted",
  );
  assertEquals(plan.transitions[4]?.fromRef, "a.04-shacl-integrated-woven");
  assertEquals(
    plan.transitions[4]?.toRef,
    "a.05-ontology-and-shacl-terms-extracted",
  );
  assertEquals(plan.transitions[4]?.operationId, "extract");
  assertEquals(plan.transitions[4]?.action.kind, "branchPublication");
  if (plan.transitions[4]?.action.kind === "branchPublication") {
    assertEquals(plan.transitions[4].action.sourceRef, "a.01-source-only");
    assertEquals(
      plan.transitions[4].action.publicationFromRef,
      "a.04-shacl-integrated-woven",
    );
    assertEquals(plan.transitions[4].action.publicationBranch, "gh-pages");
    assertEquals(plan.transitions[4].action.invocations.length, 5);
    assertEquals(plan.transitions[4].action.invocations[0]?.argv, [
      "extract",
      "ontology/AbilityScore",
      "--mesh-root",
      "{publicationRoot}",
      "--source",
      "ontology",
    ]);
    assertEquals(plan.transitions[4].action.invocations[4]?.argv, [
      "extract",
      "ontology/CharacterShape",
      "--mesh-root",
      "{publicationRoot}",
      "--source",
      "shacl",
    ]);
  }
  assertEquals(
    plan.transitions[5]?.id,
    "06-ontology-and-shacl-terms-extracted-woven",
  );
  assertEquals(
    plan.transitions[5]?.fromRef,
    "a.05-ontology-and-shacl-terms-extracted",
  );
  assertEquals(
    plan.transitions[5]?.toRef,
    "a.06-ontology-and-shacl-terms-extracted-woven",
  );
  assertEquals(plan.transitions[5]?.operationId, "weave");
  assertEquals(plan.transitions[5]?.action.kind, "branchPublication");
  if (plan.transitions[5]?.action.kind === "branchPublication") {
    assertEquals(plan.transitions[5].action.sourceRef, "a.01-source-only");
    assertEquals(
      plan.transitions[5].action.publicationFromRef,
      "a.05-ontology-and-shacl-terms-extracted",
    );
    assertEquals(plan.transitions[5].action.publicationBranch, "gh-pages");
    assertEquals(plan.transitions[5].action.invocations.length, 1);
    assertEquals(plan.transitions[5].action.invocations[0]?.argv, [
      "--mesh-root",
      "{publicationRoot}",
      "--target",
      "designatorPath=ontology/AbilityScore",
      "--target",
      "designatorPath=ontology/Alignment",
      "--target",
      "designatorPath=ontology/Character",
      "--target",
      "designatorPath=ontology/PlayerCharacter",
      "--target",
      "designatorPath=ontology/CharacterShape",
    ]);
  }
  assertEquals(plan.transitions[6]?.id, "07-root-and-examples-knops");
  assertEquals(
    plan.transitions[6]?.fromRef,
    "a.06-ontology-and-shacl-terms-extracted-woven",
  );
  assertEquals(plan.transitions[6]?.toRef, "a.07-root-and-examples-knops");
  assertEquals(plan.transitions[6]?.operationId, "knop.create");
  assertEquals(plan.transitions[6]?.action.kind, "branchPublication");
  if (plan.transitions[6]?.action.kind === "branchPublication") {
    assertEquals(plan.transitions[6].action.sourceRef, "a.01-source-only");
    assertEquals(
      plan.transitions[6].action.publicationFromRef,
      "a.06-ontology-and-shacl-terms-extracted-woven",
    );
    assertEquals(plan.transitions[6].action.invocations.length, 2);
    assertEquals(plan.transitions[6].action.invocations[0]?.argv, [
      "knop",
      "create",
      "/",
      "--mesh-root",
      "{publicationRoot}",
    ]);
    assertEquals(plan.transitions[6].action.invocations[1]?.argv, [
      "knop",
      "create",
      "examples",
      "--mesh-root",
      "{publicationRoot}",
    ]);
  }
  assertEquals(plan.transitions[7]?.id, "08-root-and-examples-knops-woven");
  assertEquals(plan.transitions[7]?.fromRef, "a.07-root-and-examples-knops");
  assertEquals(
    plan.transitions[7]?.toRef,
    "a.08-root-and-examples-knops-woven",
  );
  assertEquals(plan.transitions[7]?.operationId, "weave");
  assertEquals(plan.transitions[7]?.action.kind, "branchPublication");
  if (plan.transitions[7]?.action.kind === "branchPublication") {
    assertEquals(plan.transitions[7].action.sourceRef, "a.01-source-only");
    assertEquals(
      plan.transitions[7].action.publicationFromRef,
      "a.07-root-and-examples-knops",
    );
    assertEquals(plan.transitions[7].action.invocations.length, 1);
    assertEquals(plan.transitions[7].action.invocations[0]?.argv, [
      "--mesh-root",
      "{publicationRoot}",
      "--target",
      "designatorPath=/",
      "--target",
      "designatorPath=examples",
    ]);
  }
  assertEquals(plan.transitions[8]?.id, "09-gunaar-example-dataset-woven");
  assertEquals(
    plan.transitions[8]?.fromRef,
    "a.08-root-and-examples-knops-woven",
  );
  assertEquals(plan.transitions[8]?.toRef, "a.09-gunaar-example-dataset-woven");
  assertEquals(plan.transitions[8]?.operationId, "publication.sequence");
  assertEquals(plan.transitions[8]?.action.kind, "branchPublication");
  if (plan.transitions[8]?.action.kind === "branchPublication") {
    assertEquals(plan.transitions[8].action.sourceRef, "a.01-source-only");
    assertEquals(
      plan.transitions[8].action.publicationFromRef,
      "a.08-root-and-examples-knops-woven",
    );
    assertEquals(plan.transitions[8].action.invocations.length, 2);
    assertEquals(plan.transitions[8].action.invocations[0]?.argv, [
      "integrate",
      "{sourceRoot}/examples/gunaar.ttl",
      "examples/gunaar",
      "--mesh-root",
      "{publicationRoot}",
      "--grant-source-directory",
      "{sourceRoot}",
    ]);
    assertEquals(plan.transitions[8].action.invocations[1]?.argv, [
      "--mesh-root",
      "{publicationRoot}",
      "--target",
      "designatorPath=examples/gunaar",
    ]);
  }
  assertEquals(plan.transitions[9]?.id, "10-first-release-source");
  assertEquals(plan.transitions[9]?.fromRef, "a.01-source-only");
  assertEquals(plan.transitions[9]?.toRef, "a.10-first-release-source");
  assertEquals(plan.transitions[9]?.operationId, "source.update");
  assertEquals(plan.transitions[9]?.action.kind, "fileOperation");
  if (plan.transitions[9]?.action.kind === "fileOperation") {
    assertEquals(
      plan.transitions[9].action.sources.map((source) => source.assetPath),
      [
        "14-first-release/ontology/fantasy-rules-ontology.ttl",
        "14-first-release/shacl/fantasy-rules-shacl.ttl",
        "14-first-release/examples/gunaar.ttl",
      ],
    );
  }
  assertEquals(plan.transitions[10]?.id, "11-first-release-woven");
  assertEquals(
    plan.transitions[10]?.fromRef,
    "a.09-gunaar-example-dataset-woven",
  );
  assertEquals(plan.transitions[10]?.toRef, "a.11-first-release-woven");
  assertEquals(plan.transitions[10]?.operationId, "weave");
  assertEquals(plan.transitions[10]?.action.kind, "branchPublication");
  if (plan.transitions[10]?.action.kind === "branchPublication") {
    assertEquals(
      plan.transitions[10].action.sourceRef,
      "a.10-first-release-source",
    );
    assertEquals(
      plan.transitions[10].action.publicationFromRef,
      "a.09-gunaar-example-dataset-woven",
    );
    assertEquals(plan.transitions[10].action.invocations.length, 2);
    assertEquals(plan.transitions[10].action.invocations[0]?.argv, [
      "--mesh-root",
      "{publicationRoot}",
      "--payload-history-segment",
      "releases",
      "--payload-state-segment",
      "v0.0.2",
      "--payload-manifestation-segment",
      "ttl",
      "--target",
      "designatorPath=ontology",
      "--target",
      "designatorPath=shacl",
    ]);
    assertEquals(plan.transitions[10].action.invocations[1]?.argv, [
      "--mesh-root",
      "{publicationRoot}",
      "--target",
      "designatorPath=examples/gunaar",
    ]);
  }
  assertEquals(
    plan.transitions[11]?.id,
    "12-all-remaining-terms-extracted",
  );
  assertEquals(plan.transitions[11]?.fromRef, "a.11-first-release-woven");
  assertEquals(
    plan.transitions[11]?.toRef,
    "a.12-all-remaining-terms-extracted",
  );
  assertEquals(plan.transitions[11]?.operationId, "extract");
  assertEquals(plan.transitions[11]?.action.kind, "branchPublication");
  if (plan.transitions[11]?.action.kind === "branchPublication") {
    assertEquals(
      plan.transitions[11].action.sourceRef,
      "a.10-first-release-source",
    );
    assertEquals(
      plan.transitions[11].action.publicationFromRef,
      "a.11-first-release-woven",
    );
    assertEquals(plan.transitions[11].action.invocations.length, 3);
    assertEquals(plan.transitions[11].action.invocations[0]?.argv, [
      "extract",
      "--all-terms",
      "--accept-preview",
      "--source",
      "ontology",
      "--mesh-root",
      "{publicationRoot}",
    ]);
    assertEquals(plan.transitions[11].action.invocations[2]?.argv, [
      "extract",
      "--all-terms",
      "--accept-preview",
      "--source",
      "examples/gunaar",
      "--mesh-root",
      "{publicationRoot}",
    ]);
  }
  assertEquals(plan.transitions[12]?.id, "13-all-remaining-terms-woven");
  assertEquals(
    plan.transitions[12]?.fromRef,
    "a.12-all-remaining-terms-extracted",
  );
  assertEquals(plan.transitions[12]?.toRef, "a.13-all-remaining-terms-woven");
  assertEquals(plan.transitions[12]?.operationId, "weave");
  assertEquals(plan.transitions[12]?.action.kind, "branchPublication");
  if (plan.transitions[12]?.action.kind === "branchPublication") {
    assertEquals(
      plan.transitions[12].action.sourceRef,
      "a.10-first-release-source",
    );
    assertEquals(
      plan.transitions[12].action.publicationFromRef,
      "a.12-all-remaining-terms-extracted",
    );
    assertEquals(plan.transitions[12].action.invocations.length, 1);
    const argv = plan.transitions[12].action.invocations[0]?.argv ?? [];
    assertEquals(argv.slice(0, 2), [
      "--mesh-root",
      "{publicationRoot}",
    ]);
    const targetSpecs = targetSpecsFromArgv(argv);
    assertEquals(targetSpecs.length, 62);
    assert(targetSpecs.includes(
      "designatorPath=examples/gunaar/alignment-history/2016-10-30T03-14-00-04-00",
    ));
    assert(targetSpecs.includes(
      "designatorPath=examples/gunaar/ability-score/strength",
    ));
    assert(targetSpecs.includes("designatorPath=ontology/Ability"));
    assert(targetSpecs.includes("designatorPath=ontology/wizard"));
  }
  assertEquals(plan.transitions[13]?.id, "14-extracted-term-references");
  assertEquals(
    plan.transitions[13]?.fromRef,
    "a.13-all-remaining-terms-woven",
  );
  assertEquals(
    plan.transitions[13]?.toRef,
    "a.14-extracted-term-references",
  );
  assertEquals(plan.transitions[13]?.operationId, "knop.addReference");
  assertEquals(plan.transitions[13]?.action.kind, "branchPublication");
  if (plan.transitions[13]?.action.kind === "branchPublication") {
    assertEquals(
      plan.transitions[13].action.sourceRef,
      "a.10-first-release-source",
    );
    assertEquals(
      plan.transitions[13].action.publicationFromRef,
      "a.13-all-remaining-terms-woven",
    );
    assertEquals(plan.transitions[13].action.invocations.length, 3);
    assertEquals(plan.transitions[13].action.invocations[0]?.argv, [
      "knop",
      "add-reference",
      "ontology/Ability",
      "--reference-target-designator-path",
      "ontology",
      "--reference-role",
      "Canonical",
      "--mesh-root",
      "{publicationRoot}",
    ]);
    assertEquals(plan.transitions[13].action.invocations[1]?.argv, [
      "knop",
      "add-reference",
      "ontology/CharacterShape",
      "--reference-target-designator-path",
      "shacl",
      "--reference-role",
      "Canonical",
      "--mesh-root",
      "{publicationRoot}",
    ]);
    assertEquals(plan.transitions[13].action.invocations[2]?.argv, [
      "knop",
      "add-reference",
      "examples/gunaar/ability-score/strength",
      "--reference-target-designator-path",
      "examples/gunaar",
      "--reference-role",
      "Canonical",
      "--mesh-root",
      "{publicationRoot}",
    ]);
  }
  assertEquals(
    plan.transitions[14]?.id,
    "15-extracted-term-references-woven",
  );
  assertEquals(
    plan.transitions[14]?.fromRef,
    "a.14-extracted-term-references",
  );
  assertEquals(
    plan.transitions[14]?.toRef,
    "a.15-extracted-term-references-woven",
  );
  assertEquals(plan.transitions[14]?.operationId, "weave");
  assertEquals(plan.transitions[14]?.action.kind, "branchPublication");
  if (plan.transitions[14]?.action.kind === "branchPublication") {
    assertEquals(
      plan.transitions[14].action.sourceRef,
      "a.10-first-release-source",
    );
    assertEquals(
      plan.transitions[14].action.publicationFromRef,
      "a.14-extracted-term-references",
    );
    assertEquals(plan.transitions[14].action.invocations.length, 1);
    assertEquals(plan.transitions[14].action.invocations[0]?.argv, [
      "--mesh-root",
      "{publicationRoot}",
      "--target",
      "designatorPath=examples/gunaar/ability-score/strength",
      "--target",
      "designatorPath=ontology/Ability",
      "--target",
      "designatorPath=ontology/CharacterShape",
    ]);
  }

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
  const assetPaths = fixtureAssetPathsForPlan(plan);

  assertEquals(assetPaths, [
    "01-source-only/alice-data.ttl",
    "10-alice-bio-updated/alice-data-v2.ttl",
    "14-alice-bio-imported/mesh-content/sidebar.md",
    "16-alice-page-customized/alice/_knop/_assets/alice.css",
    "16-alice-page-customized/alice/_knop/_page/page.ttl",
    "18-favicon-integrated/favicon.ico",
    "24-root-page-customized/_knop/_assets/site.css",
    "24-root-page-customized/_knop/_page/page.ttl",
    "24-root-page-customized/home.md",
    "26-carol/carol-data.ttl",
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

Deno.test("Sidecar Fantasy Rules source-only transition points at checked-in deterministic assets", async () => {
  const plan = await planFixtureLadder({
    root: repoRoot,
    scenario: "sidecar-fantasy-rules",
    format: "text",
  });
  const assetPaths = fixtureAssetPathsForPlan(plan);

  assertEquals(assetPaths, [
    "01-source-only/NOTICE.md",
    "01-source-only/examples/gunaar.ttl",
    "01-source-only/ontology/fantasy-rules-ontology.ttl",
    "01-source-only/shacl/fantasy-rules-shacl.ttl",
    "14-first-release/ontology/fantasy-rules-ontology.ttl",
    "14-first-release/shacl/fantasy-rules-shacl.ttl",
  ]);

  for (const assetPath of assetPaths) {
    await Deno.stat(`${plan.assetRoot}/${assetPath}`);
  }
});

Deno.test("Branch-Published Fantasy Rules source-only transition points at checked-in deterministic assets", async () => {
  const plan = await planFixtureLadder({
    root: repoRoot,
    scenario: "branch-fantasy-rules",
    format: "text",
  });
  const assetPaths = fixtureAssetPathsForPlan(plan);

  assertEquals(assetPaths, [
    "01-source-only/NOTICE.md",
    "01-source-only/examples/gunaar.ttl",
    "01-source-only/ontology/fantasy-rules-ontology.ttl",
    "01-source-only/shacl/fantasy-rules-shacl.ttl",
    "14-first-release/examples/gunaar.ttl",
    "14-first-release/ontology/fantasy-rules-ontology.ttl",
    "14-first-release/shacl/fantasy-rules-shacl.ttl",
  ]);

  for (const assetPath of assetPaths) {
    await readMeshBranchFantasyRulesBranchFile("main", `.assets/${assetPath}`);
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
  assertStringIncludes(rendered, "Transitions: 27");
  assertStringIncludes(
    rendered,
    "2. 02-mesh-created: a.01-source-only -> a.02-mesh-created",
  );
  assertStringIncludes(
    rendered,
    "command: weave mesh create --workspace . --mesh-base https://semantic-flow.github.io/mesh-alice-bio/ --publication-profile github-pages",
  );
  assertStringIncludes(
    rendered,
    "command: weave --history-tracking-policy versioned",
  );
  assertStringIncludes(
    rendered,
    "command 1: weave import https://raw.githubusercontent.com/djradon/public-notes/db9a48933f0e6b208baeab7190cef75d1194634f/user.alice-ghostley.md alice/bio --working-file alice-bio.md --expected-digest sha256:0fcd9fe25c5598686557806cfdacc9c765176f315f780fa96644c3f251b49137",
  );
  assertStringIncludes(
    rendered,
    "command 2: weave integrate mesh-content/sidebar.md --designator-path mesh-content/sidebar",
  );
  assertStringIncludes(
    rendered,
    "file operation: Apply the hand-authored Alice page definition backed by governed content artifacts",
  );
  assertStringIncludes(
    rendered,
    "source: alice/_knop/_page/page.ttl <= .assets/16-alice-page-customized/alice/_knop/_page/page.ttl",
  );
  assertStringIncludes(
    rendered,
    "inventory patch: alice/_knop/_inventory/inventory.ttl registers alice/_knop/_page",
  );
  assertStringIncludes(
    rendered,
    "input: alice-data-v2.ttl <= .assets/10-alice-bio-updated/alice-data-v2.ttl",
  );
  assertStringIncludes(
    rendered,
    "guardrail: generated MeshInventory progression lives on _mesh/_meta",
  );
});

Deno.test("renderFixtureScenarioIndexDocument renders stable fixture topology", () => {
  const aliceIndex = renderFixtureScenarioIndexDocument(
    ALICE_BIO_FIXTURE_SCENARIO,
  );
  assertEquals(aliceIndex.type, "ScenarioIndex");
  assertEquals(
    aliceIndex.defaultFixtureRepo,
    ALICE_BIO_FIXTURE_SCENARIO.fixtureRepo,
  );
  assertEquals(aliceIndex.hasStateLane?.map((lane) => lane.laneKey), [
    "fixture",
  ]);
  assertEquals(aliceIndex.hasStep?.length, 27);
  assertEquals(aliceIndex.hasStep?.[0]?.manifestPath, "01-source-only.jsonld");
  assertEquals(
    aliceIndex.hasStep?.[0]?.hasLaneBinding?.[0]?.fromLaneState?.ref,
    "a.00-blank-slate",
  );
  assertEquals(
    aliceIndex.hasStep?.[0]?.hasLaneBinding?.[0]?.toLaneState?.ref,
    "a.01-source-only",
  );

  const branchIndex = renderFixtureScenarioIndexDocument(
    BRANCH_FANTASY_RULES_FIXTURE_SCENARIO,
  );
  assertEquals(branchIndex.hasStateLane?.map((lane) => lane.laneKey), [
    "source",
    "publication",
  ]);

  const bootstrapStep = branchIndex.hasStep?.find((step) =>
    step.id === "#02-publication-bootstrapped-woven"
  );
  const bootstrapPublicationBinding = bootstrapStep?.hasLaneBinding?.find((
    binding,
  ) => binding.lane === "#publication-lane");
  assertEquals(bootstrapPublicationBinding?.fromLaneState, undefined);
  assertEquals(
    bootstrapPublicationBinding?.toLaneState?.ref,
    "a.02-publication-bootstrapped-woven",
  );

  const firstReleaseSourceStep = branchIndex.hasStep?.find((step) =>
    step.id === "#10-first-release-source"
  );
  assertEquals(firstReleaseSourceStep?.hasLaneBinding?.length, 1);
  assertEquals(
    firstReleaseSourceStep?.hasLaneBinding?.[0]?.lane,
    "#source-lane",
  );
  assertEquals(
    firstReleaseSourceStep?.hasLaneBinding?.[0]?.fromLaneState?.ref,
    "a.01-source-only",
  );
  assertEquals(
    firstReleaseSourceStep?.hasLaneBinding?.[0]?.toLaneState?.ref,
    "a.10-first-release-source",
  );
});

Deno.test("checked-in fixture scenario indexes validate and match generated output", async () => {
  for (
    const scenario of [
      "alice-bio",
      "sidecar-fantasy-rules",
      "branch-fantasy-rules",
    ] as const
  ) {
    const result = await checkFixtureScenarioIndex({
      root: repoRoot,
      scenario,
    });

    assertEquals(result.valid, true);
    assertEquals(result.matchesGenerated, true);
    await Deno.stat(result.scenarioIndexPath);
  }
});

Deno.test("Alice Bio fixture scenario has sequential transition indexes", () => {
  assertEquals(
    ALICE_BIO_FIXTURE_SCENARIO.transitions.map((transition) =>
      transition.index
    ),
    Array.from({ length: 27 }, (_, index) => index + 1),
  );
});

Deno.test("Sidecar Fantasy Rules fixture scenario has sequential transition indexes", () => {
  assertEquals(
    SIDECAR_FANTASY_RULES_FIXTURE_SCENARIO.transitions.map((transition) =>
      transition.index
    ),
    Array.from(
      { length: SIDECAR_FANTASY_RULES_FIXTURE_SCENARIO.transitions.length },
      (_, index) => index + 1,
    ),
  );
});

Deno.test("Branch-Published Fantasy Rules fixture scenario has sequential transition indexes", () => {
  assertEquals(
    BRANCH_FANTASY_RULES_FIXTURE_SCENARIO.transitions.map((transition) =>
      transition.index
    ),
    Array.from(
      { length: BRANCH_FANTASY_RULES_FIXTURE_SCENARIO.transitions.length },
      (_, index) => index + 1,
    ),
  );
});

Deno.test("seedFixtureSourceBranch creates a prefixed 00 rung from seed paths only", async () => {
  const { root, workspaceRoot, fixtureRepoPath } =
    await setupSourceOnlyFileOperationFixture({
      createTargetRef: false,
    });
  await Deno.writeTextFile(
    `${fixtureRepoPath}/generated-output.txt`,
    "latest generated output\n",
  );
  await runTestGit(fixtureRepoPath, ["add", "."]);
  await runTestGit(fixtureRepoPath, [
    "-c",
    "user.name=Test",
    "-c",
    "user.email=test@example.invalid",
    "commit",
    "-m",
    "latest generated fixture",
  ]);

  const result = await seedFixtureSourceBranch({
    root,
    scenario: "alice-bio",
    seedSourceRef: "HEAD",
    branchPrefix: "b.",
    workspaceRoot,
  });

  assertEquals(result.sourceRef, "HEAD");
  assertEquals(result.targetRef, "b.00-blank-slate");
  assertEquals(result.branchUpdate.updated, true);
  assertEquals(
    result.materializedPaths.includes(".assets/01-source-only/alice-data.ttl"),
    true,
  );
  assertEquals(
    result.materializedPaths.includes("generated-output.txt"),
    false,
  );
  assertEquals(
    await gitOutput(fixtureRepoPath, [
      "show",
      "b.00-blank-slate:.assets/01-source-only/alice-data.ttl",
    ]),
    "fixture source\n",
  );
  assertEquals(
    await gitSucceeds(fixtureRepoPath, [
      "show",
      "b.00-blank-slate:generated-output.txt",
    ]),
    false,
  );
});

Deno.test("renderFixtureSourceSeedResult prints seed source and target branch", async () => {
  const { root, workspaceRoot } = await setupSourceOnlyFileOperationFixture({
    createTargetRef: false,
  });
  const result = await seedFixtureSourceBranch({
    root,
    scenario: "alice-bio",
    seedSourceRef: "HEAD",
    branchPrefix: "b.",
    workspaceRoot,
    dryRun: true,
  });

  const rendered = renderFixtureSourceSeedResult(result);
  assertStringIncludes(rendered, "Fixture source seed prepared: Alice Bio");
  assertStringIncludes(rendered, "Source ref: HEAD");
  assertStringIncludes(rendered, "Target ref: b.00-blank-slate");
  assertStringIncludes(rendered, "Branch writes: disabled");
  assertStringIncludes(rendered, "- .assets/01-source-only/alice-data.ttl");
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
  assertEquals(result.materializedPaths.includes("alice-data.ttl"), true);
  assertStringIncludes(
    await Deno.readTextFile(`${workspaceRoot}/alice-data.ttl`),
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
  assertStringIncludes(rendered, "- alice-data.ttl");
  assertStringIncludes(
    rendered,
    "Next command: weave mesh create --workspace . --mesh-base https://semantic-flow.github.io/mesh-alice-bio/ --publication-profile github-pages",
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
    "01-source-only/alice-data.ttl",
  );
  assertEquals(
    result.fileOperation.files[0]?.contentDigest,
    "sha256:7cefb9aa217c81555befc729d7fa5d70dbc83bfe20d91eaac7e8af9aee481432",
  );
  assertEquals(
    await Deno.readTextFile(`${workspaceRoot}/alice-data.ttl`),
    "fixture source\n",
  );
  assertEquals(result.validation.status, "pass");
  assertEquals(result.branchUpdate.updated, false);
  if (result.branchUpdate.updated) {
    throw new Error("dry-run file operation should not update a branch");
  }
  assertEquals(result.branchUpdate.reason, "dry run requested");
});

Deno.test("executeFixtureTransition rejects file-operation digest drift", async () => {
  const { root, workspaceRoot } = await setupSourceOnlyFileOperationFixture({
    createTargetRef: true,
  });

  await Deno.writeTextFile(
    `${root}/dependencies/github.com/semantic-flow/mesh-alice-bio/.assets/01-source-only/alice-data.ttl`,
    "tampered fixture source\n",
  );

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
  assertEquals(result.fileOperation.success, false);
  assertEquals(result.fileOperation.files.length, 0);
  assertEquals(result.fileOperation.digestMismatches.length, 1);
  assertEquals(
    result.fileOperation.digestMismatches[0]?.expectedDigest,
    "sha256:7cefb9aa217c81555befc729d7fa5d70dbc83bfe20d91eaac7e8af9aee481432",
  );
  await assertRejects(
    () => Deno.readTextFile(`${workspaceRoot}/alice-data.ttl`),
    Deno.errors.NotFound,
  );
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
      "a.01-source-only:alice-data.ttl",
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
    "Command: deno run --allow-read --allow-write --allow-run=git --allow-env",
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
  await Deno.writeTextFile(`${fixtureRepoPath}/alice-data.ttl`, "old\n");
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

  await Deno.writeTextFile(`${workspaceRoot}/alice-data.ttl`, "new\n");
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
      "a.02-mesh-created:alice-data.ttl",
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

Deno.test("evaluateGeneratedOutputGuardrails catches sidecar mesh inventory-owned progression", async () => {
  const workspaceRoot = await Deno.makeTempDir({
    prefix: "weave-fixture-ladder-sidecar-guardrail-",
  });
  await Deno.mkdir(
    `${workspaceRoot}/docs/_mesh/_inventory/_history001/_s0001`,
    { recursive: true },
  );
  await Deno.writeTextFile(
    `${workspaceRoot}/docs/_mesh/_inventory/inventory.ttl`,
    `@prefix sflo: <https://semantic-flow.github.io/sflo/ontology/> .

<_mesh/_inventory> a sflo:MeshInventory ;
  sflo:currentArtifactHistory <_mesh/_inventory/_history001> .
`,
  );
  await Deno.writeTextFile(
    `${workspaceRoot}/docs/_mesh/_inventory/_history001/_s0001/inventory.ttl`,
    `@prefix sflo: <https://semantic-flow.github.io/sflo/ontology/> .

<_mesh/_inventory/_history001/_s0001> a sflo:HistoricalState .
`,
  );

  const checks = await evaluateGeneratedOutputGuardrails(workspaceRoot);

  assert(
    checks.some((check) =>
      check.status === "fail" &&
      check.path === "docs/_mesh/_inventory/inventory.ttl" &&
      check.message.includes("docs/_mesh/_meta/meta.ttl")
    ),
  );
  assert(
    checks.some((check) =>
      check.status === "fail" &&
      check.path === "docs/_mesh/_meta/meta.ttl"
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
    `${assetRoot}/01-source-only/alice-data.ttl`,
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
      `${fixtureRepoPath}/alice-data.ttl`,
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
        `if (Deno.args.join(" ") !== "mesh create --workspace . --mesh-base https://semantic-flow.github.io/mesh-alice-bio/ --publication-profile github-pages") {`,
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
          "@vocab": "https://spectacular-voyage.github.io/accord/ontology/",
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
            hasReplayProfile: {
              type: "ReplayProfile",
              workspaceRoot: ".",
              hasFileOperation: [
                {
                  type: "FileOperation",
                  operationKind: "copyFile",
                  targetPath: "alice-data.ttl",
                  hasSourceProvenance: {
                    type: "SourceProvenance",
                    sourceKind: "fixtureAsset",
                    sourcePath: "01-source-only/alice-data.ttl",
                    contentDigest:
                      "sha256:7cefb9aa217c81555befc729d7fa5d70dbc83bfe20d91eaac7e8af9aee481432",
                    derivationNote: "manifest-declared source fixture",
                  },
                },
              ],
            },
            hasFileExpectation: [
              {
                id: "#source",
                type: "FileExpectation",
                path: "alice-data.ttl",
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
          "@vocab": "https://spectacular-voyage.github.io/accord/ontology/",
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
                  "--publication-profile",
                  "github-pages",
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
