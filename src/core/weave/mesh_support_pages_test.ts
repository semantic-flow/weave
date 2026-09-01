import {
  assert,
  assertEquals,
  assertFalse,
  assertStringIncludes,
  assertThrows,
} from "@std/assert";
import { compareRdfContent } from "../../../dependencies/github.com/spectacular-voyage/accord/src/checker/compare_rdf.ts";
import { planMeshSupportResourcePages } from "./mesh_support_pages.ts";
import { WeaveInputError } from "./errors.ts";

const meshBase = "https://example.org/mesh/";

Deno.test("mesh-support page-only append preserves the exact carried MeshInventory prefix", async () => {
  const currentMeshInventoryTurtle = `${carriedMeshInventoryTurtle()}  `;
  const plan = planCurrentOnlyMeshSupportPages(currentMeshInventoryTurtle);
  const updatedInventory = plan.updatedFiles[0]?.contents ?? "";

  assert(updatedInventory.startsWith(currentMeshInventoryTurtle));
  assertEquals(
    await compareRdfContent({
      left: encode(updatedInventory),
      right: encode(
        `${currentMeshInventoryTurtle}${requestedSupportPageFactsTurtle()}`,
      ),
      path: "_mesh/_inventory/inventory.ttl",
    }),
    true,
  );
});

Deno.test("mesh-support page-only semantic no-op omits the inventory update", () => {
  const currentMeshInventoryTurtle =
    `${carriedMeshInventoryTurtle()}${requestedSupportPageFactsTurtle()}# retain trailing note\n  `;

  assertEquals(
    planCurrentOnlyMeshSupportPages(currentMeshInventoryTurtle).updatedFiles,
    [],
  );
});

Deno.test("mesh-support page-only append rejects a missing support subject", () => {
  const currentMeshInventoryTurtle = carriedMeshInventoryTurtle().replace(
    `<_mesh/_meta> a sflo:MeshMetadata ;
  ex:curatedNote "first block" .

<_mesh/_meta> ex:curatedNote "second block" .

`,
    "",
  );

  assertThrows(
    () => planCurrentOnlyMeshSupportPages(currentMeshInventoryTurtle),
    WeaveInputError,
    "did not contain support resource <_mesh/_meta>",
  );
});

Deno.test("initial mesh-support history keeps mutable progression in MeshMetadata only", () => {
  const plan = planMeshSupportResourcePages({
    meshBase,
    currentMeshInventoryTurtle: initialSupportInventoryTurtle(),
    currentMeshMetadataTurtle: initialMeshMetadataTurtle(),
    currentMeshConfigTurtle: "# current config bytes\n",
    supportHistoryPolicies: {
      meshMetadata: "versioned",
      meshInventory: "versioned",
      config: "versioned",
    },
  });
  const updatedInventory =
    plan.updatedFiles.find((file) =>
      file.path === "_mesh/_inventory/inventory.ttl"
    )?.contents ?? "";
  const updatedMetadata =
    plan.updatedFiles.find((file) => file.path === "_mesh/_meta/meta.ttl")
      ?.contents ?? "";

  for (
    const mutablePredicate of [
      "sflo:currentArtifactHistory",
      "sflo:nextHistoryOrdinal",
      "sflo:latestHistoricalState",
      "sflo:nextStateOrdinal",
    ]
  ) {
    assertFalse(
      updatedInventory.includes(mutablePredicate),
      "MeshInventory retained mutable predicate " + mutablePredicate,
    );
  }
  for (
    const supportPath of [
      "_mesh/_meta",
      "_mesh/_inventory",
      "_mesh/_config",
    ]
  ) {
    const historyPath = supportPath + "/_history001";
    assertStringIncludes(
      updatedInventory,
      "sflo:hasArtifactHistory <" + historyPath + ">",
    );
    assertStringIncludes(
      updatedInventory,
      "sflo:hasHistoricalState <" + historyPath + "/_s0001>",
    );
    assertStringIncludes(updatedMetadata, "<" + supportPath + ">");
    assertStringIncludes(
      updatedMetadata,
      "sflo:currentArtifactHistory <" + historyPath + ">",
    );
    assertStringIncludes(
      updatedMetadata,
      "<" + historyPath + ">",
    );
    assertStringIncludes(
      updatedMetadata,
      "sflo:latestHistoricalState <" + historyPath + "/_s0001>",
    );
  }
  assertEquals(
    plan.createdFiles.find((file) =>
      file.path === "_mesh/_meta/_history001/_s0001/ttl/meta.ttl"
    )?.contents,
    updatedMetadata,
  );
});

