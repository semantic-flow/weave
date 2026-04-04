import type { PlannedFile } from "../planned_file.ts";

export interface WeaveRequest {
  designatorPaths?: readonly string[];
}

export interface FirstWeaveKnopCandidate {
  designatorPath: string;
  currentKnopMetadataTurtle: string;
  currentKnopInventoryTurtle: string;
}

export interface PlanWeaveInput {
  request: WeaveRequest;
  meshBase: string;
  currentMeshInventoryTurtle: string;
  weaveableKnops: readonly FirstWeaveKnopCandidate[];
}

export interface WeavePlan {
  meshBase: string;
  wovenDesignatorPaths: readonly string[];
  createdFiles: readonly PlannedFile[];
  updatedFiles: readonly PlannedFile[];
}

export class WeaveInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WeaveInputError";
  }
}

export function planWeave(input: PlanWeaveInput): WeavePlan {
  const meshBase = normalizeMeshBase(input.meshBase);
  assertCurrentMeshInventoryShape(input.currentMeshInventoryTurtle);

  const requestedDesignatorPaths = normalizeRequestedDesignatorPaths(
    input.request.designatorPaths ?? [],
  );
  const weaveableKnops = filterWeaveableKnops(
    input.weaveableKnops,
    requestedDesignatorPaths,
  );

  if (weaveableKnops.length === 0) {
    throw new WeaveInputError("No first-weave knop candidates were found.");
  }
  if (weaveableKnops.length !== 1) {
    throw new WeaveInputError(
      `The current local weave slice supports exactly one first-weave knop candidate; found ${weaveableKnops.length}.`,
    );
  }

  const candidate = weaveableKnops[0]!;
  const designatorPath = candidate.designatorPath;
  const knopPath = toKnopPath(designatorPath);

  assertCurrentKnopMetadataShape(
    candidate.currentKnopMetadataTurtle,
    designatorPath,
    knopPath,
  );
  assertCurrentKnopInventoryShape(
    candidate.currentKnopInventoryTurtle,
    knopPath,
  );

  return {
    meshBase,
    wovenDesignatorPaths: [designatorPath],
    createdFiles: [
      {
        path: "_mesh/_inventory/_history001/_s0002/inventory-ttl/inventory.ttl",
        contents: renderWovenMeshInventoryTurtle(meshBase, designatorPath),
      },
      {
        path: "_mesh/_inventory/_history001/_s0002/index.html",
        contents: renderSimplePage({
          meshBase,
          resourcePath: "_mesh/_inventory/_history001/_s0002",
          heading: "_mesh/_inventory/_history001/_s0002",
          description:
            "Resource page for the second MeshInventory historical state.",
        }),
      },
      {
        path: "_mesh/_inventory/_history001/_s0002/inventory-ttl/index.html",
        contents: renderSimplePage({
          meshBase,
          resourcePath: "_mesh/_inventory/_history001/_s0002/inventory-ttl",
          heading: "_mesh/_inventory/_history001/_s0002/inventory-ttl",
          description:
            "Resource page for the Turtle manifestation of the second MeshInventory historical state.",
        }),
      },
      {
        path: `${designatorPath}/index.html`,
        contents: renderIdentifierPage(meshBase, designatorPath),
      },
      {
        path: `${knopPath}/index.html`,
        contents: renderSimplePage({
          meshBase,
          resourcePath: knopPath,
          heading: knopPath,
          description:
            `Resource page for the Knop associated with the ${designatorPath} designator.`,
        }),
      },
      {
        path: `${knopPath}/_meta/index.html`,
        contents: renderSimplePage({
          meshBase,
          resourcePath: `${knopPath}/_meta`,
          heading: `${knopPath}/_meta`,
          description:
            `Resource page for the ${designatorPath} KnopMetadata artifact.`,
        }),
      },
      {
        path: `${knopPath}/_meta/_history001/index.html`,
        contents: renderSimplePage({
          meshBase,
          resourcePath: `${knopPath}/_meta/_history001`,
          heading: `${knopPath}/_meta/_history001`,
          description:
            `Resource page for the current explicit history of the ${designatorPath} KnopMetadata artifact.`,
        }),
      },
      {
        path: `${knopPath}/_meta/_history001/_s0001/index.html`,
        contents: renderSimplePage({
          meshBase,
          resourcePath: `${knopPath}/_meta/_history001/_s0001`,
          heading: `${knopPath}/_meta/_history001/_s0001`,
          description:
            `Resource page for the first ${designatorPath} KnopMetadata historical state.`,
        }),
      },
      {
        path: `${knopPath}/_meta/_history001/_s0001/meta-ttl/index.html`,
        contents: renderSimplePage({
          meshBase,
          resourcePath: `${knopPath}/_meta/_history001/_s0001/meta-ttl`,
          heading: `${knopPath}/_meta/_history001/_s0001/meta-ttl`,
          description:
            `Resource page for the Turtle manifestation of the first ${designatorPath} KnopMetadata historical state.`,
        }),
      },
      {
        path: `${knopPath}/_meta/_history001/_s0001/meta-ttl/meta.ttl`,
        contents: candidate.currentKnopMetadataTurtle,
      },
      {
        path: `${knopPath}/_inventory/index.html`,
        contents: renderSimplePage({
          meshBase,
          resourcePath: `${knopPath}/_inventory`,
          heading: `${knopPath}/_inventory`,
          description:
            `Resource page for the ${designatorPath} KnopInventory artifact.`,
        }),
      },
      {
        path: `${knopPath}/_inventory/_history001/index.html`,
        contents: renderSimplePage({
          meshBase,
          resourcePath: `${knopPath}/_inventory/_history001`,
          heading: `${knopPath}/_inventory/_history001`,
          description:
            `Resource page for the current explicit history of the ${designatorPath} KnopInventory artifact.`,
        }),
      },
      {
        path: `${knopPath}/_inventory/_history001/_s0001/index.html`,
        contents: renderSimplePage({
          meshBase,
          resourcePath: `${knopPath}/_inventory/_history001/_s0001`,
          heading: `${knopPath}/_inventory/_history001/_s0001`,
          description:
            `Resource page for the first ${designatorPath} KnopInventory historical state.`,
        }),
      },
      {
        path:
          `${knopPath}/_inventory/_history001/_s0001/inventory-ttl/index.html`,
        contents: renderSimplePage({
          meshBase,
          resourcePath:
            `${knopPath}/_inventory/_history001/_s0001/inventory-ttl`,
          heading: `${knopPath}/_inventory/_history001/_s0001/inventory-ttl`,
          description:
            `Resource page for the Turtle manifestation of the first ${designatorPath} KnopInventory historical state.`,
        }),
      },
      {
        path:
          `${knopPath}/_inventory/_history001/_s0001/inventory-ttl/inventory.ttl`,
        contents: renderWovenKnopInventoryTurtle(meshBase, designatorPath),
      },
    ],
    updatedFiles: [
      {
        path: "_mesh/_inventory/inventory.ttl",
        contents: renderWovenMeshInventoryTurtle(meshBase, designatorPath),
      },
      {
        path: `${knopPath}/_inventory/inventory.ttl`,
        contents: renderWovenKnopInventoryTurtle(meshBase, designatorPath),
      },
    ],
  };
}

