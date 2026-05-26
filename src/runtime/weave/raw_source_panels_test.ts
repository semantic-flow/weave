import { assertEquals } from "@std/assert";
import { decodeInlineRawSourceContents } from "./raw_source_panels.ts";

Deno.test("decodeInlineRawSourceContents accepts valid UTF-8 text", () => {
  const bytes = new TextEncoder().encode("# Alice\n\nText source.\n");

  assertEquals(
    decodeInlineRawSourceContents(bytes),
    "# Alice\n\nText source.\n",
  );
});

Deno.test("decodeInlineRawSourceContents rejects binary-ish bytes", () => {
  assertEquals(
    decodeInlineRawSourceContents(new Uint8Array([0, 1, 2, 3, 255])),
    undefined,
  );
});
