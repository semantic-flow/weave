import { assertEquals } from "@std/assert";
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