function normalizeMeshBase(meshBase: string): string {
  const trimmed = meshBase.trim();
  if (trimmed.length === 0) {
    throw new WeaveInputError("meshBase is required");
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new WeaveInputError("meshBase must be an absolute IRI");
  }

  if (!url.pathname.endsWith("/")) {
    throw new WeaveInputError("meshBase must end with '/'");
  }
  if (url.search.length > 0 || url.hash.length > 0) {
    throw new WeaveInputError("meshBase must not include a query or fragment");
  }

  return url.href;
}

function normalizeRequestedDesignatorPaths(
  designatorPaths: readonly string[],
): readonly string[] {
  return designatorPaths
    .map((path) => path.trim())
    .filter((path) => path.length > 0);
}

function filterWeaveableKnops(
  weaveableKnops: readonly FirstWeaveKnopCandidate[],
  requestedDesignatorPaths: readonly string[],
): readonly FirstWeaveKnopCandidate[] {
  if (requestedDesignatorPaths.length === 0) {
    return weaveableKnops;
  }

  const requested = new Set(requestedDesignatorPaths);
  const filtered = weaveableKnops.filter((candidate) =>
    requested.has(candidate.designatorPath)
  );

  if (filtered.length === 0) {
    throw new WeaveInputError(
      "Requested designator paths did not match any first-weave knop candidates.",
    );
  }

  return filtered;
}

