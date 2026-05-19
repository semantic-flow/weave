import { assert, assertEquals, assertRejects } from "@std/assert";
import { fromFileUrl, join, relative } from "@std/path";
import { createTestTmpDir } from "../support/test_tmp.ts";

const repoRoot = new URL("../../", import.meta.url);
const cliPath = fromFileUrl(new URL("src/main.ts", repoRoot));

Deno.test("weave prepare gh-pages prepares a publication root as a black-box CLI run", async () => {
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
    "prepare",
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
  assert(firstStdout.includes("Created 3 mesh support artifacts"), firstStdout);
  assert(!firstStdout.includes("_mesh/_config/config.ttl"), firstStdout);
  assert(firstStdout.includes(".nojekyll"), firstStdout);
  assertEquals(
    await listRelativeFiles(sourceRoot, ".weave/"),
    ["ontology/fantasy-rules-ontology.ttl"],
  );
  assertEquals(
    await listRelativeFiles(publishRoot, ".weave/"),
    [
      ".nojekyll",
      "_mesh/_inventory/inventory.ttl",
      "_mesh/_meta/meta.ttl",
    ],
  );
  await assertRejects(
    () => Deno.stat(join(publishRoot, "_mesh/_config/config.ttl")),
    Deno.errors.NotFound,
  );

  const secondOutput = await runCli([
    "prepare",
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
  assert(secondStdout.includes("already prepared"), secondStdout);

  await Deno.writeTextFile(
    join(publishRoot, "host-control.txt"),
    "custom host metadata\n",
  );
  const thirdOutput = await runCli([
    "prepare",
    "gh-pages",
    "--source-root",
    sourceRoot,
    "--publish-root",
    publishRoot,
    "--mesh-base",
    "https://semantic-flow.github.io/mesh-sidecar-fantasy-rules/",
  ]);
  const thirdStdout = new TextDecoder().decode(thirdOutput.stdout);
  const thirdStderr = new TextDecoder().decode(thirdOutput.stderr);

  assert(thirdOutput.success, thirdStderr);
  assert(thirdStdout.includes("already prepared"), thirdStdout);
  assertEquals(
    await Deno.readTextFile(join(publishRoot, "host-control.txt")),
    "custom host metadata\n",
  );
});

Deno.test("weave prepare gh-pages updates a clean publication worktree without local log clutter", async () => {
  const tempRoot = await createTestTmpDir("weave-e2e-deploy-gh-pages-git-");
  const sourceRoot = join(tempRoot, "source");
  const publishRoot = join(tempRoot, "gh-pages");
  await Deno.mkdir(sourceRoot, { recursive: true });
  await Deno.mkdir(publishRoot, { recursive: true });
  await runGit(publishRoot, ["init"]);
  await runGit(publishRoot, ["config", "user.email", "weave@example.invalid"]);
  await runGit(publishRoot, ["config", "user.name", "Weave Test"]);
  await runGit(publishRoot, ["commit", "--allow-empty", "-m", "initial"]);

  const output = await runCli([
    "prepare",
    "gh-pages",
    "--source-root",
    sourceRoot,
    "--publish-root",
    publishRoot,
    "--mesh-base",
    "https://semantic-flow.github.io/mesh-sidecar-fantasy-rules/",
  ]);
  const stdout = new TextDecoder().decode(output.stdout);
  const stderr = new TextDecoder().decode(output.stderr);

  assert(output.success, stderr);
  assert(stdout.includes("_mesh/_inventory/inventory.ttl"), stdout);
  assert(!stdout.includes("_mesh/_config/config.ttl"), stdout);
  const status = await gitOutput(publishRoot, ["status", "--short"]);
  assert(status.includes("?? _mesh/"), status);
  assert(!status.includes(".weave/"), status);
});

Deno.test("weave prepare gh-pages --commit creates a local publication commit", async () => {
  const tempRoot = await createTestTmpDir(
    "weave-e2e-deploy-gh-pages-commit-",
  );
  const sourceRoot = join(tempRoot, "source");
  const publishRoot = join(tempRoot, "gh-pages");
  await Deno.mkdir(sourceRoot, { recursive: true });
  await Deno.mkdir(publishRoot, { recursive: true });
  await runGit(publishRoot, ["init"]);
  await runGit(publishRoot, ["config", "user.email", "weave@example.invalid"]);
  await runGit(publishRoot, ["config", "user.name", "Weave Test"]);
  await runGit(publishRoot, ["commit", "--allow-empty", "-m", "initial"]);

  const output = await runCli([
    "prepare",
    "gh-pages",
    "--source-root",
    sourceRoot,
    "--publish-root",
    publishRoot,
    "--mesh-base",
    "https://semantic-flow.github.io/mesh-sidecar-fantasy-rules/",
    "--commit",
    "--commit-message",
    "publish mesh",
  ]);
  const stdout = new TextDecoder().decode(output.stdout);
  const stderr = new TextDecoder().decode(output.stderr);

  assert(output.success, stderr);
  assert(stdout.includes("Created local publication commit"), stdout);
  assert(
    stdout.includes(
      "Push the publication branch for GitHub Pages to update.",
    ),
    stdout,
  );
  assertEquals(await gitOutput(publishRoot, ["status", "--short"]), "");
  assertEquals(
    await gitOutput(publishRoot, ["log", "-1", "--pretty=%s"]),
    "publish mesh",
  );
});

Deno.test("weave prepare gh-pages --dry-run prints a plan without writing publication files", async () => {
  const tempRoot = await createTestTmpDir(
    "weave-e2e-deploy-gh-pages-dry-run-",
  );
  const sourceRoot = join(tempRoot, "source");
  const publishRoot = join(tempRoot, "gh-pages");
  const sourcePath = "ontology/fantasy-rules-ontology.ttl";
  const source = `@prefix owl: <http://www.w3.org/2002/07/owl#> .
@prefix fantasy: <https://semantic-flow.github.io/mesh-sidecar-fantasy-rules/ontology/> .

<> a owl:Ontology .
fantasy:Rule a owl:Class .
`;

  await Deno.mkdir(join(sourceRoot, "ontology"), { recursive: true });
  await Deno.mkdir(publishRoot, { recursive: true });
  await Deno.writeTextFile(join(sourceRoot, sourcePath), source);
  await Deno.writeTextFile(join(publishRoot, "manual.txt"), "keep me\n");

  const output = await runCli([
    "prepare",
    "gh-pages",
    "--dry-run",
    "--source-root",
    sourceRoot,
    "--publish-root",
    publishRoot,
    "--mesh-base",
    "https://semantic-flow.github.io/mesh-sidecar-fantasy-rules/",
    "--source-path",
    sourcePath,
    "--payload-history-segment",
    "release",
    "--payload-state-segment",
    "v0.1.0",
    "--payload-manifestation-segment",
    "ttl",
    "--designator-path",
    "ontology",
    "--source-repository-url",
    "https://github.com/semantic-flow/mesh-sidecar-fantasy-rules.git",
    "--source-ref",
    "main",
  ]);
  const stdout = new TextDecoder().decode(output.stdout);
  const stderr = new TextDecoder().decode(output.stderr);

  assert(output.success, stderr);
  assert(
    stdout.includes("Dry run: branch-published GitHub Pages preparation"),
    stdout,
  );
  assert(stdout.includes("Source root:"), stdout);
  assert(stdout.includes("Publication root:"), stdout);
  assert(stdout.includes("Created paths:"), stdout);
  assert(!stdout.includes("_mesh/_config/config.ttl"), stdout);
  assert(stdout.includes(sourcePath), stdout);
  assert(stdout.includes("Preserved paths:"), stdout);
  assert(stdout.includes("manual.txt"), stdout);
  assert(stdout.includes("Git operations:"), stdout);
  assert(stdout.includes("will not commit or push"), stdout);
  assertEquals(await listRelativeFiles(publishRoot, ".weave/"), [
    "manual.txt",
  ]);
});

Deno.test("weave prepare gh-pages materializes one repository source from CLI flags", async () => {
  const tempRoot = await createTestTmpDir("weave-e2e-deploy-gh-pages-source-");
  const sourceRoot = join(tempRoot, "source");
  const publishRoot = join(tempRoot, "gh-pages");
  const sourcePath = "ontology/fantasy-rules-ontology.ttl";
  const source = `@prefix owl: <http://www.w3.org/2002/07/owl#> .
@prefix fantasy: <https://semantic-flow.github.io/mesh-sidecar-fantasy-rules/ontology/> .

<> a owl:Ontology .
fantasy:Rule a owl:Class .
`;
  await Deno.mkdir(join(sourceRoot, "ontology"), { recursive: true });
  await Deno.mkdir(publishRoot, { recursive: true });
  await Deno.writeTextFile(join(sourceRoot, sourcePath), source);

  const output = await runCli([
    "prepare",
    "gh-pages",
    "--source-root",
    sourceRoot,
    "--publish-root",
    publishRoot,
    "--mesh-base",
    "https://semantic-flow.github.io/mesh-sidecar-fantasy-rules/",
    "--source-path",
    sourcePath,
    "--payload-history-segment",
    "release",
    "--payload-state-segment",
    "v0.1.0",
    "--payload-manifestation-segment",
    "ttl",
    "--designator-path",
    "ontology",
    "--source-repository-url",
    "https://github.com/semantic-flow/mesh-sidecar-fantasy-rules.git",
    "--source-ref",
    "main",
    "--source-commit",
    "abc123",
  ]);
  const stdout = new TextDecoder().decode(output.stdout);
  const stderr = new TextDecoder().decode(output.stderr);

  assert(output.success, stderr);
  assert(
    stdout.includes(
      `Materialized ${sourcePath} as ontology.`,
    ),
    stdout,
  );
  assert(stdout.includes("ontology/_knop/_inventory/inventory.ttl"), stdout);
  assert(
    stdout.includes(
      "ontology/release/v0.1.0/ttl/fantasy-rules-ontology.ttl",
    ),
    stdout,
  );
  assertEquals(await Deno.readTextFile(join(publishRoot, sourcePath)), source);
  assertEquals(await listRelativeFiles(sourceRoot, ".weave/"), [sourcePath]);

  const sources = await Deno.readTextFile(
    join(publishRoot, "ontology/_knop/_sources/sources.ttl"),
  );
  await assertRejects(
    () => Deno.stat(join(publishRoot, "_mesh/_config/config.ttl")),
    Deno.errors.NotFound,
  );
  assert(
    sources.includes(
      "<ontology/_knop/_sources#branch-source-ontology>",
    ),
    sources,
  );
  assert(
    sources.includes(
      "sflo:hasTargetArtifact <https://semantic-flow.github.io/mesh-sidecar-fantasy-rules/ontology>",
    ),
    sources,
  );
  assert(!sources.includes("sflo:hasTargetArtifact <ontology>"));
  assert(sources.includes('sflo:sourceRepositoryRef "main"'), sources);
  assert(sources.includes('sflo:sourceRepositoryCommit "abc123"'), sources);
  assert(!sources.includes(sourceRoot), sources);
  assert(!sources.includes(publishRoot), sources);
  assert(!sources.includes("../"), sources);
});

Deno.test("weave prepare gh-pages fails closed without a non-interactive publish root", async () => {
  const tempRoot = await createTestTmpDir(
    "weave-e2e-deploy-gh-pages-missing-root-",
  );
  const sourceRoot = join(tempRoot, "source");
  await Deno.mkdir(sourceRoot, { recursive: true });

  const output = await runCli([
    "prepare",
    "gh-pages",
    "--source-root",
    sourceRoot,
    "--mesh-base",
    "https://semantic-flow.github.io/mesh-sidecar-fantasy-rules/",
  ], { stdin: "null" });
  const stdout = new TextDecoder().decode(output.stdout);
  const stderr = new TextDecoder().decode(output.stderr);

  assert(!output.success, stdout);
  assert(stderr.includes("prepare gh-pages requires --publish-root"), stderr);
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
      "--allow-run=git",
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

async function runGit(cwd: string, args: readonly string[]): Promise<void> {
  const output = await new Deno.Command("git", {
    cwd,
    args: [...args],
  }).output();
  if (!output.success) {
    throw new Error(
      `git ${args.join(" ")} failed:\n${
        new TextDecoder().decode(output.stderr)
      }`,
    );
  }
}

async function gitOutput(
  cwd: string,
  args: readonly string[],
): Promise<string> {
  const output = await new Deno.Command("git", {
    cwd,
    args: [...args],
  }).output();
  if (!output.success) {
    throw new Error(
      `git ${args.join(" ")} failed:\n${
        new TextDecoder().decode(output.stderr)
      }`,
    );
  }
  return new TextDecoder().decode(output.stdout).trim();
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
