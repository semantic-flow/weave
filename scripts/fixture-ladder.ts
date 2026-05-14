import { dirname, isAbsolute, join, relative, resolve } from "@std/path";
import * as pathPosix from "@std/path/posix";

export type FixtureScenarioId = "alice-bio";
export type FixturePlanFormat = "text" | "json";

export interface FixtureLadderOptions {
  root: string;
  scenario: FixtureScenarioId;
  format: FixturePlanFormat;
  materializeTransitionId?: string;
  workspaceRoot?: string;
}

export interface FixtureLadderPlan {
  scenario: FixtureLadderScenario;
  root: string;
  fixtureRepoPath: string;
  manifestRoot: string;
  transitions: readonly FixtureTransitionPlan[];
  writesBranches: false;
}

export interface MaterializeFixtureTransitionOptions {
  root: string;
  scenario: FixtureScenarioId;
  transitionId: string;
  workspaceRoot?: string;
}

export interface FixtureMaterializationResult {
  scenario: FixtureScenarioId;
  transitionId: string;
  fromRef: string;
  toRef: string;
  operationId: string;
  fixtureRepoPath: string;
  workspaceRoot: string;
  materializedPaths: readonly string[];
  writesBranches: false;
  nextAction: FixtureTransitionAction;
}

export interface FixtureLadderScenario {
  id: FixtureScenarioId;
  label: string;
  fixtureRepo: string;
  fixtureRepoRelativePath: string;
  manifestRootRelativePath: string;
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
  cwd: "workspace";
  promptPolicy: "nonInteractive";
  expectedRuntimeLogs: boolean;
}

export interface FixtureFileOperationAction {
  kind: "fileOperation";
  description: string;
  sources: readonly FixtureFileOperationSource[];
}

