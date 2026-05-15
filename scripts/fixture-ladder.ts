import { dirname, isAbsolute, join, relative, resolve } from "@std/path";
import * as pathPosix from "@std/path/posix";
import {
  compareBytes,
} from "../dependencies/github.com/spectacular-voyage/accord/src/checker/compare_bytes.ts";
import {
  compareRdfContent,
  RdfCompareError,
} from "../dependencies/github.com/spectacular-voyage/accord/src/checker/compare_rdf.ts";
import {
  compareTextContents,
  TextDecodeError,
} from "../dependencies/github.com/spectacular-voyage/accord/src/checker/compare_text.ts";
import {
  evaluatePresenceExpectation,
} from "../dependencies/github.com/spectacular-voyage/accord/src/checker/file_expectations.ts";
import type {
  FileChangeType,
} from "../dependencies/github.com/spectacular-voyage/accord/src/checker/file_expectations.ts";
import {
  runAskAssertion,
  SparqlAskError,
} from "../dependencies/github.com/spectacular-voyage/accord/src/checker/sparql.ts";
import {
  readManifestSource,
} from "../dependencies/github.com/spectacular-voyage/accord/src/manifest/load_jsonld.ts";
import type {
  CommandInvocation,
  FileExpectation,
  InputMaterialization,
  RdfExpectation,
  ReplayProfile,
  SourceProvenance,
  SparqlAskAssertion,
  TransitionCase,
} from "../dependencies/github.com/spectacular-voyage/accord/src/manifest/model.ts";
import {
  selectTransitionCase,
} from "../dependencies/github.com/spectacular-voyage/accord/src/manifest/select_case.ts";
import {
  CHECK_CODES,
} from "../dependencies/github.com/spectacular-voyage/accord/src/report/codes.ts";
import {
  countCheckStatuses,
  deriveReportStatus,
} from "../dependencies/github.com/spectacular-voyage/accord/src/report/json_report.ts";
import type {
  CheckRecord,
  JsonReport,
} from "../dependencies/github.com/spectacular-voyage/accord/src/report/json_report.ts";
import {
  renderTextReport,
} from "../dependencies/github.com/spectacular-voyage/accord/src/report/text_report.ts";

export type FixtureScenarioId = "alice-bio";
export type FixturePlanFormat = "text" | "json";

export interface FixtureLadderOptions {
  root: string;
  scenario: FixtureScenarioId;
  format: FixturePlanFormat;
  materializeTransitionId?: string;
  executeTransitionId?: string;
  dryRun?: boolean;
  workspaceRoot?: string;
}

export interface FixtureLadderPlan {
  scenario: FixtureLadderScenario;
  root: string;
  fixtureRepoPath: string;
  manifestRoot: string;
  assetRoot: string;
  transitions: readonly FixtureTransitionPlan[];
  writesBranches: false;
}

export interface MaterializeFixtureTransitionOptions {
  root: string;
  scenario: FixtureScenarioId;
  transitionId: string;
  workspaceRoot?: string;
}

export interface ExecuteFixtureTransitionOptions {
  root: string;
  scenario: FixtureScenarioId;
  transitionId: string;
  workspaceRoot?: string;
  dryRun?: boolean;
}

export interface FixtureMaterializationResult {
  scenario: FixtureScenarioId;
  transitionId: string;
  fromRef: string;
  toRef: string;
  operationId: string;
  fixtureRepoPath: string;
  manifestPath: string;
  assetRoot: string;
  workspaceRoot: string;
  materializedPaths: readonly string[];
  writesBranches: false;
  nextAction: FixtureTransitionAction;
}

export interface FixtureCommandExecutionResult {
  kind: "command";
  command: readonly string[];
  cwd: string;
  success: boolean;
  code: number;
  stdout: string;
  stderr: string;
}

export interface FixtureFileOperationAppliedFile {
  path: string;
  assetPath: string;
  provenance: string;
  bytes: number;
}

export interface FixtureFileOperationMissingAsset {
  path: string;
  assetPath: string;
  absolutePath: string;
}

export interface FixtureFileOperationExecutionResult {
  kind: "fileOperation";
  description: string;
  success: boolean;
  files: readonly FixtureFileOperationAppliedFile[];
  missingAssets: readonly FixtureFileOperationMissingAsset[];
}

export type FixtureTransitionOperationResult =
  | FixtureCommandExecutionResult
  | FixtureFileOperationExecutionResult;

interface FixtureExecutionBase {
  scenario: FixtureScenarioId;
  transitionId: string;
  fromRef: string;
  toRef: string;
  operationId: string;
  fixtureRepoPath: string;
  manifestPath: string;
  assetRoot: string;
  workspaceRoot: string;
  materializedPaths: readonly string[];
  operation: FixtureTransitionOperationResult;
  validation: JsonReport;
  writesBranches: boolean;
  branchUpdate: FixtureBranchUpdateResult;
}

export type FixtureExecutionResult =
  | FixtureCommandTransitionExecutionResult
  | FixtureFileOperationTransitionExecutionResult;

export interface FixtureCommandTransitionExecutionResult
  extends FixtureExecutionBase {
  actionKind: "command";
  operation: FixtureCommandExecutionResult;
  command: FixtureCommandExecutionResult;
  fileOperation?: undefined;
}

export interface FixtureFileOperationTransitionExecutionResult
  extends FixtureExecutionBase {
  actionKind: "fileOperation";
  operation: FixtureFileOperationExecutionResult;
  command?: undefined;
  fileOperation: FixtureFileOperationExecutionResult;
}

export interface UpdateFixtureBranchOptions {
  fixtureRepoPath: string;
  workspaceRoot: string;
  targetRef: string;
  parentRef?: string;
  message: string;
}

export type FixtureBranchUpdateResult =
  | {
    dryRun: true;
    updated: false;
    targetRef: string;
    branchRef: string;
    localOnly: true;
    reason: string;
  }
  | {
    dryRun: false;
    updated: false;
    targetRef: string;
    branchRef: string;
    localOnly: true;
    reason: string;
  }
  | {
    dryRun: false;
    updated: true;
    targetRef: string;
    branchRef: string;
    localOnly: true;
    commitSha: string;
    treeSha: string;
    parentRef?: string;
    parentSha?: string;
    pushed: false;
  };

export interface FixtureLadderScenario {
  id: FixtureScenarioId;
  label: string;
  fixtureRepo: string;
  fixtureRepoRelativePath: string;
  manifestRootRelativePath: string;
  assetRootRelativePath?: string;
  branchPrefix: string;
  transitions: readonly FixtureTransitionDefinition[];
}

export interface FixtureTransitionDefinition {
  index: number;
  id: string;
  fromRef: string;
  toRef: string;
  manifestName: string;
  operationId: string;
  action: FixtureTransitionAction;
  validation: FixtureTransitionValidation;
}

export interface FixtureTransitionPlan extends FixtureTransitionDefinition {
  manifestPath: string;
}

export type FixtureTransitionAction =
  | FixtureCommandAction
  | FixtureFileOperationAction;

export interface FixtureCommandAction {
  kind: "command";
  executable: "weave";
  argv: readonly string[];
  inputs: readonly FixtureFileOperationSource[];
  cwd: "workspace";
  promptPolicy: "nonInteractive";
  expectedRuntimeLogs: boolean;
}

export interface FixtureFileOperationAction {
  kind: "fileOperation";
  description: string;
  sources: readonly FixtureFileOperationSource[];
  inventoryPatches: readonly FixtureInventoryPatch[];
}

export interface FixtureFileOperationSource {
  path: string;
  assetPath: string;
  provenance: string;
}

interface FixtureFileOperationSourceInput {
  path: string;
  assetPath?: string;
  provenance: string;
}

export type FixtureInventoryPatch = FixtureResourcePageDefinitionInventoryPatch;

export interface FixtureResourcePageDefinitionInventoryPatch {
  kind: "resourcePageDefinition";
  inventoryPath: string;
  knopPath: string;
  pageDefinitionPath: string;
  pageDefinitionFilePath: string;
  assetBundlePath?: string;
  provenance: string;
}

interface FixtureResourcePageDefinitionInventoryPatchInput {
  kind: "resourcePageDefinition";
  designatorPath: string;
  hasAssetBundle?: boolean;
  provenance: string;
}

export interface FixtureTransitionValidation {
  accordManifest: true;
  comparison: "manifestScoped";
  guardrails: readonly string[];
}

const CANONICAL_OUTPUT_GUARDRAILS = [
  "generated RDF uses the canonical sflo namespace",
  "generated MeshInventory progression lives on _mesh/_meta",
] as const;
const FIXTURE_ASSET_ROOT_BASENAME = ".assets";
const ALICE_BIO_LADDER_BRANCH_PREFIX = "a.";

const ALICE_BIO_FIXTURE_REPO = "github.com/semantic-flow/mesh-alice-bio";
const ALICE_BIO_FIXTURE_REPO_RELATIVE_PATH = join(
  "dependencies",
  "github.com",
  "semantic-flow",
  "mesh-alice-bio",
);
const ALICE_BIO_MANIFEST_ROOT_RELATIVE_PATH = join(
  "dependencies",
  "github.com",
  "semantic-flow",
  "semantic-flow-framework",
  "examples",
  "alice-bio",
  "conformance",
);
const FIXTURE_GENERATED_AT = "2026-05-03T00:00:00.000Z";
const CANONICAL_SFLO_NAMESPACE =
  "https://semantic-flow.github.io/sflo/ontology/";
const OLD_SFLO_NAMESPACE =
  "https://semantic-flow.github.io/semantic-flow-ontology/";
