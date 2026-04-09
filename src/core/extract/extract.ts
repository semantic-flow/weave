import { Parser } from "n3";
import type { Quad } from "n3";
import {
  normalizeSafeDesignatorPath,
  toDesignatorResourcePagePath,
  toKnopPath,
  toReferenceCatalogPath,
} from "../designator_segments.ts";
import { KnopCreateInputError } from "../knop/create.ts";
import type { PlannedFile } from "../planned_file.ts";

const RDF_TYPE_IRI = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type";
const XSD_ANY_URI_IRI = "http://www.w3.org/2001/XMLSchema#anyURI";
const XSD_NON_NEGATIVE_INTEGER_IRI =
  "http://www.w3.org/2001/XMLSchema#nonNegativeInteger";
const SFLO_NAMESPACE =
  "https://semantic-flow.github.io/semantic-flow-ontology/";
const SFLO_DIGITAL_ARTIFACT_IRI = `${SFLO_NAMESPACE}DigitalArtifact`;
const SFLO_HAS_KNOP_IRI = `${SFLO_NAMESPACE}hasKnop`;
const SFLO_HAS_MESH_INVENTORY_IRI = `${SFLO_NAMESPACE}hasMeshInventory`;
const SFLO_HAS_MESH_METADATA_IRI = `${SFLO_NAMESPACE}hasMeshMetadata`;
const SFLO_HAS_RESOURCE_PAGE_IRI = `${SFLO_NAMESPACE}hasResourcePage`;
const SFLO_HAS_WORKING_KNOP_INVENTORY_FILE_IRI =
  `${SFLO_NAMESPACE}hasWorkingKnopInventoryFile`;
const SFLO_HAS_WORKING_LOCATED_FILE_IRI =
  `${SFLO_NAMESPACE}hasWorkingLocatedFile`;
const SFLO_KNOP_IRI = `${SFLO_NAMESPACE}Knop`;
const SFLO_LATEST_HISTORICAL_STATE_IRI =
  `${SFLO_NAMESPACE}latestHistoricalState`;
const SFLO_LOCATED_FILE_IRI = `${SFLO_NAMESPACE}LocatedFile`;
const SFLO_MESH_BASE_IRI = `${SFLO_NAMESPACE}meshBase`;
const SFLO_MESH_INVENTORY_IRI = `${SFLO_NAMESPACE}MeshInventory`;
const SFLO_NEXT_STATE_ORDINAL_IRI = `${SFLO_NAMESPACE}nextStateOrdinal`;
const SFLO_PAYLOAD_ARTIFACT_IRI = `${SFLO_NAMESPACE}PayloadArtifact`;
const SFLO_RDF_DOCUMENT_IRI = `${SFLO_NAMESPACE}RdfDocument`;
const SFLO_SEMANTIC_MESH_IRI = `${SFLO_NAMESPACE}SemanticMesh`;
const SUPPLEMENTAL_REFERENCE_ROLE_IRI =
  `${SFLO_NAMESPACE}ReferenceRole/Supplemental`;

export interface ExtractRequest {
  designatorPath: string;
}

export interface ResolvedExtractRequest extends ExtractRequest {
  meshBase: string;
  currentMeshInventoryTurtle: string;
  referenceTargetDesignatorPath: string;
  referenceTargetStatePath: string;
  referenceTargetWorkingFilePath: string;
}

export interface ExtractPlan {
  meshBase: string;
  designatorPath: string;
  referenceCatalogIri: string;
  referenceLinkIri: string;
  referenceRoleIri: string;
  referenceTargetIri: string;
  referenceTargetDesignatorPath: string;
  referenceTargetStateIri: string;
  referenceTargetStatePath: string;
  createdFiles: readonly PlannedFile[];
  updatedFiles: readonly PlannedFile[];
}

export class ExtractInputError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "ExtractInputError";
  }
}

