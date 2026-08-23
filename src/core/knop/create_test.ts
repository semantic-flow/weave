import {
  assert,
  assertEquals,
  assertStringIncludes,
  assertThrows,
} from "@std/assert";
import { Parser, type Quad, type Term } from "n3";
import { KnopCreateInputError, planKnopCreate } from "./create.ts";
import { readMeshAliceBioBranchFile } from "../../../tests/support/mesh_alice_bio_fixture.ts";
import { readMeshSidecarFantasyRulesBranchFile } from "../../../tests/support/mesh_sidecar_fantasy_rules_fixture.ts";

Deno.test("planKnopCreate renders first knop support artifacts", async () => {
  const currentMeshInventoryTurtle = await readMeshAliceBioBranchFile(
    "03-mesh-created-woven",
    "_mesh/_inventory/inventory.ttl",
  );
  const plan = planKnopCreate({
    meshBase: "https://semantic-flow.github.io/mesh-alice-bio/",
    designatorPath: "alice",
    currentMeshInventoryTurtle,
  });

  assertEquals(
    plan.knopIri,
    "https://semantic-flow.github.io/mesh-alice-bio/alice/_knop",
  );
  assertEquals(
    plan.createdFiles.map((file) => file.path),
    [
      "alice/_knop/_meta/meta.ttl",
      "alice/_knop/_inventory/inventory.ttl",
    ],
  );
  assertEquals(plan.createdBinaryFiles, undefined);
  assertEquals(
    plan.updatedFiles.map((file) => file.path),
    ["_mesh/_inventory/inventory.ttl"],
  );
  assertEquals(
    plan.createdFiles[0]?.contents,
    await readMeshAliceBioBranchFile(
      "04-alice-knop-created",
      "alice/_knop/_meta/meta.ttl",
    ),
  );
  assertEquals(
    plan.createdFiles[1]?.contents,
    await readMeshAliceBioBranchFile(
      "04-alice-knop-created",
      "alice/_knop/_inventory/inventory.ttl",
    ),
  );
  const updatedTurtle = plan.updatedFiles[0]?.contents ?? "";
  assert(updatedTurtle.startsWith(currentMeshInventoryTurtle));
  assertRdfQuadSetEquals(
    updatedTurtle,
    [
      ...parseQuads(
        currentMeshInventoryTurtle,
        "https://semantic-flow.github.io/mesh-alice-bio/",
      ),
      ...parseQuads(
        renderRequestedKnopCreateFacts(
          "https://semantic-flow.github.io/mesh-alice-bio/",
          "alice",
        ),
        "https://semantic-flow.github.io/mesh-alice-bio/",
      ),
    ],
    "https://semantic-flow.github.io/mesh-alice-bio/",
  );
});

Deno.test("planKnopCreate carries exact optional founding bytes and discovery facts", async () => {
  const meshBase = "https://semantic-flow.github.io/mesh-alice-bio/";
  const currentMeshInventoryTurtle = await readMeshAliceBioBranchFile(
    "03-mesh-created-woven",
    "_mesh/_inventory/inventory.ttl",
  );
  const foundingBytes = new TextEncoder().encode(
    `\uFEFF<${meshBase}founding-demo> <https://stagecraft.example/vocab/incarnationOf> <https://original.example/items/42> .\r\n`,
  );
  const plan = planKnopCreate({
    meshBase,
    designatorPath: "founding-demo",
    currentMeshInventoryTurtle,
    foundingData: foundingBytes,
  });

  assertEquals(
    plan.foundingReferentDataIri,
    `${meshBase}founding-demo/_knop/_founding`,
  );
  assertEquals(
    plan.foundingWorkingLocatedFilePath,
    "founding-demo/_knop/_founding/data.ttl",
  );
  assertEquals(plan.createdBinaryFiles, [{
    path: "founding-demo/_knop/_founding/data.ttl",
    contents: foundingBytes,
  }]);
  const inventory = plan.createdFiles[1]!.contents;
  assertStringIncludes(
    inventory,
    "sflo:hasFoundingReferentData <founding-demo/_knop/_founding>",
  );
  assertStringIncludes(
    inventory,
    "<founding-demo/_knop/_founding> a sflo:FoundingReferentData, sflo:DigitalArtifact, sflo:RdfDocument",
  );
  assertEquals(inventory.includes("sflo:hasContentDigest"), false);
  assertEquals(
    plan.createdFiles[0]!.contents.includes("incarnationOf"),
    false,
  );
});

