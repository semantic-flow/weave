import type { PlannedFile } from "../planned_file.ts";

export interface WeaveRequest {
  designatorPaths?: readonly string[];
}

export interface PayloadWorkingArtifact {
  workingFilePath: string;
  currentPayloadTurtle: string;
}

export interface WeaveableKnopCandidate {
  designatorPath: string;
  currentKnopMetadataTurtle: string;
  currentKnopInventoryTurtle: string;
  payloadArtifact?: PayloadWorkingArtifact;
}

export interface IdentifierResourcePageModel {
  kind: "identifier";
  path: string;
  designatorPath: string;
  workingFilePath?: string;
}

export interface SimpleResourcePageModel {
  kind: "simple";
  path: string;
  description: string;
}

export type ResourcePageModel =
  | IdentifierResourcePageModel
  | SimpleResourcePageModel;

export interface PlanWeaveInput {
  request: WeaveRequest;
  meshBase: string;
  currentMeshInventoryTurtle: string;
  weaveableKnops: readonly WeaveableKnopCandidate[];
}

export interface WeavePlan {
  meshBase: string;
  wovenDesignatorPaths: readonly string[];
  createdFiles: readonly PlannedFile[];
  updatedFiles: readonly PlannedFile[];
  createdPages: readonly ResourcePageModel[];
}

export class WeaveInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WeaveInputError";
  }
}

type WeaveSlice = "firstKnopWeave" | "firstPayloadWeave";