function assertCurrentMeshInventoryShape(
  currentMeshInventoryTurtle: string,
): void {
  const requiredFragments = [
    "<_mesh/_inventory> a sflo:MeshInventory, sflo:DigitalArtifact, sflo:RdfDocument ;",
    "sflo:currentArtifactHistory <_mesh/_inventory/_history001> ;",
    "sflo:latestHistoricalState <_mesh/_inventory/_history001/_s0001> ;",
    'sflo:nextStateOrdinal "2"^^xsd:nonNegativeInteger ;',
  ];

  for (const fragment of requiredFragments) {
    if (!currentMeshInventoryTurtle.includes(fragment)) {
      throw new WeaveInputError(
        "The current local weave slice only supports the settled 04 pre-weave mesh inventory shape.",
      );
    }
  }
}

function assertCurrentKnopMetadataShape(
  currentKnopMetadataTurtle: string,
  designatorPath: string,
  knopPath: string,
): void {
  const requiredFragments = [
    `<${knopPath}> a sflo:Knop ;`,
    `sflo:designatorPath "${designatorPath}" ;`,
    `sflo:hasWorkingKnopInventoryFile <${knopPath}/_inventory/inventory.ttl> .`,
  ];

  for (const fragment of requiredFragments) {
    if (!currentKnopMetadataTurtle.includes(fragment)) {
      throw new WeaveInputError(
        `The current local weave slice only supports the settled first-weave KnopMetadata shape for ${designatorPath}.`,
      );
    }
  }

  if (currentKnopMetadataTurtle.includes("sflo:hasArtifactHistory")) {
    throw new WeaveInputError(
      `KnopMetadata already has explicit history for ${designatorPath}.`,
    );
  }
}

function assertCurrentKnopInventoryShape(
  currentKnopInventoryTurtle: string,
  knopPath: string,
): void {
  const requiredFragments = [
    `<${knopPath}> a sflo:Knop ;`,
    `sflo:hasKnopMetadata <${knopPath}/_meta> ;`,
    `sflo:hasKnopInventory <${knopPath}/_inventory> ;`,
    `sflo:hasWorkingKnopInventoryFile <${knopPath}/_inventory/inventory.ttl> .`,
  ];

  for (const fragment of requiredFragments) {
    if (!currentKnopInventoryTurtle.includes(fragment)) {
      throw new WeaveInputError(
        `The current local weave slice only supports the settled first-weave KnopInventory shape for ${knopPath}.`,
      );
    }
  }

  if (currentKnopInventoryTurtle.includes("sflo:hasArtifactHistory")) {
    throw new WeaveInputError(
      `KnopInventory already has explicit history for ${knopPath}.`,
    );
  }
}

