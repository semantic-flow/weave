import { Parser } from "n3";
import type { Quad } from "n3";
import type { PlannedFile } from "../planned_file.ts";

const reservedDesignatorSegments = new Set(["_knop", "_mesh"]);
const safeDesignatorSegmentPattern = /^[A-Za-z0-9._-]+$/;
const RDF_TYPE_IRI = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type";
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
const SFLO_HAS_KNOP_INVENTORY_IRI = `${SFLO_NAMESPACE}hasKnopInventory`;
const SFLO_HAS_KNOP_METADATA_IRI = `${SFLO_NAMESPACE}hasKnopMetadata`;
const SFLO_HAS_LOCATED_FILE_IRI = `${SFLO_NAMESPACE}hasLocatedFile`;
const SFLO_HAS_MANIFESTATION_IRI = `${SFLO_NAMESPACE}hasManifestation`;
const SFLO_HAS_REFERENCE_CATALOG_IRI = `${SFLO_NAMESPACE}hasReferenceCatalog`;
const SFLO_HAS_RESOURCE_PAGE_IRI = `${SFLO_NAMESPACE}hasResourcePage`;
const SFLO_HAS_WORKING_KNOP_INVENTORY_FILE_IRI =
  `${SFLO_NAMESPACE}hasWorkingKnopInventoryFile`;
const SFLO_HAS_WORKING_LOCATED_FILE_IRI =
  `${SFLO_NAMESPACE}hasWorkingLocatedFile`;
const SFLO_HISTORICAL_STATE_IRI = `${SFLO_NAMESPACE}HistoricalState`;
const SFLO_HISTORY_ORDINAL_IRI = `${SFLO_NAMESPACE}historyOrdinal`;
const SFLO_KNOP_IRI = `${SFLO_NAMESPACE}Knop`;
const SFLO_KNOP_INVENTORY_IRI = `${SFLO_NAMESPACE}KnopInventory`;
const SFLO_KNOP_METADATA_IRI = `${SFLO_NAMESPACE}KnopMetadata`;
const SFLO_LATEST_HISTORICAL_STATE_IRI =
  `${SFLO_NAMESPACE}latestHistoricalState`;
const SFLO_LOCATED_FILE_FOR_STATE_IRI = `${SFLO_NAMESPACE}locatedFileForState`;
const SFLO_LOCATED_FILE_IRI = `${SFLO_NAMESPACE}LocatedFile`;
const SFLO_NEXT_HISTORY_ORDINAL_IRI = `${SFLO_NAMESPACE}nextHistoryOrdinal`;
const SFLO_NEXT_STATE_ORDINAL_IRI = `${SFLO_NAMESPACE}nextStateOrdinal`;
const SFLO_RDF_DOCUMENT_IRI = `${SFLO_NAMESPACE}RdfDocument`;
const SFLO_REFERENCE_CATALOG_IRI = `${SFLO_NAMESPACE}ReferenceCatalog`;
const SFLO_RESOURCE_PAGE_IRI = `${SFLO_NAMESPACE}ResourcePage`;
const SFLO_STATE_ORDINAL_IRI = `${SFLO_NAMESPACE}stateOrdinal`;

const referenceRoleIriByToken = {
  canonical:
    "https://semantic-flow.github.io/semantic-flow-ontology/ReferenceRole/Canonical",
  supplemental:
    "https://semantic-flow.github.io/semantic-flow-ontology/ReferenceRole/Supplemental",
  deprecated:
    "https://semantic-flow.github.io/semantic-flow-ontology/ReferenceRole/Deprecated",
} as const;

type ReferenceRoleToken = keyof typeof referenceRoleIriByToken;

export interface KnopAddReferenceRequest {
  designatorPath: string;
  referenceTargetDesignatorPath: string;
  referenceRole: string;
}

export interface ResolvedKnopAddReferenceRequest
  extends KnopAddReferenceRequest {
  meshBase: string;
  currentKnopInventoryTurtle: string;
}