Deno.test("planKnopCreate rejects reserved designator path segments", () => {
  assertThrows(
    () =>
      planKnopCreate({
        meshBase: "https://semantic-flow.github.io/mesh-alice-bio/",
        designatorPath: "alice/_knop",
        currentMeshInventoryTurtle: "",
      }),
    KnopCreateInputError,
    "reserved path segments",
  );
});

Deno.test("planKnopCreate rejects an already-registered knop", async () => {
  const currentMeshInventoryTurtle = await readMeshAliceBioBranchFile(
    "04-alice-knop-created",
    "_mesh/_inventory/inventory.ttl",
  );

  assertThrows(
    () =>
      planKnopCreate({
        meshBase: "https://semantic-flow.github.io/mesh-alice-bio/",
        designatorPath: "alice",
        currentMeshInventoryTurtle,
      }),
    KnopCreateInputError,
    "already registers knop",
  );
});

Deno.test(
  "planKnopCreate accepts semantically equivalent woven MeshInventory turtle",
  async () => {
    const currentMeshInventoryTurtle = withRdfPrefix(
      await readMeshAliceBioBranchFile(
        "03-mesh-created-woven",
        "_mesh/_inventory/inventory.ttl",
      ),
    )
      .replace(
        "<_mesh/_inventory> a sflo:MeshInventory, sflo:DigitalArtifact, sflo:RdfDocument ;",
        "<_mesh/_inventory> rdf:type sflo:RdfDocument, sflo:DigitalArtifact, sflo:MeshInventory ;",
      )
      .replace(
        "<_mesh/_meta/_history001/_s0001/ttl> a sflo:ArtifactManifestation, sflo:RdfDocument ;",
        "<_mesh/_meta/_history001/_s0001/ttl> rdf:type sflo:RdfDocument, sflo:ArtifactManifestation ;",
      );

    const plan = planKnopCreate({
      meshBase: "https://semantic-flow.github.io/mesh-alice-bio/",
      designatorPath: "alice",
      currentMeshInventoryTurtle,
    });

    const updatedTurtle = plan.updatedFiles[0]?.contents ?? "";
    assert(updatedTurtle.startsWith(currentMeshInventoryTurtle));
    assertRdfQuadSetEquals(
      updatedTurtle,
      [
        ...parseQuads(
          currentMeshInventoryTurtle,
          "https://semantic-flow.github.io/mesh-alice-bio/",
        ),
        ...parseQuads(
          renderRequestedKnopCreateFacts(
            "https://semantic-flow.github.io/mesh-alice-bio/",
            "alice",
          ),
          "https://semantic-flow.github.io/mesh-alice-bio/",
        ),
      ],
      "https://semantic-flow.github.io/mesh-alice-bio/",
    );
  },
);

Deno.test(
  "planKnopCreate supports creating the root Knop in a later carried mesh state",
  async () => {
    const plan = planKnopCreate({
      meshBase: "https://semantic-flow.github.io/mesh-alice-bio/",
      designatorPath: "",
      currentMeshInventoryTurtle: await readMeshAliceBioBranchFile(
        "21-bob-page-imported-source-woven",
        "_mesh/_inventory/inventory.ttl",
      ),
    });

    assertEquals(
      plan.createdFiles.map((file) => file.path),
      [
        "_knop/_meta/meta.ttl",
        "_knop/_inventory/inventory.ttl",
      ],
    );
    assertNamedNodeFact(
      plan.updatedFiles[0]?.contents ?? "",
      "https://semantic-flow.github.io/mesh-alice-bio/",
      "_mesh",
      "https://semantic-flow.github.io/sflo/ontology/hasKnop",
      "_knop",
    );
    assertStringIncludes(
      plan.updatedFiles[0]?.contents ?? "",
      "sflo:hasHistoricalState <_mesh/_inventory/_history001/_s0005> ;",
    );
    assertNamedNodeFact(
      plan.updatedFiles[0]?.contents ?? "",
      "https://semantic-flow.github.io/mesh-alice-bio/",
      "_knop/_inventory/inventory.ttl",
      "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
      "https://semantic-flow.github.io/sflo/ontology/LocatedFile",
    );
  },
);

