import { assertEquals, assertFalse, assertStringIncludes } from "@std/assert";
import { fromFileUrl, isAbsolute, relative } from "@std/path";
import { createTestTmpDir } from "./test_tmp.ts";

const repoRoot = fromFileUrl(new URL("../../", import.meta.url));
const harnessPath = fromFileUrl(
  new URL("./test_tmp_harness.ts", import.meta.url),
);

Deno.test("createTestTmpDir allocates outside the repository checkout", async () => {
  const path = await createTestTmpDir("weave-test-tmp-outside-repo-");

  assertFalse(
    isPathWithin(repoRoot, path),
    `${path} should be outside ${repoRoot}`,
  );
});

Deno.test("test tmp preload preserves original JUnit test locations", async () => {
  const root = await createTestTmpDir("weave-test-tmp-junit-");
  const testPath = `${root}/location_test.ts`;
  const junitPath = `${root}/junit.xml`;
  await Deno.writeTextFile(
    testPath,
    'Deno.test("location is the source file", () => {});\n',
  );

  const output = await new Deno.Command(Deno.execPath(), {
    args: [
      "test",
      `--preload=${harnessPath}`,
      `--junit-path=${junitPath}`,
      "--allow-env",
      "--allow-read",
      "--allow-write",
      testPath,
    ],
    stdout: "null",
    stderr: "piped",
  }).output();

  assertEquals(
    output.code,
    0,
    new TextDecoder().decode(output.stderr),
  );

  const junit = await Deno.readTextFile(junitPath);
  assertStringIncludes(junit, 'name="location is the source file"');
  assertStringIncludes(junit, "location_test.ts");
  assertFalse(
    junit.includes('classname="./tests/support/test_tmp.ts"'),
    "JUnit should not attribute wrapped tests to the preload helper",
  );
});

function isPathWithin(parent: string, child: string): boolean {
  const relativePath = relative(parent, child);
  return relativePath === "" ||
    (!relativePath.startsWith("..") && !isAbsolute(relativePath));
}
