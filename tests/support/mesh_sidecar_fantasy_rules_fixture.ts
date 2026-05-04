import { dirname, fromFileUrl, join } from "@std/path";

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
const resolvedRefCache = new Map<string, Promise<string>>();

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

async function resolveMeshSidecarFantasyRulesGitRef(
  ref: string,
): Promise<string> {
  const cached = resolvedRefCache.get(ref);
  if (cached) {
    return await cached;
  }

  const pending = resolveMeshSidecarFantasyRulesGitRefUncached(ref);
  resolvedRefCache.set(ref, pending);

  try {
    return await pending;
  } catch (error) {
    resolvedRefCache.delete(ref);
    throw error;
  }
}

async function resolveMeshSidecarFantasyRulesGitRefUncached(
  ref: string,
): Promise<string> {
  const candidates = [ref, `origin/${ref}`];

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

export async function readMeshSidecarFantasyRulesBranchFile(
  ref: string,
  path: string,
): Promise<string> {
  const resolvedRef = await resolveMeshSidecarFantasyRulesGitRef(ref);
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
  return new TextDecoder().decode(output.stdout);
}

export async function listMeshSidecarFantasyRulesBranchFiles(
  ref: string,
): Promise<string[]> {
  const resolvedRef = await resolveMeshSidecarFantasyRulesGitRef(ref);
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

export async function materializeMeshSidecarFantasyRulesBranch(
  ref: string,
  targetDir: string,
): Promise<string[]> {
  const paths = await listMeshSidecarFantasyRulesBranchFiles(ref);

  for (const path of paths) {
    const absolutePath = join(targetDir, path);
    await Deno.mkdir(dirname(absolutePath), { recursive: true });
    await Deno.writeTextFile(
      absolutePath,
      await readMeshSidecarFantasyRulesBranchFile(ref, path),
    );
  }

  return paths;
}
