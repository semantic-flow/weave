import { assertEquals, assertStringIncludes, assertThrows } from "@std/assert";
import { readMeshAliceBioBranchFile } from "../../../tests/support/mesh_alice_bio_fixture.ts";
import { ImportInputError, planImport } from "./import.ts";

Deno.test("planImport renders first imported Markdown payload without false RDF document typing", async () => {
  const plan = planImport({
    designatorPath: "bob/page-main",
    workingLocalRelativePath: "bob-page-main.md",
    importedBytes: encode("# Bob\n"),
    meshBase: "https://semantic-flow.github.io/mesh-alice-bio/",
    currentMeshInventoryTurtle: await readMeshAliceBioBranchFile(
      "05-alice-knop-created-woven",
      "_mesh/_inventory/inventory.ttl",
    ),
    payloadIsRdfDocument: false,
    sourceBinding: {
      targetAccessUrl:
        "https://raw.githubusercontent.com/djradon/public-notes/refs/heads/main/user.bob-newhart.md",
      observation: {
        observedContentDigest: "sha256:abc123",
        observedAt: "2026-05-24T20:00:00.000Z",
      },
    },
  });

  assertEquals(
    plan.payloadArtifactIri,
    "https://semantic-flow.github.io/mesh-alice-bio/bob/page-main",
  );
  assertEquals(plan.workingLocalRelativePath, "bob-page-main.md");
  assertEquals(new TextDecoder().decode(plan.workingFile.contents), "# Bob\n");
  assertEquals(
    plan.sourceBindingIri,
    "https://semantic-flow.github.io/mesh-alice-bio/bob/page-main/_knop/_sources#payload-source",
  );
  assertEquals(
    plan.createdFiles.map((file) => file.path),
    [
      "bob/page-main/_knop/_meta/meta.ttl",
      "bob/page-main/_knop/_inventory/inventory.ttl",
      "bob/page-main/_knop/_sources/sources.ttl",
    ],
  );
  assertEquals(
    plan.updatedFiles.map((file) => file.path),
    ["_mesh/_inventory/inventory.ttl"],
  );

  const inventory = plan.createdFiles[1]?.contents ?? "";
  assertStringIncludes(
    inventory,
    "<bob/page-main> a sflo:PayloadArtifact, sflo:DigitalArtifact ;",
  );
  assertStringIncludes(inventory, "<bob-page-main.md> a sflo:LocatedFile .");
  assertEquals(
    inventory.includes(
      "<bob/page-main> a sflo:PayloadArtifact, sflo:DigitalArtifact, sflo:RdfDocument ;",
    ),
    false,
  );
  assertEquals(
    inventory.includes(
      "<bob-page-main.md> a sflo:LocatedFile, sflo:RdfDocument .",
    ),
    false,
  );

  const sources = plan.createdFiles[2]?.contents ?? "";
  assertStringIncludes(
    sources,
    "<bob/page-main/_knop/_sources#payload-source> a sflo:ImportSource ;",
  );
  assertStringIncludes(
    sources,
    'sflo:targetAccessUrl "https://raw.githubusercontent.com/djradon/public-notes/refs/heads/main/user.bob-newhart.md" ;',
  );
  assertStringIncludes(
    sources,
    "sflo:hasResolutionObservation <bob/page-main/_knop/_sources#payload-source-observation-001> .",
  );
  assertStringIncludes(
    sources,
    '<bob/page-main/_knop/_sources#payload-source-observation-001>\n  a sflo:ArtifactResolutionObservation ;\n  sflo:observedContentDigest "sha256:abc123" ;\n  sflo:observedTargetLocalRelativePath "bob-page-main.md" ;\n  sflo:observedAt "2026-05-24T20:00:00.000Z"^^<http://www.w3.org/2001/XMLSchema#dateTime> .',
  );
});

Deno.test("planImport rejects invalid observation dateTime literals", async () => {
  const currentMeshInventoryTurtle = await readMeshAliceBioBranchFile(
    "05-alice-knop-created-woven",
    "_mesh/_inventory/inventory.ttl",
  );

  assertThrows(
    () =>
      planImport({
        designatorPath: "bob/page-main",
        workingLocalRelativePath: "bob-page-main.md",
        importedBytes: encode("# Bob\n"),
        meshBase: "https://semantic-flow.github.io/mesh-alice-bio/",
        currentMeshInventoryTurtle,
        sourceBinding: {
          observation: {
            observedContentDigest: "sha256:abc123",
            observedAt: "2026-99-24T20:00:00Z",
          },
        },
      }),
    ImportInputError,
    "sourceBinding.observation.observedAt must be a valid xsd:dateTime",
  );
});

