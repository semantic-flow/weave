import { Parser } from "n3";
import type { Quad } from "n3";
import type { PlannedFile } from "../planned_file.ts";
import {
  appendMeshPath,
  formatDesignatorPathForDisplay,
  isDirectChildMeshPath,
  toDesignatorResourcePagePath,
  toKnopPath,
  toReferenceCatalogPath,
} from "../designator_segments.ts";
import {
  type NormalizedVersionTargetSpec,
  normalizeVersionTargetSpecs,
  resolveTargetSelections,
  type TargetSpec,
  type VersionTargetSpec,
} from "../targeting.ts";
import {
  deriveMeshLabel,
  escapeHtml,
  toRelativeHref,
  toResourcePath,
} from "./html.ts";

const RDF_TYPE_IRI = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type";
const SFC_NAMESPACE = "https://semantic-flow.github.io/ontology/core/";
const XSD_NON_NEGATIVE_INTEGER_IRI =
  "http://www.w3.org/2001/XMLSchema#nonNegativeInteger";
const SFLO_NAMESPACE =
  "https://semantic-flow.github.io/semantic-flow-ontology/";
const SFC_HAS_KNOP_ASSET_BUNDLE_IRI = `${SFC_NAMESPACE}hasKnopAssetBundle`;
const SFC_HAS_RESOURCE_PAGE_DEFINITION_IRI =
  `${SFC_NAMESPACE}hasResourcePageDefinition`;
const SFC_KNOP_ASSET_BUNDLE_IRI = `${SFC_NAMESPACE}KnopAssetBundle`;
const SFC_RESOURCE_PAGE_DEFINITION_IRI =
  `${SFC_NAMESPACE}ResourcePageDefinition`;
const SFLO_CURRENT_ARTIFACT_HISTORY_IRI =
  `${SFLO_NAMESPACE}currentArtifactHistory`;
const SFLO_DESIGNATOR_PATH_IRI = `${SFLO_NAMESPACE}designatorPath`;
const SFLO_DIGITAL_ARTIFACT_IRI = `${SFLO_NAMESPACE}DigitalArtifact`;
const SFLO_HAS_ARTIFACT_HISTORY_IRI = `${SFLO_NAMESPACE}hasArtifactHistory`;
const SFLO_HAS_KNOP_IRI = `${SFLO_NAMESPACE}hasKnop`;
const SFLO_HAS_HISTORICAL_STATE_IRI = `${SFLO_NAMESPACE}hasHistoricalState`;
const SFLO_HAS_KNOP_INVENTORY_IRI = `${SFLO_NAMESPACE}hasKnopInventory`;
const SFLO_HAS_KNOP_METADATA_IRI = `${SFLO_NAMESPACE}hasKnopMetadata`;
const SFLO_HAS_PAYLOAD_ARTIFACT_IRI = `${SFLO_NAMESPACE}hasPayloadArtifact`;
const SFLO_HAS_REFERENCE_CATALOG_IRI = `${SFLO_NAMESPACE}hasReferenceCatalog`;
const SFLO_HAS_REFERENCE_LINK_IRI = `${SFLO_NAMESPACE}hasReferenceLink`;
const SFLO_HAS_REFERENCE_ROLE_IRI = `${SFLO_NAMESPACE}hasReferenceRole`;
const SFLO_HAS_RESOURCE_PAGE_IRI = `${SFLO_NAMESPACE}hasResourcePage`;
const SFLO_HAS_WORKING_KNOP_INVENTORY_FILE_IRI =
  `${SFLO_NAMESPACE}hasWorkingKnopInventoryFile`;
const SFLO_HAS_WORKING_LOCATED_FILE_IRI =
  `${SFLO_NAMESPACE}hasWorkingLocatedFile`;
const SFLO_KNOP_IRI = `${SFLO_NAMESPACE}Knop`;
const SFLO_KNOP_INVENTORY_IRI = `${SFLO_NAMESPACE}KnopInventory`;
const SFLO_KNOP_METADATA_IRI = `${SFLO_NAMESPACE}KnopMetadata`;
const SFLO_LATEST_HISTORICAL_STATE_IRI =
  `${SFLO_NAMESPACE}latestHistoricalState`;
const SFLO_MESH_INVENTORY_IRI = `${SFLO_NAMESPACE}MeshInventory`;
const SFLO_NEXT_STATE_ORDINAL_IRI = `${SFLO_NAMESPACE}nextStateOrdinal`;
const SFLO_PAYLOAD_ARTIFACT_IRI = `${SFLO_NAMESPACE}PayloadArtifact`;
const SFLO_RDF_DOCUMENT_IRI = `${SFLO_NAMESPACE}RdfDocument`;
const SFLO_REFERENCE_CATALOG_IRI = `${SFLO_NAMESPACE}ReferenceCatalog`;
const SFLO_REFERENCE_LINK_FOR_IRI = `${SFLO_NAMESPACE}referenceLinkFor`;
const SFLO_REFERENCE_LINK_IRI = `${SFLO_NAMESPACE}ReferenceLink`;
const SFLO_REFERENCE_TARGET_IRI = `${SFLO_NAMESPACE}referenceTarget`;
const SFLO_REFERENCE_TARGET_STATE_IRI = `${SFLO_NAMESPACE}referenceTargetState`;

export interface WeaveRequest {
  targets?: readonly VersionTargetSpec[];
}

export interface ValidateRequest {
  targets?: readonly TargetSpec[];
}

export interface GenerateRequest {
  targets?: readonly TargetSpec[];
}

export interface VersionRequest {
  targets?: readonly VersionTargetSpec[];
}

export interface PayloadWorkingArtifact {
  workingFilePath: string;
  currentPayloadTurtle: string;
  currentArtifactHistoryPath?: string;
  latestHistoricalSnapshotTurtle?: string;
  latestHistoricalStatePath?: string;
}

export interface ReferenceCatalogWorkingArtifact {
  workingFilePath: string;
  currentReferenceCatalogTurtle: string;
}

export interface ReferenceTargetSourcePayloadArtifact {
  designatorPath: string;
  workingFilePath: string;
  currentPayloadTurtle: string;
  latestHistoricalStatePath: string;
}

export interface ResourcePageDefinitionWorkingArtifact {
  artifactPath: string;
  workingFilePath: string;
  currentPageDefinitionTurtle: string;
  currentArtifactHistoryPath?: string;
  currentArtifactHistoryExists: boolean;
  latestHistoricalStatePath?: string;
  assetBundlePath?: string;
}

export interface WeaveableKnopCandidate {
  designatorPath: string;
  currentKnopMetadataTurtle: string;
  currentKnopInventoryTurtle: string;
  payloadArtifact?: PayloadWorkingArtifact;
  referenceCatalogArtifact?: ReferenceCatalogWorkingArtifact;
  referenceTargetSourcePayloadArtifact?: ReferenceTargetSourcePayloadArtifact;
  resourcePageDefinitionArtifact?: ResourcePageDefinitionWorkingArtifact;
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

export interface ReferenceCatalogCurrentLinkModel {
  fragment: string;
  referenceRoleLabel: string;
  referenceTargetPath: string;
  referenceTargetStatePath?: string;
}

export interface ReferenceCatalogResourcePageModel {
  kind: "referenceCatalog";
  path: string;
  catalogPath: string;
  ownerDesignatorPath: string;
  currentLinks: readonly ReferenceCatalogCurrentLinkModel[];
}

export interface CustomIdentifierRegionResourcePageModel {
  key: string;
  markdown: string;
  sourcePath: string;
}

export interface CustomIdentifierResourcePageModel {
  kind: "customIdentifier";
  path: string;
  designatorPath: string;
  definitionPath: string;
  stylesheetPaths: readonly string[];
  regions: readonly CustomIdentifierRegionResourcePageModel[];
}

export type ResourcePageModel =
  | IdentifierResourcePageModel
  | SimpleResourcePageModel
  | ReferenceCatalogResourcePageModel
  | CustomIdentifierResourcePageModel;

export interface PlanWeaveInput {
  request: VersionRequest;
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

export interface VersionPlan {
  meshBase: string;
  versionedDesignatorPaths: readonly string[];
  createdFiles: readonly PlannedFile[];
  updatedFiles: readonly PlannedFile[];
}

export class WeaveInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WeaveInputError";
  }
}

interface SelectedWeaveableKnopCandidate {
  candidate: WeaveableKnopCandidate;
  target?: NormalizedVersionTargetSpec;
}

interface PayloadVersionLayout {
  historyPath: string;
  currentStatePath?: string;
  nextStatePath: string;
}

export type WeaveSlice =
  | "firstKnopWeave"
  | "firstPayloadWeave"
  | "firstExtractedKnopWeave"
  | "firstReferenceCatalogWeave"
  | "firstPageDefinitionWeave"
  | "secondPayloadWeave";

export function planWeave(input: PlanWeaveInput): WeavePlan {
  const meshBase = normalizeMeshBase(input.meshBase);
  const requestedTargets = normalizeVersionTargetSpecs(
    input.request.targets,
    "request.targets",
    (message) => new WeaveInputError(message),
  );
  const weaveableKnops = filterWeaveableKnops(
    input.weaveableKnops,
    requestedTargets,
  );

  if (weaveableKnops.length === 0) {
    throw new WeaveInputError("No weave candidates were found.");
  }
  if (weaveableKnops.length !== 1) {
    throw new WeaveInputError(
      `The current local weave slice supports exactly one weave candidate; found ${weaveableKnops.length}.`,
    );
  }

  const selection = weaveableKnops[0]!;
  const candidate = selection.candidate;
  const target = selection.target;
  const designatorPath = candidate.designatorPath;
  const knopPath = toKnopPath(designatorPath);

  assertCurrentKnopMetadataShape(
    meshBase,
    candidate.currentKnopMetadataTurtle,
    designatorPath,
    knopPath,
  );
  assertCurrentKnopInventoryBaseShape(
    meshBase,
    candidate.currentKnopInventoryTurtle,
    knopPath,
  );

  const slice = classifyWeaveSlice(meshBase, candidate);
  assertPayloadNamingSupportedForSlice(slice, designatorPath, target);

  switch (slice) {
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
        target,
      );
    case "firstExtractedKnopWeave":
      return planFirstExtractedKnopWeave(
        meshBase,
        input.currentMeshInventoryTurtle,
        candidate,
      );
    case "firstReferenceCatalogWeave":
      return planFirstReferenceCatalogWeave(
        meshBase,
        input.currentMeshInventoryTurtle,
        candidate,
      );
    case "firstPageDefinitionWeave":
      return planFirstPageDefinitionWeave(
        meshBase,
        input.currentMeshInventoryTurtle,
        candidate,
      );
    case "secondPayloadWeave":
      return planSecondPayloadWeave(
        meshBase,
        input.currentMeshInventoryTurtle,
        candidate,
        target,
      );
    default:
      throw new WeaveInputError(
        `No supported local weave slice was found for ${designatorPath}.`,
      );
  }
}

