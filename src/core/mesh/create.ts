export interface MeshCreateRequest {
  meshBase: string;
}

export interface PlannedFile {
  path: string;
  contents: string;
}

export interface MeshCreatePlan {
  meshBase: string;
  meshIri: string;
  files: readonly PlannedFile[];
}

export class MeshCreateInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MeshCreateInputError";
  }
}

export function planMeshCreate(request: MeshCreateRequest): MeshCreatePlan {
  const meshBase = normalizeMeshBase(request.meshBase);
  const meshIri = new URL("_mesh", meshBase).href;

  return {
    meshBase,
    meshIri,
    files: [
      {
        path: "_mesh/_meta/meta.ttl",
        contents: renderMeshMetadataTurtle(meshBase),
      },
      {
        path: "_mesh/_inventory/inventory.ttl",
        contents: renderMeshInventoryTurtle(meshBase),
      },
    ],
  };
}

function normalizeMeshBase(meshBase: string): string {
  const trimmed = meshBase.trim();
  if (trimmed.length === 0) {
    throw new MeshCreateInputError("meshBase is required");
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new MeshCreateInputError("meshBase must be an absolute IRI");
  }

  if (!url.pathname.endsWith("/")) {
    throw new MeshCreateInputError("meshBase must end with '/'");
  }
  if (url.search.length > 0 || url.hash.length > 0) {
    throw new MeshCreateInputError(
      "meshBase must not include a query or fragment",
    );
  }

  return url.href;
}

function renderMeshMetadataTurtle(meshBase: string): string {
  return `@base <${meshBase}> .
@prefix sflo: <https://semantic-flow.github.io/semantic-flow-ontology/> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

<_mesh> a sflo:SemanticMesh ;
  sflo:meshBase "${meshBase}"^^xsd:anyURI ;
  sflo:hasMeshInventory <_mesh/_inventory> .

<_mesh/_meta> a sflo:MeshMetadata, sflo:DigitalArtifact, sflo:RdfDocument .

<_mesh/_inventory> a sflo:MeshInventory, sflo:DigitalArtifact, sflo:RdfDocument .
`;
}

function renderMeshInventoryTurtle(meshBase: string): string {
  return `@base <${meshBase}> .
@prefix sflo: <https://semantic-flow.github.io/semantic-flow-ontology/> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

<_mesh> a sflo:SemanticMesh ;
  sflo:meshBase "${meshBase}"^^xsd:anyURI ;
  sflo:hasMeshMetadata <_mesh/_meta> ;
  sflo:hasMeshInventory <_mesh/_inventory> .

<_mesh/_meta> a sflo:MeshMetadata, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasWorkingLocatedFile <_mesh/_meta/meta.ttl> .

<_mesh/_inventory> a sflo:MeshInventory, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasWorkingLocatedFile <_mesh/_inventory/inventory.ttl> .

<_mesh/_meta/meta.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<_mesh/_inventory/inventory.ttl> a sflo:LocatedFile, sflo:RdfDocument .
`;
}