Deno.test("planImport renders imported RDF payloads as RdfDocument", async () => {
  const plan = planImport({
    designatorPath: "bob/bio",
    workingLocalRelativePath: "bob-bio.ttl",
    importedBytes: encode("@prefix schema: <https://schema.org/> .\n"),
    meshBase: "https://semantic-flow.github.io/mesh-alice-bio/",
    currentMeshInventoryTurtle: await readMeshAliceBioBranchFile(
      "05-alice-knop-created-woven",
      "_mesh/_inventory/inventory.ttl",
    ),
    payloadIsRdfDocument: true,
    sourceBinding: {
      targetLocalRelativePath: "incoming/bob-bio.ttl",
      expectedContentDigest: "sha256:def456",
      observation: {
        observedContentDigest: "sha256:def456",
      },
    },
  });

  const inventory = plan.createdFiles[1]?.contents ?? "";
  assertStringIncludes(
    inventory,
    "<bob/bio> a sflo:PayloadArtifact, sflo:DigitalArtifact, sflo:RdfDocument ;",
  );
  assertStringIncludes(
    inventory,
    "<bob-bio.ttl> a sflo:LocatedFile, sflo:RdfDocument .",
  );
  const sources = plan.createdFiles[2]?.contents ?? "";
  assertStringIncludes(
    sources,
    'sflo:targetLocalRelativePath "incoming/bob-bio.ttl" ;',
  );
  assertStringIncludes(sources, 'sflo:expectsContentDigest "sha256:def456" ;');
});

Deno.test("planImport replaces source registry provenance for an existing imported payload", async () => {
  const initial = planImport({
    designatorPath: "bob/page-main",
    workingLocalRelativePath: "bob-page-main.md",
    importedBytes: encode("# Bob\n"),
    meshBase: "https://semantic-flow.github.io/mesh-alice-bio/",
    currentMeshInventoryTurtle: await readMeshAliceBioBranchFile(
      "05-alice-knop-created-woven",
      "_mesh/_inventory/inventory.ttl",
    ),
    sourceBinding: {
      targetAccessUrl: "https://example.com/bob.md",
      observation: {
        observedContentDigest: "sha256:first",
      },
    },
  });

  const replacement = planImport({
    designatorPath: "bob/page-main",
    workingLocalRelativePath: "bob-page-main.md",
    importedBytes: encode("# Bob v2\n"),
    meshBase: "https://semantic-flow.github.io/mesh-alice-bio/",
    currentMeshInventoryTurtle: await readMeshAliceBioBranchFile(
      "05-alice-knop-created-woven",
      "_mesh/_inventory/inventory.ttl",
    ),
    currentKnopInventoryTurtle: initial.createdFiles[1]!.contents,
    replaceWorking: true,
    sourceBinding: {
      targetAccessUrl: "https://example.com/bob-v2.md",
      observation: {
        observedContentDigest: "sha256:second",
      },
    },
  });

  assertEquals(replacement.createdFiles, []);
  assertEquals(
    replacement.updatedFiles.map((file) => file.path),
    ["bob/page-main/_knop/_sources/sources.ttl"],
  );
  assertStringIncludes(
    replacement.updatedFiles[0]?.contents ?? "",
    'sflo:targetAccessUrl "https://example.com/bob-v2.md" ;',
  );
});

Deno.test("planImport rejects replacement without replaceWorking", () => {
  const initial = planImport({
    designatorPath: "bob/page-main",
    workingLocalRelativePath: "bob-page-main.md",
    importedBytes: encode("# Bob\n"),
    meshBase: "https://semantic-flow.github.io/mesh-alice-bio/",
    currentMeshInventoryTurtle:
      `@base <https://semantic-flow.github.io/mesh-alice-bio/> .
@prefix sflo: <https://semantic-flow.github.io/sflo/ontology/> .

<_mesh> a sflo:SemanticMesh ;
  sflo:meshBase "https://semantic-flow.github.io/mesh-alice-bio/"^^<http://www.w3.org/2001/XMLSchema#anyURI> ;
  sflo:hasMeshMetadata <_mesh/_meta> ;
  sflo:hasMeshInventory <_mesh/_inventory> .

<_mesh/_meta> a sflo:MeshMetadata, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasWorkingLocatedFile <_mesh/_meta/meta.ttl> .

<_mesh/_inventory> a sflo:MeshInventory, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasWorkingLocatedFile <_mesh/_inventory/inventory.ttl> .

<_mesh/_meta/meta.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<_mesh/_inventory/inventory.ttl> a sflo:LocatedFile, sflo:RdfDocument .
`,
    sourceBinding: {
      observation: {
        observedContentDigest: "sha256:first",
      },
    },
  });

  assertThrows(
    () =>
      planImport({
        designatorPath: "bob/page-main",
        workingLocalRelativePath: "bob-page-main.md",
        importedBytes: encode("# Bob v2\n"),
        meshBase: "https://semantic-flow.github.io/mesh-alice-bio/",
        currentMeshInventoryTurtle: initial.updatedFiles[0]!.contents,
        currentKnopInventoryTurtle: initial.createdFiles[1]!.contents,
        sourceBinding: {
          observation: {
            observedContentDigest: "sha256:second",
          },
        },
      }),
    ImportInputError,
    "import target already exists",
  );
});

function encode(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}
