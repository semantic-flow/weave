import { assertEquals, assertStringIncludes, assertThrows } from "@std/assert";
import {
  PayloadVersionIntentInputError,
  planSetPayloadHistoryIntent,
  planSetPayloadNextStateIntent,
} from "./version_intent.ts";

const meshBase = "https://semantic-flow.github.io/mesh-alice-bio/";
const firstPayloadInventory = `@base <${meshBase}> .
@prefix sflo: <https://semantic-flow.github.io/sflo/ontology/> .

<alice/bio/_knop> a sflo:Knop ;
  sflo:hasKnopMetadata <alice/bio/_knop/_meta> ;
  sflo:hasKnopInventory <alice/bio/_knop/_inventory> ;
  sflo:hasWorkingKnopInventoryFile <alice/bio/_knop/_inventory/inventory.ttl> ;
  sflo:hasPayloadArtifact <alice/bio> .

<alice/bio> a sflo:PayloadArtifact, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasWorkingLocatedFile <alice-bio.ttl> .
`;

Deno.test("planSetPayloadHistoryIntent sets current history without creating history state", () => {
  const plan = planSetPayloadHistoryIntent({
    meshBase,
    designatorPath: "alice/bio",
    historySegment: "releases",
    currentKnopInventoryTurtle: firstPayloadInventory,
  });

  assertEquals(plan.currentArtifactHistoryPath, "alice/bio/releases");
  assertEquals(plan.updatedFiles.map((file) => file.path), [
    "alice/bio/_knop/_inventory/inventory.ttl",
  ]);
  const contents = plan.updatedFiles[0]?.contents ?? "";
  assertStringIncludes(
    contents,
    "sflo:currentArtifactHistory <alice/bio/releases> .",
  );
  assertEquals(contents.includes("sflo:hasHistoricalState"), false);
});

Deno.test("planSetPayloadNextStateIntent stores next-state hint on selected payload history", () => {
  const plan = planSetPayloadNextStateIntent({
    meshBase,
    designatorPath: "alice/bio",
    stateSegment: "v0.1.0",
    currentKnopInventoryTurtle: firstPayloadInventory,
  });

  assertEquals(plan.currentArtifactHistoryPath, "alice/bio/_history001");
  assertEquals(plan.nextStateSegmentHint, "v0.1.0");
  const contents = plan.updatedFiles[0]?.contents ?? "";
  assertStringIncludes(
    contents,
    "@prefix sfcfg: <https://semantic-flow.github.io/sflo/config/> .",
  );
  assertStringIncludes(
    contents,
    "sflo:currentArtifactHistory <alice/bio/_history001> .",
  );
  assertStringIncludes(
    contents,
    '<alice/bio/_history001> sfcfg:hasNextStateSegmentHint "v0.1.0" .',
  );
  assertEquals(contents.includes("sflo:hasHistoricalState"), false);
});

Deno.test("planSetPayloadNextStateIntent replaces an existing next-state hint", () => {
  const currentKnopInventoryTurtle = firstPayloadInventory.replace(
    "sflo:hasWorkingLocatedFile <alice-bio.ttl> .",
    `sflo:currentArtifactHistory <alice/bio/releases> ;
  sflo:hasWorkingLocatedFile <alice-bio.ttl> .

<alice/bio/releases> sfcfg:hasNextStateSegmentHint "v0.0.1" .`,
  ).replace(
    "@prefix sflo: <https://semantic-flow.github.io/sflo/ontology/> .",
    `@prefix sflo: <https://semantic-flow.github.io/sflo/ontology/> .
@prefix sfcfg: <https://semantic-flow.github.io/sflo/config/> .`,
  );

  const plan = planSetPayloadNextStateIntent({
    meshBase,
    designatorPath: "alice/bio",
    stateSegment: "v0.0.2",
    currentKnopInventoryTurtle,
  });

  const contents = plan.updatedFiles[0]?.contents ?? "";
  assertEquals(contents.includes('"v0.0.1"'), false);
  assertStringIncludes(
    contents,
    '<alice/bio/releases> sfcfg:hasNextStateSegmentHint "v0.0.2" .',
  );
});

Deno.test("planSetPayloadNextStateIntent accepts duplicate identical current history facts", () => {
  const currentKnopInventoryTurtle = firstPayloadInventory.replace(
    "sflo:hasWorkingLocatedFile <alice-bio.ttl> .",
    `sflo:currentArtifactHistory <alice/bio/releases> ;
  sflo:currentArtifactHistory <alice/bio/releases> ;
  sflo:hasWorkingLocatedFile <alice-bio.ttl> .`,
  );

  const plan = planSetPayloadNextStateIntent({
    meshBase,
    designatorPath: "alice/bio",
    stateSegment: "v0.1.0",
    currentKnopInventoryTurtle,
  });

  assertEquals(plan.currentArtifactHistoryPath, "alice/bio/releases");
});

Deno.test("planSetPayloadNextStateIntent rejects dot-segment current history paths", () => {
  for (
    const currentArtifactHistoryPath of [
      "alice/bio/",
      "alice/bio/%2e",
      "alice/bio/%2e%2e",
      "alice/bio/%252e",
      "alice/bio/%252e%252e",
    ]
  ) {
    const currentKnopInventoryTurtle = firstPayloadInventory.replace(
      "sflo:hasWorkingLocatedFile <alice-bio.ttl> .",
      `sflo:currentArtifactHistory <${currentArtifactHistoryPath}> ;
  sflo:hasWorkingLocatedFile <alice-bio.ttl> .`,
    );

    assertThrows(
      () =>
        planSetPayloadNextStateIntent({
          meshBase,
          designatorPath: "alice/bio",
          stateSegment: "v0.1.0",
          currentKnopInventoryTurtle,
        }),
      PayloadVersionIntentInputError,
      "outside the payload designator path",
    );
  }
});

Deno.test("planSetPayloadHistoryIntent rejects non-payload Knops", () => {
  assertThrows(
    () =>
      planSetPayloadHistoryIntent({
        meshBase,
        designatorPath: "alice",
        historySegment: "releases",
        currentKnopInventoryTurtle: `@base <${meshBase}> .
@prefix sflo: <https://semantic-flow.github.io/sflo/ontology/> .

<alice/_knop> a sflo:Knop .
`,
      }),
    PayloadVersionIntentInputError,
    "payload artifact Knop",
  );
});
