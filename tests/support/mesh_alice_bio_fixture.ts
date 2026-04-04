const fixtureRepoPath =
  "/home/djradon/hub/semantic-flow/weave/dependencies/github.com/semantic-flow/mesh-alice-bio";

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
