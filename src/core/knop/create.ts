import { Parser } from "n3";
import type { Quad } from "n3";
import type { PlannedFile } from "../planned_file.ts";
import {
  normalizeSafeDesignatorPath,
  toKnopPath,
} from "../designator_segments.ts";

const RDF_TYPE_IRI = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type";
const XSD_ANY_URI_IRI = "http://www.w3.org/2001/XMLSchema#anyURI";
const XSD_NON_NEGATIVE_INTEGER_IRI =
  "http://www.w3.org/2001/XMLSchema#nonNegativeInteger";
const SFLO_NAMESPACE =
  "https://semantic-flow.github.io/semantic-flow-ontology/";
const SFLO_ARTIFACT_HISTORY_IRI = `${SFLO_NAMESPACE}ArtifactHistory`;
const SFLO_ARTIFACT_MANIFESTATION_IRI =
  `${SFLO_NAMESPACE}ArtifactManifestation`;
const SFLO_CURRENT_ARTIFACT_HISTORY_IRI =
  `${SFLO_NAMESPACE}currentArtifactHistory`;
const SFLO_DIGITAL_ARTIFACT_IRI = `${SFLO_NAMESPACE}DigitalArtifact`;
const SFLO_HAS_ARTIFACT_HISTORY_IRI = `${SFLO_NAMESPACE}hasArtifactHistory`;
const SFLO_HAS_HISTORICAL_STATE_IRI = `${SFLO_NAMESPACE}hasHistoricalState`;
const SFLO_HAS_KNOP_IRI = `${SFLO_NAMESPACE}hasKnop`;
const SFLO_HAS_LOCATED_FILE_IRI = `${SFLO_NAMESPACE}hasLocatedFile`;
const SFLO_HAS_MANIFESTATION_IRI = `${SFLO_NAMESPACE}hasManifestation`;
const SFLO_HAS_MESH_INVENTORY_IRI = `${SFLO_NAMESPACE}hasMeshInventory`;
const SFLO_HAS_MESH_METADATA_IRI = `${SFLO_NAMESPACE}hasMeshMetadata`;
const SFLO_HAS_RESOURCE_PAGE_IRI = `${SFLO_NAMESPACE}hasResourcePage`;
const SFLO_HAS_WORKING_LOCATED_FILE_IRI =
  `${SFLO_NAMESPACE}hasWorkingLocatedFile`;
const SFLO_HISTORICAL_STATE_IRI = `${SFLO_NAMESPACE}HistoricalState`;
const SFLO_HISTORY_ORDINAL_IRI = `${SFLO_NAMESPACE}historyOrdinal`;
const SFLO_KNOP_IRI = `${SFLO_NAMESPACE}Knop`;
const SFLO_LATEST_HISTORICAL_STATE_IRI =
  `${SFLO_NAMESPACE}latestHistoricalState`;
const SFLO_LOCATED_FILE_FOR_STATE_IRI = `${SFLO_NAMESPACE}locatedFileForState`;
const SFLO_LOCATED_FILE_IRI = `${SFLO_NAMESPACE}LocatedFile`;
const SFLO_MESH_BASE_IRI = `${SFLO_NAMESPACE}meshBase`;
const SFLO_MESH_INVENTORY_IRI = `${SFLO_NAMESPACE}MeshInventory`;
const SFLO_MESH_METADATA_IRI = `${SFLO_NAMESPACE}MeshMetadata`;
const SFLO_NEXT_HISTORY_ORDINAL_IRI = `${SFLO_NAMESPACE}nextHistoryOrdinal`;
const SFLO_NEXT_STATE_ORDINAL_IRI = `${SFLO_NAMESPACE}nextStateOrdinal`;
const SFLO_RDF_DOCUMENT_IRI = `${SFLO_NAMESPACE}RdfDocument`;
const SFLO_RESOURCE_PAGE_IRI = `${SFLO_NAMESPACE}ResourcePage`;
const SFLO_SEMANTIC_MESH_IRI = `${SFLO_NAMESPACE}SemanticMesh`;
const SFLO_STATE_ORDINAL_IRI = `${SFLO_NAMESPACE}stateOrdinal`;

export interface KnopCreateRequest {
  designatorPath: string;
}

