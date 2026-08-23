import type { PlannedBinaryFile, PlannedFile } from "../planned_file.ts";
import {
  normalizeSafeDesignatorPath,
  toFoundingReferentDataPath,
  toKnopPath,
} from "../designator_segments.ts";
import {
  SFLO_NAMESPACE,
  SFLO_TURTLE_PREFIX_DECLARATION,
} from "../rdf/namespaces.ts";
import {
  planInventoryAppend,
  prepareCurrentInventory,
  type PreparedCurrentInventory,
  renderInventoryAppendPlan,
} from "../weave/inventory_append_planner.ts";
import { KnopCreateInventoryIndex } from "./create_inventory_index.ts";
import {
  type ValidatedFoundingReferentData,
  validateFoundingReferentData,
} from "./founding_referent_data.ts";

const RDF_TYPE_IRI = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type";
const XSD_ANY_URI_IRI = "http://www.w3.org/2001/XMLSchema#anyURI";
const XSD_NON_NEGATIVE_INTEGER_IRI =
  "http://www.w3.org/2001/XMLSchema#nonNegativeInteger";
const SFLO_ARTIFACT_HISTORY_IRI = `${SFLO_NAMESPACE}ArtifactHistory`;
const SFLO_ARTIFACT_MANIFESTATION_IRI =
  `${SFLO_NAMESPACE}ArtifactManifestation`;
const SFLO_CURRENT_ARTIFACT_HISTORY_IRI =
  `${SFLO_NAMESPACE}currentArtifactHistory`;
const SFLO_DIGITAL_ARTIFACT_IRI = `${SFLO_NAMESPACE}DigitalArtifact`;
const SFLO_HAS_ARTIFACT_HISTORY_IRI = `${SFLO_NAMESPACE}hasArtifactHistory`;
const SFLO_HAS_HISTORICAL_STATE_IRI = `${SFLO_NAMESPACE}hasHistoricalState`;
const SFLO_HAS_KNOP_IRI = `${SFLO_NAMESPACE}hasKnop`;
const SFLO_LOCATED_FILE_FOR_MANIFESTATION_IRI =
  `${SFLO_NAMESPACE}locatedFileForManifestation`;
const SFLO_HAS_MANIFESTATION_IRI = `${SFLO_NAMESPACE}hasManifestation`;
const SFLO_HAS_MESH_INVENTORY_IRI = `${SFLO_NAMESPACE}hasMeshInventory`;
const SFLO_HAS_MESH_METADATA_IRI = `${SFLO_NAMESPACE}hasMeshMetadata`;
const SFLO_HAS_RESOURCE_PAGE_IRI = `${SFLO_NAMESPACE}hasResourcePage`;
const SFLO_HAS_WORKING_LOCATED_FILE_IRI =
  `${SFLO_NAMESPACE}hasWorkingLocatedFile`;
const SFLO_HAS_WORKING_KNOP_INVENTORY_FILE_IRI =
  `${SFLO_NAMESPACE}hasWorkingKnopInventoryFile`;
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
  foundingData?: Uint8Array;
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
  createdBinaryFiles?: readonly PlannedBinaryFile[];
  updatedFiles: readonly PlannedFile[];
  foundingReferentDataIri?: string;
  foundingWorkingLocatedFilePath?: string;
}

interface ResolvedKnopCreateMeshInventoryShape {
  preparedCurrentInventory: PreparedCurrentInventory;
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
  const founding = request.foundingData === undefined
    ? undefined
    : validateFoundingReferentData({
      meshBase,
      designatorPath,
      bytes: request.foundingData,
    });
  const foundingPath = founding === undefined
    ? undefined
    : toFoundingReferentDataPath(designatorPath);
  const foundingWorkingPath = foundingPath === undefined
    ? undefined
    : `${foundingPath}/data.ttl`;
  const updatedMeshInventoryTurtle = renderUpdatedMeshInventoryTurtle(
    meshBase,
    request.currentMeshInventoryTurtle,
    knopPath,
  );

