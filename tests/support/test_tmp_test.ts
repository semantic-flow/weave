import { assertFalse } from "@std/assert";
import { fromFileUrl, isAbsolute, relative } from "@std/path";
import { createTestTmpDir } from "./test_tmp.ts";

const repoRoot = fromFileUrl(new URL("../../", import.meta.url));

Deno.test("createTestTmpDir allocates outside the repository checkout", async () => {
  const path = await createTestTmpDir("weave-test-tmp-outside-repo-");

  assertFalse(
    isPathWithin(repoRoot, path),
    `${path} should be outside ${repoRoot}`,
  );
});

function isPathWithin(parent: string, child: string): boolean {
  const relativePath = relative(parent, child);
  return relativePath === "" ||
    (!relativePath.startsWith("..") && !isAbsolute(relativePath));
}
