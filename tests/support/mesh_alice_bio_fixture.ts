import { dirname, join } from "@std/path";

const fixtureRepoPath =
  "/home/djradon/hub/semantic-flow/weave/dependencies/github.com/semantic-flow/mesh-alice-bio";
const frameworkRepoPath =
  "/home/djradon/hub/semantic-flow/weave/dependencies/github.com/semantic-flow/semantic-flow-framework";

export function resolveMeshAliceBioFixtureRepoPath(): string {
  return fixtureRepoPath;
}

export function resolveMeshAliceBioConformanceManifestPath(
  manifestName: string,
): string {
  return `${frameworkRepoPath}/examples/alice-bio/conformance/${manifestName}`;
}

export async function readMeshAliceBioBranchFile(
  ref: string,
  path: string,
): Promise<string> {
  const command = new Deno.Command("git", {
    args: ["-C", fixtureRepoPath, "show", `${ref}:${path}`],
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

export async function listMeshAliceBioBranchFiles(
  ref: string,
): Promise<string[]> {
  const command = new Deno.Command("git", {
    args: ["-C", fixtureRepoPath, "ls-tree", "-r", "--name-only", ref],
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

export async function materializeMeshAliceBioBranch(
  ref: string,
  targetDir: string,
): Promise<string[]> {
  const paths = await listMeshAliceBioBranchFiles(ref);

  for (const path of paths) {
    const absolutePath = join(targetDir, path);
    await Deno.mkdir(dirname(absolutePath), { recursive: true });
    await Deno.writeTextFile(
      absolutePath,
      await readMeshAliceBioBranchFile(ref, path),
    );
  }

  return paths;
}
