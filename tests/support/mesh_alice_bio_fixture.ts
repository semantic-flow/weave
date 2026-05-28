import { fromFileUrl, join } from "@std/path";
import { FixtureSnapshotCache } from "./fixture_snapshot.ts";

const repoRootPath = fromFileUrl(new URL("../../", import.meta.url));
const fixtureRepoPath = join(
  repoRootPath,
  "dependencies",
  "github.com",
  "semantic-flow",
  "mesh-alice-bio",
);
const frameworkRepoPath = join(
  repoRootPath,
  "dependencies",
  "github.com",
  "semantic-flow",
  "semantic-flow-framework",
);
const fixtureSnapshots = new FixtureSnapshotCache({
  label: "mesh-alice-bio",
  repoPath: fixtureRepoPath,
  candidatesForRef: meshAliceBioRefCandidates,
});

// Temporary Alice fixture-ladder settings until the replay prefix and policy
// move into an Accord/scenario master manifest.
export const MESH_ALICE_BIO_LADDER_BRANCH_PREFIX = "a.";
export const MESH_ALICE_BIO_HISTORY_TRACKING_POLICY = "versioned";
export const MESH_ALICE_BIO_BASE =
  "https://semantic-flow.github.io/mesh-alice-bio/";

export function resolveMeshAliceBioFixtureRepoPath(): string {
  return fixtureRepoPath;
}

export async function isMeshAliceBioMeshRoot(
  meshRoot: string,
): Promise<boolean> {
  try {
    return (await Deno.readTextFile(join(meshRoot, "_mesh/_meta/meta.ttl")))
      .includes(MESH_ALICE_BIO_BASE);
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      return false;
    }
    throw error;
  }
}

export function resolveMeshAliceBioConformanceManifestPath(
  manifestName: string,
): string {
  return join(
    frameworkRepoPath,
    "examples",
    "alice-bio",
    "conformance",
    manifestName,
  );
}

function meshAliceBioRefCandidates(ref: string): string[] {
  const hasExplicitLadderPrefix = /^[a-z]\./.test(ref);
  const prefixedRef = hasExplicitLadderPrefix
    ? ref
    : `${MESH_ALICE_BIO_LADDER_BRANCH_PREFIX}${ref}`;
  return hasExplicitLadderPrefix
    ? [ref, `origin/${ref}`]
    : [prefixedRef, `origin/${prefixedRef}`];
}

export async function readMeshAliceBioBranchFile(
  ref: string,
  path: string,
): Promise<string> {
  return await fixtureSnapshots.readTextFile(ref, path);
}

export async function listMeshAliceBioBranchFiles(
  ref: string,
): Promise<string[]> {
  return await fixtureSnapshots.listFiles(ref);
}

export async function materializeMeshAliceBioBranch(
  ref: string,
  targetDir: string,
): Promise<string[]> {
  return await fixtureSnapshots.materialize(ref, targetDir);
}
