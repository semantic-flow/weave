import { fromFileUrl, join } from "@std/path";
import { FixtureSnapshotCache } from "./fixture_snapshot.ts";

const repoRootPath = fromFileUrl(new URL("../../", import.meta.url));
const fixtureRepoPath = join(
  repoRootPath,
  "dependencies",
  "github.com",
  "semantic-flow",
  "mesh-sidecar-fantasy-rules",
);
const frameworkRepoPath = join(
  repoRootPath,
  "dependencies",
  "github.com",
  "semantic-flow",
  "semantic-flow-framework",
);
const fixtureSnapshots = new FixtureSnapshotCache({
  label: "mesh-sidecar-fantasy-rules",
  repoPath: fixtureRepoPath,
  candidatesForRef: meshSidecarFantasyRulesRefCandidates,
});

// Temporary Sidecar Fantasy Rules fixture-ladder setting until the replay
// prefix moves into an Accord/scenario master manifest.
export const MESH_SIDECAR_FANTASY_RULES_LADDER_BRANCH_PREFIX = "a.";
export const MESH_SIDECAR_FANTASY_RULES_BASE =
  "https://semantic-flow.github.io/mesh-sidecar-fantasy-rules/";

export function resolveMeshSidecarFantasyRulesFixtureRepoPath(): string {
  return fixtureRepoPath;
}

export function resolveMeshSidecarFantasyRulesConformanceManifestPath(
  manifestName: string,
): string {
  return join(
    frameworkRepoPath,
    "examples",
    "sidecar-fantasy-rules",
    "conformance",
    manifestName,
  );
}

function meshSidecarFantasyRulesRefCandidates(ref: string): string[] {
  const prefixedRef = ref.startsWith(
      MESH_SIDECAR_FANTASY_RULES_LADDER_BRANCH_PREFIX,
    )
    ? ref
    : `${MESH_SIDECAR_FANTASY_RULES_LADDER_BRANCH_PREFIX}${ref}`;
  return ref.startsWith(
      MESH_SIDECAR_FANTASY_RULES_LADDER_BRANCH_PREFIX,
    )
    ? [ref, `origin/${ref}`]
    : [prefixedRef, ref, `origin/${prefixedRef}`, `origin/${ref}`];
}

export async function readMeshSidecarFantasyRulesBranchFile(
  ref: string,
  path: string,
): Promise<string> {
  return await fixtureSnapshots.readTextFile(ref, path);
}

export async function listMeshSidecarFantasyRulesBranchFiles(
  ref: string,
): Promise<string[]> {
  return await fixtureSnapshots.listFiles(ref);
}

export async function materializeMeshSidecarFantasyRulesBranch(
  ref: string,
  targetDir: string,
): Promise<string[]> {
  return await fixtureSnapshots.materialize(ref, targetDir);
}
