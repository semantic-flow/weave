import {
  assert,
  assertEquals,
  assertRejects,
  assertStringIncludes,
} from "@std/assert";
import { join } from "@std/path";
import { executeMeshCreate } from "../../src/runtime/mesh/create.ts";
import { createTestTmpDir } from "../support/test_tmp.ts";

const repoRoot = new URL("../../", import.meta.url);

Deno.test("weave import materializes a local Markdown file as a black-box CLI run", async () => {
  const workspaceRoot = await createTestTmpDir("weave-e2e-import-");
  await executeMeshCreate({
    workspaceRoot,
    meshRoot: ".",
    request: {
      meshBase: "https://semantic-flow.github.io/mesh-alice-bio/",
    },
  });
  const sourceRoot = await createTestTmpDir("weave-e2e-import-source-");
  const sourcePath = join(sourceRoot, "bob.md");
  await Deno.writeTextFile(sourcePath, "# Bob\n");

  const command = new Deno.Command("deno", {
    args: [
      "run",
      "--allow-read",
      "--allow-write",
      "--allow-env",
      "src/main.ts",
      "import",
      sourcePath,
      "bob/page-main",
      "--working-file",
      "bob-page-main.md",
      "--mesh-root",
      workspaceRoot,
    ],
    cwd: new URL(".", repoRoot),
    stdout: "piped",
    stderr: "piped",
  });
  const output = await command.output();
  const stdout = new TextDecoder().decode(output.stdout);
  const stderr = new TextDecoder().decode(output.stderr);

  assert(output.success, stderr);
  assertStringIncludes(stdout, "Imported bob-page-main.md");
  assertStringIncludes(stdout, "bob/page-main/_knop/_sources/sources.ttl");
  assertEquals(
    await Deno.readTextFile(join(workspaceRoot, "bob-page-main.md")),
    "# Bob\n",
  );
  const sources = await Deno.readTextFile(
    join(workspaceRoot, "bob/page-main/_knop/_sources/sources.ttl"),
  );
  assertStringIncludes(
    sources,
    "<bob/page-main/_knop/_sources#payload-source> a sflo:ImportSource ;",
  );
  assertEquals(sources.includes(sourceRoot), false);
});

Deno.test("weave import rejects conflicting designator paths before logging or execution", async () => {
  const workspaceRoot = await createTestTmpDir("weave-e2e-import-conflict-");
  await executeMeshCreate({
    workspaceRoot,
    meshRoot: ".",
    request: {
      meshBase: "https://semantic-flow.github.io/mesh-alice-bio/",
    },
  });
  await Deno.writeTextFile(join(workspaceRoot, "source.md"), "# Bob\n");

  const command = new Deno.Command("deno", {
    args: [
      "run",
      "--allow-read",
      "--allow-write",
      "--allow-env",
      "src/main.ts",
      "import",
      "source.md",
      "bob/page-main",
      "--designator-path",
      "alice/page-main",
      "--working-file",
      "bob-page-main.md",
      "--mesh-root",
      workspaceRoot,
    ],
    cwd: new URL(".", repoRoot),
    stdout: "piped",
    stderr: "piped",
  });
  const output = await command.output();
  const stderr = new TextDecoder().decode(output.stderr);

  assertEquals(output.success, false);
  assert(
    stderr.includes("import received conflicting designator paths"),
    stderr,
  );
  await assertRejects(
    () => Deno.stat(join(workspaceRoot, ".weave/logs/security-audit.jsonl")),
    Deno.errors.NotFound,
  );
  await assertRejects(
    () => Deno.stat(join(workspaceRoot, "bob-page-main.md")),
    Deno.errors.NotFound,
  );
});