export interface KnopAddReferencePlan {
  meshBase: string;
  designatorPath: string;
  referenceTargetDesignatorPath: string;
  referenceCatalogIri: string;
  referenceLinkIri: string;
  referenceRoleIri: string;
  referenceTargetIri: string;
  createdFiles: readonly PlannedFile[];
  updatedFiles: readonly PlannedFile[];
}

export class KnopAddReferenceInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "KnopAddReferenceInputError";
  }
}

type KnopInventoryShape = "unwoven" | "woven";

export function planKnopAddReference(
  request: ResolvedKnopAddReferenceRequest,
): KnopAddReferencePlan {
  const meshBase = normalizeMeshBase(request.meshBase);
  const designatorPath = normalizeDesignatorPath(
    request.designatorPath,
    "designatorPath",
  );
  const referenceTargetDesignatorPath = normalizeDesignatorPath(
    request.referenceTargetDesignatorPath,
    "referenceTargetDesignatorPath",
  );
  const referenceRoleToken = normalizeReferenceRole(request.referenceRole);
  const referenceRoleIri = referenceRoleIriByToken[referenceRoleToken];
  const knopPath = toKnopPath(designatorPath);
  const referenceCatalogPath = `${knopPath}/_references`;
  const referenceLinkPath = `${referenceCatalogPath}#reference001`;

  return {
    meshBase,
    designatorPath,
    referenceTargetDesignatorPath,
    referenceCatalogIri: new URL(referenceCatalogPath, meshBase).href,
    referenceLinkIri: new URL(referenceLinkPath, meshBase).href,
    referenceRoleIri,
    referenceTargetIri: new URL(referenceTargetDesignatorPath, meshBase).href,
    createdFiles: [
      {
        path: `${referenceCatalogPath}/references.ttl`,
        contents: renderReferencesTurtle(
          meshBase,
          designatorPath,
          referenceTargetDesignatorPath,
          referenceRoleIri,
        ),
      },
    ],
    updatedFiles: [
      {
        path: `${knopPath}/_inventory/inventory.ttl`,
        contents: renderUpdatedKnopInventoryTurtle(
          meshBase,
          request.currentKnopInventoryTurtle,
          knopPath,
        ),
      },
    ],
  };
}

function normalizeMeshBase(meshBase: string): string {
  const trimmed = meshBase.trim();
  if (trimmed.length === 0) {
    throw new KnopAddReferenceInputError("meshBase is required");
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new KnopAddReferenceInputError("meshBase must be an absolute IRI");
  }

  if (!url.pathname.endsWith("/")) {
    throw new KnopAddReferenceInputError("meshBase must end with '/'");
  }
  if (url.search.length > 0 || url.hash.length > 0) {
    throw new KnopAddReferenceInputError(
      "meshBase must not include a query or fragment",
    );
  }

  return url.href;
}

function normalizeDesignatorPath(
  designatorPath: string,
  fieldName: string,
): string {
  const trimmed = designatorPath.trim();
  if (trimmed.length === 0) {
    throw new KnopAddReferenceInputError(`${fieldName} is required`);
  }
  if (trimmed.startsWith("/") || trimmed.endsWith("/")) {
    throw new KnopAddReferenceInputError(
      `${fieldName} must not start or end with '/'`,
    );
  }
  if (
    trimmed.includes("\\") || trimmed.includes("?") || trimmed.includes("#")
  ) {
    throw new KnopAddReferenceInputError(
      `${fieldName} contains unsupported path characters`,
    );
  }

  const segments = trimmed.split("/");
  if (segments.some((segment) => segment.length === 0)) {
    throw new KnopAddReferenceInputError(
      `${fieldName} must not contain empty path segments`,
    );
  }
  if (segments.some((segment) => segment === "." || segment === "..")) {
    throw new KnopAddReferenceInputError(
      `${fieldName} must not contain '.' or '..' path segments`,
    );
  }
  if (segments.some((segment) => reservedDesignatorSegments.has(segment))) {
    throw new KnopAddReferenceInputError(
      `${fieldName} must not contain reserved path segments`,
    );
  }
  for (const segment of segments) {
    if (!safeDesignatorSegmentPattern.test(segment)) {
      throw new KnopAddReferenceInputError(
        `normalizeDesignatorPath rejected segment "${segment}" in ${fieldName}: toKnopPath only accepts path segments matching [A-Za-z0-9._-]+`,
      );
    }
  }

  return trimmed;
}