  return {
    meshBase,
    designatorPath,
    knopIri: new URL(knopPath, meshBase).href,
    ...(foundingPath === undefined ? {} : {
      foundingReferentDataIri: new URL(foundingPath, meshBase).href,
      foundingWorkingLocatedFilePath: foundingWorkingPath,
    }),
    createdFiles: [
      {
        path: `${knopPath}/_meta/meta.ttl`,
        contents: renderKnopMetadataTurtle(meshBase, designatorPath),
      },
      {
        path: knopInventoryPath,
        contents: renderKnopInventoryTurtle(meshBase, knopPath, founding),
      },
    ],
    ...(founding === undefined ? {} : {
      createdBinaryFiles: [{
        path: foundingWorkingPath!,
        contents: founding.bytes,
      }],
    }),
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
${SFLO_TURTLE_PREFIX_DECLARATION}

<${knopPath}> a sflo:Knop ;
  sflo:designatorPath "${designatorPath}" ;
  sflo:hasWorkingKnopInventoryFile <${knopPath}/_inventory/inventory.ttl> .
`;
}

function renderKnopInventoryTurtle(
  meshBase: string,
  knopPath: string,
  founding?: ValidatedFoundingReferentData,
): string {
  const baseInventory = `@base <${meshBase}> .
${SFLO_TURTLE_PREFIX_DECLARATION}

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
  if (founding === undefined) return baseInventory;

  const foundingPath = `${knopPath}/_founding`;
  const foundingFilePath = `${foundingPath}/data.ttl`;
  const prepared = prepareCurrentInventory({
    baseIri: meshBase,
    currentInventoryTurtle: baseInventory,
    currentInventoryLabel: "new KnopInventory for knop create",
  });
  const plan = planInventoryAppend({
    preparedCurrentInventory: prepared,
    requestedSettledFactsTurtle: `@base <${meshBase}> .
${SFLO_TURTLE_PREFIX_DECLARATION}

<${knopPath}> sflo:hasFoundingReferentData <${foundingPath}> .

<${foundingPath}> a sflo:FoundingReferentData, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasWorkingLocatedFile <${foundingFilePath}> .

<${foundingFilePath}> a sflo:LocatedFile, sflo:RdfDocument .
`,
    singleValuedSettledPredicates: [
      `${SFLO_NAMESPACE}hasFoundingReferentData`,
      SFLO_HAS_WORKING_LOCATED_FILE_IRI,
    ],
    requestedFactsLabel: `founding referent data facts for ${knopPath}`,
  });
  if (plan.kind === "conflict") {
    throw new KnopCreateInputError(
      "Founding referent data facts conflict in the new KnopInventory.",
    );
  }
  return renderInventoryAppendPlan({
    preparedCurrentInventory: prepared,
    plan,
    outputLabel: `founding referent data inventory append for ${knopPath}`,
  });
}

function renderUpdatedMeshInventoryTurtle(
  meshBase: string,
  currentMeshInventoryTurtle: string,
  knopPath: string,
): string {
  const shape = resolveCurrentMeshInventoryShapeForKnopCreate(
    meshBase,
    currentMeshInventoryTurtle,
    knopPath,
  );
  return renderKnopCreatedMeshInventoryTurtle(
    knopPath,
    shape.preparedCurrentInventory,
  );
}

function resolveCurrentMeshInventoryShapeForKnopCreate(
  meshBase: string,
  currentMeshInventoryTurtle: string,
  knopPath: string,
): ResolvedKnopCreateMeshInventoryShape {
  const errorMessage =
    `current mesh inventory has an unsupported carried shape for knop create: ${knopPath}`;
  let preparedCurrentInventory: PreparedCurrentInventory;
  try {
    preparedCurrentInventory = prepareCurrentInventory({
      baseIri: meshBase,
      currentInventoryTurtle: currentMeshInventoryTurtle,
      currentInventoryLabel: "current MeshInventory for knop create",
    });
  } catch {
    throw new KnopCreateInputError(errorMessage);
  }
  const inventory = new KnopCreateInventoryIndex(
    preparedCurrentInventory.quads,
  );

  if (
    !hasNamedNodeFact(
      inventory,
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
    inventory,
    meshBase,
    SFLO_KNOP_IRI,
  );
  if (existingKnopPaths.includes(knopPath)) {
    throw new KnopCreateInputError(
      `mesh inventory already registers knop: ${knopPath}`,
    );
  }

  const hasAnyKnopFacts = hasPredicateForSubject(
    inventory,
    meshBase,
    "_mesh",
    SFLO_HAS_KNOP_IRI,
  );

  if (!hasAnyKnopFacts && existingKnopPaths.length === 0) {
    try {
      assertHasLegacyCurrentMeshInventoryShapeForKnopCreate(
        inventory,
        meshBase,
        errorMessage,
      );
      return {
        preparedCurrentInventory,
      };
    } catch (error) {
      if (!(error instanceof KnopCreateInputError)) {
        throw error;
      }
    }

    assertHasWorkingCurrentMeshInventoryShapeForKnopCreate(
      inventory,
      meshBase,
      errorMessage,
    );
    return {
      preparedCurrentInventory,
    };
  }

  assertHasCarriedCurrentMeshInventoryShapeForKnopCreate(
    inventory,
    meshBase,
    errorMessage,
    existingKnopPaths,
  );
  return {
    preparedCurrentInventory,
  };
}

function assertHasWorkingCurrentMeshInventoryShapeForKnopCreate(
  inventory: KnopCreateInventoryIndex,
  meshBase: string,
  errorMessage: string,
): void {
  assertHasNamedNodeFacts(inventory, meshBase, errorMessage, [
    ["_mesh", RDF_TYPE_IRI, SFLO_SEMANTIC_MESH_IRI],
    ["_mesh", SFLO_HAS_MESH_METADATA_IRI, "_mesh/_meta"],
    ["_mesh", SFLO_HAS_MESH_INVENTORY_IRI, "_mesh/_inventory"],
    ["_mesh", SFLO_HAS_RESOURCE_PAGE_IRI, "_mesh/index.html"],
    ["_mesh/_meta", RDF_TYPE_IRI, SFLO_MESH_METADATA_IRI],
    ["_mesh/_meta", RDF_TYPE_IRI, SFLO_DIGITAL_ARTIFACT_IRI],
    ["_mesh/_meta", RDF_TYPE_IRI, SFLO_RDF_DOCUMENT_IRI],
    ["_mesh/_meta", SFLO_HAS_WORKING_LOCATED_FILE_IRI, "_mesh/_meta/meta.ttl"],
    ["_mesh/_meta", SFLO_HAS_RESOURCE_PAGE_IRI, "_mesh/_meta/index.html"],
    ["_mesh/_inventory", RDF_TYPE_IRI, SFLO_MESH_INVENTORY_IRI],
    ["_mesh/_inventory", RDF_TYPE_IRI, SFLO_DIGITAL_ARTIFACT_IRI],
    ["_mesh/_inventory", RDF_TYPE_IRI, SFLO_RDF_DOCUMENT_IRI],
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
    ["_mesh/_meta/meta.ttl", RDF_TYPE_IRI, SFLO_LOCATED_FILE_IRI],
    ["_mesh/_meta/meta.ttl", RDF_TYPE_IRI, SFLO_RDF_DOCUMENT_IRI],
    ["_mesh/_inventory/inventory.ttl", RDF_TYPE_IRI, SFLO_LOCATED_FILE_IRI],
    ["_mesh/_inventory/inventory.ttl", RDF_TYPE_IRI, SFLO_RDF_DOCUMENT_IRI],
    ["_mesh/index.html", RDF_TYPE_IRI, SFLO_RESOURCE_PAGE_IRI],
    ["_mesh/index.html", RDF_TYPE_IRI, SFLO_LOCATED_FILE_IRI],
    ["_mesh/_meta/index.html", RDF_TYPE_IRI, SFLO_RESOURCE_PAGE_IRI],
    ["_mesh/_meta/index.html", RDF_TYPE_IRI, SFLO_LOCATED_FILE_IRI],
    ["_mesh/_inventory/index.html", RDF_TYPE_IRI, SFLO_RESOURCE_PAGE_IRI],
    ["_mesh/_inventory/index.html", RDF_TYPE_IRI, SFLO_LOCATED_FILE_IRI],
  ]);
  assertHasLiteralFacts(inventory, meshBase, errorMessage, [
    ["_mesh", SFLO_MESH_BASE_IRI, meshBase, XSD_ANY_URI_IRI],
  ]);
}

function assertHasLegacyCurrentMeshInventoryShapeForKnopCreate(
  inventory: KnopCreateInventoryIndex,
  meshBase: string,
  errorMessage: string,
): void {
  assertHasNamedNodeFacts(inventory, meshBase, errorMessage, [
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
      "_mesh/_meta/_history001/_s0001/ttl",
    ],
    [
      "_mesh/_meta/_history001/_s0001",
      SFLO_LOCATED_FILE_FOR_STATE_IRI,
      "_mesh/_meta/_history001/_s0001/ttl/meta.ttl",
    ],
    [
      "_mesh/_meta/_history001/_s0001",
      SFLO_HAS_RESOURCE_PAGE_IRI,
      "_mesh/_meta/_history001/_s0001/index.html",
    ],
    [
      "_mesh/_meta/_history001/_s0001/ttl",
      RDF_TYPE_IRI,
      SFLO_ARTIFACT_MANIFESTATION_IRI,
    ],
    [
      "_mesh/_meta/_history001/_s0001/ttl",
      RDF_TYPE_IRI,
      SFLO_RDF_DOCUMENT_IRI,
    ],
    [
      "_mesh/_meta/_history001/_s0001/ttl",
      SFLO_LOCATED_FILE_FOR_MANIFESTATION_IRI,
      "_mesh/_meta/_history001/_s0001/ttl/meta.ttl",
    ],
    [
      "_mesh/_meta/_history001/_s0001/ttl",
      SFLO_HAS_RESOURCE_PAGE_IRI,
      "_mesh/_meta/_history001/_s0001/ttl/index.html",
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
      "_mesh/_inventory/_history001/_s0001/ttl",
    ],
    [
      "_mesh/_inventory/_history001/_s0001",
      SFLO_LOCATED_FILE_FOR_STATE_IRI,
      "_mesh/_inventory/_history001/_s0001/ttl/inventory.ttl",
    ],
    [
      "_mesh/_inventory/_history001/_s0001",
      SFLO_HAS_RESOURCE_PAGE_IRI,
      "_mesh/_inventory/_history001/_s0001/index.html",
    ],
    [
      "_mesh/_inventory/_history001/_s0001/ttl",
      RDF_TYPE_IRI,
      SFLO_ARTIFACT_MANIFESTATION_IRI,
    ],
    [
      "_mesh/_inventory/_history001/_s0001/ttl",
      RDF_TYPE_IRI,
      SFLO_RDF_DOCUMENT_IRI,
    ],
    [
      "_mesh/_inventory/_history001/_s0001/ttl",
      SFLO_LOCATED_FILE_FOR_MANIFESTATION_IRI,
      "_mesh/_inventory/_history001/_s0001/ttl/inventory.ttl",
    ],
    [
      "_mesh/_inventory/_history001/_s0001/ttl",
      SFLO_HAS_RESOURCE_PAGE_IRI,
      "_mesh/_inventory/_history001/_s0001/ttl/index.html",
    ],
    ["_mesh/_meta/meta.ttl", RDF_TYPE_IRI, SFLO_LOCATED_FILE_IRI],
    ["_mesh/_meta/meta.ttl", RDF_TYPE_IRI, SFLO_RDF_DOCUMENT_IRI],
    ["_mesh/_inventory/inventory.ttl", RDF_TYPE_IRI, SFLO_LOCATED_FILE_IRI],
    ["_mesh/_inventory/inventory.ttl", RDF_TYPE_IRI, SFLO_RDF_DOCUMENT_IRI],
    [
      "_mesh/_meta/_history001/_s0001/ttl/meta.ttl",
      RDF_TYPE_IRI,
      SFLO_LOCATED_FILE_IRI,
    ],
    [
      "_mesh/_meta/_history001/_s0001/ttl/meta.ttl",
      RDF_TYPE_IRI,
      SFLO_RDF_DOCUMENT_IRI,
    ],
    [
      "_mesh/_inventory/_history001/_s0001/ttl/inventory.ttl",
      RDF_TYPE_IRI,
      SFLO_LOCATED_FILE_IRI,
    ],
    [
      "_mesh/_inventory/_history001/_s0001/ttl/inventory.ttl",
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
      "_mesh/_meta/_history001/_s0001/ttl/index.html",
      RDF_TYPE_IRI,
      SFLO_RESOURCE_PAGE_IRI,
    ],
    [
      "_mesh/_meta/_history001/_s0001/ttl/index.html",
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
      "_mesh/_inventory/_history001/_s0001/ttl/index.html",
      RDF_TYPE_IRI,
      SFLO_RESOURCE_PAGE_IRI,
    ],
    [
      "_mesh/_inventory/_history001/_s0001/ttl/index.html",
      RDF_TYPE_IRI,
      SFLO_LOCATED_FILE_IRI,
    ],
  ]);
  assertHasLiteralFacts(inventory, meshBase, errorMessage, [
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

function assertHasCarriedCurrentMeshInventoryShapeForKnopCreate(
  inventory: KnopCreateInventoryIndex,
  meshBase: string,
  errorMessage: string,
  existingKnopPaths: readonly string[],
): void {
  assertHasNamedNodeFacts(inventory, meshBase, errorMessage, [
    ["_mesh", RDF_TYPE_IRI, SFLO_SEMANTIC_MESH_IRI],
    ["_mesh", SFLO_HAS_MESH_METADATA_IRI, "_mesh/_meta"],
    ["_mesh", SFLO_HAS_MESH_INVENTORY_IRI, "_mesh/_inventory"],
    ["_mesh", SFLO_HAS_RESOURCE_PAGE_IRI, "_mesh/index.html"],
    ["_mesh/_inventory", RDF_TYPE_IRI, SFLO_MESH_INVENTORY_IRI],
    ["_mesh/_inventory", RDF_TYPE_IRI, SFLO_DIGITAL_ARTIFACT_IRI],
    ["_mesh/_inventory", RDF_TYPE_IRI, SFLO_RDF_DOCUMENT_IRI],
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
  ]);

  if (existingKnopPaths.length === 0) {
    throw new KnopCreateInputError(errorMessage);
  }

  for (const existingKnopPath of existingKnopPaths) {
    if (
      !hasNamedNodeFact(
        inventory,
        meshBase,
        "_mesh",
        SFLO_HAS_KNOP_IRI,
        existingKnopPath,
      )
    ) {
      throw new KnopCreateInputError(errorMessage);
    }
  }

  const hasInventoryHistoryBlock = hasNamedNodeFact(
    inventory,
    meshBase,
    "_mesh/_inventory/_history001",
    RDF_TYPE_IRI,
    SFLO_ARTIFACT_HISTORY_IRI,
  );
  const hasInventoryHistoryLink = hasNamedNodeFact(
    inventory,
    meshBase,
    "_mesh/_inventory",
    SFLO_HAS_ARTIFACT_HISTORY_IRI,
    "_mesh/_inventory/_history001",
  );
  const latestStatePath = resolveSingleNamedNodePath(
    inventory,
    meshBase,
    "_mesh/_inventory/_history001",
    SFLO_LATEST_HISTORICAL_STATE_IRI,
    errorMessage,
  );
  const nextStateOrdinal = resolveSingleNonNegativeIntegerLiteral(
    inventory,
    meshBase,
    "_mesh/_inventory/_history001",
    SFLO_NEXT_STATE_ORDINAL_IRI,
    errorMessage,
  );
  if (latestStatePath !== undefined || nextStateOrdinal !== undefined) {
    if (!hasInventoryHistoryBlock || !hasInventoryHistoryLink) {
      throw new KnopCreateInputError(errorMessage);
    }
    if (latestStatePath === undefined || nextStateOrdinal === undefined) {
      throw new KnopCreateInputError(errorMessage);
    }

    const latestStateOrdinal = parseStateOrdinalFromPath(
      latestStatePath,
      errorMessage,
    );
    if (
      toHistoryPathFromStatePath(latestStatePath) !==
        "_mesh/_inventory/_history001" ||
      nextStateOrdinal !== latestStateOrdinal + 1
    ) {
      throw new KnopCreateInputError(errorMessage);
    }

    if (
      !hasNamedNodeFact(
        inventory,
        meshBase,
        latestStatePath,
        RDF_TYPE_IRI,
        SFLO_HISTORICAL_STATE_IRI,
      )
    ) {
      throw new KnopCreateInputError(errorMessage);
    }
    return;
  }

  const historicalStatePaths = listNamedNodeObjectPaths(
    inventory,
    meshBase,
    "_mesh/_inventory/_history001",
    SFLO_HAS_HISTORICAL_STATE_IRI,
  );
  if (
    latestStatePath === undefined &&
    nextStateOrdinal === undefined &&
    historicalStatePaths.length === 0
  ) {
    if (hasInventoryHistoryBlock || hasInventoryHistoryLink) {
      throw new KnopCreateInputError(errorMessage);
    }
    return;
  }

  if (!hasInventoryHistoryBlock || !hasInventoryHistoryLink) {
    throw new KnopCreateInputError(errorMessage);
  }

  if (historicalStatePaths.length === 0) {
    throw new KnopCreateInputError(errorMessage);
  }

  for (const historicalStatePath of historicalStatePaths) {
    parseStateOrdinalFromPath(historicalStatePath, errorMessage);
    if (
      toHistoryPathFromStatePath(historicalStatePath) !==
        "_mesh/_inventory/_history001" ||
      !hasNamedNodeFact(
        inventory,
        meshBase,
        historicalStatePath,
        RDF_TYPE_IRI,
        SFLO_HISTORICAL_STATE_IRI,
      )
    ) {
      throw new KnopCreateInputError(errorMessage);
    }
  }
}

function renderKnopCreatedMeshInventoryTurtle(
  knopPath: string,
  preparedCurrentInventory: PreparedCurrentInventory,
): string {
  const plan = planKnopCreateMeshInventoryAppend({
    knopPath,
    preparedCurrentInventory,
  });
  if (plan.kind === "conflict") {
    throw new KnopCreateInputError(
      `Could not append knop create MeshInventory facts for ${knopPath}: ${
        plan.conflicts.map((conflict) => conflict.message).join(" ")
      }`,
    );
  }

  return renderInventoryAppendPlan({
    preparedCurrentInventory,
    plan,
    outputLabel: `knop create MeshInventory append for ${knopPath}`,
  });
}

function planKnopCreateMeshInventoryAppend(input: {
  knopPath: string;
  preparedCurrentInventory: PreparedCurrentInventory;
}): ReturnType<typeof planInventoryAppend> {
  const meshBase = input.preparedCurrentInventory.baseIri;
  const knopInventoryPath = `${input.knopPath}/_inventory/inventory.ttl`;
  const requestedSettledFactsTurtle = `@base <${meshBase}> .
${SFLO_TURTLE_PREFIX_DECLARATION}

<_mesh> sflo:hasKnop <${input.knopPath}> .

<${input.knopPath}> a sflo:Knop ;
  sflo:hasWorkingKnopInventoryFile <${knopInventoryPath}> .

<${knopInventoryPath}> a sflo:LocatedFile, sflo:RdfDocument .
`;

  return planInventoryAppend({
    preparedCurrentInventory: input.preparedCurrentInventory,
    requestedSettledFactsTurtle,
    singleValuedSettledPredicates: [
      SFLO_HAS_WORKING_KNOP_INVENTORY_FILE_IRI,
    ],
    currentInventoryLabel: "current MeshInventory for knop create",
    requestedFactsLabel: `knop create facts for ${input.knopPath}`,
  });
}

function assertHasNamedNodeFacts(
  inventory: KnopCreateInventoryIndex,
  meshBase: string,
  errorMessage: string,
  facts: readonly (readonly [string, string, string])[],
): void {
  for (const [subjectValue, predicateIri, objectValue] of facts) {
    if (
      !hasNamedNodeFact(
        inventory,
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
  inventory: KnopCreateInventoryIndex,
  meshBase: string,
  errorMessage: string,
  facts: readonly (readonly [string, string, string, string])[],
): void {
  for (const [subjectValue, predicateIri, literalValue, datatypeIri] of facts) {
    if (
      !hasLiteralFact(
        inventory,
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
  inventory: KnopCreateInventoryIndex,
  meshBase: string,
  subjectValue: string,
  predicateIri: string,
  objectValue: string,
): boolean {
  const subjectIri = new URL(subjectValue, meshBase).href;
  const objectIri = new URL(objectValue, meshBase).href;

  return inventory.hasNamedNodeFact(subjectIri, predicateIri, objectIri);
}

function hasLiteralFact(
  inventory: KnopCreateInventoryIndex,
  meshBase: string,
  subjectValue: string,
  predicateIri: string,
  literalValue: string,
  datatypeIri: string,
): boolean {
  const subjectIri = new URL(subjectValue, meshBase).href;

  return inventory.hasLiteralFact(
    subjectIri,
    predicateIri,
    literalValue,
    datatypeIri,
  );
}

function hasPredicateForSubject(
  inventory: KnopCreateInventoryIndex,
  meshBase: string,
  subjectValue: string,
  predicateIri: string,
): boolean {
  const subjectIri = new URL(subjectValue, meshBase).href;

  return inventory.hasSubjectPredicate(subjectIri, predicateIri);
}

function listTypedSubjectPaths(
  inventory: KnopCreateInventoryIndex,
  meshBase: string,
  typeIri: string,
): string[] {
  const paths = new Set<string>();

  for (const subjectIri of inventory.listTypedSubjectIris(typeIri)) {
    const path = toRelativeMeshPath(meshBase, subjectIri);
    if (path !== undefined) {
      paths.add(path);
    }
  }

  return [...paths];
}

function listNamedNodeObjectPaths(
  inventory: KnopCreateInventoryIndex,
  meshBase: string,
  subjectValue: string,
  predicateIri: string,
): string[] {
  const subjectIri = new URL(subjectValue, meshBase).href;
  const paths = new Set<string>();

  for (
    const objectIri of inventory.listNamedNodeObjectIris(
      subjectIri,
      predicateIri,
    )
  ) {
    const path = toRelativeMeshPath(meshBase, objectIri);
    if (path === undefined) {
      throw new KnopCreateInputError(
        `current mesh inventory references an out-of-mesh path for ${subjectValue}`,
      );
    }
    paths.add(path);
  }

  return [...paths];
}

function resolveSingleNamedNodePath(
  inventory: KnopCreateInventoryIndex,
  meshBase: string,
  subjectValue: string,
  predicateIri: string,
  errorMessage: string,
): string | undefined {
  const subjectIri = new URL(subjectValue, meshBase).href;
  const matches = inventory.listNamedNodeObjectIris(
    subjectIri,
    predicateIri,
  );
  if (matches.length === 0) {
    return undefined;
  }
  if (matches.length !== 1) {
    throw new KnopCreateInputError(errorMessage);
  }

  const path = toRelativeMeshPath(meshBase, matches[0]!);
  if (path === undefined) {
    throw new KnopCreateInputError(errorMessage);
  }
  return path;
}

function resolveSingleNonNegativeIntegerLiteral(
  inventory: KnopCreateInventoryIndex,
  meshBase: string,
  subjectValue: string,
  predicateIri: string,
  errorMessage: string,
): number | undefined {
  const subjectIri = new URL(subjectValue, meshBase).href;
  const matches = inventory.listLiteralObjects(
    subjectIri,
    predicateIri,
  ).filter(
    (literal) => literal.datatypeIri === XSD_NON_NEGATIVE_INTEGER_IRI,
  );
  if (matches.length === 0) {
    return undefined;
  }
  if (matches.length !== 1) {
    throw new KnopCreateInputError(errorMessage);
  }

  const parsed = Number.parseInt(matches[0]!.value, 10);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new KnopCreateInputError(errorMessage);
  }

  return parsed;
}

function parseStateOrdinalFromPath(path: string, errorMessage: string): number {
  const segment = path.split("/").pop();
  if (!segment || !/^_s\d{4}$/.test(segment)) {
    throw new KnopCreateInputError(errorMessage);
  }

  return Number.parseInt(segment.slice(2), 10);
}

function toHistoryPathFromStatePath(statePath: string): string {
  return statePath.slice(0, statePath.lastIndexOf("/"));
}

function toRelativeMeshPath(
  meshBase: string,
  absoluteIri: string,
): string | undefined {
  return absoluteIri.startsWith(meshBase)
    ? absoluteIri.slice(meshBase.length)
    : undefined;
}
