import type { Quad } from "n3";
import {
  formatDesignatorPathForDisplay,
  toDesignatorResourcePagePath,
  toKnopPath,
  toReferenceCatalogPath,
} from "../designator_segments.ts";
import {
  type NormalizedVersionTargetSpec,
  normalizeVersionTargetSpecs,
  resolveTargetSelections,
} from "../targeting.ts";
import {
  deriveMeshLabel,
  escapeHtml,
  toRelativeHref,
  toResourcePath,
} from "./html.ts";
import type { WeaveNamingPolicies } from "./naming_policy.ts";
import {
  filterResourcePageFactsFromPlannedFiles,
  hasResourcePageGenerationPolicyOverrides,
  listGeneratedResourcePagePaths,
  type WeaveResourcePageGenerationPolicies,
} from "./resource_page_policy.ts";
import {
  SFLO_NAMESPACE,
  SFLO_TURTLE_PREFIX_DECLARATION,
} from "../rdf/namespaces.ts";
import { WeaveInputError } from "./errors.ts";
import {
  shouldMaterializeSupportHistory,
  type SupportArtifactHistoryPolicy,
  type WeaveSupportHistoryPolicies,
} from "./support_history_policy.ts";
import type { VersionPlan } from "./version_plan.ts";
import type { RepositorySourceFloatingLocator } from "./source_models.ts";
import type {
  ExtractionSourceEvidenceModel,
  ResourcePageDefinitionWorkingArtifact,
  WeaveableKnopCandidate,
} from "./candidates.ts";
import type { PlanWeaveInput, WeavePlan } from "./planning_models.ts";
import type {
  MeshInventoryProgression,
  PageDefinitionWeaveProgression,
} from "./progression_models.ts";
import type { WeaveSlice } from "./slices.ts";
import { toArtifactManifestationPath } from "./artifact_manifestation_paths.ts";
import {
  assertOverwriteExistingStateTargets,
  planOverwriteExistingPayloadState,
} from "./payload_overwrite.ts";
import {
  type PayloadVersionLayout,
  resolveFirstPayloadVersionLayout,
  resolveSecondPayloadVersionLayout,
} from "./payload_version_layout.ts";
import {
  hasNamedNodeFact,
  parseWeaveShapeQuads,
  requireLiteralValue,
  requireNamedNodePath,
  requireOptionalNamedNodeObject,
  requireSingleNamedNodeObject,
  requireSingleNonNegativeIntegerLiteral,
  resolveNamedNodeObjectPaths,
  resolveOptionalLiteralObject,
  resolveOptionalNamedNodePath,
  resolveOptionalNonNegativeIntegerLiteral,
  toAbsoluteIri,
  toMeshRelativePath,
} from "./rdf_helpers.ts";
import {
  appendPredicateToSubjectBlock,
  collectSubjectSubtreeBlocks,
  findSubjectBlockIndex,
  getSubjectPathFromBlock,
  normalizeMeshInventoryHeader,
  renderSubjectPredicateBlock,
  replaceSubjectBlock,
  splitTurtleBlocks,
  upsertSubjectBlockAfter,
} from "./turtle_blocks.ts";
import { classifyWeaveSlice } from "./slice_classification.ts";
import { extractCurrentReferenceCatalogLinks } from "./reference_catalog_links.ts";
import {
  buildCurrentOnlyReferenceCatalogWeavePages,
  buildFirstExtractedKnopWeavePages,
  buildFirstKnopWeavePages,
  buildFirstPayloadWeavePages,
  buildFirstReferenceCatalogWeavePages,
  buildSecondPayloadWeavePages,
  buildSubsequentPageDefinitionWeavePages,
} from "./resource_page_builders.ts";
import { assertHasCurrentWorkingFileLocator } from "./source_locator_assertions.ts";
import {
  renderCurrentWorkingFileDeclaration,
  renderCurrentWorkingFileLocator,
} from "./source_locator_renderers.ts";
import {
  assertCurrentKnopInventoryBaseShape,
  assertCurrentKnopInventoryShapeForFirstExtractedKnopWeave,
  assertCurrentKnopInventoryShapeForFirstPageDefinitionWeave,
  assertCurrentKnopInventoryShapeForFirstReferenceCatalogWeave,
  assertCurrentKnopInventoryShapeForSecondPayloadWeave,
  assertCurrentKnopInventoryShapeForSubsequentPageDefinitionWeave,
  assertCurrentKnopInventoryWithoutHistory,
  assertCurrentKnopMetadataShape,
  assertCurrentMeshInventoryShapeForFirstExtractedKnopWeave,
  assertCurrentMeshInventoryShapeForFirstReferenceCatalogWeave,
  assertCurrentPayloadArtifactShape,
  assertCurrentSourceRegistryShapeForFirstExtractedKnopWeave,
  assertHasNamedNodeFacts,
  assertReferenceTargetSourcePayloadShapeForFirstExtractedKnopWeave,
  resolveMeshInventoryProgressionFromMetadata,
} from "./shape_assertions.ts";

export { WeaveInputError } from "./errors.ts";
export { planMeshSupportResourcePages } from "./mesh_support_pages.ts";
export { detectPendingWeaveSlice } from "./slice_classification.ts";
export type {
  HistoryNamingPolicy,
  ManifestationNamingPolicy,
  StateNamingPolicy,
  WeaveNamingPolicies,
} from "./naming_policy.ts";
export type {
  WeaveResourcePageGenerationPolicies,
  WeaveResourcePageGenerationPolicy,
} from "./resource_page_policy.ts";
export type {
  MeshSupportHistoryPolicies,
  SupportArtifactHistoryPolicy,
  WeaveSupportHistoryPolicies,
} from "./support_history_policy.ts";
export type { PlanMeshSupportResourcePagesInput } from "./mesh_support_pages.ts";
export type {
  CustomIdentifierRegionResourcePageModel,
  CustomIdentifierResourcePageModel,
  IdentifierResourcePageModel,
  KnopArtifactLinkModel,
  KnopResourcePageModel,
  ReferenceCatalogCurrentLinkModel,
  ReferenceCatalogResourcePageModel,
  ResourcePageChildIdentifierModel,
  ResourcePageExtractionSourceModel,
  ResourcePageHistoryGroupModel,
  ResourcePageHistoryStateModel,
  ResourcePageModel,
  ResourcePageRawSourcePanelModel,
  ResourcePageReferenceLinkModel,
  ResourcePageReferenceTargetModel,
  SimpleResourcePageModel,
} from "./resource_page_models.ts";
export type { RepositorySourceFloatingLocator } from "./source_models.ts";
export type {
  GenerateRequest,
  ValidateRequest,
  VersionRequest,
  WeaveRequest,
} from "./requests.ts";
export type {
  ExtractionSourceEvidenceModel,
  PayloadWorkingArtifact,
  ReferenceCatalogWorkingArtifact,
  ReferenceTargetSourcePayloadArtifact,
  ResourcePageDefinitionWorkingArtifact,
  WeaveableKnopCandidate,
} from "./candidates.ts";
export type { PlanWeaveInput, WeavePlan } from "./planning_models.ts";
export type { WeaveSlice } from "./slices.ts";
export type { VersionPlan } from "./version_plan.ts";

const RDF_TYPE_IRI = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type";
const SFLO_HAS_EXTRACTION_SOURCE_IRI = `${SFLO_NAMESPACE}hasExtractionSource`;
const SFLO_HAS_KNOP_ASSET_BUNDLE_IRI = `${SFLO_NAMESPACE}hasKnopAssetBundle`;
const SFLO_HAS_RESOURCE_PAGE_DEFINITION_IRI =
  `${SFLO_NAMESPACE}hasResourcePageDefinition`;
const SFLO_KNOP_ASSET_BUNDLE_IRI = `${SFLO_NAMESPACE}KnopAssetBundle`;
const SFLO_RESOURCE_PAGE_DEFINITION_IRI =
  `${SFLO_NAMESPACE}ResourcePageDefinition`;
const SFLO_CURRENT_ARTIFACT_HISTORY_IRI =
  `${SFLO_NAMESPACE}currentArtifactHistory`;
const SFLO_DIGITAL_ARTIFACT_IRI = `${SFLO_NAMESPACE}DigitalArtifact`;
const SFLO_HAS_ARTIFACT_HISTORY_IRI = `${SFLO_NAMESPACE}hasArtifactHistory`;
const SFLO_HAS_MANIFESTATION_IRI = `${SFLO_NAMESPACE}hasManifestation`;
const SFLO_HAS_KNOP_IRI = `${SFLO_NAMESPACE}hasKnop`;
const SFLO_HAS_HISTORICAL_STATE_IRI = `${SFLO_NAMESPACE}hasHistoricalState`;
const SFLO_HAS_KNOP_INVENTORY_IRI = `${SFLO_NAMESPACE}hasKnopInventory`;
const SFLO_HAS_KNOP_METADATA_IRI = `${SFLO_NAMESPACE}hasKnopMetadata`;
const SFLO_HAS_KNOP_SOURCE_REGISTRY_IRI =
  `${SFLO_NAMESPACE}hasKnopSourceRegistry`;
const SFLO_HAS_REFERENCE_CATALOG_IRI = `${SFLO_NAMESPACE}hasReferenceCatalog`;
const SFLO_HAS_RESOURCE_PAGE_IRI = `${SFLO_NAMESPACE}hasResourcePage`;
const SFLO_HAS_WORKING_KNOP_INVENTORY_FILE_IRI =
  `${SFLO_NAMESPACE}hasWorkingKnopInventoryFile`;
const SFLO_HAS_WORKING_LOCATED_FILE_IRI =
  `${SFLO_NAMESPACE}hasWorkingLocatedFile`;
const SFLO_WORKING_FILE_PATH_IRI = `${SFLO_NAMESPACE}workingLocalRelativePath`;
const SFLO_KNOP_IRI = `${SFLO_NAMESPACE}Knop`;
const SFLO_KNOP_INVENTORY_IRI = `${SFLO_NAMESPACE}KnopInventory`;
const SFLO_KNOP_SOURCE_REGISTRY_IRI = `${SFLO_NAMESPACE}KnopSourceRegistry`;
const SFLO_LATEST_HISTORICAL_STATE_IRI =
  `${SFLO_NAMESPACE}latestHistoricalState`;
const SFLO_MESH_INVENTORY_IRI = `${SFLO_NAMESPACE}MeshInventory`;
const SFLO_NEXT_STATE_ORDINAL_IRI = `${SFLO_NAMESPACE}nextStateOrdinal`;
const SFLO_PAYLOAD_ARTIFACT_IRI = `${SFLO_NAMESPACE}PayloadArtifact`;
const SFLO_RDF_DOCUMENT_IRI = `${SFLO_NAMESPACE}RdfDocument`;
const SFLO_REFERENCE_CATALOG_IRI = `${SFLO_NAMESPACE}ReferenceCatalog`;

interface SelectedWeaveableKnopCandidate {
  candidate: WeaveableKnopCandidate;
  target?: NormalizedVersionTargetSpec;
}

