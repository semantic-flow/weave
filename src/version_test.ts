import { assert, assertEquals } from "@std/assert";
import { WEAVE_VERSION } from "./version.ts";

Deno.test("WEAVE_VERSION matches root deno.json version", async () => {
  const denoConfig = JSON.parse(
    await Deno.readTextFile(new URL("../deno.json", import.meta.url)),
  ) as { version?: unknown };

  assertEquals(WEAVE_VERSION, denoConfig.version);
});

Deno.test("WEAVE_VERSION is semver-compatible", () => {
  assert(
    /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(
      WEAVE_VERSION,
    ),
  );
});
