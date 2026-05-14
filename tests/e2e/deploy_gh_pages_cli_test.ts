import { assert, assertEquals } from "@std/assert";
import { join, relative } from "@std/path";
import { createTestTmpDir } from "../support/test_tmp.ts";

const repoRoot = new URL("../../", import.meta.url);
const cliPath = new URL("src/main.ts", repoRoot).pathname;

Deno.test("weave deploy gh-pages bootstraps a publication root as a black-box CLI run", async () => {
  const tempRoot = await createTestTmpDir("weave-e2e-deploy-gh-pages-");
  const sourceRoot = join(tempRoot, "source");
  const publishRoot = join(tempRoot, "gh-pages");
  await Deno.mkdir(join(sourceRoot, "ontology"), { recursive: true });
  await Deno.mkdir(publishRoot, { recursive: true });
  await Deno.writeTextFile(
    join(sourceRoot, "ontology/fantasy-rules-ontology.ttl"),
    "# source ontology stays on the source branch\n",
  );

  const firstOutput = await runCli([
    "deploy",
    "gh-pages",
    "--source-root",
    sourceRoot,
    "--publish-root",
    publishRoot,
    "--mesh-base",
    "https://semantic-flow.github.io/mesh-sidecar-fantasy-rules/",
  ]);
  const firstStdout = new TextDecoder().decode(firstOutput.stdout);
  const firstStderr = new TextDecoder().decode(firstOutput.stderr);

  assert(firstOutput.success, firstStderr);
  assert(firstStdout.includes("Created 4 mesh support artifacts"), firstStdout);
  assert(firstStdout.includes("_mesh/_config/config.ttl"), firstStdout);
  assert(firstStdout.includes(".nojekyll"), firstStdout);
  assertEquals(
    await listRelativeFiles(sourceRoot, ".weave/"),
    ["ontology/fantasy-rules-ontology.ttl"],
  );
  assertEquals(
    await listRelativeFiles(publishRoot, ".weave/"),
    [
      ".nojekyll",
      "_mesh/_config/config.ttl",
      "_mesh/_inventory/inventory.ttl",
      "_mesh/_meta/meta.ttl",
    ],
  );

  const secondOutput = await runCli([
    "deploy",
    "gh-pages",
    "--source-root",
    sourceRoot,
    "--publish-root",
    publishRoot,
    "--mesh-base",
    "https://semantic-flow.github.io/mesh-sidecar-fantasy-rules/",
  ]);
  const secondStdout = new TextDecoder().decode(secondOutput.stdout);
  const secondStderr = new TextDecoder().decode(secondOutput.stderr);

  assert(secondOutput.success, secondStderr);
  assert(secondStdout.includes("already bootstrapped"), secondStdout);
});

Deno.test("weave deploy gh-pages fails closed without a non-interactive publish root", async () => {
  const tempRoot = await createTestTmpDir(
    "weave-e2e-deploy-gh-pages-missing-root-",
  );
  const sourceRoot = join(tempRoot, "source");
  await Deno.mkdir(sourceRoot, { recursive: true });

  const output = await runCli([
    "deploy",
    "gh-pages",
    "--source-root",
    sourceRoot,
    "--mesh-base",
    "https://semantic-flow.github.io/mesh-sidecar-fantasy-rules/",
  ], { stdin: "null" });
  const stdout = new TextDecoder().decode(output.stdout);
  const stderr = new TextDecoder().decode(output.stderr);

  assert(!output.success, stdout);
  assert(stderr.includes("deploy gh-pages requires --publish-root"), stderr);
});

function runCli(
  args: readonly string[],
  options?: { stdin?: "null" | "inherit" | "piped" },
): Promise<Deno.CommandOutput> {
  const command = new Deno.Command("deno", {
    args: [
      "run",
      "--allow-read",
      "--allow-write",
      "--allow-env",
      cliPath,
      ...args,
    ],
    cwd: new URL(".", repoRoot),
    stdin: options?.stdin,
    stdout: "piped",
    stderr: "piped",
  });
  return command.output();
}

async function listRelativeFiles(
  root: string,
  excludedPrefix: string,
): Promise<string[]> {
  const paths: string[] = [];

  for await (const entry of walkFiles(root)) {
    const rel = relative(root, entry).replaceAll("\\", "/");
    if (rel.startsWith(excludedPrefix)) {
      continue;
    }
    paths.push(rel);
  }

  return paths.sort();
}

async function* walkFiles(root: string): AsyncGenerator<string> {
  for await (const entry of Deno.readDir(root)) {
    const path = join(root, entry.name);
    if (entry.isDirectory) {
      yield* walkFiles(path);
      continue;
    }
    if (entry.isFile) {
      yield path;
    }
  }
}
