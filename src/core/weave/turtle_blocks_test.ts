import { assertEquals } from "@std/assert";
import { renderSubjectPredicateBlock } from "./turtle_blocks.ts";

Deno.test("renderSubjectPredicateBlock renders a type-only subject without a trailing semicolon", () => {
  assertEquals(
    renderSubjectPredicateBlock("alice", "sflo:Knop", []),
    "<alice> a sflo:Knop .",
  );
});
