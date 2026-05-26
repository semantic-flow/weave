import { Parser } from "n3";
import type { Quad } from "n3";
import {
  normalizeSafeDesignatorPath,
  toDesignatorResourcePagePath,
  toKnopPath,
} from "../designator_segments.ts";
import { KnopCreateInputError } from "../knop/create.ts";
import type { PlannedFile } from "../planned_file.ts";
import {
  SFLO_NAMESPACE,
  SFLO_TURTLE_PREFIX_DECLARATION,
} from "../rdf/namespaces.ts";
import { escapeTurtleString } from "../rdf/turtle.ts";

const RDF_TYPE_IRI = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type";
const XSD_ANY_URI_IRI = "http://www.w3.org/2001/XMLSchema#anyURI";
const XSD_NON_NEGATIVE_INTEGER_IRI =
  "http://www.w3.org/2001/XMLSchema#nonNegativeInteger";
const SFLO_ARTIFACT_RESOLUTION_MODE_WORKING_IRI =
  `${SFLO_NAMESPACE}artifactResolutionMode_working`;
const SFLO_DIGITAL_ARTIFACT_IRI = `${SFLO_NAMESPACE}DigitalArtifact`;
const SFLO_HAS_KNOP_IRI = `${SFLO_NAMESPACE}hasKnop`;
const SFLO_HAS_MESH_INVENTORY_IRI = `${SFLO_NAMESPACE}hasMeshInventory`;
const SFLO_HAS_MESH_METADATA_IRI = `${SFLO_NAMESPACE}hasMeshMetadata`;
const SFLO_HAS_RESOURCE_PAGE_IRI = `${SFLO_NAMESPACE}hasResourcePage`;
const SFLO_HAS_WORKING_KNOP_INVENTORY_FILE_IRI =
  `${SFLO_NAMESPACE}hasWorkingKnopInventoryFile`;
const SFLO_HAS_WORKING_LOCATED_FILE_IRI =
  `${SFLO_NAMESPACE}hasWorkingLocatedFile`;
const SFLO_HAS_REPOSITORY_SOURCE_FLOATING_LOCATOR_IRI =
  `${SFLO_NAMESPACE}hasRepositorySourceFloatingLocator`;
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
const SFLO_WORKING_LOCAL_RELATIVE_PATH_IRI =
  `${SFLO_NAMESPACE}workingLocalRelativePath`;
const SFLO_SOURCE_REPOSITORY_PATH_FROM_ROOT_IRI =
  `${SFLO_NAMESPACE}sourceRepositoryPathFromRoot`;

export interface ExtractRequest {
  designatorPath: string;
}

export interface ResolvedExtractRequest extends ExtractRequest {
  meshBase: string;
  currentMeshInventoryTurtle: string;
  sourceDesignatorPath: string;
  sourceStatePath?: string;
  sourceResolutionMode?: "working" | "exact";
  sourceEvidence?: ExtractionSourceEvidence;
  sourceWorkingLocalRelativePath: string;
}

export interface ExtractionSourceEvidence {
  sourceStatePath?: string;
  sourceManifestationPath?: string;
  sourceLocatedFilePath?: string;
  sourceLocalRelativePath?: string;
  sourceDigest?: string;
  observedAt?: string;
}

export interface ExtractPlan {
  meshBase: string;
  designatorPath: string;
  extractionSourceIri: string;
  sourceArtifactIri: string;
  sourceDesignatorPath: string;
  sourceStateIri?: string;
  sourceStatePath?: string;
  sourceResolutionMode: "working" | "exact";
  sourceEvidence?: ExtractionSourceEvidence;
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
  const sourceDesignatorPath = normalizeDesignatorPath(
    request.sourceDesignatorPath,
    "sourceDesignatorPath",
  );
  const sourceStatePath = request.sourceStatePath === undefined
    ? undefined
    : normalizeRelativeIriPath(
      request.sourceStatePath,
      "sourceStatePath",
    );
  const sourceResolutionMode = request.sourceResolutionMode === undefined
    ? (sourceStatePath === undefined ? "working" : "exact")
    : normalizeSourceResolutionMode(request.sourceResolutionMode);
  if (sourceResolutionMode === "exact" && sourceStatePath === undefined) {
    throw new ExtractInputError(
      "sourceStatePath is required for exact extraction",
    );
  }
  if (sourceResolutionMode === "working" && sourceStatePath !== undefined) {
    throw new ExtractInputError(
      "sourceStatePath requires exact source resolution",
    );
  }
  const sourceEvidence = normalizeExtractionSourceEvidence(
    request.sourceEvidence,
  );
  const sourceWorkingLocalRelativePath = normalizeWorkingLocalRelativePath(
    request.sourceWorkingLocalRelativePath,
  );