export function planWeave(input: PlanWeaveInput): WeavePlan {
  const meshBase = normalizeMeshBase(input.meshBase);
  const requestedDesignatorPaths = normalizeRequestedDesignatorPaths(
    input.request.designatorPaths ?? [],
  );
  const weaveableKnops = filterWeaveableKnops(
    input.weaveableKnops,
    requestedDesignatorPaths,
  );

  if (weaveableKnops.length === 0) {
    throw new WeaveInputError("No weave candidates were found.");
  }
  if (weaveableKnops.length !== 1) {
    throw new WeaveInputError(
      `The current local weave slice supports exactly one weave candidate; found ${weaveableKnops.length}.`,
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

  switch (classifyWeaveSlice(candidate)) {
    case "firstKnopWeave":
      return planFirstKnopWeave(
        meshBase,
        input.currentMeshInventoryTurtle,
        candidate,
      );
    case "firstPayloadWeave":
      return planFirstPayloadWeave(
        meshBase,
        input.currentMeshInventoryTurtle,
        candidate,
      );
  }
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
  weaveableKnops: readonly WeaveableKnopCandidate[],
  requestedDesignatorPaths: readonly string[],
): readonly WeaveableKnopCandidate[] {
  if (requestedDesignatorPaths.length === 0) {
    return weaveableKnops;
  }

  const requested = new Set(requestedDesignatorPaths);
  const filtered = weaveableKnops.filter((candidate) =>
    requested.has(candidate.designatorPath)
  );

  if (filtered.length === 0) {
    throw new WeaveInputError(
      "Requested designator paths did not match any weave candidates.",
    );
  }

  return filtered;
}

function classifyWeaveSlice(candidate: WeaveableKnopCandidate): WeaveSlice {
  const payloadRelationship =
    `sflo:hasPayloadArtifact <${candidate.designatorPath}>`;
  if (!candidate.currentKnopInventoryTurtle.includes(payloadRelationship)) {
    return "firstKnopWeave";
  }
  if (!candidate.payloadArtifact) {
    throw new WeaveInputError(
      `Payload weave candidate ${candidate.designatorPath} is missing working payload state.`,
    );
  }

  return "firstPayloadWeave";
}

function planFirstKnopWeave(
  meshBase: string,
  currentMeshInventoryTurtle: string,
  candidate: WeaveableKnopCandidate,
): WeavePlan {
  assertCurrentMeshInventoryShapeForFirstKnopWeave(currentMeshInventoryTurtle);

  const designatorPath = candidate.designatorPath;

  return {
    meshBase,
    wovenDesignatorPaths: [designatorPath],
    createdFiles: [
      {
        path: "_mesh/_inventory/_history001/_s0002/inventory-ttl/inventory.ttl",
        contents: renderFirstKnopWovenMeshInventoryTurtle(
          meshBase,
          designatorPath,
        ),
      },
      {
        path: `${
          toKnopPath(designatorPath)
        }/_meta/_history001/_s0001/meta-ttl/meta.ttl`,
        contents: candidate.currentKnopMetadataTurtle,
      },
      {
        path: `${
          toKnopPath(designatorPath)
        }/_inventory/_history001/_s0001/inventory-ttl/inventory.ttl`,
        contents: renderFirstKnopWovenKnopInventoryTurtle(
          meshBase,
          designatorPath,
        ),
      },
    ],
    updatedFiles: [
      {
        path: "_mesh/_inventory/inventory.ttl",
        contents: renderFirstKnopWovenMeshInventoryTurtle(
          meshBase,
          designatorPath,
        ),
      },
      {
        path: `${toKnopPath(designatorPath)}/_inventory/inventory.ttl`,
        contents: renderFirstKnopWovenKnopInventoryTurtle(
          meshBase,
          designatorPath,
        ),
      },
    ],
    createdPages: buildFirstKnopWeavePages(designatorPath),
  };
}

function planFirstPayloadWeave(
  meshBase: string,
  currentMeshInventoryTurtle: string,
  candidate: WeaveableKnopCandidate,
): WeavePlan {
  const payloadArtifact = candidate.payloadArtifact!;
  assertCurrentMeshInventoryShapeForFirstPayloadWeave(
    currentMeshInventoryTurtle,
    candidate.designatorPath,
  );
  assertCurrentPayloadArtifactShape(
    candidate.currentKnopInventoryTurtle,
    candidate.designatorPath,
    payloadArtifact.workingFilePath,
  );

  const designatorPath = candidate.designatorPath;
  const knopPath = toKnopPath(designatorPath);
  const payloadManifestationPath = toPayloadManifestationPath(
    designatorPath,
    payloadArtifact.workingFilePath,
  );
  const payloadSnapshotPath = `${payloadManifestationPath}/${
    toFileName(payloadArtifact.workingFilePath)
  }`;

  return {
    meshBase,
    wovenDesignatorPaths: [designatorPath],
    createdFiles: [
      {
        path: "_mesh/_inventory/_history001/_s0003/inventory-ttl/inventory.ttl",
        contents: renderFirstPayloadWovenMeshInventoryTurtle(
          meshBase,
          designatorPath,
          payloadArtifact.workingFilePath,
        ),
      },
      {
        path: payloadSnapshotPath,
        contents: payloadArtifact.currentPayloadTurtle,
      },
      {
        path: `${knopPath}/_meta/_history001/_s0001/meta-ttl/meta.ttl`,
        contents: candidate.currentKnopMetadataTurtle,
      },
      {
        path:
          `${knopPath}/_inventory/_history001/_s0001/inventory-ttl/inventory.ttl`,
        contents: renderFirstPayloadWovenKnopInventoryTurtle(
          meshBase,
          designatorPath,
          payloadArtifact.workingFilePath,
        ),
      },
    ],
    updatedFiles: [
      {
        path: "_mesh/_inventory/inventory.ttl",
        contents: renderFirstPayloadWovenMeshInventoryTurtle(
          meshBase,
          designatorPath,
          payloadArtifact.workingFilePath,
        ),
      },
      {
        path: `${knopPath}/_inventory/inventory.ttl`,
        contents: renderFirstPayloadWovenKnopInventoryTurtle(
          meshBase,
          designatorPath,
          payloadArtifact.workingFilePath,
        ),
      },
    ],
    createdPages: buildFirstPayloadWeavePages(
      designatorPath,
      payloadArtifact.workingFilePath,
    ),
  };
}

function assertCurrentMeshInventoryShapeForFirstKnopWeave(
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

function assertCurrentMeshInventoryShapeForFirstPayloadWeave(
  currentMeshInventoryTurtle: string,
  designatorPath: string,
): void {
  const knopPath = toKnopPath(designatorPath);
  const requiredFragments = [
    "<_mesh/_inventory> a sflo:MeshInventory, sflo:DigitalArtifact, sflo:RdfDocument ;",
    "sflo:currentArtifactHistory <_mesh/_inventory/_history001> ;",
    "sflo:latestHistoricalState <_mesh/_inventory/_history001/_s0002> ;",
    'sflo:nextStateOrdinal "3"^^xsd:nonNegativeInteger ;',
    `<${designatorPath}> a sflo:PayloadArtifact, sflo:DigitalArtifact, sflo:RdfDocument ;`,
    `<${knopPath}> a sflo:Knop ;`,
  ];

  for (const fragment of requiredFragments) {
    if (!currentMeshInventoryTurtle.includes(fragment)) {
      throw new WeaveInputError(
        "The current local weave slice only supports the settled 06 pre-weave payload mesh inventory shape.",
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
        `The current local weave slice only supports the settled first-history KnopMetadata shape for ${designatorPath}.`,
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
    `sflo:hasWorkingKnopInventoryFile <${knopPath}/_inventory/inventory.ttl>`,
  ];

  for (const fragment of requiredFragments) {
    if (!currentKnopInventoryTurtle.includes(fragment)) {
      throw new WeaveInputError(
        `The current local weave slice only supports the settled first-history KnopInventory shape for ${knopPath}.`,
      );
    }
  }

  if (currentKnopInventoryTurtle.includes("sflo:hasArtifactHistory")) {
    throw new WeaveInputError(
      `KnopInventory already has explicit history for ${knopPath}.`,
    );
  }
}

function assertCurrentPayloadArtifactShape(
  currentKnopInventoryTurtle: string,
  designatorPath: string,
  workingFilePath: string,
): void {
  const requiredFragments = [
    `<${designatorPath}> a sflo:PayloadArtifact, sflo:DigitalArtifact, sflo:RdfDocument ;`,
    `sflo:hasWorkingLocatedFile <${workingFilePath}> .`,
  ];

  for (const fragment of requiredFragments) {
    if (!currentKnopInventoryTurtle.includes(fragment)) {
      throw new WeaveInputError(
        `The current local weave slice only supports the settled integrated payload shape for ${designatorPath}.`,
      );
    }
  }

  if (
    currentKnopInventoryTurtle.includes(
      `sflo:hasArtifactHistory <${designatorPath}/_history001>`,
    )
  ) {
    throw new WeaveInputError(
      `Payload artifact already has explicit history for ${designatorPath}.`,
    );
  }
}

function renderFirstKnopWovenMeshInventoryTurtle(
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

function renderFirstKnopWovenKnopInventoryTurtle(
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

function renderFirstPayloadWovenMeshInventoryTurtle(
  meshBase: string,
  designatorPath: string,
  workingFilePath: string,
): string {
  const knopPath = toKnopPath(designatorPath);

  return `@base <${meshBase}> .
@prefix sflo: <https://semantic-flow.github.io/semantic-flow-ontology/> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

<_mesh> a sflo:SemanticMesh ;
  sflo:meshBase "${meshBase}"^^xsd:anyURI ;
  sflo:hasMeshMetadata <_mesh/_meta> ;
  sflo:hasMeshInventory <_mesh/_inventory> ;
  sflo:hasKnop <alice/_knop> ;
  sflo:hasKnop <${knopPath}> ;
  sflo:hasResourcePage <_mesh/index.html> .

<alice>
  sflo:hasResourcePage <alice/index.html> .

<alice/_knop> a sflo:Knop ;
  sflo:hasWorkingKnopInventoryFile <alice/_knop/_inventory/inventory.ttl> ;
  sflo:hasResourcePage <alice/_knop/index.html> .

<${designatorPath}> a sflo:PayloadArtifact, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasWorkingLocatedFile <${workingFilePath}> ;
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
  sflo:hasHistoricalState <_mesh/_inventory/_history001/_s0003> ;
  sflo:latestHistoricalState <_mesh/_inventory/_history001/_s0003> ;
  sflo:nextStateOrdinal "4"^^xsd:nonNegativeInteger ;
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

<_mesh/_inventory/_history001/_s0003> a sflo:HistoricalState ;
  sflo:stateOrdinal "3"^^xsd:nonNegativeInteger ;
  sflo:previousHistoricalState <_mesh/_inventory/_history001/_s0002> ;
  sflo:hasManifestation <_mesh/_inventory/_history001/_s0003/inventory-ttl> ;
  sflo:locatedFileForState <_mesh/_inventory/_history001/_s0003/inventory-ttl/inventory.ttl> ;
  sflo:hasResourcePage <_mesh/_inventory/_history001/_s0003/index.html> .

<_mesh/_inventory/_history001/_s0003/inventory-ttl> a sflo:ArtifactManifestation, sflo:RdfDocument ;
  sflo:hasLocatedFile <_mesh/_inventory/_history001/_s0003/inventory-ttl/inventory.ttl> ;
  sflo:hasResourcePage <_mesh/_inventory/_history001/_s0003/inventory-ttl/index.html> .

<_mesh/_meta/meta.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<_mesh/_inventory/inventory.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<_mesh/_meta/_history001/_s0001/meta-ttl/meta.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<_mesh/_inventory/_history001/_s0001/inventory-ttl/inventory.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<_mesh/_inventory/_history001/_s0002/inventory-ttl/inventory.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<_mesh/_inventory/_history001/_s0003/inventory-ttl/inventory.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<alice/_knop/_inventory/inventory.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<${knopPath}/_inventory/inventory.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<${workingFilePath}> a sflo:LocatedFile, sflo:RdfDocument .

<_mesh/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<alice/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${designatorPath}/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<alice/_knop/index.html> a sflo:ResourcePage, sflo:LocatedFile .

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

<_mesh/_inventory/_history001/_s0003/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<_mesh/_inventory/_history001/_s0003/inventory-ttl/index.html> a sflo:ResourcePage, sflo:LocatedFile .
`;
}

function renderFirstPayloadWovenKnopInventoryTurtle(
  meshBase: string,
  designatorPath: string,
  workingFilePath: string,
): string {
  const knopPath = toKnopPath(designatorPath);
  const payloadManifestationPath = toPayloadManifestationPath(
    designatorPath,
    workingFilePath,
  );
  const payloadSnapshotPath = `${payloadManifestationPath}/${
    toFileName(workingFilePath)
  }`;

  return `@base <${meshBase}> .
@prefix sflo: <https://semantic-flow.github.io/semantic-flow-ontology/> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

<${knopPath}> a sflo:Knop ;
  sflo:hasKnopMetadata <${knopPath}/_meta> ;
  sflo:hasKnopInventory <${knopPath}/_inventory> ;
  sflo:hasWorkingKnopInventoryFile <${knopPath}/_inventory/inventory.ttl> ;
  sflo:hasPayloadArtifact <${designatorPath}> ;
  sflo:hasResourcePage <${knopPath}/index.html> .

<${designatorPath}> a sflo:PayloadArtifact, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasArtifactHistory <${designatorPath}/_history001> ;
  sflo:currentArtifactHistory <${designatorPath}/_history001> ;
  sflo:nextHistoryOrdinal "2"^^xsd:nonNegativeInteger ;
  sflo:hasWorkingLocatedFile <${workingFilePath}> ;
  sflo:hasResourcePage <${designatorPath}/index.html> .

<${designatorPath}/_history001> a sflo:ArtifactHistory ;
  sflo:historyOrdinal "1"^^xsd:nonNegativeInteger ;
  sflo:hasHistoricalState <${designatorPath}/_history001/_s0001> ;
  sflo:latestHistoricalState <${designatorPath}/_history001/_s0001> ;
  sflo:nextStateOrdinal "2"^^xsd:nonNegativeInteger ;
  sflo:hasResourcePage <${designatorPath}/_history001/index.html> .

<${designatorPath}/_history001/_s0001> a sflo:HistoricalState ;
  sflo:stateOrdinal "1"^^xsd:nonNegativeInteger ;
  sflo:hasManifestation <${payloadManifestationPath}> ;
  sflo:locatedFileForState <${payloadSnapshotPath}> ;
  sflo:hasResourcePage <${designatorPath}/_history001/_s0001/index.html> .

<${payloadManifestationPath}> a sflo:ArtifactManifestation, sflo:RdfDocument ;
  sflo:hasLocatedFile <${payloadSnapshotPath}> ;
  sflo:hasResourcePage <${payloadManifestationPath}/index.html> .

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

<${workingFilePath}> a sflo:LocatedFile, sflo:RdfDocument .

<${payloadSnapshotPath}> a sflo:LocatedFile, sflo:RdfDocument .

<${knopPath}/_meta/_history001/_s0001/meta-ttl/meta.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<${knopPath}/_inventory/_history001/_s0001/inventory-ttl/inventory.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<${designatorPath}/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${designatorPath}/_history001/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${designatorPath}/_history001/_s0001/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${payloadManifestationPath}/index.html> a sflo:ResourcePage, sflo:LocatedFile .

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

function buildFirstKnopWeavePages(
  designatorPath: string,
): readonly ResourcePageModel[] {
  const knopPath = toKnopPath(designatorPath);

  return [
    simplePage(
      "_mesh/_inventory/_history001/_s0002/index.html",
      "Resource page for the second MeshInventory historical state.",
    ),
    simplePage(
      "_mesh/_inventory/_history001/_s0002/inventory-ttl/index.html",
      "Resource page for the Turtle manifestation of the second MeshInventory historical state.",
    ),
    identifierPage(`${designatorPath}/index.html`, designatorPath),
    simplePage(
      `${knopPath}/index.html`,
      `Resource page for the Knop associated with the ${designatorPath} designator.`,
    ),
    simplePage(
      `${knopPath}/_meta/index.html`,
      `Resource page for the ${designatorPath} KnopMetadata artifact.`,
    ),
    simplePage(
      `${knopPath}/_meta/_history001/index.html`,
      `Resource page for the current explicit history of the ${designatorPath} KnopMetadata artifact.`,
    ),
    simplePage(
      `${knopPath}/_meta/_history001/_s0001/index.html`,
      `Resource page for the first ${designatorPath} KnopMetadata historical state.`,
    ),
    simplePage(
      `${knopPath}/_meta/_history001/_s0001/meta-ttl/index.html`,
      `Resource page for the Turtle manifestation of the first ${designatorPath} KnopMetadata historical state.`,
    ),
    simplePage(
      `${knopPath}/_inventory/index.html`,
      `Resource page for the ${designatorPath} KnopInventory artifact.`,
    ),
    simplePage(
      `${knopPath}/_inventory/_history001/index.html`,
      `Resource page for the current explicit history of the ${designatorPath} KnopInventory artifact.`,
    ),
    simplePage(
      `${knopPath}/_inventory/_history001/_s0001/index.html`,
      `Resource page for the first ${designatorPath} KnopInventory historical state.`,
    ),
    simplePage(
      `${knopPath}/_inventory/_history001/_s0001/inventory-ttl/index.html`,
      `Resource page for the Turtle manifestation of the first ${designatorPath} KnopInventory historical state.`,
    ),
  ];
}

function buildFirstPayloadWeavePages(
  designatorPath: string,
  workingFilePath: string,
): readonly ResourcePageModel[] {
  const knopPath = toKnopPath(designatorPath);
  const payloadManifestationPath = toPayloadManifestationPath(
    designatorPath,
    workingFilePath,
  );

  return [
    simplePage(
      "_mesh/_inventory/_history001/_s0003/index.html",
      "Resource page for the third MeshInventory historical state.",
    ),
    simplePage(
      "_mesh/_inventory/_history001/_s0003/inventory-ttl/index.html",
      "Resource page for the Turtle manifestation of the third MeshInventory historical state.",
    ),
    identifierPage(
      `${designatorPath}/index.html`,
      designatorPath,
      workingFilePath,
    ),
    simplePage(
      `${designatorPath}/_history001/index.html`,
      `Resource page for the current explicit history of the ${designatorPath} payload artifact.`,
    ),
    simplePage(
      `${designatorPath}/_history001/_s0001/index.html`,
      `Resource page for the first historical state of the ${designatorPath} payload artifact.`,
    ),
    simplePage(
      `${payloadManifestationPath}/index.html`,
      `Resource page for the Turtle manifestation of the first ${designatorPath} payload historical state.`,
    ),
    simplePage(
      `${knopPath}/index.html`,
      `Resource page for the Knop associated with the ${designatorPath} designator.`,
    ),
    simplePage(
      `${knopPath}/_meta/index.html`,
      `Resource page for the ${designatorPath} KnopMetadata artifact.`,
    ),
    simplePage(
      `${knopPath}/_meta/_history001/index.html`,
      `Resource page for the current explicit history of the ${designatorPath} KnopMetadata artifact.`,
    ),
    simplePage(
      `${knopPath}/_meta/_history001/_s0001/index.html`,
      `Resource page for the first ${designatorPath} KnopMetadata historical state.`,
    ),
    simplePage(
      `${knopPath}/_meta/_history001/_s0001/meta-ttl/index.html`,
      `Resource page for the Turtle manifestation of the first ${designatorPath} KnopMetadata historical state.`,
    ),
    simplePage(
      `${knopPath}/_inventory/index.html`,
      `Resource page for the ${designatorPath} KnopInventory artifact.`,
    ),
    simplePage(
      `${knopPath}/_inventory/_history001/index.html`,
      `Resource page for the current explicit history of the ${designatorPath} KnopInventory artifact.`,
    ),
    simplePage(
      `${knopPath}/_inventory/_history001/_s0001/index.html`,
      `Resource page for the first ${designatorPath} KnopInventory historical state.`,
    ),
    simplePage(
      `${knopPath}/_inventory/_history001/_s0001/inventory-ttl/index.html`,
      `Resource page for the Turtle manifestation of the first ${designatorPath} KnopInventory historical state.`,
    ),
  ];
}

function identifierPage(
  path: string,
  designatorPath: string,
  workingFilePath?: string,
): IdentifierResourcePageModel {
  return {
    kind: "identifier",
    path,
    designatorPath,
    workingFilePath,
  };
}

function simplePage(
  path: string,
  description: string,
): SimpleResourcePageModel {
  return {
    kind: "simple",
    path,
    description,
  };
}

function toPayloadManifestationPath(
  designatorPath: string,
  workingFilePath: string,
): string {
  return `${designatorPath}/_history001/_s0001/${
    toManifestationSegment(workingFilePath)
  }`;
}

function toManifestationSegment(workingFilePath: string): string {
  return toFileName(workingFilePath).replaceAll(".", "-");
}

function toFileName(path: string): string {
  const segments = path.split("/");
  return segments[segments.length - 1]!;
}

function toKnopPath(designatorPath: string): string {
  return `${designatorPath}/_knop`;
}