Deno.test(
  "planKnopCreate supports creating a later root Knop with current-only MeshInventory",
  async () => {
    const plan = planKnopCreate({
      meshBase: "https://semantic-flow.github.io/mesh-sidecar-fantasy-rules/",
      designatorPath: "",
      currentMeshInventoryTurtle: await readMeshSidecarFantasyRulesBranchFile(
        "a.09-ontology-and-shacl-terms-extracted-woven",
        "docs/_mesh/_inventory/inventory.ttl",
      ),
    });

    assertEquals(
      plan.createdFiles.map((file) => file.path),
      [
        "_knop/_meta/meta.ttl",
        "_knop/_inventory/inventory.ttl",
      ],
    );
    assertNamedNodeFact(
      plan.updatedFiles[0]?.contents ?? "",
      "https://semantic-flow.github.io/mesh-sidecar-fantasy-rules/",
      "_mesh",
      "https://semantic-flow.github.io/sflo/ontology/hasKnop",
      "_knop",
    );
    assertNamedNodeFact(
      plan.updatedFiles[0]?.contents ?? "",
      "https://semantic-flow.github.io/mesh-sidecar-fantasy-rules/",
      "_knop/_inventory/inventory.ttl",
      "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
      "https://semantic-flow.github.io/sflo/ontology/LocatedFile",
    );
    assertEquals(
      plan.updatedFiles[0]?.contents.includes("_mesh/_inventory/_history001"),
      false,
    );
  },
);

Deno.test(
  "planKnopCreate preserves carried MeshInventory bytes and appends only missing facts",
  async () => {
    const currentMeshInventoryTurtle =
      `${await readMeshSidecarFantasyRulesBranchFile(
        "a.09-ontology-and-shacl-terms-extracted-woven",
        "docs/_mesh/_inventory/inventory.ttl",
      )}
# hand-curated Stagecraft inventory note
<stagecraft/iri-0553/_knop> <https://example.org/vocab/curatedNote> "keep byte-for-byte" .
<stagecraft/iri-0553/_knop/_inventory/inventory.ttl> a sflo:LocatedFile .
`;
    const plan = planKnopCreate({
      meshBase: "https://semantic-flow.github.io/mesh-sidecar-fantasy-rules/",
      designatorPath: "stagecraft/iri-0553",
      currentMeshInventoryTurtle,
    });
    const updatedTurtle = plan.updatedFiles[0]?.contents ?? "";

    assert(updatedTurtle.startsWith(currentMeshInventoryTurtle));
    assertStringIncludes(
      updatedTurtle,
      '# hand-curated Stagecraft inventory note\n<stagecraft/iri-0553/_knop> <https://example.org/vocab/curatedNote> "keep byte-for-byte" .',
    );
    assertEquals(
      parseQuadCount(updatedTurtle) -
        parseQuadCount(currentMeshInventoryTurtle),
      4,
    );
  },
);

Deno.test(
  "planKnopCreate appends valid facts when the carried inventory has no sflo prefix",
  async () => {
    const meshBase =
      "https://semantic-flow.github.io/mesh-sidecar-fantasy-rules/";
    const currentMeshInventoryTurtle = expandSfloPrefix(
      await readMeshSidecarFantasyRulesBranchFile(
        "a.09-ontology-and-shacl-terms-extracted-woven",
        "docs/_mesh/_inventory/inventory.ttl",
      ),
    );
    const plan = planKnopCreate({
      meshBase,
      designatorPath: "stagecraft/no-prefix",
      currentMeshInventoryTurtle,
    });
    const updatedTurtle = plan.updatedFiles[0]?.contents ?? "";

    assert(updatedTurtle.startsWith(currentMeshInventoryTurtle));
    assertRdfQuadSetEquals(
      updatedTurtle,
      [
        ...parseQuads(currentMeshInventoryTurtle, meshBase),
        ...parseQuads(
          renderRequestedKnopCreateFacts(meshBase, "stagecraft/no-prefix"),
          meshBase,
        ),
      ],
      meshBase,
    );
  },
);

