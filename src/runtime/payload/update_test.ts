import { assertEquals } from "@std/assert";
import { describePayloadUpdateResult } from "./update.ts";

Deno.test("describePayloadUpdateResult uses singular file grammar", () => {
  assertEquals(
    describePayloadUpdateResult({
      meshBase: "https://semantic-flow.github.io/mesh-alice-bio/",
      designatorPath: "alice/bio",
      payloadArtifactIri:
        "https://semantic-flow.github.io/mesh-alice-bio/alice/bio",
      workingFilePath: "alice-bio.ttl",
      updatedPaths: ["alice-bio.ttl"],
    }),
    "Updated payload https://semantic-flow.github.io/mesh-alice-bio/alice/bio by replacing working file alice-bio.ttl (updated 1 file).",
  );
});

Deno.test("describePayloadUpdateResult uses plural file grammar", () => {
  assertEquals(
    describePayloadUpdateResult({
      meshBase: "https://semantic-flow.github.io/mesh-alice-bio/",
      designatorPath: "alice/bio",
      payloadArtifactIri:
        "https://semantic-flow.github.io/mesh-alice-bio/alice/bio",
      workingFilePath: "alice-bio.ttl",
      updatedPaths: ["alice-bio.ttl", "alice-bio-2.ttl"],
    }),
    "Updated payload https://semantic-flow.github.io/mesh-alice-bio/alice/bio by replacing working file alice-bio.ttl (updated 2 files).",
  );
});