function normalizeReferenceRole(referenceRole: string): ReferenceRoleToken {
  const normalized = referenceRole.trim().toLowerCase();
  if (normalized.length === 0) {
    throw new KnopAddReferenceInputError("referenceRole is required");
  }
  if (
    Object.prototype.hasOwnProperty.call(referenceRoleIriByToken, normalized)
  ) {
    return normalized as ReferenceRoleToken;
  }
  throw new KnopAddReferenceInputError(
    `Unsupported referenceRole: ${referenceRole}`,
  );
}

function renderReferencesTurtle(
  meshBase: string,
  designatorPath: string,
  referenceTargetDesignatorPath: string,
  referenceRoleIri: string,
): string {
  const referenceCatalogPath = `${toKnopPath(designatorPath)}/_references`;

  return `@base <${meshBase}> .
@prefix sflo: <https://semantic-flow.github.io/semantic-flow-ontology/> .

<${designatorPath}> sflo:hasReferenceLink <${referenceCatalogPath}#reference001> .

<${referenceCatalogPath}#reference001> a sflo:ReferenceLink ;
  sflo:referenceLinkFor <${designatorPath}> ;
  sflo:hasReferenceRole <${referenceRoleIri}> ;
  sflo:referenceTarget <${referenceTargetDesignatorPath}> .
`;
}

function renderUpdatedKnopInventoryTurtle(
  meshBase: string,
  currentKnopInventoryTurtle: string,
  knopPath: string,
): string {
  const shape = classifyCurrentKnopInventoryShape(
    meshBase,
    currentKnopInventoryTurtle,
    knopPath,
  );

  return shape === "woven"
    ? renderWovenKnopInventoryWithReferenceCatalog(meshBase, knopPath)
    : renderUnwovenKnopInventoryWithReferenceCatalog(meshBase, knopPath);
}

function classifyCurrentKnopInventoryShape(
  meshBase: string,
  currentKnopInventoryTurtle: string,
  knopPath: string,
): KnopInventoryShape {
  const referenceCatalogPath = `${knopPath}/_references`;
  const shapeErrorMessage =
    `current knop inventory has an unsupported carried shape for ${knopPath}`;
  const quads = parseKnopInventoryQuads(
    meshBase,
    currentKnopInventoryTurtle,
    shapeErrorMessage,
  );

  if (
    !hasNamedNodeFact(
      quads,
      meshBase,
      knopPath,
      RDF_TYPE_IRI,
      SFLO_KNOP_IRI,
    )
  ) {
    throw new KnopAddReferenceInputError(
      `current knop inventory is missing the ${knopPath} block`,
    );
  }

  if (
    hasNamedNodeFact(
      quads,
      meshBase,
      knopPath,
      SFLO_HAS_REFERENCE_CATALOG_IRI,
      referenceCatalogPath,
    ) ||
    hasNamedNodeFact(
      quads,
      meshBase,
      referenceCatalogPath,
      RDF_TYPE_IRI,
      SFLO_REFERENCE_CATALOG_IRI,
    )
  ) {
    throw new KnopAddReferenceInputError(
      `knop inventory already registers reference catalog: ${referenceCatalogPath}`,
    );
  }

  const hasWovenHistory = hasNamedNodeFact(
    quads,
    meshBase,
    knopPath,
    SFLO_HAS_RESOURCE_PAGE_IRI,
    `${knopPath}/index.html`,
  ) ||
    hasPredicateForSubject(
      quads,
      meshBase,
      `${knopPath}/_meta`,
      SFLO_HAS_ARTIFACT_HISTORY_IRI,
    ) ||
    hasPredicateForSubject(
      quads,
      meshBase,
      `${knopPath}/_inventory`,
      SFLO_HAS_ARTIFACT_HISTORY_IRI,
    );

  if (hasWovenHistory) {
    assertCurrentWovenKnopInventoryShape(
      quads,
      meshBase,
      knopPath,
      shapeErrorMessage,
    );
    return "woven";
  }

  assertCurrentUnwovenKnopInventoryShape(
    quads,
    meshBase,
    knopPath,
    shapeErrorMessage,
  );
  return "unwoven";
}