export interface ResolvedKnopCreateRequest extends KnopCreateRequest {
  meshBase: string;
  currentMeshInventoryTurtle: string;
}

export interface KnopCreatePlan {
  meshBase: string;
  designatorPath: string;
  knopIri: string;
  createdFiles: readonly PlannedFile[];
  updatedFiles: readonly PlannedFile[];
}

export class KnopCreateInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "KnopCreateInputError";
  }
}

export function planKnopCreate(
  request: ResolvedKnopCreateRequest,
): KnopCreatePlan {
  const meshBase = normalizeMeshBase(request.meshBase);
  const designatorPath = normalizeDesignatorPath(request.designatorPath);
  const knopPath = toKnopPath(designatorPath);
  const knopInventoryPath = `${knopPath}/_inventory/inventory.ttl`;
  const updatedMeshInventoryTurtle = renderUpdatedMeshInventoryTurtle(
    meshBase,
    request.currentMeshInventoryTurtle,
    knopPath,
  );

  return {
    meshBase,
    designatorPath,
    knopIri: new URL(knopPath, meshBase).href,
    createdFiles: [
      {
        path: `${knopPath}/_meta/meta.ttl`,
        contents: renderKnopMetadataTurtle(meshBase, designatorPath),
      },
      {
        path: knopInventoryPath,
        contents: renderKnopInventoryTurtle(meshBase, knopPath),
      },
    ],
    updatedFiles: [
      {
        path: "_mesh/_inventory/inventory.ttl",
        contents: updatedMeshInventoryTurtle,
      },
    ],
  };
}

function normalizeMeshBase(meshBase: string): string {
  const trimmed = meshBase.trim();
  if (trimmed.length === 0) {
    throw new KnopCreateInputError("meshBase is required");
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new KnopCreateInputError("meshBase must be an absolute IRI");
  }

  if (!url.pathname.endsWith("/")) {
    throw new KnopCreateInputError("meshBase must end with '/'");
  }
  if (url.search.length > 0 || url.hash.length > 0) {
    throw new KnopCreateInputError(
      "meshBase must not include a query or fragment",
    );
  }

  return url.href;
}

function normalizeDesignatorPath(designatorPath: string): string {
  return normalizeSafeDesignatorPath(
    designatorPath,
    "designatorPath",
    (message) => new KnopCreateInputError(message),
    { allowRoot: true },
  );
}

function renderKnopMetadataTurtle(
  meshBase: string,
  designatorPath: string,
): string {
  const knopPath = toKnopPath(designatorPath);
  return `@base <${meshBase}> .
@prefix sflo: <https://semantic-flow.github.io/semantic-flow-ontology/> .

<${knopPath}> a sflo:Knop ;
  sflo:designatorPath "${designatorPath}" ;
  sflo:hasWorkingKnopInventoryFile <${knopPath}/_inventory/inventory.ttl> .
`;
}

function renderKnopInventoryTurtle(
  meshBase: string,
  knopPath: string,
): string {
  return `@base <${meshBase}> .
@prefix sflo: <https://semantic-flow.github.io/semantic-flow-ontology/> .

<${knopPath}> a sflo:Knop ;
  sflo:hasKnopMetadata <${knopPath}/_meta> ;
  sflo:hasKnopInventory <${knopPath}/_inventory> ;
  sflo:hasWorkingKnopInventoryFile <${knopPath}/_inventory/inventory.ttl> .

<${knopPath}/_meta> a sflo:KnopMetadata, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasWorkingLocatedFile <${knopPath}/_meta/meta.ttl> .

<${knopPath}/_inventory> a sflo:KnopInventory, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasWorkingLocatedFile <${knopPath}/_inventory/inventory.ttl> .

<${knopPath}/_meta/meta.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<${knopPath}/_inventory/inventory.ttl> a sflo:LocatedFile, sflo:RdfDocument .
`;
}

function renderUpdatedMeshInventoryTurtle(
  meshBase: string,
  currentMeshInventoryTurtle: string,
  knopPath: string,
): string {
  assertCurrentMeshInventoryShapeForKnopCreate(
    meshBase,
    currentMeshInventoryTurtle,
    knopPath,
  );
  return renderFirstKnopCreatedMeshInventoryTurtle(meshBase, knopPath);
}