function renderWovenMeshInventoryTurtle(
  meshBase: string,
  designatorPath: string,
): string {
  const knopPath = toKnopPath(designatorPath);

  return `@base <${meshBase}> .
@prefix sflo: <https://semantic-flow.github.io/semantic-flow-ontology/> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

<_mesh> a sflo:SemanticMesh ;
  sflo:meshBase "${meshBase}"^^xsd:anyURI ;
  sflo:hasMeshMetadata <_mesh/_meta> ;
  sflo:hasMeshInventory <_mesh/_inventory> ;
  sflo:hasKnop <${knopPath}> ;
  sflo:hasResourcePage <_mesh/index.html> .

<${designatorPath}>
  sflo:hasResourcePage <${designatorPath}/index.html> .

<${knopPath}> a sflo:Knop ;
  sflo:hasWorkingKnopInventoryFile <${knopPath}/_inventory/inventory.ttl> ;
  sflo:hasResourcePage <${knopPath}/index.html> .

<_mesh/_meta> a sflo:MeshMetadata, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasArtifactHistory <_mesh/_meta/_history001> ;
  sflo:currentArtifactHistory <_mesh/_meta/_history001> ;
  sflo:nextHistoryOrdinal "2"^^xsd:nonNegativeInteger ;
  sflo:hasWorkingLocatedFile <_mesh/_meta/meta.ttl> ;
  sflo:hasResourcePage <_mesh/_meta/index.html> .

<_mesh/_meta/_history001> a sflo:ArtifactHistory ;
  sflo:historyOrdinal "1"^^xsd:nonNegativeInteger ;
  sflo:hasHistoricalState <_mesh/_meta/_history001/_s0001> ;
  sflo:latestHistoricalState <_mesh/_meta/_history001/_s0001> ;
  sflo:nextStateOrdinal "2"^^xsd:nonNegativeInteger ;
  sflo:hasResourcePage <_mesh/_meta/_history001/index.html> .

<_mesh/_meta/_history001/_s0001> a sflo:HistoricalState ;
  sflo:stateOrdinal "1"^^xsd:nonNegativeInteger ;
  sflo:hasManifestation <_mesh/_meta/_history001/_s0001/meta-ttl> ;
  sflo:locatedFileForState <_mesh/_meta/_history001/_s0001/meta-ttl/meta.ttl> ;
  sflo:hasResourcePage <_mesh/_meta/_history001/_s0001/index.html> .

<_mesh/_meta/_history001/_s0001/meta-ttl> a sflo:ArtifactManifestation, sflo:RdfDocument ;
  sflo:hasLocatedFile <_mesh/_meta/_history001/_s0001/meta-ttl/meta.ttl> ;
  sflo:hasResourcePage <_mesh/_meta/_history001/_s0001/meta-ttl/index.html> .

<_mesh/_inventory> a sflo:MeshInventory, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasArtifactHistory <_mesh/_inventory/_history001> ;
  sflo:currentArtifactHistory <_mesh/_inventory/_history001> ;
  sflo:nextHistoryOrdinal "2"^^xsd:nonNegativeInteger ;
  sflo:hasWorkingLocatedFile <_mesh/_inventory/inventory.ttl> ;
  sflo:hasResourcePage <_mesh/_inventory/index.html> .

<_mesh/_inventory/_history001> a sflo:ArtifactHistory ;
  sflo:historyOrdinal "1"^^xsd:nonNegativeInteger ;
  sflo:hasHistoricalState <_mesh/_inventory/_history001/_s0001> ;
  sflo:hasHistoricalState <_mesh/_inventory/_history001/_s0002> ;
  sflo:latestHistoricalState <_mesh/_inventory/_history001/_s0002> ;
  sflo:nextStateOrdinal "3"^^xsd:nonNegativeInteger ;
  sflo:hasResourcePage <_mesh/_inventory/_history001/index.html> .

<_mesh/_inventory/_history001/_s0001> a sflo:HistoricalState ;
  sflo:stateOrdinal "1"^^xsd:nonNegativeInteger ;
  sflo:hasManifestation <_mesh/_inventory/_history001/_s0001/inventory-ttl> ;
  sflo:locatedFileForState <_mesh/_inventory/_history001/_s0001/inventory-ttl/inventory.ttl> ;
  sflo:hasResourcePage <_mesh/_inventory/_history001/_s0001/index.html> .

<_mesh/_inventory/_history001/_s0001/inventory-ttl> a sflo:ArtifactManifestation, sflo:RdfDocument ;
  sflo:hasLocatedFile <_mesh/_inventory/_history001/_s0001/inventory-ttl/inventory.ttl> ;
  sflo:hasResourcePage <_mesh/_inventory/_history001/_s0001/inventory-ttl/index.html> .

<_mesh/_inventory/_history001/_s0002> a sflo:HistoricalState ;
  sflo:stateOrdinal "2"^^xsd:nonNegativeInteger ;
  sflo:previousHistoricalState <_mesh/_inventory/_history001/_s0001> ;
  sflo:hasManifestation <_mesh/_inventory/_history001/_s0002/inventory-ttl> ;
  sflo:locatedFileForState <_mesh/_inventory/_history001/_s0002/inventory-ttl/inventory.ttl> ;
  sflo:hasResourcePage <_mesh/_inventory/_history001/_s0002/index.html> .

<_mesh/_inventory/_history001/_s0002/inventory-ttl> a sflo:ArtifactManifestation, sflo:RdfDocument ;
  sflo:hasLocatedFile <_mesh/_inventory/_history001/_s0002/inventory-ttl/inventory.ttl> ;
  sflo:hasResourcePage <_mesh/_inventory/_history001/_s0002/inventory-ttl/index.html> .

<_mesh/_meta/meta.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<_mesh/_inventory/inventory.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<_mesh/_meta/_history001/_s0001/meta-ttl/meta.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<_mesh/_inventory/_history001/_s0001/inventory-ttl/inventory.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<_mesh/_inventory/_history001/_s0002/inventory-ttl/inventory.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<${knopPath}/_inventory/inventory.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<_mesh/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${designatorPath}/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${knopPath}/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<_mesh/_meta/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<_mesh/_meta/_history001/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<_mesh/_meta/_history001/_s0001/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<_mesh/_meta/_history001/_s0001/meta-ttl/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<_mesh/_inventory/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<_mesh/_inventory/_history001/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<_mesh/_inventory/_history001/_s0001/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<_mesh/_inventory/_history001/_s0001/inventory-ttl/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<_mesh/_inventory/_history001/_s0002/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<_mesh/_inventory/_history001/_s0002/inventory-ttl/index.html> a sflo:ResourcePage, sflo:LocatedFile .
`;
}

