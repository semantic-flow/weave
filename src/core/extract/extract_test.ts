import {
  assertEquals,
  assertFalse,
  assertStringIncludes,
  assertThrows,
} from "@std/assert";
import { compareRdfContent } from "../../../dependencies/github.com/spectacular-voyage/accord/src/checker/compare_rdf.ts";
import { readMeshAliceBioBranchFile } from "../../../tests/support/mesh_alice_bio_fixture.ts";
import { ExtractInputError, planExtract } from "./extract.ts";
import { KnopCreateInputError } from "../knop/create.ts";

const rootSourcePreExtractMeshInventoryTurtle =
  `@base <https://semantic-flow.github.io/mesh-alice-bio/> .
@prefix sflo: <https://semantic-flow.github.io/sflo/ontology/> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

<_mesh> a sflo:SemanticMesh ;
  sflo:meshBase "https://semantic-flow.github.io/mesh-alice-bio/"^^xsd:anyURI ;
  sflo:hasMeshMetadata <_mesh/_meta> ;
  sflo:hasMeshInventory <_mesh/_inventory> ;
  sflo:hasKnop <_knop> ;
  sflo:hasResourcePage <_mesh/index.html> .

<> a sflo:PayloadArtifact, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasWorkingLocatedFile <root-person.ttl> ;
  sflo:hasResourcePage <index.html> .

<_knop> a sflo:Knop ;
  sflo:hasWorkingKnopInventoryFile <_knop/_inventory/inventory.ttl> ;
  sflo:hasResourcePage <_knop/index.html> .

<_mesh/_inventory> a sflo:MeshInventory, sflo:DigitalArtifact, sflo:RdfDocument .

<_mesh/_inventory/_history001>
  sflo:latestHistoricalState <_mesh/_inventory/_history001/_s0003> ;
  sflo:nextStateOrdinal "4"^^xsd:nonNegativeInteger .

<root-person.ttl> a sflo:LocatedFile, sflo:RdfDocument .
`;

Deno.test("planExtract renders the first non-woven bob extraction artifacts", async () => {
  const sourceDigest = await sha256Digest(
    await readMeshAliceBioBranchFile("11-alice-bio-v2-woven", "alice-bio.ttl"),
  );
  const plan = planExtract({
    meshBase: "https://semantic-flow.github.io/mesh-alice-bio/",
    currentMeshInventoryTurtle: await readMeshAliceBioBranchFile(
      "11-alice-bio-v2-woven",
      "_mesh/_inventory/inventory.ttl",
    ),
    designatorPath: "bob",
    sourceDesignatorPath: "alice/bio",
    sourceStatePath: "alice/bio/_history001/_s0002",
    sourceEvidence: {
      sourceLocatedFilePath: "alice-bio.ttl",
      sourceDigest,
    },
    sourceWorkingLocalRelativePath: "alice-bio.ttl",
  });

  assertEquals(
    plan.extractionSourceIri,
    "https://semantic-flow.github.io/mesh-alice-bio/bob/_knop/_sources#extraction-source",
  );
  assertEquals(
    plan.sourceArtifactIri,
    "https://semantic-flow.github.io/mesh-alice-bio/alice/bio",
  );
  assertEquals(
    plan.sourceStateIri,
    "https://semantic-flow.github.io/mesh-alice-bio/alice/bio/_history001/_s0002",
  );
  assertEquals(plan.sourceResolutionMode, "current");
  assertEquals(
    plan.createdFiles.map((file) => file.path),
    [
      "bob/_knop/_meta/meta.ttl",
      "bob/_knop/_inventory/inventory.ttl",
      "bob/_knop/_sources/sources.ttl",
    ],
  );
  assertEquals(
    plan.updatedFiles.map((file) => file.path),
    ["_mesh/_inventory/inventory.ttl"],
  );
  assertEquals(
    plan.createdFiles[0]?.contents ?? "",
    await readMeshAliceBioBranchFile(
      "12-bob-extracted",
      "bob/_knop/_meta/meta.ttl",
    ),
  );
  assertStringIncludes(
    plan.createdFiles[1]?.contents ?? "",
    `sflo:hasKnopSourceRegistry <bob/_knop/_sources> ;
  sflo:hasExtractionSource <bob/_knop/_sources#extraction-source> ;`,
  );
  assertStringIncludes(
    plan.createdFiles[2]?.contents ?? "",
    "sflo:hasArtifactResolutionMode <https://semantic-flow.github.io/sflo/ontology/artifactResolutionMode_current> ;",
  );
  assertStringIncludes(
    plan.createdFiles[2]?.contents ?? "",
    `sflo:hasObservedSourceLocatedFile <alice-bio.ttl> ;
  sflo:observedSourceDigest "${sourceDigest}" .`,
  );
  assertFalse(
    (plan.createdFiles[2]?.contents ?? "").includes(
      "sflo:hasRequestedTargetState",
    ),
  );
  assertEquals(
    await compareRdfContent({
      left: encode(plan.updatedFiles[0]?.contents ?? ""),
      right: encode(
        await readMeshAliceBioBranchFile(
          "12-bob-extracted",
          "_mesh/_inventory/inventory.ttl",
        ),
      ),
      path: "_mesh/_inventory/inventory.ttl",
    }),
    true,
  );
});

