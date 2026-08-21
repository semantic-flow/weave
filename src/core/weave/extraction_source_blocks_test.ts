import { assertEquals, assertStringIncludes } from "@std/assert";
import { renderExactExtractionSourceBlock } from "./extraction_source_blocks.ts";

Deno.test("renderExactExtractionSourceBlock omits empty observation links", () => {
  assertEquals(
    renderExactExtractionSourceBlock(
      "bob/_knop/_sources#extraction-source",
      "alice/data",
      "alice/data/_history001/_s0002",
      {},
    ),
    `<bob/_knop/_sources#extraction-source> a sflo:ExtractionSource ;
  sflo:targetArtifact <alice/data> ;
  sflo:targetHistoricalState <alice/data/_history001/_s0002> .`,
  );
});

Deno.test("renderExactExtractionSourceBlock types observedAt as xsd:dateTime", () => {
  const block = renderExactExtractionSourceBlock(
    "bob/_knop/_sources#extraction-source",
    "alice/data",
    "alice/data/_history001/_s0002",
    {
      sourceDigest:
        "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      observedAt: "2026-08-21T10:00:00Z",
    },
  );

  assertStringIncludes(
    block,
    'sflo:observedAt "2026-08-21T10:00:00Z"^^<http://www.w3.org/2001/XMLSchema#dateTime>',
  );
});
