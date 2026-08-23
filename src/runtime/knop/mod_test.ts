import { assertEquals } from "@std/assert";
import * as knopRuntime from "./mod.ts";

Deno.test("Knop runtime public barrel withholds the atomic failure-injection seam", () => {
  assertEquals("executeKnopCreateForTesting" in knopRuntime, false);
});