function assertCurrentUnwovenKnopInventoryShape(
  quads: readonly Quad[],
  meshBase: string,
  knopPath: string,
  errorMessage: string,
): void {
  assertHasNamedNodeFacts(quads, meshBase, errorMessage, [
    [knopPath, RDF_TYPE_IRI, SFLO_KNOP_IRI],
    [knopPath, SFLO_HAS_KNOP_METADATA_IRI, `${knopPath}/_meta`],
    [knopPath, SFLO_HAS_KNOP_INVENTORY_IRI, `${knopPath}/_inventory`],
    [
      knopPath,
      SFLO_HAS_WORKING_KNOP_INVENTORY_FILE_IRI,
      `${knopPath}/_inventory/inventory.ttl`,
    ],
    [`${knopPath}/_meta`, RDF_TYPE_IRI, SFLO_KNOP_METADATA_IRI],
    [`${knopPath}/_meta`, RDF_TYPE_IRI, SFLO_DIGITAL_ARTIFACT_IRI],
    [`${knopPath}/_meta`, RDF_TYPE_IRI, SFLO_RDF_DOCUMENT_IRI],
    [
      `${knopPath}/_meta`,
      SFLO_HAS_WORKING_LOCATED_FILE_IRI,
      `${knopPath}/_meta/meta.ttl`,
    ],
    [`${knopPath}/_inventory`, RDF_TYPE_IRI, SFLO_KNOP_INVENTORY_IRI],
    [`${knopPath}/_inventory`, RDF_TYPE_IRI, SFLO_DIGITAL_ARTIFACT_IRI],
    [`${knopPath}/_inventory`, RDF_TYPE_IRI, SFLO_RDF_DOCUMENT_IRI],
    [
      `${knopPath}/_inventory`,
      SFLO_HAS_WORKING_LOCATED_FILE_IRI,
      `${knopPath}/_inventory/inventory.ttl`,
    ],
    [`${knopPath}/_meta/meta.ttl`, RDF_TYPE_IRI, SFLO_LOCATED_FILE_IRI],
    [`${knopPath}/_meta/meta.ttl`, RDF_TYPE_IRI, SFLO_RDF_DOCUMENT_IRI],
    [
      `${knopPath}/_inventory/inventory.ttl`,
      RDF_TYPE_IRI,
      SFLO_LOCATED_FILE_IRI,
    ],
    [
      `${knopPath}/_inventory/inventory.ttl`,
      RDF_TYPE_IRI,
      SFLO_RDF_DOCUMENT_IRI,
    ],
  ]);
}