export interface FixtureFileOperationSource {
  path: string;
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

export const ALICE_BIO_FIXTURE_SCENARIO: FixtureLadderScenario = {
  id: "alice-bio",
  label: "Alice Bio",
  fixtureRepo: ALICE_BIO_FIXTURE_REPO,
  fixtureRepoRelativePath: ALICE_BIO_FIXTURE_REPO_RELATIVE_PATH,
  manifestRootRelativePath: ALICE_BIO_MANIFEST_ROOT_RELATIVE_PATH,
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
    commandTransition(2, "02-mesh-created", "01-source-only", "mesh.create", [
      "mesh",
      "create",
      "--workspace",
      ".",
      "--mesh-base",
      "https://semantic-flow.github.io/mesh-alice-bio/",
    ]),
    commandTransition(
      3,
      "03-mesh-created-woven",
      "02-mesh-created",
      "weave",
      [],
    ),
    commandTransition(
      4,
      "04-alice-knop-created",
      "03-mesh-created-woven",
      "knop.create",
      [
        "knop",
        "create",
        "alice",
      ],
    ),
    commandTransition(
      5,
      "05-alice-knop-created-woven",
      "04-alice-knop-created",
      "weave",
      [],
    ),
    commandTransition(
      6,
      "06-alice-bio-integrated",
      "05-alice-knop-created-woven",
      "integrate",
      [
        "integrate",
        "alice-bio.ttl",
        "--designator-path",
        "alice/bio",
      ],
    ),
    commandTransition(
      7,
      "07-alice-bio-integrated-woven",
      "06-alice-bio-integrated",
      "weave",
      [],
    ),
    commandTransition(
      8,
      "08-alice-bio-referenced",
      "07-alice-bio-integrated-woven",
      "knop.addReference",
      [
        "knop",
        "add-reference",
        "alice",
        "--reference-target-designator-path",
        "alice/bio",
        "--reference-role",
        "Canonical",
      ],
    ),
    commandTransition(
      9,
      "09-alice-bio-referenced-woven",
      "08-alice-bio-referenced",
      "weave",
      [],
    ),
    commandTransition(
      10,
      "10-alice-bio-updated",
      "09-alice-bio-referenced-woven",
      "payload.update",
      [
        "payload",
        "update",
        "alice-bio-v2.ttl",
        "alice/bio",
      ],
    ),
    commandTransition(
      11,
      "11-alice-bio-v2-woven",
      "10-alice-bio-updated",
      "weave",
      [
        "--target",
        "designatorPath=alice/bio",
      ],
    ),
    commandTransition(
      12,
      "12-bob-extracted",
      "11-alice-bio-v2-woven",
      "extract",
      [
        "extract",
        "bob",
      ],
    ),
    commandTransition(
      13,
      "13-bob-extracted-woven",
      "12-bob-extracted",
      "weave",
      [
        "--target",
        "designatorPath=bob",
      ],
    ),
    fileTransition(14, "14-alice-page-customized", "13-bob-extracted-woven", {
      description:
        "Apply the hand-authored Alice page definition and local page assets.",
      sources: [
        {
          path: "alice/_knop/_page/page.ttl",
          provenance:
            "fixture-authored page definition copied from the existing Alice customized fixture",
        },
        {
          path: "alice/page.md",
          provenance:
            "fixture-authored Markdown copied from the existing Alice customized fixture",
        },
      ],
    }, "resourcePage.define"),
    commandTransition(
      15,
      "15-alice-page-customized-woven",
      "14-alice-page-customized",
      "weave",
      [
        "--target",
        "designatorPath=alice",
      ],
    ),
    commandTransition(
      16,
      "16-alice-page-main-integrated",
      "15-alice-page-customized-woven",
      "integrate",
      [
        "integrate",
        "alice/page-main.md",
        "--designator-path",
        "alice/page-main",
      ],
    ),
    commandTransition(
      17,
      "17-alice-page-main-integrated-woven",
      "16-alice-page-main-integrated",
      "weave",
      [
        "--target",
        "designatorPath=alice/page-main",
      ],
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
              "fixture-authored page definition copied from the existing page-artifact-source fixture",
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
      [
        "--target",
        "designatorPath=alice",
      ],
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
            path: "bob/page.md",
            provenance:
              "outside-origin Markdown from https://raw.githubusercontent.com/djradon/public-notes/refs/heads/main/user.bob-newhart.md; replay must use checked-in bytes or a digest-pinned copy",
          },
          {
            path: "bob/_knop/_page/page.ttl",
            provenance:
              "fixture-authored page definition copied from the existing Bob imported-source fixture",
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
      [
        "--target",
        "designatorPath=bob",
      ],
    ),
    commandTransition(
      22,
      "22-root-knop-created",
      "21-bob-page-imported-source-woven",
      "knop.create",
      [
        "knop",
        "create",
        "/",
      ],
    ),
    commandTransition(
      23,
      "23-root-knop-created-woven",
      "22-root-knop-created",
      "weave",
      [
        "--target",
        "designatorPath=/",
      ],
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
              "fixture-authored root page definition copied from the existing root customized fixture",
          },
          {
            path: "index.md",
            provenance:
              "fixture-authored root Markdown copied from the existing root customized fixture",
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
      [
        "--target",
        "designatorPath=/",
      ],
    ),
  ],
};

