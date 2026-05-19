import { assert, assertEquals } from "@std/assert";
import { fromFileUrl } from "@std/path";

const repoRoot = new URL("../../", import.meta.url);
const cliPath = fromFileUrl(new URL("src/main.ts", repoRoot));

Deno.test("weave prepare gh-pages is no longer a CLI command", async () => {
  const output = await new Deno.Command(Deno.execPath(), {
    args: ["run", "-A", cliPath, "prepare", "gh-pages"],
    stdout: "piped",
    stderr: "piped",
  }).output();
  const stderr = new TextDecoder().decode(output.stderr);

  assertEquals(output.success, false);
  assert(stderr.includes("Unknown command"), stderr);
});