function assertCurrentMeshInventoryShapeForKnopCreate(
  meshBase: string,
  currentMeshInventoryTurtle: string,
  knopPath: string,
): void {
  const errorMessage =
    `current mesh inventory has an unsupported carried shape for knop create: ${knopPath}`;
  const quads = parseMeshInventoryQuads(
    meshBase,
    currentMeshInventoryTurtle,
    errorMessage,
  );

  if (
    !hasNamedNodeFact(
      quads,
      meshBase,
      "_mesh",
      RDF_TYPE_IRI,
      SFLO_SEMANTIC_MESH_IRI,
    )
  ) {
    throw new KnopCreateInputError(
      "current mesh inventory is missing the _mesh block",
    );
  }

  const existingKnopPaths = listTypedSubjectPaths(
    quads,
    meshBase,
    SFLO_KNOP_IRI,
  );
  if (existingKnopPaths.includes(knopPath)) {
    throw new KnopCreateInputError(
      `mesh inventory already registers knop: ${knopPath}`,
    );
  }
  if (
    existingKnopPaths.length > 0 ||
    hasPredicateForSubject(quads, meshBase, "_mesh", SFLO_HAS_KNOP_IRI)
  ) {
    throw new KnopCreateInputError(errorMessage);
  }

  assertHasNamedNodeFacts(quads, meshBase, errorMessage, [
    ["_mesh", RDF_TYPE_IRI, SFLO_SEMANTIC_MESH_IRI],
    ["_mesh", SFLO_HAS_MESH_METADATA_IRI, "_mesh/_meta"],
    ["_mesh", SFLO_HAS_MESH_INVENTORY_IRI, "_mesh/_inventory"],
    ["_mesh", SFLO_HAS_RESOURCE_PAGE_IRI, "_mesh/index.html"],
    ["_mesh/_meta", RDF_TYPE_IRI, SFLO_MESH_METADATA_IRI],
    ["_mesh/_meta", RDF_TYPE_IRI, SFLO_DIGITAL_ARTIFACT_IRI],
    ["_mesh/_meta", RDF_TYPE_IRI, SFLO_RDF_DOCUMENT_IRI],
    ["_mesh/_meta", SFLO_HAS_ARTIFACT_HISTORY_IRI, "_mesh/_meta/_history001"],
    [
      "_mesh/_meta",
      SFLO_CURRENT_ARTIFACT_HISTORY_IRI,
      "_mesh/_meta/_history001",
    ],
    ["_mesh/_meta", SFLO_HAS_WORKING_LOCATED_FILE_IRI, "_mesh/_meta/meta.ttl"],
    ["_mesh/_meta", SFLO_HAS_RESOURCE_PAGE_IRI, "_mesh/_meta/index.html"],
    ["_mesh/_meta/_history001", RDF_TYPE_IRI, SFLO_ARTIFACT_HISTORY_IRI],
    [
      "_mesh/_meta/_history001",
      SFLO_HAS_HISTORICAL_STATE_IRI,
      "_mesh/_meta/_history001/_s0001",
    ],
    [
      "_mesh/_meta/_history001",
      SFLO_LATEST_HISTORICAL_STATE_IRI,
      "_mesh/_meta/_history001/_s0001",
    ],
    [
      "_mesh/_meta/_history001",
      SFLO_HAS_RESOURCE_PAGE_IRI,
      "_mesh/_meta/_history001/index.html",
    ],
    ["_mesh/_meta/_history001/_s0001", RDF_TYPE_IRI, SFLO_HISTORICAL_STATE_IRI],
    [
      "_mesh/_meta/_history001/_s0001",
      SFLO_HAS_MANIFESTATION_IRI,
      "_mesh/_meta/_history001/_s0001/meta-ttl",
    ],
    [
      "_mesh/_meta/_history001/_s0001",
      SFLO_LOCATED_FILE_FOR_STATE_IRI,
      "_mesh/_meta/_history001/_s0001/meta-ttl/meta.ttl",
    ],
    [
      "_mesh/_meta/_history001/_s0001",
      SFLO_HAS_RESOURCE_PAGE_IRI,
      "_mesh/_meta/_history001/_s0001/index.html",
    ],
    [
      "_mesh/_meta/_history001/_s0001/meta-ttl",
      RDF_TYPE_IRI,
      SFLO_ARTIFACT_MANIFESTATION_IRI,
    ],
    [
      "_mesh/_meta/_history001/_s0001/meta-ttl",
      RDF_TYPE_IRI,
      SFLO_RDF_DOCUMENT_IRI,
    ],
    [
      "_mesh/_meta/_history001/_s0001/meta-ttl",
      SFLO_HAS_LOCATED_FILE_IRI,
      "_mesh/_meta/_history001/_s0001/meta-ttl/meta.ttl",
    ],
    [
      "_mesh/_meta/_history001/_s0001/meta-ttl",
      SFLO_HAS_RESOURCE_PAGE_IRI,
      "_mesh/_meta/_history001/_s0001/meta-ttl/index.html",
    ],
    ["_mesh/_inventory", RDF_TYPE_IRI, SFLO_MESH_INVENTORY_IRI],
    ["_mesh/_inventory", RDF_TYPE_IRI, SFLO_DIGITAL_ARTIFACT_IRI],
    ["_mesh/_inventory", RDF_TYPE_IRI, SFLO_RDF_DOCUMENT_IRI],
    [
      "_mesh/_inventory",
      SFLO_HAS_ARTIFACT_HISTORY_IRI,
      "_mesh/_inventory/_history001",
    ],
    [
      "_mesh/_inventory",
      SFLO_CURRENT_ARTIFACT_HISTORY_IRI,
      "_mesh/_inventory/_history001",
    ],
    [
      "_mesh/_inventory",
      SFLO_HAS_WORKING_LOCATED_FILE_IRI,
      "_mesh/_inventory/inventory.ttl",
    ],
    [
      "_mesh/_inventory",
      SFLO_HAS_RESOURCE_PAGE_IRI,
      "_mesh/_inventory/index.html",
    ],
    ["_mesh/_inventory/_history001", RDF_TYPE_IRI, SFLO_ARTIFACT_HISTORY_IRI],
    [
      "_mesh/_inventory/_history001",
      SFLO_HAS_HISTORICAL_STATE_IRI,
      "_mesh/_inventory/_history001/_s0001",
    ],
    [
      "_mesh/_inventory/_history001",
      SFLO_LATEST_HISTORICAL_STATE_IRI,
      "_mesh/_inventory/_history001/_s0001",
    ],
    [
      "_mesh/_inventory/_history001",
      SFLO_HAS_RESOURCE_PAGE_IRI,
      "_mesh/_inventory/_history001/index.html",
    ],
    [
      "_mesh/_inventory/_history001/_s0001",
      RDF_TYPE_IRI,
      SFLO_HISTORICAL_STATE_IRI,
    ],
    [
      "_mesh/_inventory/_history001/_s0001",
      SFLO_HAS_MANIFESTATION_IRI,
      "_mesh/_inventory/_history001/_s0001/inventory-ttl",
    ],
    [
      "_mesh/_inventory/_history001/_s0001",
      SFLO_LOCATED_FILE_FOR_STATE_IRI,
      "_mesh/_inventory/_history001/_s0001/inventory-ttl/inventory.ttl",
    ],
    [
      "_mesh/_inventory/_history001/_s0001",
      SFLO_HAS_RESOURCE_PAGE_IRI,
      "_mesh/_inventory/_history001/_s0001/index.html",
    ],
    [
      "_mesh/_inventory/_history001/_s0001/inventory-ttl",
      RDF_TYPE_IRI,
      SFLO_ARTIFACT_MANIFESTATION_IRI,
    ],
    [
      "_mesh/_inventory/_history001/_s0001/inventory-ttl",
      RDF_TYPE_IRI,
      SFLO_RDF_DOCUMENT_IRI,
    ],
    [
      "_mesh/_inventory/_history001/_s0001/inventory-ttl",
      SFLO_HAS_LOCATED_FILE_IRI,
      "_mesh/_inventory/_history001/_s0001/inventory-ttl/inventory.ttl",
    ],
    [
      "_mesh/_inventory/_history001/_s0001/inventory-ttl",
      SFLO_HAS_RESOURCE_PAGE_IRI,
      "_mesh/_inventory/_history001/_s0001/inventory-ttl/index.html",
    ],
    ["_mesh/_meta/meta.ttl", RDF_TYPE_IRI, SFLO_LOCATED_FILE_IRI],
    ["_mesh/_meta/meta.ttl", RDF_TYPE_IRI, SFLO_RDF_DOCUMENT_IRI],
    ["_mesh/_inventory/inventory.ttl", RDF_TYPE_IRI, SFLO_LOCATED_FILE_IRI],
    ["_mesh/_inventory/inventory.ttl", RDF_TYPE_IRI, SFLO_RDF_DOCUMENT_IRI],
    [
      "_mesh/_meta/_history001/_s0001/meta-ttl/meta.ttl",
      RDF_TYPE_IRI,
      SFLO_LOCATED_FILE_IRI,
    ],
    [
      "_mesh/_meta/_history001/_s0001/meta-ttl/meta.ttl",
      RDF_TYPE_IRI,
      SFLO_RDF_DOCUMENT_IRI,
    ],
    [
      "_mesh/_inventory/_history001/_s0001/inventory-ttl/inventory.ttl",
      RDF_TYPE_IRI,
      SFLO_LOCATED_FILE_IRI,
    ],
    [
      "_mesh/_inventory/_history001/_s0001/inventory-ttl/inventory.ttl",
      RDF_TYPE_IRI,
      SFLO_RDF_DOCUMENT_IRI,
    ],
    ["_mesh/index.html", RDF_TYPE_IRI, SFLO_RESOURCE_PAGE_IRI],
    ["_mesh/index.html", RDF_TYPE_IRI, SFLO_LOCATED_FILE_IRI],
    ["_mesh/_meta/index.html", RDF_TYPE_IRI, SFLO_RESOURCE_PAGE_IRI],
    ["_mesh/_meta/index.html", RDF_TYPE_IRI, SFLO_LOCATED_FILE_IRI],
    [
      "_mesh/_meta/_history001/index.html",
      RDF_TYPE_IRI,
      SFLO_RESOURCE_PAGE_IRI,
    ],
    ["_mesh/_meta/_history001/index.html", RDF_TYPE_IRI, SFLO_LOCATED_FILE_IRI],
    [
      "_mesh/_meta/_history001/_s0001/index.html",
      RDF_TYPE_IRI,
      SFLO_RESOURCE_PAGE_IRI,
    ],
    [
      "_mesh/_meta/_history001/_s0001/index.html",
      RDF_TYPE_IRI,
      SFLO_LOCATED_FILE_IRI,
    ],
    [
      "_mesh/_meta/_history001/_s0001/meta-ttl/index.html",
      RDF_TYPE_IRI,
      SFLO_RESOURCE_PAGE_IRI,
    ],
    [
      "_mesh/_meta/_history001/_s0001/meta-ttl/index.html",
      RDF_TYPE_IRI,
      SFLO_LOCATED_FILE_IRI,
    ],
    ["_mesh/_inventory/index.html", RDF_TYPE_IRI, SFLO_RESOURCE_PAGE_IRI],
    ["_mesh/_inventory/index.html", RDF_TYPE_IRI, SFLO_LOCATED_FILE_IRI],
    [
      "_mesh/_inventory/_history001/index.html",
      RDF_TYPE_IRI,
      SFLO_RESOURCE_PAGE_IRI,
    ],
    [
      "_mesh/_inventory/_history001/index.html",
      RDF_TYPE_IRI,
      SFLO_LOCATED_FILE_IRI,
    ],
    [
      "_mesh/_inventory/_history001/_s0001/index.html",
      RDF_TYPE_IRI,
      SFLO_RESOURCE_PAGE_IRI,
    ],
    [
      "_mesh/_inventory/_history001/_s0001/index.html",
      RDF_TYPE_IRI,
      SFLO_LOCATED_FILE_IRI,
    ],
    [
      "_mesh/_inventory/_history001/_s0001/inventory-ttl/index.html",
      RDF_TYPE_IRI,
      SFLO_RESOURCE_PAGE_IRI,
    ],
    [
      "_mesh/_inventory/_history001/_s0001/inventory-ttl/index.html",
      RDF_TYPE_IRI,
      SFLO_LOCATED_FILE_IRI,
    ],
  ]);
  assertHasLiteralFacts(quads, meshBase, errorMessage, [
    ["_mesh", SFLO_MESH_BASE_IRI, meshBase, XSD_ANY_URI_IRI],
    [
      "_mesh/_meta",
      SFLO_NEXT_HISTORY_ORDINAL_IRI,
      "2",
      XSD_NON_NEGATIVE_INTEGER_IRI,
    ],
    [
      "_mesh/_meta/_history001",
      SFLO_HISTORY_ORDINAL_IRI,
      "1",
      XSD_NON_NEGATIVE_INTEGER_IRI,
    ],
    [
      "_mesh/_meta/_history001",
      SFLO_NEXT_STATE_ORDINAL_IRI,
      "2",
      XSD_NON_NEGATIVE_INTEGER_IRI,
    ],
    [
      "_mesh/_meta/_history001/_s0001",
      SFLO_STATE_ORDINAL_IRI,
      "1",
      XSD_NON_NEGATIVE_INTEGER_IRI,
    ],
    [
      "_mesh/_inventory",
      SFLO_NEXT_HISTORY_ORDINAL_IRI,
      "2",
      XSD_NON_NEGATIVE_INTEGER_IRI,
    ],
    [
      "_mesh/_inventory/_history001",
      SFLO_HISTORY_ORDINAL_IRI,
      "1",
      XSD_NON_NEGATIVE_INTEGER_IRI,
    ],
    [
      "_mesh/_inventory/_history001",
      SFLO_NEXT_STATE_ORDINAL_IRI,
      "2",
      XSD_NON_NEGATIVE_INTEGER_IRI,
    ],
    [
      "_mesh/_inventory/_history001/_s0001",
      SFLO_STATE_ORDINAL_IRI,
      "1",
      XSD_NON_NEGATIVE_INTEGER_IRI,
    ],
  ]);
}