  try {
    const knopPath = toKnopPath(designatorPath);
    const updatedMeshInventoryTurtle = renderExtractMeshInventoryTurtle(
      meshBase,
      request.currentMeshInventoryTurtle,
      designatorPath,
      sourceDesignatorPath,
      sourceWorkingLocalRelativePath,
    );

    return {
      meshBase,
      designatorPath,
      extractionSourceIri:
        new URL(`${knopPath}/_sources#extraction-source`, meshBase).href,
      sourceArtifactIri: new URL(sourceDesignatorPath, meshBase).href,
      sourceDesignatorPath,
      ...(sourceStatePath
        ? { sourceStateIri: new URL(sourceStatePath, meshBase).href }
        : {}),
      sourceStatePath,
      sourceResolutionMode,
      ...(sourceEvidence ? { sourceEvidence } : {}),
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
          path: `${knopPath}/_sources/sources.ttl`,
          contents: renderExtractKnopSourcesTurtle(
            meshBase,
            designatorPath,
            sourceDesignatorPath,
            sourceResolutionMode,
            sourceStatePath,
            sourceEvidence,
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

function normalizeSourceResolutionMode(
  sourceResolutionMode: string,
): "working" | "exact" {
  if (sourceResolutionMode === "working" || sourceResolutionMode === "exact") {
    return sourceResolutionMode;
  }
  throw new ExtractInputError("sourceResolutionMode must be working or exact");
}

function normalizeExtractionSourceEvidence(
  sourceEvidence: ExtractionSourceEvidence | undefined,
): ExtractionSourceEvidence | undefined {
  if (sourceEvidence === undefined) {
    return undefined;
  }

  const normalized: ExtractionSourceEvidence = {};
  if (sourceEvidence.sourceStatePath !== undefined) {
    normalized.sourceStatePath = normalizeRelativeIriPath(
      sourceEvidence.sourceStatePath,
      "sourceEvidence.sourceStatePath",
    );
  }
  if (sourceEvidence.sourceManifestationPath !== undefined) {
    normalized.sourceManifestationPath = normalizeRelativeIriPath(
      sourceEvidence.sourceManifestationPath,
      "sourceEvidence.sourceManifestationPath",
    );
  }
  if (sourceEvidence.sourceLocatedFilePath !== undefined) {
    normalized.sourceLocatedFilePath = normalizeRelativeIriPath(
      sourceEvidence.sourceLocatedFilePath,
      "sourceEvidence.sourceLocatedFilePath",
    );
  }
  if (sourceEvidence.sourceLocalRelativePath !== undefined) {
    normalized.sourceLocalRelativePath = normalizeWorkingLocalRelativePath(
      sourceEvidence.sourceLocalRelativePath,
    );
  }
  if (sourceEvidence.sourceDigest !== undefined) {
    normalized.sourceDigest = normalizeNonEmptyLiteral(
      sourceEvidence.sourceDigest,
      "sourceEvidence.sourceDigest",
    );
  }
  if (sourceEvidence.observedAt !== undefined) {
    normalized.observedAt = normalizeNonEmptyLiteral(
      sourceEvidence.observedAt,
      "sourceEvidence.observedAt",
    );
  }

  return Object.keys(normalized).length === 0 ? undefined : normalized;
}

function normalizeNonEmptyLiteral(value: string, fieldName: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new ExtractInputError(`${fieldName} must not be empty`);
  }
  return trimmed;
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

function normalizeWorkingLocalRelativePath(
  workingLocalRelativePath: string,
): string {
  return normalizeValidatedPath(workingLocalRelativePath, {
    fieldName: "sourceWorkingLocalRelativePath",
    rejectWhitespace: true,
    slashMessage:
      "sourceWorkingLocalRelativePath must be a mesh-relative file path",
    unsupportedCharactersMessage:
      "sourceWorkingLocalRelativePath contains unsupported path characters",
    emptySegmentsMessage:
      "sourceWorkingLocalRelativePath must not contain empty path segments",
    dotSegmentsMessage:
      "sourceWorkingLocalRelativePath contains unsupported path segments",
    allowParentSegments: true,
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
    allowParentSegments: false,
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
    allowParentSegments: boolean;
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
  if (
    segments.some((segment) =>
      segment === "." || (!options.allowParentSegments && segment === "..")
    )
  ) {
    throw new ExtractInputError(options.dotSegmentsMessage);
  }

  return trimmed;
}

function renderExtractMeshInventoryTurtle(
  meshBase: string,
  currentMeshInventoryTurtle: string,
  designatorPath: string,
  sourcePayloadDesignatorPath: string,
  sourceWorkingLocalRelativePath: string,
): string {
  assertMeshInventorySupportsExtract(
    meshBase,
    currentMeshInventoryTurtle,
    designatorPath,
    sourcePayloadDesignatorPath,
    sourceWorkingLocalRelativePath,
  );

  if (
    hasLegacyCarriedExtractMeshInventoryShape(
      meshBase,
      currentMeshInventoryTurtle,
      sourcePayloadDesignatorPath,
    )
  ) {
    return renderLegacyExtractMeshInventoryTurtle(
      meshBase,
      currentMeshInventoryTurtle,
      designatorPath,
      sourcePayloadDesignatorPath,
      sourceWorkingLocalRelativePath,
    );
  }

  return appendExtractMeshInventoryTurtle(
    currentMeshInventoryTurtle,
    designatorPath,
  );
}

function appendExtractMeshInventoryTurtle(
  currentMeshInventoryTurtle: string,
  designatorPath: string,
): string {
  const knopPath = toKnopPath(designatorPath);

  return `${currentMeshInventoryTurtle.trimEnd()}

<_mesh> sflo:hasKnop <${knopPath}> .

<${knopPath}> a sflo:Knop ;
  sflo:hasWorkingKnopInventoryFile <${knopPath}/_inventory/inventory.ttl> .

<${knopPath}/_inventory/inventory.ttl> a sflo:LocatedFile, sflo:RdfDocument .
`;
}

function renderLegacyExtractMeshInventoryTurtle(
  meshBase: string,
  currentMeshInventoryTurtle: string,
  designatorPath: string,
  sourcePayloadDesignatorPath: string,
  sourceWorkingLocalRelativePath: string,
): string {
  assertCurrentMeshInventoryShapeForExtract(
    meshBase,
    currentMeshInventoryTurtle,
    designatorPath,
    sourcePayloadDesignatorPath,
    sourceWorkingLocalRelativePath,
  );

  const rootDesignatorPath = toRootDesignatorPath(sourcePayloadDesignatorPath);
  const rootKnopPath = toKnopPath(rootDesignatorPath);
  const sourceKnopPath = toKnopPath(sourcePayloadDesignatorPath);
  const knopPath = toKnopPath(designatorPath);
  const rootPagePath = toDesignatorResourcePagePath(rootDesignatorPath);
  const sourcePayloadPagePath = toDesignatorResourcePagePath(
    sourcePayloadDesignatorPath,
  );
  const meshKnopLines = uniquePaths([
    rootKnopPath,
    sourceKnopPath,
    knopPath,
  ]).map((path) => `  sflo:hasKnop <${path}> ;`).join("\n");
  const rootDesignatorBlock = rootDesignatorPath === sourcePayloadDesignatorPath
    ? ""
    : `<${rootDesignatorPath}>
  sflo:hasResourcePage <${rootPagePath}> .

`;
  const rootKnopBlock = renderExistingKnopBlock(rootKnopPath);
  const sourceKnopBlock = rootKnopPath === sourceKnopPath
    ? ""
    : `${renderExistingKnopBlock(sourceKnopPath)}

`;
  const locatedFileDeclarations = renderLocatedFileDeclarations([
    "_mesh/_meta/meta.ttl",
    "_mesh/_inventory/inventory.ttl",
    "_mesh/_meta/_history001/_s0001/ttl/meta.ttl",
    "_mesh/_inventory/_history001/_s0001/ttl/inventory.ttl",
    "_mesh/_inventory/_history001/_s0002/ttl/inventory.ttl",
    "_mesh/_inventory/_history001/_s0003/ttl/inventory.ttl",
    `${rootKnopPath}/_inventory/inventory.ttl`,
    `${sourceKnopPath}/_inventory/inventory.ttl`,
    `${knopPath}/_inventory/inventory.ttl`,
    sourceWorkingLocalRelativePath,
  ]);
  const resourcePageDeclarations = renderResourcePageDeclarations([
    "_mesh/index.html",
    rootPagePath,
    sourcePayloadPagePath,
    `${rootKnopPath}/index.html`,
    `${sourceKnopPath}/index.html`,
    "_mesh/_meta/index.html",
    "_mesh/_meta/_history001/index.html",
    "_mesh/_meta/_history001/_s0001/index.html",
    "_mesh/_meta/_history001/_s0001/ttl/index.html",
    "_mesh/_inventory/index.html",
    "_mesh/_inventory/_history001/index.html",
    "_mesh/_inventory/_history001/_s0001/index.html",
    "_mesh/_inventory/_history001/_s0001/ttl/index.html",
    "_mesh/_inventory/_history001/_s0002/index.html",
    "_mesh/_inventory/_history001/_s0002/ttl/index.html",
    "_mesh/_inventory/_history001/_s0003/index.html",
    "_mesh/_inventory/_history001/_s0003/ttl/index.html",
  ]);

  return `@base <${meshBase}> .
${SFLO_TURTLE_PREFIX_DECLARATION}
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

<_mesh> a sflo:SemanticMesh ;
  sflo:meshBase "${meshBase}"^^xsd:anyURI ;
  sflo:hasMeshMetadata <_mesh/_meta> ;
  sflo:hasMeshInventory <_mesh/_inventory> ;
${meshKnopLines}
  sflo:hasResourcePage <_mesh/index.html> .

${rootDesignatorBlock}${rootKnopBlock}

<${sourcePayloadDesignatorPath}> a sflo:PayloadArtifact, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasWorkingLocatedFile <${sourceWorkingLocalRelativePath}> ;
  sflo:hasResourcePage <${sourcePayloadPagePath}> .

${sourceKnopBlock}<${knopPath}> a sflo:Knop ;
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
  sflo:hasManifestation <_mesh/_meta/_history001/_s0001/ttl> ;
  sflo:locatedFileForState <_mesh/_meta/_history001/_s0001/ttl/meta.ttl> ;
  sflo:hasResourcePage <_mesh/_meta/_history001/_s0001/index.html> .

<_mesh/_meta/_history001/_s0001/ttl> a sflo:ArtifactManifestation, sflo:RdfDocument ;
  sflo:locatedFileForManifestation <_mesh/_meta/_history001/_s0001/ttl/meta.ttl> ;
  sflo:hasResourcePage <_mesh/_meta/_history001/_s0001/ttl/index.html> .

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
  sflo:hasManifestation <_mesh/_inventory/_history001/_s0001/ttl> ;
  sflo:locatedFileForState <_mesh/_inventory/_history001/_s0001/ttl/inventory.ttl> ;
  sflo:hasResourcePage <_mesh/_inventory/_history001/_s0001/index.html> .

<_mesh/_inventory/_history001/_s0001/ttl> a sflo:ArtifactManifestation, sflo:RdfDocument ;
  sflo:locatedFileForManifestation <_mesh/_inventory/_history001/_s0001/ttl/inventory.ttl> ;
  sflo:hasResourcePage <_mesh/_inventory/_history001/_s0001/ttl/index.html> .

<_mesh/_inventory/_history001/_s0002> a sflo:HistoricalState ;
  sflo:stateOrdinal "2"^^xsd:nonNegativeInteger ;
  sflo:previousHistoricalState <_mesh/_inventory/_history001/_s0001> ;
  sflo:hasManifestation <_mesh/_inventory/_history001/_s0002/ttl> ;
  sflo:locatedFileForState <_mesh/_inventory/_history001/_s0002/ttl/inventory.ttl> ;
  sflo:hasResourcePage <_mesh/_inventory/_history001/_s0002/index.html> .

<_mesh/_inventory/_history001/_s0002/ttl> a sflo:ArtifactManifestation, sflo:RdfDocument ;
  sflo:locatedFileForManifestation <_mesh/_inventory/_history001/_s0002/ttl/inventory.ttl> ;
  sflo:hasResourcePage <_mesh/_inventory/_history001/_s0002/ttl/index.html> .

<_mesh/_inventory/_history001/_s0003> a sflo:HistoricalState ;
  sflo:stateOrdinal "3"^^xsd:nonNegativeInteger ;
  sflo:previousHistoricalState <_mesh/_inventory/_history001/_s0002> ;
  sflo:hasManifestation <_mesh/_inventory/_history001/_s0003/ttl> ;
  sflo:locatedFileForState <_mesh/_inventory/_history001/_s0003/ttl/inventory.ttl> ;
  sflo:hasResourcePage <_mesh/_inventory/_history001/_s0003/index.html> .

<_mesh/_inventory/_history001/_s0003/ttl> a sflo:ArtifactManifestation, sflo:RdfDocument ;
  sflo:locatedFileForManifestation <_mesh/_inventory/_history001/_s0003/ttl/inventory.ttl> ;
  sflo:hasResourcePage <_mesh/_inventory/_history001/_s0003/ttl/index.html> .

${locatedFileDeclarations}

${resourcePageDeclarations}
`;
}

function assertMeshInventorySupportsExtract(
  meshBase: string,
  currentMeshInventoryTurtle: string,
  designatorPath: string,
  sourcePayloadDesignatorPath: string,
  sourceWorkingLocalRelativePath: string,
): void {
  const knopPath = toKnopPath(designatorPath);
  const sourceKnopPath = toKnopPath(sourcePayloadDesignatorPath);
  const designatorPagePath = toDesignatorResourcePagePath(designatorPath);
  const errorMessage =
    `current mesh inventory has an unsupported extract shape for ${designatorPath}`;
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

  assertHasNamedNodeFacts(quads, meshBase, errorMessage, [
    ["_mesh", RDF_TYPE_IRI, SFLO_SEMANTIC_MESH_IRI],
    ["_mesh", SFLO_HAS_MESH_METADATA_IRI, "_mesh/_meta"],
    ["_mesh", SFLO_HAS_MESH_INVENTORY_IRI, "_mesh/_inventory"],
    ["_mesh", SFLO_HAS_KNOP_IRI, sourceKnopPath],
    [sourceKnopPath, RDF_TYPE_IRI, SFLO_KNOP_IRI],
    [
      sourceKnopPath,
      SFLO_HAS_WORKING_KNOP_INVENTORY_FILE_IRI,
      `${sourceKnopPath}/_inventory/inventory.ttl`,
    ],
    [sourcePayloadDesignatorPath, RDF_TYPE_IRI, SFLO_PAYLOAD_ARTIFACT_IRI],
    [sourcePayloadDesignatorPath, RDF_TYPE_IRI, SFLO_DIGITAL_ARTIFACT_IRI],
    [sourcePayloadDesignatorPath, RDF_TYPE_IRI, SFLO_RDF_DOCUMENT_IRI],
    ["_mesh/_inventory", RDF_TYPE_IRI, SFLO_MESH_INVENTORY_IRI],
    ["_mesh/_inventory", RDF_TYPE_IRI, SFLO_DIGITAL_ARTIFACT_IRI],
    ["_mesh/_inventory", RDF_TYPE_IRI, SFLO_RDF_DOCUMENT_IRI],
  ]);
  assertHasLiteralFacts(quads, meshBase, errorMessage, [
    ["_mesh", SFLO_MESH_BASE_IRI, meshBase, XSD_ANY_URI_IRI],
  ]);

  if (
    !hasNamedNodeFact(
      quads,
      meshBase,
      sourcePayloadDesignatorPath,
      SFLO_HAS_WORKING_LOCATED_FILE_IRI,
      sourceWorkingLocalRelativePath,
    ) &&
    !hasLiteralValueFact(
      quads,
      meshBase,
      sourcePayloadDesignatorPath,
      SFLO_WORKING_LOCAL_RELATIVE_PATH_IRI,
      sourceWorkingLocalRelativePath,
    ) &&
    !hasRepositorySourceFloatingLocatorPathFact(
      quads,
      meshBase,
      sourcePayloadDesignatorPath,
      sourceWorkingLocalRelativePath,
    )
  ) {
    throw new ExtractInputError(errorMessage);
  }
}

function hasLegacyCarriedExtractMeshInventoryShape(
  meshBase: string,
  currentMeshInventoryTurtle: string,
  sourcePayloadDesignatorPath: string,
): boolean {
  const errorMessage = "current mesh inventory is not the legacy extract shape";
  let quads: Quad[];
  try {
    quads = parseMeshInventoryQuads(
      meshBase,
      currentMeshInventoryTurtle,
      errorMessage,
    );
  } catch {
    return false;
  }

  const rootDesignatorPath = toRootDesignatorPath(sourcePayloadDesignatorPath);
  const rootKnopPath = toKnopPath(rootDesignatorPath);
  const sourceKnopPath = toKnopPath(sourcePayloadDesignatorPath);
  const meshKnopPaths = listNamedNodeObjectPaths(
    quads,
    meshBase,
    "_mesh",
    SFLO_HAS_KNOP_IRI,
  );
  const expectedMeshKnopPaths = [...new Set([rootKnopPath, sourceKnopPath])];
  const payloadArtifactPaths = listTypedSubjectPaths(
    quads,
    meshBase,
    SFLO_PAYLOAD_ARTIFACT_IRI,
  );

  return payloadArtifactPaths.length === 1 &&
    payloadArtifactPaths[0] === sourcePayloadDesignatorPath &&
    meshKnopPaths.length === expectedMeshKnopPaths.length &&
    expectedMeshKnopPaths.every((path) => meshKnopPaths.includes(path)) &&
    hasNamedNodeFact(
      quads,
      meshBase,
      "_mesh/_inventory/_history001",
      SFLO_LATEST_HISTORICAL_STATE_IRI,
      "_mesh/_inventory/_history001/_s0003",
    ) &&
    hasLiteralFact(
      quads,
      meshBase,
      "_mesh/_inventory/_history001",
      SFLO_NEXT_STATE_ORDINAL_IRI,
      "4",
      XSD_NON_NEGATIVE_INTEGER_IRI,
    );
}

function uniquePaths(paths: readonly string[]): string[] {
  return [...new Set(paths)];
}

function renderExistingKnopBlock(knopPath: string): string {
  return `<${knopPath}> a sflo:Knop ;
  sflo:hasWorkingKnopInventoryFile <${knopPath}/_inventory/inventory.ttl> ;
  sflo:hasResourcePage <${knopPath}/index.html> .`;
}

function renderLocatedFileDeclarations(paths: readonly string[]): string {
  return uniquePaths(paths)
    .map((path) => `<${path}> a sflo:LocatedFile, sflo:RdfDocument .`)
    .join("\n\n");
}

function renderResourcePageDeclarations(paths: readonly string[]): string {
  return uniquePaths(paths)
    .map((path) => `<${path}> a sflo:ResourcePage, sflo:LocatedFile .`)
    .join("\n\n");
}

function renderExtractKnopInventoryTurtle(
  meshBase: string,
  designatorPath: string,
): string {
  const knopPath = toKnopPath(designatorPath);
  const sourceRegistryPath = `${knopPath}/_sources`;
  const sourcesFilePath = `${sourceRegistryPath}/sources.ttl`;
  const extractionSourcePath = `${sourceRegistryPath}#extraction-source`;

  return `@base <${meshBase}> .
${SFLO_TURTLE_PREFIX_DECLARATION}

<${knopPath}> a sflo:Knop ;
  sflo:hasKnopMetadata <${knopPath}/_meta> ;
  sflo:hasKnopInventory <${knopPath}/_inventory> ;
  sflo:hasKnopSourceRegistry <${sourceRegistryPath}> ;
  sflo:hasExtractionSource <${extractionSourcePath}> ;
  sflo:hasWorkingKnopInventoryFile <${knopPath}/_inventory/inventory.ttl> .

<${knopPath}/_meta> a sflo:KnopMetadata, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasWorkingLocatedFile <${knopPath}/_meta/meta.ttl> .

<${knopPath}/_inventory> a sflo:KnopInventory, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasWorkingLocatedFile <${knopPath}/_inventory/inventory.ttl> .

<${sourceRegistryPath}> a sflo:KnopSourceRegistry, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasWorkingLocatedFile <${sourcesFilePath}> .

<${knopPath}/_meta/meta.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<${knopPath}/_inventory/inventory.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<${sourcesFilePath}> a sflo:LocatedFile, sflo:RdfDocument .
`;
}

function renderExtractKnopSourcesTurtle(
  meshBase: string,
  designatorPath: string,
  sourceDesignatorPath: string,
  sourceResolutionMode: "working" | "exact",
  sourceStatePath?: string,
  sourceEvidence?: ExtractionSourceEvidence,
): string {
  const sourceRegistryPath = `${toKnopPath(designatorPath)}/_sources`;
  const sourcesFilePath = `${sourceRegistryPath}/sources.ttl`;
  const extractionSourcePath = `${sourceRegistryPath}#extraction-source`;
  const observationPath = `${extractionSourcePath}-observation-001`;
  const extractionSourceFacts = renderExtractionSourceFacts(
    extractionSourcePath,
    sourceDesignatorPath,
    sourceResolutionMode,
    sourceStatePath,
    sourceEvidence,
  );
  const observationBlock = renderExtractionSourceObservationBlock(
    observationPath,
    sourceEvidence,
  );

  return `@base <${meshBase}> .
${SFLO_TURTLE_PREFIX_DECLARATION}

<${sourceRegistryPath}> a sflo:KnopSourceRegistry, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasWorkingLocatedFile <${sourcesFilePath}> ;
  sflo:hasSourceBinding <${extractionSourcePath}> .

<${extractionSourcePath}> a sflo:ExtractionSource ;
${extractionSourceFacts}

${
    observationBlock
      ? `${observationBlock}\n\n`
      : ""
  }<${sourcesFilePath}> a sflo:LocatedFile, sflo:RdfDocument .
`;
}

function renderExtractionSourceFacts(
  extractionSourcePath: string,
  sourceDesignatorPath: string,
  sourceResolutionMode: "working" | "exact",
  sourceStatePath: string | undefined,
  sourceEvidence: ExtractionSourceEvidence | undefined,
): string {
  const observationPath = `${extractionSourcePath}-observation-001`;
  const facts: [string, string][] = [
    ["sflo:targetArtifact", `<${sourceDesignatorPath}>`],
  ];
  if (sourceResolutionMode === "exact") {
    facts.push(["sflo:targetHistoricalState", `<${sourceStatePath}>`]);
  }
  if (sourceResolutionMode === "working") {
    facts.push([
      "sflo:hasArtifactResolutionMode",
      `<${SFLO_ARTIFACT_RESOLUTION_MODE_WORKING_IRI}>`,
    ]);
  }
  if (sourceEvidence) {
    facts.push(["sflo:hasResolutionObservation", `<${observationPath}>`]);
  }

  return facts.map(([predicate, object], index) =>
    `  ${predicate} ${object}${index === facts.length - 1 ? " ." : " ;"}`
  ).join("\n");
}

function renderExtractionSourceObservationBlock(
  observationPath: string,
  sourceEvidence: ExtractionSourceEvidence | undefined,
): string | undefined {
  if (!sourceEvidence) {
    return undefined;
  }

  const observedSpecFacts: [string, string][] = [
    ["a", "sflo:ArtifactResolutionSpec"],
  ];
  if (sourceEvidence.sourceStatePath !== undefined) {
    observedSpecFacts.push([
      "sflo:targetHistoricalState",
      `<${sourceEvidence.sourceStatePath}>`,
    ]);
  }
  if (sourceEvidence.sourceManifestationPath !== undefined) {
    observedSpecFacts.push([
      "sflo:targetManifestation",
      `<${sourceEvidence.sourceManifestationPath}>`,
    ]);
  }
  if (sourceEvidence.sourceLocatedFilePath !== undefined) {
    observedSpecFacts.push([
      "sflo:targetLocatedFile",
      `<${sourceEvidence.sourceLocatedFilePath}>`,
    ]);
  }
  if (sourceEvidence.sourceLocalRelativePath !== undefined) {
    observedSpecFacts.push([
      "sflo:targetLocalRelativePath",
      `"${escapeTurtleString(sourceEvidence.sourceLocalRelativePath)}"`,
    ]);
  }
  if (
    observedSpecFacts.length === 1 &&
    sourceEvidence.sourceDigest === undefined &&
    sourceEvidence.observedAt === undefined
  ) {
    return undefined;
  }
  const facts: [string, string][] = [
    [
      "sflo:observedArtifactResolutionSpec",
      renderObservedArtifactResolutionSpec(observedSpecFacts),
    ],
  ];
  if (sourceEvidence.sourceDigest !== undefined) {
    facts.push([
      "sflo:observedContentDigest",
      `"${escapeTurtleString(sourceEvidence.sourceDigest)}"`,
    ]);
  }
  if (sourceEvidence.observedAt !== undefined) {
    facts.push([
      "sflo:observedAt",
      `"${escapeTurtleString(sourceEvidence.observedAt)}"`,
    ]);
  }

  if (facts.length === 0) {
    return undefined;
  }

  return `<${observationPath}> a sflo:ArtifactResolutionObservation ;
${
    facts.map(([predicate, object], index) =>
      `  ${predicate} ${object}${index === facts.length - 1 ? " ." : " ;"}`
    ).join("\n")
  }`;
}

function renderObservedArtifactResolutionSpec(
  facts: readonly [string, string][],
): string {
  return `[
${
    facts.map(([predicate, object], index) =>
      `    ${predicate} ${object}${index === facts.length - 1 ? "" : " ;"}`
    ).join("\n")
  }
  ]`;
}

function renderExtractKnopMetadataTurtle(
  meshBase: string,
  designatorPath: string,
): string {
  const knopPath = toKnopPath(designatorPath);

  return `@base <${meshBase}> .
${SFLO_TURTLE_PREFIX_DECLARATION}

<${knopPath}> a sflo:Knop ;
  sflo:designatorPath "${designatorPath}" ;
  sflo:hasWorkingKnopInventoryFile <${knopPath}/_inventory/inventory.ttl> .
`;
}

function assertCurrentMeshInventoryShapeForExtract(
  meshBase: string,
  currentMeshInventoryTurtle: string,
  designatorPath: string,
  sourcePayloadDesignatorPath: string,
  sourceWorkingLocalRelativePath: string,
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
      sourceWorkingLocalRelativePath,
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
    [sourceWorkingLocalRelativePath, RDF_TYPE_IRI, SFLO_LOCATED_FILE_IRI],
    [sourceWorkingLocalRelativePath, RDF_TYPE_IRI, SFLO_RDF_DOCUMENT_IRI],
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

function hasLiteralValueFact(
  quads: readonly Quad[],
  meshBase: string,
  subjectValue: string,
  predicateIri: string,
  literalValue: string,
): boolean {
  const subjectIri = new URL(subjectValue, meshBase).href;

  return quads.some((quad) =>
    quad.subject.termType === "NamedNode" &&
    quad.subject.value === subjectIri &&
    quad.predicate.value === predicateIri &&
    quad.object.termType === "Literal" &&
    quad.object.value === literalValue
  );
}

function hasRepositorySourceFloatingLocatorPathFact(
  quads: readonly Quad[],
  meshBase: string,
  subjectValue: string,
  repositoryPathFromRoot: string,
): boolean {
  const subjectIri = new URL(subjectValue, meshBase).href;
  const locatorKeys = new Set<string>();

  for (const quad of quads) {
    if (
      quad.subject.termType === "NamedNode" &&
      quad.subject.value === subjectIri &&
      quad.predicate.value ===
        SFLO_HAS_REPOSITORY_SOURCE_FLOATING_LOCATOR_IRI &&
      (quad.object.termType === "NamedNode" ||
        quad.object.termType === "BlankNode")
    ) {
      locatorKeys.add(toRdfTermKey(quad.object));
    }
  }

  return quads.some((quad) =>
    (quad.subject.termType === "NamedNode" ||
      quad.subject.termType === "BlankNode") &&
    locatorKeys.has(toRdfTermKey(quad.subject)) &&
    quad.predicate.value === SFLO_SOURCE_REPOSITORY_PATH_FROM_ROOT_IRI &&
    quad.object.termType === "Literal" &&
    normalizeWorkingLocalRelativePath(quad.object.value) ===
      repositoryPathFromRoot
  );
}

function toRdfTermKey(term: { termType: string; value: string }): string {
  return `${term.termType}:${term.value}`;
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