const MESH_INVENTORY_HISTORY_PREFIX = "_mesh/_inventory/_history";
const RDF_OUTPUT_EXTENSIONS = [
  ".ttl",
  ".jsonld",
  ".nt",
  ".nq",
  ".trig",
] as const;

export const ALICE_BIO_FIXTURE_SCENARIO: FixtureLadderScenario = {
  id: "alice-bio",
  label: "Alice Bio",
  fixtureRepo: ALICE_BIO_FIXTURE_REPO,
  fixtureRepoRelativePath: ALICE_BIO_FIXTURE_REPO_RELATIVE_PATH,
  manifestRootRelativePath: ALICE_BIO_MANIFEST_ROOT_RELATIVE_PATH,
  branchPrefix: ALICE_BIO_LADDER_BRANCH_PREFIX,
  transitions: [
    fileTransition(1, "01-source-only", "00-blank-slate", {
      description: "Seed the source-only Alice Bio fixture branch.",
      sources: [
        {
          path: "alice-bio.ttl",
          provenance:
            "fixture-authored source RDF carried from the existing Alice Bio source-only fixture",
        },
      ],
    }),
    commandTransition(2, "02-mesh-created", "01-source-only", "mesh.create"),
    commandTransition(
      3,
      "03-mesh-created-woven",
      "02-mesh-created",
      "weave",
    ),
    commandTransition(
      4,
      "04-alice-knop-created",
      "03-mesh-created-woven",
      "knop.create",
    ),
    commandTransition(
      5,
      "05-alice-knop-created-woven",
      "04-alice-knop-created",
      "weave",
    ),
    commandTransition(
      6,
      "06-alice-bio-integrated",
      "05-alice-knop-created-woven",
      "integrate",
    ),
    commandTransition(
      7,
      "07-alice-bio-integrated-woven",
      "06-alice-bio-integrated",
      "weave",
    ),
    commandTransition(
      8,
      "08-alice-bio-referenced",
      "07-alice-bio-integrated-woven",
      "knop.addReference",
    ),
    commandTransition(
      9,
      "09-alice-bio-referenced-woven",
      "08-alice-bio-referenced",
      "weave",
    ),
    commandTransition(
      10,
      "10-alice-bio-updated",
      "09-alice-bio-referenced-woven",
      "payload.update",
    ),
    commandTransition(
      11,
      "11-alice-bio-v2-woven",
      "10-alice-bio-updated",
      "weave",
    ),
    commandTransition(
      12,
      "12-bob-extracted",
      "11-alice-bio-v2-woven",
      "extract",
    ),
    commandTransition(
      13,
      "13-bob-extracted-woven",
      "12-bob-extracted",
      "weave",
    ),
    fileTransition(14, "14-alice-page-customized", "13-bob-extracted-woven", {
      description:
        "Apply the hand-authored Alice page definition and local page assets.",
      sources: [
        {
          path: "alice/_knop/_page/page.ttl",
          provenance:
            "fixture-authored canonical page definition adapted from the Alice Bio main branch page bytes",
        },
        {
          path: "alice/alice.md",
          provenance:
            "fixture-authored Markdown copied from the Alice Bio main branch source bytes",
        },
        {
          path: "mesh-content/sidebar.md",
          provenance:
            "fixture-authored sidebar Markdown copied from the Alice Bio main branch source bytes",
        },
        {
          path: "alice/_knop/_assets/alice.css",
          provenance:
            "fixture-authored stylesheet copied from the Alice Bio main branch source bytes",
        },
      ],
      inventoryPatches: [
        {
          kind: "resourcePageDefinition",
          designatorPath: "alice",
          hasAssetBundle: true,
          provenance:
            "register Alice's ResourcePageDefinition and KnopAssetBundle against the current generated Alice KnopInventory",
        },
      ],
    }, "resourcePage.define"),
    commandTransition(
      15,
      "15-alice-page-customized-woven",
      "14-alice-page-customized",
      "weave",
    ),
    commandTransition(
      16,
      "16-alice-page-main-integrated",
      "15-alice-page-customized-woven",
      "integrate",
    ),
    commandTransition(
      17,
      "17-alice-page-main-integrated-woven",
      "16-alice-page-main-integrated",
      "weave",
    ),
    fileTransition(
      18,
      "18-alice-page-artifact-source",
      "17-alice-page-main-integrated-woven",
      {
        description:
          "Repoint Alice's page definition to the governed page-main artifact.",
        sources: [
          {
            path: "alice/_knop/_page/page.ttl",
            provenance:
              "fixture-authored canonical page definition adapted from the Alice Bio main branch artifact-backed page bytes",
          },
        ],
      },
      "resourcePage.define",
    ),
    commandTransition(
      19,
      "19-alice-page-artifact-source-woven",
      "18-alice-page-artifact-source",
      "weave",
    ),
    fileTransition(
      20,
      "20-bob-page-imported-source",
      "19-alice-page-artifact-source-woven",
      {
        description:
          "Import Bob page Markdown from the pinned outside-origin source fixture.",
        sources: [
          {
            path: "bob-page-main.md",
            provenance:
              "checked-in bytes copied from the Alice Bio main branch's imported Markdown source; original outside-origin URL was https://raw.githubusercontent.com/djradon/public-notes/refs/heads/main/user.bob-newhart.md",
          },
          {
            path: "bob/_knop/_page/page.ttl",
            provenance:
              "fixture-authored canonical page definition adapted from the Alice Bio main branch Bob page bytes",
          },
        ],
        inventoryPatches: [
          {
            kind: "resourcePageDefinition",
            designatorPath: "bob",
            provenance:
              "register Bob's ResourcePageDefinition against the current generated Bob KnopInventory",
          },
        ],
      },
      "import",
    ),
    commandTransition(
      21,
      "21-bob-page-imported-source-woven",
      "20-bob-page-imported-source",
      "weave",
    ),
    commandTransition(
      22,
      "22-root-knop-created",
      "21-bob-page-imported-source-woven",
      "knop.create",
    ),
    commandTransition(
      23,
      "23-root-knop-created-woven",
      "22-root-knop-created",
      "weave",
    ),
    fileTransition(
      24,
      "24-root-page-customized",
      "23-root-knop-created-woven",
      {
        description:
          "Apply the hand-authored root page definition and local page assets.",
        sources: [
          {
            path: "_knop/_page/page.ttl",
            provenance:
              "fixture-authored canonical page definition adapted from the Alice Bio main branch root page bytes",
          },
          {
            path: "home.md",
            provenance:
              "fixture-authored root Markdown copied from the Alice Bio main branch source bytes",
          },
          {
            path: "mesh-content/root-sidebar.md",
            provenance:
              "fixture-authored root sidebar Markdown copied from the Alice Bio main branch source bytes",
          },
          {
            path: "_knop/_assets/site.css",
            provenance:
              "fixture-authored root stylesheet copied from the Alice Bio main branch source bytes",
          },
        ],
        inventoryPatches: [
          {
            kind: "resourcePageDefinition",
            designatorPath: "",
            hasAssetBundle: true,
            provenance:
              "register the root ResourcePageDefinition and KnopAssetBundle against the current generated root KnopInventory",
          },
        ],
      },
      "resourcePage.define",
    ),
    commandTransition(
      25,
      "25-root-page-customized-woven",
      "24-root-page-customized",
      "weave",
    ),
  ],
};

if (import.meta.main) {
  try {
    const options = parseFixtureLadderArgs(Deno.args);
    if (options.executeTransitionId !== undefined) {
      const result = await executeFixtureTransition({
        root: options.root,
        scenario: options.scenario,
        transitionId: options.executeTransitionId,
        workspaceRoot: options.workspaceRoot,
        dryRun: options.dryRun ?? false,
      });
      console.log(
        options.format === "json"
          ? JSON.stringify(result, null, 2)
          : renderFixtureExecutionResult(result),
      );
      if (
        !result.operation.success ||
        (!result.branchUpdate.updated && result.validation.status !== "pass")
      ) {
        Deno.exit(1);
      }
    } else if (options.materializeTransitionId !== undefined) {
      const result = await materializeFixtureTransitionSource({
        root: options.root,
        scenario: options.scenario,
        transitionId: options.materializeTransitionId,
        workspaceRoot: options.workspaceRoot,
      });
      console.log(
        options.format === "json"
          ? JSON.stringify(result, null, 2)
          : renderFixtureMaterializationResult(result),
      );
    } else {
      const plan = await planFixtureLadder(options);
      console.log(
        options.format === "json"
          ? JSON.stringify(plan, null, 2)
          : renderFixtureLadderPlan(plan),
      );
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    Deno.exit(1);
  }
}

export function parseFixtureLadderArgs(
  args: readonly string[],
): FixtureLadderOptions {
  let root = Deno.cwd();
  let scenario: FixtureScenarioId = "alice-bio";
  let format: FixturePlanFormat = "text";
  let materializeTransitionId: string | undefined;
  let executeTransitionId: string | undefined;
  let dryRun = false;
  let workspaceRoot: string | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    switch (arg) {
      case "--":
        break;
      case "--root":
        index += 1;
        root = requireArgumentValue(args[index], "--root");
        break;
      case "--scenario":
        index += 1;
        scenario = parseScenarioId(
          requireArgumentValue(args[index], "--scenario"),
        );
        break;
      case "--format":
        index += 1;
        format = parsePlanFormat(
          requireArgumentValue(args[index], "--format"),
        );
        break;
      case "--materialize":
        index += 1;
        materializeTransitionId = requireArgumentValue(
          args[index],
          "--materialize",
        );
        break;
      case "--execute":
        index += 1;
        executeTransitionId = requireArgumentValue(args[index], "--execute");
        break;
      case "--workspace-root":
        index += 1;
        workspaceRoot = requireArgumentValue(args[index], "--workspace-root");
        break;
      case "--json":
        format = "json";
        break;
      case "--dry-run":
        dryRun = true;
        break;
      default:
        if (arg.startsWith("--root=")) {
          root = requireArgumentValue(arg.slice("--root=".length), "--root");
          break;
        }
        if (arg.startsWith("--scenario=")) {
          scenario = parseScenarioId(
            requireArgumentValue(
              arg.slice("--scenario=".length),
              "--scenario",
            ),
          );
          break;
        }
        if (arg.startsWith("--format=")) {
          format = parsePlanFormat(
            requireArgumentValue(arg.slice("--format=".length), "--format"),
          );
          break;
        }
        if (arg.startsWith("--materialize=")) {
          materializeTransitionId = requireArgumentValue(
            arg.slice("--materialize=".length),
            "--materialize",
          );
          break;
        }
        if (arg.startsWith("--execute=")) {
          executeTransitionId = requireArgumentValue(
            arg.slice("--execute=".length),
            "--execute",
          );
          break;
        }
        if (arg.startsWith("--workspace-root=")) {
          workspaceRoot = requireArgumentValue(
            arg.slice("--workspace-root=".length),
            "--workspace-root",
          );
          break;
        }
        throw new Error(`Unsupported fixture:ladder argument: ${arg}`);
    }
  }

  if (
    materializeTransitionId !== undefined && executeTransitionId !== undefined
  ) {
    throw new Error(
      "fixture:ladder accepts only one of --materialize or --execute",
    );
  }

  if (
    workspaceRoot !== undefined && materializeTransitionId === undefined &&
    executeTransitionId === undefined
  ) {
    throw new Error(
      "fixture:ladder --workspace-root requires --materialize or --execute",
    );
  }

  return {
    root: resolve(root),
    scenario,
    format,
    ...(dryRun ? { dryRun } : {}),
    ...(materializeTransitionId !== undefined
      ? { materializeTransitionId }
      : {}),
    ...(executeTransitionId !== undefined ? { executeTransitionId } : {}),
    ...(workspaceRoot !== undefined
      ? { workspaceRoot: resolve(workspaceRoot) }
      : {}),
  };
}