Deno.test(
  "planKnopCreate appends mesh facts when the carried base differs from meshBase",
  async () => {
    const meshBase =
      "https://semantic-flow.github.io/mesh-sidecar-fantasy-rules/";
    const currentMeshInventoryTurtle = absolutizeRelativeIris(
      await readMeshSidecarFantasyRulesBranchFile(
        "a.09-ontology-and-shacl-terms-extracted-woven",
        "docs/_mesh/_inventory/inventory.ttl",
      ),
      meshBase,
    ).replace(
      `@base <${meshBase}> .`,
      "@base <https://elsewhere.example/carried/> .",
    );
    const plan = planKnopCreate({
      meshBase,
      designatorPath: "stagecraft/different-base",
      currentMeshInventoryTurtle,
    });
    const updatedTurtle = plan.updatedFiles[0]?.contents ?? "";

    assert(updatedTurtle.startsWith(currentMeshInventoryTurtle));
    assertRdfQuadSetEquals(
      updatedTurtle,
      [
        ...parseQuads(currentMeshInventoryTurtle, meshBase),
        ...parseQuads(
          renderRequestedKnopCreateFacts(
            meshBase,
            "stagecraft/different-base",
          ),
          meshBase,
        ),
      ],
      meshBase,
    );
  },
);

Deno.test(
  "planKnopCreate preserves the complete Alice first-Knop mesh config graph",
  async () => {
    const meshBase = "https://semantic-flow.github.io/mesh-alice-bio/";
    const currentMeshInventoryTurtle = await readMeshAliceBioBranchFile(
      "03-mesh-created-woven",
      "_mesh/_inventory/inventory.ttl",
    );
    const plan = planKnopCreate({
      meshBase,
      designatorPath: "alice",
      currentMeshInventoryTurtle,
    });
    const updatedTurtle = plan.updatedFiles[0]?.contents ?? "";

    assert(updatedTurtle.startsWith(currentMeshInventoryTurtle));
    assertRdfQuadSetEquals(
      updatedTurtle,
      [
        ...parseQuads(currentMeshInventoryTurtle, meshBase),
        ...parseQuads(
          renderRequestedKnopCreateFacts(meshBase, "alice"),
          meshBase,
        ),
      ],
      meshBase,
    );
  },
);

Deno.test(
  "planKnopCreate names conflicting carried and requested working inventory locators",
  async () => {
    const currentMeshInventoryTurtle =
      `${await readMeshSidecarFantasyRulesBranchFile(
        "a.09-ontology-and-shacl-terms-extracted-woven",
        "docs/_mesh/_inventory/inventory.ttl",
      )}
<stagecraft/conflict/_knop> sflo:hasWorkingKnopInventoryFile <stagecraft/conflict/_knop/_inventory/carried.ttl> .
`;
    const error = assertThrows(
      () =>
        planKnopCreate({
          meshBase:
            "https://semantic-flow.github.io/mesh-sidecar-fantasy-rules/",
          designatorPath: "stagecraft/conflict",
          currentMeshInventoryTurtle,
        }),
      KnopCreateInputError,
    );

    assertStringIncludes(
      error.message,
      "stagecraft/conflict/_knop/_inventory/carried.ttl",
    );
    assertStringIncludes(
      error.message,
      "stagecraft/conflict/_knop/_inventory/inventory.ttl",
    );
  },
);

Deno.test(
  "planKnopCreate accepts exact duplicate named-node and literal singleton facts",
  async () => {
    const meshBase = "https://semantic-flow.github.io/mesh-alice-bio/";
    const currentMeshInventoryTurtle = `${await readMeshAliceBioBranchFile(
      "04-alice-knop-created",
      "_mesh/_inventory/inventory.ttl",
    )}
<_mesh/_inventory/_history001> sflo:latestHistoricalState <_mesh/_inventory/_history001/_s0001> ;
  sflo:nextStateOrdinal "2"^^<http://www.w3.org/2001/XMLSchema#nonNegativeInteger> .
`;
    const plan = planKnopCreate({
      meshBase,
      designatorPath: "duplicate-cardinality",
      currentMeshInventoryTurtle,
    });

    assert(
      (plan.updatedFiles[0]?.contents ?? "").startsWith(
        currentMeshInventoryTurtle,
      ),
    );
  },
);

