import { assertEquals } from "@std/assert";
import { createTestTmpDir } from "../../../tests/support/test_tmp.ts";
import {
  decodeInlineRawSourceContents,
  readRawSourcePanel,
} from "./raw_source_panels.ts";

const MEBIBYTE = 1024 * 1024;

Deno.test(
  "readRawSourcePanel inlines text above the old 1 MiB limit (regression)",
  async () => {
    const root = await createTestTmpDir("weave-raw-source-inline-");
    const path = `${root}/source.ttl`;
    const byteLength = Math.floor(1.5 * MEBIBYTE);
    await Deno.writeFile(path, new Uint8Array(byteLength).fill(0x61));

    const panel = await readRawSourcePanel(
      path,
      "source.ttl",
      "Source graph",
    );

    assertEquals(panel.label, "Source graph");
    assertEquals(panel.sourcePath, "source.ttl");
    assertEquals(panel.contents?.length, byteLength);
    assertEquals(panel.omittedByteLength, undefined);
  },
);

Deno.test("readRawSourcePanel omits text above the 4 MiB limit", async () => {
  const root = await createTestTmpDir("weave-raw-source-omitted-");
  const path = `${root}/source.ttl`;
  const byteLength = 4 * MEBIBYTE + 1;
  await Deno.writeFile(path, new Uint8Array(byteLength).fill(0x61));

  assertEquals(
    await readRawSourcePanel(path, "source.ttl", "Source graph"),
    {
      label: "Source graph",
      sourcePath: "source.ttl",
      omittedByteLength: byteLength,
    },
  );
});

Deno.test("readRawSourcePanel reuses command-scoped source contents", async () => {
  const root = await createTestTmpDir("weave-raw-source-cache-");
  const path = `${root}/source.ttl`;
  const readCache = new Map();
  await Deno.writeTextFile(path, "<term> <predicate> <object> .\n");

  const first = await readRawSourcePanel(
    path,
    "first-source.ttl",
    "First source",
    readCache,
  );
  await Deno.remove(path);
  const second = await readRawSourcePanel(
    path,
    "second-source.ttl",
    "Second source",
    readCache,
  );

  assertEquals(first.contents, "<term> <predicate> <object> .\n");
  assertEquals(second, {
    label: "Second source",
    sourcePath: "second-source.ttl",
    contents: first.contents,
  });
});

Deno.test("decodeInlineRawSourceContents accepts valid UTF-8 text", () => {
  const bytes = new TextEncoder().encode("# Alice\n\nText source.\n");

  assertEquals(
    decodeInlineRawSourceContents(bytes),
    "# Alice\n\nText source.\n",
  );
});

Deno.test("decodeInlineRawSourceContents rejects NUL bytes", () => {
  assertEquals(
    decodeInlineRawSourceContents(new Uint8Array([0x61, 0, 0x62])),
    undefined,
  );
});

Deno.test("decodeInlineRawSourceContents rejects invalid UTF-8", () => {
  assertEquals(
    decodeInlineRawSourceContents(new Uint8Array([0xc3, 0x28])),
    undefined,
  );
});