export async function planFixtureLadder(
  options: FixtureLadderOptions,
): Promise<FixtureLadderPlan> {
  const scenario = resolveFixtureScenario(options.scenario);
  const root = resolve(options.root);
  const manifestRoot = join(root, scenario.manifestRootRelativePath);
  const assetRoot = join(
    root,
    scenario.assetRootRelativePath ??
      join(scenario.fixtureRepoRelativePath, FIXTURE_ASSET_ROOT_BASENAME),
  );

  const transitions = await Promise.all(
    scenario.transitions.map((transition) =>
      hydrateFixtureTransitionPlan({
        transition,
        manifestPath: join(manifestRoot, transition.manifestName),
      })
    ),
  );

  return {
    scenario,
    root,
    fixtureRepoPath: join(root, scenario.fixtureRepoRelativePath),
    manifestRoot,
    assetRoot,
    transitions,
    writesBranches: false,
  };
}

export function renderFixtureLadderPlan(plan: FixtureLadderPlan): string {
  const lines = [
    `Fixture ladder dry run: ${plan.scenario.label}`,
    `Fixture repository: ${plan.scenario.fixtureRepo}`,
    `Fixture repository path: ${plan.fixtureRepoPath}`,
    `Manifest root: ${plan.manifestRoot}`,
    `Asset root: ${plan.assetRoot}`,
    "Branch writes: disabled",
    `Transitions: ${plan.transitions.length}`,
  ];

  for (const transition of plan.transitions) {
    lines.push("");
    lines.push(
      `${transition.index}. ${transition.id}: ${transition.fromRef} -> ${transition.toRef}`,
    );
    lines.push(`   operation: ${transition.operationId}`);
    lines.push(
      `   manifest: ${relative(plan.root, transition.manifestPath)}`,
    );
    if (transition.action.kind === "command") {
      lines.push(
        `   command: ${
          [
            transition.action.executable,
            ...transition.action.argv,
          ].join(" ")
        }`,
      );
      lines.push(`   cwd: ${transition.action.cwd}`);
      lines.push(`   prompts: ${transition.action.promptPolicy}`);
      lines.push(
        `   runtime logs: ${transition.action.expectedRuntimeLogs}`,
      );
      for (const input of transition.action.inputs) {
        lines.push(
          `   input: ${input.path} <= ${
            formatFixtureAssetPath(input)
          } (${input.provenance})`,
        );
      }
    } else {
      lines.push(`   file operation: ${transition.action.description}`);
      for (const source of transition.action.sources) {
        lines.push(
          `   source: ${source.path} <= ${
            formatFixtureAssetPath(source)
          } (${source.provenance})`,
        );
      }
      for (const patch of transition.action.inventoryPatches) {
        lines.push(
          `   inventory patch: ${patch.inventoryPath} registers ${patch.pageDefinitionPath} (${patch.provenance})`,
        );
      }
    }
    lines.push(
      `   validation: ${transition.validation.comparison} via Accord manifest`,
    );
    for (const guardrail of transition.validation.guardrails) {
      lines.push(`   guardrail: ${guardrail}`);
    }
  }

  return lines.join("\n");
}

export async function materializeFixtureTransitionSource(
  options: MaterializeFixtureTransitionOptions,
): Promise<FixtureMaterializationResult> {
  const plan = await planFixtureLadder({
    root: options.root,
    scenario: options.scenario,
    format: "text",
  });
  const transition = findFixtureTransitionPlan(plan, options.transitionId);

  const workspaceRoot = options.workspaceRoot === undefined
    ? await Deno.makeTempDir({ prefix: "weave-fixture-ladder-" })
    : resolve(options.workspaceRoot);
  await ensureEmptyWorkspaceRoot(workspaceRoot);

  const resolvedRef = await resolveGitCommitishIfExists(
    plan.fixtureRepoPath,
    transition.fromRef,
  );
  if (resolvedRef === undefined) {
    throw unresolvedFixtureRefError(plan.fixtureRepoPath, transition.fromRef);
  }

  const materializedPaths = await materializeGitTree({
    repoPath: plan.fixtureRepoPath,
    ref: resolvedRef,
    workspaceRoot,
  });

  return {
    scenario: plan.scenario.id,
    transitionId: transition.id,
    fromRef: transition.fromRef,
    toRef: transition.toRef,
    operationId: transition.operationId,
    fixtureRepoPath: plan.fixtureRepoPath,
    manifestPath: transition.manifestPath,
    assetRoot: plan.assetRoot,
    workspaceRoot,
    materializedPaths,
    writesBranches: false,
    nextAction: transition.action,
  };
}

export async function executeFixtureTransition(
  options: ExecuteFixtureTransitionOptions,
): Promise<FixtureExecutionResult> {
  const plan = await planFixtureLadder({
    root: options.root,
    scenario: options.scenario,
    format: "text",
  });
  const transition = findFixtureTransitionPlan(plan, options.transitionId);

  const materialization = await materializeFixtureTransitionSource(options);
  const operation = transition.action.kind === "command"
    ? await runFixtureCommand({
      assetRoot: plan.assetRoot,
      root: plan.root,
      workspaceRoot: materialization.workspaceRoot,
      action: transition.action,
    })
    : await applyFixtureFileOperation({
      assetRoot: plan.assetRoot,
      workspaceRoot: materialization.workspaceRoot,
      action: transition.action,
    });
  const validation = await validateFixtureTransitionWorkspace({
    fixtureRepoPath: plan.fixtureRepoPath,
    manifestPath: transition.manifestPath,
    workspaceRoot: materialization.workspaceRoot,
    fallbackFromRef: transition.fromRef,
    fallbackToRef: transition.toRef,
  });
  const branchUpdate = await maybeUpdateFixtureBranch({
    fixtureRepoPath: plan.fixtureRepoPath,
    workspaceRoot: materialization.workspaceRoot,
    targetRef: transition.toRef,
    parentRef: transition.fromRef,
    dryRun: options.dryRun ?? false,
    operation,
    validation,
    message: `Regenerate fixture branch ${transition.toRef}`,
  });

  const base = {
    scenario: materialization.scenario,
    transitionId: materialization.transitionId,
    fromRef: materialization.fromRef,
    toRef: materialization.toRef,
    operationId: materialization.operationId,
    fixtureRepoPath: materialization.fixtureRepoPath,
    manifestPath: materialization.manifestPath,
    assetRoot: materialization.assetRoot,
    workspaceRoot: materialization.workspaceRoot,
    materializedPaths: materialization.materializedPaths,
    operation,
    validation,
    writesBranches: branchUpdate.updated,
    branchUpdate,
  };

  if (operation.kind === "command") {
    return {
      ...base,
      actionKind: "command",
      operation,
      command: operation,
    };
  }

  return {
    ...base,
    actionKind: "fileOperation",
    operation,
    fileOperation: operation,
  };
}

export function renderFixtureMaterializationResult(
  result: FixtureMaterializationResult,
): string {
  const lines = [
    `Fixture source materialized: ${result.scenario}`,
    `Transition: ${result.transitionId}`,
    `Source ref: ${result.fromRef}`,
    `Target ref: ${result.toRef}`,
    `Asset root: ${result.assetRoot}`,
    `Workspace root: ${result.workspaceRoot}`,
    "Branch writes: disabled",
    `Files materialized: ${result.materializedPaths.length}`,
  ];
  for (const path of result.materializedPaths) {
    lines.push(`- ${path}`);
  }
  if (result.nextAction.kind === "command") {
    lines.push(
      `Next command: ${
        [result.nextAction.executable, ...result.nextAction.argv].join(" ")
      }`,
    );
  } else {
    lines.push(`Next file operation: ${result.nextAction.description}`);
  }
  return lines.join("\n");
}

