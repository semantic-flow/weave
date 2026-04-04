import { fromFileUrl, join } from "@std/path";

const repoRoot = fromFileUrl(new URL("../../", import.meta.url));
const testTmpRoot = join(repoRoot, ".test-tmp");

export async function createTestTmpDir(prefix: string): Promise<string> {
  await Deno.mkdir(testTmpRoot, { recursive: true });
  return await Deno.makeTempDir({
    dir: testTmpRoot,
    prefix,
  });
}