if (import.meta.main) {
  try {
    const options = parseFixtureLadderArgs(Deno.args);
    if (options.materializeTransitionId !== undefined) {
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
      const plan = planFixtureLadder(options);
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
      case "--workspace-root":
        index += 1;
        workspaceRoot = requireArgumentValue(args[index], "--workspace-root");
        break;
      case "--json":
        format = "json";
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
    workspaceRoot !== undefined && materializeTransitionId === undefined
  ) {
    throw new Error("fixture:ladder --workspace-root requires --materialize");
  }

  return {
    root: resolve(root),
    scenario,
    format,
    ...(materializeTransitionId !== undefined
      ? { materializeTransitionId }
      : {}),
    ...(workspaceRoot !== undefined
      ? { workspaceRoot: resolve(workspaceRoot) }
      : {}),
  };
}

export function planFixtureLadder(
  options: FixtureLadderOptions,
): FixtureLadderPlan {
  const scenario = resolveFixtureScenario(options.scenario);
  const root = resolve(options.root);
  const manifestRoot = join(root, scenario.manifestRootRelativePath);

  return {
    scenario,
    root,
    fixtureRepoPath: join(root, scenario.fixtureRepoRelativePath),
    manifestRoot,
    transitions: scenario.transitions.map((transition) => ({
      ...transition,
      manifestPath: join(manifestRoot, transition.manifestName),
    })),
    writesBranches: false,
  };
}

export function renderFixtureLadderPlan(plan: FixtureLadderPlan): string {
  const lines = [
    `Fixture ladder dry run: ${plan.scenario.label}`,
    `Fixture repository: ${plan.scenario.fixtureRepo}`,
    `Fixture repository path: ${plan.fixtureRepoPath}`,
    `Manifest root: ${plan.manifestRoot}`,
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
    } else {
      lines.push(`   file operation: ${transition.action.description}`);
      for (const source of transition.action.sources) {
        lines.push(`   source: ${source.path} (${source.provenance})`);
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
  const plan = planFixtureLadder({
    root: options.root,
    scenario: options.scenario,
    format: "text",
  });
  const transition = plan.transitions.find((candidate) =>
    candidate.id === options.transitionId
  );
  if (transition === undefined) {
    throw new Error(
      `Unknown ${plan.scenario.label} transition: ${options.transitionId}`,
    );
  }

  const workspaceRoot = options.workspaceRoot === undefined
    ? await Deno.makeTempDir({ prefix: "weave-fixture-ladder-" })
    : resolve(options.workspaceRoot);
  await ensureEmptyWorkspaceRoot(workspaceRoot);

  const resolvedRef = await resolveGitCommitish(
    plan.fixtureRepoPath,
    transition.fromRef,
  );
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
    workspaceRoot,
    materializedPaths,
    writesBranches: false,
    nextAction: transition.action,
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

function resolveFixtureScenario(id: FixtureScenarioId): FixtureLadderScenario {
  switch (id) {
    case "alice-bio":
      return ALICE_BIO_FIXTURE_SCENARIO;
  }
}

function commandTransition(
  index: number,
  id: string,
  fromRef: string,
  operationId: string,
  argv: readonly string[],
): FixtureTransitionDefinition {
  return {
    index,
    id,
    fromRef,
    toRef: id,
    manifestName: `${id}.jsonld`,
    operationId,
    action: {
      kind: "command",
      executable: "weave",
      argv,
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
  action: Omit<FixtureFileOperationAction, "kind">,
  operationId = "fixture.fileOperation",
): FixtureTransitionDefinition {
  return {
    index,
    id,
    fromRef,
    toRef: id,
    manifestName: `${id}.jsonld`,
    operationId,
    action: {
      kind: "fileOperation",
      ...action,
    },
    validation: defaultValidation(),
  };
}

function defaultValidation(): FixtureTransitionValidation {
  return {
    accordManifest: true,
    comparison: "manifestScoped",
    guardrails: CANONICAL_OUTPUT_GUARDRAILS,
  };
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

async function resolveGitCommitish(
  repoPath: string,
  ref: string,
): Promise<string> {
  const candidates = [ref, `origin/${ref}`];
  for (const candidate of candidates) {
    const result = await runGit(repoPath, [
      "rev-parse",
      "--verify",
      "--quiet",
      `${candidate}^{commit}`,
    ]);
    if (result.success) {
      return candidate;
    }
  }
  throw new Error(
    `Failed to resolve fixture ref ${ref} in ${repoPath}; checked ${
      candidates.join(", ")
    }.`,
  );
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
): Promise<{ success: boolean; stdout: string; stderr: string }> {
  const result = await runGitBytes(cwd, args);
  return {
    success: result.success,
    stdout: new TextDecoder().decode(result.stdout),
    stderr: result.stderr,
  };
}

async function runGitBytes(
  cwd: string,
  args: readonly string[],
): Promise<{ success: boolean; stdout: Uint8Array; stderr: string }> {
  try {
    const output = await new Deno.Command("git", {
      cwd,
      args: [...args],
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