function renderWovenKnopInventoryTurtle(
  meshBase: string,
  designatorPath: string,
): string {
  const knopPath = toKnopPath(designatorPath);

  return `@base <${meshBase}> .
@prefix sflo: <https://semantic-flow.github.io/semantic-flow-ontology/> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

<${knopPath}> a sflo:Knop ;
  sflo:hasKnopMetadata <${knopPath}/_meta> ;
  sflo:hasKnopInventory <${knopPath}/_inventory> ;
  sflo:hasWorkingKnopInventoryFile <${knopPath}/_inventory/inventory.ttl> ;
  sflo:hasResourcePage <${knopPath}/index.html> .

<${knopPath}/_meta> a sflo:KnopMetadata, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasArtifactHistory <${knopPath}/_meta/_history001> ;
  sflo:currentArtifactHistory <${knopPath}/_meta/_history001> ;
  sflo:nextHistoryOrdinal "2"^^xsd:nonNegativeInteger ;
  sflo:hasWorkingLocatedFile <${knopPath}/_meta/meta.ttl> ;
  sflo:hasResourcePage <${knopPath}/_meta/index.html> .

<${knopPath}/_meta/_history001> a sflo:ArtifactHistory ;
  sflo:historyOrdinal "1"^^xsd:nonNegativeInteger ;
  sflo:hasHistoricalState <${knopPath}/_meta/_history001/_s0001> ;
  sflo:latestHistoricalState <${knopPath}/_meta/_history001/_s0001> ;
  sflo:nextStateOrdinal "2"^^xsd:nonNegativeInteger ;
  sflo:hasResourcePage <${knopPath}/_meta/_history001/index.html> .

<${knopPath}/_meta/_history001/_s0001> a sflo:HistoricalState ;
  sflo:stateOrdinal "1"^^xsd:nonNegativeInteger ;
  sflo:hasManifestation <${knopPath}/_meta/_history001/_s0001/meta-ttl> ;
  sflo:locatedFileForState <${knopPath}/_meta/_history001/_s0001/meta-ttl/meta.ttl> ;
  sflo:hasResourcePage <${knopPath}/_meta/_history001/_s0001/index.html> .

<${knopPath}/_meta/_history001/_s0001/meta-ttl> a sflo:ArtifactManifestation, sflo:RdfDocument ;
  sflo:hasLocatedFile <${knopPath}/_meta/_history001/_s0001/meta-ttl/meta.ttl> ;
  sflo:hasResourcePage <${knopPath}/_meta/_history001/_s0001/meta-ttl/index.html> .

<${knopPath}/_inventory> a sflo:KnopInventory, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasArtifactHistory <${knopPath}/_inventory/_history001> ;
  sflo:currentArtifactHistory <${knopPath}/_inventory/_history001> ;
  sflo:nextHistoryOrdinal "2"^^xsd:nonNegativeInteger ;
  sflo:hasWorkingLocatedFile <${knopPath}/_inventory/inventory.ttl> ;
  sflo:hasResourcePage <${knopPath}/_inventory/index.html> .

<${knopPath}/_inventory/_history001> a sflo:ArtifactHistory ;
  sflo:historyOrdinal "1"^^xsd:nonNegativeInteger ;
  sflo:hasHistoricalState <${knopPath}/_inventory/_history001/_s0001> ;
  sflo:latestHistoricalState <${knopPath}/_inventory/_history001/_s0001> ;
  sflo:nextStateOrdinal "2"^^xsd:nonNegativeInteger ;
  sflo:hasResourcePage <${knopPath}/_inventory/_history001/index.html> .

<${knopPath}/_inventory/_history001/_s0001> a sflo:HistoricalState ;
  sflo:stateOrdinal "1"^^xsd:nonNegativeInteger ;
  sflo:hasManifestation <${knopPath}/_inventory/_history001/_s0001/inventory-ttl> ;
  sflo:locatedFileForState <${knopPath}/_inventory/_history001/_s0001/inventory-ttl/inventory.ttl> ;
  sflo:hasResourcePage <${knopPath}/_inventory/_history001/_s0001/index.html> .

<${knopPath}/_inventory/_history001/_s0001/inventory-ttl> a sflo:ArtifactManifestation, sflo:RdfDocument ;
  sflo:hasLocatedFile <${knopPath}/_inventory/_history001/_s0001/inventory-ttl/inventory.ttl> ;
  sflo:hasResourcePage <${knopPath}/_inventory/_history001/_s0001/inventory-ttl/index.html> .

<${knopPath}/_meta/meta.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<${knopPath}/_inventory/inventory.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<${knopPath}/_meta/_history001/_s0001/meta-ttl/meta.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<${knopPath}/_inventory/_history001/_s0001/inventory-ttl/inventory.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<${knopPath}/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${knopPath}/_meta/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${knopPath}/_meta/_history001/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${knopPath}/_meta/_history001/_s0001/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${knopPath}/_meta/_history001/_s0001/meta-ttl/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${knopPath}/_inventory/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${knopPath}/_inventory/_history001/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${knopPath}/_inventory/_history001/_s0001/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${knopPath}/_inventory/_history001/_s0001/inventory-ttl/index.html> a sflo:ResourcePage, sflo:LocatedFile .
`;
}