Deno.test("initial versioned mesh-support append preserves the exact carried MeshInventory prefix", async () => {
  const currentMeshInventoryTurtle = `${carriedMeshInventoryTurtle()}  `;
  const plan = planVersionedMeshSupportPages(currentMeshInventoryTurtle);
  const updatedInventory = requiredPlannedFileContents(
    plan.updatedFiles,
    "_mesh/_inventory/inventory.ttl",
  );
  const updatedMetadata = requiredPlannedFileContents(
    plan.updatedFiles,
    "_mesh/_meta/meta.ttl",
  );

  assert(updatedInventory.startsWith(currentMeshInventoryTurtle));
  assertStringIncludes(
    updatedInventory.slice(0, currentMeshInventoryTurtle.length),
    'ex:label "existing anonymous detail"',
  );
  assertEquals(
    await compareRdfContent({
      left: encode(updatedInventory),
      right: encode(
        `${currentMeshInventoryTurtle}${
          requestedInitialSupportFactsTurtle([
            "_mesh/_meta",
            "_mesh/_inventory",
            "_mesh/_config",
          ])
        }`,
      ),
      path: "_mesh/_inventory/inventory.ttl",
    }),
    true,
  );
  assertEquals(
    requiredPlannedFileContents(
      plan.createdFiles,
      "_mesh/_inventory/_history001/_s0001/ttl/inventory.ttl",
    ),
    updatedInventory,
  );
  assertEquals(
    requiredPlannedFileContents(
      plan.createdFiles,
      "_mesh/_meta/_history001/_s0001/ttl/meta.ttl",
    ),
    updatedMetadata,
  );
  assertEquals(
    requiredPlannedFileContents(
      plan.createdFiles,
      "_mesh/_config/_history001/_s0001/ttl/config.ttl",
    ),
    "# current config bytes\n",
  );
});

Deno.test("settled initial mesh-support history makes a repeated plan an exact no-op", () => {
  const currentMeshConfigTurtle = "# current config bytes\n";
  const firstPlan = planVersionedMeshSupportPages(
    carriedMeshInventoryTurtle(),
  );
  const firstInventory = requiredPlannedFileContents(
    firstPlan.updatedFiles,
    "_mesh/_inventory/inventory.ttl",
  );
  const firstMetadata = requiredPlannedFileContents(
    firstPlan.updatedFiles,
    "_mesh/_meta/meta.ttl",
  );
  const repeatedPlan = planMeshSupportResourcePages({
    meshBase,
    currentMeshInventoryTurtle: firstInventory,
    currentMeshMetadataTurtle: firstMetadata,
    currentMeshConfigTurtle,
    supportHistoryPolicies: {
      meshMetadata: "versioned",
      meshInventory: "versioned",
      config: "versioned",
    },
  });

  assertEquals(repeatedPlan.createdFiles, []);
  assertEquals(repeatedPlan.updatedFiles, []);
});

Deno.test("initial versioned mesh-support append rejects a single-valued conflict", () => {
  const currentMeshInventoryTurtle = `${carriedMeshInventoryTurtle()}
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

<_mesh/_meta/_history001> sflo:historyOrdinal "9"^^xsd:nonNegativeInteger .
`;

  assertThrows(
    () => planVersionedMeshSupportPages(currentMeshInventoryTurtle),
    WeaveInputError,
    "<https://semantic-flow.github.io/sflo/ontology/historyOrdinal>",
  );
});

Deno.test("initial versioned mesh-support append rejects stale inventory progression", () => {
  const currentMeshInventoryTurtle = `${carriedMeshInventoryTurtle()}
<_mesh/_meta> sflo:currentArtifactHistory <_mesh/_meta/_history001> .
`;

  assertThrows(
    () => planVersionedMeshSupportPages(currentMeshInventoryTurtle),
    WeaveInputError,
    "legacy inventory-owned mutable progression predicates",
  );
});