export function renderFixtureExecutionResult(
  result: FixtureExecutionResult,
): string {
  const lines = [
    `Fixture transition executed: ${result.scenario}`,
    `Transition: ${result.transitionId}`,
    `Source ref: ${result.fromRef}`,
    `Target ref: ${result.toRef}`,
    `Asset root: ${result.assetRoot}`,
    `Workspace root: ${result.workspaceRoot}`,
    `Branch writes: ${result.branchUpdate.updated ? "enabled" : "disabled"}`,
  ];

  if (result.actionKind === "command") {
    lines.push(`Command: ${result.command.command.join(" ")}`);
    lines.push(`Command cwd: ${result.command.cwd}`);
    lines.push(`Command exit code: ${result.command.code}`);

    if (result.command.stdout.trim().length > 0) {
      lines.push("Command stdout:");
      lines.push(result.command.stdout.trimEnd());
    }

    if (result.command.stderr.trim().length > 0) {
      lines.push("Command stderr:");
      lines.push(result.command.stderr.trimEnd());
    }
  } else {
    lines.push(`File operation: ${result.fileOperation.description}`);
    lines.push(`File operation success: ${result.fileOperation.success}`);
    lines.push(`Files applied: ${result.fileOperation.files.length}`);
    for (const file of result.fileOperation.files) {
      lines.push(
        `- ${file.path} <= ${
          formatFixtureAssetPath(file)
        } (${file.bytes} bytes)`,
      );
    }
    if (result.fileOperation.missingAssets.length > 0) {
      lines.push("Missing assets:");
      for (const missing of result.fileOperation.missingAssets) {
        lines.push(
          `- ${missing.path} <= ${
            formatFixtureAssetPath(missing)
          } (${missing.absolutePath})`,
        );
      }
    }
  }

  lines.push("Validation:");
  lines.push(renderTextReport(result.validation));
  lines.push("Branch update:");
  if (result.branchUpdate.updated) {
    lines.push(
      `updated ${result.branchUpdate.branchRef} to ${result.branchUpdate.commitSha}`,
    );
    lines.push(
      `Push ${result.branchUpdate.targetRef} from ${result.fixtureRepoPath} separately for the regenerated fixture to leave this checkout.`,
    );
  } else {
    lines.push(`skipped: ${result.branchUpdate.reason}`);
  }
  return lines.join("\n");
}

function resolveFixtureScenario(id: FixtureScenarioId): FixtureLadderScenario {
  switch (id) {
    case "alice-bio":
      return ALICE_BIO_FIXTURE_SCENARIO;
  }
}

function findFixtureTransitionPlan(
  plan: FixtureLadderPlan,
  transitionId: string,
): FixtureTransitionPlan {
  const transition = plan.transitions.find((candidate) =>
    candidate.id === transitionId
  );
  if (transition === undefined) {
    throw new Error(
      `Unknown ${plan.scenario.label} transition: ${transitionId}`,
    );
  }
  return transition;
}

async function hydrateFixtureTransitionPlan(options: {
  transition: FixtureTransitionDefinition;
  manifestPath: string;
}): Promise<FixtureTransitionPlan> {
  const base = {
    ...options.transition,
    manifestPath: options.manifestPath,
  };

  if (options.transition.action.kind !== "command") {
    return base;
  }

  if (!await pathExists(options.manifestPath)) {
    return base;
  }

  const manifest = await readManifestSource(options.manifestPath);
  const transitionCase = selectTransitionCase(manifest.document);
  return {
    ...base,
    operationId: transitionCase.operationId ?? options.transition.operationId,
    action: hydrateCommandActionFromReplayProfile({
      transitionId: options.transition.id,
      manifestPath: options.manifestPath,
      replayProfile: transitionCase.hasReplayProfile,
    }),
  };
}

function hydrateCommandActionFromReplayProfile(options: {
  transitionId: string;
  manifestPath: string;
  replayProfile?: ReplayProfile;
}): FixtureCommandAction {
  const replayProfile = options.replayProfile;
  if (replayProfile === undefined) {
    throw new Error(
      `Manifest ${options.manifestPath} is missing hasReplayProfile for command transition ${options.transitionId}`,
    );
  }

  const invocation = replayProfile.hasCommandInvocation;
  if (invocation === undefined) {
    throw new Error(
      `Manifest ${options.manifestPath} is missing hasReplayProfile.hasCommandInvocation for command transition ${options.transitionId}`,
    );
  }

  validateReplayProfile(options.transitionId, replayProfile);
  validateCommandInvocation(options.transitionId, invocation);

  return {
    kind: "command",
    executable: "weave",
    argv: invocation.argv ?? [],
    inputs: resolveReplayInputMaterializations(
      options.transitionId,
      replayProfile?.hasInputMaterialization ?? [],
    ),
    cwd: "workspace",
    promptPolicy: "nonInteractive",
    expectedRuntimeLogs: invocation.expectsOperationalLogs === true ||
      invocation.expectsAuditLogs === true,
  };
}

function validateReplayProfile(
  transitionId: string,
  replayProfile: ReplayProfile,
): void {
  if (
    replayProfile.workspaceRoot !== undefined &&
    replayProfile.workspaceRoot !== "."
  ) {
    throw new Error(
      `Unsupported replay workspaceRoot for ${transitionId}: ${replayProfile.workspaceRoot}`,
    );
  }

  if (replayProfile.meshRoot !== undefined && replayProfile.meshRoot !== ".") {
    throw new Error(
      `Unsupported replay meshRoot for ${transitionId}: ${replayProfile.meshRoot}`,
    );
  }
}

function validateCommandInvocation(
  transitionId: string,
  invocation: CommandInvocation,
): void {
  if (invocation.executable !== "weave") {
    throw new Error(
      `Unsupported replay executable for ${transitionId}: ${invocation.executable}`,
    );
  }

  if (
    invocation.workingDirectory !== undefined &&
    invocation.workingDirectory !== "workspace"
  ) {
    throw new Error(
      `Unsupported replay workingDirectory for ${transitionId}: ${invocation.workingDirectory}`,
    );
  }

  if (
    invocation.promptPolicy !== undefined &&
    invocation.promptPolicy !== "nonInteractive"
  ) {
    throw new Error(
      `Unsupported replay promptPolicy for ${transitionId}: ${invocation.promptPolicy}`,
    );
  }

  if (
    invocation.expectedExitCode !== undefined &&
    invocation.expectedExitCode !== 0
  ) {
    throw new Error(
      `Unsupported replay expectedExitCode for ${transitionId}: ${invocation.expectedExitCode}`,
    );
  }

  if ((invocation.hasEnvironmentOverride ?? []).length > 0) {
    throw new Error(
      `Unsupported replay environment overrides for ${transitionId}`,
    );
  }
}

function resolveReplayInputMaterializations(
  transitionId: string,
  materializations: readonly InputMaterialization[],
): FixtureFileOperationSource[] {
  return materializations.map((materialization) => {
    if (materialization.targetPath === undefined) {
      throw new Error(
        `Replay input materialization for ${transitionId} is missing targetPath`,
      );
    }

    const targetPath = normalizeGitTreePath(materialization.targetPath);
    const provenance = materialization.hasSourceProvenance;
    const assetPath = provenance?.sourcePath === undefined
      ? pathPosix.join(transitionId, targetPath)
      : normalizeGitTreePath(provenance.sourcePath);

    return {
      path: targetPath,
      assetPath,
      provenance: describeSourceProvenance(provenance),
    };
  });
}

function describeSourceProvenance(provenance?: SourceProvenance): string {
  return provenance?.derivationNote ??
    provenance?.sourceUrl ??
    provenance?.sourceRef ??
    provenance?.sourceKind ??
    "manifest-declared fixture input";
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await Deno.stat(path);
    return true;
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      return false;
    }
    throw error;
  }
}

function commandTransition(
  index: number,
  id: string,
  fromRef: string,
  operationId: string,
  options: {
    branchPrefix?: string;
  } = {},
): FixtureTransitionDefinition {
  const branchPrefix = options.branchPrefix ?? ALICE_BIO_LADDER_BRANCH_PREFIX;
  return {
    index,
    id,
    fromRef: toLadderBranchRef(branchPrefix, fromRef),
    toRef: toLadderBranchRef(branchPrefix, id),
    manifestName: `${id}.jsonld`,
    operationId,
    action: {
      kind: "command",
      executable: "weave",
      argv: [],
      inputs: [],
      cwd: "workspace",
      promptPolicy: "nonInteractive",
      expectedRuntimeLogs: true,
    },
    validation: defaultValidation(),
  };
}

function fileTransition(
  index: number,
  id: string,
  fromRef: string,
  action: {
    description: string;
    sources: readonly FixtureFileOperationSourceInput[];
    inventoryPatches?:
      readonly FixtureResourcePageDefinitionInventoryPatchInput[];
  },
  operationId = "fixture.fileOperation",
): FixtureTransitionDefinition {
  const branchPrefix = ALICE_BIO_LADDER_BRANCH_PREFIX;
  return {
    index,
    id,
    fromRef: toLadderBranchRef(branchPrefix, fromRef),
    toRef: toLadderBranchRef(branchPrefix, id),
    manifestName: `${id}.jsonld`,
    operationId,
    action: {
      kind: "fileOperation",
      description: action.description,
      sources: resolveFixtureAssetSources(id, action.sources),
      inventoryPatches: (action.inventoryPatches ?? []).map(
        resolveResourcePageDefinitionInventoryPatch,
      ),
    },
    validation: defaultValidation(),
  };
}

