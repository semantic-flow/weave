import { fromFileUrl, join } from "@std/path";
import { FixtureSnapshotCache } from "./fixture_snapshot.ts";

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
const fixtureSnapshots = new FixtureSnapshotCache({
  label: "mesh-branch-fantasy-rules",
  repoPath: fixtureRepoPath,
  candidatesForRef: meshBranchFantasyRulesRefCandidates,
});

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

function meshBranchFantasyRulesRefCandidates(ref: string): string[] {
  const prefixedRef = ref.startsWith(
      MESH_BRANCH_FANTASY_RULES_LADDER_BRANCH_PREFIX,
    )
    ? ref
    : `${MESH_BRANCH_FANTASY_RULES_LADDER_BRANCH_PREFIX}${ref}`;
  return ref.startsWith(
      MESH_BRANCH_FANTASY_RULES_LADDER_BRANCH_PREFIX,
    )
    ? [ref, `origin/${ref}`]
    : [prefixedRef, ref, `origin/${prefixedRef}`, `origin/${ref}`];
}

export async function resolveMeshBranchFantasyRulesCommit(
  ref: string,
): Promise<string> {
  return await fixtureSnapshots.resolveCommit(ref);
}

export async function readMeshBranchFantasyRulesBranchFile(
  ref: string,
  path: string,
): Promise<string> {
  return await fixtureSnapshots.readTextFile(ref, path);
}

export async function listMeshBranchFantasyRulesBranchFiles(
  ref: string,
): Promise<string[]> {
  return await fixtureSnapshots.listFiles(ref);
}

export async function materializeMeshBranchFantasyRulesBranch(
  ref: string,
  targetDir: string,
): Promise<string[]> {
  return await fixtureSnapshots.materialize(ref, targetDir);
}

export async function materializeMeshBranchFantasyRulesPublicationWorkspace(
  ref: string,
  targetDir: string,
  sourceRef = "10-first-release-source",
): Promise<{ publicationRoot: string; sourceRoot: string }> {
  const publicationRoot = join(targetDir, "publication");
  const sourceRoot = join(targetDir, "source");
  await materializeMeshBranchFantasyRulesBranch(ref, publicationRoot);
  await materializeMeshBranchFantasyRulesBranch(sourceRef, sourceRoot);
  return { publicationRoot, sourceRoot };
}