Deno.test("initial mesh-support append applies mixed history policies in one semantic union", async () => {
  const currentMeshInventoryTurtle = carriedMeshInventoryTurtle();
  const plan = planMeshSupportResourcePages({
    meshBase,
    currentMeshInventoryTurtle,
    currentMeshMetadataTurtle: initialMeshMetadataTurtle(),
    currentMeshConfigTurtle: "# mixed-policy config bytes\n",
    supportHistoryPolicies: {
      meshMetadata: "versioned",
      meshInventory: "currentOnly",
      config: "versioned",
    },
  });
  const updatedInventory = requiredPlannedFileContents(
    plan.updatedFiles,
    "_mesh/_inventory/inventory.ttl",
  );
  const updatedMetadata = requiredPlannedFileContents(
    plan.updatedFiles,
    "_mesh/_meta/meta.ttl",
  );

  assert(updatedInventory.startsWith(currentMeshInventoryTurtle));
  assertEquals(
    await compareRdfContent({
      left: encode(updatedInventory),
      right: encode(
        `${currentMeshInventoryTurtle}${
          requestedInitialSupportFactsTurtle([
            "_mesh/_meta",
            "_mesh/_config",
          ])
        }`,
      ),
      path: "_mesh/_inventory/inventory.ttl",
    }),
    true,
  );
  assertStringIncludes(
    updatedMetadata,
    "<_mesh/_meta/_history001>",
  );
  assertStringIncludes(
    updatedMetadata,
    "<_mesh/_config/_history001>",
  );
  assertFalse(updatedMetadata.includes("<_mesh/_inventory/_history001>"));
  assertFalse(
    plan.createdFiles.some((file) =>
      file.path ===
        "_mesh/_inventory/_history001/_s0001/ttl/inventory.ttl"
    ),
  );
  assertEquals(
    requiredPlannedFileContents(
      plan.createdFiles,
      "_mesh/_meta/_history001/_s0001/ttl/meta.ttl",
    ),
    updatedMetadata,
  );
  assertEquals(
    requiredPlannedFileContents(
      plan.createdFiles,
      "_mesh/_config/_history001/_s0001/ttl/config.ttl",
    ),
    "# mixed-policy config bytes\n",
  );
});

Deno.test("initial versioned mesh-support append supports meshes without config", () => {
  const currentMeshInventoryTurtle = initialSupportInventoryTurtle().replace(
    /\n<_mesh\/_config>[\s\S]*$/,
    "\n",
  );
  const plan = planMeshSupportResourcePages({
    meshBase,
    currentMeshInventoryTurtle,
    currentMeshMetadataTurtle: initialMeshMetadataTurtle(),
    supportHistoryPolicies: {
      meshMetadata: "versioned",
      meshInventory: "versioned",
      config: "versioned",
    },
  });

  assertFalse(
    plan.createdFiles.some((file) => file.path.includes("_mesh/_config")),
  );
  assertFalse(
    plan.updatedFiles.some((file) =>
      file.contents.includes("<_mesh/_config/_history001>")
    ),
  );
});

function planCurrentOnlyMeshSupportPages(
  currentMeshInventoryTurtle: string,
) {
  return planMeshSupportResourcePages({
    meshBase,
    currentMeshInventoryTurtle,
    currentMeshMetadataTurtle: "# metadata bytes are not versioned here\n",
    currentMeshConfigTurtle: "# config bytes are not versioned here\n",
    supportHistoryPolicies: {
      meshMetadata: "currentOnly",
      meshInventory: "currentOnly",
      config: "currentOnly",
    },
  });
}

function planVersionedMeshSupportPages(currentMeshInventoryTurtle: string) {
  return planMeshSupportResourcePages({
    meshBase,
    currentMeshInventoryTurtle,
    currentMeshMetadataTurtle: initialMeshMetadataTurtle(),
    currentMeshConfigTurtle: "# current config bytes\n",
    supportHistoryPolicies: {
      meshMetadata: "versioned",
      meshInventory: "versioned",
      config: "versioned",
    },
  });
}

function carriedMeshInventoryTurtle(): string {
  return `@base <${meshBase}> .
@prefix ex: <https://example.org/ns/> .
@prefix sflo: <https://semantic-flow.github.io/sflo/ontology/> .

# Preserve this curated mesh comment and every byte below it.
<_mesh> a sflo:SemanticMesh ;
  ex:curatedNote "mesh" .

<_mesh/_meta> a sflo:MeshMetadata ;
  ex:curatedNote "first block" .

<_mesh/_meta> ex:curatedNote "second block" .

<_mesh/_inventory> a sflo:MeshInventory ;
  ex:curatedNote "inventory" .

<_mesh/_config> a ex:Configuration ;
  ex:carriedDetail [
    ex:label "existing anonymous detail"
  ] .
`;
}

function requestedSupportPageFactsTurtle(): string {
  return `
@base <${meshBase}> .
@prefix sflo: <https://semantic-flow.github.io/sflo/ontology/> .

<_mesh> sflo:hasResourcePage <_mesh/index.html> .
<_mesh/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<_mesh/_meta> sflo:hasResourcePage <_mesh/_meta/index.html> .
<_mesh/_meta/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<_mesh/_inventory> sflo:hasResourcePage <_mesh/_inventory/index.html> .
<_mesh/_inventory/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<_mesh/_config> sflo:hasResourcePage <_mesh/_config/index.html> .
<_mesh/_config/index.html> a sflo:ResourcePage, sflo:LocatedFile .
`;
}

