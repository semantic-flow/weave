import { assertEquals } from "@std/assert";
import { coverageDir } from "../../scripts/coverage-paths.ts";
import { prepareCoverageDir } from "../../scripts/prepare-coverage-dir.ts";

Deno.test("prepareCoverageDir creates the shared temp coverage directory", async () => {
  await prepareCoverageDir();

  const stat = await Deno.stat(coverageDir);
  assertEquals(stat.isDirectory, true);
});