export function planExtract(request: ResolvedExtractRequest): ExtractPlan {
  const meshBase = normalizeMeshBase(request.meshBase);
  const designatorPath = normalizeDesignatorPath(
    request.designatorPath,
    "designatorPath",
  );
  const referenceTargetDesignatorPath = normalizeDesignatorPath(
    request.referenceTargetDesignatorPath,
    "referenceTargetDesignatorPath",
  );
  const referenceTargetStatePath = normalizeRelativeIriPath(
    request.referenceTargetStatePath,
    "referenceTargetStatePath",
  );
  const referenceTargetWorkingFilePath = normalizeWorkingFilePath(
    request.referenceTargetWorkingFilePath,
  );

  try {
    const knopPath = toKnopPath(designatorPath);
    const referenceCatalogPath = toReferenceCatalogPath(designatorPath);
    const updatedMeshInventoryTurtle = renderExtractMeshInventoryTurtle(
      meshBase,
      request.currentMeshInventoryTurtle,
      designatorPath,
      referenceTargetDesignatorPath,
      referenceTargetWorkingFilePath,
    );

    return {
      meshBase,
      designatorPath,
      referenceCatalogIri: new URL(referenceCatalogPath, meshBase).href,
      referenceLinkIri:
        new URL(`${referenceCatalogPath}#reference001`, meshBase)
          .href,
      referenceRoleIri: SUPPLEMENTAL_REFERENCE_ROLE_IRI,
      referenceTargetIri: new URL(referenceTargetDesignatorPath, meshBase).href,
      referenceTargetDesignatorPath,
      referenceTargetStateIri: new URL(referenceTargetStatePath, meshBase).href,
      referenceTargetStatePath,
      createdFiles: [
        {
          path: `${knopPath}/_meta/meta.ttl`,
          contents: renderExtractKnopMetadataTurtle(
            meshBase,
            designatorPath,
          ),
        },
        {
          path: `${knopPath}/_inventory/inventory.ttl`,
          contents: renderExtractKnopInventoryTurtle(
            meshBase,
            designatorPath,
          ),
        },
        {
          path: `${referenceCatalogPath}/references.ttl`,
          contents: renderExtractReferenceCatalogTurtle(
            meshBase,
            designatorPath,
            referenceTargetDesignatorPath,
            SUPPLEMENTAL_REFERENCE_ROLE_IRI,
            referenceTargetStatePath,
          ),
        },
      ],
      updatedFiles: [{
        path: "_mesh/_inventory/inventory.ttl",
        contents: updatedMeshInventoryTurtle,
      }],
    };
  } catch (error) {
    if (error instanceof KnopCreateInputError) {
      throw new ExtractInputError(error.message, { cause: error });
    }
    throw error;
  }
}

function normalizeMeshBase(meshBase: string): string {
  const trimmed = meshBase.trim();
  if (trimmed.length === 0) {
    throw new ExtractInputError("meshBase is required");
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new ExtractInputError("meshBase must be an absolute IRI");
  }

  if (!url.pathname.endsWith("/")) {
    throw new ExtractInputError("meshBase must end with '/'");
  }
  if (url.search.length > 0 || url.hash.length > 0) {
    throw new ExtractInputError(
      "meshBase must not include a query or fragment",
    );
  }

  return url.href;
}

function normalizeDesignatorPath(
  designatorPath: string,
  fieldName: string,
): string {
  return normalizeSafeDesignatorPath(
    designatorPath,
    fieldName,
    (message) => new ExtractInputError(message),
    { allowRoot: true },
  );
}

function normalizeWorkingFilePath(workingFilePath: string): string {
  return normalizeValidatedPath(workingFilePath, {
    fieldName: "referenceTargetWorkingFilePath",
    rejectWhitespace: true,
    slashMessage:
      "referenceTargetWorkingFilePath must be a mesh-relative file path",
    unsupportedCharactersMessage:
      "referenceTargetWorkingFilePath contains unsupported path characters",
    emptySegmentsMessage:
      "referenceTargetWorkingFilePath must not contain empty path segments",
    dotSegmentsMessage:
      "referenceTargetWorkingFilePath must be a mesh-relative file path",
  });
}

function normalizeRelativeIriPath(value: string, fieldName: string): string {
  return normalizeValidatedPath(value, {
    fieldName,
    rejectWhitespace: false,
    slashMessage: `${fieldName} must not start or end with '/'`,
    unsupportedCharactersMessage:
      `${fieldName} contains unsupported path characters`,
    emptySegmentsMessage: `${fieldName} must not contain empty path segments`,
    dotSegmentsMessage:
      `${fieldName} must not contain '.' or '..' path segments`,
  });
}