function withRdfPrefix(turtle: string): string {
  return turtle.includes("@prefix rdf:") ? turtle : turtle.replace(
    "@prefix sflo: <https://semantic-flow.github.io/sflo/ontology/> .\n",
    "@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .\n@prefix sflo: <https://semantic-flow.github.io/sflo/ontology/> .\n",
  );
}

function parseQuadCount(turtle: string): number {
  return new Parser({
    baseIRI: "https://semantic-flow.github.io/mesh-sidecar-fantasy-rules/",
  }).parse(turtle).length;
}

function assertNamedNodeFact(
  turtle: string,
  meshBase: string,
  subjectPath: string,
  predicateIri: string,
  objectValue: string,
): void {
  const subjectIri = new URL(subjectPath, meshBase).href;
  const objectIri = new URL(objectValue, meshBase).href;
  assert(
    new Parser({ baseIRI: meshBase }).parse(turtle).some((quad: Quad) =>
      quad.subject.termType === "NamedNode" &&
      quad.subject.value === subjectIri &&
      quad.predicate.value === predicateIri &&
      quad.object.termType === "NamedNode" &&
      quad.object.value === objectIri
    ),
  );
}

function expandSfloPrefix(turtle: string): string {
  return turtle
    .replace(
      "@prefix sflo: <https://semantic-flow.github.io/sflo/ontology/> .\n",
      "",
    )
    .replace(
      /sflo:([A-Za-z][A-Za-z0-9]*)/g,
      (_match, localName: string) =>
        `<https://semantic-flow.github.io/sflo/ontology/${localName}>`,
    );
}

function absolutizeRelativeIris(turtle: string, meshBase: string): string {
  return turtle.replace(
    /<([^>]*)>/g,
    (match, iri: string) =>
      /^[A-Za-z][A-Za-z0-9+.-]*:/.test(iri)
        ? match
        : `<${new URL(iri, meshBase).href}>`,
  );
}

function renderRequestedKnopCreateFacts(
  meshBase: string,
  designatorPath: string,
): string {
  const knopPath = designatorPath.length === 0
    ? "_knop"
    : `${designatorPath}/_knop`;
  const inventoryPath = `${knopPath}/_inventory/inventory.ttl`;
  return `<${
    new URL("_mesh", meshBase).href
  }> <https://semantic-flow.github.io/sflo/ontology/hasKnop> <${
    new URL(knopPath, meshBase).href
  }> .
<${
    new URL(knopPath, meshBase).href
  }> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <https://semantic-flow.github.io/sflo/ontology/Knop> .
<${
    new URL(knopPath, meshBase).href
  }> <https://semantic-flow.github.io/sflo/ontology/hasWorkingKnopInventoryFile> <${
    new URL(inventoryPath, meshBase).href
  }> .
<${
    new URL(inventoryPath, meshBase).href
  }> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <https://semantic-flow.github.io/sflo/ontology/LocatedFile> .
<${
    new URL(inventoryPath, meshBase).href
  }> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <https://semantic-flow.github.io/sflo/ontology/RdfDocument> .
`;
}

function assertRdfQuadSetEquals(
  actualTurtle: string,
  expectedQuads: readonly Quad[],
  baseIri: string,
): void {
  const actualKeys = new Set(
    parseQuads(actualTurtle, baseIri).map(rdfQuadKey),
  );
  const expectedKeys = new Set(expectedQuads.map(rdfQuadKey));
  assertEquals(actualKeys, expectedKeys);
}

function parseQuads(turtle: string, baseIri: string): Quad[] {
  return new Parser({ baseIRI: baseIri }).parse(turtle);
}

function rdfQuadKey(quad: Quad): string {
  return [quad.graph, quad.subject, quad.predicate, quad.object]
    .map(rdfTermKey)
    .join("|");
}

function rdfTermKey(term: Term): string {
  if (term.termType === "Literal") {
    return [
      term.termType,
      term.value,
      term.language,
      term.datatype.value,
    ].join(":");
  }
  return `${term.termType}:${term.value}`;
}