export function planVersion(input: PlanWeaveInput): VersionPlan {
  const plan = planWeave(input);
  const createdFiles = plan.createdFiles.filter((file) =>
    !file.path.endsWith(".html")
  );
  const updatedFiles = plan.updatedFiles.filter((file) =>
    !file.path.endsWith(".html")
  );

  return {
    meshBase: plan.meshBase,
    versionedDesignatorPaths: plan.wovenDesignatorPaths,
    createdFiles,
    updatedFiles,
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

function filterWeaveableKnops(
  weaveableKnops: readonly WeaveableKnopCandidate[],
  requestedTargets: readonly NormalizedVersionTargetSpec[],
): readonly SelectedWeaveableKnopCandidate[] {
  if (requestedTargets.length === 0) {
    return weaveableKnops.map((candidate) => ({ candidate }));
  }

  const resolvedTargets = resolveTargetSelections(
    weaveableKnops.map((candidate) => candidate.designatorPath),
    requestedTargets,
    (message) => new WeaveInputError(message),
  );
  const targetByDesignatorPath = new Map(
    resolvedTargets.map((selection) => [
      selection.designatorPath,
      selection.target as NormalizedVersionTargetSpec | undefined,
    ]),
  );
  const filtered = weaveableKnops.flatMap((candidate) => {
    const target = targetByDesignatorPath.get(candidate.designatorPath);
    return target === undefined ? [] : [{ candidate, target }];
  });

  if (filtered.length === 0) {
    throw new WeaveInputError(
      "Requested targets did not match any weave candidates.",
    );
  }

  return filtered;
}

function classifyWeaveSlice(
  meshBase: string,
  candidate: WeaveableKnopCandidate,
): WeaveSlice | undefined {
  const slice = detectPendingWeaveSlice(
    meshBase,
    candidate.designatorPath,
    candidate.currentKnopInventoryTurtle,
  );

  if (
    slice === "firstExtractedKnopWeave" &&
    !candidate.referenceCatalogArtifact
  ) {
    throw new WeaveInputError(
      `Extracted weave candidate ${candidate.designatorPath} is missing working ReferenceCatalog state.`,
    );
  }

  if (
    slice === "firstExtractedKnopWeave" &&
    !candidate.referenceTargetSourcePayloadArtifact
  ) {
    throw new WeaveInputError(
      `Extracted weave candidate ${candidate.designatorPath} is missing its woven source payload state.`,
    );
  }

  if (
    slice === "firstReferenceCatalogWeave" &&
    !candidate.referenceCatalogArtifact
  ) {
    throw new WeaveInputError(
      `ReferenceCatalog weave candidate ${candidate.designatorPath} is missing working catalog state.`,
    );
  }

  if (
    slice === "firstPageDefinitionWeave" &&
    !candidate.resourcePageDefinitionArtifact
  ) {
    throw new WeaveInputError(
      `ResourcePageDefinition weave candidate ${candidate.designatorPath} is missing working page-definition state.`,
    );
  }

  if (slice === "firstPayloadWeave" && !candidate.payloadArtifact) {
    throw new WeaveInputError(
      `Payload weave candidate ${candidate.designatorPath} is missing working payload state.`,
    );
  }

  if (slice === "secondPayloadWeave" && !candidate.payloadArtifact) {
    throw new WeaveInputError(
      `Payload weave candidate ${candidate.designatorPath} is missing working payload state.`,
    );
  }

  return slice;
}

export function detectPendingWeaveSlice(
  meshBase: string,
  designatorPath: string,
  currentKnopInventoryTurtle: string,
): WeaveSlice | undefined {
  const knopPath = toKnopPath(designatorPath);
  const referenceCatalogPath = `${knopPath}/_references`;
  const pageDefinitionPath = `${knopPath}/_page`;
  const errorMessage =
    `Could not parse the current KnopInventory while detecting the pending weave slice for ${designatorPath}.`;
  const quads = parseWeaveShapeQuads(
    meshBase,
    currentKnopInventoryTurtle,
    errorMessage,
  );
  const payloadRelationship = hasNamedNodeFact(
    quads,
    meshBase,
    knopPath,
    SFLO_HAS_PAYLOAD_ARTIFACT_IRI,
    designatorPath,
  );
  const payloadHistoryPath = resolveOptionalNamedNodePath(
    quads,
    meshBase,
    designatorPath,
    SFLO_CURRENT_ARTIFACT_HISTORY_IRI,
    errorMessage,
  );
  const payloadAnyHistoryPath = payloadHistoryPath ??
    resolveOptionalNamedNodePath(
      quads,
      meshBase,
      designatorPath,
      SFLO_HAS_ARTIFACT_HISTORY_IRI,
      errorMessage,
    );
  const referenceCatalogRelationship = hasNamedNodeFact(
    quads,
    meshBase,
    knopPath,
    SFLO_HAS_REFERENCE_CATALOG_IRI,
    referenceCatalogPath,
  );
  const referenceCatalogHasHistory = hasNamedNodeFact(
    quads,
    meshBase,
    referenceCatalogPath,
    SFLO_HAS_ARTIFACT_HISTORY_IRI,
    `${referenceCatalogPath}/_history001`,
  );
  const pageDefinitionRelationship = hasNamedNodeFact(
    quads,
    meshBase,
    knopPath,
    SFC_HAS_RESOURCE_PAGE_DEFINITION_IRI,
    pageDefinitionPath,
  );
  const pageDefinitionHistoryPath = resolveOptionalNamedNodePath(
    quads,
    meshBase,
    pageDefinitionPath,
    SFLO_CURRENT_ARTIFACT_HISTORY_IRI,
    errorMessage,
  );
  const pageDefinitionAnyHistoryPath = pageDefinitionHistoryPath ??
    resolveOptionalNamedNodePath(
      quads,
      meshBase,
      pageDefinitionPath,
      SFLO_HAS_ARTIFACT_HISTORY_IRI,
      errorMessage,
    );
  const knopInventoryHasHistory = hasNamedNodeFact(
    quads,
    meshBase,
    `${knopPath}/_inventory`,
    SFLO_HAS_ARTIFACT_HISTORY_IRI,
    `${knopPath}/_inventory/_history001`,
  );

  if (referenceCatalogRelationship && !knopInventoryHasHistory) {
    return "firstExtractedKnopWeave";
  }

  if (
    referenceCatalogRelationship &&
    knopInventoryHasHistory &&
    !referenceCatalogHasHistory
  ) {
    return "firstReferenceCatalogWeave";
  }

  if (
    pageDefinitionRelationship &&
    !pageDefinitionAnyHistoryPath &&
    hasNamedNodeFact(
      quads,
      meshBase,
      `${knopPath}/_inventory/_history001`,
      SFLO_LATEST_HISTORICAL_STATE_IRI,
      `${knopPath}/_inventory/_history001/_s0002`,
    ) &&
    hasLiteralFact(
      quads,
      meshBase,
      `${knopPath}/_inventory/_history001`,
      SFLO_NEXT_STATE_ORDINAL_IRI,
      "3",
      XSD_NON_NEGATIVE_INTEGER_IRI,
    )
  ) {
    return "firstPageDefinitionWeave";
  }

  if (payloadRelationship && !payloadAnyHistoryPath) {
    return "firstPayloadWeave";
  }

  if (
    payloadRelationship &&
    payloadHistoryPath &&
    hasNamedNodeFact(
      quads,
      meshBase,
      payloadHistoryPath,
      SFLO_LATEST_HISTORICAL_STATE_IRI,
      requirePayloadCurrentStatePathFromInventory(
        quads,
        meshBase,
        designatorPath,
        payloadHistoryPath,
        errorMessage,
      ),
    ) &&
    hasNamedNodeFact(
      quads,
      meshBase,
      `${knopPath}/_inventory/_history001`,
      SFLO_LATEST_HISTORICAL_STATE_IRI,
      `${knopPath}/_inventory/_history001/_s0001`,
    ) &&
    hasLiteralFact(
      quads,
      meshBase,
      payloadHistoryPath,
      SFLO_NEXT_STATE_ORDINAL_IRI,
      "2",
      XSD_NON_NEGATIVE_INTEGER_IRI,
    ) &&
    !hasNamedNodeFact(
      quads,
      meshBase,
      `${knopPath}/_inventory/_history001`,
      SFLO_HAS_HISTORICAL_STATE_IRI,
      `${knopPath}/_inventory/_history001/_s0002`,
    )
  ) {
    return "secondPayloadWeave";
  }

  if (!knopInventoryHasHistory) {
    return "firstKnopWeave";
  }

  return undefined;
}

function assertPayloadNamingSupportedForSlice(
  slice: WeaveSlice | undefined,
  designatorPath: string,
  target?: NormalizedVersionTargetSpec,
): void {
  if (
    !target ||
    (target.historySegment === undefined && target.stateSegment === undefined)
  ) {
    return;
  }

  if (slice === "firstPayloadWeave" || slice === "secondPayloadWeave") {
    return;
  }

  throw new WeaveInputError(
    `historySegment and stateSegment are only supported for payload versioning; ${designatorPath} is currently ${
      slice ?? "not weaveable"
    }.`,
  );
}

function planFirstKnopWeave(
  meshBase: string,
  currentMeshInventoryTurtle: string,
  candidate: WeaveableKnopCandidate,
): WeavePlan {
  assertCurrentKnopInventoryWithoutHistory(
    meshBase,
    candidate.currentKnopInventoryTurtle,
    toKnopPath(candidate.designatorPath),
  );
  assertCurrentMeshInventoryShapeForFirstKnopWeave(
    meshBase,
    currentMeshInventoryTurtle,
  );

  const designatorPath = candidate.designatorPath;

  return {
    meshBase,
    wovenDesignatorPaths: [designatorPath],
    createdFiles: [
      {
        path: "_mesh/_inventory/_history001/_s0002/inventory-ttl/inventory.ttl",
        contents: renderFirstKnopWovenMeshInventoryTurtle(
          currentMeshInventoryTurtle,
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
          currentMeshInventoryTurtle,
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
  target?: NormalizedVersionTargetSpec,
): WeavePlan {
  const payloadArtifact = candidate.payloadArtifact!;
  assertCurrentKnopInventoryWithoutHistory(
    meshBase,
    candidate.currentKnopInventoryTurtle,
    toKnopPath(candidate.designatorPath),
  );
  assertCurrentMeshInventoryShapeForFirstPayloadWeave(
    meshBase,
    currentMeshInventoryTurtle,
    candidate.designatorPath,
  );
  assertCurrentPayloadArtifactShape(
    meshBase,
    candidate.currentKnopInventoryTurtle,
    candidate.designatorPath,
    payloadArtifact.workingFilePath,
  );

  const designatorPath = candidate.designatorPath;
  const knopPath = toKnopPath(designatorPath);
  const payloadLayout = resolveFirstPayloadVersionLayout(
    designatorPath,
    target,
  );
  const payloadManifestationPath = toPayloadManifestationPath(
    payloadLayout.nextStatePath,
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
          currentMeshInventoryTurtle,
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
          payloadLayout,
          payloadArtifact.workingFilePath,
        ),
      },
    ],
    updatedFiles: [
      {
        path: "_mesh/_inventory/inventory.ttl",
        contents: renderFirstPayloadWovenMeshInventoryTurtle(
          currentMeshInventoryTurtle,
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
          payloadLayout,
          payloadArtifact.workingFilePath,
        ),
      },
    ],
    createdPages: buildFirstPayloadWeavePages(
      designatorPath,
      payloadLayout,
      payloadArtifact.workingFilePath,
    ),
  };
}

function planFirstExtractedKnopWeave(
  meshBase: string,
  currentMeshInventoryTurtle: string,
  candidate: WeaveableKnopCandidate,
): WeavePlan {
  const designatorPath = candidate.designatorPath;
  const knopPath = toKnopPath(designatorPath);
  const displayDesignatorPath = formatDesignatorPathForDisplay(designatorPath);
  const referenceCatalogArtifact = candidate.referenceCatalogArtifact!;
  const referenceTargetSourcePayloadArtifact = candidate
    .referenceTargetSourcePayloadArtifact!;

  assertCurrentMeshInventoryShapeForFirstExtractedKnopWeave(
    meshBase,
    currentMeshInventoryTurtle,
    designatorPath,
    referenceTargetSourcePayloadArtifact.designatorPath,
    referenceTargetSourcePayloadArtifact.workingFilePath,
  );
  assertCurrentKnopInventoryShapeForFirstExtractedKnopWeave(
    meshBase,
    candidate.currentKnopInventoryTurtle,
    designatorPath,
    referenceCatalogArtifact.workingFilePath,
  );
  assertReferenceTargetSourcePayloadShapeForFirstExtractedKnopWeave(
    referenceTargetSourcePayloadArtifact,
  );

  const currentLinks = extractCurrentReferenceCatalogLinks(
    meshBase,
    referenceCatalogArtifact.currentReferenceCatalogTurtle,
    designatorPath,
    `${knopPath}/_references`,
  );
  const primaryLink = currentLinks[0]!;

  if (!primaryLink.referenceTargetStatePath) {
    throw new WeaveInputError(
      `Extracted weave candidate ${designatorPath} must pin its source ReferenceCatalog link to a historical state.`,
    );
  }

  if (
    primaryLink.referenceTargetPath !==
      referenceTargetSourcePayloadArtifact.designatorPath
  ) {
    throw new WeaveInputError(
      `Extracted weave candidate ${designatorPath} did not resolve the expected source payload path.`,
    );
  }

  if (
    primaryLink.referenceTargetStatePath !==
      referenceTargetSourcePayloadArtifact.latestHistoricalStatePath
  ) {
    throw new WeaveInputError(
      `Extracted weave candidate ${designatorPath} did not resolve the expected source payload state.`,
    );
  }

  const wovenMeshInventoryTurtle =
    renderFirstExtractedKnopWovenMeshInventoryTurtle(
      currentMeshInventoryTurtle,
      designatorPath,
      referenceTargetSourcePayloadArtifact.designatorPath,
    );
  const wovenKnopInventoryTurtle =
    renderFirstExtractedKnopWovenKnopInventoryTurtle(
      meshBase,
      designatorPath,
      referenceCatalogArtifact.workingFilePath,
    );

  return {
    meshBase,
    wovenDesignatorPaths: [designatorPath],
    createdFiles: [
      {
        path: "_mesh/_inventory/_history001/_s0004/inventory-ttl/inventory.ttl",
        contents: wovenMeshInventoryTurtle,
      },
      {
        path: `${knopPath}/_meta/_history001/_s0001/meta-ttl/meta.ttl`,
        contents: candidate.currentKnopMetadataTurtle,
      },
      {
        path:
          `${knopPath}/_inventory/_history001/_s0001/inventory-ttl/inventory.ttl`,
        contents: wovenKnopInventoryTurtle,
      },
      {
        path:
          `${knopPath}/_references/_history001/_s0001/references-ttl/references.ttl`,
        contents: referenceCatalogArtifact.currentReferenceCatalogTurtle,
      },
      {
        path: toDesignatorResourcePagePath(designatorPath),
        contents: renderExtractedPersonIdentifierPage(
          meshBase,
          designatorPath,
          referenceTargetSourcePayloadArtifact.designatorPath,
          toHistoryPathFromStatePath(
            referenceTargetSourcePayloadArtifact.latestHistoricalStatePath,
          ),
          referenceTargetSourcePayloadArtifact.workingFilePath,
          referenceTargetSourcePayloadArtifact.currentPayloadTurtle,
        ),
      },
      {
        path: `${knopPath}/_meta/_history001/index.html`,
        contents: renderArtifactHistoryIndexPage(meshBase, {
          pagePath: `${knopPath}/_meta/_history001/index.html`,
          description:
            `Resource page for the current explicit history of the ${displayDesignatorPath} KnopMetadata artifact.`,
          artifactLabel: "KnopMetadata artifact",
          workingFilePath: `${knopPath}/_meta/meta.ttl`,
          states: [{ segment: "_s0001", latest: true }],
        }),
      },
      {
        path: `${knopPath}/_inventory/_history001/index.html`,
        contents: renderArtifactHistoryIndexPage(meshBase, {
          pagePath: `${knopPath}/_inventory/_history001/index.html`,
          description:
            `Resource page for the current explicit history of the ${displayDesignatorPath} KnopInventory artifact.`,
          artifactLabel: "KnopInventory artifact",
          workingFilePath: `${knopPath}/_inventory/inventory.ttl`,
          states: [{ segment: "_s0001", latest: true }],
        }),
      },
      {
        path: `${knopPath}/_references/_history001/index.html`,
        contents: renderArtifactHistoryIndexPage(meshBase, {
          pagePath: `${knopPath}/_references/_history001/index.html`,
          description:
            `Resource page for the current explicit history of the ${displayDesignatorPath} ReferenceCatalog artifact.`,
          artifactLabel: "ReferenceCatalog artifact",
          workingFilePath: referenceCatalogArtifact.workingFilePath,
          states: [{ segment: "_s0001", latest: true }],
        }),
      },
    ],
    updatedFiles: [
      {
        path: "_mesh/_inventory/inventory.ttl",
        contents: wovenMeshInventoryTurtle,
      },
      {
        path: `${knopPath}/_inventory/inventory.ttl`,
        contents: wovenKnopInventoryTurtle,
      },
      {
        path: "_mesh/_inventory/_history001/index.html",
        contents: renderArtifactHistoryIndexPage(meshBase, {
          pagePath: "_mesh/_inventory/_history001/index.html",
          description:
            "Resource page for the current explicit history of the MeshInventory artifact.",
          artifactLabel: "Inventory artifact",
          workingFilePath: "_mesh/_inventory/inventory.ttl",
          states: [
            { segment: "_s0001", latest: false },
            { segment: "_s0002", latest: false },
            { segment: "_s0003", latest: false },
            { segment: "_s0004", latest: true },
          ],
        }),
      },
      {
        path: "alice/index.html",
        contents: renderAliceIdentifierPageAfterFirstExtractedWeave(
          meshBase,
          referenceTargetSourcePayloadArtifact.currentPayloadTurtle,
          toHistoryPathFromStatePath(
            referenceTargetSourcePayloadArtifact.latestHistoricalStatePath,
          ),
        ),
      },
    ],
    createdPages: [
      simplePage(
        "_mesh/_inventory/_history001/_s0004/index.html",
        "Resource page for the fourth MeshInventory historical state.",
      ),
      simplePage(
        "_mesh/_inventory/_history001/_s0004/inventory-ttl/index.html",
        "Resource page for the Turtle manifestation of the fourth MeshInventory historical state.",
      ),
      simplePage(
        `${knopPath}/index.html`,
        `Resource page for the Knop associated with the ${displayDesignatorPath} designator.`,
      ),
      simplePage(
        `${knopPath}/_meta/index.html`,
        `Resource page for the ${displayDesignatorPath} KnopMetadata artifact.`,
      ),
      simplePage(
        `${knopPath}/_meta/_history001/_s0001/index.html`,
        `Resource page for the first ${displayDesignatorPath} KnopMetadata historical state.`,
      ),
      simplePage(
        `${knopPath}/_meta/_history001/_s0001/meta-ttl/index.html`,
        `Resource page for the Turtle manifestation of the first ${displayDesignatorPath} KnopMetadata historical state.`,
      ),
      simplePage(
        `${knopPath}/_inventory/index.html`,
        `Resource page for the ${displayDesignatorPath} KnopInventory artifact.`,
      ),
      simplePage(
        `${knopPath}/_inventory/_history001/_s0001/index.html`,
        `Resource page for the first ${displayDesignatorPath} KnopInventory historical state.`,
      ),
      simplePage(
        `${knopPath}/_inventory/_history001/_s0001/inventory-ttl/index.html`,
        `Resource page for the Turtle manifestation of the first ${displayDesignatorPath} KnopInventory historical state.`,
      ),
      referenceCatalogPage(
        `${knopPath}/_references/index.html`,
        `${knopPath}/_references`,
        designatorPath,
        currentLinks,
      ),
      simplePage(
        `${knopPath}/_references/_history001/_s0001/index.html`,
        `Resource page for the first ${displayDesignatorPath} ReferenceCatalog historical state.`,
      ),
      simplePage(
        `${knopPath}/_references/_history001/_s0001/references-ttl/index.html`,
        `Resource page for the Turtle manifestation of the first ${displayDesignatorPath} ReferenceCatalog historical state.`,
      ),
    ],
  };
}

function planFirstReferenceCatalogWeave(
  meshBase: string,
  currentMeshInventoryTurtle: string,
  candidate: WeaveableKnopCandidate,
): WeavePlan {
  const referenceCatalogArtifact = candidate.referenceCatalogArtifact!;
  const designatorPath = candidate.designatorPath;
  assertCurrentMeshInventoryShapeForFirstReferenceCatalogWeave(
    meshBase,
    currentMeshInventoryTurtle,
    designatorPath,
  );
  assertCurrentKnopInventoryShapeForFirstReferenceCatalogWeave(
    meshBase,
    candidate.currentKnopInventoryTurtle,
    candidate.designatorPath,
    referenceCatalogArtifact.workingFilePath,
  );

  const knopPath = toKnopPath(designatorPath);
  const referenceCatalogPath = `${knopPath}/_references`;
  const referenceCatalogWorkingFilePath = referenceCatalogArtifact
    .workingFilePath;
  const referenceCatalogManifestationPath = toArtifactManifestationPath(
    `${referenceCatalogPath}/_history001/_s0001`,
    referenceCatalogWorkingFilePath,
  );
  const referenceCatalogLinks = extractCurrentReferenceCatalogLinks(
    meshBase,
    referenceCatalogArtifact.currentReferenceCatalogTurtle,
    designatorPath,
    referenceCatalogPath,
  );

  return {
    meshBase,
    wovenDesignatorPaths: [designatorPath],
    createdFiles: [
      {
        path:
          `${knopPath}/_inventory/_history001/_s0002/inventory-ttl/inventory.ttl`,
        contents: renderFirstReferenceCatalogWovenKnopInventoryTurtle(
          meshBase,
          designatorPath,
          referenceCatalogWorkingFilePath,
        ),
      },
      {
        path: `${referenceCatalogManifestationPath}/${
          toFileName(referenceCatalogWorkingFilePath)
        }`,
        contents: referenceCatalogArtifact.currentReferenceCatalogTurtle,
      },
    ],
    updatedFiles: [
      {
        path: `${knopPath}/_inventory/inventory.ttl`,
        contents: renderFirstReferenceCatalogWovenKnopInventoryTurtle(
          meshBase,
          designatorPath,
          referenceCatalogWorkingFilePath,
        ),
      },
    ],
    createdPages: buildFirstReferenceCatalogWeavePages(
      designatorPath,
      referenceCatalogWorkingFilePath,
      referenceCatalogLinks,
    ),
  };
}

function planFirstPageDefinitionWeave(
  meshBase: string,
  _currentMeshInventoryTurtle: string,
  candidate: WeaveableKnopCandidate,
): WeavePlan {
  const pageDefinitionArtifact = candidate.resourcePageDefinitionArtifact!;
  const designatorPath = candidate.designatorPath;
  const knopPath = toKnopPath(designatorPath);
  const pageDefinitionPath = pageDefinitionArtifact.artifactPath;
  const pageDefinitionManifestationPath =
    `${pageDefinitionPath}/_history001/_s0001/page-ttl`;
  const pageDefinitionSnapshotPath =
    `${pageDefinitionManifestationPath}/page.ttl`;

  assertCurrentKnopInventoryShapeForFirstPageDefinitionWeave(
    meshBase,
    candidate.currentKnopInventoryTurtle,
    designatorPath,
    pageDefinitionArtifact,
  );

  return {
    meshBase,
    wovenDesignatorPaths: [designatorPath],
    createdFiles: [
      {
        path: pageDefinitionSnapshotPath,
        contents: pageDefinitionArtifact.currentPageDefinitionTurtle,
      },
      {
        path:
          `${knopPath}/_inventory/_history001/_s0003/inventory-ttl/inventory.ttl`,
        contents: renderFirstPageDefinitionWovenKnopInventoryTurtle(
          meshBase,
          designatorPath,
          pageDefinitionArtifact.workingFilePath,
          pageDefinitionArtifact.assetBundlePath,
        ),
      },
    ],
    updatedFiles: [
      {
        path: `${knopPath}/_inventory/inventory.ttl`,
        contents: renderFirstPageDefinitionWovenKnopInventoryTurtle(
          meshBase,
          designatorPath,
          pageDefinitionArtifact.workingFilePath,
          pageDefinitionArtifact.assetBundlePath,
        ),
      },
    ],
    createdPages: buildFirstPageDefinitionWeavePages(designatorPath),
  };
}

function planSecondPayloadWeave(
  meshBase: string,
  currentMeshInventoryTurtle: string,
  candidate: WeaveableKnopCandidate,
  target?: NormalizedVersionTargetSpec,
): WeavePlan {
  const payloadArtifact = candidate.payloadArtifact!;
  const designatorPath = candidate.designatorPath;
  const knopPath = toKnopPath(designatorPath);
  const payloadLayout = resolveSecondPayloadVersionLayout(
    designatorPath,
    payloadArtifact,
    target,
  );
  assertCurrentMeshInventoryShapeForSecondPayloadWeave(
    meshBase,
    currentMeshInventoryTurtle,
    designatorPath,
  );
  assertCurrentKnopInventoryShapeForSecondPayloadWeave(
    meshBase,
    candidate.currentKnopInventoryTurtle,
    designatorPath,
    payloadArtifact,
    payloadLayout.nextStatePath,
  );

  const payloadManifestationPath = toPayloadManifestationPath(
    payloadLayout.nextStatePath,
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
        path: payloadSnapshotPath,
        contents: payloadArtifact.currentPayloadTurtle,
      },
      {
        path:
          `${knopPath}/_inventory/_history001/_s0002/inventory-ttl/inventory.ttl`,
        contents: renderSecondPayloadWovenKnopInventoryTurtle(
          meshBase,
          designatorPath,
          payloadLayout,
          payloadArtifact.workingFilePath,
        ),
      },
    ],
    updatedFiles: [
      {
        path: `${knopPath}/_inventory/inventory.ttl`,
        contents: renderSecondPayloadWovenKnopInventoryTurtle(
          meshBase,
          designatorPath,
          payloadLayout,
          payloadArtifact.workingFilePath,
        ),
      },
    ],
    createdPages: buildSecondPayloadWeavePages(
      designatorPath,
      payloadLayout,
      payloadArtifact.workingFilePath,
    ),
  };
}

function assertCurrentMeshInventoryShapeForFirstKnopWeave(
  meshBase: string,
  currentMeshInventoryTurtle: string,
): void {
  const errorMessage =
    "The current local weave slice only supports the settled 04 pre-weave mesh inventory shape.";
  const quads = parseWeaveShapeQuads(
    meshBase,
    currentMeshInventoryTurtle,
    errorMessage,
  );

  assertHasNamedNodeFacts(quads, meshBase, errorMessage, [
    ["_mesh/_inventory", RDF_TYPE_IRI, SFLO_MESH_INVENTORY_IRI],
    ["_mesh/_inventory", RDF_TYPE_IRI, SFLO_DIGITAL_ARTIFACT_IRI],
    ["_mesh/_inventory", RDF_TYPE_IRI, SFLO_RDF_DOCUMENT_IRI],
    [
      "_mesh/_inventory",
      SFLO_CURRENT_ARTIFACT_HISTORY_IRI,
      "_mesh/_inventory/_history001",
    ],
    [
      "_mesh/_inventory/_history001",
      SFLO_LATEST_HISTORICAL_STATE_IRI,
      "_mesh/_inventory/_history001/_s0001",
    ],
  ]);
  assertHasLiteralFacts(quads, meshBase, errorMessage, [
    [
      "_mesh/_inventory/_history001",
      SFLO_NEXT_STATE_ORDINAL_IRI,
      "2",
      XSD_NON_NEGATIVE_INTEGER_IRI,
    ],
  ]);
}

function assertCurrentMeshInventoryShapeForFirstPayloadWeave(
  meshBase: string,
  currentMeshInventoryTurtle: string,
  designatorPath: string,
): void {
  const knopPath = toKnopPath(designatorPath);
  const errorMessage =
    "The current local weave slice only supports the settled 06 pre-weave payload mesh inventory shape.";
  const quads = parseWeaveShapeQuads(
    meshBase,
    currentMeshInventoryTurtle,
    errorMessage,
  );

  assertHasNamedNodeFacts(quads, meshBase, errorMessage, [
    ["_mesh/_inventory", RDF_TYPE_IRI, SFLO_MESH_INVENTORY_IRI],
    ["_mesh/_inventory", RDF_TYPE_IRI, SFLO_DIGITAL_ARTIFACT_IRI],
    ["_mesh/_inventory", RDF_TYPE_IRI, SFLO_RDF_DOCUMENT_IRI],
    [
      "_mesh/_inventory",
      SFLO_CURRENT_ARTIFACT_HISTORY_IRI,
      "_mesh/_inventory/_history001",
    ],
    [
      "_mesh/_inventory/_history001",
      SFLO_LATEST_HISTORICAL_STATE_IRI,
      "_mesh/_inventory/_history001/_s0002",
    ],
    [designatorPath, RDF_TYPE_IRI, SFLO_PAYLOAD_ARTIFACT_IRI],
    [designatorPath, RDF_TYPE_IRI, SFLO_DIGITAL_ARTIFACT_IRI],
    [designatorPath, RDF_TYPE_IRI, SFLO_RDF_DOCUMENT_IRI],
    [knopPath, RDF_TYPE_IRI, SFLO_KNOP_IRI],
  ]);
  assertHasLiteralFacts(quads, meshBase, errorMessage, [
    [
      "_mesh/_inventory/_history001",
      SFLO_NEXT_STATE_ORDINAL_IRI,
      "3",
      XSD_NON_NEGATIVE_INTEGER_IRI,
    ],
  ]);
}

function assertCurrentMeshInventoryShapeForFirstReferenceCatalogWeave(
  meshBase: string,
  currentMeshInventoryTurtle: string,
  designatorPath: string,
): void {
  const knopPath = toKnopPath(designatorPath);
  const errorMessage =
    "The current local weave slice only supports the settled 08 pre-weave reference-catalog mesh inventory shape.";
  const quads = parseWeaveShapeQuads(
    meshBase,
    currentMeshInventoryTurtle,
    errorMessage,
  );

  assertHasNamedNodeFacts(quads, meshBase, errorMessage, [
    ["_mesh/_inventory", RDF_TYPE_IRI, SFLO_MESH_INVENTORY_IRI],
    ["_mesh/_inventory", RDF_TYPE_IRI, SFLO_DIGITAL_ARTIFACT_IRI],
    ["_mesh/_inventory", RDF_TYPE_IRI, SFLO_RDF_DOCUMENT_IRI],
    [
      "_mesh/_inventory",
      SFLO_CURRENT_ARTIFACT_HISTORY_IRI,
      "_mesh/_inventory/_history001",
    ],
    [
      "_mesh/_inventory/_history001",
      SFLO_LATEST_HISTORICAL_STATE_IRI,
      "_mesh/_inventory/_history001/_s0003",
    ],
    [knopPath, RDF_TYPE_IRI, SFLO_KNOP_IRI],
  ]);
  assertHasLiteralFacts(quads, meshBase, errorMessage, [
    [
      "_mesh/_inventory/_history001",
      SFLO_NEXT_STATE_ORDINAL_IRI,
      "4",
      XSD_NON_NEGATIVE_INTEGER_IRI,
    ],
  ]);
}

function assertCurrentMeshInventoryShapeForSecondPayloadWeave(
  meshBase: string,
  currentMeshInventoryTurtle: string,
  designatorPath: string,
): void {
  const knopPath = toKnopPath(designatorPath);
  const errorMessage =
    "The current local weave slice only supports the settled 10 pre-weave second payload-state mesh inventory shape.";
  const quads = parseWeaveShapeQuads(
    meshBase,
    currentMeshInventoryTurtle,
    errorMessage,
  );

  assertHasNamedNodeFacts(quads, meshBase, errorMessage, [
    ["_mesh/_inventory", RDF_TYPE_IRI, SFLO_MESH_INVENTORY_IRI],
    ["_mesh/_inventory", RDF_TYPE_IRI, SFLO_DIGITAL_ARTIFACT_IRI],
    ["_mesh/_inventory", RDF_TYPE_IRI, SFLO_RDF_DOCUMENT_IRI],
    [
      "_mesh/_inventory",
      SFLO_CURRENT_ARTIFACT_HISTORY_IRI,
      "_mesh/_inventory/_history001",
    ],
    [
      "_mesh/_inventory/_history001",
      SFLO_LATEST_HISTORICAL_STATE_IRI,
      "_mesh/_inventory/_history001/_s0003",
    ],
    [designatorPath, RDF_TYPE_IRI, SFLO_PAYLOAD_ARTIFACT_IRI],
    [designatorPath, RDF_TYPE_IRI, SFLO_DIGITAL_ARTIFACT_IRI],
    [designatorPath, RDF_TYPE_IRI, SFLO_RDF_DOCUMENT_IRI],
    [knopPath, RDF_TYPE_IRI, SFLO_KNOP_IRI],
  ]);
  assertHasLiteralFacts(quads, meshBase, errorMessage, [
    [
      "_mesh/_inventory/_history001",
      SFLO_NEXT_STATE_ORDINAL_IRI,
      "4",
      XSD_NON_NEGATIVE_INTEGER_IRI,
    ],
  ]);
}

function assertCurrentMeshInventoryShapeForFirstExtractedKnopWeave(
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
  const sourcePayloadPagePath = toDesignatorResourcePagePath(
    sourcePayloadDesignatorPath,
  );
  const errorMessage =
    `The current local weave slice only supports the settled extracted-knop pre-weave mesh inventory shape for ${designatorPath}.`;
  const quads = parseWeaveShapeQuads(
    meshBase,
    currentMeshInventoryTurtle,
    errorMessage,
  );

  assertHasNamedNodeFacts(quads, meshBase, errorMessage, [
    ["_mesh/_inventory", RDF_TYPE_IRI, SFLO_MESH_INVENTORY_IRI],
    ["_mesh/_inventory", RDF_TYPE_IRI, SFLO_DIGITAL_ARTIFACT_IRI],
    ["_mesh/_inventory", RDF_TYPE_IRI, SFLO_RDF_DOCUMENT_IRI],
    [
      "_mesh/_inventory",
      SFLO_CURRENT_ARTIFACT_HISTORY_IRI,
      "_mesh/_inventory/_history001",
    ],
    [
      "_mesh/_inventory/_history001",
      SFLO_LATEST_HISTORICAL_STATE_IRI,
      "_mesh/_inventory/_history001/_s0003",
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
    [rootKnopPath, RDF_TYPE_IRI, SFLO_KNOP_IRI],
    [
      rootKnopPath,
      SFLO_HAS_WORKING_KNOP_INVENTORY_FILE_IRI,
      `${rootKnopPath}/_inventory/inventory.ttl`,
    ],
    [
      rootKnopPath,
      SFLO_HAS_RESOURCE_PAGE_IRI,
      `${rootKnopPath}/index.html`,
    ],
    [sourceKnopPath, RDF_TYPE_IRI, SFLO_KNOP_IRI],
    [
      sourceKnopPath,
      SFLO_HAS_WORKING_KNOP_INVENTORY_FILE_IRI,
      `${sourceKnopPath}/_inventory/inventory.ttl`,
    ],
    [
      sourceKnopPath,
      SFLO_HAS_RESOURCE_PAGE_IRI,
      `${sourceKnopPath}/index.html`,
    ],
    [knopPath, RDF_TYPE_IRI, SFLO_KNOP_IRI],
  ]);
  assertHasLiteralFacts(quads, meshBase, errorMessage, [
    [
      "_mesh/_inventory/_history001",
      SFLO_NEXT_STATE_ORDINAL_IRI,
      "4",
      XSD_NON_NEGATIVE_INTEGER_IRI,
    ],
  ]);

  if (
    hasNamedNodeFact(
      quads,
      meshBase,
      designatorPath,
      SFLO_HAS_RESOURCE_PAGE_IRI,
      designatorPagePath,
    ) ||
    hasNamedNodeFact(
      quads,
      meshBase,
      knopPath,
      SFLO_HAS_RESOURCE_PAGE_IRI,
      `${knopPath}/index.html`,
    )
  ) {
    throw new WeaveInputError(
      `Mesh inventory already exposes current woven pages for ${designatorPath}.`,
    );
  }
}

function assertCurrentKnopInventoryShapeForFirstExtractedKnopWeave(
  meshBase: string,
  currentKnopInventoryTurtle: string,
  designatorPath: string,
  referenceCatalogWorkingFilePath: string,
): void {
  const knopPath = toKnopPath(designatorPath);
  const referenceCatalogPath = `${knopPath}/_references`;
  const errorMessage =
    `The current local weave slice only supports the settled extracted-knop inventory shape for ${designatorPath}.`;
  const quads = parseWeaveShapeQuads(
    meshBase,
    currentKnopInventoryTurtle,
    errorMessage,
  );

  assertHasNamedNodeFacts(quads, meshBase, errorMessage, [
    [knopPath, RDF_TYPE_IRI, SFLO_KNOP_IRI],
    [knopPath, SFLO_HAS_KNOP_METADATA_IRI, `${knopPath}/_meta`],
    [knopPath, SFLO_HAS_KNOP_INVENTORY_IRI, `${knopPath}/_inventory`],
    [knopPath, SFLO_HAS_REFERENCE_CATALOG_IRI, referenceCatalogPath],
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
    [referenceCatalogPath, RDF_TYPE_IRI, SFLO_REFERENCE_CATALOG_IRI],
    [referenceCatalogPath, RDF_TYPE_IRI, SFLO_DIGITAL_ARTIFACT_IRI],
    [referenceCatalogPath, RDF_TYPE_IRI, SFLO_RDF_DOCUMENT_IRI],
    [
      referenceCatalogPath,
      SFLO_HAS_WORKING_LOCATED_FILE_IRI,
      referenceCatalogWorkingFilePath,
    ],
  ]);

  if (hasPredicateFact(quads, SFLO_HAS_ARTIFACT_HISTORY_IRI)) {
    throw new WeaveInputError(
      `Extracted KnopInventory already has explicit woven history for ${designatorPath}.`,
    );
  }
}

function assertReferenceTargetSourcePayloadShapeForFirstExtractedKnopWeave(
  payloadArtifact: ReferenceTargetSourcePayloadArtifact,
): void {
  if (!payloadArtifact.workingFilePath.endsWith(".ttl")) {
    throw new WeaveInputError(
      `The current local extracted weave slice only supports Turtle source payload files; found ${payloadArtifact.workingFilePath}.`,
    );
  }

  const expectedPrefix = payloadArtifact.designatorPath.length === 0
    ? undefined
    : `${payloadArtifact.designatorPath}/`;
  if (
    payloadArtifact.latestHistoricalStatePath.length === 0 ||
    (expectedPrefix !== undefined &&
      !payloadArtifact.latestHistoricalStatePath.startsWith(expectedPrefix))
  ) {
    throw new WeaveInputError(
      `The current local extracted weave slice only supports source payloads with an explicit current historical state.`,
    );
  }
}

function assertCurrentKnopMetadataShape(
  meshBase: string,
  currentKnopMetadataTurtle: string,
  designatorPath: string,
  knopPath: string,
): void {
  const errorMessage =
    `The current local weave slice only supports the settled first-history KnopMetadata shape for ${designatorPath}.`;
  const quads = parseWeaveShapeQuads(
    meshBase,
    currentKnopMetadataTurtle,
    errorMessage,
  );

  assertHasNamedNodeFacts(quads, meshBase, errorMessage, [
    [knopPath, RDF_TYPE_IRI, SFLO_KNOP_IRI],
    [
      knopPath,
      SFLO_HAS_WORKING_KNOP_INVENTORY_FILE_IRI,
      `${knopPath}/_inventory/inventory.ttl`,
    ],
  ]);
  assertHasLiteralFacts(quads, meshBase, errorMessage, [
    [knopPath, SFLO_DESIGNATOR_PATH_IRI, designatorPath],
  ]);

  if (hasPredicateFact(quads, SFLO_HAS_ARTIFACT_HISTORY_IRI)) {
    throw new WeaveInputError(
      `KnopMetadata already has explicit history for ${designatorPath}.`,
    );
  }
}

function assertCurrentKnopInventoryBaseShape(
  meshBase: string,
  currentKnopInventoryTurtle: string,
  knopPath: string,
): void {
  const errorMessage =
    `The current local weave slice only supports the settled first-history KnopInventory shape for ${knopPath}.`;
  const quads = parseWeaveShapeQuads(
    meshBase,
    currentKnopInventoryTurtle,
    errorMessage,
  );

  assertHasNamedNodeFacts(quads, meshBase, errorMessage, [
    [knopPath, RDF_TYPE_IRI, SFLO_KNOP_IRI],
    [knopPath, SFLO_HAS_KNOP_METADATA_IRI, `${knopPath}/_meta`],
    [knopPath, SFLO_HAS_KNOP_INVENTORY_IRI, `${knopPath}/_inventory`],
    [
      knopPath,
      SFLO_HAS_WORKING_KNOP_INVENTORY_FILE_IRI,
      `${knopPath}/_inventory/inventory.ttl`,
    ],
  ]);
}

function assertCurrentKnopInventoryWithoutHistory(
  meshBase: string,
  currentKnopInventoryTurtle: string,
  knopPath: string,
): void {
  const quads = parseWeaveShapeQuads(
    meshBase,
    currentKnopInventoryTurtle,
    `Could not parse the current KnopInventory while checking current history state for ${knopPath}.`,
  );

  if (hasPredicateFact(quads, SFLO_HAS_ARTIFACT_HISTORY_IRI)) {
    throw new WeaveInputError(
      `KnopInventory already has explicit history for ${knopPath}.`,
    );
  }
}

function assertCurrentPayloadArtifactShape(
  meshBase: string,
  currentKnopInventoryTurtle: string,
  designatorPath: string,
  workingFilePath: string,
): void {
  const errorMessage =
    `The current local weave slice only supports the settled integrated payload shape for ${designatorPath}.`;
  const quads = parseWeaveShapeQuads(
    meshBase,
    currentKnopInventoryTurtle,
    errorMessage,
  );

  assertHasNamedNodeFacts(quads, meshBase, errorMessage, [
    [designatorPath, RDF_TYPE_IRI, SFLO_PAYLOAD_ARTIFACT_IRI],
    [designatorPath, RDF_TYPE_IRI, SFLO_DIGITAL_ARTIFACT_IRI],
    [designatorPath, RDF_TYPE_IRI, SFLO_RDF_DOCUMENT_IRI],
    [designatorPath, SFLO_HAS_WORKING_LOCATED_FILE_IRI, workingFilePath],
  ]);

  if (
    resolveOptionalNamedNodePath(
      quads,
      meshBase,
      designatorPath,
      SFLO_HAS_ARTIFACT_HISTORY_IRI,
      errorMessage,
    ) ||
    resolveOptionalNamedNodePath(
      quads,
      meshBase,
      designatorPath,
      SFLO_CURRENT_ARTIFACT_HISTORY_IRI,
      errorMessage,
    )
  ) {
    throw new WeaveInputError(
      `Payload artifact already has explicit history for ${designatorPath}.`,
    );
  }
}

function assertCurrentKnopInventoryShapeForFirstPageDefinitionWeave(
  meshBase: string,
  currentKnopInventoryTurtle: string,
  designatorPath: string,
  pageDefinitionArtifact: ResourcePageDefinitionWorkingArtifact,
): void {
  const knopPath = toKnopPath(designatorPath);
  const errorMessage =
    `The current local weave slice only supports the settled page-definition inventory shape for ${designatorPath}.`;
  const quads = parseWeaveShapeQuads(
    meshBase,
    currentKnopInventoryTurtle,
    errorMessage,
  );

  assertHasNamedNodeFacts(quads, meshBase, errorMessage, [
    [knopPath, RDF_TYPE_IRI, SFLO_KNOP_IRI],
    [knopPath, SFLO_HAS_KNOP_METADATA_IRI, `${knopPath}/_meta`],
    [knopPath, SFLO_HAS_KNOP_INVENTORY_IRI, `${knopPath}/_inventory`],
    [knopPath, SFLO_HAS_REFERENCE_CATALOG_IRI, `${knopPath}/_references`],
    [knopPath, SFC_HAS_RESOURCE_PAGE_DEFINITION_IRI, `${knopPath}/_page`],
    [
      knopPath,
      SFLO_HAS_WORKING_KNOP_INVENTORY_FILE_IRI,
      `${knopPath}/_inventory/inventory.ttl`,
    ],
    [`${knopPath}/_inventory`, RDF_TYPE_IRI, SFLO_KNOP_INVENTORY_IRI],
    [`${knopPath}/_inventory`, RDF_TYPE_IRI, SFLO_DIGITAL_ARTIFACT_IRI],
    [`${knopPath}/_inventory`, RDF_TYPE_IRI, SFLO_RDF_DOCUMENT_IRI],
    [
      `${knopPath}/_inventory`,
      SFLO_CURRENT_ARTIFACT_HISTORY_IRI,
      `${knopPath}/_inventory/_history001`,
    ],
    [`${knopPath}/_page`, RDF_TYPE_IRI, SFC_RESOURCE_PAGE_DEFINITION_IRI],
    [`${knopPath}/_page`, RDF_TYPE_IRI, SFLO_DIGITAL_ARTIFACT_IRI],
    [`${knopPath}/_page`, RDF_TYPE_IRI, SFLO_RDF_DOCUMENT_IRI],
    [
      `${knopPath}/_page`,
      SFLO_HAS_WORKING_LOCATED_FILE_IRI,
      pageDefinitionArtifact.workingFilePath,
    ],
  ]);
  assertHasLiteralFacts(quads, meshBase, errorMessage, [[
    `${knopPath}/_inventory/_history001`,
    SFLO_NEXT_STATE_ORDINAL_IRI,
    "3",
    XSD_NON_NEGATIVE_INTEGER_IRI,
  ]]);

  if (
    !hasNamedNodeFact(
      quads,
      meshBase,
      `${knopPath}/_inventory/_history001`,
      SFLO_LATEST_HISTORICAL_STATE_IRI,
      `${knopPath}/_inventory/_history001/_s0002`,
    )
  ) {
    throw new WeaveInputError(
      `KnopInventory is not at the expected pre-page-definition history state for ${designatorPath}.`,
    );
  }

  if (
    resolveOptionalNamedNodePath(
      quads,
      meshBase,
      `${knopPath}/_page`,
      SFLO_HAS_ARTIFACT_HISTORY_IRI,
      errorMessage,
    ) ||
    resolveOptionalNamedNodePath(
      quads,
      meshBase,
      `${knopPath}/_page`,
      SFLO_CURRENT_ARTIFACT_HISTORY_IRI,
      errorMessage,
    )
  ) {
    throw new WeaveInputError(
      `ResourcePageDefinition already has explicit history for ${designatorPath}.`,
    );
  }

  if (pageDefinitionArtifact.assetBundlePath) {
    assertHasNamedNodeFacts(quads, meshBase, errorMessage, [
      [
        knopPath,
        SFC_HAS_KNOP_ASSET_BUNDLE_IRI,
        pageDefinitionArtifact.assetBundlePath,
      ],
      [
        pageDefinitionArtifact.assetBundlePath,
        RDF_TYPE_IRI,
        SFC_KNOP_ASSET_BUNDLE_IRI,
      ],
    ]);
  }
}

function assertCurrentKnopInventoryShapeForFirstReferenceCatalogWeave(
  meshBase: string,
  currentKnopInventoryTurtle: string,
  designatorPath: string,
  workingFilePath: string,
): void {
  const knopPath = toKnopPath(designatorPath);
  const referenceCatalogPath = `${knopPath}/_references`;
  const errorMessage =
    `The current local weave slice only supports the settled first ReferenceCatalog weave shape for ${designatorPath}.`;
  const quads = parseWeaveShapeQuads(
    meshBase,
    currentKnopInventoryTurtle,
    errorMessage,
  );

  assertHasNamedNodeFacts(quads, meshBase, errorMessage, [
    [knopPath, RDF_TYPE_IRI, SFLO_KNOP_IRI],
    [knopPath, SFLO_HAS_REFERENCE_CATALOG_IRI, referenceCatalogPath],
    [`${knopPath}/_inventory`, RDF_TYPE_IRI, SFLO_KNOP_INVENTORY_IRI],
    [`${knopPath}/_inventory`, RDF_TYPE_IRI, SFLO_DIGITAL_ARTIFACT_IRI],
    [`${knopPath}/_inventory`, RDF_TYPE_IRI, SFLO_RDF_DOCUMENT_IRI],
    [
      `${knopPath}/_inventory`,
      SFLO_CURRENT_ARTIFACT_HISTORY_IRI,
      `${knopPath}/_inventory/_history001`,
    ],
    [
      `${knopPath}/_inventory/_history001`,
      SFLO_LATEST_HISTORICAL_STATE_IRI,
      `${knopPath}/_inventory/_history001/_s0001`,
    ],
    [referenceCatalogPath, RDF_TYPE_IRI, SFLO_REFERENCE_CATALOG_IRI],
    [referenceCatalogPath, RDF_TYPE_IRI, SFLO_DIGITAL_ARTIFACT_IRI],
    [referenceCatalogPath, RDF_TYPE_IRI, SFLO_RDF_DOCUMENT_IRI],
    [
      referenceCatalogPath,
      SFLO_HAS_WORKING_LOCATED_FILE_IRI,
      workingFilePath,
    ],
  ]);
  assertHasLiteralFacts(quads, meshBase, errorMessage, [
    [
      `${knopPath}/_inventory/_history001`,
      SFLO_NEXT_STATE_ORDINAL_IRI,
      "2",
      XSD_NON_NEGATIVE_INTEGER_IRI,
    ],
  ]);

  if (
    hasNamedNodeFact(
      quads,
      meshBase,
      referenceCatalogPath,
      SFLO_HAS_ARTIFACT_HISTORY_IRI,
      `${referenceCatalogPath}/_history001`,
    )
  ) {
    throw new WeaveInputError(
      `ReferenceCatalog already has explicit history for ${designatorPath}.`,
    );
  }
}

function assertCurrentKnopInventoryShapeForSecondPayloadWeave(
  meshBase: string,
  currentKnopInventoryTurtle: string,
  designatorPath: string,
  payloadArtifact: PayloadWorkingArtifact,
  nextPayloadStatePath: string,
): void {
  const knopPath = toKnopPath(designatorPath);
  const payloadHistoryPath = requirePayloadHistoryPath(
    designatorPath,
    payloadArtifact,
  );
  const currentPayloadStatePath = requirePayloadCurrentStatePath(
    designatorPath,
    payloadArtifact,
    payloadHistoryPath,
  );
  const errorMessage =
    `The current local weave slice only supports the settled second payload weave shape for ${designatorPath}.`;
  const quads = parseWeaveShapeQuads(
    meshBase,
    currentKnopInventoryTurtle,
    errorMessage,
  );

  assertHasNamedNodeFacts(quads, meshBase, errorMessage, [
    [knopPath, RDF_TYPE_IRI, SFLO_KNOP_IRI],
    [knopPath, SFLO_HAS_PAYLOAD_ARTIFACT_IRI, designatorPath],
    [designatorPath, RDF_TYPE_IRI, SFLO_PAYLOAD_ARTIFACT_IRI],
    [designatorPath, RDF_TYPE_IRI, SFLO_DIGITAL_ARTIFACT_IRI],
    [designatorPath, RDF_TYPE_IRI, SFLO_RDF_DOCUMENT_IRI],
    [
      designatorPath,
      SFLO_CURRENT_ARTIFACT_HISTORY_IRI,
      payloadHistoryPath,
    ],
    [
      payloadHistoryPath,
      SFLO_LATEST_HISTORICAL_STATE_IRI,
      currentPayloadStatePath,
    ],
    [
      designatorPath,
      SFLO_HAS_WORKING_LOCATED_FILE_IRI,
      payloadArtifact.workingFilePath,
    ],
    [`${knopPath}/_inventory`, RDF_TYPE_IRI, SFLO_KNOP_INVENTORY_IRI],
    [`${knopPath}/_inventory`, RDF_TYPE_IRI, SFLO_DIGITAL_ARTIFACT_IRI],
    [`${knopPath}/_inventory`, RDF_TYPE_IRI, SFLO_RDF_DOCUMENT_IRI],
    [
      `${knopPath}/_inventory`,
      SFLO_CURRENT_ARTIFACT_HISTORY_IRI,
      `${knopPath}/_inventory/_history001`,
    ],
    [
      `${knopPath}/_inventory/_history001`,
      SFLO_LATEST_HISTORICAL_STATE_IRI,
      `${knopPath}/_inventory/_history001/_s0001`,
    ],
    [
      `${knopPath}/_inventory`,
      SFLO_HAS_WORKING_LOCATED_FILE_IRI,
      `${knopPath}/_inventory/inventory.ttl`,
    ],
  ]);
  assertHasLiteralFacts(quads, meshBase, errorMessage, [
    [
      payloadHistoryPath,
      SFLO_NEXT_STATE_ORDINAL_IRI,
      "2",
      XSD_NON_NEGATIVE_INTEGER_IRI,
    ],
  ]);

  if (
    hasNamedNodeFact(
      quads,
      meshBase,
      payloadHistoryPath,
      SFLO_HAS_HISTORICAL_STATE_IRI,
      nextPayloadStatePath,
    ) ||
    hasNamedNodeFact(
      quads,
      meshBase,
      `${knopPath}/_inventory/_history001`,
      SFLO_HAS_HISTORICAL_STATE_IRI,
      `${knopPath}/_inventory/_history001/_s0002`,
    )
  ) {
    throw new WeaveInputError(
      `Payload artifact already has a second explicit historical state for ${designatorPath}.`,
    );
  }
}

function extractCurrentReferenceCatalogLinks(
  meshBase: string,
  currentReferenceCatalogTurtle: string,
  designatorPath: string,
  referenceCatalogPath: string,
): readonly ReferenceCatalogCurrentLinkModel[] {
  const errorMessage =
    `Could not parse the current ReferenceCatalog working file for ${designatorPath}.`;
  const referenceCatalogIri = toAbsoluteIri(meshBase, referenceCatalogPath);
  const linkSubjectPrefix = `${referenceCatalogIri}#`;
  const quads = parseWeaveShapeQuads(
    meshBase,
    currentReferenceCatalogTurtle,
    errorMessage,
  );
  const linkSubjects = Array.from(
    new Set(
      quads.flatMap((quad) =>
        quad.subject.termType === "NamedNode" &&
          quad.subject.value.startsWith(linkSubjectPrefix)
          ? [quad.subject.value]
          : []
      ),
    ),
  );
  const links: ReferenceCatalogCurrentLinkModel[] = [];

  for (const subjectIri of linkSubjects) {
    const fragment = subjectIri.slice(linkSubjectPrefix.length);
    if (fragment.length === 0) {
      throw new WeaveInputError(
        errorMessage,
      );
    }

    if (
      !hasNamedNodeFact(
        quads,
        meshBase,
        designatorPath,
        SFLO_HAS_REFERENCE_LINK_IRI,
        subjectIri,
      )
    ) {
      throw new WeaveInputError(
        `ReferenceCatalog owner did not declare current link ${fragment} for ${designatorPath}.`,
      );
    }

    if (
      !hasNamedNodeFact(
        quads,
        meshBase,
        subjectIri,
        RDF_TYPE_IRI,
        SFLO_REFERENCE_LINK_IRI,
      )
    ) {
      throw new WeaveInputError(errorMessage);
    }

    const linkForIri = requireSingleNamedNodeObject(
      quads,
      subjectIri,
      SFLO_REFERENCE_LINK_FOR_IRI,
      errorMessage,
    );
    if (linkForIri !== toAbsoluteIri(meshBase, designatorPath)) {
      throw new WeaveInputError(
        `ReferenceCatalog link target subject did not match ${designatorPath}.`,
      );
    }

    const referenceRoleIri = requireSingleNamedNodeObject(
      quads,
      subjectIri,
      SFLO_HAS_REFERENCE_ROLE_IRI,
      errorMessage,
    );
    const referenceTargetIri = requireSingleNamedNodeObject(
      quads,
      subjectIri,
      SFLO_REFERENCE_TARGET_IRI,
      errorMessage,
    );
    const referenceTargetStateIri = requireOptionalNamedNodeObject(
      quads,
      subjectIri,
      SFLO_REFERENCE_TARGET_STATE_IRI,
      errorMessage,
    );

    links.push({
      fragment,
      referenceRoleLabel: toReferenceRoleLabel(referenceRoleIri),
      referenceTargetPath: toMeshRelativePath(
        meshBase,
        referenceTargetIri,
        `ReferenceCatalog link target for ${designatorPath}`,
      ),
      ...(referenceTargetStateIri
        ? {
          referenceTargetStatePath: toMeshRelativePath(
            meshBase,
            referenceTargetStateIri,
            `ReferenceCatalog link target state for ${designatorPath}`,
          ),
        }
        : {}),
    });
  }

  if (links.length === 0) {
    throw new WeaveInputError(
      `ReferenceCatalog working file did not contain any current links for ${designatorPath}.`,
    );
  }

  return links.sort((left, right) =>
    left.fragment.localeCompare(right.fragment)
  );
}

function renderFirstKnopWovenMeshInventoryTurtle(
  currentMeshInventoryTurtle: string,
  meshBase: string,
  designatorPath: string,
): string {
  const knopPath = toKnopPath(designatorPath);
  const designatorPagePath = toDesignatorResourcePagePath(designatorPath);
  const historyPath = "_mesh/_inventory/_history001";
  const stateTwoPath = `${historyPath}/_s0002`;
  const stateTwoManifestationPath = `${stateTwoPath}/inventory-ttl`;
  const initialBlocks = normalizeMeshInventoryHeader(
    splitTurtleBlocks(currentMeshInventoryTurtle),
  );
  if (
    findSubjectBlockIndex(initialBlocks, "_mesh") === -1 ||
    findSubjectBlockIndex(
        initialBlocks,
        `${historyPath}/_s0001/inventory-ttl`,
      ) === -1 ||
    findSubjectBlockIndex(initialBlocks, "_mesh/index.html") === -1
  ) {
    return renderLegacyFirstKnopWovenMeshInventoryTurtle(
      meshBase,
      designatorPath,
    );
  }
  let blocks = initialBlocks;
  const knopPaths = resolveMeshRootKnopPaths(
    meshBase,
    currentMeshInventoryTurtle,
  );

  if (!knopPaths.includes(knopPath)) {
    knopPaths.push(knopPath);
  }

  blocks = replaceSubjectBlock(
    blocks,
    "_mesh",
    renderMeshRootBlock(meshBase, knopPaths),
  );
  blocks = upsertSubjectBlockAfter(
    blocks,
    "_mesh",
    designatorPath,
    renderMeshIdentifierBlock(designatorPath),
  );
  blocks = replaceSubjectBlock(
    blocks,
    knopPath,
    renderMeshKnopBlockWithResourcePage(knopPath),
  );
  blocks = replaceSubjectBlock(
    blocks,
    historyPath,
    renderMeshInventoryHistoryWithSecondStateBlock(),
  );
  blocks = upsertSubjectBlockAfter(
    blocks,
    `${historyPath}/_s0001/inventory-ttl`,
    stateTwoPath,
    renderMeshInventoryStateTwoBlock(),
  );
  blocks = upsertSubjectBlockAfter(
    blocks,
    stateTwoPath,
    stateTwoManifestationPath,
    renderMeshInventoryStateTwoManifestationBlock(),
  );
  blocks = upsertSubjectBlockAfter(
    blocks,
    `${historyPath}/_s0001/inventory-ttl/inventory.ttl`,
    `${stateTwoManifestationPath}/inventory.ttl`,
    renderLocatedFileBlock(`${stateTwoManifestationPath}/inventory.ttl`),
  );
  blocks = upsertSubjectBlockAfter(
    blocks,
    "_mesh/index.html",
    designatorPagePath,
    renderResourcePageLocatedFileBlock(designatorPagePath),
  );
  blocks = upsertSubjectBlockAfter(
    blocks,
    designatorPagePath,
    `${knopPath}/index.html`,
    renderResourcePageLocatedFileBlock(`${knopPath}/index.html`),
  );
  blocks = upsertSubjectBlockAfter(
    blocks,
    `${historyPath}/_s0001/inventory-ttl/index.html`,
    `${stateTwoPath}/index.html`,
    renderResourcePageLocatedFileBlock(`${stateTwoPath}/index.html`),
  );
  blocks = upsertSubjectBlockAfter(
    blocks,
    `${stateTwoPath}/index.html`,
    `${stateTwoManifestationPath}/index.html`,
    renderResourcePageLocatedFileBlock(
      `${stateTwoManifestationPath}/index.html`,
    ),
  );

  return `${blocks.join("\n\n")}\n`;
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
  currentMeshInventoryTurtle: string,
  meshBase: string,
  designatorPath: string,
  workingFilePath: string,
): string {
  const knopPath = toKnopPath(designatorPath);
  const rootDesignatorPath = toRootDesignatorPath(designatorPath);
  const rootKnopPath = toKnopPath(rootDesignatorPath);
  const designatorPagePath = toDesignatorResourcePagePath(designatorPath);
  const rootPagePath = toDesignatorResourcePagePath(rootDesignatorPath);
  const historyPath = "_mesh/_inventory/_history001";
  const stateThreePath = `${historyPath}/_s0003`;
  const stateThreeManifestationPath = `${stateThreePath}/inventory-ttl`;
  const initialBlocks = normalizeMeshInventoryHeader(
    splitTurtleBlocks(currentMeshInventoryTurtle),
  );
  if (
    findSubjectBlockIndex(initialBlocks, "_mesh") === -1 ||
    findSubjectBlockIndex(
        initialBlocks,
        `${historyPath}/_s0002/inventory-ttl`,
      ) === -1
  ) {
    return renderLegacyFirstPayloadWovenMeshInventoryTurtle(
      meshBase,
      designatorPath,
      workingFilePath,
    );
  }
  let blocks = initialBlocks;
  const knopPaths = resolveMeshRootKnopPaths(
    meshBase,
    currentMeshInventoryTurtle,
  );

  if (!knopPaths.includes(knopPath)) {
    knopPaths.push(knopPath);
  }

  blocks = replaceSubjectBlock(
    blocks,
    "_mesh",
    renderMeshRootBlock(meshBase, knopPaths),
  );
  blocks = replaceSubjectBlock(
    blocks,
    designatorPath,
    renderMeshPayloadArtifactBlockWithResourcePage(
      designatorPath,
      workingFilePath,
    ),
  );
  blocks = replaceSubjectBlock(
    blocks,
    knopPath,
    renderMeshKnopBlockWithResourcePage(knopPath),
  );
  blocks = replaceSubjectBlock(
    blocks,
    historyPath,
    renderMeshInventoryHistoryWithThirdStateBlock(),
  );
  blocks = upsertSubjectBlockAfter(
    blocks,
    `${historyPath}/_s0002/inventory-ttl`,
    stateThreePath,
    renderMeshInventoryStateThreeBlock(),
  );
  blocks = upsertSubjectBlockAfter(
    blocks,
    stateThreePath,
    stateThreeManifestationPath,
    renderMeshInventoryStateThreeManifestationBlock(),
  );
  blocks = upsertSubjectBlockAfter(
    blocks,
    `${historyPath}/_s0002/inventory-ttl/inventory.ttl`,
    `${stateThreeManifestationPath}/inventory.ttl`,
    renderLocatedFileBlock(`${stateThreeManifestationPath}/inventory.ttl`),
  );
  blocks = upsertSubjectBlockAfter(
    blocks,
    rootDesignatorPath === designatorPath ? "_mesh/index.html" : rootPagePath,
    designatorPagePath,
    renderResourcePageLocatedFileBlock(designatorPagePath),
  );
  blocks = upsertSubjectBlockAfter(
    blocks,
    rootDesignatorPath === designatorPath
      ? designatorPagePath
      : `${rootKnopPath}/index.html`,
    `${knopPath}/index.html`,
    renderResourcePageLocatedFileBlock(`${knopPath}/index.html`),
  );
  blocks = upsertSubjectBlockAfter(
    blocks,
    `${historyPath}/_s0002/inventory-ttl/index.html`,
    `${stateThreePath}/index.html`,
    renderResourcePageLocatedFileBlock(`${stateThreePath}/index.html`),
  );
  blocks = upsertSubjectBlockAfter(
    blocks,
    `${stateThreePath}/index.html`,
    `${stateThreeManifestationPath}/index.html`,
    renderResourcePageLocatedFileBlock(
      `${stateThreeManifestationPath}/index.html`,
    ),
  );

  return `${blocks.join("\n\n")}\n`;
}

function renderLegacyFirstKnopWovenMeshInventoryTurtle(
  meshBase: string,
  designatorPath: string,
): string {
  const knopPath = toKnopPath(designatorPath);
  const designatorPagePath = toDesignatorResourcePagePath(designatorPath);

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
  sflo:hasResourcePage <${designatorPagePath}> .

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

<${designatorPagePath}> a sflo:ResourcePage, sflo:LocatedFile .

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

function renderLegacyFirstPayloadWovenMeshInventoryTurtle(
  meshBase: string,
  designatorPath: string,
  workingFilePath: string,
): string {
  const knopPath = toKnopPath(designatorPath);
  const designatorPagePath = toDesignatorResourcePagePath(designatorPath);

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
  sflo:hasResourcePage <${designatorPagePath}> .

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

<${designatorPagePath}> a sflo:ResourcePage, sflo:LocatedFile .

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
  payloadLayout: PayloadVersionLayout,
  workingFilePath: string,
): string {
  const knopPath = toKnopPath(designatorPath);
  const designatorPagePath = toDesignatorResourcePagePath(designatorPath);
  const payloadManifestationPath = toPayloadManifestationPath(
    payloadLayout.nextStatePath,
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
  sflo:hasArtifactHistory <${payloadLayout.historyPath}> ;
  sflo:currentArtifactHistory <${payloadLayout.historyPath}> ;
  sflo:nextHistoryOrdinal "2"^^xsd:nonNegativeInteger ;
  sflo:hasWorkingLocatedFile <${workingFilePath}> ;
  sflo:hasResourcePage <${designatorPagePath}> .

<${payloadLayout.historyPath}> a sflo:ArtifactHistory ;
  sflo:historyOrdinal "1"^^xsd:nonNegativeInteger ;
  sflo:hasHistoricalState <${payloadLayout.nextStatePath}> ;
  sflo:latestHistoricalState <${payloadLayout.nextStatePath}> ;
  sflo:nextStateOrdinal "2"^^xsd:nonNegativeInteger ;
  sflo:hasResourcePage <${payloadLayout.historyPath}/index.html> .

<${payloadLayout.nextStatePath}> a sflo:HistoricalState ;
  sflo:stateOrdinal "1"^^xsd:nonNegativeInteger ;
  sflo:hasManifestation <${payloadManifestationPath}> ;
  sflo:locatedFileForState <${payloadSnapshotPath}> ;
  sflo:hasResourcePage <${payloadLayout.nextStatePath}/index.html> .

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

<${designatorPagePath}> a sflo:ResourcePage, sflo:LocatedFile .

<${payloadLayout.historyPath}/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${payloadLayout.nextStatePath}/index.html> a sflo:ResourcePage, sflo:LocatedFile .

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

function renderFirstReferenceCatalogWovenKnopInventoryTurtle(
  meshBase: string,
  designatorPath: string,
  workingFilePath: string,
): string {
  const knopPath = toKnopPath(designatorPath);
  const referenceCatalogPath = `${knopPath}/_references`;
  const referenceCatalogManifestationPath = toArtifactManifestationPath(
    `${referenceCatalogPath}/_history001/_s0001`,
    workingFilePath,
  );

  return `@base <${meshBase}> .
@prefix sflo: <https://semantic-flow.github.io/semantic-flow-ontology/> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

<${knopPath}> a sflo:Knop ;
  sflo:hasKnopMetadata <${knopPath}/_meta> ;
  sflo:hasKnopInventory <${knopPath}/_inventory> ;
  sflo:hasWorkingKnopInventoryFile <${knopPath}/_inventory/inventory.ttl> ;
  sflo:hasReferenceCatalog <${referenceCatalogPath}> ;
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

<${referenceCatalogPath}> a sflo:ReferenceCatalog, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasArtifactHistory <${referenceCatalogPath}/_history001> ;
  sflo:currentArtifactHistory <${referenceCatalogPath}/_history001> ;
  sflo:nextHistoryOrdinal "2"^^xsd:nonNegativeInteger ;
  sflo:hasWorkingLocatedFile <${workingFilePath}> ;
  sflo:hasResourcePage <${referenceCatalogPath}/index.html> .

<${knopPath}/_inventory/_history001> a sflo:ArtifactHistory ;
  sflo:historyOrdinal "1"^^xsd:nonNegativeInteger ;
  sflo:hasHistoricalState <${knopPath}/_inventory/_history001/_s0001> ;
  sflo:hasHistoricalState <${knopPath}/_inventory/_history001/_s0002> ;
  sflo:latestHistoricalState <${knopPath}/_inventory/_history001/_s0002> ;
  sflo:nextStateOrdinal "3"^^xsd:nonNegativeInteger ;
  sflo:hasResourcePage <${knopPath}/_inventory/_history001/index.html> .

<${knopPath}/_inventory/_history001/_s0001> a sflo:HistoricalState ;
  sflo:stateOrdinal "1"^^xsd:nonNegativeInteger ;
  sflo:hasManifestation <${knopPath}/_inventory/_history001/_s0001/inventory-ttl> ;
  sflo:locatedFileForState <${knopPath}/_inventory/_history001/_s0001/inventory-ttl/inventory.ttl> ;
  sflo:hasResourcePage <${knopPath}/_inventory/_history001/_s0001/index.html> .

<${knopPath}/_inventory/_history001/_s0001/inventory-ttl> a sflo:ArtifactManifestation, sflo:RdfDocument ;
  sflo:hasLocatedFile <${knopPath}/_inventory/_history001/_s0001/inventory-ttl/inventory.ttl> ;
  sflo:hasResourcePage <${knopPath}/_inventory/_history001/_s0001/inventory-ttl/index.html> .

<${knopPath}/_inventory/_history001/_s0002> a sflo:HistoricalState ;
  sflo:stateOrdinal "2"^^xsd:nonNegativeInteger ;
  sflo:previousHistoricalState <${knopPath}/_inventory/_history001/_s0001> ;
  sflo:hasManifestation <${knopPath}/_inventory/_history001/_s0002/inventory-ttl> ;
  sflo:locatedFileForState <${knopPath}/_inventory/_history001/_s0002/inventory-ttl/inventory.ttl> ;
  sflo:hasResourcePage <${knopPath}/_inventory/_history001/_s0002/index.html> .

<${knopPath}/_inventory/_history001/_s0002/inventory-ttl> a sflo:ArtifactManifestation, sflo:RdfDocument ;
  sflo:hasLocatedFile <${knopPath}/_inventory/_history001/_s0002/inventory-ttl/inventory.ttl> ;
  sflo:hasResourcePage <${knopPath}/_inventory/_history001/_s0002/inventory-ttl/index.html> .

<${referenceCatalogPath}/_history001> a sflo:ArtifactHistory ;
  sflo:historyOrdinal "1"^^xsd:nonNegativeInteger ;
  sflo:hasHistoricalState <${referenceCatalogPath}/_history001/_s0001> ;
  sflo:latestHistoricalState <${referenceCatalogPath}/_history001/_s0001> ;
  sflo:nextStateOrdinal "2"^^xsd:nonNegativeInteger ;
  sflo:hasResourcePage <${referenceCatalogPath}/_history001/index.html> .

<${referenceCatalogPath}/_history001/_s0001> a sflo:HistoricalState ;
  sflo:stateOrdinal "1"^^xsd:nonNegativeInteger ;
  sflo:hasManifestation <${referenceCatalogManifestationPath}> ;
  sflo:locatedFileForState <${referenceCatalogManifestationPath}/${
    toFileName(workingFilePath)
  }> ;
  sflo:hasResourcePage <${referenceCatalogPath}/_history001/_s0001/index.html> .

<${referenceCatalogManifestationPath}> a sflo:ArtifactManifestation, sflo:RdfDocument ;
  sflo:hasLocatedFile <${referenceCatalogManifestationPath}/${
    toFileName(workingFilePath)
  }> ;
  sflo:hasResourcePage <${referenceCatalogManifestationPath}/index.html> .

<${knopPath}/_meta/meta.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<${knopPath}/_inventory/inventory.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<${workingFilePath}> a sflo:LocatedFile, sflo:RdfDocument .

<${knopPath}/_meta/_history001/_s0001/meta-ttl/meta.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<${knopPath}/_inventory/_history001/_s0001/inventory-ttl/inventory.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<${knopPath}/_inventory/_history001/_s0002/inventory-ttl/inventory.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<${referenceCatalogManifestationPath}/${
    toFileName(workingFilePath)
  }> a sflo:LocatedFile, sflo:RdfDocument .

<${knopPath}/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${knopPath}/_meta/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${knopPath}/_meta/_history001/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${knopPath}/_meta/_history001/_s0001/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${knopPath}/_meta/_history001/_s0001/meta-ttl/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${knopPath}/_inventory/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${knopPath}/_inventory/_history001/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${knopPath}/_inventory/_history001/_s0001/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${knopPath}/_inventory/_history001/_s0001/inventory-ttl/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${knopPath}/_inventory/_history001/_s0002/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${knopPath}/_inventory/_history001/_s0002/inventory-ttl/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${referenceCatalogPath}/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${referenceCatalogPath}/_history001/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${referenceCatalogPath}/_history001/_s0001/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${referenceCatalogManifestationPath}/index.html> a sflo:ResourcePage, sflo:LocatedFile .
`;
}

function renderFirstPageDefinitionWovenKnopInventoryTurtle(
  meshBase: string,
  designatorPath: string,
  workingFilePath: string,
  assetBundlePath?: string,
): string {
  const knopPath = toKnopPath(designatorPath);
  const referenceCatalogPath = `${knopPath}/_references`;
  const pageDefinitionPath = `${knopPath}/_page`;
  const pageDefinitionHistoryPath = `${pageDefinitionPath}/_history001`;
  const pageDefinitionStatePath = `${pageDefinitionHistoryPath}/_s0001`;
  const pageDefinitionManifestationPath = `${pageDefinitionStatePath}/page-ttl`;
  const pageDefinitionSnapshotPath =
    `${pageDefinitionManifestationPath}/page.ttl`;
  const assetBundleLines = assetBundlePath
    ? ` ;
  <${SFC_HAS_KNOP_ASSET_BUNDLE_IRI}> <${assetBundlePath}>`
    : "";
  const assetBundleBlock = assetBundlePath
    ? `<${assetBundlePath}> a <${SFC_KNOP_ASSET_BUNDLE_IRI}> .\n\n`
    : "";

  return `@base <${meshBase}> .
@prefix sflo: <https://semantic-flow.github.io/semantic-flow-ontology/> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

<${knopPath}> a sflo:Knop ;
  sflo:hasKnopMetadata <${knopPath}/_meta> ;
  sflo:hasKnopInventory <${knopPath}/_inventory> ;
  sflo:hasWorkingKnopInventoryFile <${knopPath}/_inventory/inventory.ttl> ;
  sflo:hasReferenceCatalog <${referenceCatalogPath}> ;
  sflo:hasResourcePage <${knopPath}/index.html> ;
  <${SFC_HAS_RESOURCE_PAGE_DEFINITION_IRI}> <${pageDefinitionPath}>${assetBundleLines} .

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

<${referenceCatalogPath}> a sflo:ReferenceCatalog, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasArtifactHistory <${referenceCatalogPath}/_history001> ;
  sflo:currentArtifactHistory <${referenceCatalogPath}/_history001> ;
  sflo:nextHistoryOrdinal "2"^^xsd:nonNegativeInteger ;
  sflo:hasWorkingLocatedFile <${referenceCatalogPath}/references.ttl> ;
  sflo:hasResourcePage <${referenceCatalogPath}/index.html> .

<${pageDefinitionPath}> a <${SFC_RESOURCE_PAGE_DEFINITION_IRI}>, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasArtifactHistory <${pageDefinitionHistoryPath}> ;
  sflo:currentArtifactHistory <${pageDefinitionHistoryPath}> ;
  sflo:nextHistoryOrdinal "2"^^xsd:nonNegativeInteger ;
  sflo:hasWorkingLocatedFile <${workingFilePath}> ;
  sflo:hasResourcePage <${pageDefinitionPath}/index.html> .

${assetBundleBlock}<${pageDefinitionHistoryPath}> a sflo:ArtifactHistory ;
  sflo:historyOrdinal "1"^^xsd:nonNegativeInteger ;
  sflo:hasHistoricalState <${pageDefinitionStatePath}> ;
  sflo:latestHistoricalState <${pageDefinitionStatePath}> ;
  sflo:nextStateOrdinal "2"^^xsd:nonNegativeInteger ;
  sflo:hasResourcePage <${pageDefinitionHistoryPath}/index.html> .

<${pageDefinitionStatePath}> a sflo:HistoricalState ;
  sflo:stateOrdinal "1"^^xsd:nonNegativeInteger ;
  sflo:hasManifestation <${pageDefinitionManifestationPath}> ;
  sflo:locatedFileForState <${pageDefinitionSnapshotPath}> ;
  sflo:hasResourcePage <${pageDefinitionStatePath}/index.html> .

<${pageDefinitionManifestationPath}> a sflo:ArtifactManifestation, sflo:RdfDocument ;
  sflo:hasLocatedFile <${pageDefinitionSnapshotPath}> ;
  sflo:hasResourcePage <${pageDefinitionManifestationPath}/index.html> .

<${knopPath}/_inventory/_history001> a sflo:ArtifactHistory ;
  sflo:historyOrdinal "1"^^xsd:nonNegativeInteger ;
  sflo:hasHistoricalState <${knopPath}/_inventory/_history001/_s0001> ;
  sflo:hasHistoricalState <${knopPath}/_inventory/_history001/_s0002> ;
  sflo:hasHistoricalState <${knopPath}/_inventory/_history001/_s0003> ;
  sflo:latestHistoricalState <${knopPath}/_inventory/_history001/_s0003> ;
  sflo:nextStateOrdinal "4"^^xsd:nonNegativeInteger ;
  sflo:hasResourcePage <${knopPath}/_inventory/_history001/index.html> .

<${knopPath}/_inventory/_history001/_s0001> a sflo:HistoricalState ;
  sflo:stateOrdinal "1"^^xsd:nonNegativeInteger ;
  sflo:hasManifestation <${knopPath}/_inventory/_history001/_s0001/inventory-ttl> ;
  sflo:locatedFileForState <${knopPath}/_inventory/_history001/_s0001/inventory-ttl/inventory.ttl> ;
  sflo:hasResourcePage <${knopPath}/_inventory/_history001/_s0001/index.html> .

<${knopPath}/_inventory/_history001/_s0001/inventory-ttl> a sflo:ArtifactManifestation, sflo:RdfDocument ;
  sflo:hasLocatedFile <${knopPath}/_inventory/_history001/_s0001/inventory-ttl/inventory.ttl> ;
  sflo:hasResourcePage <${knopPath}/_inventory/_history001/_s0001/inventory-ttl/index.html> .

<${knopPath}/_inventory/_history001/_s0002> a sflo:HistoricalState ;
  sflo:stateOrdinal "2"^^xsd:nonNegativeInteger ;
  sflo:previousHistoricalState <${knopPath}/_inventory/_history001/_s0001> ;
  sflo:hasManifestation <${knopPath}/_inventory/_history001/_s0002/inventory-ttl> ;
  sflo:locatedFileForState <${knopPath}/_inventory/_history001/_s0002/inventory-ttl/inventory.ttl> ;
  sflo:hasResourcePage <${knopPath}/_inventory/_history001/_s0002/index.html> .

<${knopPath}/_inventory/_history001/_s0002/inventory-ttl> a sflo:ArtifactManifestation, sflo:RdfDocument ;
  sflo:hasLocatedFile <${knopPath}/_inventory/_history001/_s0002/inventory-ttl/inventory.ttl> ;
  sflo:hasResourcePage <${knopPath}/_inventory/_history001/_s0002/inventory-ttl/index.html> .

<${knopPath}/_inventory/_history001/_s0003> a sflo:HistoricalState ;
  sflo:stateOrdinal "3"^^xsd:nonNegativeInteger ;
  sflo:previousHistoricalState <${knopPath}/_inventory/_history001/_s0002> ;
  sflo:hasManifestation <${knopPath}/_inventory/_history001/_s0003/inventory-ttl> ;
  sflo:locatedFileForState <${knopPath}/_inventory/_history001/_s0003/inventory-ttl/inventory.ttl> ;
  sflo:hasResourcePage <${knopPath}/_inventory/_history001/_s0003/index.html> .

<${knopPath}/_inventory/_history001/_s0003/inventory-ttl> a sflo:ArtifactManifestation, sflo:RdfDocument ;
  sflo:hasLocatedFile <${knopPath}/_inventory/_history001/_s0003/inventory-ttl/inventory.ttl> ;
  sflo:hasResourcePage <${knopPath}/_inventory/_history001/_s0003/inventory-ttl/index.html> .

<${knopPath}/_references/_history001> a sflo:ArtifactHistory ;
  sflo:historyOrdinal "1"^^xsd:nonNegativeInteger ;
  sflo:hasHistoricalState <${knopPath}/_references/_history001/_s0001> ;
  sflo:latestHistoricalState <${knopPath}/_references/_history001/_s0001> ;
  sflo:nextStateOrdinal "2"^^xsd:nonNegativeInteger ;
  sflo:hasResourcePage <${knopPath}/_references/_history001/index.html> .

<${knopPath}/_references/_history001/_s0001> a sflo:HistoricalState ;
  sflo:stateOrdinal "1"^^xsd:nonNegativeInteger ;
  sflo:hasManifestation <${knopPath}/_references/_history001/_s0001/references-ttl> ;
  sflo:locatedFileForState <${knopPath}/_references/_history001/_s0001/references-ttl/references.ttl> ;
  sflo:hasResourcePage <${knopPath}/_references/_history001/_s0001/index.html> .

<${knopPath}/_references/_history001/_s0001/references-ttl> a sflo:ArtifactManifestation, sflo:RdfDocument ;
  sflo:hasLocatedFile <${knopPath}/_references/_history001/_s0001/references-ttl/references.ttl> ;
  sflo:hasResourcePage <${knopPath}/_references/_history001/_s0001/references-ttl/index.html> .

<${knopPath}/_meta/meta.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<${knopPath}/_inventory/inventory.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<${referenceCatalogPath}/references.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<${workingFilePath}> a sflo:LocatedFile, sflo:RdfDocument .

<${knopPath}/_meta/_history001/_s0001/meta-ttl/meta.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<${knopPath}/_inventory/_history001/_s0001/inventory-ttl/inventory.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<${knopPath}/_inventory/_history001/_s0002/inventory-ttl/inventory.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<${knopPath}/_inventory/_history001/_s0003/inventory-ttl/inventory.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<${knopPath}/_references/_history001/_s0001/references-ttl/references.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<${pageDefinitionSnapshotPath}> a sflo:LocatedFile, sflo:RdfDocument .

<${knopPath}/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${knopPath}/_meta/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${knopPath}/_meta/_history001/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${knopPath}/_meta/_history001/_s0001/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${knopPath}/_meta/_history001/_s0001/meta-ttl/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${knopPath}/_inventory/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${knopPath}/_inventory/_history001/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${knopPath}/_inventory/_history001/_s0001/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${knopPath}/_inventory/_history001/_s0001/inventory-ttl/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${knopPath}/_inventory/_history001/_s0002/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${knopPath}/_inventory/_history001/_s0002/inventory-ttl/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${knopPath}/_inventory/_history001/_s0003/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${knopPath}/_inventory/_history001/_s0003/inventory-ttl/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${referenceCatalogPath}/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${referenceCatalogPath}/_history001/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${referenceCatalogPath}/_history001/_s0001/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${knopPath}/_references/_history001/_s0001/references-ttl/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${pageDefinitionPath}/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${pageDefinitionHistoryPath}/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${pageDefinitionStatePath}/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${pageDefinitionManifestationPath}/index.html> a sflo:ResourcePage, sflo:LocatedFile .
`;
}

function renderSecondPayloadWovenKnopInventoryTurtle(
  meshBase: string,
  designatorPath: string,
  payloadLayout: PayloadVersionLayout,
  workingFilePath: string,
): string {
  const knopPath = toKnopPath(designatorPath);
  const designatorPagePath = toDesignatorResourcePagePath(designatorPath);
  const payloadStateOnePath = payloadLayout.currentStatePath!;
  const payloadStateOneManifestationPath = toPayloadManifestationPath(
    payloadStateOnePath,
    workingFilePath,
  );
  const payloadStateTwoManifestationPath = toPayloadManifestationPath(
    payloadLayout.nextStatePath,
    workingFilePath,
  );
  const payloadFileName = toFileName(workingFilePath);

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
  sflo:hasArtifactHistory <${payloadLayout.historyPath}> ;
  sflo:currentArtifactHistory <${payloadLayout.historyPath}> ;
  sflo:nextHistoryOrdinal "2"^^xsd:nonNegativeInteger ;
  sflo:hasWorkingLocatedFile <${workingFilePath}> ;
  sflo:hasResourcePage <${designatorPagePath}> .

<${payloadLayout.historyPath}> a sflo:ArtifactHistory ;
  sflo:historyOrdinal "1"^^xsd:nonNegativeInteger ;
  sflo:hasHistoricalState <${payloadStateOnePath}> ;
  sflo:hasHistoricalState <${payloadLayout.nextStatePath}> ;
  sflo:latestHistoricalState <${payloadLayout.nextStatePath}> ;
  sflo:nextStateOrdinal "3"^^xsd:nonNegativeInteger ;
  sflo:hasResourcePage <${payloadLayout.historyPath}/index.html> .

<${payloadStateOnePath}> a sflo:HistoricalState ;
  sflo:stateOrdinal "1"^^xsd:nonNegativeInteger ;
  sflo:hasManifestation <${payloadStateOneManifestationPath}> ;
  sflo:locatedFileForState <${payloadStateOneManifestationPath}/${payloadFileName}> ;
  sflo:hasResourcePage <${payloadStateOnePath}/index.html> .

<${payloadStateOneManifestationPath}> a sflo:ArtifactManifestation, sflo:RdfDocument ;
  sflo:hasLocatedFile <${payloadStateOneManifestationPath}/${payloadFileName}> ;
  sflo:hasResourcePage <${payloadStateOneManifestationPath}/index.html> .

<${payloadLayout.nextStatePath}> a sflo:HistoricalState ;
  sflo:stateOrdinal "2"^^xsd:nonNegativeInteger ;
  sflo:previousHistoricalState <${payloadStateOnePath}> ;
  sflo:hasManifestation <${payloadStateTwoManifestationPath}> ;
  sflo:locatedFileForState <${payloadStateTwoManifestationPath}/${payloadFileName}> ;
  sflo:hasResourcePage <${payloadLayout.nextStatePath}/index.html> .

<${payloadStateTwoManifestationPath}> a sflo:ArtifactManifestation, sflo:RdfDocument ;
  sflo:hasLocatedFile <${payloadStateTwoManifestationPath}/${payloadFileName}> ;
  sflo:hasResourcePage <${payloadStateTwoManifestationPath}/index.html> .

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
  sflo:hasHistoricalState <${knopPath}/_inventory/_history001/_s0002> ;
  sflo:latestHistoricalState <${knopPath}/_inventory/_history001/_s0002> ;
  sflo:nextStateOrdinal "3"^^xsd:nonNegativeInteger ;
  sflo:hasResourcePage <${knopPath}/_inventory/_history001/index.html> .

<${knopPath}/_inventory/_history001/_s0001> a sflo:HistoricalState ;
  sflo:stateOrdinal "1"^^xsd:nonNegativeInteger ;
  sflo:hasManifestation <${knopPath}/_inventory/_history001/_s0001/inventory-ttl> ;
  sflo:locatedFileForState <${knopPath}/_inventory/_history001/_s0001/inventory-ttl/inventory.ttl> ;
  sflo:hasResourcePage <${knopPath}/_inventory/_history001/_s0001/index.html> .

<${knopPath}/_inventory/_history001/_s0001/inventory-ttl> a sflo:ArtifactManifestation, sflo:RdfDocument ;
  sflo:hasLocatedFile <${knopPath}/_inventory/_history001/_s0001/inventory-ttl/inventory.ttl> ;
  sflo:hasResourcePage <${knopPath}/_inventory/_history001/_s0001/inventory-ttl/index.html> .

<${knopPath}/_inventory/_history001/_s0002> a sflo:HistoricalState ;
  sflo:stateOrdinal "2"^^xsd:nonNegativeInteger ;
  sflo:previousHistoricalState <${knopPath}/_inventory/_history001/_s0001> ;
  sflo:hasManifestation <${knopPath}/_inventory/_history001/_s0002/inventory-ttl> ;
  sflo:locatedFileForState <${knopPath}/_inventory/_history001/_s0002/inventory-ttl/inventory.ttl> ;
  sflo:hasResourcePage <${knopPath}/_inventory/_history001/_s0002/index.html> .

<${knopPath}/_inventory/_history001/_s0002/inventory-ttl> a sflo:ArtifactManifestation, sflo:RdfDocument ;
  sflo:hasLocatedFile <${knopPath}/_inventory/_history001/_s0002/inventory-ttl/inventory.ttl> ;
  sflo:hasResourcePage <${knopPath}/_inventory/_history001/_s0002/inventory-ttl/index.html> .

<${knopPath}/_meta/meta.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<${knopPath}/_inventory/inventory.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<${workingFilePath}> a sflo:LocatedFile, sflo:RdfDocument .

<${payloadStateOneManifestationPath}/${payloadFileName}> a sflo:LocatedFile, sflo:RdfDocument .

<${payloadStateTwoManifestationPath}/${payloadFileName}> a sflo:LocatedFile, sflo:RdfDocument .

<${knopPath}/_meta/_history001/_s0001/meta-ttl/meta.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<${knopPath}/_inventory/_history001/_s0001/inventory-ttl/inventory.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<${knopPath}/_inventory/_history001/_s0002/inventory-ttl/inventory.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<${designatorPagePath}> a sflo:ResourcePage, sflo:LocatedFile .

<${payloadLayout.historyPath}/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${payloadStateOnePath}/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${payloadStateOneManifestationPath}/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${payloadLayout.nextStatePath}/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${payloadStateTwoManifestationPath}/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${knopPath}/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${knopPath}/_meta/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${knopPath}/_meta/_history001/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${knopPath}/_meta/_history001/_s0001/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${knopPath}/_meta/_history001/_s0001/meta-ttl/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${knopPath}/_inventory/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${knopPath}/_inventory/_history001/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${knopPath}/_inventory/_history001/_s0001/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${knopPath}/_inventory/_history001/_s0001/inventory-ttl/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${knopPath}/_inventory/_history001/_s0002/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${knopPath}/_inventory/_history001/_s0002/inventory-ttl/index.html> a sflo:ResourcePage, sflo:LocatedFile .
`;
}

function renderFirstExtractedKnopWovenMeshInventoryTurtle(
  currentMeshInventoryTurtle: string,
  designatorPath: string,
  sourcePayloadDesignatorPath: string,
): string {
  const rootDesignatorPath = toRootDesignatorPath(sourcePayloadDesignatorPath);
  const sourceKnopPath = toKnopPath(sourcePayloadDesignatorPath);
  const knopPath = toKnopPath(designatorPath);
  const designatorPagePath = toDesignatorResourcePagePath(designatorPath);
  const rootPagePath = toDesignatorResourcePagePath(rootDesignatorPath);
  const historyPath = "_mesh/_inventory/_history001";
  const stateFourPath = `${historyPath}/_s0004`;
  const stateFourManifestationPath = `${stateFourPath}/inventory-ttl`;
  let blocks = normalizeMeshInventoryHeader(
    splitTurtleBlocks(currentMeshInventoryTurtle),
  );

  blocks = upsertSubjectBlockAfter(
    blocks,
    rootDesignatorPath,
    designatorPath,
    renderMeshIdentifierBlock(designatorPath),
  );
  blocks = replaceSubjectBlock(
    blocks,
    knopPath,
    renderMeshKnopBlockWithResourcePage(knopPath),
  );
  blocks = replaceSubjectBlock(
    blocks,
    historyPath,
    renderMeshInventoryHistoryWithFourthStateBlock(),
  );
  blocks = upsertSubjectBlockAfter(
    blocks,
    `${historyPath}/_s0003/inventory-ttl`,
    stateFourPath,
    renderMeshInventoryStateFourBlock(),
  );
  blocks = upsertSubjectBlockAfter(
    blocks,
    stateFourPath,
    stateFourManifestationPath,
    renderMeshInventoryStateFourManifestationBlock(),
  );
  blocks = upsertSubjectBlockAfter(
    blocks,
    `${historyPath}/_s0003/inventory-ttl/inventory.ttl`,
    `${stateFourManifestationPath}/inventory.ttl`,
    renderLocatedFileBlock(`${stateFourManifestationPath}/inventory.ttl`),
  );
  blocks = upsertSubjectBlockAfter(
    blocks,
    rootPagePath,
    designatorPagePath,
    renderResourcePageLocatedFileBlock(designatorPagePath),
  );
  blocks = upsertSubjectBlockAfter(
    blocks,
    `${sourceKnopPath}/index.html`,
    `${knopPath}/index.html`,
    renderResourcePageLocatedFileBlock(`${knopPath}/index.html`),
  );
  blocks = upsertSubjectBlockAfter(
    blocks,
    `${historyPath}/_s0003/inventory-ttl/index.html`,
    `${stateFourPath}/index.html`,
    renderResourcePageLocatedFileBlock(`${stateFourPath}/index.html`),
  );
  blocks = upsertSubjectBlockAfter(
    blocks,
    `${stateFourPath}/index.html`,
    `${stateFourManifestationPath}/index.html`,
    renderResourcePageLocatedFileBlock(
      `${stateFourManifestationPath}/index.html`,
    ),
  );

  return `${blocks.join("\n\n")}\n`;
}

function renderMeshIdentifierBlock(designatorPath: string): string {
  const designatorPagePath = toDesignatorResourcePagePath(designatorPath);
  return `<${designatorPath}>
  sflo:hasResourcePage <${designatorPagePath}> .`;
}

function renderMeshRootBlock(
  meshBase: string,
  knopPaths: readonly string[],
): string {
  const knopLines = knopPaths.map((knopPath) =>
    `  sflo:hasKnop <${knopPath}> ;`
  ).join("\n");

  return `<_mesh> a sflo:SemanticMesh ;
  sflo:meshBase "${meshBase}"^^xsd:anyURI ;
  sflo:hasMeshMetadata <_mesh/_meta> ;
  sflo:hasMeshInventory <_mesh/_inventory> ;
${knopLines}
  sflo:hasResourcePage <_mesh/index.html> .`;
}

function renderMeshKnopBlockWithResourcePage(knopPath: string): string {
  return `<${knopPath}> a sflo:Knop ;
  sflo:hasWorkingKnopInventoryFile <${knopPath}/_inventory/inventory.ttl> ;
  sflo:hasResourcePage <${knopPath}/index.html> .`;
}

function renderMeshPayloadArtifactBlockWithResourcePage(
  designatorPath: string,
  workingFilePath: string,
): string {
  const designatorPagePath = toDesignatorResourcePagePath(designatorPath);
  return `<${designatorPath}> a sflo:PayloadArtifact, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasWorkingLocatedFile <${workingFilePath}> ;
  sflo:hasResourcePage <${designatorPagePath}> .`;
}

function renderMeshInventoryHistoryWithSecondStateBlock(): string {
  return `<_mesh/_inventory/_history001> a sflo:ArtifactHistory ;
  sflo:historyOrdinal "1"^^xsd:nonNegativeInteger ;
  sflo:hasHistoricalState <_mesh/_inventory/_history001/_s0001> ;
  sflo:hasHistoricalState <_mesh/_inventory/_history001/_s0002> ;
  sflo:latestHistoricalState <_mesh/_inventory/_history001/_s0002> ;
  sflo:nextStateOrdinal "3"^^xsd:nonNegativeInteger ;
  sflo:hasResourcePage <_mesh/_inventory/_history001/index.html> .`;
}

function renderMeshInventoryHistoryWithThirdStateBlock(): string {
  return `<_mesh/_inventory/_history001> a sflo:ArtifactHistory ;
  sflo:historyOrdinal "1"^^xsd:nonNegativeInteger ;
  sflo:hasHistoricalState <_mesh/_inventory/_history001/_s0001> ;
  sflo:hasHistoricalState <_mesh/_inventory/_history001/_s0002> ;
  sflo:hasHistoricalState <_mesh/_inventory/_history001/_s0003> ;
  sflo:latestHistoricalState <_mesh/_inventory/_history001/_s0003> ;
  sflo:nextStateOrdinal "4"^^xsd:nonNegativeInteger ;
  sflo:hasResourcePage <_mesh/_inventory/_history001/index.html> .`;
}

function renderMeshInventoryStateTwoBlock(): string {
  return `<_mesh/_inventory/_history001/_s0002> a sflo:HistoricalState ;
  sflo:stateOrdinal "2"^^xsd:nonNegativeInteger ;
  sflo:previousHistoricalState <_mesh/_inventory/_history001/_s0001> ;
  sflo:hasManifestation <_mesh/_inventory/_history001/_s0002/inventory-ttl> ;
  sflo:locatedFileForState <_mesh/_inventory/_history001/_s0002/inventory-ttl/inventory.ttl> ;
  sflo:hasResourcePage <_mesh/_inventory/_history001/_s0002/index.html> .`;
}

function renderMeshInventoryStateThreeBlock(): string {
  return `<_mesh/_inventory/_history001/_s0003> a sflo:HistoricalState ;
  sflo:stateOrdinal "3"^^xsd:nonNegativeInteger ;
  sflo:previousHistoricalState <_mesh/_inventory/_history001/_s0002> ;
  sflo:hasManifestation <_mesh/_inventory/_history001/_s0003/inventory-ttl> ;
  sflo:locatedFileForState <_mesh/_inventory/_history001/_s0003/inventory-ttl/inventory.ttl> ;
  sflo:hasResourcePage <_mesh/_inventory/_history001/_s0003/index.html> .`;
}

function renderMeshInventoryStateTwoManifestationBlock(): string {
  return `<_mesh/_inventory/_history001/_s0002/inventory-ttl> a sflo:ArtifactManifestation, sflo:RdfDocument ;
  sflo:hasLocatedFile <_mesh/_inventory/_history001/_s0002/inventory-ttl/inventory.ttl> ;
  sflo:hasResourcePage <_mesh/_inventory/_history001/_s0002/inventory-ttl/index.html> .`;
}

function renderMeshInventoryStateThreeManifestationBlock(): string {
  return `<_mesh/_inventory/_history001/_s0003/inventory-ttl> a sflo:ArtifactManifestation, sflo:RdfDocument ;
  sflo:hasLocatedFile <_mesh/_inventory/_history001/_s0003/inventory-ttl/inventory.ttl> ;
  sflo:hasResourcePage <_mesh/_inventory/_history001/_s0003/inventory-ttl/index.html> .`;
}

function renderMeshInventoryHistoryWithFourthStateBlock(): string {
  return `<_mesh/_inventory/_history001> a sflo:ArtifactHistory ;
  sflo:historyOrdinal "1"^^xsd:nonNegativeInteger ;
  sflo:hasHistoricalState <_mesh/_inventory/_history001/_s0001> ;
  sflo:hasHistoricalState <_mesh/_inventory/_history001/_s0002> ;
  sflo:hasHistoricalState <_mesh/_inventory/_history001/_s0003> ;
  sflo:hasHistoricalState <_mesh/_inventory/_history001/_s0004> ;
  sflo:latestHistoricalState <_mesh/_inventory/_history001/_s0004> ;
  sflo:nextStateOrdinal "5"^^xsd:nonNegativeInteger ;
  sflo:hasResourcePage <_mesh/_inventory/_history001/index.html> .`;
}

function renderMeshInventoryStateFourBlock(): string {
  return `<_mesh/_inventory/_history001/_s0004> a sflo:HistoricalState ;
  sflo:stateOrdinal "4"^^xsd:nonNegativeInteger ;
  sflo:previousHistoricalState <_mesh/_inventory/_history001/_s0003> ;
  sflo:hasManifestation <_mesh/_inventory/_history001/_s0004/inventory-ttl> ;
  sflo:locatedFileForState <_mesh/_inventory/_history001/_s0004/inventory-ttl/inventory.ttl> ;
  sflo:hasResourcePage <_mesh/_inventory/_history001/_s0004/index.html> .`;
}

function renderMeshInventoryStateFourManifestationBlock(): string {
  return `<_mesh/_inventory/_history001/_s0004/inventory-ttl> a sflo:ArtifactManifestation, sflo:RdfDocument ;
  sflo:hasLocatedFile <_mesh/_inventory/_history001/_s0004/inventory-ttl/inventory.ttl> ;
  sflo:hasResourcePage <_mesh/_inventory/_history001/_s0004/inventory-ttl/index.html> .`;
}

function renderLocatedFileBlock(path: string): string {
  return `<${path}> a sflo:LocatedFile, sflo:RdfDocument .`;
}

function renderResourcePageLocatedFileBlock(path: string): string {
  return `<${path}> a sflo:ResourcePage, sflo:LocatedFile .`;
}

function resolveMeshRootKnopPaths(
  meshBase: string,
  currentMeshInventoryTurtle: string,
): string[] {
  const quads = parseWeaveShapeQuads(
    meshBase,
    currentMeshInventoryTurtle,
    "Could not parse the current MeshInventory while preserving mesh knop entries.",
  );
  const meshIri = new URL("_mesh", meshBase).href;
  const knopPaths: string[] = [];

  for (const quad of quads) {
    if (
      quad.subject.termType !== "NamedNode" ||
      quad.subject.value !== meshIri ||
      quad.predicate.value !== SFLO_HAS_KNOP_IRI ||
      quad.object.termType !== "NamedNode"
    ) {
      continue;
    }

    const objectPath = tryToMeshPath(meshBase, quad.object.value);
    if (!objectPath || knopPaths.includes(objectPath)) {
      continue;
    }
    knopPaths.push(objectPath);
  }

  return knopPaths;
}

function splitTurtleBlocks(turtle: string): string[] {
  return turtle.trimEnd().split("\n\n");
}

function tryToMeshPath(meshBase: string, iri: string): string | undefined {
  if (!iri.startsWith(meshBase)) {
    return undefined;
  }

  const suffix = iri.slice(meshBase.length);
  return suffix.length === 0 ? undefined : suffix;
}

function normalizeMeshInventoryHeader(blocks: string[]): string[] {
  if (blocks.length === 0) {
    return blocks;
  }

  const [header, ...rest] = blocks;
  return [
    header.replace(
      "@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .\n",
      "",
    ),
    ...rest,
  ];
}

function replaceSubjectBlock(
  blocks: string[],
  subjectPath: string,
  replacementBlock: string,
): string[] {
  const index = findSubjectBlockIndex(blocks, subjectPath);
  if (index === -1) {
    throw new WeaveInputError(
      `Current mesh inventory did not contain subject block <${subjectPath}>.`,
    );
  }

  const nextBlocks = [...blocks];
  nextBlocks[index] = replacementBlock;
  return nextBlocks;
}

function upsertSubjectBlockAfter(
  blocks: string[],
  anchorSubjectPath: string,
  subjectPath: string,
  block: string,
): string[] {
  const existingIndex = findSubjectBlockIndex(blocks, subjectPath);
  if (existingIndex !== -1) {
    const nextBlocks = [...blocks];
    nextBlocks[existingIndex] = block;
    return nextBlocks;
  }

  const anchorIndex = findSubjectBlockIndex(blocks, anchorSubjectPath);
  if (anchorIndex === -1) {
    throw new WeaveInputError(
      `Current mesh inventory did not contain anchor subject block <${anchorSubjectPath}>.`,
    );
  }

  const nextBlocks = [...blocks];
  nextBlocks.splice(anchorIndex + 1, 0, block);
  return nextBlocks;
}

function findSubjectBlockIndex(
  blocks: readonly string[],
  subjectPath: string,
): number {
  return blocks.findIndex((block) =>
    getSubjectPathFromBlock(block) === subjectPath
  );
}

function getSubjectPathFromBlock(block: string): string | undefined {
  const match = block.match(/^<([^>]*)>/);
  return match?.[1];
}

function renderFirstExtractedKnopWovenKnopInventoryTurtle(
  meshBase: string,
  designatorPath: string,
  referenceCatalogWorkingFilePath: string,
): string {
  const knopPath = toKnopPath(designatorPath);
  const referenceCatalogPath = `${knopPath}/_references`;
  const referenceCatalogManifestationPath =
    `${referenceCatalogPath}/_history001/_s0001/${
      toManifestationSegment(referenceCatalogWorkingFilePath)
    }`;

  return `@base <${meshBase}> .
@prefix sflo: <https://semantic-flow.github.io/semantic-flow-ontology/> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

<${knopPath}> a sflo:Knop ;
  sflo:hasKnopMetadata <${knopPath}/_meta> ;
  sflo:hasKnopInventory <${knopPath}/_inventory> ;
  sflo:hasReferenceCatalog <${referenceCatalogPath}> ;
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

<${referenceCatalogPath}> a sflo:ReferenceCatalog, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasArtifactHistory <${referenceCatalogPath}/_history001> ;
  sflo:currentArtifactHistory <${referenceCatalogPath}/_history001> ;
  sflo:nextHistoryOrdinal "2"^^xsd:nonNegativeInteger ;
  sflo:hasWorkingLocatedFile <${referenceCatalogWorkingFilePath}> ;
  sflo:hasResourcePage <${referenceCatalogPath}/index.html> .

<${referenceCatalogPath}/_history001> a sflo:ArtifactHistory ;
  sflo:historyOrdinal "1"^^xsd:nonNegativeInteger ;
  sflo:hasHistoricalState <${referenceCatalogPath}/_history001/_s0001> ;
  sflo:latestHistoricalState <${referenceCatalogPath}/_history001/_s0001> ;
  sflo:nextStateOrdinal "2"^^xsd:nonNegativeInteger ;
  sflo:hasResourcePage <${referenceCatalogPath}/_history001/index.html> .

<${referenceCatalogPath}/_history001/_s0001> a sflo:HistoricalState ;
  sflo:stateOrdinal "1"^^xsd:nonNegativeInteger ;
  sflo:hasManifestation <${referenceCatalogManifestationPath}> ;
  sflo:locatedFileForState <${referenceCatalogManifestationPath}/${
    toFileName(referenceCatalogWorkingFilePath)
  }> ;
  sflo:hasResourcePage <${referenceCatalogPath}/_history001/_s0001/index.html> .

<${referenceCatalogManifestationPath}> a sflo:ArtifactManifestation, sflo:RdfDocument ;
  sflo:hasLocatedFile <${referenceCatalogManifestationPath}/${
    toFileName(referenceCatalogWorkingFilePath)
  }> ;
  sflo:hasResourcePage <${referenceCatalogManifestationPath}/index.html> .

<${knopPath}/_meta/meta.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<${knopPath}/_inventory/inventory.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<${referenceCatalogWorkingFilePath}> a sflo:LocatedFile, sflo:RdfDocument .

<${knopPath}/_meta/_history001/_s0001/meta-ttl/meta.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<${knopPath}/_inventory/_history001/_s0001/inventory-ttl/inventory.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<${referenceCatalogManifestationPath}/${
    toFileName(referenceCatalogWorkingFilePath)
  }> a sflo:LocatedFile, sflo:RdfDocument .

<${knopPath}/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${knopPath}/_meta/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${knopPath}/_meta/_history001/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${knopPath}/_meta/_history001/_s0001/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${knopPath}/_meta/_history001/_s0001/meta-ttl/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${knopPath}/_inventory/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${knopPath}/_inventory/_history001/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${knopPath}/_inventory/_history001/_s0001/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${knopPath}/_inventory/_history001/_s0001/inventory-ttl/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${referenceCatalogPath}/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${referenceCatalogPath}/_history001/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${referenceCatalogPath}/_history001/_s0001/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${referenceCatalogManifestationPath}/index.html> a sflo:ResourcePage, sflo:LocatedFile .
`;
}

function renderArtifactHistoryIndexPage(
  meshBase: string,
  options: {
    pagePath: string;
    description: string;
    artifactLabel: string;
    workingFilePath: string;
    states: readonly { segment: string; latest: boolean }[];
  },
): string {
  const resourcePath = toResourcePath(
    options.pagePath,
    (message) => new WeaveInputError(message),
  );
  const canonical = new URL(resourcePath, meshBase).href;
  const meshLabel = deriveMeshLabel(meshBase);
  const states = options.states.map((state) =>
    `        <li><a href="./${escapeHtml(state.segment)}">${
      escapeHtml(state.segment)
    }</a>${state.latest ? " (latest)" : ""}</li>`
  ).join("\n");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(meshLabel)} ${escapeHtml(resourcePath)}</title>
  <link rel="canonical" href="${escapeHtml(canonical)}">
</head>
<body>
  <main>
    <h1>${escapeHtml(resourcePath)}</h1>
    <p>${escapeHtml(options.description)}</p>
    <section>
      <h2>History Links</h2>
      <ul>
        <li>${escapeHtml(options.artifactLabel)}: <a href="../">../</a></li>
        <li>Current working file: <a href="${
    escapeHtml(toRelativeHref(options.pagePath, options.workingFilePath))
  }">${
    escapeHtml(toRelativeHref(options.pagePath, options.workingFilePath))
  }</a></li>
      </ul>
    </section>
    <section>
      <h2>States</h2>
      <ol>
${states}
      </ol>
    </section>
  </main>
</body>
</html>
`;
}

function renderAliceIdentifierPageAfterFirstExtractedWeave(
  meshBase: string,
  currentPayloadTurtle: string,
  payloadHistoryPath: string,
): string {
  const meshLabel = deriveMeshLabel(meshBase);
  const canonical = new URL("alice", meshBase).href;
  const aliceName = requireLiteralValue(
    meshBase,
    currentPayloadTurtle,
    "alice",
    "http://xmlns.com/foaf/0.1/name",
    "alice foaf:name",
  );
  const aliceBirthDate = requireLiteralValue(
    meshBase,
    currentPayloadTurtle,
    "alice",
    "https://schema.org/birthDate",
    "alice schema:birthDate",
  );
  const knowsPath = requireNamedNodePath(
    meshBase,
    currentPayloadTurtle,
    "alice",
    "http://xmlns.com/foaf/0.1/knows",
    "alice foaf:knows",
  );
  const knowsHref = toRelativeHref("alice/index.html", knowsPath);
  const payloadHistoryHref = toRelativeHref(
    "alice/index.html",
    payloadHistoryPath,
  );

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(meshLabel)} alice</title>
  <link rel="canonical" href="${escapeHtml(canonical)}">
</head>
<body>
  <main>
    <h1><strong>alice</strong></h1>
    <p>Resource page for the Semantic Flow identifier <a href="${
    escapeHtml(canonical)
  }">${escapeHtml(canonical)}</a>.</p>
    <p>This Semantic Flow identifier denotes a <a href="https://schema.org/Person">schema:Person</a>.</p>
    <section>
      <h2>Supporting Semantic Flow Resources</h2>
      <ul>
        <li>Knop: <a href="./_knop">./_knop</a></li>
        <li>KnopMetadata: current file <a href="./_knop/_meta/meta.ttl">./_knop/_meta/meta.ttl</a>, history <a href="./_knop/_meta/_history001">./_knop/_meta/_history001</a></li>
        <li>KnopInventory: current file <a href="./_knop/_inventory/inventory.ttl">./_knop/_inventory/inventory.ttl</a>, history <a href="./_knop/_inventory/_history001">./_knop/_inventory/_history001</a></li>
        <li>ReferenceCatalog: current file <a href="./_knop/_references/references.ttl">./_knop/_references/references.ttl</a>, history <a href="./_knop/_references/_history001">./_knop/_references/_history001</a></li>
      </ul>
    </section>
    <section>
      <h2>Related Semantic Flow Resource</h2>
      <ul>
        <li><a href="./bio">./bio</a>: current payload file <a href="../alice-bio.ttl">../alice-bio.ttl</a>, current history <a href="${
    escapeHtml(payloadHistoryHref)
  }">${escapeHtml(payloadHistoryHref)}</a></li>
      </ul>
    </section>
    <section>
      <h2>Current Properties</h2>
      <table>
        <thead>
          <tr><th>Predicate</th><th>Value</th></tr>
        </thead>
        <tbody>
          <tr>
            <td><a href="https://www.w3.org/1999/02/22-rdf-syntax-ns#type">rdf:type</a></td>
            <td><a href="https://schema.org/Person">schema:Person</a></td>
          </tr>
          <tr>
            <td><a href="http://xmlns.com/foaf/0.1/name">foaf:name</a></td>
            <td>${escapeHtml(aliceName)}</td>
          </tr>
          <tr>
            <td><a href="https://schema.org/birthDate">schema:birthDate</a></td>
            <td>${escapeHtml(aliceBirthDate)}</td>
          </tr>
          <tr>
            <td><a href="http://xmlns.com/foaf/0.1/knows">foaf:knows</a></td>
            <td><a href="${escapeHtml(knowsHref)}">${
    escapeHtml(knowsPath)
  }</a></td>
          </tr>
        </tbody>
      </table>
    </section>
  </main>
  <footer>
    <small>The Semantic Flow identifier <a href="${escapeHtml(canonical)}">${
    escapeHtml(canonical)
  }</a> has an associated Knop at <a href="./_knop">./_knop</a> and a related integrated bio resource at <a href="./bio">./bio</a>.</small>
  </footer>
</body>
</html>
`;
}

function renderExtractedPersonIdentifierPage(
  meshBase: string,
  designatorPath: string,
  sourcePayloadDesignatorPath: string,
  sourcePayloadHistoryPath: string,
  sourceWorkingFilePath: string,
  currentPayloadTurtle: string,
): string {
  const meshLabel = deriveMeshLabel(meshBase);
  const designatorPagePath = toDesignatorResourcePagePath(designatorPath);
  const displayDesignatorPath = formatDesignatorPathForDisplay(designatorPath);
  const givenName = requireLiteralValue(
    meshBase,
    currentPayloadTurtle,
    designatorPath,
    "http://xmlns.com/foaf/0.1/givenName",
    `${designatorPath} foaf:givenName`,
  );
  const nick = requireLiteralValue(
    meshBase,
    currentPayloadTurtle,
    designatorPath,
    "http://xmlns.com/foaf/0.1/nick",
    `${designatorPath} foaf:nick`,
  );
  const sourceResourceHref = toRelativeHref(
    designatorPagePath,
    sourcePayloadDesignatorPath,
  );
  const sourceHistoryHref = toRelativeHref(
    designatorPagePath,
    sourcePayloadHistoryPath,
  );
  const sourceWorkingFileHref = toRelativeHref(
    designatorPagePath,
    sourceWorkingFilePath,
  );
  const canonical = new URL(designatorPath, meshBase).href;

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(meshLabel)} ${escapeHtml(displayDesignatorPath)}</title>
  <link rel="canonical" href="${escapeHtml(canonical)}">
</head>
<body>
  <main>
    <h1><strong>${escapeHtml(displayDesignatorPath)}</strong></h1>
    <p>Resource page for the Semantic Flow identifier <a href="${
    escapeHtml(canonical)
  }">${escapeHtml(canonical)}</a>.</p>
    <p>This Semantic Flow identifier denotes a <a href="https://schema.org/Person">schema:Person</a>.</p>
    <section>
      <h2>Supporting Semantic Flow Resources</h2>
      <ul>
        <li>Knop: <a href="./_knop">./_knop</a></li>
        <li>KnopMetadata: current file <a href="./_knop/_meta/meta.ttl">./_knop/_meta/meta.ttl</a>, history <a href="./_knop/_meta/_history001">./_knop/_meta/_history001</a></li>
        <li>KnopInventory: current file <a href="./_knop/_inventory/inventory.ttl">./_knop/_inventory/inventory.ttl</a>, history <a href="./_knop/_inventory/_history001">./_knop/_inventory/_history001</a></li>
        <li>ReferenceCatalog: current file <a href="./_knop/_references/references.ttl">./_knop/_references/references.ttl</a>, history <a href="./_knop/_references/_history001">./_knop/_references/_history001</a></li>
      </ul>
    </section>
    <section>
      <h2>Related Semantic Flow Resource</h2>
      <ul>
        <li><a href="${escapeHtml(sourceResourceHref)}">${
    escapeHtml(sourceResourceHref)
  }</a>: current payload file <a href="${escapeHtml(sourceWorkingFileHref)}">${
    escapeHtml(sourceWorkingFileHref)
  }</a>, current history <a href="${escapeHtml(sourceHistoryHref)}">${
    escapeHtml(sourceHistoryHref)
  }</a></li>
      </ul>
    </section>
    <section>
      <h2>Current Properties</h2>
      <table>
        <thead>
          <tr><th>Predicate</th><th>Value</th></tr>
        </thead>
        <tbody>
          <tr>
            <td><a href="https://www.w3.org/1999/02/22-rdf-syntax-ns#type">rdf:type</a></td>
            <td><a href="https://schema.org/Person">schema:Person</a></td>
          </tr>
          <tr>
            <td><a href="http://xmlns.com/foaf/0.1/givenName">foaf:givenName</a></td>
            <td>${escapeHtml(givenName)}</td>
          </tr>
          <tr>
            <td><a href="http://xmlns.com/foaf/0.1/nick">foaf:nick</a></td>
            <td>${escapeHtml(nick)}</td>
          </tr>
        </tbody>
      </table>
    </section>
  </main>
  <footer>
    <small>The Semantic Flow identifier <a href="${escapeHtml(canonical)}">${
    escapeHtml(canonical)
  }</a> has an associated Knop at <a href="./_knop">./_knop</a> and is currently described in the related resource <a href="${
    escapeHtml(sourceResourceHref)
  }">${escapeHtml(sourceResourceHref)}</a>.</small>
  </footer>
</body>
</html>
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
      throw new WeaveInputError(errorMessage);
    }
  }
}

function assertHasLiteralFacts(
  quads: readonly Quad[],
  meshBase: string,
  errorMessage: string,
  facts: readonly (readonly [string, string, string, string?])[],
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
      throw new WeaveInputError(errorMessage);
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
  const subjectIri = toAbsoluteIri(meshBase, subjectValue);
  const objectIri = toAbsoluteIri(meshBase, objectValue);

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
  datatypeIri?: string,
): boolean {
  const subjectIri = toAbsoluteIri(meshBase, subjectValue);

  return quads.some((quad) =>
    quad.subject.termType === "NamedNode" &&
    quad.subject.value === subjectIri &&
    quad.predicate.value === predicateIri &&
    quad.object.termType === "Literal" &&
    quad.object.value === literalValue &&
    (datatypeIri === undefined || quad.object.datatype.value === datatypeIri)
  );
}

function hasPredicateFact(
  quads: readonly Quad[],
  predicateIri: string,
): boolean {
  return quads.some((quad) => quad.predicate.value === predicateIri);
}

function parseWeaveShapeQuads(
  meshBase: string,
  turtle: string,
  errorMessage: string,
): Quad[] {
  try {
    return new Parser({ baseIRI: meshBase }).parse(turtle);
  } catch {
    throw new WeaveInputError(errorMessage);
  }
}

function requireSingleNamedNodeObject(
  quads: readonly Quad[],
  subjectIri: string,
  predicateIri: string,
  errorMessage: string,
): string {
  const values = quads.flatMap((quad) =>
    quad.subject.termType === "NamedNode" &&
      quad.subject.value === subjectIri &&
      quad.predicate.value === predicateIri &&
      quad.object.termType === "NamedNode"
      ? [quad.object.value]
      : []
  );

  if (values.length !== 1) {
    throw new WeaveInputError(errorMessage);
  }

  return values[0]!;
}

function requireOptionalNamedNodeObject(
  quads: readonly Quad[],
  subjectIri: string,
  predicateIri: string,
  errorMessage: string,
): string | undefined {
  const values = quads.flatMap((quad) =>
    quad.subject.termType === "NamedNode" &&
      quad.subject.value === subjectIri &&
      quad.predicate.value === predicateIri &&
      quad.object.termType === "NamedNode"
      ? [quad.object.value]
      : []
  );

  if (values.length > 1) {
    throw new WeaveInputError(errorMessage);
  }

  return values[0];
}

function requireLiteralValue(
  meshBase: string,
  turtle: string,
  subjectPath: string,
  predicateIri: string,
  label: string,
): string {
  const subjectIri = new URL(subjectPath, meshBase).href;
  const quad = parseTurtleQuads(meshBase, turtle, label).find((candidate) =>
    candidate.subject.termType === "NamedNode" &&
    candidate.subject.value === subjectIri &&
    candidate.predicate.value === predicateIri &&
    candidate.object.termType === "Literal"
  );

  if (!quad || quad.object.termType !== "Literal") {
    throw new WeaveInputError(
      `Could not resolve ${label} from the source payload.`,
    );
  }

  return quad.object.value;
}

function requireNamedNodePath(
  meshBase: string,
  turtle: string,
  subjectPath: string,
  predicateIri: string,
  label: string,
): string {
  const subjectIri = new URL(subjectPath, meshBase).href;
  const quad = parseTurtleQuads(meshBase, turtle, label).find((candidate) =>
    candidate.subject.termType === "NamedNode" &&
    candidate.subject.value === subjectIri &&
    candidate.predicate.value === predicateIri &&
    candidate.object.termType === "NamedNode"
  );

  if (!quad || quad.object.termType !== "NamedNode") {
    throw new WeaveInputError(
      `Could not resolve ${label} from the source payload.`,
    );
  }

  return toMeshRelativePath(meshBase, quad.object.value, label);
}

function parseTurtleQuads(
  meshBase: string,
  turtle: string,
  label: string,
): Quad[] {
  try {
    return new Parser({ baseIRI: meshBase }).parse(turtle);
  } catch {
    throw new WeaveInputError(
      `Could not parse the source payload Turtle while rendering ${label}.`,
    );
  }
}

function toMeshRelativePath(
  meshBase: string,
  iri: string,
  label: string,
): string {
  if (!iri.startsWith(meshBase)) {
    throw new WeaveInputError(
      `Resolved IRI for ${label} was outside the current mesh base: ${iri}`,
    );
  }

  return iri.slice(meshBase.length);
}

function toAbsoluteIri(meshBase: string, value: string): string {
  return new URL(value, meshBase).href;
}

function toRootDesignatorPath(designatorPath: string): string {
  const firstSlash = designatorPath.indexOf("/");
  return firstSlash === -1
    ? designatorPath
    : designatorPath.slice(0, firstSlash);
}

function buildFirstKnopWeavePages(
  designatorPath: string,
): readonly ResourcePageModel[] {
  const knopPath = toKnopPath(designatorPath);
  const designatorPagePath = toDesignatorResourcePagePath(designatorPath);
  const displayDesignatorPath = formatDesignatorPathForDisplay(designatorPath);

  return [
    simplePage(
      "_mesh/_inventory/_history001/_s0002/index.html",
      "Resource page for the second MeshInventory historical state.",
    ),
    simplePage(
      "_mesh/_inventory/_history001/_s0002/inventory-ttl/index.html",
      "Resource page for the Turtle manifestation of the second MeshInventory historical state.",
    ),
    identifierPage(designatorPagePath, designatorPath),
    simplePage(
      `${knopPath}/index.html`,
      `Resource page for the Knop associated with the ${displayDesignatorPath} designator.`,
    ),
    simplePage(
      `${knopPath}/_meta/index.html`,
      `Resource page for the ${displayDesignatorPath} KnopMetadata artifact.`,
    ),
    simplePage(
      `${knopPath}/_meta/_history001/index.html`,
      `Resource page for the current explicit history of the ${displayDesignatorPath} KnopMetadata artifact.`,
    ),
    simplePage(
      `${knopPath}/_meta/_history001/_s0001/index.html`,
      `Resource page for the first ${displayDesignatorPath} KnopMetadata historical state.`,
    ),
    simplePage(
      `${knopPath}/_meta/_history001/_s0001/meta-ttl/index.html`,
      `Resource page for the Turtle manifestation of the first ${displayDesignatorPath} KnopMetadata historical state.`,
    ),
    simplePage(
      `${knopPath}/_inventory/index.html`,
      `Resource page for the ${displayDesignatorPath} KnopInventory artifact.`,
    ),
    simplePage(
      `${knopPath}/_inventory/_history001/index.html`,
      `Resource page for the current explicit history of the ${displayDesignatorPath} KnopInventory artifact.`,
    ),
    simplePage(
      `${knopPath}/_inventory/_history001/_s0001/index.html`,
      `Resource page for the first ${displayDesignatorPath} KnopInventory historical state.`,
    ),
    simplePage(
      `${knopPath}/_inventory/_history001/_s0001/inventory-ttl/index.html`,
      `Resource page for the Turtle manifestation of the first ${displayDesignatorPath} KnopInventory historical state.`,
    ),
  ];
}

function buildFirstPayloadWeavePages(
  designatorPath: string,
  payloadLayout: PayloadVersionLayout,
  workingFilePath: string,
): readonly ResourcePageModel[] {
  const knopPath = toKnopPath(designatorPath);
  const designatorPagePath = toDesignatorResourcePagePath(designatorPath);
  const displayDesignatorPath = formatDesignatorPathForDisplay(designatorPath);
  const payloadManifestationPath = toPayloadManifestationPath(
    payloadLayout.nextStatePath,
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
      designatorPagePath,
      designatorPath,
      workingFilePath,
    ),
    simplePage(
      `${payloadLayout.historyPath}/index.html`,
      `Resource page for the current explicit history of the ${displayDesignatorPath} payload artifact.`,
    ),
    simplePage(
      `${payloadLayout.nextStatePath}/index.html`,
      `Resource page for the first historical state of the ${displayDesignatorPath} payload artifact.`,
    ),
    simplePage(
      `${payloadManifestationPath}/index.html`,
      `Resource page for the Turtle manifestation of the first ${displayDesignatorPath} payload historical state.`,
    ),
    simplePage(
      `${knopPath}/index.html`,
      `Resource page for the Knop associated with the ${displayDesignatorPath} designator.`,
    ),
    simplePage(
      `${knopPath}/_meta/index.html`,
      `Resource page for the ${displayDesignatorPath} KnopMetadata artifact.`,
    ),
    simplePage(
      `${knopPath}/_meta/_history001/index.html`,
      `Resource page for the current explicit history of the ${displayDesignatorPath} KnopMetadata artifact.`,
    ),
    simplePage(
      `${knopPath}/_meta/_history001/_s0001/index.html`,
      `Resource page for the first ${displayDesignatorPath} KnopMetadata historical state.`,
    ),
    simplePage(
      `${knopPath}/_meta/_history001/_s0001/meta-ttl/index.html`,
      `Resource page for the Turtle manifestation of the first ${displayDesignatorPath} KnopMetadata historical state.`,
    ),
    simplePage(
      `${knopPath}/_inventory/index.html`,
      `Resource page for the ${displayDesignatorPath} KnopInventory artifact.`,
    ),
    simplePage(
      `${knopPath}/_inventory/_history001/index.html`,
      `Resource page for the current explicit history of the ${displayDesignatorPath} KnopInventory artifact.`,
    ),
    simplePage(
      `${knopPath}/_inventory/_history001/_s0001/index.html`,
      `Resource page for the first ${displayDesignatorPath} KnopInventory historical state.`,
    ),
    simplePage(
      `${knopPath}/_inventory/_history001/_s0001/inventory-ttl/index.html`,
      `Resource page for the Turtle manifestation of the first ${displayDesignatorPath} KnopInventory historical state.`,
    ),
  ];
}

function buildFirstReferenceCatalogWeavePages(
  designatorPath: string,
  workingFilePath: string,
  currentLinks: readonly ReferenceCatalogCurrentLinkModel[],
): readonly ResourcePageModel[] {
  const knopPath = toKnopPath(designatorPath);
  const referenceCatalogPath = toReferenceCatalogPath(designatorPath);
  const displayDesignatorPath = formatDesignatorPathForDisplay(designatorPath);
  const referenceCatalogManifestationPath = toArtifactManifestationPath(
    `${referenceCatalogPath}/_history001/_s0001`,
    workingFilePath,
  );

  return [
    simplePage(
      `${knopPath}/_inventory/_history001/_s0002/index.html`,
      `Resource page for the second ${displayDesignatorPath} KnopInventory historical state.`,
    ),
    simplePage(
      `${knopPath}/_inventory/_history001/_s0002/inventory-ttl/index.html`,
      `Resource page for the Turtle manifestation of the second ${displayDesignatorPath} KnopInventory historical state.`,
    ),
    referenceCatalogPage(
      `${referenceCatalogPath}/index.html`,
      referenceCatalogPath,
      designatorPath,
      currentLinks,
    ),
    simplePage(
      `${referenceCatalogPath}/_history001/index.html`,
      `Resource page for the current explicit history of the ${displayDesignatorPath} ReferenceCatalog artifact.`,
    ),
    simplePage(
      `${referenceCatalogPath}/_history001/_s0001/index.html`,
      `Resource page for the first ${displayDesignatorPath} ReferenceCatalog historical state.`,
    ),
    simplePage(
      `${referenceCatalogManifestationPath}/index.html`,
      `Resource page for the Turtle manifestation of the first ${displayDesignatorPath} ReferenceCatalog historical state.`,
    ),
  ];
}

function buildFirstPageDefinitionWeavePages(
  designatorPath: string,
): readonly ResourcePageModel[] {
  const knopPath = toKnopPath(designatorPath);
  const designatorPagePath = toDesignatorResourcePagePath(designatorPath);
  const displayDesignatorPath = formatDesignatorPathForDisplay(designatorPath);
  const pageDefinitionPath = `${knopPath}/_page`;

  return [
    identifierPage(designatorPagePath, designatorPath),
    simplePage(
      `${knopPath}/_inventory/_history001/_s0003/index.html`,
      `Resource page for the third ${displayDesignatorPath} KnopInventory historical state.`,
    ),
    simplePage(
      `${knopPath}/_inventory/_history001/_s0003/inventory-ttl/index.html`,
      `Resource page for the Turtle manifestation of the third ${displayDesignatorPath} KnopInventory historical state.`,
    ),
    simplePage(
      `${pageDefinitionPath}/index.html`,
      `Resource page for the ${displayDesignatorPath} ResourcePageDefinition artifact.`,
    ),
    simplePage(
      `${pageDefinitionPath}/_history001/index.html`,
      `Resource page for the current explicit history of the ${displayDesignatorPath} ResourcePageDefinition artifact.`,
    ),
    simplePage(
      `${pageDefinitionPath}/_history001/_s0001/index.html`,
      `Resource page for the first ${displayDesignatorPath} ResourcePageDefinition historical state.`,
    ),
    simplePage(
      `${pageDefinitionPath}/_history001/_s0001/page-ttl/index.html`,
      `Resource page for the Turtle manifestation of the first ${displayDesignatorPath} ResourcePageDefinition historical state.`,
    ),
  ];
}

function buildSecondPayloadWeavePages(
  designatorPath: string,
  payloadLayout: PayloadVersionLayout,
  workingFilePath: string,
): readonly ResourcePageModel[] {
  const knopPath = toKnopPath(designatorPath);
  const displayDesignatorPath = formatDesignatorPathForDisplay(designatorPath);
  const payloadManifestationPath = toPayloadManifestationPath(
    payloadLayout.nextStatePath,
    workingFilePath,
  );

  return [
    simplePage(
      `${payloadLayout.nextStatePath}/index.html`,
      `Resource page for the second historical state of the ${displayDesignatorPath} payload artifact.`,
    ),
    simplePage(
      `${payloadManifestationPath}/index.html`,
      `Resource page for the Turtle manifestation of the second ${displayDesignatorPath} payload historical state.`,
    ),
    simplePage(
      `${knopPath}/_inventory/_history001/_s0002/index.html`,
      `Resource page for the second historical state of the ${displayDesignatorPath} KnopInventory artifact.`,
    ),
    simplePage(
      `${knopPath}/_inventory/_history001/_s0002/inventory-ttl/index.html`,
      `Resource page for the Turtle manifestation of the second ${displayDesignatorPath} KnopInventory historical state.`,
    ),
  ];
}

function resolveFirstPayloadVersionLayout(
  designatorPath: string,
  target?: NormalizedVersionTargetSpec,
): PayloadVersionLayout {
  const historyPath = appendMeshPath(
    designatorPath,
    target?.historySegment ?? "_history001",
  );
  const nextStatePath = `${historyPath}/${target?.stateSegment ?? "_s0001"}`;

  return {
    historyPath,
    nextStatePath,
  };
}

function resolveSecondPayloadVersionLayout(
  designatorPath: string,
  payloadArtifact: PayloadWorkingArtifact,
  target?: NormalizedVersionTargetSpec,
): PayloadVersionLayout {
  const historyPath = requirePayloadHistoryPath(
    designatorPath,
    payloadArtifact,
  );
  const currentStatePath = requirePayloadCurrentStatePath(
    designatorPath,
    payloadArtifact,
    historyPath,
  );
  const requestedHistoryPath = target?.historySegment
    ? appendMeshPath(designatorPath, target.historySegment)
    : undefined;

  if (
    requestedHistoryPath !== undefined && requestedHistoryPath !== historyPath
  ) {
    throw new WeaveInputError(
      `Requested payload historySegment ${
        target!.historySegment
      } does not match the current payload history for ${designatorPath}: ${
        toLastPathSegment(historyPath)
      }`,
    );
  }

  const nextStatePath = `${historyPath}/${target?.stateSegment ?? "_s0002"}`;
  if (nextStatePath === currentStatePath) {
    throw new WeaveInputError(
      `Requested payload stateSegment ${
        toLastPathSegment(nextStatePath)
      } already names the current historical state for ${designatorPath}.`,
    );
  }

  return {
    historyPath,
    currentStatePath,
    nextStatePath,
  };
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

function referenceCatalogPage(
  path: string,
  catalogPath: string,
  ownerDesignatorPath: string,
  currentLinks: readonly ReferenceCatalogCurrentLinkModel[],
): ReferenceCatalogResourcePageModel {
  return {
    kind: "referenceCatalog",
    path,
    catalogPath,
    ownerDesignatorPath,
    currentLinks,
  };
}

function toPayloadManifestationPath(
  payloadStatePath: string,
  workingFilePath: string,
): string {
  return toArtifactManifestationPath(
    payloadStatePath,
    workingFilePath,
  );
}

function toArtifactManifestationPath(
  historyStatePath: string,
  workingFilePath: string,
): string {
  return `${historyStatePath}/${toManifestationSegment(workingFilePath)}`;
}

function toManifestationSegment(workingFilePath: string): string {
  return toFileName(workingFilePath).replaceAll(".", "-");
}

function toFileName(path: string): string {
  const segments = path.split("/");
  return segments[segments.length - 1]!;
}

function requirePayloadHistoryPath(
  designatorPath: string,
  payloadArtifact: PayloadWorkingArtifact,
): string {
  const historyPath = payloadArtifact.currentArtifactHistoryPath;
  if (!historyPath) {
    throw new WeaveInputError(
      `Could not resolve the current payload history for ${designatorPath}.`,
    );
  }
  if (!isDirectChildMeshPath(designatorPath, historyPath)) {
    throw new WeaveInputError(
      `Current payload history for ${designatorPath} was outside the payload designator path: ${historyPath}`,
    );
  }

  return historyPath;
}

function requirePayloadCurrentStatePath(
  designatorPath: string,
  payloadArtifact: PayloadWorkingArtifact,
  historyPath: string,
): string {
  const currentStatePath = payloadArtifact.latestHistoricalStatePath;
  if (!currentStatePath) {
    throw new WeaveInputError(
      `Could not resolve the current payload historical state for ${designatorPath}.`,
    );
  }
  if (!currentStatePath.startsWith(`${historyPath}/`)) {
    throw new WeaveInputError(
      `Current payload historical state for ${designatorPath} was outside the current payload history: ${currentStatePath}`,
    );
  }

  return currentStatePath;
}

function requirePayloadCurrentStatePathFromInventory(
  quads: readonly Quad[],
  meshBase: string,
  designatorPath: string,
  historyPath: string,
  errorMessage: string,
): string {
  const currentStatePath = resolveOptionalNamedNodePath(
    quads,
    meshBase,
    historyPath,
    SFLO_LATEST_HISTORICAL_STATE_IRI,
    errorMessage,
  );
  if (!currentStatePath) {
    throw new WeaveInputError(errorMessage);
  }
  if (!currentStatePath.startsWith(`${historyPath}/`)) {
    throw new WeaveInputError(
      `Current payload historical state for ${designatorPath} was outside the current payload history: ${currentStatePath}`,
    );
  }

  return currentStatePath;
}

function resolveOptionalNamedNodePath(
  quads: readonly Quad[],
  meshBase: string,
  subjectValue: string,
  predicateIri: string,
  errorMessage: string,
): string | undefined {
  const objectIri = requireOptionalNamedNodeObject(
    quads,
    toAbsoluteIri(meshBase, subjectValue),
    predicateIri,
    errorMessage,
  );

  return objectIri
    ? toMeshRelativePath(meshBase, objectIri, errorMessage)
    : undefined;
}

function toHistoryPathFromStatePath(statePath: string): string {
  return statePath.slice(0, statePath.lastIndexOf("/"));
}

function toLastPathSegment(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1);
}

function toReferenceRoleLabel(referenceRoleIri: string): string {
  const segments = referenceRoleIri.split("/");
  return (segments[segments.length - 1] ?? referenceRoleIri).toLowerCase();
}