function resolveFixtureAssetSources(
  transitionId: string,
  sources: readonly FixtureFileOperationSourceInput[],
): FixtureFileOperationSource[] {
  return sources.map((source) => ({
    path: source.path,
    assetPath: source.assetPath ??
      pathPosix.join(transitionId, normalizeGitTreePath(source.path)),
    provenance: source.provenance,
  }));
}

function resolveResourcePageDefinitionInventoryPatch(
  input: FixtureResourcePageDefinitionInventoryPatchInput,
): FixtureResourcePageDefinitionInventoryPatch {
  const knopPath = toKnopPath(input.designatorPath);
  const pageDefinitionPath = pathPosix.join(knopPath, "_page");
  return {
    kind: "resourcePageDefinition",
    inventoryPath: pathPosix.join(knopPath, "_inventory/inventory.ttl"),
    knopPath,
    pageDefinitionPath,
    pageDefinitionFilePath: pathPosix.join(pageDefinitionPath, "page.ttl"),
    ...(input.hasAssetBundle
      ? { assetBundlePath: pathPosix.join(knopPath, "_assets") }
      : {}),
    provenance: input.provenance,
  };
}

function toKnopPath(designatorPath: string): string {
  return designatorPath.length === 0
    ? "_knop"
    : pathPosix.join(normalizeGitTreePath(designatorPath), "_knop");
}

function toLadderBranchRef(branchPrefix: string, rungId: string): string {
  return `${branchPrefix}${rungId}`;
}

function formatFixtureAssetPath(options: { assetPath: string }): string {
  return pathPosix.join(FIXTURE_ASSET_ROOT_BASENAME, options.assetPath);
}

function defaultValidation(): FixtureTransitionValidation {
  return {
    accordManifest: true,
    comparison: "manifestScoped",
    guardrails: CANONICAL_OUTPUT_GUARDRAILS,
  };
}

async function runFixtureCommand(options: {
  assetRoot: string;
  root: string;
  workspaceRoot: string;
  action: FixtureCommandAction;
}): Promise<FixtureCommandExecutionResult> {
  if (options.action.executable !== "weave") {
    throw new Error(
      `Unsupported fixture command executable: ${options.action.executable}`,
    );
  }

  const command = [
    "deno",
    "run",
    "--allow-read",
    "--allow-write",
    "--allow-env",
    join(options.root, "src/main.ts"),
    ...options.action.argv,
  ];
  const stagedInputs = await stageFixtureAssetSources({
    assetRoot: options.assetRoot,
    workspaceRoot: options.workspaceRoot,
    sources: options.action.inputs,
  });
  if (stagedInputs.missingAssets.length > 0) {
    return {
      kind: "command",
      command,
      cwd: options.workspaceRoot,
      success: false,
      code: 1,
      stdout: "",
      stderr: stagedInputs.missingAssets.map((missing) =>
        `Missing fixture command input ${missing.path} from ${
          formatFixtureAssetPath(missing)
        } (${missing.absolutePath})`
      ).join("\n"),
    };
  }

  const output = await new Deno.Command("deno", {
    cwd: options.workspaceRoot,
    args: command.slice(1),
    env: {
      WEAVE_GENERATED_AT: FIXTURE_GENERATED_AT,
    },
    stdout: "piped",
    stderr: "piped",
  }).output();

  return {
    kind: "command",
    command,
    cwd: options.workspaceRoot,
    success: output.success,
    code: output.code,
    stdout: new TextDecoder().decode(output.stdout),
    stderr: new TextDecoder().decode(output.stderr),
  };
}

async function applyFixtureFileOperation(options: {
  assetRoot: string;
  workspaceRoot: string;
  action: FixtureFileOperationAction;
}): Promise<FixtureFileOperationExecutionResult> {
  const stagedSources = await stageFixtureAssetSources({
    assetRoot: options.assetRoot,
    workspaceRoot: options.workspaceRoot,
    sources: options.action.sources,
  });
  if (stagedSources.missingAssets.length > 0) {
    return {
      kind: "fileOperation",
      description: options.action.description,
      success: false,
      files: [],
      missingAssets: stagedSources.missingAssets,
    };
  }

  for (const patch of options.action.inventoryPatches) {
    await applyFixtureInventoryPatch({
      workspaceRoot: options.workspaceRoot,
      patch,
    });
  }

  return {
    kind: "fileOperation",
    description: options.action.description,
    success: true,
    files: stagedSources.files,
    missingAssets: [],
  };
}

async function stageFixtureAssetSources(options: {
  assetRoot: string;
  workspaceRoot: string;
  sources: readonly FixtureFileOperationSource[];
}): Promise<{
  files: FixtureFileOperationAppliedFile[];
  missingAssets: FixtureFileOperationMissingAsset[];
}> {
  const pendingFiles: Array<
    FixtureFileOperationAppliedFile & {
      absoluteTargetPath: string;
      contents: Uint8Array;
    }
  > = [];
  const missingAssets: FixtureFileOperationMissingAsset[] = [];
  const seenTargets = new Set<string>();

  for (const source of options.sources) {
    const targetPath = normalizeGitTreePath(source.path);
    const assetPath = normalizeGitTreePath(source.assetPath);
    if (seenTargets.has(targetPath)) {
      throw new Error(
        `Duplicate fixture file-operation target path: ${targetPath}`,
      );
    }
    seenTargets.add(targetPath);

    const absoluteAssetPath = join(options.assetRoot, assetPath);
    const absoluteTargetPath = join(options.workspaceRoot, targetPath);
    try {
      const contents = await Deno.readFile(absoluteAssetPath);
      pendingFiles.push({
        path: targetPath,
        assetPath,
        provenance: source.provenance,
        bytes: contents.byteLength,
        absoluteTargetPath,
        contents,
      });
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) {
        missingAssets.push({
          path: targetPath,
          assetPath,
          absolutePath: absoluteAssetPath,
        });
        continue;
      }
      throw error;
    }
  }

  if (missingAssets.length > 0) {
    return {
      files: [],
      missingAssets,
    };
  }

  for (const file of pendingFiles) {
    await Deno.mkdir(dirname(file.absoluteTargetPath), { recursive: true });
    await Deno.writeFile(file.absoluteTargetPath, file.contents);
  }

  return {
    files: pendingFiles.map((
      { absoluteTargetPath: _absoluteTargetPath, contents: _contents, ...file },
    ) => file),
    missingAssets,
  };
}

async function applyFixtureInventoryPatch(options: {
  workspaceRoot: string;
  patch: FixtureInventoryPatch;
}): Promise<void> {
  switch (options.patch.kind) {
    case "resourcePageDefinition":
      await applyResourcePageDefinitionInventoryPatch(options);
      return;
  }
}

async function applyResourcePageDefinitionInventoryPatch(options: {
  workspaceRoot: string;
  patch: FixtureResourcePageDefinitionInventoryPatch;
}): Promise<void> {
  const inventoryPath = normalizeGitTreePath(options.patch.inventoryPath);
  const absoluteInventoryPath = join(options.workspaceRoot, inventoryPath);
  const existing = await Deno.readTextFile(absoluteInventoryPath);
  if (
    existing.includes(
      `sflo:hasResourcePageDefinition <${options.patch.pageDefinitionPath}>`,
    ) &&
    existing.includes(`<${options.patch.pageDefinitionPath}>`)
  ) {
    return;
  }

  const block = renderResourcePageDefinitionInventoryPatch(options.patch);
  await Deno.writeTextFile(
    absoluteInventoryPath,
    `${existing.trimEnd()}\n\n${block}\n`,
  );
}

function renderResourcePageDefinitionInventoryPatch(
  patch: FixtureResourcePageDefinitionInventoryPatch,
): string {
  const assetBundleLink = patch.assetBundlePath === undefined ? "" : ` ;
  sflo:hasKnopAssetBundle <${patch.assetBundlePath}>`;
  const assetBundleBlock = patch.assetBundlePath === undefined
    ? ""
    : `\n\n<${patch.assetBundlePath}> a sflo:KnopAssetBundle .`;

  return `<${patch.knopPath}> sflo:hasResourcePageDefinition <${patch.pageDefinitionPath}>${assetBundleLink} .

<${patch.pageDefinitionPath}> a sflo:ResourcePageDefinition, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:workingLocalRelativePath "${patch.pageDefinitionFilePath}" .

<${patch.pageDefinitionFilePath}> a sflo:LocatedFile, sflo:RdfDocument .${assetBundleBlock}`;
}

async function maybeUpdateFixtureBranch(options: {
  fixtureRepoPath: string;
  workspaceRoot: string;
  targetRef: string;
  parentRef?: string;
  dryRun: boolean;
  operation: FixtureTransitionOperationResult;
  validation: JsonReport;
  message: string;
}): Promise<FixtureBranchUpdateResult> {
  const branchRef = toLocalBranchRef(options.targetRef);

  if (options.dryRun) {
    return {
      dryRun: true,
      updated: false,
      targetRef: options.targetRef,
      branchRef,
      localOnly: true,
      reason: "dry run requested",
    };
  }

  if (!options.operation.success) {
    return {
      dryRun: false,
      updated: false,
      targetRef: options.targetRef,
      branchRef,
      localOnly: true,
      reason: `${options.operation.kind} failed`,
    };
  }

  const failingGuardrail = findFailingGeneratedOutputGuardrail(
    options.validation,
  );
  if (failingGuardrail !== undefined) {
    return {
      dryRun: false,
      updated: false,
      targetRef: options.targetRef,
      branchRef,
      localOnly: true,
      reason: `generated-output guardrail failed: ${failingGuardrail.message}`,
    };
  }

  return await updateFixtureBranchFromWorkspace({
    fixtureRepoPath: options.fixtureRepoPath,
    workspaceRoot: options.workspaceRoot,
    targetRef: options.targetRef,
    parentRef: options.parentRef,
    message: options.message,
  });
}

