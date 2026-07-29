import { assertEquals } from "@std/assert";
import {
  WEAVE_DEFAULT_APPLICATION_TURTLE,
  WEAVE_DEFAULT_CONFIG_RESOLUTION_TURTLE,
} from "./weave_defaults.ts";

const DEFAULTS_ROOT = new URL("../../../../defaults/", import.meta.url);

Deno.test("embedded weave defaults are byte-identical to defaults/*.ttl", async () => {
  assertEquals(
    WEAVE_DEFAULT_APPLICATION_TURTLE,
    await Deno.readTextFile(new URL("application.ttl", DEFAULTS_ROOT)),
    "defaults/application.ttl drifted from the embedded module; run: deno task embed:defaults",
  );
  assertEquals(
    WEAVE_DEFAULT_CONFIG_RESOLUTION_TURTLE,
    await Deno.readTextFile(new URL("config-resolution.ttl", DEFAULTS_ROOT)),
    "defaults/config-resolution.ttl drifted from the embedded module; run: deno task embed:defaults",
  );
});
