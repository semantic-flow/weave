import { assertEquals } from "@std/assert";
import { describePayloadUpdateResult } from "./update.ts";

Deno.test("describePayloadUpdateResult uses singular file grammar", () => {
  assertEquals(
    describePayloadUpdateResult({
      meshBase: "https://semantic-flow.github.io/mesh-alice-bio/",
      designatorPath: "alice/data",
      payloadArtifactIri:
        "https://semantic-flow.github.io/mesh-alice-bio/alice/data",
      workingLocalRelativePath: "alice-data.ttl",
      updatedPaths: ["alice-data.ttl"],
    }),
    "Updated payload https://semantic-flow.github.io/mesh-alice-bio/alice/data by replacing working file alice-data.ttl (updated 1 file).",
  );
});

Deno.test("describePayloadUpdateResult uses plural file grammar", () => {
  assertEquals(
    describePayloadUpdateResult({
      meshBase: "https://semantic-flow.github.io/mesh-alice-bio/",
      designatorPath: "alice/data",
      payloadArtifactIri:
        "https://semantic-flow.github.io/mesh-alice-bio/alice/data",
      workingLocalRelativePath: "alice-data.ttl",
      updatedPaths: ["alice-data.ttl", "alice-bio-2.ttl"],
    }),
    "Updated payload https://semantic-flow.github.io/mesh-alice-bio/alice/data by replacing working file alice-data.ttl (updated 2 files).",
  );
});