export async function updateFixtureBranchFromWorkspace(
  options: UpdateFixtureBranchOptions,
): Promise<FixtureBranchUpdateResult> {
  const branchRef = toLocalBranchRef(options.targetRef);
  await assertValidBranchName(options.fixtureRepoPath, options.targetRef);

  const resolvedParentRef = options.parentRef ?? options.targetRef;
  const parentSha = await resolveGitCommitishIfExists(
    options.fixtureRepoPath,
    resolvedParentRef,
  );
  const treeSha = await writeWorkspaceTreeToFixtureRepo({
    fixtureRepoPath: options.fixtureRepoPath,
    workspaceRoot: options.workspaceRoot,
  });
  const commitArgs = [
    "commit-tree",
    treeSha,
    ...(parentSha === undefined ? [] : ["-p", parentSha]),
    "-m",
    options.message,
  ];
  const commitResult = await runGit(options.fixtureRepoPath, commitArgs, {
    env: gitAuthorEnv(),
  });
  if (!commitResult.success) {
    throw new Error(
      `Failed to create fixture branch commit: ${commitResult.stderr.trim()}`,
    );
  }

  const commitSha = commitResult.stdout.trim();
  const updateResult = await runGit(options.fixtureRepoPath, [
    "update-ref",
    branchRef,
    commitSha,
  ]);
  if (!updateResult.success) {
    throw new Error(
      `Failed to update ${branchRef}: ${updateResult.stderr.trim()}`,
    );
  }

  return {
    dryRun: false,
    updated: true,
    targetRef: options.targetRef,
    branchRef,
    localOnly: true,
    commitSha,
    treeSha,
    ...(parentSha === undefined ? {} : {
      parentRef: resolvedParentRef,
      parentSha,
    }),
    pushed: false,
  };
}

async function writeWorkspaceTreeToFixtureRepo(options: {
  fixtureRepoPath: string;
  workspaceRoot: string;
}): Promise<string> {
  const indexFile = await Deno.makeTempFile({
    prefix: "weave-fixture-index-",
  });
  const excludesFile = await Deno.makeTempFile({
    prefix: "weave-fixture-excludes-",
  });
  await Deno.writeTextFile(excludesFile, ".git/\n.weave/\n");
  const gitDir = join(options.fixtureRepoPath, ".git");
  const env = { GIT_INDEX_FILE: indexFile };
  const gitArgs = [
    "-c",
    `core.excludesFile=${excludesFile}`,
    "--git-dir",
    gitDir,
    "--work-tree",
    options.workspaceRoot,
  ];

  try {
    await runRequiredGit(options.fixtureRepoPath, [
      ...gitArgs,
      "read-tree",
      "--empty",
    ], env);
    await runRequiredGit(options.fixtureRepoPath, [
      ...gitArgs,
      "add",
      "-A",
      "--",
      ".",
    ], env);
    const result = await runGit(options.fixtureRepoPath, [
      ...gitArgs,
      "write-tree",
    ], { env });
    if (!result.success) {
      throw new Error(
        `Failed to write generated fixture tree: ${result.stderr.trim()}`,
      );
    }
    return result.stdout.trim();
  } finally {
    await Deno.remove(indexFile).catch(() => {});
    await Deno.remove(excludesFile).catch(() => {});
  }
}

async function runRequiredGit(
  cwd: string,
  args: readonly string[],
  env?: Record<string, string>,
): Promise<void> {
  const result = await runGit(cwd, args, { env });
  if (!result.success) {
    throw new Error(`git ${args.join(" ")} failed: ${result.stderr.trim()}`);
  }
}

async function validateFixtureTransitionWorkspace(options: {
  fixtureRepoPath: string;
  manifestPath: string;
  workspaceRoot: string;
  fallbackFromRef: string;
  fallbackToRef: string;
}): Promise<JsonReport> {
  const manifest = await readManifestSource(options.manifestPath);
  const transitionCase = selectTransitionCase(manifest.document);
  const fromRef = options.fallbackFromRef;
  const toRef = options.fallbackToRef;
  const fileExpectations = transitionCase.hasFileExpectation ?? [];
  const actualBytesByPath = new Map<string, Uint8Array | undefined>();
  const checks: CheckRecord[] = [];
  const resolvedFromRef = await resolveGitCommitishIfExists(
    options.fixtureRepoPath,
    fromRef,
  );
  const resolvedToRef = await resolveGitCommitishIfExists(
    options.fixtureRepoPath,
    toRef,
  );

  if (resolvedFromRef === undefined) {
    checks.push(gitRefUnresolvedRecord({
      ref: fromRef,
      role: "fromRef",
      fixtureRepoPath: options.fixtureRepoPath,
    }));
  }
  if (resolvedToRef === undefined) {
    checks.push(gitRefUnresolvedRecord({
      ref: toRef,
      role: "toRef",
      fixtureRepoPath: options.fixtureRepoPath,
    }));
  }

  for (const fileExpectation of fileExpectations) {
    checks.push(
      ...await evaluateWorkspaceFileExpectation({
        fixtureRepoPath: options.fixtureRepoPath,
        fromRef: resolvedFromRef,
        toRef: resolvedToRef,
        expectedRefLabel: toRef,
        workspaceRoot: options.workspaceRoot,
        transitionCase,
        fileExpectation,
        actualBytesByPath,
      }),
    );
  }

  checks.push(
    ...await evaluateWorkspaceRdfExpectations({
      workspaceRoot: options.workspaceRoot,
      transitionCase,
      fileExpectations,
      actualBytesByPath,
    }),
  );
  checks.push(
    ...await evaluateGeneratedOutputGuardrails(options.workspaceRoot),
  );

  const summary = countCheckStatuses(checks);
  return {
    manifestPath: options.manifestPath,
    caseId: transitionCase.resolvedId ?? transitionCase.id ?? "(anonymous)",
    fixtureRepoPath: options.fixtureRepoPath,
    status: deriveReportStatus(checks),
    summary,
    checks,
  };
}

async function evaluateWorkspaceFileExpectation(options: {
  fixtureRepoPath: string;
  fromRef: string | undefined;
  toRef: string | undefined;
  expectedRefLabel: string;
  workspaceRoot: string;
  transitionCase: TransitionCase;
  fileExpectation: FileExpectation;
  actualBytesByPath: Map<string, Uint8Array | undefined>;
}): Promise<CheckRecord[]> {
  const path = options.fileExpectation.path;
  const changeType = options.fileExpectation.changeType as
    | FileChangeType
    | undefined;
  const compareMode = options.fileExpectation.compareMode;

  if (path === undefined || changeType === undefined) {
    return [{
      kind: "file_presence",
      status: "error",
      code: CHECK_CODES.FILE_PRESENCE_MISMATCH,
      message: "File expectation is missing path or changeType.",
      path,
    }];
  }

  const safePath = normalizeGitTreePath(path);
  const fromBytes = options.fromRef === undefined
    ? undefined
    : await readGitBlobIfExists(
      options.fixtureRepoPath,
      options.fromRef,
      safePath,
    );
  const expectedBytes = options.toRef === undefined
    ? undefined
    : await readGitBlobIfExists(
      options.fixtureRepoPath,
      options.toRef,
      safePath,
    );
  const actualBytes = await readWorkspaceFileIfExists(
    options.workspaceRoot,
    safePath,
  );
  options.actualBytesByPath.set(safePath, actualBytes);

  const checks: CheckRecord[] = [
    filePresenceRecord({
      path: safePath,
      changeType,
      fromExists: fromBytes !== undefined,
      actualExists: actualBytes !== undefined,
    }),
  ];

  if (actualBytes === undefined || expectedBytes === undefined) {
    if (actualBytes !== undefined && expectedBytes === undefined) {
      checks.push({
        kind: compareMode === "rdfCanonical" ? "rdf_compare" : "file_compare",
        status: "fail",
        code: compareMode === "rdfCanonical"
          ? CHECK_CODES.RDF_GRAPH_MISMATCH
          : CHECK_CODES.FILE_CONTENT_MISMATCH,
        message:
          `Expected fixture ref ${options.expectedRefLabel} to contain ${safePath} for ${compareMode} comparison.`,
        path: safePath,
      });
    }
    return checks;
  }

  if (compareMode === "bytes") {
    checks.push(fileCompareRecord({
      path: safePath,
      compareMode,
      contentsEqual: compareBytes(actualBytes, expectedBytes),
    }));
    return checks;
  }

  if (compareMode === "text") {
    try {
      checks.push(fileCompareRecord({
        path: safePath,
        compareMode,
        contentsEqual: compareTextContents(actualBytes, expectedBytes),
      }));
    } catch (error) {
      if (error instanceof TextDecodeError) {
        checks.push({
          kind: "file_compare",
          status: "error",
          code: CHECK_CODES.TEXT_DECODE_ERROR,
          message: error.message,
          path: safePath,
        });
        return checks;
      }
      throw error;
    }
    return checks;
  }

  if (compareMode === "rdfCanonical") {
    const rdfExpectation = resolveTargetRdfExpectation(
      options.fileExpectation,
      options.transitionCase.hasRdfExpectation ?? [],
    );
    try {
      const contentsEqual = await compareRdfContent({
        left: actualBytes,
        right: expectedBytes,
        path: safePath,
        ignorePredicates: rdfExpectation?.ignorePredicate,
      });
      checks.push({
        kind: "rdf_compare",
        status: contentsEqual ? "pass" : "fail",
        code: contentsEqual
          ? CHECK_CODES.RDF_GRAPH_OK
          : CHECK_CODES.RDF_GRAPH_MISMATCH,
        message:
          `Expected workspace contents to match ${options.expectedRefLabel} under rdfCanonical comparison.`,
        path: safePath,
      });
    } catch (error) {
      if (error instanceof RdfCompareError) {
        checks.push({
          kind: "rdf_compare",
          status: "error",
          code: error.code,
          message: error.message,
          path: safePath,
        });
        return checks;
      }
      throw error;
    }
    return checks;
  }

  if (compareMode !== undefined) {
    checks.push({
      kind: "file_compare",
      status: "error",
      code: CHECK_CODES.FILE_CONTENT_MISMATCH,
      message: `Unsupported compare mode for file expectation: ${compareMode}`,
      path: safePath,
    });
  }

  return checks;
}

