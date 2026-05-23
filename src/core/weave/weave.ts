import {
  formatDesignatorPathForDisplay,
  toDesignatorResourcePagePath,
  toKnopPath,
} from "../designator_segments.ts";
import {
  type NormalizedVersionTargetSpec,
  normalizeVersionTargetSpecs,
  resolveTargetSelections,
} from "../targeting.ts";
import type { WeaveNamingPolicies } from "./naming_policy.ts";
import {
  filterResourcePageFactsFromPlannedFiles,
  hasResourcePageGenerationPolicyOverrides,
  listGeneratedResourcePagePaths,
  type WeaveResourcePageGenerationPolicies,
} from "./resource_page_policy.ts";
import { SFLO_NAMESPACE } from "../rdf/namespaces.ts";
import { WeaveInputError } from "./errors.ts";
import {
  shouldMaterializeSupportHistory,
  type WeaveSupportHistoryPolicies,
} from "./support_history_policy.ts";
import type { VersionPlan } from "./version_plan.ts";
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
  renderFirstPayloadWovenKnopInventoryTurtle,
  renderSecondPayloadWovenKnopInventoryTurtle,
} from "./payload_renderers.ts";
import {
  renderFirstExtractedKnopWovenMeshInventoryTurtle,
  renderFirstKnopWovenMeshInventoryTurtle,
  renderFirstPayloadWovenCurrentOnlyMeshInventoryTurtle,
  renderFirstPayloadWovenMeshInventoryTurtle,
  renderGenericFirstExtractedKnopWovenMeshInventoryTurtle,
  renderMeshMetadataWithMeshInventoryProgression,
} from "./mesh_inventory_renderers.ts";
import {
  renderCurrentOnlyReferenceCatalogWovenKnopInventoryTurtle,
  renderFirstExtractedKnopWovenKnopInventoryTurtle,
  renderFirstKnopWovenKnopInventoryTurtle,
  renderFirstReferenceCatalogWovenKnopInventoryTurtle,
  renderSubsequentPageDefinitionWovenKnopInventoryTurtle,
} from "./knop_inventory_renderers.ts";
import {
  resolveFirstPayloadVersionLayout,
  resolveSecondPayloadVersionLayout,
} from "./payload_version_layout.ts";
import {
  hasNamedNodeFact,
  parseWeaveShapeQuads,
  requireOptionalNamedNodeObject,
  requireSingleNamedNodeObject,
  requireSingleNonNegativeIntegerLiteral,
  resolveOptionalNamedNodePath,
  toAbsoluteIri,
  toMeshRelativePath,
} from "./rdf_helpers.ts";
import { findSubjectBlockIndex, splitTurtleBlocks } from "./turtle_blocks.ts";
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
import { renderKnopInventoryWithPreservedSupportArtifacts } from "./knop_support_renderers.ts";
import {
  renderAliceIdentifierPageAfterFirstExtractedWeave,
  renderArtifactHistoryIndexPage,
  renderExtractedPersonIdentifierPage,
  renderGenericExtractedIdentifierPage,
} from "./legacy_page_renderers.ts";
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
const SFLO_HAS_HISTORICAL_STATE_IRI = `${SFLO_NAMESPACE}hasHistoricalState`;
const SFLO_HAS_KNOP_INVENTORY_IRI = `${SFLO_NAMESPACE}hasKnopInventory`;
const SFLO_HAS_KNOP_METADATA_IRI = `${SFLO_NAMESPACE}hasKnopMetadata`;
const SFLO_HAS_REFERENCE_CATALOG_IRI = `${SFLO_NAMESPACE}hasReferenceCatalog`;
const SFLO_HAS_WORKING_KNOP_INVENTORY_FILE_IRI =
  `${SFLO_NAMESPACE}hasWorkingKnopInventoryFile`;
const SFLO_KNOP_IRI = `${SFLO_NAMESPACE}Knop`;
const SFLO_KNOP_INVENTORY_IRI = `${SFLO_NAMESPACE}KnopInventory`;
const SFLO_LATEST_HISTORICAL_STATE_IRI =
  `${SFLO_NAMESPACE}latestHistoricalState`;
const SFLO_MESH_INVENTORY_IRI = `${SFLO_NAMESPACE}MeshInventory`;
const SFLO_NEXT_STATE_ORDINAL_IRI = `${SFLO_NAMESPACE}nextStateOrdinal`;
const SFLO_PAYLOAD_ARTIFACT_IRI = `${SFLO_NAMESPACE}PayloadArtifact`;
const SFLO_RDF_DOCUMENT_IRI = `${SFLO_NAMESPACE}RdfDocument`;

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

function toStateSegment(stateOrdinal: number): string {
  return `_s${String(stateOrdinal).padStart(4, "0")}`;
}

function toLastPathSegment(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1);
}