function normalizeValidatedPath(
  value: string,
  options: {
    fieldName: string;
    rejectWhitespace: boolean;
    slashMessage: string;
    unsupportedCharactersMessage: string;
    emptySegmentsMessage: string;
    dotSegmentsMessage: string;
  },
): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new ExtractInputError(`${options.fieldName} is required`);
  }
  if (trimmed.startsWith("/") || trimmed.endsWith("/")) {
    throw new ExtractInputError(options.slashMessage);
  }
  if (
    trimmed.includes("\\") || trimmed.includes("?") || trimmed.includes("#") ||
    (options.rejectWhitespace && /\s/.test(trimmed))
  ) {
    throw new ExtractInputError(options.unsupportedCharactersMessage);
  }

  const segments = trimmed.split("/");
  if (segments.some((segment) => segment.length === 0)) {
    throw new ExtractInputError(options.emptySegmentsMessage);
  }
  if (segments.some((segment) => segment === "." || segment === "..")) {
    throw new ExtractInputError(options.dotSegmentsMessage);
  }

  return trimmed;
}

function renderExtractMeshInventoryTurtle(
  meshBase: string,
  currentMeshInventoryTurtle: string,
  designatorPath: string,
  sourcePayloadDesignatorPath: string,
  sourceWorkingFilePath: string,
): string {
  assertCurrentMeshInventoryShapeForExtract(
    meshBase,
    currentMeshInventoryTurtle,
    designatorPath,
    sourcePayloadDesignatorPath,
    sourceWorkingFilePath,
  );

  const rootDesignatorPath = toRootDesignatorPath(sourcePayloadDesignatorPath);
  const rootKnopPath = toKnopPath(rootDesignatorPath);
  const sourceKnopPath = toKnopPath(sourcePayloadDesignatorPath);
  const knopPath = toKnopPath(designatorPath);
  const rootPagePath = toDesignatorResourcePagePath(rootDesignatorPath);
  const sourcePayloadPagePath = toDesignatorResourcePagePath(
    sourcePayloadDesignatorPath,
  );

  return `@base <${meshBase}> .
@prefix sflo: <https://semantic-flow.github.io/semantic-flow-ontology/> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

<_mesh> a sflo:SemanticMesh ;
  sflo:meshBase "${meshBase}"^^xsd:anyURI ;
  sflo:hasMeshMetadata <_mesh/_meta> ;
  sflo:hasMeshInventory <_mesh/_inventory> ;
  sflo:hasKnop <${rootKnopPath}> ;
  sflo:hasKnop <${sourceKnopPath}> ;
  sflo:hasKnop <${knopPath}> ;
  sflo:hasResourcePage <_mesh/index.html> .

<${rootDesignatorPath}>
  sflo:hasResourcePage <${rootPagePath}> .

<${rootKnopPath}> a sflo:Knop ;
  sflo:hasWorkingKnopInventoryFile <${rootKnopPath}/_inventory/inventory.ttl> ;
  sflo:hasResourcePage <${rootKnopPath}/index.html> .

<${sourcePayloadDesignatorPath}> a sflo:PayloadArtifact, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasWorkingLocatedFile <${sourceWorkingFilePath}> ;
  sflo:hasResourcePage <${sourcePayloadPagePath}> .

<${sourceKnopPath}> a sflo:Knop ;
  sflo:hasWorkingKnopInventoryFile <${sourceKnopPath}/_inventory/inventory.ttl> ;
  sflo:hasResourcePage <${sourceKnopPath}/index.html> .

<${knopPath}> a sflo:Knop ;
  sflo:hasWorkingKnopInventoryFile <${knopPath}/_inventory/inventory.ttl> .

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

<${rootKnopPath}/_inventory/inventory.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<${sourceKnopPath}/_inventory/inventory.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<${knopPath}/_inventory/inventory.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<${sourceWorkingFilePath}> a sflo:LocatedFile, sflo:RdfDocument .

<_mesh/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${rootPagePath}> a sflo:ResourcePage, sflo:LocatedFile .

<${sourcePayloadPagePath}> a sflo:ResourcePage, sflo:LocatedFile .

<${rootKnopPath}/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${sourceKnopPath}/index.html> a sflo:ResourcePage, sflo:LocatedFile .

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

function renderExtractKnopInventoryTurtle(
  meshBase: string,
  designatorPath: string,
): string {
  const knopPath = toKnopPath(designatorPath);

  return `@base <${meshBase}> .
@prefix sflo: <https://semantic-flow.github.io/semantic-flow-ontology/> .

<${knopPath}> a sflo:Knop ;
  sflo:hasKnopMetadata <${knopPath}/_meta> ;
  sflo:hasKnopInventory <${knopPath}/_inventory> ;
  sflo:hasReferenceCatalog <${knopPath}/_references> ;
  sflo:hasWorkingKnopInventoryFile <${knopPath}/_inventory/inventory.ttl> .

<${knopPath}/_meta> a sflo:KnopMetadata, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasWorkingLocatedFile <${knopPath}/_meta/meta.ttl> .

<${knopPath}/_inventory> a sflo:KnopInventory, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasWorkingLocatedFile <${knopPath}/_inventory/inventory.ttl> .

<${knopPath}/_references> a sflo:ReferenceCatalog, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasWorkingLocatedFile <${knopPath}/_references/references.ttl> .

<${knopPath}/_meta/meta.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<${knopPath}/_inventory/inventory.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<${knopPath}/_references/references.ttl> a sflo:LocatedFile, sflo:RdfDocument .
`;
}

function renderExtractKnopMetadataTurtle(
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

function renderExtractReferenceCatalogTurtle(
  meshBase: string,
  designatorPath: string,
  referenceTargetDesignatorPath: string,
  referenceRoleIri: string,
  referenceTargetStatePath: string,
): string {
  const referenceCatalogPath = toReferenceCatalogPath(designatorPath);

  return `@base <${meshBase}> .
@prefix sflo: <https://semantic-flow.github.io/semantic-flow-ontology/> .

<${designatorPath}> sflo:hasReferenceLink <${referenceCatalogPath}#reference001> .

<${referenceCatalogPath}#reference001> a sflo:ReferenceLink ;
  sflo:referenceLinkFor <${designatorPath}> ;
  sflo:hasReferenceRole <${referenceRoleIri}> ;
  sflo:referenceTarget <${referenceTargetDesignatorPath}> ;
  sflo:referenceTargetState <${referenceTargetStatePath}> .
`;
}

function assertCurrentMeshInventoryShapeForExtract(
  meshBase: string,
  currentMeshInventoryTurtle: string,
  designatorPath: string,
  sourcePayloadDesignatorPath: string,
  sourceWorkingFilePath: string,
): void {
  const rootDesignatorPath = toRootDesignatorPath(sourcePayloadDesignatorPath);
  const rootKnopPath = toKnopPath(rootDesignatorPath);
  const sourceKnopPath = toKnopPath(sourcePayloadDesignatorPath);
  const knopPath = toKnopPath(designatorPath);
  const designatorPagePath = toDesignatorResourcePagePath(designatorPath);
  const rootPagePath = toDesignatorResourcePagePath(rootDesignatorPath);
  const sourcePayloadPagePath = toDesignatorResourcePagePath(
    sourcePayloadDesignatorPath,
  );
  const errorMessage =
    `current mesh inventory has an unsupported carried extract shape for ${designatorPath}`;
  const quads = parseMeshInventoryQuads(
    meshBase,
    currentMeshInventoryTurtle,
    errorMessage,
  );

  if (
    hasNamedNodeFact(
      quads,
      meshBase,
      knopPath,
      RDF_TYPE_IRI,
      SFLO_KNOP_IRI,
    ) ||
    hasNamedNodeFact(
      quads,
      meshBase,
      "_mesh",
      SFLO_HAS_KNOP_IRI,
      knopPath,
    )
  ) {
    throw new KnopCreateInputError(
      `mesh inventory already registers knop: ${knopPath}`,
    );
  }

  if (
    hasNamedNodeFact(
      quads,
      meshBase,
      designatorPath,
      SFLO_HAS_RESOURCE_PAGE_IRI,
      designatorPagePath,
    )
  ) {
    throw new ExtractInputError(
      `Mesh inventory already exposes current woven pages for ${designatorPath}.`,
    );
  }

  const meshKnopPaths = listNamedNodeObjectPaths(
    quads,
    meshBase,
    "_mesh",
    SFLO_HAS_KNOP_IRI,
  );
  const expectedMeshKnopPaths = [...new Set([rootKnopPath, sourceKnopPath])];
  if (
    meshKnopPaths.length !== expectedMeshKnopPaths.length ||
    expectedMeshKnopPaths.some((path) => !meshKnopPaths.includes(path))
  ) {
    throw new ExtractInputError(errorMessage);
  }

  const payloadArtifactPaths = listTypedSubjectPaths(
    quads,
    meshBase,
    SFLO_PAYLOAD_ARTIFACT_IRI,
  );
  if (
    payloadArtifactPaths.length !== 1 ||
    payloadArtifactPaths[0] !== sourcePayloadDesignatorPath
  ) {
    throw new ExtractInputError(errorMessage);
  }

  assertHasNamedNodeFacts(quads, meshBase, errorMessage, [
    ["_mesh", RDF_TYPE_IRI, SFLO_SEMANTIC_MESH_IRI],
    ["_mesh", SFLO_HAS_MESH_METADATA_IRI, "_mesh/_meta"],
    ["_mesh", SFLO_HAS_MESH_INVENTORY_IRI, "_mesh/_inventory"],
    ["_mesh", SFLO_HAS_KNOP_IRI, rootKnopPath],
    ["_mesh", SFLO_HAS_KNOP_IRI, sourceKnopPath],
    ["_mesh", SFLO_HAS_RESOURCE_PAGE_IRI, "_mesh/index.html"],
    [
      rootDesignatorPath,
      SFLO_HAS_RESOURCE_PAGE_IRI,
      rootPagePath,
    ],
    [rootKnopPath, RDF_TYPE_IRI, SFLO_KNOP_IRI],
    [rootKnopPath, SFLO_HAS_RESOURCE_PAGE_IRI, `${rootKnopPath}/index.html`],
    [
      rootKnopPath,
      SFLO_HAS_WORKING_KNOP_INVENTORY_FILE_IRI,
      `${rootKnopPath}/_inventory/inventory.ttl`,
    ],
    [sourcePayloadDesignatorPath, RDF_TYPE_IRI, SFLO_PAYLOAD_ARTIFACT_IRI],
    [sourcePayloadDesignatorPath, RDF_TYPE_IRI, SFLO_DIGITAL_ARTIFACT_IRI],
    [sourcePayloadDesignatorPath, RDF_TYPE_IRI, SFLO_RDF_DOCUMENT_IRI],
    [
      sourcePayloadDesignatorPath,
      SFLO_HAS_WORKING_LOCATED_FILE_IRI,
      sourceWorkingFilePath,
    ],
    [
      sourcePayloadDesignatorPath,
      SFLO_HAS_RESOURCE_PAGE_IRI,
      sourcePayloadPagePath,
    ],
    [sourceKnopPath, RDF_TYPE_IRI, SFLO_KNOP_IRI],
    [
      sourceKnopPath,
      SFLO_HAS_RESOURCE_PAGE_IRI,
      `${sourceKnopPath}/index.html`,
    ],
    [
      sourceKnopPath,
      SFLO_HAS_WORKING_KNOP_INVENTORY_FILE_IRI,
      `${sourceKnopPath}/_inventory/inventory.ttl`,
    ],
    ["_mesh/_inventory", RDF_TYPE_IRI, SFLO_MESH_INVENTORY_IRI],
    ["_mesh/_inventory", RDF_TYPE_IRI, SFLO_DIGITAL_ARTIFACT_IRI],
    ["_mesh/_inventory", RDF_TYPE_IRI, SFLO_RDF_DOCUMENT_IRI],
    [
      "_mesh/_inventory/_history001",
      SFLO_LATEST_HISTORICAL_STATE_IRI,
      "_mesh/_inventory/_history001/_s0003",
    ],
    [sourceWorkingFilePath, RDF_TYPE_IRI, SFLO_LOCATED_FILE_IRI],
    [sourceWorkingFilePath, RDF_TYPE_IRI, SFLO_RDF_DOCUMENT_IRI],
  ]);
  assertHasLiteralFacts(quads, meshBase, errorMessage, [
    ["_mesh", SFLO_MESH_BASE_IRI, meshBase, XSD_ANY_URI_IRI],
    [
      "_mesh/_inventory/_history001",
      SFLO_NEXT_STATE_ORDINAL_IRI,
      "4",
      XSD_NON_NEGATIVE_INTEGER_IRI,
    ],
  ]);
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
      throw new ExtractInputError(errorMessage);
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
      throw new ExtractInputError(errorMessage);
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

function listNamedNodeObjectPaths(
  quads: readonly Quad[],
  meshBase: string,
  subjectValue: string,
  predicateIri: string,
): string[] {
  const subjectIri = new URL(subjectValue, meshBase).href;
  const paths = new Set<string>();

  for (const quad of quads) {
    if (
      quad.subject.termType !== "NamedNode" ||
      quad.subject.value !== subjectIri ||
      quad.predicate.value !== predicateIri ||
      quad.object.termType !== "NamedNode"
    ) {
      continue;
    }

    const path = toRelativeMeshPath(meshBase, quad.object.value);
    if (path !== undefined) {
      paths.add(path);
    }
  }

  return [...paths];
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
    throw new ExtractInputError(errorMessage);
  }
}

function toRootDesignatorPath(designatorPath: string): string {
  const firstSlash = designatorPath.indexOf("/");
  return firstSlash === -1
    ? designatorPath
    : designatorPath.slice(0, firstSlash);
}