async function evaluateWorkspaceRdfExpectations(options: {
  workspaceRoot: string;
  transitionCase: TransitionCase;
  fileExpectations: readonly FileExpectation[];
  actualBytesByPath: Map<string, Uint8Array | undefined>;
}): Promise<CheckRecord[]> {
  const checks: CheckRecord[] = [];

  for (const rdfExpectation of options.transitionCase.hasRdfExpectation ?? []) {
    const fileExpectation = resolveTargetFileExpectation(
      rdfExpectation,
      options.fileExpectations,
    );
    const path = fileExpectation?.path;
    if (
      fileExpectation === undefined || path === undefined ||
      fileExpectation.compareMode !== "rdfCanonical"
    ) {
      continue;
    }

    const safePath = normalizeGitTreePath(path);
    const actualBytes = options.actualBytesByPath.get(safePath) ??
      await readWorkspaceFileIfExists(options.workspaceRoot, safePath);
    if (actualBytes === undefined) {
      continue;
    }

    for (const askAssertion of rdfExpectation.hasAskAssertion ?? []) {
      checks.push(
        await evaluateWorkspaceSparqlAskAssertion({
          path: safePath,
          actualBytes,
          askAssertion,
        }),
      );
    }
  }

  return checks;
}

async function evaluateWorkspaceSparqlAskAssertion(options: {
  path: string;
  actualBytes: Uint8Array;
  askAssertion: SparqlAskAssertion;
}): Promise<CheckRecord> {
  const assertionId = options.askAssertion.id ??
    options.askAssertion.resolvedId;

  if (
    typeof options.askAssertion.query !== "string" ||
    options.askAssertion.query === ""
  ) {
    return {
      kind: "sparql_ask",
      status: "error",
      code: CHECK_CODES.SPARQL_QUERY_ERROR,
      message: "SPARQL ASK assertion is missing a query string.",
      path: options.path,
      assertionId,
    };
  }

  if (typeof options.askAssertion.expectedBoolean !== "boolean") {
    return {
      kind: "sparql_ask",
      status: "error",
      code: CHECK_CODES.SPARQL_QUERY_ERROR,
      message: "SPARQL ASK assertion is missing expectedBoolean.",
      path: options.path,
      assertionId,
    };
  }

  try {
    const actual = await runAskAssertion({
      dataset: options.actualBytes,
      path: options.path,
      query: options.askAssertion.query,
    });
    const passed = actual === options.askAssertion.expectedBoolean;
    return {
      kind: "sparql_ask",
      status: passed ? "pass" : "fail",
      code: passed
        ? CHECK_CODES.SPARQL_ASK_OK
        : CHECK_CODES.SPARQL_ASK_MISMATCH,
      message: passed
        ? "SPARQL ASK result matched expectedBoolean."
        : `Expected SPARQL ASK to return ${options.askAssertion.expectedBoolean}, but it returned ${actual}.`,
      path: options.path,
      assertionId,
    };
  } catch (error) {
    if (error instanceof RdfCompareError || error instanceof SparqlAskError) {
      return {
        kind: "sparql_ask",
        status: "error",
        code: error.code,
        message: error.message,
        path: options.path,
        assertionId,
      };
    }
    throw error;
  }
}

export async function evaluateGeneratedOutputGuardrails(
  workspaceRoot: string,
): Promise<CheckRecord[]> {
  const paths = await listWorkspaceFiles(workspaceRoot);
  return [
    await evaluateCanonicalNamespaceGuardrail(workspaceRoot, paths),
    await evaluateInventoryOwnedProgressionGuardrail(workspaceRoot),
    await evaluateMeshInventoryMetadataProgressionGuardrail(
      workspaceRoot,
      paths,
    ),
  ];
}

async function evaluateCanonicalNamespaceGuardrail(
  workspaceRoot: string,
  paths: readonly string[],
): Promise<CheckRecord> {
  for (const path of paths.filter(isRdfOutputPath)) {
    const contents = await Deno.readTextFile(join(workspaceRoot, path));
    if (contents.includes(OLD_SFLO_NAMESPACE)) {
      return guardrailRecord({
        assertionId: "generated-output.guardrail.canonicalNamespace",
        passed: false,
        path,
        message:
          `Generated RDF must use ${CANONICAL_SFLO_NAMESPACE}; found retired namespace ${OLD_SFLO_NAMESPACE}.`,
      });
    }
  }

  return guardrailRecord({
    assertionId: "generated-output.guardrail.canonicalNamespace",
    passed: true,
    message:
      `Generated RDF uses the canonical sflo namespace ${CANONICAL_SFLO_NAMESPACE}.`,
  });
}

async function evaluateInventoryOwnedProgressionGuardrail(
  workspaceRoot: string,
): Promise<CheckRecord> {
  const inventory = await readWorkspaceTextFileIfExists(
    workspaceRoot,
    "_mesh/_inventory/inventory.ttl",
  );
  if (inventory === undefined) {
    return guardrailRecord({
      assertionId: "generated-output.guardrail.inventoryOwnedProgression",
      passed: true,
      path: "_mesh/_inventory/inventory.ttl",
      message:
        "MeshInventory current file is absent; no inventory-owned progression facts found.",
    });
  }

  const hasInventoryOwnedProgression =
    findStaleInventoryProgressionBlock(inventory) !== undefined;
  const metadata = await readWorkspaceTextFileIfExists(
    workspaceRoot,
    "_mesh/_meta/meta.ttl",
  );
  const passed = !hasInventoryOwnedProgression ||
    hasMeshInventoryMetadataProgressionAnchor(metadata);

  return guardrailRecord({
    assertionId: "generated-output.guardrail.inventoryOwnedProgression",
    passed,
    path: "_mesh/_inventory/inventory.ttl",
    message: !hasInventoryOwnedProgression
      ? "MeshInventory progression facts are not owned by _mesh/_inventory/inventory.ttl."
      : passed
      ? "MeshInventory progression facts are anchored in _mesh/_meta/meta.ttl."
      : "Stale MeshInventory progression facts found in _mesh/_inventory/inventory.ttl without a matching _mesh/_meta/meta.ttl anchor.",
  });
}

function findStaleInventoryProgressionBlock(
  inventory: string,
): string | undefined {
  const progressionPredicates = [
    "hasArtifactHistory",
    "currentArtifactHistory",
    "nextHistoryOrdinal",
    "latestHistoricalState",
    "nextStateOrdinal",
  ] as const;

  return inventory.split(/\n\s*\n/).find((block) => {
    const trimmed = block.trimStart();
    if (
      !trimmed.startsWith("<_mesh/_inventory>") &&
      !trimmed.startsWith("<_mesh/_inventory/_history")
    ) {
      return false;
    }

    return progressionPredicates.some((predicate) =>
      block.includes(`sflo:${predicate}`) ||
      block.includes(`<${CANONICAL_SFLO_NAMESPACE}${predicate}>`)
    );
  });
}

async function evaluateMeshInventoryMetadataProgressionGuardrail(
  workspaceRoot: string,
  paths: readonly string[],
): Promise<CheckRecord> {
  const hasMeshInventoryHistoryOutput = paths.some((path) =>
    path.startsWith(`${MESH_INVENTORY_HISTORY_PREFIX}`)
  );
  if (!hasMeshInventoryHistoryOutput) {
    return guardrailRecord({
      assertionId:
        "generated-output.guardrail.meshInventoryMetadataProgression",
      passed: true,
      path: "_mesh/_meta/meta.ttl",
      message:
        "No MeshInventory history output is present; metadata progression facts are not required.",
    });
  }

  const metadata = await readWorkspaceTextFileIfExists(
    workspaceRoot,
    "_mesh/_meta/meta.ttl",
  );
  const passed = hasMeshInventoryMetadataProgressionAnchor(metadata);

  return guardrailRecord({
    assertionId: "generated-output.guardrail.meshInventoryMetadataProgression",
    passed,
    path: "_mesh/_meta/meta.ttl",
    message: passed
      ? "MeshInventory progression facts are anchored in _mesh/_meta/meta.ttl."
      : "MeshInventory history output exists, but _mesh/_meta/meta.ttl does not anchor current/latest MeshInventory progression.",
  });
}

function hasMeshInventoryMetadataProgressionAnchor(
  metadata: string | undefined,
): boolean {
  return metadata !== undefined &&
    metadata.includes(
      "sflo:currentArtifactHistory <_mesh/_inventory/_history",
    ) &&
    metadata.includes("sflo:latestHistoricalState <_mesh/_inventory/_history");
}

function guardrailRecord(options: {
  assertionId: string;
  passed: boolean;
  message: string;
  path?: string;
}): CheckRecord {
  return {
    kind: "setup",
    status: options.passed ? "pass" : "fail",
    code: options.passed
      ? CHECK_CODES.FILE_CONTENT_OK
      : CHECK_CODES.FILE_CONTENT_MISMATCH,
    message: options.message,
    path: options.path,
    assertionId: options.assertionId,
  };
}