function renderFirstKnopCreatedMeshInventoryTurtle(
  meshBase: string,
  knopPath: string,
): string {
  const knopInventoryPath = `${knopPath}/_inventory/inventory.ttl`;

  return `@base <${meshBase}> .
@prefix sflo: <https://semantic-flow.github.io/semantic-flow-ontology/> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

<_mesh> a sflo:SemanticMesh ;
  sflo:meshBase "${meshBase}"^^xsd:anyURI ;
  sflo:hasMeshMetadata <_mesh/_meta> ;
  sflo:hasMeshInventory <_mesh/_inventory> ;
  sflo:hasKnop <${knopPath}> ;
  sflo:hasResourcePage <_mesh/index.html> .

<${knopPath}> a sflo:Knop ;
  sflo:hasWorkingKnopInventoryFile <${knopInventoryPath}> .

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
  sflo:latestHistoricalState <_mesh/_inventory/_history001/_s0001> ;
  sflo:nextStateOrdinal "2"^^xsd:nonNegativeInteger ;
  sflo:hasResourcePage <_mesh/_inventory/_history001/index.html> .

<_mesh/_inventory/_history001/_s0001> a sflo:HistoricalState ;
  sflo:stateOrdinal "1"^^xsd:nonNegativeInteger ;
  sflo:hasManifestation <_mesh/_inventory/_history001/_s0001/inventory-ttl> ;
  sflo:locatedFileForState <_mesh/_inventory/_history001/_s0001/inventory-ttl/inventory.ttl> ;
  sflo:hasResourcePage <_mesh/_inventory/_history001/_s0001/index.html> .

<_mesh/_inventory/_history001/_s0001/inventory-ttl> a sflo:ArtifactManifestation, sflo:RdfDocument ;
  sflo:hasLocatedFile <_mesh/_inventory/_history001/_s0001/inventory-ttl/inventory.ttl> ;
  sflo:hasResourcePage <_mesh/_inventory/_history001/_s0001/inventory-ttl/index.html> .

<_mesh/_meta/meta.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<_mesh/_inventory/inventory.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<_mesh/_meta/_history001/_s0001/meta-ttl/meta.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<_mesh/_inventory/_history001/_s0001/inventory-ttl/inventory.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<${knopInventoryPath}> a sflo:LocatedFile, sflo:RdfDocument .

<_mesh/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<_mesh/_meta/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<_mesh/_meta/_history001/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<_mesh/_meta/_history001/_s0001/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<_mesh/_meta/_history001/_s0001/meta-ttl/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<_mesh/_inventory/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<_mesh/_inventory/_history001/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<_mesh/_inventory/_history001/_s0001/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<_mesh/_inventory/_history001/_s0001/inventory-ttl/index.html> a sflo:ResourcePage, sflo:LocatedFile .
`;
}