function assertCurrentWovenKnopInventoryShape(
  quads: readonly Quad[],
  meshBase: string,
  knopPath: string,
  errorMessage: string,
): void {
  assertCurrentUnwovenKnopInventoryShape(
    quads,
    meshBase,
    knopPath,
    errorMessage,
  );
  assertHasNamedNodeFacts(quads, meshBase, errorMessage, [
    [knopPath, SFLO_HAS_RESOURCE_PAGE_IRI, `${knopPath}/index.html`],
    [
      `${knopPath}/_meta`,
      SFLO_HAS_ARTIFACT_HISTORY_IRI,
      `${knopPath}/_meta/_history001`,
    ],
    [
      `${knopPath}/_meta`,
      SFLO_CURRENT_ARTIFACT_HISTORY_IRI,
      `${knopPath}/_meta/_history001`,
    ],
    [
      `${knopPath}/_meta`,
      SFLO_HAS_RESOURCE_PAGE_IRI,
      `${knopPath}/_meta/index.html`,
    ],
    [
      `${knopPath}/_inventory`,
      SFLO_HAS_ARTIFACT_HISTORY_IRI,
      `${knopPath}/_inventory/_history001`,
    ],
    [
      `${knopPath}/_inventory`,
      SFLO_CURRENT_ARTIFACT_HISTORY_IRI,
      `${knopPath}/_inventory/_history001`,
    ],
    [
      `${knopPath}/_inventory`,
      SFLO_HAS_RESOURCE_PAGE_IRI,
      `${knopPath}/_inventory/index.html`,
    ],
    [`${knopPath}/_meta/_history001`, RDF_TYPE_IRI, SFLO_ARTIFACT_HISTORY_IRI],
    [
      `${knopPath}/_meta/_history001`,
      SFLO_HAS_HISTORICAL_STATE_IRI,
      `${knopPath}/_meta/_history001/_s0001`,
    ],
    [
      `${knopPath}/_meta/_history001`,
      SFLO_LATEST_HISTORICAL_STATE_IRI,
      `${knopPath}/_meta/_history001/_s0001`,
    ],
    [
      `${knopPath}/_meta/_history001`,
      SFLO_HAS_RESOURCE_PAGE_IRI,
      `${knopPath}/_meta/_history001/index.html`,
    ],
    [
      `${knopPath}/_meta/_history001/_s0001`,
      RDF_TYPE_IRI,
      SFLO_HISTORICAL_STATE_IRI,
    ],
    [
      `${knopPath}/_meta/_history001/_s0001`,
      SFLO_HAS_MANIFESTATION_IRI,
      `${knopPath}/_meta/_history001/_s0001/meta-ttl`,
    ],
    [
      `${knopPath}/_meta/_history001/_s0001`,
      SFLO_LOCATED_FILE_FOR_STATE_IRI,
      `${knopPath}/_meta/_history001/_s0001/meta-ttl/meta.ttl`,
    ],
    [
      `${knopPath}/_meta/_history001/_s0001`,
      SFLO_HAS_RESOURCE_PAGE_IRI,
      `${knopPath}/_meta/_history001/_s0001/index.html`,
    ],
    [
      `${knopPath}/_meta/_history001/_s0001/meta-ttl`,
      RDF_TYPE_IRI,
      SFLO_ARTIFACT_MANIFESTATION_IRI,
    ],
    [
      `${knopPath}/_meta/_history001/_s0001/meta-ttl`,
      RDF_TYPE_IRI,
      SFLO_RDF_DOCUMENT_IRI,
    ],
    [
      `${knopPath}/_meta/_history001/_s0001/meta-ttl`,
      SFLO_HAS_LOCATED_FILE_IRI,
      `${knopPath}/_meta/_history001/_s0001/meta-ttl/meta.ttl`,
    ],
    [
      `${knopPath}/_meta/_history001/_s0001/meta-ttl`,
      SFLO_HAS_RESOURCE_PAGE_IRI,
      `${knopPath}/_meta/_history001/_s0001/meta-ttl/index.html`,
    ],
    [
      `${knopPath}/_inventory/_history001`,
      RDF_TYPE_IRI,
      SFLO_ARTIFACT_HISTORY_IRI,
    ],
    [
      `${knopPath}/_inventory/_history001`,
      SFLO_HAS_HISTORICAL_STATE_IRI,
      `${knopPath}/_inventory/_history001/_s0001`,
    ],
    [
      `${knopPath}/_inventory/_history001`,
      SFLO_LATEST_HISTORICAL_STATE_IRI,
      `${knopPath}/_inventory/_history001/_s0001`,
    ],
    [
      `${knopPath}/_inventory/_history001`,
      SFLO_HAS_RESOURCE_PAGE_IRI,
      `${knopPath}/_inventory/_history001/index.html`,
    ],
    [
      `${knopPath}/_inventory/_history001/_s0001`,
      RDF_TYPE_IRI,
      SFLO_HISTORICAL_STATE_IRI,
    ],
    [
      `${knopPath}/_inventory/_history001/_s0001`,
      SFLO_HAS_MANIFESTATION_IRI,
      `${knopPath}/_inventory/_history001/_s0001/inventory-ttl`,
    ],
    [
      `${knopPath}/_inventory/_history001/_s0001`,
      SFLO_LOCATED_FILE_FOR_STATE_IRI,
      `${knopPath}/_inventory/_history001/_s0001/inventory-ttl/inventory.ttl`,
    ],
    [
      `${knopPath}/_inventory/_history001/_s0001`,
      SFLO_HAS_RESOURCE_PAGE_IRI,
      `${knopPath}/_inventory/_history001/_s0001/index.html`,
    ],
    [
      `${knopPath}/_inventory/_history001/_s0001/inventory-ttl`,
      RDF_TYPE_IRI,
      SFLO_ARTIFACT_MANIFESTATION_IRI,
    ],
    [
      `${knopPath}/_inventory/_history001/_s0001/inventory-ttl`,
      RDF_TYPE_IRI,
      SFLO_RDF_DOCUMENT_IRI,
    ],
    [
      `${knopPath}/_inventory/_history001/_s0001/inventory-ttl`,
      SFLO_HAS_LOCATED_FILE_IRI,
      `${knopPath}/_inventory/_history001/_s0001/inventory-ttl/inventory.ttl`,
    ],
    [
      `${knopPath}/_inventory/_history001/_s0001/inventory-ttl`,
      SFLO_HAS_RESOURCE_PAGE_IRI,
      `${knopPath}/_inventory/_history001/_s0001/inventory-ttl/index.html`,
    ],
    [`${knopPath}/index.html`, RDF_TYPE_IRI, SFLO_RESOURCE_PAGE_IRI],
    [`${knopPath}/index.html`, RDF_TYPE_IRI, SFLO_LOCATED_FILE_IRI],
    [`${knopPath}/_meta/index.html`, RDF_TYPE_IRI, SFLO_RESOURCE_PAGE_IRI],
    [`${knopPath}/_meta/index.html`, RDF_TYPE_IRI, SFLO_LOCATED_FILE_IRI],
    [
      `${knopPath}/_meta/_history001/index.html`,
      RDF_TYPE_IRI,
      SFLO_RESOURCE_PAGE_IRI,
    ],
    [
      `${knopPath}/_meta/_history001/index.html`,
      RDF_TYPE_IRI,
      SFLO_LOCATED_FILE_IRI,
    ],
    [
      `${knopPath}/_meta/_history001/_s0001/index.html`,
      RDF_TYPE_IRI,
      SFLO_RESOURCE_PAGE_IRI,
    ],
    [
      `${knopPath}/_meta/_history001/_s0001/index.html`,
      RDF_TYPE_IRI,
      SFLO_LOCATED_FILE_IRI,
    ],
    [
      `${knopPath}/_meta/_history001/_s0001/meta-ttl/index.html`,
      RDF_TYPE_IRI,
      SFLO_RESOURCE_PAGE_IRI,
    ],
    [
      `${knopPath}/_meta/_history001/_s0001/meta-ttl/index.html`,
      RDF_TYPE_IRI,
      SFLO_LOCATED_FILE_IRI,
    ],
    [`${knopPath}/_inventory/index.html`, RDF_TYPE_IRI, SFLO_RESOURCE_PAGE_IRI],
    [`${knopPath}/_inventory/index.html`, RDF_TYPE_IRI, SFLO_LOCATED_FILE_IRI],
    [
      `${knopPath}/_inventory/_history001/index.html`,
      RDF_TYPE_IRI,
      SFLO_RESOURCE_PAGE_IRI,
    ],
    [
      `${knopPath}/_inventory/_history001/index.html`,
      RDF_TYPE_IRI,
      SFLO_LOCATED_FILE_IRI,
    ],
    [
      `${knopPath}/_inventory/_history001/_s0001/index.html`,
      RDF_TYPE_IRI,
      SFLO_RESOURCE_PAGE_IRI,
    ],
    [
      `${knopPath}/_inventory/_history001/_s0001/index.html`,
      RDF_TYPE_IRI,
      SFLO_LOCATED_FILE_IRI,
    ],
    [
      `${knopPath}/_inventory/_history001/_s0001/inventory-ttl/index.html`,
      RDF_TYPE_IRI,
      SFLO_RESOURCE_PAGE_IRI,
    ],
    [
      `${knopPath}/_inventory/_history001/_s0001/inventory-ttl/index.html`,
      RDF_TYPE_IRI,
      SFLO_LOCATED_FILE_IRI,
    ],
    [
      `${knopPath}/_meta/_history001/_s0001/meta-ttl/meta.ttl`,
      RDF_TYPE_IRI,
      SFLO_LOCATED_FILE_IRI,
    ],
    [
      `${knopPath}/_meta/_history001/_s0001/meta-ttl/meta.ttl`,
      RDF_TYPE_IRI,
      SFLO_RDF_DOCUMENT_IRI,
    ],
    [
      `${knopPath}/_inventory/_history001/_s0001/inventory-ttl/inventory.ttl`,
      RDF_TYPE_IRI,
      SFLO_LOCATED_FILE_IRI,
    ],
    [
      `${knopPath}/_inventory/_history001/_s0001/inventory-ttl/inventory.ttl`,
      RDF_TYPE_IRI,
      SFLO_RDF_DOCUMENT_IRI,
    ],
  ]);
  assertHasLiteralFacts(quads, meshBase, errorMessage, [
    [
      `${knopPath}/_meta`,
      SFLO_NEXT_HISTORY_ORDINAL_IRI,
      "2",
      XSD_NON_NEGATIVE_INTEGER_IRI,
    ],
    [
      `${knopPath}/_inventory`,
      SFLO_NEXT_HISTORY_ORDINAL_IRI,
      "2",
      XSD_NON_NEGATIVE_INTEGER_IRI,
    ],
    [
      `${knopPath}/_meta/_history001`,
      SFLO_HISTORY_ORDINAL_IRI,
      "1",
      XSD_NON_NEGATIVE_INTEGER_IRI,
    ],
    [
      `${knopPath}/_meta/_history001`,
      SFLO_NEXT_STATE_ORDINAL_IRI,
      "2",
      XSD_NON_NEGATIVE_INTEGER_IRI,
    ],
    [
      `${knopPath}/_meta/_history001/_s0001`,
      SFLO_STATE_ORDINAL_IRI,
      "1",
      XSD_NON_NEGATIVE_INTEGER_IRI,
    ],
    [
      `${knopPath}/_inventory/_history001`,
      SFLO_HISTORY_ORDINAL_IRI,
      "1",
      XSD_NON_NEGATIVE_INTEGER_IRI,
    ],
    [
      `${knopPath}/_inventory/_history001`,
      SFLO_NEXT_STATE_ORDINAL_IRI,
      "2",
      XSD_NON_NEGATIVE_INTEGER_IRI,
    ],
    [
      `${knopPath}/_inventory/_history001/_s0001`,
      SFLO_STATE_ORDINAL_IRI,
      "1",
      XSD_NON_NEGATIVE_INTEGER_IRI,
    ],
  ]);
}