function gitRefUnresolvedRecord(options: {
  ref: string;
  role: "fromRef" | "toRef";
  fixtureRepoPath: string;
}): CheckRecord {
  return {
    kind: "setup",
    status: "fail",
    code: CHECK_CODES.GIT_REF_UNRESOLVED,
    message:
      `Could not resolve manifest ${options.role} ${options.ref} in ${options.fixtureRepoPath}; reporting fixture drift without blocking generated-output guardrails.`,
  };
}

function findFailingGeneratedOutputGuardrail(
  validation: JsonReport,
): CheckRecord | undefined {
  return validation.checks.find((check) =>
    check.kind === "setup" &&
    check.status !== "pass" &&
    check.assertionId?.startsWith("generated-output.guardrail.") === true
  );
}

function filePresenceRecord(options: {
  path: string;
  changeType: FileChangeType;
  fromExists: boolean;
  actualExists: boolean;
}): CheckRecord {
  const presence = evaluatePresenceExpectation(
    options.changeType,
    options.fromExists,
    options.actualExists,
  );
  return {
    kind: "file_presence",
    status: presence.passed ? "pass" : "fail",
    code: presence.passed
      ? CHECK_CODES.FILE_PRESENCE_OK
      : CHECK_CODES.FILE_PRESENCE_MISMATCH,
    message: presence.reason,
    path: options.path,
  };
}

function fileCompareRecord(options: {
  path: string;
  compareMode: string;
  contentsEqual: boolean;
}): CheckRecord {
  return {
    kind: "file_compare",
    status: options.contentsEqual ? "pass" : "fail",
    code: options.contentsEqual
      ? CHECK_CODES.FILE_CONTENT_OK
      : CHECK_CODES.FILE_CONTENT_MISMATCH,
    message:
      `Expected workspace contents to match toRef under ${options.compareMode} comparison.`,
    path: options.path,
  };
}

function resolveTargetFileExpectation(
  rdfExpectation: RdfExpectation,
  fileExpectations: readonly FileExpectation[],
): FileExpectation | undefined {
  const target = rdfExpectation.targetsFileExpectation;
  return fileExpectations.find((candidate) =>
    candidate.id === target || candidate.resolvedId === target
  );
}

function resolveTargetRdfExpectation(
  fileExpectation: FileExpectation,
  rdfExpectations: readonly RdfExpectation[],
): RdfExpectation | undefined {
  return rdfExpectations.find((candidate) =>
    candidate.targetsFileExpectation === fileExpectation.id ||
    candidate.targetsFileExpectation === fileExpectation.resolvedId
  );
}

function requireArgumentValue(value: string | undefined, name: string): string {
  if (value === undefined || value.trim().length === 0) {
    throw new Error(`${name} requires a value`);
  }
  return value;
}

function parseScenarioId(value: string): FixtureScenarioId {
  if (value === "alice-bio") {
    return value;
  }
  throw new Error(`Unsupported fixture scenario: ${value}`);
}

function parsePlanFormat(value: string): FixturePlanFormat {
  if (value === "text" || value === "json") {
    return value;
  }
  throw new Error(`Unsupported fixture plan format: ${value}`);
}

async function ensureEmptyWorkspaceRoot(path: string): Promise<void> {
  try {
    const stat = await Deno.stat(path);
    if (!stat.isDirectory) {
      throw new Error(`workspace root is not a directory: ${path}`);
    }
    for await (const _entry of Deno.readDir(path)) {
      throw new Error(
        `workspace root must be empty before materialization: ${path}`,
      );
    }
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      await Deno.mkdir(path, { recursive: true });
      return;
    }
    throw error;
  }
}

async function resolveGitCommitishIfExists(
  repoPath: string,
  ref: string,
): Promise<string | undefined> {
  const candidates = fixtureRefCandidates(ref);
  for (const candidate of candidates) {
    const result = await runGit(repoPath, [
      "rev-parse",
      "--verify",
      "--quiet",
      `${candidate}^{commit}`,
    ]);
    if (result.success) {
      return result.stdout.trim();
    }
  }
  return undefined;
}

function fixtureRefCandidates(ref: string): string[] {
  return [ref, `origin/${ref}`];
}

function unresolvedFixtureRefError(repoPath: string, ref: string): Error {
  return new Error(
    `Failed to resolve fixture ref ${ref} in ${repoPath}; checked ${
      fixtureRefCandidates(ref).join(", ")
    }.`,
  );
}

async function assertValidBranchName(
  repoPath: string,
  branchName: string,
): Promise<void> {
  const result = await runGit(repoPath, [
    "check-ref-format",
    "--branch",
    branchName,
  ]);
  if (!result.success) {
    throw new Error(`Invalid fixture branch name: ${branchName}`);
  }
}

function toLocalBranchRef(branchName: string): string {
  return `refs/heads/${branchName}`;
}

function gitAuthorEnv(): Record<string, string> {
  return {
    GIT_AUTHOR_NAME: "Weave fixture ladder",
    GIT_AUTHOR_EMAIL: "weave-fixture-ladder@example.invalid",
    GIT_COMMITTER_NAME: "Weave fixture ladder",
    GIT_COMMITTER_EMAIL: "weave-fixture-ladder@example.invalid",
  };
}

async function materializeGitTree(options: {
  repoPath: string;
  ref: string;
  workspaceRoot: string;
}): Promise<string[]> {
  const listResult = await runGit(options.repoPath, [
    "ls-tree",
    "-r",
    "--name-only",
    "-z",
    options.ref,
  ]);
  if (!listResult.success) {
    throw new Error(
      `Failed to list fixture files for ${options.ref}: ${listResult.stderr.trim()}`,
    );
  }

  const paths = listResult.stdout.split("\0").filter((path) => path.length > 0);
  for (const path of paths) {
    const safePath = normalizeGitTreePath(path);
    const absolutePath = join(options.workspaceRoot, safePath);
    await Deno.mkdir(dirname(absolutePath), { recursive: true });
    const fileResult = await runGitBytes(options.repoPath, [
      "show",
      `${options.ref}:${safePath}`,
    ]);
    if (!fileResult.success) {
      throw new Error(
        `Failed to read fixture file ${options.ref}:${safePath}: ${fileResult.stderr.trim()}`,
      );
    }
    await Deno.writeFile(absolutePath, fileResult.stdout);
  }

  return paths.map(normalizeGitTreePath).sort((left, right) =>
    left.localeCompare(right)
  );
}

async function readGitBlobIfExists(
  repoPath: string,
  ref: string,
  path: string,
): Promise<Uint8Array | undefined> {
  const result = await runGitBytes(repoPath, ["show", `${ref}:${path}`]);
  return result.success ? result.stdout : undefined;
}

async function readWorkspaceFileIfExists(
  workspaceRoot: string,
  path: string,
): Promise<Uint8Array | undefined> {
  try {
    return await Deno.readFile(join(workspaceRoot, normalizeGitTreePath(path)));
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      return undefined;
    }
    throw error;
  }
}

async function readWorkspaceTextFileIfExists(
  workspaceRoot: string,
  path: string,
): Promise<string | undefined> {
  const bytes = await readWorkspaceFileIfExists(workspaceRoot, path);
  return bytes === undefined ? undefined : new TextDecoder().decode(bytes);
}

async function listWorkspaceFiles(
  workspaceRoot: string,
  basePath = ".",
): Promise<string[]> {
  const directory = basePath === "."
    ? workspaceRoot
    : join(workspaceRoot, basePath);
  const paths: string[] = [];

  for await (const entry of Deno.readDir(directory)) {
    if (entry.name === ".git" || entry.name === ".weave") {
      continue;
    }

    const childPath = basePath === "."
      ? entry.name
      : pathPosix.join(basePath, entry.name);

    if (entry.isDirectory) {
      paths.push(...await listWorkspaceFiles(workspaceRoot, childPath));
    } else if (entry.isFile) {
      paths.push(normalizeGitTreePath(childPath));
    }
  }

  return paths.sort((left, right) => left.localeCompare(right));
}

function isRdfOutputPath(path: string): boolean {
  return RDF_OUTPUT_EXTENSIONS.some((extension) => path.endsWith(extension));
}

function normalizeGitTreePath(path: string): string {
  if (path.includes("\\") || isAbsolute(path) || /^[A-Za-z]:/.test(path)) {
    throw new Error(`Unsafe git tree path: ${path}`);
  }
  const normalized = pathPosix.normalize(path);
  if (
    normalized === "." || normalized === ".." || normalized.startsWith("../")
  ) {
    throw new Error(`Unsafe git tree path: ${path}`);
  }
  return normalized;
}

async function runGit(
  cwd: string,
  args: readonly string[],
  options: { env?: Record<string, string> } = {},
): Promise<{ success: boolean; stdout: string; stderr: string }> {
  const result = await runGitBytes(cwd, args, options);
  return {
    success: result.success,
    stdout: new TextDecoder().decode(result.stdout),
    stderr: result.stderr,
  };
}

async function runGitBytes(
  cwd: string,
  args: readonly string[],
  options: { env?: Record<string, string> } = {},
): Promise<{ success: boolean; stdout: Uint8Array; stderr: string }> {
  try {
    const output = await new Deno.Command("git", {
      cwd,
      args: [...args],
      env: options.env,
    }).output();
    return {
      success: output.success,
      stdout: output.stdout,
      stderr: new TextDecoder().decode(output.stderr),
    };
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      return {
        success: false,
        stdout: new Uint8Array(),
        stderr: "git executable was not found",
      };
    }
    throw error;
  }
}