function requestedInitialSupportFactsTurtle(
  versionedSupportPaths: readonly string[],
): string {
  const supportPaths = ["_mesh/_meta", "_mesh/_inventory", "_mesh/_config"];
  const facts = [
    `<_mesh> sflo:hasResourcePage <_mesh/index.html> .
<_mesh/index.html> a sflo:ResourcePage, sflo:LocatedFile .`,
    ...supportPaths.map((supportPath) => {
      const pagePath = `${supportPath}/index.html`;
      const currentFacts =
        `<${supportPath}> sflo:hasResourcePage <${pagePath}>${
          versionedSupportPaths.includes(supportPath)
            ? ` ;\n  sflo:hasArtifactHistory <${supportPath}/_history001>`
            : ""
        } .
<${pagePath}> a sflo:ResourcePage, sflo:LocatedFile .`;
      if (!versionedSupportPaths.includes(supportPath)) {
        return currentFacts;
      }

      const historyPath = `${supportPath}/_history001`;
      const statePath = `${historyPath}/_s0001`;
      const manifestationPath = `${statePath}/ttl`;
      const snapshotFilename = supportPath === "_mesh/_meta"
        ? "meta.ttl"
        : supportPath === "_mesh/_inventory"
        ? "inventory.ttl"
        : "config.ttl";
      const snapshotPath = `${manifestationPath}/${snapshotFilename}`;
      return `${currentFacts}
<${historyPath}> a sflo:ArtifactHistory ;
  sflo:historyOrdinal "1"^^xsd:nonNegativeInteger ;
  sflo:hasHistoricalState <${statePath}> ;
  sflo:hasResourcePage <${historyPath}/index.html> .
<${statePath}> a sflo:HistoricalState ;
  sflo:stateOrdinal "1"^^xsd:nonNegativeInteger ;
  sflo:hasManifestation <${manifestationPath}> ;
  sflo:locatedFileForState <${snapshotPath}> ;
  sflo:hasResourcePage <${statePath}/index.html> .
<${manifestationPath}> a sflo:ArtifactManifestation, sflo:RdfDocument ;
  sflo:locatedFileForManifestation <${snapshotPath}> ;
  sflo:hasResourcePage <${manifestationPath}/index.html> .
<${snapshotPath}> a sflo:LocatedFile, sflo:RdfDocument .
<${historyPath}/index.html> a sflo:ResourcePage, sflo:LocatedFile .
<${statePath}/index.html> a sflo:ResourcePage, sflo:LocatedFile .
<${manifestationPath}/index.html> a sflo:ResourcePage, sflo:LocatedFile .`;
    }),
  ];

  return `
@base <${meshBase}> .
@prefix sflo: <https://semantic-flow.github.io/sflo/ontology/> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

${facts.join("\n")}
`;
}

function initialSupportInventoryTurtle(): string {
  return [
    "@base <" + meshBase + "> .",
    "@prefix sflo: <https://semantic-flow.github.io/sflo/ontology/> .",
    "",
    "<_mesh> a sflo:SemanticMesh .",
    "",
    "<_mesh/_meta> a sflo:MeshMetadata, sflo:DigitalArtifact, sflo:RdfDocument ;",
    "  sflo:hasWorkingLocatedFile <_mesh/_meta/meta.ttl> .",
    "",
    "<_mesh/_inventory> a sflo:MeshInventory, sflo:DigitalArtifact, sflo:RdfDocument ;",
    "  sflo:hasWorkingLocatedFile <_mesh/_inventory/inventory.ttl> .",
    "",
    "<_mesh/_config> a sflo:DigitalArtifact, sflo:RdfDocument ;",
    "  sflo:hasWorkingLocatedFile <_mesh/_config/config.ttl> .",
    "",
    "<_mesh/_meta/meta.ttl> a sflo:LocatedFile, sflo:RdfDocument .",
    "",
    "<_mesh/_inventory/inventory.ttl> a sflo:LocatedFile, sflo:RdfDocument .",
    "",
    "<_mesh/_config/config.ttl> a sflo:LocatedFile, sflo:RdfDocument .",
    "",
  ].join("\n");
}

function initialMeshMetadataTurtle(): string {
  return [
    "@base <" + meshBase + "> .",
    "@prefix sflo: <https://semantic-flow.github.io/sflo/ontology/> .",
    "",
    "<_mesh> a sflo:SemanticMesh .",
    "",
    "<_mesh/_meta> a sflo:MeshMetadata, sflo:DigitalArtifact, sflo:RdfDocument .",
    "",
  ].join("\n");
}

function encode(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

function requiredPlannedFileContents(
  files: readonly { path: string; contents: string }[],
  path: string,
): string {
  const contents = files.find((file) => file.path === path)?.contents;
  assert(contents !== undefined, `Expected planned file ${path}.`);
  return contents;
}