function renderIdentifierPage(
  meshBase: string,
  designatorPath: string,
): string {
  const canonical = new URL(designatorPath, meshBase).href;

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${deriveMeshLabel(meshBase)} ${designatorPath}</title>
  <link rel="canonical" href="${canonical}">
</head>
<body>
  <main>
    <h1><strong>${designatorPath}</strong></h1>
    <p>Resource page for the Semantic Flow identifier <a href="${canonical}">${canonical}</a>.</p>
  </main>
  <footer>
    <small>The Semantic Flow identifier <a href="${canonical}">${canonical}</a> has an associated Knop at <a href="./_knop">./_knop</a>.</small>
  </footer>
</body>
</html>
`;
}

function renderSimplePage(
  options: {
    meshBase: string;
    resourcePath: string;
    heading: string;
    description: string;
  },
): string {
  const canonical = new URL(options.resourcePath, options.meshBase).href;

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${deriveMeshLabel(options.meshBase)} ${options.resourcePath}</title>
  <link rel="canonical" href="${canonical}">
</head>
<body>
  <main>
    <h1>${options.heading}</h1>
    <p>${options.description}</p>
  </main>
</body>
</html>
`;
}

function deriveMeshLabel(meshBase: string): string {
  const url = new URL(meshBase);
  const segments = url.pathname.split("/").filter((segment) =>
    segment.length > 0
  );
  return segments[segments.length - 1] ?? "_mesh";
}

function toKnopPath(designatorPath: string): string {
  return `${designatorPath}/_knop`;
}