function assertHasNamedNodeFacts(
  quads: readonly Quad[],
  meshBase: string,
  errorMessage: string,
  facts: readonly (readonly [string, string, string])[],
): void {
  for (const [subjectValue, predicateIri, objectValue] of facts) {
    if (
      !hasNamedNodeFact(
        quads,
        meshBase,
        subjectValue,
        predicateIri,
        objectValue,
      )
    ) {
      throw new KnopCreateInputError(errorMessage);
    }
  }
}

function assertHasLiteralFacts(
  quads: readonly Quad[],
  meshBase: string,
  errorMessage: string,
  facts: readonly (readonly [string, string, string, string])[],
): void {
  for (const [subjectValue, predicateIri, literalValue, datatypeIri] of facts) {
    if (
      !hasLiteralFact(
        quads,
        meshBase,
        subjectValue,
        predicateIri,
        literalValue,
        datatypeIri,
      )
    ) {
      throw new KnopCreateInputError(errorMessage);
    }
  }
}

function hasNamedNodeFact(
  quads: readonly Quad[],
  meshBase: string,
  subjectValue: string,
  predicateIri: string,
  objectValue: string,
): boolean {
  const subjectIri = new URL(subjectValue, meshBase).href;
  const objectIri = new URL(objectValue, meshBase).href;

  return quads.some((quad) =>
    quad.subject.termType === "NamedNode" &&
    quad.subject.value === subjectIri &&
    quad.predicate.value === predicateIri &&
    quad.object.termType === "NamedNode" &&
    quad.object.value === objectIri
  );
}