function renderUnwovenKnopInventoryWithReferenceCatalog(
  meshBase: string,
  knopPath: string,
): string {
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

function renderWovenKnopInventoryWithReferenceCatalog(
  meshBase: string,
  knopPath: string,
): string {
  return `@base <${meshBase}> .
@prefix sflo: <https://semantic-flow.github.io/semantic-flow-ontology/> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

<${knopPath}> a sflo:Knop ;
  sflo:hasKnopMetadata <${knopPath}/_meta> ;
  sflo:hasKnopInventory <${knopPath}/_inventory> ;
  sflo:hasWorkingKnopInventoryFile <${knopPath}/_inventory/inventory.ttl> ;
  sflo:hasReferenceCatalog <${knopPath}/_references> ;
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

<${knopPath}/_references> a sflo:ReferenceCatalog, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasWorkingLocatedFile <${knopPath}/_references/references.ttl> .

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

<${knopPath}/_references/references.ttl> a sflo:LocatedFile, sflo:RdfDocument .

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
      throw new KnopAddReferenceInputError(errorMessage);
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
      throw new KnopAddReferenceInputError(errorMessage);
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

function parseKnopInventoryQuads(
  meshBase: string,
  turtle: string,
  errorMessage: string,
): Quad[] {
  try {
    return new Parser({ baseIRI: meshBase }).parse(turtle);
  } catch {
    throw new KnopAddReferenceInputError(errorMessage);
  }
}

function toKnopPath(designatorPath: string): string {
  return `${designatorPath}/_knop`;
}