export function planWeave(input: PlanWeaveInput): WeavePlan {
  const meshBase = normalizeMeshBase(input.meshBase);
  const requestedTargets = normalizeVersionTargetSpecs(
    input.request.targets,
    "request.targets",
    (message) => new WeaveInputError(message),
  );
  const overwriteExistingState = input.request.overwriteExistingState === true;
  assertOverwriteExistingStateTargets(
    requestedTargets,
    overwriteExistingState,
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

  const slice = classifyWeaveSlice(meshBase, candidate, target);
  assertPayloadNamingSupportedForSlice(slice, designatorPath, target);

  const plan = overwriteExistingState
    ? planOverwriteExistingPayloadState(
      meshBase,
      candidate,
      target,
      input.namingPolicies,
    )
    : (() => {
      switch (slice) {
        case "firstKnopWeave":
          return planFirstKnopWeave(
            meshBase,
            input.currentMeshInventoryTurtle,
            input.currentMeshMetadataTurtle,
            candidate,
            input.supportHistoryPolicies,
          );
        case "firstPayloadWeave":
          return planFirstPayloadWeave(
            meshBase,
            input.currentMeshInventoryTurtle,
            input.currentMeshMetadataTurtle,
            candidate,
            target,
            input.supportHistoryPolicies,
            input.namingPolicies,
          );
        case "firstExtractedKnopWeave":
          return planFirstExtractedKnopWeave(
            meshBase,
            input.currentMeshInventoryTurtle,
            input.currentMeshMetadataTurtle,
            candidate,
            input.supportHistoryPolicies,
          );
        case "firstReferenceCatalogWeave":
          return planFirstReferenceCatalogWeave(
            meshBase,
            input.currentMeshInventoryTurtle,
            input.currentMeshMetadataTurtle,
            candidate,
            input.supportHistoryPolicies,
          );
        case "pageDefinitionWeave":
          return planPageDefinitionWeave(
            meshBase,
            input.currentMeshInventoryTurtle,
            candidate,
          );
        case "secondPayloadWeave":
          return planSecondPayloadWeave(
            meshBase,
            candidate,
            target,
            input.supportHistoryPolicies,
            input.namingPolicies,
          );
        default:
          throw new WeaveInputError(
            `No supported local weave slice was found for ${designatorPath}.`,
          );
      }
    })();

  return applyResourcePageGenerationPolicies(plan, {
    policies: input.resourcePageGenerationPolicies,
    explicitRequest: requestedTargets.length > 0,
  });
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

function applyResourcePageGenerationPolicies(
  plan: WeavePlan,
  options: {
    policies?: WeaveResourcePageGenerationPolicies;
    explicitRequest?: boolean;
  },
): WeavePlan {
  if (!hasResourcePageGenerationPolicyOverrides(options.policies)) {
    return plan;
  }

  const createdFiles = filterResourcePageFactsFromPlannedFiles(
    plan.meshBase,
    plan.createdFiles,
    options.policies,
    options.explicitRequest ?? false,
  );
  const updatedFiles = filterResourcePageFactsFromPlannedFiles(
    plan.meshBase,
    plan.updatedFiles,
    options.policies,
    options.explicitRequest ?? false,
  );
  const generatedPagePaths = new Set(
    [...createdFiles, ...updatedFiles].flatMap((file) =>
      file.path.endsWith("inventory.ttl")
        ? listGeneratedResourcePagePaths({
          meshBase: plan.meshBase,
          inventoryTurtle: file.contents,
          parseErrorMessage:
            `Could not parse ${file.path} while filtering planned ResourcePages.`,
          policies: options.policies,
          explicitRequest: options.explicitRequest ?? false,
        })
        : []
    ),
  );

  return {
    ...plan,
    createdFiles,
    updatedFiles,
    createdPages: plan.createdPages.filter((page) =>
      generatedPagePaths.has(page.path)
    ),
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

function currentKnopInventoryHasVersionedHistory(
  meshBase: string,
  currentKnopInventoryTurtle: string,
  knopPath: string,
): boolean {
  const quads = parseWeaveShapeQuads(
    meshBase,
    currentKnopInventoryTurtle,
    `Could not parse the current KnopInventory while checking support history for ${knopPath}.`,
  );
  return hasNamedNodeFact(
    quads,
    meshBase,
    `${knopPath}/_inventory`,
    SFLO_HAS_ARTIFACT_HISTORY_IRI,
    `${knopPath}/_inventory/_history001`,
  );
}

function assertPayloadNamingSupportedForSlice(
  slice: WeaveSlice | undefined,
  designatorPath: string,
  target?: NormalizedVersionTargetSpec,
): void {
  if (
    !target ||
    (target.historySegment === undefined &&
      target.stateSegment === undefined &&
      target.manifestationSegment === undefined)
  ) {
    return;
  }

  if (slice === "firstPayloadWeave" || slice === "secondPayloadWeave") {
    return;
  }
  if (target.recursive) {
    return;
  }

  throw new WeaveInputError(
    `historySegment, stateSegment, and manifestationSegment are only supported for payload versioning; ${designatorPath} is currently ${
      slice ?? "not weaveable"
    }.`,
  );
}

function planFirstKnopWeave(
  meshBase: string,
  currentMeshInventoryTurtle: string,
  currentMeshMetadataTurtle: string | undefined,
  candidate: WeaveableKnopCandidate,
  supportHistoryPolicies?: WeaveSupportHistoryPolicies,
): WeavePlan {
  assertCurrentKnopInventoryWithoutHistory(
    meshBase,
    candidate.currentKnopInventoryTurtle,
    toKnopPath(candidate.designatorPath),
  );
  const meshInventoryHistoryPolicy = supportHistoryPolicies?.meshInventory ??
    "versioned";
  const versionMeshInventory = shouldMaterializeSupportHistory(
    meshInventoryHistoryPolicy,
  );
  const meshInventoryProgression = versionMeshInventory
    ? resolveCurrentMeshInventoryProgressionForFirstKnopWeave(
      meshBase,
      currentMeshInventoryTurtle,
      currentMeshMetadataTurtle,
      candidate.designatorPath,
    )
    : undefined;

  const designatorPath = candidate.designatorPath;
  const knopPath = toKnopPath(designatorPath);
  const knopMetadataHistoryPolicy = supportHistoryPolicies?.knopMetadata ??
    "versioned";
  const versionKnopMetadata = shouldMaterializeSupportHistory(
    knopMetadataHistoryPolicy,
  );
  const wovenKnopInventoryTurtle =
    renderKnopInventoryWithPreservedSupportArtifacts({
      meshBase,
      currentKnopInventoryTurtle: candidate.currentKnopInventoryTurtle,
      renderedKnopInventoryTurtle: renderFirstKnopWovenKnopInventoryTurtle(
        meshBase,
        designatorPath,
        { knopMetadataHistoryPolicy },
      ),
      knopPath,
    });
  const wovenMeshInventoryTurtle = meshInventoryProgression === undefined
    ? renderFirstPayloadWovenCurrentOnlyMeshInventoryTurtle(
      currentMeshInventoryTurtle,
      meshBase,
      designatorPath,
    )
    : renderFirstKnopWovenMeshInventoryTurtle(
      currentMeshInventoryTurtle,
      meshBase,
      designatorPath,
      meshInventoryProgression,
    );

  return {
    meshBase,
    wovenDesignatorPaths: [designatorPath],
    createdFiles: [
      ...(meshInventoryProgression === undefined ? [] : [{
        path: `${meshInventoryProgression.nextStatePath}/ttl/inventory.ttl`,
        contents: wovenMeshInventoryTurtle,
      }]),
      ...(versionKnopMetadata
        ? [{
          path: `${knopPath}/_meta/_history001/_s0001/ttl/meta.ttl`,
          contents: candidate.currentKnopMetadataTurtle,
        }]
        : []),
      {
        path: `${knopPath}/_inventory/_history001/_s0001/ttl/inventory.ttl`,
        contents: wovenKnopInventoryTurtle,
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
      ...(meshInventoryProgression === undefined ? [] : [{
        path: "_mesh/_meta/meta.ttl",
        contents: renderMeshMetadataWithMeshInventoryProgression(
          currentMeshMetadataTurtle,
          meshInventoryProgression,
        ),
      }]),
    ],
    createdPages: buildFirstKnopWeavePages(
      designatorPath,
      meshInventoryProgression,
      { knopMetadataHistoryPolicy },
    ),
  };
}

function planFirstPayloadWeave(
  meshBase: string,
  currentMeshInventoryTurtle: string,
  currentMeshMetadataTurtle: string | undefined,
  candidate: WeaveableKnopCandidate,
  target?: NormalizedVersionTargetSpec,
  supportHistoryPolicies?: WeaveSupportHistoryPolicies,
  namingPolicies?: WeaveNamingPolicies,
): WeavePlan {
  const payloadArtifact = candidate.payloadArtifact!;
  assertCurrentKnopInventoryWithoutHistory(
    meshBase,
    candidate.currentKnopInventoryTurtle,
    toKnopPath(candidate.designatorPath),
  );
  const meshInventoryHistoryPolicy = supportHistoryPolicies?.meshInventory ??
    "versioned";
  const versionMeshInventory = shouldMaterializeSupportHistory(
    meshInventoryHistoryPolicy,
  );
  const meshInventoryProgression = versionMeshInventory
    ? resolveCurrentMeshInventoryProgressionForFirstPayloadWeave(
      meshBase,
      currentMeshInventoryTurtle,
      currentMeshMetadataTurtle,
      candidate.designatorPath,
    )
    : undefined;
  assertCurrentPayloadArtifactShape(
    meshBase,
    candidate.currentKnopInventoryTurtle,
    candidate.designatorPath,
    payloadArtifact,
  );

  const designatorPath = candidate.designatorPath;
  const knopPath = toKnopPath(designatorPath);
  const payloadLayout = resolveFirstPayloadVersionLayout(
    meshBase,
    designatorPath,
    payloadArtifact.workingLocalRelativePath,
    candidate.currentKnopInventoryTurtle,
    payloadArtifact.currentArtifactHistoryPath,
    target,
    namingPolicies,
  );
  const payloadSnapshotPath = `${payloadLayout.nextManifestationPath}/${
    toFileName(payloadArtifact.workingLocalRelativePath)
  }`;
  const knopMetadataHistoryPolicy = supportHistoryPolicies?.knopMetadata ??
    "versioned";
  const versionKnopMetadata = shouldMaterializeSupportHistory(
    knopMetadataHistoryPolicy,
  );
  const knopInventoryHistoryPolicy = supportHistoryPolicies?.knopInventory ??
    "versioned";
  const versionKnopInventory = shouldMaterializeSupportHistory(
    knopInventoryHistoryPolicy,
  );
  const wovenKnopInventoryTurtle =
    renderKnopInventoryWithPreservedSupportArtifacts({
      meshBase,
      currentKnopInventoryTurtle: candidate.currentKnopInventoryTurtle,
      renderedKnopInventoryTurtle: renderFirstPayloadWovenKnopInventoryTurtle(
        meshBase,
        designatorPath,
        payloadLayout,
        payloadArtifact.workingLocalRelativePath,
        payloadArtifact.repositorySourceFloatingLocator,
        { knopMetadataHistoryPolicy, knopInventoryHistoryPolicy },
      ),
      knopPath,
    });
  const wovenMeshInventoryTurtle = meshInventoryProgression === undefined
    ? renderFirstPayloadWovenCurrentOnlyMeshInventoryTurtle(
      currentMeshInventoryTurtle,
      meshBase,
      designatorPath,
    )
    : renderFirstPayloadWovenMeshInventoryTurtle(
      currentMeshInventoryTurtle,
      meshBase,
      designatorPath,
      payloadArtifact.workingLocalRelativePath,
      meshInventoryProgression,
      payloadArtifact.repositorySourceFloatingLocator,
    );

  return {
    meshBase,
    wovenDesignatorPaths: [designatorPath],
    createdFiles: [
      ...(meshInventoryProgression === undefined ? [] : [{
        path: `${meshInventoryProgression.nextStatePath}/ttl/inventory.ttl`,
        contents: wovenMeshInventoryTurtle,
      }]),
      {
        path: payloadSnapshotPath,
        contents: payloadArtifact.currentPayloadTurtle,
      },
      ...(versionKnopMetadata
        ? [{
          path: `${knopPath}/_meta/_history001/_s0001/ttl/meta.ttl`,
          contents: candidate.currentKnopMetadataTurtle,
        }]
        : []),
      ...(versionKnopInventory
        ? [{
          path: `${knopPath}/_inventory/_history001/_s0001/ttl/inventory.ttl`,
          contents: wovenKnopInventoryTurtle,
        }]
        : []),
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
      ...(meshInventoryProgression === undefined ? [] : [{
        path: "_mesh/_meta/meta.ttl",
        contents: renderMeshMetadataWithMeshInventoryProgression(
          currentMeshMetadataTurtle,
          meshInventoryProgression,
        ),
      }]),
    ],
    createdPages: buildFirstPayloadWeavePages(
      designatorPath,
      payloadLayout,
      payloadArtifact.workingLocalRelativePath,
      meshInventoryProgression,
      {
        workingAccessUrl: payloadArtifact.workingAccessUrl,
        repositorySourceFloatingLocator:
          payloadArtifact.repositorySourceFloatingLocator,
        knopMetadataHistoryPolicy,
        knopInventoryHistoryPolicy,
      },
    ),
  };
}

function planFirstExtractedKnopWeave(
  meshBase: string,
  currentMeshInventoryTurtle: string,
  currentMeshMetadataTurtle: string | undefined,
  candidate: WeaveableKnopCandidate,
  supportHistoryPolicies?: WeaveSupportHistoryPolicies,
): WeavePlan {
  const designatorPath = candidate.designatorPath;
  const knopPath = toKnopPath(designatorPath);
  const displayDesignatorPath = formatDesignatorPathForDisplay(designatorPath);
  const referenceTargetSourcePayloadArtifact = candidate
    .referenceTargetSourcePayloadArtifact!;
  const meshInventoryHistoryPolicy = supportHistoryPolicies?.meshInventory ??
    "versioned";
  const versionMeshInventory = shouldMaterializeSupportHistory(
    meshInventoryHistoryPolicy,
  );
  const meshInventoryProgression = versionMeshInventory
    ? resolveCurrentMeshInventoryProgressionForFirstKnopWeave(
      meshBase,
      currentMeshInventoryTurtle,
      currentMeshMetadataTurtle,
      designatorPath,
    )
    : undefined;
  const sourcePayloadTurtle =
    referenceTargetSourcePayloadArtifact.latestHistoricalSnapshotTurtle ??
      referenceTargetSourcePayloadArtifact.currentPayloadTurtle;
  const useAliceBioLegacyPages = designatorPath === "bob" &&
    referenceTargetSourcePayloadArtifact.designatorPath === "alice/bio";
  const knopMetadataHistoryPolicy = supportHistoryPolicies?.knopMetadata ??
    "versioned";
  const versionKnopMetadata = shouldMaterializeSupportHistory(
    knopMetadataHistoryPolicy,
  );
  const knopInventoryHistoryPolicy = supportHistoryPolicies?.knopInventory ??
    "versioned";
  const versionKnopInventory = shouldMaterializeSupportHistory(
    knopInventoryHistoryPolicy,
  );

  assertCurrentMeshInventoryShapeForFirstExtractedKnopWeave(
    meshBase,
    currentMeshInventoryTurtle,
    meshInventoryProgression,
    designatorPath,
    referenceTargetSourcePayloadArtifact.designatorPath,
    referenceTargetSourcePayloadArtifact,
  );
  assertCurrentKnopInventoryShapeForFirstExtractedKnopWeave(
    meshBase,
    candidate.currentKnopInventoryTurtle,
    designatorPath,
  );
  if (referenceTargetSourcePayloadArtifact.currentSourceRegistryTurtle) {
    assertCurrentSourceRegistryShapeForFirstExtractedKnopWeave(
      meshBase,
      referenceTargetSourcePayloadArtifact.currentSourceRegistryTurtle,
      designatorPath,
      referenceTargetSourcePayloadArtifact.designatorPath,
      referenceTargetSourcePayloadArtifact.latestHistoricalStatePath,
    );
  }
  assertReferenceTargetSourcePayloadShapeForFirstExtractedKnopWeave(
    referenceTargetSourcePayloadArtifact,
  );

  const wovenMeshInventoryTurtle = useAliceBioLegacyPages
    ? renderFirstExtractedKnopWovenMeshInventoryTurtle(
      currentMeshInventoryTurtle,
      designatorPath,
      referenceTargetSourcePayloadArtifact.designatorPath,
    )
    : meshInventoryProgression === undefined
    ? renderFirstPayloadWovenCurrentOnlyMeshInventoryTurtle(
      currentMeshInventoryTurtle,
      meshBase,
      designatorPath,
    )
    : renderGenericFirstExtractedKnopWovenMeshInventoryTurtle(
      currentMeshInventoryTurtle,
      designatorPath,
      meshInventoryProgression,
    );
  const wovenKnopInventoryTurtle =
    renderKnopInventoryWithPreservedSupportArtifacts({
      meshBase,
      currentKnopInventoryTurtle: candidate.currentKnopInventoryTurtle,
      renderedKnopInventoryTurtle:
        renderFirstExtractedKnopWovenKnopInventoryTurtle(
          meshBase,
          designatorPath,
          { knopMetadataHistoryPolicy, knopInventoryHistoryPolicy },
        ),
      knopPath,
    });
  const exactSourceRegistryTurtle =
    referenceTargetSourcePayloadArtifact.currentSourceRegistryTurtle &&
      referenceTargetSourcePayloadArtifact
        .sourceRegistryWorkingLocalRelativePath
      ? replaceExtractionSourceBlock(
        referenceTargetSourcePayloadArtifact.currentSourceRegistryTurtle,
        `${knopPath}/_sources#extraction-source`,
        renderExactExtractionSourceBlock(
          `${knopPath}/_sources#extraction-source`,
          referenceTargetSourcePayloadArtifact.designatorPath,
          referenceTargetSourcePayloadArtifact.latestHistoricalStatePath,
          referenceTargetSourcePayloadArtifact.sourceEvidence,
        ),
      )
      : undefined;

  return {
    meshBase,
    wovenDesignatorPaths: [designatorPath],
    createdFiles: [
      ...(meshInventoryProgression === undefined ? [] : [{
        path: `${meshInventoryProgression.nextStatePath}/ttl/inventory.ttl`,
        contents: wovenMeshInventoryTurtle,
      }]),
      ...(versionKnopMetadata
        ? [{
          path: `${knopPath}/_meta/_history001/_s0001/ttl/meta.ttl`,
          contents: candidate.currentKnopMetadataTurtle,
        }]
        : []),
      ...(versionKnopInventory
        ? [{
          path: `${knopPath}/_inventory/_history001/_s0001/ttl/inventory.ttl`,
          contents: wovenKnopInventoryTurtle,
        }]
        : []),
      {
        path: toDesignatorResourcePagePath(designatorPath),
        contents: useAliceBioLegacyPages
          ? renderExtractedPersonIdentifierPage(
            meshBase,
            designatorPath,
            referenceTargetSourcePayloadArtifact.designatorPath,
            toHistoryPathFromStatePath(
              referenceTargetSourcePayloadArtifact.latestHistoricalStatePath,
            ),
            referenceTargetSourcePayloadArtifact.workingLocalRelativePath,
            sourcePayloadTurtle,
          )
          : renderGenericExtractedIdentifierPage(meshBase, designatorPath),
      },
      ...(versionKnopMetadata
        ? [{
          path: `${knopPath}/_meta/_history001/index.html`,
          contents: renderArtifactHistoryIndexPage(meshBase, {
            pagePath: `${knopPath}/_meta/_history001/index.html`,
            description:
              `Resource page for the current explicit history of the ${displayDesignatorPath} KnopMetadata artifact.`,
            artifactLabel: "KnopMetadata artifact",
            workingLocalRelativePath: `${knopPath}/_meta/meta.ttl`,
            states: [{ segment: "_s0001", latest: true }],
          }),
        }]
        : []),
      ...(versionKnopInventory
        ? [{
          path: `${knopPath}/_inventory/_history001/index.html`,
          contents: renderArtifactHistoryIndexPage(meshBase, {
            pagePath: `${knopPath}/_inventory/_history001/index.html`,
            description:
              `Resource page for the current explicit history of the ${displayDesignatorPath} KnopInventory artifact.`,
            artifactLabel: "KnopInventory artifact",
            workingLocalRelativePath: `${knopPath}/_inventory/inventory.ttl`,
            states: [{ segment: "_s0001", latest: true }],
          }),
        }]
        : []),
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
      ...(exactSourceRegistryTurtle === undefined ? [] : [{
        path: referenceTargetSourcePayloadArtifact
          .sourceRegistryWorkingLocalRelativePath!,
        contents: exactSourceRegistryTurtle,
      }]),
      ...(meshInventoryProgression === undefined ? [] : [{
        path: "_mesh/_inventory/_history001/index.html",
        contents: renderArtifactHistoryIndexPage(meshBase, {
          pagePath: "_mesh/_inventory/_history001/index.html",
          description:
            "Resource page for the current explicit history of the MeshInventory artifact.",
          artifactLabel: "Inventory artifact",
          workingLocalRelativePath: "_mesh/_inventory/inventory.ttl",
          states: [
            { segment: "_s0001", latest: false },
            { segment: "_s0002", latest: false },
            { segment: "_s0003", latest: false },
            { segment: "_s0004", latest: true },
          ],
        }),
      }]),
      ...(useAliceBioLegacyPages
        ? [{
          path: "alice/index.html",
          contents: renderAliceIdentifierPageAfterFirstExtractedWeave(
            meshBase,
            sourcePayloadTurtle,
            toHistoryPathFromStatePath(
              referenceTargetSourcePayloadArtifact.latestHistoricalStatePath,
            ),
          ),
        }]
        : []),
      ...(meshInventoryProgression === undefined ? [] : [{
        path: "_mesh/_meta/meta.ttl",
        contents: renderMeshMetadataWithMeshInventoryProgression(
          currentMeshMetadataTurtle,
          meshInventoryProgression,
        ),
      }]),
    ],
    createdPages: buildFirstExtractedKnopWeavePages(
      designatorPath,
      meshInventoryProgression,
      { knopMetadataHistoryPolicy, knopInventoryHistoryPolicy },
    ),
  };
}

function planFirstReferenceCatalogWeave(
  meshBase: string,
  currentMeshInventoryTurtle: string,
  currentMeshMetadataTurtle: string | undefined,
  candidate: WeaveableKnopCandidate,
  supportHistoryPolicies?: WeaveSupportHistoryPolicies,
): WeavePlan {
  const referenceCatalogArtifact = candidate.referenceCatalogArtifact!;
  const designatorPath = candidate.designatorPath;
  const knopPath = toKnopPath(designatorPath);
  const versionKnopInventory = currentKnopInventoryHasVersionedHistory(
    meshBase,
    candidate.currentKnopInventoryTurtle,
    knopPath,
  );
  const versionReferenceCatalog = shouldMaterializeSupportHistory(
    supportHistoryPolicies?.referenceCatalog ?? "versioned",
  ) && versionKnopInventory;
  assertCurrentMeshInventoryShapeForFirstReferenceCatalogWeave(
    meshBase,
    currentMeshInventoryTurtle,
    currentMeshMetadataTurtle,
    designatorPath,
  );
  assertCurrentKnopInventoryShapeForFirstReferenceCatalogWeave(
    meshBase,
    candidate.currentKnopInventoryTurtle,
    candidate.designatorPath,
    referenceCatalogArtifact.workingLocalRelativePath,
    { versionKnopInventory },
  );

  const referenceCatalogPath = `${knopPath}/_references`;
  const referenceCatalogWorkingLocalRelativePath = referenceCatalogArtifact
    .workingLocalRelativePath;
  const referenceCatalogManifestationPath = toArtifactManifestationPath(
    `${referenceCatalogPath}/_history001/_s0001`,
    referenceCatalogWorkingLocalRelativePath,
  );
  const referenceCatalogLinks = extractCurrentReferenceCatalogLinks(
    meshBase,
    referenceCatalogArtifact.currentReferenceCatalogTurtle,
    designatorPath,
    referenceCatalogPath,
  );
  const wovenKnopInventoryTurtle = versionReferenceCatalog
    ? renderKnopInventoryWithPreservedSupportArtifacts({
      meshBase,
      currentKnopInventoryTurtle: candidate.currentKnopInventoryTurtle,
      renderedKnopInventoryTurtle:
        renderFirstReferenceCatalogWovenKnopInventoryTurtle(
          meshBase,
          designatorPath,
          referenceCatalogWorkingLocalRelativePath,
        ),
      knopPath,
    })
    : renderCurrentOnlyReferenceCatalogWovenKnopInventoryTurtle(
      meshBase,
      candidate.currentKnopInventoryTurtle,
      designatorPath,
      referenceCatalogWorkingLocalRelativePath,
    );

  return {
    meshBase,
    wovenDesignatorPaths: [designatorPath],
    createdFiles: versionReferenceCatalog
      ? [
        {
          path: `${knopPath}/_inventory/_history001/_s0002/ttl/inventory.ttl`,
          contents: wovenKnopInventoryTurtle,
        },
        {
          path: `${referenceCatalogManifestationPath}/${
            toFileName(referenceCatalogWorkingLocalRelativePath)
          }`,
          contents: referenceCatalogArtifact.currentReferenceCatalogTurtle,
        },
      ]
      : [],
    updatedFiles: [
      {
        path: `${knopPath}/_inventory/inventory.ttl`,
        contents: wovenKnopInventoryTurtle,
      },
    ],
    createdPages: versionReferenceCatalog
      ? buildFirstReferenceCatalogWeavePages(
        designatorPath,
        referenceCatalogWorkingLocalRelativePath,
        referenceCatalogLinks,
      )
      : buildCurrentOnlyReferenceCatalogWeavePages(
        designatorPath,
        referenceCatalogLinks,
      ),
  };
}

function planPageDefinitionWeave(
  meshBase: string,
  _meshInventoryTurtle: string,
  candidate: WeaveableKnopCandidate,
): WeavePlan {
  const pageDefinitionArtifact = candidate.resourcePageDefinitionArtifact!;
  const designatorPath = candidate.designatorPath;
  const progression = resolvePageDefinitionWeaveProgression(
    designatorPath,
    pageDefinitionArtifact,
  );
  const knopInventoryProgression =
    resolveCurrentKnopInventoryProgressionForPageDefinitionWeave(
      meshBase,
      candidate.currentKnopInventoryTurtle,
      designatorPath,
      pageDefinitionArtifact,
      progression,
    );
  const hasReferenceCatalog = hasReferenceCatalogInKnopInventory(
    meshBase,
    candidate.currentKnopInventoryTurtle,
    designatorPath,
  );

  if (!pageDefinitionArtifact.currentArtifactHistoryExists) {
    assertCurrentKnopInventoryShapeForFirstPageDefinitionWeave(
      meshBase,
      candidate.currentKnopInventoryTurtle,
      designatorPath,
      pageDefinitionArtifact,
      knopInventoryProgression,
    );
  } else {
    assertCurrentKnopInventoryShapeForSubsequentPageDefinitionWeave(
      meshBase,
      candidate.currentKnopInventoryTurtle,
      designatorPath,
      pageDefinitionArtifact,
      progression,
      knopInventoryProgression,
    );
  }

  const renderedKnopInventory =
    renderSubsequentPageDefinitionWovenKnopInventoryTurtle(
      meshBase,
      designatorPath,
      pageDefinitionArtifact.workingLocalRelativePath,
      progression,
      knopInventoryProgression,
      pageDefinitionArtifact.assetBundlePath,
      hasReferenceCatalog,
    );

  return {
    meshBase,
    wovenDesignatorPaths: [designatorPath],
    createdFiles: [
      {
        path: progression.nextSnapshotPath,
        contents: pageDefinitionArtifact.currentPageDefinitionTurtle,
      },
      {
        path: `${knopInventoryProgression.nextStatePath}/ttl/inventory.ttl`,
        contents: renderedKnopInventory,
      },
    ],
    updatedFiles: [
      {
        path: `${toKnopPath(designatorPath)}/_inventory/inventory.ttl`,
        contents: renderedKnopInventory,
      },
    ],
    createdPages: buildSubsequentPageDefinitionWeavePages(
      designatorPath,
      progression,
      knopInventoryProgression,
    ),
  };
}

function hasReferenceCatalogInKnopInventory(
  meshBase: string,
  currentKnopInventoryTurtle: string,
  designatorPath: string,
): boolean {
  const knopPath = toKnopPath(designatorPath);
  const quads = parseWeaveShapeQuads(
    meshBase,
    currentKnopInventoryTurtle,
    `Unable to resolve the current KnopInventory shape for ${designatorPath}.`,
  );

  return hasNamedNodeFact(
    quads,
    meshBase,
    knopPath,
    SFLO_HAS_REFERENCE_CATALOG_IRI,
    `${knopPath}/_references`,
  );
}

function planSecondPayloadWeave(
  meshBase: string,
  candidate: WeaveableKnopCandidate,
  target?: NormalizedVersionTargetSpec,
  supportHistoryPolicies?: WeaveSupportHistoryPolicies,
  namingPolicies?: WeaveNamingPolicies,
): WeavePlan {
  const payloadArtifact = candidate.payloadArtifact!;
  const designatorPath = candidate.designatorPath;
  const knopPath = toKnopPath(designatorPath);
  const payloadLayout = resolveSecondPayloadVersionLayout(
    meshBase,
    designatorPath,
    payloadArtifact,
    candidate.currentKnopInventoryTurtle,
    target,
    namingPolicies,
  );
  assertCurrentKnopInventoryShapeForSecondPayloadWeave(
    meshBase,
    candidate.currentKnopInventoryTurtle,
    designatorPath,
    payloadArtifact,
    payloadLayout.nextStatePath,
    { knopInventoryHistoryPolicy: supportHistoryPolicies?.knopInventory },
  );

  const payloadSnapshotPath = `${payloadLayout.nextManifestationPath}/${
    toFileName(payloadArtifact.workingLocalRelativePath)
  }`;
  const knopMetadataHistoryPolicy = supportHistoryPolicies?.knopMetadata ??
    "versioned";
  const knopInventoryHistoryPolicy = supportHistoryPolicies?.knopInventory ??
    "versioned";
  const versionKnopInventory = shouldMaterializeSupportHistory(
    knopInventoryHistoryPolicy,
  );
  const wovenKnopInventoryTurtle =
    renderKnopInventoryWithPreservedSupportArtifacts({
      meshBase,
      currentKnopInventoryTurtle: candidate.currentKnopInventoryTurtle,
      renderedKnopInventoryTurtle: renderSecondPayloadWovenKnopInventoryTurtle(
        meshBase,
        designatorPath,
        payloadLayout,
        payloadArtifact.workingLocalRelativePath,
        payloadArtifact.repositorySourceFloatingLocator,
        candidate.currentKnopInventoryTurtle,
        { knopMetadataHistoryPolicy, knopInventoryHistoryPolicy },
      ),
      knopPath,
    });

  return {
    meshBase,
    wovenDesignatorPaths: [designatorPath],
    createdFiles: [
      {
        path: payloadSnapshotPath,
        contents: payloadArtifact.currentPayloadTurtle,
      },
      ...(versionKnopInventory
        ? [{
          path: `${knopPath}/_inventory/_history001/_s0002/ttl/inventory.ttl`,
          contents: wovenKnopInventoryTurtle,
        }]
        : []),
    ],
    updatedFiles: [
      {
        path: `${knopPath}/_inventory/inventory.ttl`,
        contents: wovenKnopInventoryTurtle,
      },
    ],
    createdPages: buildSecondPayloadWeavePages(
      designatorPath,
      payloadLayout,
      { knopInventoryHistoryPolicy },
    ),
  };
}

function resolvePageDefinitionWeaveProgression(
  designatorPath: string,
  pageDefinitionArtifact: ResourcePageDefinitionWorkingArtifact,
): PageDefinitionWeaveProgression {
  const errorMessage =
    `The current local weave slice only supports a settled ResourcePageDefinition progression for ${designatorPath}.`;
  const historyPath = pageDefinitionArtifact.currentArtifactHistoryPath ??
    `${pageDefinitionArtifact.artifactPath}/_history001`;

  if (!pageDefinitionArtifact.currentArtifactHistoryExists) {
    if (
      pageDefinitionArtifact.currentArtifactHistoryPath !== undefined ||
      pageDefinitionArtifact.latestHistoricalStatePath !== undefined
    ) {
      throw new WeaveInputError(errorMessage);
    }

    return {
      historyPath,
      latestStateOrdinal: 0,
      nextStatePath: `${historyPath}/_s0001`,
      nextStateOrdinal: 1,
      nextManifestationPath: `${historyPath}/_s0001/ttl`,
      nextSnapshotPath: `${historyPath}/_s0001/ttl/page.ttl`,
    };
  }

  const latestStatePath = pageDefinitionArtifact.latestHistoricalStatePath;
  if (!latestStatePath) {
    throw new WeaveInputError(errorMessage);
  }
  const latestStateOrdinal = parseStateOrdinalFromPath(
    latestStatePath,
    errorMessage,
  );
  if (toHistoryPathFromStatePath(latestStatePath) !== historyPath) {
    throw new WeaveInputError(errorMessage);
  }
  const nextStateOrdinal = latestStateOrdinal + 1;
  const nextStatePath = `${historyPath}/${toStateSegment(nextStateOrdinal)}`;

  return {
    historyPath,
    latestStatePath,
    latestStateOrdinal,
    nextStatePath,
    nextStateOrdinal,
    nextManifestationPath: `${nextStatePath}/ttl`,
    nextSnapshotPath: `${nextStatePath}/ttl/page.ttl`,
  };
}

function resolveCurrentKnopInventoryProgressionForPageDefinitionWeave(
  meshBase: string,
  currentKnopInventoryTurtle: string,
  designatorPath: string,
  pageDefinitionArtifact: ResourcePageDefinitionWorkingArtifact,
  pageDefinitionProgression: PageDefinitionWeaveProgression,
): MeshInventoryProgression {
  const knopPath = toKnopPath(designatorPath);
  const pageDefinitionPath = pageDefinitionArtifact.artifactPath;
  const errorMessage =
    `The current local weave slice only supports a settled page-definition KnopInventory progression for ${designatorPath}.`;
  const quads = parseWeaveShapeQuads(
    meshBase,
    currentKnopInventoryTurtle,
    errorMessage,
  );

  assertHasNamedNodeFacts(quads, meshBase, errorMessage, [
    [knopPath, RDF_TYPE_IRI, SFLO_KNOP_IRI],
    [knopPath, SFLO_HAS_KNOP_METADATA_IRI, `${knopPath}/_meta`],
    [knopPath, SFLO_HAS_KNOP_INVENTORY_IRI, `${knopPath}/_inventory`],
    [knopPath, SFLO_HAS_RESOURCE_PAGE_DEFINITION_IRI, pageDefinitionPath],
    [
      knopPath,
      SFLO_HAS_WORKING_KNOP_INVENTORY_FILE_IRI,
      `${knopPath}/_inventory/inventory.ttl`,
    ],
    [`${knopPath}/_inventory`, RDF_TYPE_IRI, SFLO_KNOP_INVENTORY_IRI],
    [`${knopPath}/_inventory`, RDF_TYPE_IRI, SFLO_DIGITAL_ARTIFACT_IRI],
    [`${knopPath}/_inventory`, RDF_TYPE_IRI, SFLO_RDF_DOCUMENT_IRI],
    [pageDefinitionPath, RDF_TYPE_IRI, SFLO_RESOURCE_PAGE_DEFINITION_IRI],
    [pageDefinitionPath, RDF_TYPE_IRI, SFLO_DIGITAL_ARTIFACT_IRI],
    [pageDefinitionPath, RDF_TYPE_IRI, SFLO_RDF_DOCUMENT_IRI],
  ]);
  assertHasCurrentWorkingFileLocator(
    quads,
    meshBase,
    errorMessage,
    pageDefinitionPath,
    pageDefinitionArtifact.workingLocalRelativePath,
  );

  const historyIri = requireSingleNamedNodeObject(
    quads,
    toAbsoluteIri(meshBase, `${knopPath}/_inventory`),
    SFLO_CURRENT_ARTIFACT_HISTORY_IRI,
    errorMessage,
  );
  const historyPath = toMeshRelativePath(
    meshBase,
    historyIri,
    "the current KnopInventory history",
  );
  const latestStateIri = requireSingleNamedNodeObject(
    quads,
    historyIri,
    SFLO_LATEST_HISTORICAL_STATE_IRI,
    errorMessage,
  );
  const latestStatePath = toMeshRelativePath(
    meshBase,
    latestStateIri,
    "the latest KnopInventory historical state",
  );
  const latestStateOrdinal = parseStateOrdinalFromPath(
    latestStatePath,
    errorMessage,
  );
  const nextStateOrdinal = requireSingleNonNegativeIntegerLiteral(
    quads,
    historyIri,
    SFLO_NEXT_STATE_ORDINAL_IRI,
    errorMessage,
  );
  if (
    historyPath !== `${knopPath}/_inventory/_history001` ||
    toHistoryPathFromStatePath(latestStatePath) !== historyPath ||
    nextStateOrdinal !== latestStateOrdinal + 1
  ) {
    throw new WeaveInputError(errorMessage);
  }
  if (
    pageDefinitionArtifact.currentArtifactHistoryExists &&
    !hasNamedNodeFact(
      quads,
      meshBase,
      pageDefinitionPath,
      SFLO_CURRENT_ARTIFACT_HISTORY_IRI,
      pageDefinitionProgression.historyPath,
    )
  ) {
    throw new WeaveInputError(errorMessage);
  }
  if (
    pageDefinitionArtifact.currentArtifactHistoryExists &&
    pageDefinitionProgression.latestStatePath &&
    !hasNamedNodeFact(
      quads,
      meshBase,
      pageDefinitionProgression.historyPath,
      SFLO_LATEST_HISTORICAL_STATE_IRI,
      pageDefinitionProgression.latestStatePath,
    )
  ) {
    throw new WeaveInputError(errorMessage);
  }
  if (!pageDefinitionArtifact.currentArtifactHistoryExists) {
    if (
      resolveOptionalNamedNodePath(
        quads,
        meshBase,
        pageDefinitionPath,
        SFLO_HAS_ARTIFACT_HISTORY_IRI,
        errorMessage,
      ) ||
      resolveOptionalNamedNodePath(
        quads,
        meshBase,
        pageDefinitionPath,
        SFLO_CURRENT_ARTIFACT_HISTORY_IRI,
        errorMessage,
      )
    ) {
      throw new WeaveInputError(errorMessage);
    }
  }

  if (pageDefinitionArtifact.assetBundlePath) {
    assertHasNamedNodeFacts(quads, meshBase, errorMessage, [
      [
        knopPath,
        SFLO_HAS_KNOP_ASSET_BUNDLE_IRI,
        pageDefinitionArtifact.assetBundlePath,
      ],
      [
        pageDefinitionArtifact.assetBundlePath,
        RDF_TYPE_IRI,
        SFLO_KNOP_ASSET_BUNDLE_IRI,
      ],
    ]);
  }

  return {
    historyPath,
    latestStatePath,
    latestStateOrdinal,
    latestManifestationPath: `${latestStatePath}/ttl`,
    nextStatePath: `${historyPath}/${toStateSegment(nextStateOrdinal)}`,
    nextStateOrdinal,
  };
}

function resolveCurrentMeshInventoryProgressionForFirstKnopWeave(
  meshBase: string,
  currentMeshInventoryTurtle: string,
  currentMeshMetadataTurtle: string | undefined,
  designatorPath: string,
): MeshInventoryProgression {
  const knopPath = toKnopPath(designatorPath);
  const errorMessage =
    "The current local weave slice only supports a settled first-knop-weave mesh inventory progression.";
  const quads = parseWeaveShapeQuads(
    meshBase,
    currentMeshInventoryTurtle,
    errorMessage,
  );

  assertHasNamedNodeFacts(quads, meshBase, errorMessage, [
    ["_mesh/_inventory", RDF_TYPE_IRI, SFLO_MESH_INVENTORY_IRI],
    ["_mesh/_inventory", RDF_TYPE_IRI, SFLO_DIGITAL_ARTIFACT_IRI],
    ["_mesh/_inventory", RDF_TYPE_IRI, SFLO_RDF_DOCUMENT_IRI],
    [knopPath, RDF_TYPE_IRI, SFLO_KNOP_IRI],
  ]);
  const progression = resolveMeshInventoryProgressionFromMetadata(
    meshBase,
    currentMeshMetadataTurtle,
    errorMessage,
  );
  if (
    progression.historyPath !== "_mesh/_inventory/_history001" ||
    toHistoryPathFromStatePath(progression.latestStatePath) !==
      progression.historyPath ||
    progression.nextStateOrdinal !== progression.latestStateOrdinal + 1
  ) {
    throw new WeaveInputError(errorMessage);
  }
  assertHasNamedNodeFacts(quads, meshBase, errorMessage, [
    [
      "_mesh/_inventory",
      SFLO_HAS_ARTIFACT_HISTORY_IRI,
      progression.historyPath,
    ],
    [
      progression.historyPath,
      SFLO_HAS_HISTORICAL_STATE_IRI,
      progression.latestStatePath,
    ],
  ]);

  return progression;
}

function resolveCurrentMeshInventoryProgressionForFirstPayloadWeave(
  meshBase: string,
  currentMeshInventoryTurtle: string,
  currentMeshMetadataTurtle: string | undefined,
  designatorPath: string,
): MeshInventoryProgression {
  const knopPath = toKnopPath(designatorPath);
  const errorMessage =
    "The current local weave slice only supports a settled first-payload-weave mesh inventory shape.";
  const quads = parseWeaveShapeQuads(
    meshBase,
    currentMeshInventoryTurtle,
    errorMessage,
  );

  assertHasNamedNodeFacts(quads, meshBase, errorMessage, [
    ["_mesh/_inventory", RDF_TYPE_IRI, SFLO_MESH_INVENTORY_IRI],
    ["_mesh/_inventory", RDF_TYPE_IRI, SFLO_DIGITAL_ARTIFACT_IRI],
    ["_mesh/_inventory", RDF_TYPE_IRI, SFLO_RDF_DOCUMENT_IRI],
    [designatorPath, RDF_TYPE_IRI, SFLO_PAYLOAD_ARTIFACT_IRI],
    [designatorPath, RDF_TYPE_IRI, SFLO_DIGITAL_ARTIFACT_IRI],
    [designatorPath, RDF_TYPE_IRI, SFLO_RDF_DOCUMENT_IRI],
    [knopPath, RDF_TYPE_IRI, SFLO_KNOP_IRI],
  ]);

  const progression = resolveMeshInventoryProgressionFromMetadata(
    meshBase,
    currentMeshMetadataTurtle,
    errorMessage,
  );
  if (progression.nextStateOrdinal !== progression.latestStateOrdinal + 1) {
    throw new WeaveInputError(errorMessage);
  }
  const latestManifestationIri = requireOptionalNamedNodeObject(
    quads,
    toAbsoluteIri(meshBase, progression.latestStatePath),
    SFLO_HAS_MANIFESTATION_IRI,
    errorMessage,
  );
  const latestManifestationPath = latestManifestationIri
    ? toMeshRelativePath(
      meshBase,
      latestManifestationIri,
      "the latest MeshInventory historical-state manifestation",
    )
    : `${progression.latestStatePath}/ttl`;
  if (
    toHistoryPathFromStatePath(progression.latestStatePath) !==
      progression.historyPath ||
    latestManifestationPath !==
      `${progression.latestStatePath}/ttl` ||
    (!latestManifestationIri && progression.latestStateOrdinal !== 2)
  ) {
    throw new WeaveInputError(errorMessage);
  }
  assertHasNamedNodeFacts(quads, meshBase, errorMessage, [
    [
      "_mesh/_inventory",
      SFLO_HAS_ARTIFACT_HISTORY_IRI,
      progression.historyPath,
    ],
    [
      progression.historyPath,
      SFLO_HAS_HISTORICAL_STATE_IRI,
      progression.latestStatePath,
    ],
  ]);

  return {
    ...progression,
    latestManifestationPath,
  };
}

function renderFirstKnopWovenMeshInventoryTurtle(
  currentMeshInventoryTurtle: string,
  meshBase: string,
  designatorPath: string,
  meshInventoryProgression: MeshInventoryProgression,
): string {
  const knopPath = toKnopPath(designatorPath);
  const designatorPagePath = toDesignatorResourcePagePath(designatorPath);
  const historyPath = meshInventoryProgression.historyPath;
  const latestManifestationPath =
    meshInventoryProgression.latestManifestationPath;
  const nextStatePath = meshInventoryProgression.nextStatePath;
  const nextStateOrdinal = meshInventoryProgression.nextStateOrdinal;
  const nextManifestationPath = `${nextStatePath}/ttl`;
  const initialBlocks = normalizeMeshInventoryHeader(
    splitTurtleBlocks(currentMeshInventoryTurtle),
  );
  if (
    findSubjectBlockIndex(initialBlocks, "_mesh") === -1 ||
    findSubjectBlockIndex(
        initialBlocks,
        latestManifestationPath,
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
  blocks = replaceSubjectBlock(
    blocks,
    "_mesh/_inventory",
    renderMeshInventoryArtifactBlock(historyPath),
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
    renderMeshInventoryHistoryBlock(
      historyPath,
      nextStateOrdinal,
      nextStatePath,
    ),
  );
  blocks = upsertSubjectBlockAfter(
    blocks,
    latestManifestationPath,
    nextStatePath,
    renderMeshInventoryStateBlock(
      nextStatePath,
      nextStateOrdinal,
      meshInventoryProgression.latestStatePath,
    ),
  );
  blocks = upsertSubjectBlockAfter(
    blocks,
    nextStatePath,
    nextManifestationPath,
    renderMeshInventoryStateManifestationBlock(nextStatePath),
  );
  blocks = upsertSubjectBlockAfter(
    blocks,
    `${latestManifestationPath}/inventory.ttl`,
    `${nextManifestationPath}/inventory.ttl`,
    renderLocatedFileBlock(`${nextManifestationPath}/inventory.ttl`),
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
    `${latestManifestationPath}/index.html`,
    `${nextStatePath}/index.html`,
    renderResourcePageLocatedFileBlock(`${nextStatePath}/index.html`),
  );
  blocks = upsertSubjectBlockAfter(
    blocks,
    `${nextStatePath}/index.html`,
    `${nextManifestationPath}/index.html`,
    renderResourcePageLocatedFileBlock(
      `${nextManifestationPath}/index.html`,
    ),
  );

  return `${blocks.join("\n\n")}\n`;
}

function renderMeshMetadataWithMeshInventoryProgression(
  currentMeshMetadataTurtle: string | undefined,
  meshInventoryProgression: MeshInventoryProgression,
): string {
  if (currentMeshMetadataTurtle === undefined) {
    throw new WeaveInputError(
      "Current MeshMetadata is required to update MeshInventory progression.",
    );
  }

  let blocks = splitTurtleBlocks(currentMeshMetadataTurtle);
  blocks = upsertSubjectBlockAfter(
    blocks,
    "_mesh",
    "_mesh/_inventory",
    renderMeshInventoryMetaProgressionBlock(meshInventoryProgression),
  );
  blocks = upsertSubjectBlockAfter(
    blocks,
    "_mesh/_inventory",
    meshInventoryProgression.historyPath,
    renderMeshInventoryHistoryMetaProgressionBlock(
      meshInventoryProgression,
    ),
  );

  return `${blocks.join("\n\n")}\n`;
}

function renderMeshInventoryMetaProgressionBlock(
  progression: MeshInventoryProgression,
): string {
  return `<_mesh/_inventory> a sflo:MeshInventory, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:currentArtifactHistory <${progression.historyPath}> ;
  sflo:nextHistoryOrdinal "${
    progression.nextHistoryOrdinal ?? 2
  }"^^xsd:nonNegativeInteger .`;
}

function renderMeshInventoryHistoryMetaProgressionBlock(
  progression: MeshInventoryProgression,
): string {
  return `<${progression.historyPath}> a sflo:ArtifactHistory ;
  sflo:latestHistoricalState <${progression.nextStatePath}> ;
  sflo:nextStateOrdinal "${
    progression.nextStateOrdinal + 1
  }"^^xsd:nonNegativeInteger .`;
}

function renderFirstKnopWovenKnopInventoryTurtle(
  meshBase: string,
  designatorPath: string,
  options?: { knopMetadataHistoryPolicy?: SupportArtifactHistoryPolicy },
): string {
  const knopPath = toKnopPath(designatorPath);
  const shouldVersionKnopMetadata = shouldMaterializeSupportHistory(
    options?.knopMetadataHistoryPolicy ?? "versioned",
  );

  const turtle = `@base <${meshBase}> .
${SFLO_TURTLE_PREFIX_DECLARATION}
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
  sflo:hasManifestation <${knopPath}/_meta/_history001/_s0001/ttl> ;
  sflo:locatedFileForState <${knopPath}/_meta/_history001/_s0001/ttl/meta.ttl> ;
  sflo:hasResourcePage <${knopPath}/_meta/_history001/_s0001/index.html> .

<${knopPath}/_meta/_history001/_s0001/ttl> a sflo:ArtifactManifestation, sflo:RdfDocument ;
  sflo:locatedFileForManifestation <${knopPath}/_meta/_history001/_s0001/ttl/meta.ttl> ;
  sflo:hasResourcePage <${knopPath}/_meta/_history001/_s0001/ttl/index.html> .

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
  sflo:hasManifestation <${knopPath}/_inventory/_history001/_s0001/ttl> ;
  sflo:locatedFileForState <${knopPath}/_inventory/_history001/_s0001/ttl/inventory.ttl> ;
  sflo:hasResourcePage <${knopPath}/_inventory/_history001/_s0001/index.html> .

<${knopPath}/_inventory/_history001/_s0001/ttl> a sflo:ArtifactManifestation, sflo:RdfDocument ;
  sflo:locatedFileForManifestation <${knopPath}/_inventory/_history001/_s0001/ttl/inventory.ttl> ;
  sflo:hasResourcePage <${knopPath}/_inventory/_history001/_s0001/ttl/index.html> .

<${knopPath}/_meta/meta.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<${knopPath}/_inventory/inventory.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<${knopPath}/_meta/_history001/_s0001/ttl/meta.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<${knopPath}/_inventory/_history001/_s0001/ttl/inventory.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<${knopPath}/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${knopPath}/_meta/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${knopPath}/_meta/_history001/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${knopPath}/_meta/_history001/_s0001/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${knopPath}/_meta/_history001/_s0001/ttl/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${knopPath}/_inventory/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${knopPath}/_inventory/_history001/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${knopPath}/_inventory/_history001/_s0001/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${knopPath}/_inventory/_history001/_s0001/ttl/index.html> a sflo:ResourcePage, sflo:LocatedFile .
`;

  return shouldVersionKnopMetadata
    ? turtle
    : omitInitialKnopMetadataHistory(turtle, knopPath);
}

function omitInitialKnopMetadataHistory(
  turtle: string,
  knopPath: string,
): string {
  return turtle
    .replace(
      `  sflo:hasArtifactHistory <${knopPath}/_meta/_history001> ;
  sflo:currentArtifactHistory <${knopPath}/_meta/_history001> ;
  sflo:nextHistoryOrdinal "2"^^xsd:nonNegativeInteger ;
`,
      "",
    )
    .replace(
      `<${knopPath}/_meta/_history001> a sflo:ArtifactHistory ;
  sflo:historyOrdinal "1"^^xsd:nonNegativeInteger ;
  sflo:hasHistoricalState <${knopPath}/_meta/_history001/_s0001> ;
  sflo:latestHistoricalState <${knopPath}/_meta/_history001/_s0001> ;
  sflo:nextStateOrdinal "2"^^xsd:nonNegativeInteger ;
  sflo:hasResourcePage <${knopPath}/_meta/_history001/index.html> .

`,
      "",
    )
    .replace(
      `<${knopPath}/_meta/_history001/_s0001> a sflo:HistoricalState ;
  sflo:stateOrdinal "1"^^xsd:nonNegativeInteger ;
  sflo:hasManifestation <${knopPath}/_meta/_history001/_s0001/ttl> ;
  sflo:locatedFileForState <${knopPath}/_meta/_history001/_s0001/ttl/meta.ttl> ;
  sflo:hasResourcePage <${knopPath}/_meta/_history001/_s0001/index.html> .

`,
      "",
    )
    .replace(
      `<${knopPath}/_meta/_history001/_s0001/ttl> a sflo:ArtifactManifestation, sflo:RdfDocument ;
  sflo:locatedFileForManifestation <${knopPath}/_meta/_history001/_s0001/ttl/meta.ttl> ;
  sflo:hasResourcePage <${knopPath}/_meta/_history001/_s0001/ttl/index.html> .

`,
      "",
    )
    .replace(
      `<${knopPath}/_meta/_history001/_s0001/ttl/meta.ttl> a sflo:LocatedFile, sflo:RdfDocument .

`,
      "",
    )
    .replace(
      `<${knopPath}/_meta/_history001/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${knopPath}/_meta/_history001/_s0001/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${knopPath}/_meta/_history001/_s0001/ttl/index.html> a sflo:ResourcePage, sflo:LocatedFile .

`,
      "",
    );
}

function omitKnopInventoryHistory(turtle: string, knopPath: string): string {
  const historyPath = `${knopPath}/_inventory/_history001`;
  let output = turtle.replace(
    `  sflo:hasArtifactHistory <${historyPath}> ;
  sflo:currentArtifactHistory <${historyPath}> ;
  sflo:nextHistoryOrdinal "2"^^xsd:nonNegativeInteger ;
`,
    "",
  );

  output = output
    .replace(
      `<${historyPath}> a sflo:ArtifactHistory ;
  sflo:historyOrdinal "1"^^xsd:nonNegativeInteger ;
  sflo:hasHistoricalState <${historyPath}/_s0001> ;
  sflo:latestHistoricalState <${historyPath}/_s0001> ;
  sflo:nextStateOrdinal "2"^^xsd:nonNegativeInteger ;
  sflo:hasResourcePage <${historyPath}/index.html> .

`,
      "",
    )
    .replace(
      `<${historyPath}> a sflo:ArtifactHistory ;
  sflo:historyOrdinal "1"^^xsd:nonNegativeInteger ;
  sflo:hasHistoricalState <${historyPath}/_s0001> ;
  sflo:hasHistoricalState <${historyPath}/_s0002> ;
  sflo:latestHistoricalState <${historyPath}/_s0002> ;
  sflo:nextStateOrdinal "3"^^xsd:nonNegativeInteger ;
  sflo:hasResourcePage <${historyPath}/index.html> .

`,
      "",
    );

  for (const stateOrdinal of [1, 2]) {
    const stateSegment = toStateSegment(stateOrdinal);
    const statePath = `${historyPath}/${stateSegment}`;
    const manifestationPath = `${statePath}/ttl`;
    const locatedFilePath = `${manifestationPath}/inventory.ttl`;
    const previousStatePredicate = stateOrdinal === 1
      ? ""
      : `  sflo:previousHistoricalState <${historyPath}/_s0001> ;
`;
    output = output
      .replace(
        `<${statePath}> a sflo:HistoricalState ;
  sflo:stateOrdinal "${stateOrdinal}"^^xsd:nonNegativeInteger ;
${previousStatePredicate}  sflo:hasManifestation <${manifestationPath}> ;
  sflo:locatedFileForState <${locatedFilePath}> ;
  sflo:hasResourcePage <${statePath}/index.html> .

`,
        "",
      )
      .replace(
        `<${manifestationPath}> a sflo:ArtifactManifestation, sflo:RdfDocument ;
  sflo:locatedFileForManifestation <${locatedFilePath}> ;
  sflo:hasResourcePage <${manifestationPath}/index.html> .

`,
        "",
      )
      .replace(
        `<${locatedFilePath}> a sflo:LocatedFile, sflo:RdfDocument .

`,
        "",
      )
      .replace(
        `<${statePath}/index.html> a sflo:ResourcePage, sflo:LocatedFile .

`,
        "",
      )
      .replace(
        `<${statePath}/index.html> a sflo:ResourcePage, sflo:LocatedFile .
`,
        "",
      )
      .replace(
        `<${manifestationPath}/index.html> a sflo:ResourcePage, sflo:LocatedFile .

`,
        "",
      )
      .replace(
        `<${manifestationPath}/index.html> a sflo:ResourcePage, sflo:LocatedFile .
`,
        "",
      );
  }

  return output
    .replace(
      `<${historyPath}/index.html> a sflo:ResourcePage, sflo:LocatedFile .

`,
      "",
    )
    .replace(
      `<${historyPath}/index.html> a sflo:ResourcePage, sflo:LocatedFile .
`,
      "",
    );
}

function renderFirstPayloadWovenMeshInventoryTurtle(
  currentMeshInventoryTurtle: string,
  meshBase: string,
  designatorPath: string,
  workingLocalRelativePath: string,
  meshInventoryProgression: MeshInventoryProgression,
  repositorySourceFloatingLocator?: RepositorySourceFloatingLocator,
): string {
  const knopPath = toKnopPath(designatorPath);
  const rootDesignatorPath = toRootDesignatorPath(designatorPath);
  const rootKnopPath = toKnopPath(rootDesignatorPath);
  const designatorPagePath = toDesignatorResourcePagePath(designatorPath);
  const rootPagePath = toDesignatorResourcePagePath(rootDesignatorPath);
  const historyPath = meshInventoryProgression.historyPath;
  const nextStatePath = meshInventoryProgression.nextStatePath;
  const nextStateManifestationPath = `${nextStatePath}/ttl`;
  const initialBlocks = normalizeMeshInventoryHeader(
    splitTurtleBlocks(currentMeshInventoryTurtle),
  );
  if (
    findSubjectBlockIndex(initialBlocks, "_mesh") === -1 ||
    findSubjectBlockIndex(
        initialBlocks,
        meshInventoryProgression.latestManifestationPath,
      ) === -1
  ) {
    if (meshInventoryProgression.latestStateOrdinal !== 2) {
      throw new WeaveInputError(
        "Could not extend the current mesh inventory for a later first payload weave because the required current-state subject blocks were missing.",
      );
    }
    return renderLegacyFirstPayloadWovenMeshInventoryTurtle(
      meshBase,
      designatorPath,
      workingLocalRelativePath,
      repositorySourceFloatingLocator,
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
    "_mesh/_inventory",
    renderMeshInventoryArtifactBlock(historyPath),
  );
  blocks = replaceSubjectBlock(
    blocks,
    designatorPath,
    renderMeshPayloadArtifactBlockWithResourcePage(
      designatorPath,
      workingLocalRelativePath,
      repositorySourceFloatingLocator,
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
    renderMeshInventoryHistoryBlock(
      historyPath,
      meshInventoryProgression.nextStateOrdinal,
      nextStatePath,
    ),
  );
  blocks = upsertSubjectBlockAfter(
    blocks,
    meshInventoryProgression.latestManifestationPath,
    nextStatePath,
    renderMeshInventoryStateBlock(
      nextStatePath,
      meshInventoryProgression.nextStateOrdinal,
      meshInventoryProgression.latestStatePath,
    ),
  );
  blocks = upsertSubjectBlockAfter(
    blocks,
    nextStatePath,
    nextStateManifestationPath,
    renderMeshInventoryStateManifestationBlock(nextStatePath),
  );
  blocks = upsertSubjectBlockAfter(
    blocks,
    `${meshInventoryProgression.latestManifestationPath}/inventory.ttl`,
    `${nextStateManifestationPath}/inventory.ttl`,
    renderLocatedFileBlock(`${nextStateManifestationPath}/inventory.ttl`),
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
    `${meshInventoryProgression.latestManifestationPath}/index.html`,
    `${nextStatePath}/index.html`,
    renderResourcePageLocatedFileBlock(`${nextStatePath}/index.html`),
  );
  blocks = upsertSubjectBlockAfter(
    blocks,
    `${nextStatePath}/index.html`,
    `${nextStateManifestationPath}/index.html`,
    renderResourcePageLocatedFileBlock(
      `${nextStateManifestationPath}/index.html`,
    ),
  );

  return `${blocks.join("\n\n")}\n`;
}

function renderFirstPayloadWovenCurrentOnlyMeshInventoryTurtle(
  currentMeshInventoryTurtle: string,
  meshBase: string,
  designatorPath: string,
): string {
  const knopPath = toKnopPath(designatorPath);
  const designatorPagePath = toDesignatorResourcePagePath(designatorPath);
  const quads = parseWeaveShapeQuads(
    meshBase,
    currentMeshInventoryTurtle,
    `Could not parse current MeshInventory while weaving ${designatorPath}.`,
  );
  const additions: string[] = [];

  if (
    !hasNamedNodeFact(
      quads,
      meshBase,
      "_mesh",
      SFLO_HAS_KNOP_IRI,
      knopPath,
    )
  ) {
    additions.push(`<_mesh> sflo:hasKnop <${knopPath}> .`);
  }
  if (
    !hasNamedNodeFact(
      quads,
      meshBase,
      designatorPath,
      SFLO_HAS_RESOURCE_PAGE_IRI,
      designatorPagePath,
    )
  ) {
    additions.push(
      `<${designatorPath}> sflo:hasResourcePage <${designatorPagePath}> .`,
    );
  }
  if (
    !hasNamedNodeFact(
      quads,
      meshBase,
      knopPath,
      SFLO_HAS_RESOURCE_PAGE_IRI,
      `${knopPath}/index.html`,
    )
  ) {
    additions.push(
      `<${knopPath}> sflo:hasResourcePage <${knopPath}/index.html> .`,
    );
  }

  additions.push(
    renderResourcePageLocatedFileBlock(designatorPagePath),
    renderResourcePageLocatedFileBlock(`${knopPath}/index.html`),
  );

  return `${currentMeshInventoryTurtle.trimEnd()}\n\n${
    additions.join("\n\n")
  }\n`;
}

function renderLegacyFirstKnopWovenMeshInventoryTurtle(
  meshBase: string,
  designatorPath: string,
): string {
  const knopPath = toKnopPath(designatorPath);
  const designatorPagePath = toDesignatorResourcePagePath(designatorPath);

  return `@base <${meshBase}> .
${SFLO_TURTLE_PREFIX_DECLARATION}
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
  sflo:latestHistoricalState <_mesh/_inventory/_history001/_s0002> ;
  sflo:nextStateOrdinal "3"^^xsd:nonNegativeInteger ;
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

<_mesh/_meta/meta.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<_mesh/_inventory/inventory.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<_mesh/_meta/_history001/_s0001/ttl/meta.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<_mesh/_inventory/_history001/_s0001/ttl/inventory.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<_mesh/_inventory/_history001/_s0002/ttl/inventory.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<${knopPath}/_inventory/inventory.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<_mesh/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${designatorPagePath}> a sflo:ResourcePage, sflo:LocatedFile .

<${knopPath}/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<_mesh/_meta/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<_mesh/_meta/_history001/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<_mesh/_meta/_history001/_s0001/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<_mesh/_meta/_history001/_s0001/ttl/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<_mesh/_inventory/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<_mesh/_inventory/_history001/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<_mesh/_inventory/_history001/_s0001/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<_mesh/_inventory/_history001/_s0001/ttl/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<_mesh/_inventory/_history001/_s0002/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<_mesh/_inventory/_history001/_s0002/ttl/index.html> a sflo:ResourcePage, sflo:LocatedFile .
`;
}

function renderLegacyFirstPayloadWovenMeshInventoryTurtle(
  meshBase: string,
  designatorPath: string,
  workingLocalRelativePath: string,
  repositorySourceFloatingLocator?: RepositorySourceFloatingLocator,
): string {
  const knopPath = toKnopPath(designatorPath);
  const designatorPagePath = toDesignatorResourcePagePath(designatorPath);
  const currentWorkingFileLocator = renderCurrentWorkingFileLocator(
    workingLocalRelativePath,
    repositorySourceFloatingLocator,
  );
  const currentWorkingFileDeclaration = renderCurrentWorkingFileDeclaration(
    workingLocalRelativePath,
    repositorySourceFloatingLocator,
  );

  return `@base <${meshBase}> .
${SFLO_TURTLE_PREFIX_DECLARATION}
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
  ${currentWorkingFileLocator}
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

<_mesh/_meta/meta.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<_mesh/_inventory/inventory.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<_mesh/_meta/_history001/_s0001/ttl/meta.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<_mesh/_inventory/_history001/_s0001/ttl/inventory.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<_mesh/_inventory/_history001/_s0002/ttl/inventory.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<_mesh/_inventory/_history001/_s0003/ttl/inventory.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<alice/_knop/_inventory/inventory.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<${knopPath}/_inventory/inventory.ttl> a sflo:LocatedFile, sflo:RdfDocument .

${currentWorkingFileDeclaration}

<_mesh/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<alice/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${designatorPagePath}> a sflo:ResourcePage, sflo:LocatedFile .

<alice/_knop/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${knopPath}/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<_mesh/_meta/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<_mesh/_meta/_history001/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<_mesh/_meta/_history001/_s0001/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<_mesh/_meta/_history001/_s0001/ttl/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<_mesh/_inventory/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<_mesh/_inventory/_history001/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<_mesh/_inventory/_history001/_s0001/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<_mesh/_inventory/_history001/_s0001/ttl/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<_mesh/_inventory/_history001/_s0002/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<_mesh/_inventory/_history001/_s0002/ttl/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<_mesh/_inventory/_history001/_s0003/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<_mesh/_inventory/_history001/_s0003/ttl/index.html> a sflo:ResourcePage, sflo:LocatedFile .
`;
}

function renderFirstPayloadWovenKnopInventoryTurtle(
  meshBase: string,
  designatorPath: string,
  payloadLayout: PayloadVersionLayout,
  workingLocalRelativePath: string,
  repositorySourceFloatingLocator?: RepositorySourceFloatingLocator,
  options?: {
    knopMetadataHistoryPolicy?: SupportArtifactHistoryPolicy;
    knopInventoryHistoryPolicy?: SupportArtifactHistoryPolicy;
  },
): string {
  const knopPath = toKnopPath(designatorPath);
  const designatorPagePath = toDesignatorResourcePagePath(designatorPath);
  const payloadSnapshotPath = `${payloadLayout.nextManifestationPath}/${
    toFileName(workingLocalRelativePath)
  }`;
  const currentWorkingFileLocator = renderCurrentWorkingFileLocator(
    workingLocalRelativePath,
    repositorySourceFloatingLocator,
  );
  const currentWorkingFileDeclaration = renderCurrentWorkingFileDeclaration(
    workingLocalRelativePath,
    repositorySourceFloatingLocator,
  );
  const shouldVersionKnopMetadata = shouldMaterializeSupportHistory(
    options?.knopMetadataHistoryPolicy ?? "versioned",
  );
  const shouldVersionKnopInventory = shouldMaterializeSupportHistory(
    options?.knopInventoryHistoryPolicy ?? "versioned",
  );

  const turtle = `@base <${meshBase}> .
${SFLO_TURTLE_PREFIX_DECLARATION}
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
  ${currentWorkingFileLocator}
  sflo:hasResourcePage <${designatorPagePath}> .

<${payloadLayout.historyPath}> a sflo:ArtifactHistory ;
  sflo:historyOrdinal "1"^^xsd:nonNegativeInteger ;
  sflo:hasHistoricalState <${payloadLayout.nextStatePath}> ;
  sflo:latestHistoricalState <${payloadLayout.nextStatePath}> ;
  sflo:nextStateOrdinal "2"^^xsd:nonNegativeInteger ;
  sflo:hasResourcePage <${payloadLayout.historyPath}/index.html> .

<${payloadLayout.nextStatePath}> a sflo:HistoricalState ;
  sflo:stateOrdinal "1"^^xsd:nonNegativeInteger ;
  sflo:hasManifestation <${payloadLayout.nextManifestationPath}> ;
  sflo:locatedFileForState <${payloadSnapshotPath}> ;
  sflo:hasResourcePage <${payloadLayout.nextStatePath}/index.html> .

<${payloadLayout.nextManifestationPath}> a sflo:ArtifactManifestation, sflo:RdfDocument ;
  sflo:locatedFileForManifestation <${payloadSnapshotPath}> ;
  sflo:hasResourcePage <${payloadLayout.nextManifestationPath}/index.html> .

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
  sflo:hasManifestation <${knopPath}/_meta/_history001/_s0001/ttl> ;
  sflo:locatedFileForState <${knopPath}/_meta/_history001/_s0001/ttl/meta.ttl> ;
  sflo:hasResourcePage <${knopPath}/_meta/_history001/_s0001/index.html> .

<${knopPath}/_meta/_history001/_s0001/ttl> a sflo:ArtifactManifestation, sflo:RdfDocument ;
  sflo:locatedFileForManifestation <${knopPath}/_meta/_history001/_s0001/ttl/meta.ttl> ;
  sflo:hasResourcePage <${knopPath}/_meta/_history001/_s0001/ttl/index.html> .

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
  sflo:hasManifestation <${knopPath}/_inventory/_history001/_s0001/ttl> ;
  sflo:locatedFileForState <${knopPath}/_inventory/_history001/_s0001/ttl/inventory.ttl> ;
  sflo:hasResourcePage <${knopPath}/_inventory/_history001/_s0001/index.html> .

<${knopPath}/_inventory/_history001/_s0001/ttl> a sflo:ArtifactManifestation, sflo:RdfDocument ;
  sflo:locatedFileForManifestation <${knopPath}/_inventory/_history001/_s0001/ttl/inventory.ttl> ;
  sflo:hasResourcePage <${knopPath}/_inventory/_history001/_s0001/ttl/index.html> .

<${knopPath}/_meta/meta.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<${knopPath}/_inventory/inventory.ttl> a sflo:LocatedFile, sflo:RdfDocument .

${currentWorkingFileDeclaration}

<${payloadSnapshotPath}> a sflo:LocatedFile, sflo:RdfDocument .

<${knopPath}/_meta/_history001/_s0001/ttl/meta.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<${knopPath}/_inventory/_history001/_s0001/ttl/inventory.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<${designatorPagePath}> a sflo:ResourcePage, sflo:LocatedFile .

<${payloadLayout.historyPath}/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${payloadLayout.nextStatePath}/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${payloadLayout.nextManifestationPath}/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${knopPath}/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${knopPath}/_meta/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${knopPath}/_meta/_history001/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${knopPath}/_meta/_history001/_s0001/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${knopPath}/_meta/_history001/_s0001/ttl/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${knopPath}/_inventory/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${knopPath}/_inventory/_history001/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${knopPath}/_inventory/_history001/_s0001/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${knopPath}/_inventory/_history001/_s0001/ttl/index.html> a sflo:ResourcePage, sflo:LocatedFile .
`;

  let output = turtle;
  if (!shouldVersionKnopMetadata) {
    output = omitInitialKnopMetadataHistory(output, knopPath);
  }
  if (!shouldVersionKnopInventory) {
    output = omitKnopInventoryHistory(output, knopPath);
  }
  return output;
}

function renderFirstReferenceCatalogWovenKnopInventoryTurtle(
  meshBase: string,
  designatorPath: string,
  workingLocalRelativePath: string,
): string {
  const knopPath = toKnopPath(designatorPath);
  const referenceCatalogPath = `${knopPath}/_references`;
  const referenceCatalogManifestationPath = toArtifactManifestationPath(
    `${referenceCatalogPath}/_history001/_s0001`,
    workingLocalRelativePath,
  );
  const currentWorkingFileLocator = renderCurrentWorkingFileLocator(
    workingLocalRelativePath,
  );
  const currentWorkingFileDeclaration = renderCurrentWorkingFileDeclaration(
    workingLocalRelativePath,
  );

  return `@base <${meshBase}> .
${SFLO_TURTLE_PREFIX_DECLARATION}
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
  sflo:hasManifestation <${knopPath}/_meta/_history001/_s0001/ttl> ;
  sflo:locatedFileForState <${knopPath}/_meta/_history001/_s0001/ttl/meta.ttl> ;
  sflo:hasResourcePage <${knopPath}/_meta/_history001/_s0001/index.html> .

<${knopPath}/_meta/_history001/_s0001/ttl> a sflo:ArtifactManifestation, sflo:RdfDocument ;
  sflo:locatedFileForManifestation <${knopPath}/_meta/_history001/_s0001/ttl/meta.ttl> ;
  sflo:hasResourcePage <${knopPath}/_meta/_history001/_s0001/ttl/index.html> .

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
  ${currentWorkingFileLocator}
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
  sflo:hasManifestation <${knopPath}/_inventory/_history001/_s0001/ttl> ;
  sflo:locatedFileForState <${knopPath}/_inventory/_history001/_s0001/ttl/inventory.ttl> ;
  sflo:hasResourcePage <${knopPath}/_inventory/_history001/_s0001/index.html> .

<${knopPath}/_inventory/_history001/_s0001/ttl> a sflo:ArtifactManifestation, sflo:RdfDocument ;
  sflo:locatedFileForManifestation <${knopPath}/_inventory/_history001/_s0001/ttl/inventory.ttl> ;
  sflo:hasResourcePage <${knopPath}/_inventory/_history001/_s0001/ttl/index.html> .

<${knopPath}/_inventory/_history001/_s0002> a sflo:HistoricalState ;
  sflo:stateOrdinal "2"^^xsd:nonNegativeInteger ;
  sflo:previousHistoricalState <${knopPath}/_inventory/_history001/_s0001> ;
  sflo:hasManifestation <${knopPath}/_inventory/_history001/_s0002/ttl> ;
  sflo:locatedFileForState <${knopPath}/_inventory/_history001/_s0002/ttl/inventory.ttl> ;
  sflo:hasResourcePage <${knopPath}/_inventory/_history001/_s0002/index.html> .

<${knopPath}/_inventory/_history001/_s0002/ttl> a sflo:ArtifactManifestation, sflo:RdfDocument ;
  sflo:locatedFileForManifestation <${knopPath}/_inventory/_history001/_s0002/ttl/inventory.ttl> ;
  sflo:hasResourcePage <${knopPath}/_inventory/_history001/_s0002/ttl/index.html> .

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
    toFileName(workingLocalRelativePath)
  }> ;
  sflo:hasResourcePage <${referenceCatalogPath}/_history001/_s0001/index.html> .

<${referenceCatalogManifestationPath}> a sflo:ArtifactManifestation, sflo:RdfDocument ;
  sflo:locatedFileForManifestation <${referenceCatalogManifestationPath}/${
    toFileName(workingLocalRelativePath)
  }> ;
  sflo:hasResourcePage <${referenceCatalogManifestationPath}/index.html> .

<${knopPath}/_meta/meta.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<${knopPath}/_inventory/inventory.ttl> a sflo:LocatedFile, sflo:RdfDocument .

${currentWorkingFileDeclaration}

<${knopPath}/_meta/_history001/_s0001/ttl/meta.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<${knopPath}/_inventory/_history001/_s0001/ttl/inventory.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<${knopPath}/_inventory/_history001/_s0002/ttl/inventory.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<${referenceCatalogManifestationPath}/${
    toFileName(workingLocalRelativePath)
  }> a sflo:LocatedFile, sflo:RdfDocument .

<${knopPath}/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${knopPath}/_meta/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${knopPath}/_meta/_history001/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${knopPath}/_meta/_history001/_s0001/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${knopPath}/_meta/_history001/_s0001/ttl/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${knopPath}/_inventory/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${knopPath}/_inventory/_history001/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${knopPath}/_inventory/_history001/_s0001/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${knopPath}/_inventory/_history001/_s0001/ttl/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${knopPath}/_inventory/_history001/_s0002/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${knopPath}/_inventory/_history001/_s0002/ttl/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${referenceCatalogPath}/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${referenceCatalogPath}/_history001/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${referenceCatalogPath}/_history001/_s0001/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${referenceCatalogManifestationPath}/index.html> a sflo:ResourcePage, sflo:LocatedFile .
`;
}

function renderCurrentOnlyReferenceCatalogWovenKnopInventoryTurtle(
  _meshBase: string,
  currentKnopInventoryTurtle: string,
  designatorPath: string,
  workingLocalRelativePath: string,
): string {
  const referenceCatalogPath = toReferenceCatalogPath(designatorPath);
  const referenceCatalogPagePath = `${referenceCatalogPath}/index.html`;
  const blocks = splitTurtleBlocks(currentKnopInventoryTurtle);
  const currentReferenceCatalogBlockIndex = findSubjectBlockIndex(
    blocks,
    referenceCatalogPath,
  );
  if (currentReferenceCatalogBlockIndex === -1) {
    throw new WeaveInputError(
      `Current KnopInventory did not contain ReferenceCatalog block <${referenceCatalogPath}>.`,
    );
  }

  const currentReferenceCatalogBlock =
    blocks[currentReferenceCatalogBlockIndex]!;
  if (
    !currentReferenceCatalogBlock.includes(`<${workingLocalRelativePath}>`) &&
    !currentReferenceCatalogBlock.includes(`"${workingLocalRelativePath}"`)
  ) {
    throw new WeaveInputError(
      `Current ReferenceCatalog block did not carry the expected working file for ${designatorPath}.`,
    );
  }

  const blocksWithReferencePage = replaceSubjectBlock(
    blocks,
    referenceCatalogPath,
    appendPredicateToSubjectBlock(
      currentReferenceCatalogBlock,
      `sflo:hasResourcePage <${referenceCatalogPagePath}>`,
    ),
  );
  const finalBlocks = upsertSubjectBlockAfter(
    blocksWithReferencePage,
    referenceCatalogPath,
    referenceCatalogPagePath,
    renderResourcePageLocatedFileBlock(referenceCatalogPagePath),
  );

  return `${finalBlocks.join("\n\n")}\n`;
}

function renderSubsequentPageDefinitionWovenKnopInventoryTurtle(
  meshBase: string,
  designatorPath: string,
  workingLocalRelativePath: string,
  progression: PageDefinitionWeaveProgression,
  knopInventoryProgression: MeshInventoryProgression,
  assetBundlePath?: string,
  hasReferenceCatalog = true,
): string {
  const knopPath = toKnopPath(designatorPath);
  const referenceCatalogPath = `${knopPath}/_references`;
  const pageDefinitionPath = `${knopPath}/_page`;
  const referenceCatalogLines = hasReferenceCatalog
    ? `  sflo:hasReferenceCatalog <${referenceCatalogPath}> ;\n`
    : "";
  const assetBundleLines = assetBundlePath
    ? ` ;
  <${SFLO_HAS_KNOP_ASSET_BUNDLE_IRI}> <${assetBundlePath}>`
    : "";
  const assetBundleBlock = assetBundlePath
    ? `<${assetBundlePath}> a <${SFLO_KNOP_ASSET_BUNDLE_IRI}> .\n\n`
    : "";
  const currentWorkingFileLocator = renderCurrentWorkingFileLocator(
    workingLocalRelativePath,
  );
  const currentWorkingFileDeclaration = renderCurrentWorkingFileDeclaration(
    workingLocalRelativePath,
  );
  const pageDefinitionStateBlocks = Array.from(
    { length: progression.nextStateOrdinal },
    (_, index) => {
      const stateOrdinal = index + 1;
      const statePath = `${progression.historyPath}/${
        toStateSegment(stateOrdinal)
      }`;
      return renderPageDefinitionStateBlock(
        statePath,
        stateOrdinal,
        stateOrdinal > 1
          ? `${progression.historyPath}/${toStateSegment(stateOrdinal - 1)}`
          : undefined,
      );
    },
  ).join("\n\n");
  const pageDefinitionManifestationBlocks = Array.from(
    { length: progression.nextStateOrdinal },
    (_, index) =>
      renderPageDefinitionStateManifestationBlock(
        `${progression.historyPath}/${toStateSegment(index + 1)}`,
      ),
  ).join("\n\n");
  const knopInventoryStateBlocks = Array.from(
    { length: knopInventoryProgression.nextStateOrdinal },
    (_, index) => {
      const stateOrdinal = index + 1;
      const statePath = `${knopInventoryProgression.historyPath}/${
        toStateSegment(stateOrdinal)
      }`;
      return renderMeshInventoryStateBlock(
        statePath,
        stateOrdinal,
        stateOrdinal > 1
          ? `${knopInventoryProgression.historyPath}/${
            toStateSegment(stateOrdinal - 1)
          }`
          : undefined,
      );
    },
  ).join("\n\n");
  const knopInventoryManifestationBlocks = Array.from(
    { length: knopInventoryProgression.nextStateOrdinal },
    (_, index) =>
      renderMeshInventoryStateManifestationBlock(
        `${knopInventoryProgression.historyPath}/${toStateSegment(index + 1)}`,
      ),
  ).join("\n\n");
  const knopInventoryLocatedFileBlocks = Array.from(
    { length: knopInventoryProgression.nextStateOrdinal },
    (_, index) =>
      renderLocatedFileBlock(
        `${knopInventoryProgression.historyPath}/${
          toStateSegment(index + 1)
        }/ttl/inventory.ttl`,
      ),
  ).join("\n\n");
  const knopInventoryResourcePageBlocks = Array.from(
    { length: knopInventoryProgression.nextStateOrdinal },
    (_, index) => {
      const statePath = `${knopInventoryProgression.historyPath}/${
        toStateSegment(index + 1)
      }`;
      return `${renderResourcePageLocatedFileBlock(`${statePath}/index.html`)}

${renderResourcePageLocatedFileBlock(`${statePath}/ttl/index.html`)}`;
    },
  ).join("\n\n");
  const pageDefinitionLocatedFileBlocks = Array.from(
    { length: progression.nextStateOrdinal },
    (_, index) =>
      renderLocatedFileBlock(
        `${progression.historyPath}/${toStateSegment(index + 1)}/ttl/page.ttl`,
      ),
  ).join("\n\n");
  const pageDefinitionResourcePageBlocks = Array.from(
    { length: progression.nextStateOrdinal },
    (_, index) => {
      const statePath = `${progression.historyPath}/${
        toStateSegment(index + 1)
      }`;
      return `${renderResourcePageLocatedFileBlock(`${statePath}/index.html`)}

${renderResourcePageLocatedFileBlock(`${statePath}/ttl/index.html`)}`;
    },
  ).join("\n\n");
  const referenceCatalogArtifactBlock = hasReferenceCatalog
    ? `

<${referenceCatalogPath}> a sflo:ReferenceCatalog, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasArtifactHistory <${referenceCatalogPath}/_history001> ;
  sflo:currentArtifactHistory <${referenceCatalogPath}/_history001> ;
  sflo:nextHistoryOrdinal "2"^^xsd:nonNegativeInteger ;
  sflo:hasWorkingLocatedFile <${referenceCatalogPath}/references.ttl> ;
  sflo:hasResourcePage <${referenceCatalogPath}/index.html> .`
    : "";
  const referenceCatalogHistoryBlocks = hasReferenceCatalog
    ? `

<${knopPath}/_references/_history001> a sflo:ArtifactHistory ;
  sflo:historyOrdinal "1"^^xsd:nonNegativeInteger ;
  sflo:hasHistoricalState <${knopPath}/_references/_history001/_s0001> ;
  sflo:latestHistoricalState <${knopPath}/_references/_history001/_s0001> ;
  sflo:nextStateOrdinal "2"^^xsd:nonNegativeInteger ;
  sflo:hasResourcePage <${knopPath}/_references/_history001/index.html> .

<${knopPath}/_references/_history001/_s0001> a sflo:HistoricalState ;
  sflo:stateOrdinal "1"^^xsd:nonNegativeInteger ;
  sflo:hasManifestation <${knopPath}/_references/_history001/_s0001/ttl> ;
  sflo:locatedFileForState <${knopPath}/_references/_history001/_s0001/ttl/references.ttl> ;
  sflo:hasResourcePage <${knopPath}/_references/_history001/_s0001/index.html> .

<${knopPath}/_references/_history001/_s0001/ttl> a sflo:ArtifactManifestation, sflo:RdfDocument ;
  sflo:locatedFileForManifestation <${knopPath}/_references/_history001/_s0001/ttl/references.ttl> ;
  sflo:hasResourcePage <${knopPath}/_references/_history001/_s0001/ttl/index.html> .`
    : "";
  const referenceCatalogLocatedFileBlock = hasReferenceCatalog
    ? `\n\n<${referenceCatalogPath}/references.ttl> a sflo:LocatedFile, sflo:RdfDocument .`
    : "";
  const referenceCatalogHistoricalLocatedFileBlock = hasReferenceCatalog
    ? `\n\n<${knopPath}/_references/_history001/_s0001/ttl/references.ttl> a sflo:LocatedFile, sflo:RdfDocument .`
    : "";
  const referenceCatalogResourcePageBlocks = hasReferenceCatalog
    ? `\n\n<${referenceCatalogPath}/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${referenceCatalogPath}/_history001/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${referenceCatalogPath}/_history001/_s0001/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${knopPath}/_references/_history001/_s0001/ttl/index.html> a sflo:ResourcePage, sflo:LocatedFile .`
    : "";

  return `@base <${meshBase}> .
${SFLO_TURTLE_PREFIX_DECLARATION}
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

<${knopPath}> a sflo:Knop ;
  sflo:hasKnopMetadata <${knopPath}/_meta> ;
  sflo:hasKnopInventory <${knopPath}/_inventory> ;
  sflo:hasWorkingKnopInventoryFile <${knopPath}/_inventory/inventory.ttl> ;
${referenceCatalogLines}
  sflo:hasResourcePage <${knopPath}/index.html> ;
  <${SFLO_HAS_RESOURCE_PAGE_DEFINITION_IRI}> <${pageDefinitionPath}>${assetBundleLines} .

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
  sflo:hasManifestation <${knopPath}/_meta/_history001/_s0001/ttl> ;
  sflo:locatedFileForState <${knopPath}/_meta/_history001/_s0001/ttl/meta.ttl> ;
  sflo:hasResourcePage <${knopPath}/_meta/_history001/_s0001/index.html> .

<${knopPath}/_meta/_history001/_s0001/ttl> a sflo:ArtifactManifestation, sflo:RdfDocument ;
  sflo:locatedFileForManifestation <${knopPath}/_meta/_history001/_s0001/ttl/meta.ttl> ;
  sflo:hasResourcePage <${knopPath}/_meta/_history001/_s0001/ttl/index.html> .

<${knopPath}/_inventory> a sflo:KnopInventory, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasArtifactHistory <${knopInventoryProgression.historyPath}> ;
  sflo:currentArtifactHistory <${knopInventoryProgression.historyPath}> ;
  sflo:nextHistoryOrdinal "2"^^xsd:nonNegativeInteger ;
  sflo:hasWorkingLocatedFile <${knopPath}/_inventory/inventory.ttl> ;
  sflo:hasResourcePage <${knopPath}/_inventory/index.html> .
${referenceCatalogArtifactBlock}

<${pageDefinitionPath}> a <${SFLO_RESOURCE_PAGE_DEFINITION_IRI}>, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasArtifactHistory <${progression.historyPath}> ;
  sflo:currentArtifactHistory <${progression.historyPath}> ;
  sflo:nextHistoryOrdinal "2"^^xsd:nonNegativeInteger ;
  ${currentWorkingFileLocator}
  sflo:hasResourcePage <${pageDefinitionPath}/index.html> .

${assetBundleBlock}<${progression.historyPath}> a sflo:ArtifactHistory ;
${
    Array.from({ length: progression.nextStateOrdinal }, (_, index) =>
      `  sflo:hasHistoricalState <${progression.historyPath}/${
        toStateSegment(index + 1)
      }> ;`).join("\n")
  }
  sflo:historyOrdinal "1"^^xsd:nonNegativeInteger ;
  sflo:latestHistoricalState <${progression.nextStatePath}> ;
  sflo:nextStateOrdinal "${
    progression.nextStateOrdinal + 1
  }"^^xsd:nonNegativeInteger ;
  sflo:hasResourcePage <${progression.historyPath}/index.html> .

${pageDefinitionStateBlocks}

${pageDefinitionManifestationBlocks}

<${knopInventoryProgression.historyPath}> a sflo:ArtifactHistory ;
${
    Array.from(
      { length: knopInventoryProgression.nextStateOrdinal },
      (_, index) =>
        `  sflo:hasHistoricalState <${knopInventoryProgression.historyPath}/${
          toStateSegment(index + 1)
        }> ;`,
    ).join("\n")
  }
  sflo:historyOrdinal "1"^^xsd:nonNegativeInteger ;
  sflo:latestHistoricalState <${knopInventoryProgression.nextStatePath}> ;
  sflo:nextStateOrdinal "${
    knopInventoryProgression.nextStateOrdinal + 1
  }"^^xsd:nonNegativeInteger ;
  sflo:hasResourcePage <${knopInventoryProgression.historyPath}/index.html> .

${knopInventoryStateBlocks}

${knopInventoryManifestationBlocks}
${referenceCatalogHistoryBlocks}

<${knopPath}/_meta/meta.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<${knopPath}/_inventory/inventory.ttl> a sflo:LocatedFile, sflo:RdfDocument .
${referenceCatalogLocatedFileBlock}

${currentWorkingFileDeclaration}

<${knopPath}/_meta/_history001/_s0001/ttl/meta.ttl> a sflo:LocatedFile, sflo:RdfDocument .

${knopInventoryLocatedFileBlocks}
${referenceCatalogHistoricalLocatedFileBlock}

${pageDefinitionLocatedFileBlocks}

<${knopPath}/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${knopPath}/_meta/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${knopPath}/_meta/_history001/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${knopPath}/_meta/_history001/_s0001/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${knopPath}/_meta/_history001/_s0001/ttl/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${knopPath}/_inventory/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${knopInventoryProgression.historyPath}/index.html> a sflo:ResourcePage, sflo:LocatedFile .

${knopInventoryResourcePageBlocks}
${referenceCatalogResourcePageBlocks}

<${pageDefinitionPath}/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${progression.historyPath}/index.html> a sflo:ResourcePage, sflo:LocatedFile .

${pageDefinitionResourcePageBlocks}
`;
}

function renderPageDefinitionStateBlock(
  statePath: string,
  stateOrdinal: number,
  previousStatePath?: string,
): string {
  return `<${statePath}> a sflo:HistoricalState ;
  sflo:stateOrdinal "${stateOrdinal}"^^xsd:nonNegativeInteger ;
${
    previousStatePath
      ? `  sflo:previousHistoricalState <${previousStatePath}> ;\n`
      : ""
  }  sflo:hasManifestation <${statePath}/ttl> ;
  sflo:locatedFileForState <${statePath}/ttl/page.ttl> ;
  sflo:hasResourcePage <${statePath}/index.html> .`;
}

function renderPageDefinitionStateManifestationBlock(
  statePath: string,
): string {
  return `<${statePath}/ttl> a sflo:ArtifactManifestation, sflo:RdfDocument ;
  sflo:locatedFileForManifestation <${statePath}/ttl/page.ttl> ;
  sflo:hasResourcePage <${statePath}/ttl/index.html> .`;
}

interface RenderedArtifactHistoryModel {
  path: string;
  historyOrdinal?: number;
  latestStatePath?: string;
  nextStateOrdinal?: number;
  states: RenderedHistoricalStateModel[];
}

interface RenderedHistoricalStateModel {
  path: string;
  stateOrdinal?: number;
  previousStatePath?: string;
  manifestationPath: string;
  locatedFilePath: string;
}

interface HistoricalStateLocatedFileFallback {
  manifestationSegment: string;
  fileName: string;
}

function renderMultiHistoryPayloadWovenKnopInventoryTurtle(
  meshBase: string,
  designatorPath: string,
  payloadLayout: PayloadVersionLayout,
  workingLocalRelativePath: string,
  repositorySourceFloatingLocator: RepositorySourceFloatingLocator | undefined,
  currentKnopInventoryTurtle: string,
  options?: {
    knopInventoryHistoryPolicy?: SupportArtifactHistoryPolicy;
  },
): string {
  const knopPath = toKnopPath(designatorPath);
  const designatorPagePath = toDesignatorResourcePagePath(designatorPath);
  const payloadFileName = toFileName(workingLocalRelativePath);
  const currentWorkingFileLocator = renderCurrentWorkingFileLocator(
    workingLocalRelativePath,
    repositorySourceFloatingLocator,
  );
  const currentWorkingFileDeclaration = renderCurrentWorkingFileDeclaration(
    workingLocalRelativePath,
    repositorySourceFloatingLocator,
  );
  const errorMessage =
    `Could not parse the current KnopInventory while rendering multiple payload histories for ${designatorPath}.`;
  const quads = parseWeaveShapeQuads(
    meshBase,
    currentKnopInventoryTurtle,
    errorMessage,
  );
  const versionKnopInventory = shouldMaterializeSupportHistory(
    options?.knopInventoryHistoryPolicy ?? "versioned",
  );
  const payloadHistories = collectRenderedArtifactHistories(
    meshBase,
    quads,
    designatorPath,
    errorMessage,
  );
  const nextPayloadSnapshotPath =
    `${payloadLayout.nextManifestationPath}/${payloadFileName}`;
  upsertRenderedArtifactHistoryState(payloadHistories, {
    historyPath: payloadLayout.historyPath,
    statePath: payloadLayout.nextStatePath,
    manifestationPath: payloadLayout.nextManifestationPath,
    locatedFilePath: nextPayloadSnapshotPath,
    previousStatePath: payloadLayout.previousStatePath,
    stateOrdinal: payloadLayout.nextStateOrdinal,
  });

  const knopInventoryPath = `${knopPath}/_inventory`;
  const knopInventoryHistories = versionKnopInventory
    ? collectRenderedArtifactHistories(
      meshBase,
      quads,
      knopInventoryPath,
      errorMessage,
      {
        manifestationSegment: "ttl",
        fileName: "inventory.ttl",
      },
    )
    : [];
  const knopInventoryHistory = versionKnopInventory
    ? requireCurrentRenderedHistory(
      meshBase,
      quads,
      knopInventoryPath,
      knopInventoryHistories,
      errorMessage,
    )
    : undefined;
  if (
    versionKnopInventory &&
    knopInventoryHistory?.nextStateOrdinal === undefined
  ) {
    throw new WeaveInputError(errorMessage);
  }
  if (knopInventoryHistory !== undefined) {
    const nextKnopInventoryStatePath = `${knopInventoryHistory.path}/${
      toStateSegment(knopInventoryHistory.nextStateOrdinal!)
    }`;
    const previousKnopInventoryStatePath = knopInventoryHistory.latestStatePath;
    upsertRenderedArtifactHistoryState(knopInventoryHistories, {
      historyPath: knopInventoryHistory.path,
      statePath: nextKnopInventoryStatePath,
      manifestationPath: `${nextKnopInventoryStatePath}/ttl`,
      locatedFilePath: `${nextKnopInventoryStatePath}/ttl/inventory.ttl`,
      previousStatePath: previousKnopInventoryStatePath,
      stateOrdinal: knopInventoryHistory.nextStateOrdinal,
    });
  }

  const payloadHistoryPaths = payloadHistories.map((history) => history.path);
  const payloadHistoryBlocks = payloadHistories
    .map(renderRenderedArtifactHistoryBlock)
    .join("\n\n");
  const payloadStateBlocks = payloadHistories.flatMap((history) =>
    history.states.map(renderRenderedHistoricalStateBlock)
  ).join("\n\n");
  const payloadManifestationBlocks = payloadHistories.flatMap((history) =>
    history.states.map(renderRenderedManifestationBlock)
  ).join("\n\n");
  const payloadLocatedFileBlocks = payloadHistories.flatMap((history) =>
    history.states.map((state) =>
      `<${state.locatedFilePath}> a sflo:LocatedFile, sflo:RdfDocument .`
    )
  ).join("\n\n");
  const payloadResourcePageBlocks = renderRenderedHistoryResourcePageBlocks(
    payloadHistories,
  );

  const knopInventoryHistoryBlocks = knopInventoryHistories
    .map(renderRenderedArtifactHistoryBlock)
    .join("\n\n");
  const knopInventoryStateBlocks = knopInventoryHistories.flatMap((history) =>
    history.states.map(renderRenderedHistoricalStateBlock)
  ).join("\n\n");
  const knopInventoryManifestationBlocks = knopInventoryHistories.flatMap((
    history,
  ) => history.states.map(renderRenderedManifestationBlock)).join("\n\n");
  const knopInventoryLocatedFileBlocks = knopInventoryHistories.flatMap((
    history,
  ) =>
    history.states.map((state) =>
      `<${state.locatedFilePath}> a sflo:LocatedFile, sflo:RdfDocument .`
    )
  ).join("\n\n");
  const knopInventoryResourcePageBlocks =
    renderRenderedHistoryResourcePageBlocks(knopInventoryHistories);
  const payloadNextHistoryOrdinal = resolveOptionalNonNegativeIntegerLiteral(
    quads,
    toAbsoluteIri(meshBase, designatorPath),
    `${SFLO_NAMESPACE}nextHistoryOrdinal`,
    errorMessage,
  );
  const knopInventoryCurrentHistoryPath = knopInventoryHistory?.path;
  const knopInventoryNextHistoryOrdinal = versionKnopInventory
    ? resolveOptionalNonNegativeIntegerLiteral(
      quads,
      toAbsoluteIri(meshBase, knopInventoryPath),
      `${SFLO_NAMESPACE}nextHistoryOrdinal`,
      errorMessage,
    )
    : undefined;

  return `@base <${meshBase}> .
${SFLO_TURTLE_PREFIX_DECLARATION}
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

<${knopPath}> a sflo:Knop ;
  sflo:hasKnopMetadata <${knopPath}/_meta> ;
  sflo:hasKnopInventory <${knopPath}/_inventory> ;
  sflo:hasWorkingKnopInventoryFile <${knopPath}/_inventory/inventory.ttl> ;
  sflo:hasPayloadArtifact <${designatorPath}> ;
  sflo:hasResourcePage <${knopPath}/index.html> .

<${designatorPath}> a sflo:PayloadArtifact, sflo:DigitalArtifact, sflo:RdfDocument ;
${
    payloadHistoryPaths.map((historyPath) =>
      `  sflo:hasArtifactHistory <${historyPath}> ;`
    ).join("\n")
  }
  sflo:currentArtifactHistory <${payloadLayout.historyPath}> ;
${
    payloadNextHistoryOrdinal === undefined
      ? ""
      : `  sflo:nextHistoryOrdinal "${payloadNextHistoryOrdinal}"^^xsd:nonNegativeInteger ;
`
  }  ${currentWorkingFileLocator}
  sflo:hasResourcePage <${designatorPagePath}> .

${payloadHistoryBlocks}

${payloadStateBlocks}

${payloadManifestationBlocks}

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
  sflo:hasManifestation <${knopPath}/_meta/_history001/_s0001/ttl> ;
  sflo:locatedFileForState <${knopPath}/_meta/_history001/_s0001/ttl/meta.ttl> ;
  sflo:hasResourcePage <${knopPath}/_meta/_history001/_s0001/index.html> .

<${knopPath}/_meta/_history001/_s0001/ttl> a sflo:ArtifactManifestation, sflo:RdfDocument ;
  sflo:locatedFileForManifestation <${knopPath}/_meta/_history001/_s0001/ttl/meta.ttl> ;
  sflo:hasResourcePage <${knopPath}/_meta/_history001/_s0001/ttl/index.html> .

<${knopInventoryPath}> a sflo:KnopInventory, sflo:DigitalArtifact, sflo:RdfDocument ;
${
    knopInventoryHistory === undefined || knopInventoryCurrentHistoryPath ===
        undefined
      ? ""
      : `  sflo:hasArtifactHistory <${knopInventoryHistory.path}> ;
  sflo:currentArtifactHistory <${knopInventoryCurrentHistoryPath}> ;
`
  }${
    knopInventoryNextHistoryOrdinal === undefined
      ? ""
      : `  sflo:nextHistoryOrdinal "${knopInventoryNextHistoryOrdinal}"^^xsd:nonNegativeInteger ;
`
  }  sflo:hasWorkingLocatedFile <${knopPath}/_inventory/inventory.ttl> ;
  sflo:hasResourcePage <${knopPath}/_inventory/index.html> .

${knopInventoryHistoryBlocks}

${knopInventoryStateBlocks}

${knopInventoryManifestationBlocks}

<${knopPath}/_meta/meta.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<${knopPath}/_inventory/inventory.ttl> a sflo:LocatedFile, sflo:RdfDocument .

${currentWorkingFileDeclaration}

<${knopPath}/_meta/_history001/_s0001/ttl/meta.ttl> a sflo:LocatedFile, sflo:RdfDocument .

${payloadLocatedFileBlocks}

${knopInventoryLocatedFileBlocks}

<${designatorPagePath}> a sflo:ResourcePage, sflo:LocatedFile .

${payloadResourcePageBlocks}

<${knopPath}/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${knopPath}/_meta/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${knopPath}/_meta/_history001/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${knopPath}/_meta/_history001/_s0001/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${knopPath}/_meta/_history001/_s0001/ttl/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${knopPath}/_inventory/index.html> a sflo:ResourcePage, sflo:LocatedFile .

${knopInventoryResourcePageBlocks}
`;
}

function renderSecondPayloadWovenKnopInventoryTurtle(
  meshBase: string,
  designatorPath: string,
  payloadLayout: PayloadVersionLayout,
  workingLocalRelativePath: string,
  repositorySourceFloatingLocator: RepositorySourceFloatingLocator | undefined,
  currentKnopInventoryTurtle: string,
  options?: {
    knopMetadataHistoryPolicy?: SupportArtifactHistoryPolicy;
    knopInventoryHistoryPolicy?: SupportArtifactHistoryPolicy;
  },
): string {
  const applySupportHistoryPolicies = (turtle: string): string => {
    const knopPath = toKnopPath(designatorPath);
    let output = turtle;
    if (
      !shouldMaterializeSupportHistory(
        options?.knopMetadataHistoryPolicy ?? "versioned",
      )
    ) {
      output = omitInitialKnopMetadataHistory(output, knopPath);
    }
    if (
      !shouldMaterializeSupportHistory(
        options?.knopInventoryHistoryPolicy ?? "versioned",
      )
    ) {
      output = omitKnopInventoryHistory(output, knopPath);
    }
    return output;
  };

  if (
    payloadLayout.isNewHistory ||
    countArtifactHistoryPaths(
        meshBase,
        currentKnopInventoryTurtle,
        designatorPath,
      ) > 1
  ) {
    return applySupportHistoryPolicies(
      renderMultiHistoryPayloadWovenKnopInventoryTurtle(
        meshBase,
        designatorPath,
        payloadLayout,
        workingLocalRelativePath,
        repositorySourceFloatingLocator,
        currentKnopInventoryTurtle,
        { knopInventoryHistoryPolicy: options?.knopInventoryHistoryPolicy },
      ),
    );
  }

  const knopPath = toKnopPath(designatorPath);
  const designatorPagePath = toDesignatorResourcePagePath(designatorPath);
  const payloadStateOnePath = payloadLayout.currentStatePath!;
  const payloadStateOneManifestationPath = payloadLayout
    .currentManifestationPath!;
  const payloadStateTwoManifestationPath = payloadLayout.nextManifestationPath;
  const payloadFileName = toFileName(workingLocalRelativePath);
  const currentWorkingFileLocator = renderCurrentWorkingFileLocator(
    workingLocalRelativePath,
    repositorySourceFloatingLocator,
  );
  const currentWorkingFileDeclaration = renderCurrentWorkingFileDeclaration(
    workingLocalRelativePath,
    repositorySourceFloatingLocator,
  );

  return applySupportHistoryPolicies(`@base <${meshBase}> .
${SFLO_TURTLE_PREFIX_DECLARATION}
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
  ${currentWorkingFileLocator}
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
  sflo:locatedFileForManifestation <${payloadStateOneManifestationPath}/${payloadFileName}> ;
  sflo:hasResourcePage <${payloadStateOneManifestationPath}/index.html> .

<${payloadLayout.nextStatePath}> a sflo:HistoricalState ;
  sflo:stateOrdinal "2"^^xsd:nonNegativeInteger ;
  sflo:previousHistoricalState <${payloadStateOnePath}> ;
  sflo:hasManifestation <${payloadStateTwoManifestationPath}> ;
  sflo:locatedFileForState <${payloadStateTwoManifestationPath}/${payloadFileName}> ;
  sflo:hasResourcePage <${payloadLayout.nextStatePath}/index.html> .

<${payloadStateTwoManifestationPath}> a sflo:ArtifactManifestation, sflo:RdfDocument ;
  sflo:locatedFileForManifestation <${payloadStateTwoManifestationPath}/${payloadFileName}> ;
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
  sflo:hasManifestation <${knopPath}/_meta/_history001/_s0001/ttl> ;
  sflo:locatedFileForState <${knopPath}/_meta/_history001/_s0001/ttl/meta.ttl> ;
  sflo:hasResourcePage <${knopPath}/_meta/_history001/_s0001/index.html> .

<${knopPath}/_meta/_history001/_s0001/ttl> a sflo:ArtifactManifestation, sflo:RdfDocument ;
  sflo:locatedFileForManifestation <${knopPath}/_meta/_history001/_s0001/ttl/meta.ttl> ;
  sflo:hasResourcePage <${knopPath}/_meta/_history001/_s0001/ttl/index.html> .

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
  sflo:hasManifestation <${knopPath}/_inventory/_history001/_s0001/ttl> ;
  sflo:locatedFileForState <${knopPath}/_inventory/_history001/_s0001/ttl/inventory.ttl> ;
  sflo:hasResourcePage <${knopPath}/_inventory/_history001/_s0001/index.html> .

<${knopPath}/_inventory/_history001/_s0001/ttl> a sflo:ArtifactManifestation, sflo:RdfDocument ;
  sflo:locatedFileForManifestation <${knopPath}/_inventory/_history001/_s0001/ttl/inventory.ttl> ;
  sflo:hasResourcePage <${knopPath}/_inventory/_history001/_s0001/ttl/index.html> .

<${knopPath}/_inventory/_history001/_s0002> a sflo:HistoricalState ;
  sflo:stateOrdinal "2"^^xsd:nonNegativeInteger ;
  sflo:previousHistoricalState <${knopPath}/_inventory/_history001/_s0001> ;
  sflo:hasManifestation <${knopPath}/_inventory/_history001/_s0002/ttl> ;
  sflo:locatedFileForState <${knopPath}/_inventory/_history001/_s0002/ttl/inventory.ttl> ;
  sflo:hasResourcePage <${knopPath}/_inventory/_history001/_s0002/index.html> .

<${knopPath}/_inventory/_history001/_s0002/ttl> a sflo:ArtifactManifestation, sflo:RdfDocument ;
  sflo:locatedFileForManifestation <${knopPath}/_inventory/_history001/_s0002/ttl/inventory.ttl> ;
  sflo:hasResourcePage <${knopPath}/_inventory/_history001/_s0002/ttl/index.html> .

<${knopPath}/_meta/meta.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<${knopPath}/_inventory/inventory.ttl> a sflo:LocatedFile, sflo:RdfDocument .

${currentWorkingFileDeclaration}

<${payloadStateOneManifestationPath}/${payloadFileName}> a sflo:LocatedFile, sflo:RdfDocument .

<${payloadStateTwoManifestationPath}/${payloadFileName}> a sflo:LocatedFile, sflo:RdfDocument .

<${knopPath}/_meta/_history001/_s0001/ttl/meta.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<${knopPath}/_inventory/_history001/_s0001/ttl/inventory.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<${knopPath}/_inventory/_history001/_s0002/ttl/inventory.ttl> a sflo:LocatedFile, sflo:RdfDocument .

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

<${knopPath}/_meta/_history001/_s0001/ttl/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${knopPath}/_inventory/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${knopPath}/_inventory/_history001/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${knopPath}/_inventory/_history001/_s0001/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${knopPath}/_inventory/_history001/_s0001/ttl/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${knopPath}/_inventory/_history001/_s0002/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${knopPath}/_inventory/_history001/_s0002/ttl/index.html> a sflo:ResourcePage, sflo:LocatedFile .
`);
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
  const stateFourManifestationPath = `${stateFourPath}/ttl`;
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
    `${historyPath}/_s0003/ttl`,
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
    `${historyPath}/_s0003/ttl/inventory.ttl`,
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
    `${historyPath}/_s0003/ttl/index.html`,
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

function renderGenericFirstExtractedKnopWovenMeshInventoryTurtle(
  currentMeshInventoryTurtle: string,
  designatorPath: string,
  meshInventoryProgression: MeshInventoryProgression,
): string {
  const knopPath = toKnopPath(designatorPath);
  const designatorPagePath = toDesignatorResourcePagePath(designatorPath);
  const parentDesignatorPath = toParentDesignatorPath(designatorPath);
  const historyPath = meshInventoryProgression.historyPath;
  const latestManifestationPath =
    meshInventoryProgression.latestManifestationPath;
  const nextStatePath = meshInventoryProgression.nextStatePath;
  const nextStateOrdinal = meshInventoryProgression.nextStateOrdinal;
  const nextManifestationPath = `${nextStatePath}/ttl`;
  let blocks = normalizeMeshInventoryHeader(
    splitTurtleBlocks(currentMeshInventoryTurtle),
  );
  const preferredAnchorResourcePath = parentDesignatorPath ?? "_mesh";
  const anchorResourcePath = findSubjectBlockIndex(
      blocks,
      preferredAnchorResourcePath,
    ) === -1
    ? "_mesh"
    : preferredAnchorResourcePath;
  const preferredAnchorPagePath = parentDesignatorPath === undefined
    ? "_mesh/index.html"
    : toDesignatorResourcePagePath(parentDesignatorPath);
  const anchorPagePath = findSubjectBlockIndex(
      blocks,
      preferredAnchorPagePath,
    ) === -1
    ? "_mesh/index.html"
    : preferredAnchorPagePath;

  blocks = upsertSubjectBlockAfter(
    blocks,
    anchorResourcePath,
    designatorPath,
    renderMeshIdentifierBlock(designatorPath),
  );
  blocks = replaceSubjectBlock(
    blocks,
    "_mesh/_inventory",
    renderMeshInventoryArtifactBlock(historyPath),
  );
  blocks = replaceSubjectBlock(
    blocks,
    knopPath,
    renderMeshKnopBlockWithResourcePage(knopPath),
  );
  blocks = replaceSubjectBlock(
    blocks,
    historyPath,
    renderMeshInventoryHistoryBlock(
      historyPath,
      nextStateOrdinal,
      nextStatePath,
    ),
  );
  blocks = upsertSubjectBlockAfter(
    blocks,
    latestManifestationPath,
    nextStatePath,
    renderMeshInventoryStateBlock(
      nextStatePath,
      nextStateOrdinal,
      meshInventoryProgression.latestStatePath,
    ),
  );
  blocks = upsertSubjectBlockAfter(
    blocks,
    nextStatePath,
    nextManifestationPath,
    renderMeshInventoryStateManifestationBlock(nextStatePath),
  );
  blocks = upsertSubjectBlockAfter(
    blocks,
    `${latestManifestationPath}/inventory.ttl`,
    `${nextManifestationPath}/inventory.ttl`,
    renderLocatedFileBlock(`${nextManifestationPath}/inventory.ttl`),
  );
  blocks = upsertSubjectBlockAfter(
    blocks,
    anchorPagePath,
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
    `${latestManifestationPath}/index.html`,
    `${nextStatePath}/index.html`,
    renderResourcePageLocatedFileBlock(`${nextStatePath}/index.html`),
  );
  blocks = upsertSubjectBlockAfter(
    blocks,
    `${nextStatePath}/index.html`,
    `${nextManifestationPath}/index.html`,
    renderResourcePageLocatedFileBlock(
      `${nextManifestationPath}/index.html`,
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
  workingLocalRelativePath: string,
  repositorySourceFloatingLocator?: RepositorySourceFloatingLocator,
): string {
  const designatorPagePath = toDesignatorResourcePagePath(designatorPath);
  const currentWorkingFileLocator = renderCurrentWorkingFileLocator(
    workingLocalRelativePath,
    repositorySourceFloatingLocator,
  );
  return `<${designatorPath}> a sflo:PayloadArtifact, sflo:DigitalArtifact, sflo:RdfDocument ;
  ${currentWorkingFileLocator}
  sflo:hasResourcePage <${designatorPagePath}> .`;
}

function renderMeshInventoryArtifactBlock(historyPath: string): string {
  return `<_mesh/_inventory> a sflo:MeshInventory, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasArtifactHistory <${historyPath}> ;
  sflo:hasWorkingLocatedFile <_mesh/_inventory/inventory.ttl> ;
  sflo:hasResourcePage <_mesh/_inventory/index.html> .`;
}

function renderMeshInventoryHistoryBlock(
  historyPath: string,
  latestStateOrdinal: number,
  latestStatePath = `${historyPath}/${toStateSegment(latestStateOrdinal)}`,
): string {
  const ordinalStatePaths = latestStatePath ===
      `${historyPath}/${toStateSegment(latestStateOrdinal)}`
    ? Array.from(
      { length: latestStateOrdinal },
      (_, index) => `${historyPath}/${toStateSegment(index + 1)}`,
    )
    : [
      ...Array.from(
        { length: latestStateOrdinal - 1 },
        (_, index) => `${historyPath}/${toStateSegment(index + 1)}`,
      ),
      latestStatePath,
    ];
  const stateFacts = ordinalStatePaths.map((statePath) =>
    `  sflo:hasHistoricalState <${statePath}> ;`
  ).join("\n");
  return `<${historyPath}> a sflo:ArtifactHistory ;
  sflo:historyOrdinal "1"^^xsd:nonNegativeInteger ;
${stateFacts}
  sflo:hasResourcePage <${historyPath}/index.html> .`;
}

function renderMeshInventoryStateBlock(
  statePath: string,
  stateOrdinal: number,
  previousStatePath?: string,
): string {
  return `<${statePath}> a sflo:HistoricalState ;
  sflo:stateOrdinal "${stateOrdinal}"^^xsd:nonNegativeInteger ;
${
    previousStatePath
      ? `  sflo:previousHistoricalState <${previousStatePath}> ;\n`
      : ""
  }  sflo:hasManifestation <${statePath}/ttl> ;
  sflo:locatedFileForState <${statePath}/ttl/inventory.ttl> ;
  sflo:hasResourcePage <${statePath}/index.html> .`;
}

function renderMeshInventoryStateManifestationBlock(statePath: string): string {
  return `<${statePath}/ttl> a sflo:ArtifactManifestation, sflo:RdfDocument ;
  sflo:locatedFileForManifestation <${statePath}/ttl/inventory.ttl> ;
  sflo:hasResourcePage <${statePath}/ttl/index.html> .`;
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
  sflo:hasManifestation <_mesh/_inventory/_history001/_s0004/ttl> ;
  sflo:locatedFileForState <_mesh/_inventory/_history001/_s0004/ttl/inventory.ttl> ;
  sflo:hasResourcePage <_mesh/_inventory/_history001/_s0004/index.html> .`;
}

function renderMeshInventoryStateFourManifestationBlock(): string {
  return `<_mesh/_inventory/_history001/_s0004/ttl> a sflo:ArtifactManifestation, sflo:RdfDocument ;
  sflo:locatedFileForManifestation <_mesh/_inventory/_history001/_s0004/ttl/inventory.ttl> ;
  sflo:hasResourcePage <_mesh/_inventory/_history001/_s0004/ttl/index.html> .`;
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

function tryToMeshPath(meshBase: string, iri: string): string | undefined {
  if (!iri.startsWith(meshBase)) {
    return undefined;
  }

  const suffix = iri.slice(meshBase.length);
  return suffix.length === 0 ? undefined : suffix;
}

function renderFirstExtractedKnopWovenKnopInventoryTurtle(
  meshBase: string,
  designatorPath: string,
  options?: {
    knopMetadataHistoryPolicy?: SupportArtifactHistoryPolicy;
    knopInventoryHistoryPolicy?: SupportArtifactHistoryPolicy;
  },
): string {
  const knopPath = toKnopPath(designatorPath);
  const sourceRegistryPath = `${knopPath}/_sources`;
  const sourcesFilePath = `${sourceRegistryPath}/sources.ttl`;
  const extractionSourcePath = `${sourceRegistryPath}#extraction-source`;
  const shouldVersionKnopMetadata = shouldMaterializeSupportHistory(
    options?.knopMetadataHistoryPolicy ?? "versioned",
  );
  const shouldVersionKnopInventory = shouldMaterializeSupportHistory(
    options?.knopInventoryHistoryPolicy ?? "versioned",
  );

  const turtle = `@base <${meshBase}> .
${SFLO_TURTLE_PREFIX_DECLARATION}
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

<${knopPath}> a sflo:Knop ;
  sflo:hasKnopMetadata <${knopPath}/_meta> ;
  sflo:hasKnopInventory <${knopPath}/_inventory> ;
  sflo:hasKnopSourceRegistry <${sourceRegistryPath}> ;
  sflo:hasExtractionSource <${extractionSourcePath}> ;
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
  sflo:hasManifestation <${knopPath}/_meta/_history001/_s0001/ttl> ;
  sflo:locatedFileForState <${knopPath}/_meta/_history001/_s0001/ttl/meta.ttl> ;
  sflo:hasResourcePage <${knopPath}/_meta/_history001/_s0001/index.html> .

<${knopPath}/_meta/_history001/_s0001/ttl> a sflo:ArtifactManifestation, sflo:RdfDocument ;
  sflo:locatedFileForManifestation <${knopPath}/_meta/_history001/_s0001/ttl/meta.ttl> ;
  sflo:hasResourcePage <${knopPath}/_meta/_history001/_s0001/ttl/index.html> .

<${knopPath}/_inventory> a sflo:KnopInventory, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasArtifactHistory <${knopPath}/_inventory/_history001> ;
  sflo:currentArtifactHistory <${knopPath}/_inventory/_history001> ;
  sflo:nextHistoryOrdinal "2"^^xsd:nonNegativeInteger ;
  sflo:hasWorkingLocatedFile <${knopPath}/_inventory/inventory.ttl> ;
  sflo:hasResourcePage <${knopPath}/_inventory/index.html> .

<${sourceRegistryPath}> a sflo:KnopSourceRegistry, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasWorkingLocatedFile <${sourcesFilePath}> .

<${knopPath}/_inventory/_history001> a sflo:ArtifactHistory ;
  sflo:historyOrdinal "1"^^xsd:nonNegativeInteger ;
  sflo:hasHistoricalState <${knopPath}/_inventory/_history001/_s0001> ;
  sflo:latestHistoricalState <${knopPath}/_inventory/_history001/_s0001> ;
  sflo:nextStateOrdinal "2"^^xsd:nonNegativeInteger ;
  sflo:hasResourcePage <${knopPath}/_inventory/_history001/index.html> .

<${knopPath}/_inventory/_history001/_s0001> a sflo:HistoricalState ;
  sflo:stateOrdinal "1"^^xsd:nonNegativeInteger ;
  sflo:hasManifestation <${knopPath}/_inventory/_history001/_s0001/ttl> ;
  sflo:locatedFileForState <${knopPath}/_inventory/_history001/_s0001/ttl/inventory.ttl> ;
  sflo:hasResourcePage <${knopPath}/_inventory/_history001/_s0001/index.html> .

<${knopPath}/_inventory/_history001/_s0001/ttl> a sflo:ArtifactManifestation, sflo:RdfDocument ;
  sflo:locatedFileForManifestation <${knopPath}/_inventory/_history001/_s0001/ttl/inventory.ttl> ;
  sflo:hasResourcePage <${knopPath}/_inventory/_history001/_s0001/ttl/index.html> .

<${knopPath}/_meta/meta.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<${knopPath}/_inventory/inventory.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<${sourcesFilePath}> a sflo:LocatedFile, sflo:RdfDocument .

<${knopPath}/_meta/_history001/_s0001/ttl/meta.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<${knopPath}/_inventory/_history001/_s0001/ttl/inventory.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<${knopPath}/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${knopPath}/_meta/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${knopPath}/_meta/_history001/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${knopPath}/_meta/_history001/_s0001/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${knopPath}/_meta/_history001/_s0001/ttl/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${knopPath}/_inventory/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${knopPath}/_inventory/_history001/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${knopPath}/_inventory/_history001/_s0001/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${knopPath}/_inventory/_history001/_s0001/ttl/index.html> a sflo:ResourcePage, sflo:LocatedFile .
`;

  let output = turtle;
  if (!shouldVersionKnopMetadata) {
    output = omitInitialKnopMetadataHistory(output, knopPath);
  }
  if (!shouldVersionKnopInventory) {
    output = omitKnopInventoryHistory(output, knopPath);
  }
  return output;
}

function replaceExtractionSourceBlock(
  turtle: string,
  extractionSourcePath: string,
  replacementBlock: string,
): string {
  const blocks = splitTurtleBlocks(turtle);
  const blockIndex = findSubjectBlockIndex(blocks, extractionSourcePath);
  if (blockIndex === -1) {
    throw new WeaveInputError(
      `Could not replace existing ExtractionSource block <${extractionSourcePath}>.`,
    );
  }

  const nextBlocks = [...blocks];
  nextBlocks[blockIndex] = replacementBlock;
  return `${nextBlocks.join("\n\n")}\n`;
}

function renderExactExtractionSourceBlock(
  extractionSourcePath: string,
  sourceDesignatorPath: string,
  sourceStatePath: string,
  sourceEvidence: ExtractionSourceEvidenceModel | undefined,
): string {
  const facts: [string, string][] = [
    ["sflo:hasTargetArtifact", `<${sourceDesignatorPath}>`],
    ["sflo:hasRequestedTargetState", `<${sourceStatePath}>`],
    ...toExtractionSourceEvidenceFacts(sourceEvidence),
  ];

  return `<${extractionSourcePath}> a sflo:ExtractionSource ;
${
    facts.map(([predicate, object], index) =>
      `  ${predicate} ${object}${index === facts.length - 1 ? " ." : " ;"}`
    ).join("\n")
  }`;
}

function toExtractionSourceEvidenceFacts(
  sourceEvidence: ExtractionSourceEvidenceModel | undefined,
): [string, string][] {
  if (!sourceEvidence) {
    return [];
  }

  const facts: [string, string][] = [];
  if (sourceEvidence.sourceStatePath !== undefined) {
    facts.push([
      "sflo:hasObservedSourceState",
      `<${sourceEvidence.sourceStatePath}>`,
    ]);
  }
  if (sourceEvidence.sourceManifestationPath !== undefined) {
    facts.push([
      "sflo:hasObservedSourceManifestation",
      `<${sourceEvidence.sourceManifestationPath}>`,
    ]);
  }
  if (sourceEvidence.sourceLocatedFilePath !== undefined) {
    facts.push([
      "sflo:hasObservedSourceLocatedFile",
      `<${sourceEvidence.sourceLocatedFilePath}>`,
    ]);
  }
  if (sourceEvidence.sourceLocalRelativePath !== undefined) {
    facts.push([
      "sflo:observedSourceLocalRelativePath",
      `"${escapeTurtleString(sourceEvidence.sourceLocalRelativePath)}"`,
    ]);
  }
  if (sourceEvidence.sourceDigest !== undefined) {
    facts.push([
      "sflo:observedSourceDigest",
      `"${escapeTurtleString(sourceEvidence.sourceDigest)}"`,
    ]);
  }
  if (sourceEvidence.observedAt !== undefined) {
    facts.push([
      "sflo:observedAt",
      `"${escapeTurtleString(sourceEvidence.observedAt)}"`,
    ]);
  }

  return facts;
}

function escapeTurtleString(value: string): string {
  return value.replace(/[\b\t\n\f\r"\\]/g, (character) => {
    switch (character) {
      case "\b":
        return "\\b";
      case "\t":
        return "\\t";
      case "\n":
        return "\\n";
      case "\f":
        return "\\f";
      case "\r":
        return "\\r";
      case '"':
        return '\\"';
      case "\\":
        return "\\\\";
      default:
        return character;
    }
  });
}

function renderArtifactHistoryIndexPage(
  meshBase: string,
  options: {
    pagePath: string;
    description: string;
    artifactLabel: string;
    workingLocalRelativePath: string;
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
    escapeHtml(
      toRelativeHref(options.pagePath, options.workingLocalRelativePath),
    )
  }">${
    escapeHtml(
      toRelativeHref(options.pagePath, options.workingLocalRelativePath),
    )
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
  sourceWorkingLocalRelativePath: string,
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
    sourceWorkingLocalRelativePath,
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

function renderGenericExtractedIdentifierPage(
  meshBase: string,
  designatorPath: string,
): string {
  const canonical = new URL(designatorPath, meshBase).href;
  const displayDesignatorPath = formatDesignatorPathForDisplay(designatorPath);

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(displayDesignatorPath)}</title>
  <link rel="canonical" href="${escapeHtml(canonical)}">
</head>
<body>
  <main>
    <h1>${escapeHtml(displayDesignatorPath)}</h1>
    <p>Resource page for the Semantic Flow identifier <a href="${
    escapeHtml(canonical)
  }">${escapeHtml(canonical)}</a>.</p>
  </main>
</body>
</html>
`;
}

function countArtifactHistoryPaths(
  meshBase: string,
  currentKnopInventoryTurtle: string,
  artifactPath: string,
): number {
  const quads = parseWeaveShapeQuads(
    meshBase,
    currentKnopInventoryTurtle,
    `Could not parse the current KnopInventory while counting histories for ${artifactPath}.`,
  );
  return resolveNamedNodeObjectPaths(
    quads,
    meshBase,
    artifactPath,
    SFLO_HAS_ARTIFACT_HISTORY_IRI,
    `Could not resolve histories for ${artifactPath}.`,
  ).length;
}

function collectRenderedArtifactHistories(
  meshBase: string,
  quads: readonly Quad[],
  artifactPath: string,
  errorMessage: string,
  stateLocatedFileFallback?: HistoricalStateLocatedFileFallback,
): RenderedArtifactHistoryModel[] {
  return resolveNamedNodeObjectPaths(
    quads,
    meshBase,
    artifactPath,
    SFLO_HAS_ARTIFACT_HISTORY_IRI,
    errorMessage,
  ).sort((left, right) => left.localeCompare(right)).map((historyPath) => {
    const historyIri = toAbsoluteIri(meshBase, historyPath);
    const latestStatePath = resolveOptionalNamedNodePath(
      quads,
      meshBase,
      historyPath,
      SFLO_LATEST_HISTORICAL_STATE_IRI,
      errorMessage,
    );
    const nextStateOrdinal = resolveOptionalNonNegativeIntegerLiteral(
      quads,
      historyIri,
      SFLO_NEXT_STATE_ORDINAL_IRI,
      errorMessage,
    );
    const historyOrdinal = resolveOptionalNonNegativeIntegerLiteral(
      quads,
      historyIri,
      `${SFLO_NAMESPACE}historyOrdinal`,
      errorMessage,
    );
    const states = resolveNamedNodeObjectPaths(
      quads,
      meshBase,
      historyPath,
      SFLO_HAS_HISTORICAL_STATE_IRI,
      errorMessage,
    ).sort((left, right) => left.localeCompare(right)).map((statePath) =>
      collectRenderedHistoricalState(
        meshBase,
        quads,
        statePath,
        errorMessage,
        stateLocatedFileFallback,
      )
    );

    return {
      path: historyPath,
      ...(historyOrdinal === undefined ? {} : { historyOrdinal }),
      ...(latestStatePath === undefined ? {} : { latestStatePath }),
      ...(nextStateOrdinal === undefined ? {} : { nextStateOrdinal }),
      states,
    };
  });
}

function collectRenderedHistoricalState(
  meshBase: string,
  quads: readonly Quad[],
  statePath: string,
  errorMessage: string,
  stateLocatedFileFallback?: HistoricalStateLocatedFileFallback,
): RenderedHistoricalStateModel {
  const stateIri = toAbsoluteIri(meshBase, statePath);
  const manifestationPath = resolveOptionalNamedNodePath(
    quads,
    meshBase,
    statePath,
    SFLO_HAS_MANIFESTATION_IRI,
    errorMessage,
  );
  const stateLocatedFilePath = resolveOptionalNamedNodePath(
    quads,
    meshBase,
    statePath,
    `${SFLO_NAMESPACE}locatedFileForState`,
    errorMessage,
  );
  const manifestationLocatedFilePath = manifestationPath
    ? resolveOptionalNamedNodePath(
      quads,
      meshBase,
      manifestationPath,
      `${SFLO_NAMESPACE}locatedFileForManifestation`,
      errorMessage,
    )
    : undefined;
  const fallbackManifestationPath = stateLocatedFileFallback
    ? `${statePath}/${stateLocatedFileFallback.manifestationSegment}`
    : undefined;
  const manifestationPathWithFallback = manifestationPath ??
    fallbackManifestationPath;
  const fallbackLocatedFilePath = stateLocatedFileFallback
    ? `${manifestationPathWithFallback}/${stateLocatedFileFallback.fileName}`
    : undefined;
  const locatedFilePath = stateLocatedFilePath ??
    manifestationLocatedFilePath ??
    fallbackLocatedFilePath;
  if (!manifestationPathWithFallback || !locatedFilePath) {
    throw new WeaveInputError(errorMessage);
  }
  const previousStatePath = resolveOptionalNamedNodePath(
    quads,
    meshBase,
    statePath,
    `${SFLO_NAMESPACE}previousHistoricalState`,
    errorMessage,
  );
  const stateOrdinal = resolveOptionalNonNegativeIntegerLiteral(
    quads,
    stateIri,
    `${SFLO_NAMESPACE}stateOrdinal`,
    errorMessage,
  );

  return {
    path: statePath,
    ...(stateOrdinal === undefined ? {} : { stateOrdinal }),
    ...(previousStatePath === undefined ? {} : { previousStatePath }),
    manifestationPath: manifestationPathWithFallback,
    locatedFilePath,
  };
}

function upsertRenderedArtifactHistoryState(
  histories: RenderedArtifactHistoryModel[],
  state: {
    historyPath: string;
    statePath: string;
    manifestationPath: string;
    locatedFilePath: string;
    previousStatePath?: string;
    stateOrdinal?: number;
  },
): void {
  let history = histories.find((candidate) =>
    candidate.path === state.historyPath
  );
  if (!history) {
    history = {
      path: state.historyPath,
      ...(parseOptionalHistoryOrdinalFromPath(state.historyPath) === undefined
        ? {}
        : {
          historyOrdinal: parseOptionalHistoryOrdinalFromPath(
            state.historyPath,
          ),
        }),
      states: [],
    };
    histories.push(history);
    histories.sort((left, right) => left.path.localeCompare(right.path));
  }
  if (history.states.some((candidate) => candidate.path === state.statePath)) {
    throw new WeaveInputError(
      `Historical state already exists: ${state.statePath}`,
    );
  }
  history.states.push({
    path: state.statePath,
    ...(state.stateOrdinal === undefined
      ? {}
      : { stateOrdinal: state.stateOrdinal }),
    ...(state.previousStatePath === undefined
      ? {}
      : { previousStatePath: state.previousStatePath }),
    manifestationPath: state.manifestationPath,
    locatedFilePath: state.locatedFilePath,
  });
  history.states.sort((left, right) => left.path.localeCompare(right.path));
  history.latestStatePath = state.statePath;
  history.nextStateOrdinal = state.stateOrdinal === undefined
    ? history.nextStateOrdinal ?? 1
    : state.stateOrdinal + 1;
}

function requireCurrentRenderedHistory(
  meshBase: string,
  quads: readonly Quad[],
  artifactPath: string,
  histories: readonly RenderedArtifactHistoryModel[],
  errorMessage: string,
): RenderedArtifactHistoryModel {
  const currentHistoryPath = resolveOptionalNamedNodePath(
    quads,
    meshBase,
    artifactPath,
    SFLO_CURRENT_ARTIFACT_HISTORY_IRI,
    errorMessage,
  );
  const history = histories.find((candidate) =>
    candidate.path === currentHistoryPath
  );
  if (!history) {
    throw new WeaveInputError(errorMessage);
  }
  return history;
}

function renderRenderedArtifactHistoryBlock(
  history: RenderedArtifactHistoryModel,
): string {
  const predicates = [
    ...(history.historyOrdinal === undefined ? [] : [
      `sflo:historyOrdinal "${history.historyOrdinal}"^^xsd:nonNegativeInteger`,
    ]),
    ...history.states.map((state) => `sflo:hasHistoricalState <${state.path}>`),
    ...(history.latestStatePath === undefined
      ? []
      : [`sflo:latestHistoricalState <${history.latestStatePath}>`]),
    ...(history.nextStateOrdinal === undefined ? [] : [
      `sflo:nextStateOrdinal "${history.nextStateOrdinal}"^^xsd:nonNegativeInteger`,
    ]),
    `sflo:hasResourcePage <${history.path}/index.html>`,
  ];
  return renderSubjectPredicateBlock(
    history.path,
    "sflo:ArtifactHistory",
    predicates,
  );
}

function renderRenderedHistoricalStateBlock(
  state: RenderedHistoricalStateModel,
): string {
  const predicates = [
    ...(state.stateOrdinal === undefined
      ? []
      : [`sflo:stateOrdinal "${state.stateOrdinal}"^^xsd:nonNegativeInteger`]),
    ...(state.previousStatePath === undefined
      ? []
      : [`sflo:previousHistoricalState <${state.previousStatePath}>`]),
    `sflo:hasManifestation <${state.manifestationPath}>`,
    `sflo:locatedFileForState <${state.locatedFilePath}>`,
    `sflo:hasResourcePage <${state.path}/index.html>`,
  ];
  return renderSubjectPredicateBlock(
    state.path,
    "sflo:HistoricalState",
    predicates,
  );
}

function renderRenderedManifestationBlock(
  state: RenderedHistoricalStateModel,
): string {
  return renderSubjectPredicateBlock(
    state.manifestationPath,
    "sflo:ArtifactManifestation, sflo:RdfDocument",
    [
      `sflo:locatedFileForManifestation <${state.locatedFilePath}>`,
      `sflo:hasResourcePage <${state.manifestationPath}/index.html>`,
    ],
  );
}

function renderRenderedHistoryResourcePageBlocks(
  histories: readonly RenderedArtifactHistoryModel[],
): string {
  return histories.flatMap((history) => [
    `<${history.path}/index.html> a sflo:ResourcePage, sflo:LocatedFile .`,
    ...history.states.flatMap((state) => [
      `<${state.path}/index.html> a sflo:ResourcePage, sflo:LocatedFile .`,
      `<${state.manifestationPath}/index.html> a sflo:ResourcePage, sflo:LocatedFile .`,
    ]),
  ]).join("\n\n");
}

interface CurrentKnopSourceRegistry {
  sourceRegistryPath: string;
  sourcesFilePath: string;
  extractionSourcePath?: string;
}

interface CurrentKnopReferenceCatalog {
  referenceCatalogPath: string;
}

function renderKnopInventoryWithPreservedSupportArtifacts(options: {
  meshBase: string;
  currentKnopInventoryTurtle: string;
  renderedKnopInventoryTurtle: string;
  knopPath: string;
}): string {
  const sourceRegistry = resolveCurrentKnopSourceRegistry(options);
  const referenceCatalog = resolveCurrentKnopReferenceCatalog(options);
  if (sourceRegistry === undefined && referenceCatalog === undefined) {
    return options.renderedKnopInventoryTurtle;
  }

  let blocks = splitTurtleBlocks(options.renderedKnopInventoryTurtle);
  const currentBlocks = splitTurtleBlocks(options.currentKnopInventoryTurtle);
  const knopBlockIndex = findSubjectBlockIndex(blocks, options.knopPath);
  if (knopBlockIndex === -1) {
    throw new WeaveInputError(
      `Rendered KnopInventory did not contain Knop block <${options.knopPath}> while preserving carried Knop support artifacts.`,
    );
  }

  blocks = replaceSubjectBlock(
    blocks,
    options.knopPath,
    renderKnopBlockWithCarriedSupportFacts(
      blocks[knopBlockIndex]!,
      sourceRegistry,
      referenceCatalog,
    ),
  );
  let insertionSubjectPath = `${options.knopPath}/_inventory`;

  if (sourceRegistry !== undefined) {
    blocks = upsertSubjectBlockAfter(
      blocks,
      insertionSubjectPath,
      sourceRegistry.sourceRegistryPath,
      renderSubjectPredicateBlock(
        sourceRegistry.sourceRegistryPath,
        "sflo:KnopSourceRegistry, sflo:DigitalArtifact, sflo:RdfDocument",
        [
          `sflo:hasWorkingLocatedFile <${sourceRegistry.sourcesFilePath}>`,
        ],
      ),
    );
    blocks = upsertSubjectBlockAfter(
      blocks,
      sourceRegistry.sourceRegistryPath,
      sourceRegistry.sourcesFilePath,
      renderLocatedFileBlock(sourceRegistry.sourcesFilePath),
    );
    insertionSubjectPath = sourceRegistry.sourcesFilePath;
  }

  if (
    referenceCatalog !== undefined &&
    findSubjectBlockIndex(blocks, referenceCatalog.referenceCatalogPath) === -1
  ) {
    for (
      const block of collectSubjectSubtreeBlocks(
        currentBlocks,
        referenceCatalog.referenceCatalogPath,
      )
    ) {
      const subjectPath = getSubjectPathFromBlock(block);
      if (!subjectPath) {
        continue;
      }
      blocks = upsertSubjectBlockAfter(
        blocks,
        insertionSubjectPath,
        subjectPath,
        block,
      );
      insertionSubjectPath = subjectPath;
    }
  }

  return `${blocks.join("\n\n")}\n`;
}

function resolveCurrentKnopSourceRegistry(options: {
  meshBase: string;
  currentKnopInventoryTurtle: string;
  knopPath: string;
}): CurrentKnopSourceRegistry | undefined {
  const errorMessage =
    `Could not resolve Knop source registry from the current KnopInventory for ${options.knopPath}.`;
  const quads = parseWeaveShapeQuads(
    options.meshBase,
    options.currentKnopInventoryTurtle,
    errorMessage,
  );
  const sourceRegistryPath = resolveOptionalNamedNodePath(
    quads,
    options.meshBase,
    options.knopPath,
    SFLO_HAS_KNOP_SOURCE_REGISTRY_IRI,
    errorMessage,
  );
  if (sourceRegistryPath === undefined) {
    return undefined;
  }
  const extractionSourceIri = requireOptionalNamedNodeObject(
    quads,
    toAbsoluteIri(options.meshBase, options.knopPath),
    SFLO_HAS_EXTRACTION_SOURCE_IRI,
    errorMessage,
  );
  const extractionSourcePath = extractionSourceIri === undefined
    ? undefined
    : extractionSourceIri.startsWith(options.meshBase)
    ? extractionSourceIri.slice(options.meshBase.length)
    : extractionSourceIri;

  if (
    !hasNamedNodeFact(
      quads,
      options.meshBase,
      sourceRegistryPath,
      RDF_TYPE_IRI,
      SFLO_KNOP_SOURCE_REGISTRY_IRI,
    )
  ) {
    throw new WeaveInputError(errorMessage);
  }

  const sourcesFilePath = resolveOptionalNamedNodePath(
    quads,
    options.meshBase,
    sourceRegistryPath,
    SFLO_HAS_WORKING_LOCATED_FILE_IRI,
    errorMessage,
  );
  if (sourcesFilePath === undefined) {
    throw new WeaveInputError(errorMessage);
  }

  return { sourceRegistryPath, sourcesFilePath, extractionSourcePath };
}

function resolveCurrentKnopReferenceCatalog(options: {
  meshBase: string;
  currentKnopInventoryTurtle: string;
  knopPath: string;
}): CurrentKnopReferenceCatalog | undefined {
  const errorMessage =
    `Could not resolve Knop reference catalog from the current KnopInventory for ${options.knopPath}.`;
  const quads = parseWeaveShapeQuads(
    options.meshBase,
    options.currentKnopInventoryTurtle,
    errorMessage,
  );
  const referenceCatalogPath = resolveOptionalNamedNodePath(
    quads,
    options.meshBase,
    options.knopPath,
    SFLO_HAS_REFERENCE_CATALOG_IRI,
    errorMessage,
  );
  if (referenceCatalogPath === undefined) {
    return undefined;
  }

  if (
    !hasNamedNodeFact(
      quads,
      options.meshBase,
      referenceCatalogPath,
      RDF_TYPE_IRI,
      SFLO_REFERENCE_CATALOG_IRI,
    )
  ) {
    throw new WeaveInputError(errorMessage);
  }

  const referencesLocatedFilePath = resolveOptionalNamedNodePath(
    quads,
    options.meshBase,
    referenceCatalogPath,
    SFLO_HAS_WORKING_LOCATED_FILE_IRI,
    errorMessage,
  );
  const referencesFilePath = referencesLocatedFilePath ??
    resolveOptionalLiteralObject(
      quads,
      options.meshBase,
      referenceCatalogPath,
      SFLO_WORKING_FILE_PATH_IRI,
      errorMessage,
    );
  if (referencesFilePath === undefined) {
    throw new WeaveInputError(errorMessage);
  }

  return { referenceCatalogPath };
}

function renderKnopBlockWithCarriedSupportFacts(
  block: string,
  sourceRegistry: CurrentKnopSourceRegistry | undefined,
  referenceCatalog: CurrentKnopReferenceCatalog | undefined,
): string {
  const carriedLines = [
    ...(sourceRegistry === undefined ? [] : [
      `  sflo:hasKnopSourceRegistry <${sourceRegistry.sourceRegistryPath}> ;`,
      ...(sourceRegistry.extractionSourcePath === undefined ? [] : [
        `  sflo:hasExtractionSource <${sourceRegistry.extractionSourcePath}> ;`,
      ]),
    ]),
    ...(referenceCatalog === undefined ? [] : [
      `  sflo:hasReferenceCatalog <${referenceCatalog.referenceCatalogPath}> ;`,
    ]),
  ].filter((line) => !block.includes(line));
  if (carriedLines.length === 0) {
    return block;
  }

  const workingInventoryLine = "  sflo:hasWorkingKnopInventoryFile ";
  if (!block.includes(workingInventoryLine)) {
    throw new WeaveInputError(
      "Could not find hasWorkingKnopInventoryFile while preserving carried Knop support artifacts.",
    );
  }

  return block.replace(
    workingInventoryLine,
    `${carriedLines.join("\n")}\n${workingInventoryLine}`,
  );
}

function toRootDesignatorPath(designatorPath: string): string {
  const firstSlash = designatorPath.indexOf("/");
  return firstSlash === -1
    ? designatorPath
    : designatorPath.slice(0, firstSlash);
}

function toParentDesignatorPath(designatorPath: string): string | undefined {
  const lastSlash = designatorPath.lastIndexOf("/");
  return lastSlash === -1 ? undefined : designatorPath.slice(0, lastSlash);
}

function toFileName(path: string): string {
  const segments = path.split("/");
  return segments[segments.length - 1]!;
}

function toHistoryPathFromStatePath(statePath: string): string {
  return statePath.slice(0, statePath.lastIndexOf("/"));
}

function parseStateOrdinalFromPath(
  statePath: string,
  errorMessage: string,
): number {
  const match = toLastPathSegment(statePath).match(/^_s(\d+)$/);
  const parsed = match ? Number(match[1]) : Number.NaN;

  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new WeaveInputError(errorMessage);
  }

  return parsed;
}

function parseOptionalHistoryOrdinalFromPath(
  historyPath: string,
): number | undefined {
  const match = toLastPathSegment(historyPath).match(/^_history(\d+)$/);
  const parsed = match ? Number(match[1]) : Number.NaN;

  return Number.isInteger(parsed) && parsed >= 1 ? parsed : undefined;
}

function toStateSegment(stateOrdinal: number): string {
  return `_s${String(stateOrdinal).padStart(4, "0")}`;
}

function toLastPathSegment(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1);
}