function hasLiteralFact(
  quads: readonly Quad[],
  meshBase: string,
  subjectValue: string,
  predicateIri: string,
  literalValue: string,
  datatypeIri: string,
): boolean {
  const subjectIri = new URL(subjectValue, meshBase).href;

  return quads.some((quad) =>
    quad.subject.termType === "NamedNode" &&
    quad.subject.value === subjectIri &&
    quad.predicate.value === predicateIri &&
    quad.object.termType === "Literal" &&
    quad.object.value === literalValue &&
    quad.object.datatype.value === datatypeIri
  );
}

function hasPredicateForSubject(
  quads: readonly Quad[],
  meshBase: string,
  subjectValue: string,
  predicateIri: string,
): boolean {
  const subjectIri = new URL(subjectValue, meshBase).href;

  return quads.some((quad) =>
    quad.subject.termType === "NamedNode" &&
    quad.subject.value === subjectIri &&
    quad.predicate.value === predicateIri
  );
}

function listTypedSubjectPaths(
  quads: readonly Quad[],
  meshBase: string,
  typeIri: string,
): string[] {
  const paths = new Set<string>();

  for (const quad of quads) {
    if (
      quad.subject.termType !== "NamedNode" ||
      quad.predicate.value !== RDF_TYPE_IRI ||
      quad.object.termType !== "NamedNode" ||
      quad.object.value !== typeIri
    ) {
      continue;
    }

    const path = toRelativeMeshPath(meshBase, quad.subject.value);
    if (path !== undefined) {
      paths.add(path);
    }
  }

  return [...paths];
}

function toRelativeMeshPath(
  meshBase: string,
  absoluteIri: string,
): string | undefined {
  return absoluteIri.startsWith(meshBase)
    ? absoluteIri.slice(meshBase.length)
    : undefined;
}

function parseMeshInventoryQuads(
  meshBase: string,
  turtle: string,
  errorMessage: string,
): Quad[] {
  try {
    return new Parser({ baseIRI: meshBase }).parse(turtle);
  } catch {
    throw new KnopCreateInputError(errorMessage);
  }
}
