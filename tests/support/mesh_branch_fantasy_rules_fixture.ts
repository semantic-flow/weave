import { dirname, fromFileUrl, join } from "@std/path";

const repoRootPath = fromFileUrl(new URL("../../", import.meta.url));
const fixtureRepoPath = join(
  repoRootPath,
  "dependencies",
  "github.com",
  "semantic-flow",
  "mesh-branch-fantasy-rules",
);
const frameworkRepoPath = join(
  repoRootPath,
  "dependencies",
  "github.com",
  "semantic-flow",
  "semantic-flow-framework",
);
const resolvedRefCache = new Map<string, Promise<string>>();
const LEGACY_SFCFG_NAMESPACE =
  "https://semantic-flow.github.io/ontology/config/";
const CURRENT_SFCFG_NAMESPACE = "https://semantic-flow.github.io/sflo/config/";
const SFLO_NAMESPACE = "https://semantic-flow.github.io/sflo/ontology/";
const REMOVED_CURRENT_ARTIFACT_RESOLUTION_MODE =
  `${SFLO_NAMESPACE}artifactResolutionMode_${"current"}`;
const REMOVED_PINNED_ARTIFACT_RESOLUTION_MODE =
  `${SFLO_NAMESPACE}artifactResolutionMode_${"pinned"}`;
const WORKING_ARTIFACT_RESOLUTION_MODE =
  `${SFLO_NAMESPACE}artifactResolutionMode_working`;

// Temporary Branch Fantasy Rules fixture-ladder setting until the replay
// prefix moves into an Accord/scenario master manifest.
export const MESH_BRANCH_FANTASY_RULES_LADDER_BRANCH_PREFIX = "a.";
export const MESH_BRANCH_FANTASY_RULES_BASE =
  "https://semantic-flow.github.io/mesh-branch-fantasy-rules/";

export const meshBranchFantasyRulesSourcePaths = [
  "ontology/fantasy-rules-ontology.ttl",
  "shacl/fantasy-rules-shacl.ttl",
  "examples/gunaar.ttl",
] as const;

export function resolveMeshBranchFantasyRulesFixtureRepoPath(): string {
  return fixtureRepoPath;
}

export function resolveMeshBranchFantasyRulesConformanceManifestPath(
  manifestName: string,
): string {
  return join(
    frameworkRepoPath,
    "examples",
    "branch-fantasy-rules",
    "conformance",
    manifestName,
  );
}

async function resolveMeshBranchFantasyRulesGitRef(
  ref: string,
): Promise<string> {
  const cached = resolvedRefCache.get(ref);
  if (cached) {
    return await cached;
  }

  const pending = resolveMeshBranchFantasyRulesGitRefUncached(ref);
  resolvedRefCache.set(ref, pending);

  try {
    return await pending;
  } catch (error) {
    resolvedRefCache.delete(ref);
    throw error;
  }
}

async function resolveMeshBranchFantasyRulesGitRefUncached(
  ref: string,
): Promise<string> {
  const prefixedRef = ref.startsWith(
      MESH_BRANCH_FANTASY_RULES_LADDER_BRANCH_PREFIX,
    )
    ? ref
    : `${MESH_BRANCH_FANTASY_RULES_LADDER_BRANCH_PREFIX}${ref}`;
  const candidates = ref.startsWith(
      MESH_BRANCH_FANTASY_RULES_LADDER_BRANCH_PREFIX,
    )
    ? [ref, `origin/${ref}`]
    : [prefixedRef, ref, `origin/${prefixedRef}`, `origin/${ref}`];

  for (const candidate of candidates) {
    const command = new Deno.Command("git", {
      args: [
        "-C",
        fixtureRepoPath,
        "rev-parse",
        "--verify",
        "--quiet",
        `${candidate}^{commit}`,
      ],
      stdout: "null",
      stderr: "null",
    });
    const output = await command.output();
    if (output.success) {
      return candidate;
    }
  }

  throw new Error(
    `Failed to resolve fixture ref ${ref} in ${fixtureRepoPath}; checked ${
      candidates.join(", ")
    }.`,
  );
}

export async function resolveMeshBranchFantasyRulesCommit(
  ref: string,
): Promise<string> {
  const resolvedRef = await resolveMeshBranchFantasyRulesGitRef(ref);
  const command = new Deno.Command("git", {
    args: ["-C", fixtureRepoPath, "rev-parse", `${resolvedRef}^{commit}`],
    stdout: "piped",
    stderr: "piped",
  });
  const output = await command.output();
  if (!output.success) {
    const message = new TextDecoder().decode(output.stderr).trim();
    throw new Error(`Failed to resolve fixture commit ${ref}: ${message}`);
  }
  return new TextDecoder().decode(output.stdout).trim();
}

export async function readMeshBranchFantasyRulesBranchFile(
  ref: string,
  path: string,
): Promise<string> {
  const resolvedRef = await resolveMeshBranchFantasyRulesGitRef(ref);
  const command = new Deno.Command("git", {
    args: ["-C", fixtureRepoPath, "show", `${resolvedRef}:${path}`],
    stdout: "piped",
    stderr: "piped",
  });
  const output = await command.output();
  if (!output.success) {
    const message = new TextDecoder().decode(output.stderr).trim();
    throw new Error(`Failed to read fixture file ${ref}:${path}: ${message}`);
  }
  return normalizeFixtureNamespaces(new TextDecoder().decode(output.stdout));
}

export async function listMeshBranchFantasyRulesBranchFiles(
  ref: string,
): Promise<string[]> {
  const resolvedRef = await resolveMeshBranchFantasyRulesGitRef(ref);
  const command = new Deno.Command("git", {
    args: ["-C", fixtureRepoPath, "ls-tree", "-r", "--name-only", resolvedRef],
    stdout: "piped",
    stderr: "piped",
  });
  const output = await command.output();
  if (!output.success) {
    const message = new TextDecoder().decode(output.stderr).trim();
    throw new Error(`Failed to list fixture files for ${ref}: ${message}`);
  }

  return new TextDecoder()
    .decode(output.stdout)
    .split("\n")
    .filter((path) => path.length > 0);
}

export async function materializeMeshBranchFantasyRulesBranch(
  ref: string,
  targetDir: string,
): Promise<string[]> {
  const paths = await listMeshBranchFantasyRulesBranchFiles(ref);

  for (const path of paths) {
    const absolutePath = join(targetDir, path);
    await Deno.mkdir(dirname(absolutePath), { recursive: true });
    await Deno.writeTextFile(
      absolutePath,
      await readMeshBranchFantasyRulesBranchFile(ref, path),
    );
  }

  return paths;
}

function normalizeFixtureNamespaces(contents: string): string {
  return contents
    .replaceAll(LEGACY_SFCFG_NAMESPACE, CURRENT_SFCFG_NAMESPACE)
    .replaceAll(
      REMOVED_CURRENT_ARTIFACT_RESOLUTION_MODE,
      WORKING_ARTIFACT_RESOLUTION_MODE,
    )
    .replaceAll(
      `  sflo:hasArtifactResolutionMode <${REMOVED_PINNED_ARTIFACT_RESOLUTION_MODE}> ;\n`,
      "",
    );
}