Deno.test("planExtract accepts a root source payload when the root and source knops are the same", () => {
  const plan = planExtract({
    meshBase: "https://semantic-flow.github.io/mesh-alice-bio/",
    currentMeshInventoryTurtle: rootSourcePreExtractMeshInventoryTurtle,
    designatorPath: "alice/bio",
    sourceDesignatorPath: "",
    sourceResolutionMode: "pinned",
    sourceStatePath: "_history001/_s0001",
    sourceWorkingLocalRelativePath: "root-person.ttl",
  });

  assertEquals(
    plan.createdFiles.map((file) => file.path),
    [
      "alice/bio/_knop/_meta/meta.ttl",
      "alice/bio/_knop/_inventory/inventory.ttl",
      "alice/bio/_knop/_sources/sources.ttl",
    ],
  );
  assertStringIncludes(
    plan.updatedFiles[0]?.contents ?? "",
    `sflo:hasKnop <_knop> ;
  sflo:hasKnop <alice/bio/_knop> ;`,
  );
  assertEquals(
    countOccurrences(
      plan.updatedFiles[0]?.contents ?? "",
      "sflo:hasKnop <_knop> ;",
    ),
    1,
  );
  assertEquals(
    countOccurrences(
      plan.updatedFiles[0]?.contents ?? "",
      "sflo:hasResourcePage <index.html> .",
    ),
    1,
  );
  assertEquals(
    countOccurrences(
      plan.updatedFiles[0]?.contents ?? "",
      "sflo:hasResourcePage <_knop/index.html> .",
    ),
    1,
  );
  assertEquals(
    countOccurrences(
      plan.updatedFiles[0]?.contents ?? "",
      "<_knop/_inventory/inventory.ttl> a sflo:LocatedFile, sflo:RdfDocument .",
    ),
    1,
  );
  assertEquals(
    countOccurrences(
      plan.updatedFiles[0]?.contents ?? "",
      "<index.html> a sflo:ResourcePage, sflo:LocatedFile .",
    ),
    1,
  );
  assertEquals(
    countOccurrences(
      plan.updatedFiles[0]?.contents ?? "",
      "<_knop/index.html> a sflo:ResourcePage, sflo:LocatedFile .",
    ),
    1,
  );
  assertStringIncludes(
    plan.createdFiles[2]?.contents ?? "",
    `sflo:hasTargetArtifact <> ;
  sflo:hasRequestedTargetState <_history001/_s0001> ;`,
  );
});

Deno.test("planExtract rejects absolute sourceWorkingLocalRelativePath values", async () => {
  const currentMeshInventoryTurtle = await readMeshAliceBioBranchFile(
    "11-alice-bio-v2-woven",
    "_mesh/_inventory/inventory.ttl",
  );

  assertThrows(
    () =>
      planExtract({
        meshBase: "https://semantic-flow.github.io/mesh-alice-bio/",
        currentMeshInventoryTurtle,
        designatorPath: "bob",
        sourceDesignatorPath: "alice/bio",
        sourceStatePath: "alice/bio/_history001/_s0002",
        sourceWorkingLocalRelativePath: "/tmp/alice-bio.ttl",
      }),
    ExtractInputError,
    "mesh-relative file path",
  );
});

Deno.test("planExtract preserves the original knop-planning error as the cause", async () => {
  const currentMeshInventoryTurtle = await readMeshAliceBioBranchFile(
    "11-alice-bio-v2-woven",
    "_mesh/_inventory/inventory.ttl",
  );

  let thrown: unknown;
  try {
    planExtract({
      meshBase: "https://semantic-flow.github.io/mesh-alice-bio/",
      currentMeshInventoryTurtle,
      designatorPath: "alice",
      sourceDesignatorPath: "alice/bio",
      sourceStatePath: "alice/bio/_history001/_s0002",
      sourceWorkingLocalRelativePath: "alice-bio.ttl",
    });
  } catch (error) {
    thrown = error;
  }

  if (!(thrown instanceof ExtractInputError)) {
    throw thrown;
  }

  if (!(thrown.cause instanceof KnopCreateInputError)) {
    throw new Error(
      "Expected ExtractInputError.cause to preserve KnopCreateInputError",
    );
  }
});

Deno.test("planExtract accepts a semantically equivalent source payload LocatedFile block", async () => {
  const sourceDigest = await sha256Digest(
    await readMeshAliceBioBranchFile("11-alice-bio-v2-woven", "alice-bio.ttl"),
  );
  const currentMeshInventoryTurtle = withRdfPrefix(
    await readMeshAliceBioBranchFile(
      "11-alice-bio-v2-woven",
      "_mesh/_inventory/inventory.ttl",
    ),
  ).replace(
    "<alice-bio.ttl> a sflo:LocatedFile, sflo:RdfDocument .",
    "<alice-bio.ttl> rdf:type sflo:RdfDocument, sflo:LocatedFile .",
  );

  const plan = planExtract({
    meshBase: "https://semantic-flow.github.io/mesh-alice-bio/",
    currentMeshInventoryTurtle,
    designatorPath: "bob",
    sourceDesignatorPath: "alice/bio",
    sourceStatePath: "alice/bio/_history001/_s0002",
    sourceEvidence: {
      sourceLocatedFilePath: "alice-bio.ttl",
      sourceDigest,
    },
    sourceWorkingLocalRelativePath: "alice-bio.ttl",
  });

  assertEquals(
    await compareRdfContent({
      left: encode(plan.updatedFiles[0]?.contents ?? ""),
      right: encode(
        await readMeshAliceBioBranchFile(
          "12-bob-extracted",
          "_mesh/_inventory/inventory.ttl",
        ),
      ),
      path: "_mesh/_inventory/inventory.ttl",
    }),
    true,
  );
});

function withRdfPrefix(turtle: string): string {
  return turtle.includes("@prefix rdf:") ? turtle : turtle.replace(
    "@prefix sflo: <https://semantic-flow.github.io/sflo/ontology/> .",
    `@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix sflo: <https://semantic-flow.github.io/sflo/ontology/> .`,
  );
}

function countOccurrences(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

function encode(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

async function sha256Digest(contents: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    toArrayBuffer(encode(contents)),
  );
  const hex = [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return `sha256:${hex}`;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}
