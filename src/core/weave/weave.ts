import {
  formatDesignatorPathForDisplay,
  toDesignatorResourcePagePath,
  toKnopPath,
} from "../designator_segments.ts";
import type { PlannedBinaryFile, PlannedFile } from "../planned_file.ts";
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
  type ResourcePageGenerationConfig,
  type WeaveResourcePageGenerationPolicies,
} from "./resource_page_policy.ts";
import { SFLO_NAMESPACE } from "../rdf/namespaces.ts";
import { WeaveInputError } from "./errors.ts";
import {
  shouldMaterializeSupportHistory,
  type WeaveSupportHistoryPolicies,
} from "./support_history_policy.ts";
import type { VersionPlan } from "./version_plan.ts";
import type { WeaveableKnopCandidate } from "./candidates.ts";
import type { PlanWeaveInput, WeavePlan } from "./planning_models.ts";
import type { WeaveSlice } from "./slices.ts";
import { toArtifactManifestationPath } from "./artifact_manifestation_paths.ts";
import {
  assertOverwriteExistingStateTargets,
  planOverwriteExistingPayloadState,
} from "./payload_overwrite.ts";
import {
  renderFirstPayloadWovenKnopInventoryTurtle,
  renderLaterPayloadWovenKnopInventoryTurtle,
} from "./payload_renderers.ts";
import {
  renderBatchedFirstPayloadWovenMeshInventoryTurtle,
  renderFirstKnopWovenMeshInventoryTurtle,
  renderFirstPayloadWovenCurrentOnlyMeshInventoryTurtle,
  renderFirstPayloadWovenMeshInventoryTurtle,
  renderGenericFirstExtractedKnopWovenMeshInventoryTurtle,
  renderMeshMetadataWithMeshInventoryProgression,
} from "./mesh_inventory_renderers.ts";
import {
  renderCurrentOnlyPageDefinitionWovenKnopInventoryTurtle,
  renderCurrentOnlyReferenceCatalogWovenKnopInventoryTurtle,
  renderFirstExtractedKnopWovenKnopInventoryTurtle,
  renderFirstKnopWovenKnopInventoryTurtle,
  renderFirstReferenceCatalogWovenKnopInventoryTurtle,
  renderSubsequentPageDefinitionWovenKnopInventoryTurtle,
} from "./knop_inventory_renderers.ts";
import {
  resolveFirstPayloadVersionLayout,
  resolveLaterPayloadVersionLayout,
} from "./payload_version_layout.ts";
import { resolveLaterPayloadWeaveReadModel } from "./payload_weave_read_model.ts";
import { hasNamedNodeFact, parseWeaveShapeQuads } from "./rdf_helpers.ts";
import { classifyWeaveSlice } from "./slice_classification.ts";
import { extractCurrentReferenceCatalogLinks } from "./reference_catalog_links.ts";
import {
  renderExactExtractionSourceBlock,
  replaceExtractionSourceBlock,
} from "./extraction_source_blocks.ts";
import {
  resolveCurrentKnopInventoryProgressionForPageDefinitionWeave,
  resolveCurrentMeshInventoryProgressionForFirstKnopWeave,
  resolveCurrentMeshInventoryProgressionForFirstPayloadWeave,
  resolvePageDefinitionWeaveProgression,
} from "./progression_resolvers.ts";
import {
  buildCurrentOnlyPageDefinitionWeavePages,
  buildCurrentOnlyReferenceCatalogWeavePages,
  buildFirstExtractedKnopWeavePages,
  buildFirstKnopWeavePages,
  buildFirstPayloadWeavePages,
  buildFirstReferenceCatalogWeavePages,
  buildLaterPayloadWeavePages,
  buildSubsequentPageDefinitionWeavePages,
} from "./resource_page_builders.ts";
import type { ResourcePageModel } from "./resource_page_models.ts";
import { renderKnopInventoryWithPreservedSupportArtifacts } from "./knop_support_renderers.ts";
import {
  renderArtifactHistoryIndexPage,
  renderGenericExtractedIdentifierPage,
} from "./legacy_page_renderers.ts";
import {
  assertCurrentKnopInventoryBaseShape,
  assertCurrentKnopInventoryShapeForFirstExtractedKnopWeave,
  assertCurrentKnopInventoryShapeForFirstPageDefinitionWeave,
  assertCurrentKnopInventoryShapeForFirstReferenceCatalogWeave,
  assertCurrentKnopInventoryShapeForSubsequentPageDefinitionWeave,
  assertCurrentKnopInventoryWithoutHistory,
  assertCurrentKnopMetadataShape,
  assertCurrentMeshInventoryShapeForFirstExtractedKnopWeave,
  assertCurrentMeshInventoryShapeForFirstReferenceCatalogWeave,
  assertCurrentPayloadArtifactShape,
  assertCurrentSourceRegistryShapeForFirstExtractedKnopWeave,
  assertReferenceTargetSourcePayloadShapeForFirstExtractedKnopWeave,
  currentPayloadArtifactIsRdfDocument,
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
  ResourcePageBlankNodeModel,
  ResourcePageBlankNodesPanelModel,
  ResourcePageBreadcrumbModel,
  ResourcePageChildIdentifierGroupModel,
  ResourcePageChildIdentifierModel,
  ResourcePageChildrenPanelModel,
  ResourcePageCurrentLinksPanelModel,
  ResourcePageDocumentKind,
  ResourcePageDocumentModel,
  ResourcePageExtractionSourceModel,
  ResourcePageExtractionSourceSummaryMetadataModel,
  ResourcePageFactSectionsPanelModel,
  ResourcePageHistoryGroupModel,
  ResourcePageHistoryPanelModel,
  ResourcePageHistoryStateModel,
  ResourcePageKnopArtifactsPanelModel,
  ResourcePageLinkListMetadataModel,
  ResourcePageMetadataModel,
  ResourcePageModel,
  ResourcePagePanelModel,
  ResourcePagePropertiesPanelModel,
  ResourcePagePropertyModel,
  ResourcePageRawSourcePanelGroupModel,
  ResourcePageRawSourcePanelModel,
  ResourcePageRdfClassModel,
  ResourcePageReferenceGroupModel,
  ResourcePageReferenceLinkModel,
  ResourcePageReferencesPanelModel,
  ResourcePageReferenceTargetLinkModel,
  ResourcePageReferenceTargetModel,
  ResourcePageRepositorySourceMetadataModel,
  ResourcePageSectionModel,
  ResourcePageSemanticFlowMetadataPanelModel,
  ResourcePageTextMetadataModel,
  SimpleResourcePageModel,
} from "./resource_page_models.ts";
export type {
  ResourcePageTemplateDescriptor,
  ResourcePageTemplateFragment,
  ResourcePageTemplateFragmentsResult,
  ResourcePageTemplatePageHtmlResult,
  ResourcePageTemplateRenderRequest,
  ResourcePageTemplateRenderResult,
  ResourcePageTemplateRole,
  ResourcePageTemplateSlot,
} from "./resource_page_template_contract.ts";
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

const SFLO_HAS_ARTIFACT_HISTORY_IRI = `${SFLO_NAMESPACE}hasArtifactHistory`;
const SFLO_HAS_REFERENCE_CATALOG_IRI = `${SFLO_NAMESPACE}hasReferenceCatalog`;

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
    if (requestedTargets.length > 1 && !overwriteExistingState) {
      const plan = planExplicitPayloadBatchWeave(
        meshBase,
        input.currentMeshInventoryTurtle,
        input.currentMeshMetadataTurtle,
        weaveableKnops,
        input.supportHistoryPolicies,
        input.namingPolicies,
      );

      return applyResourcePageGenerationPolicies(plan, {
        config: input.resourcePageGenerationConfig,
        policies: input.resourcePageGenerationPolicies,
        explicitRequest: requestedTargets.length > 0,
      });
    }
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
            input.supportHistoryPolicies,
          );
        case "laterPayloadWeave":
          return planLaterPayloadWeave(
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
    config: input.resourcePageGenerationConfig,
    policies: input.resourcePageGenerationPolicies,
    explicitRequest: requestedTargets.length > 0,
  });
}

export function planVersion(input: PlanWeaveInput): VersionPlan {
  return toVersionPlan(planWeave(input));
}

/**
 * Plans an exact payload batch through the coherent batch planner even when
 * the request contains only one candidate. This entry is intentionally
 * separate from planWeave so API cardinality adaptation cannot change the
 * CLI's established single-candidate dispatch.
 */
export function planCoherentPayloadBatchVersion(
  input: PlanWeaveInput,
): VersionPlan {
  const meshBase = normalizeMeshBase(input.meshBase);
  const requestedTargets = normalizeVersionTargetSpecs(
    input.request.targets,
    "request.targets",
    (message) => new WeaveInputError(message),
  );
  if (requestedTargets.length === 0) {
    throw new WeaveInputError(
      "Coherent payload batch versioning requires at least one exact target.",
    );
  }
  if (
    input.request.overwriteExistingState === true ||
    requestedTargets.some((target) => target.recursive)
  ) {
    throw new WeaveInputError(
      "Coherent payload batch versioning supports non-overwrite exact targets only.",
    );
  }

  const selections = filterWeaveableKnops(
    input.weaveableKnops,
    requestedTargets,
  );
  if (selections.length !== requestedTargets.length) {
    throw new WeaveInputError(
      "Requested targets did not match every coherent payload batch candidate.",
    );
  }

  const plan = planExplicitPayloadBatchWeave(
    meshBase,
    input.currentMeshInventoryTurtle,
    input.currentMeshMetadataTurtle,
    selections,
    input.supportHistoryPolicies,
    input.namingPolicies,
  );
  return toVersionPlan(applyResourcePageGenerationPolicies(plan, {
    config: input.resourcePageGenerationConfig,
    policies: input.resourcePageGenerationPolicies,
    explicitRequest: true,
  }));
}

function toVersionPlan(plan: WeavePlan): VersionPlan {
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
    ...(plan.createdBinaryFiles
      ? { createdBinaryFiles: plan.createdBinaryFiles }
      : {}),
    updatedFiles,
  };
}

function applyResourcePageGenerationPolicies(
  plan: WeavePlan,
  options: {
    config?: ResourcePageGenerationConfig;
    policies?: WeaveResourcePageGenerationPolicies;
    explicitRequest?: boolean;
  },
): WeavePlan {
  if (
    options.config === undefined &&
    !hasResourcePageGenerationPolicyOverrides(options.policies)
  ) {
    return plan;
  }

  const createdFiles = filterResourcePageFactsFromPlannedFiles(
    plan.meshBase,
    plan.createdFiles,
    options.policies,
    options.explicitRequest ?? false,
    options.config,
  );
  const updatedFiles = filterResourcePageFactsFromPlannedFiles(
    plan.meshBase,
    plan.updatedFiles,
    options.policies,
    options.explicitRequest ?? false,
    options.config,
  );
  const generatedPagePaths = new Set(
    [...createdFiles, ...updatedFiles].flatMap((file) =>
      file.path.endsWith("inventory.ttl") &&
        typeof file.contents === "string"
        ? listGeneratedResourcePagePaths({
          meshBase: plan.meshBase,
          inventoryTurtle: file.contents,
          parseErrorMessage:
            `Could not parse ${file.path} while filtering planned ResourcePages.`,
          config: options.config,
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

  if (slice === "firstPayloadWeave" || slice === "laterPayloadWeave") {
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

interface FirstPayloadBatchEntry {
  selection: SelectedWeaveableKnopCandidate;
  payloadLayout: ReturnType<typeof resolveFirstPayloadVersionLayout>;
  payloadIsRdfDocument: boolean;
  meshInventoryProgression?: ReturnType<
    typeof resolveCurrentMeshInventoryProgressionForFirstPayloadWeave
  >;
}

function planExplicitPayloadBatchWeave(
  meshBase: string,
  currentMeshInventoryTurtle: string,
  currentMeshMetadataTurtle: string | undefined,
  selectedWeaveableKnops: readonly SelectedWeaveableKnopCandidate[],
  supportHistoryPolicies?: WeaveSupportHistoryPolicies,
  namingPolicies?: WeaveNamingPolicies,
): WeavePlan {
  const selections = [...selectedWeaveableKnops].sort((left, right) =>
    left.candidate.designatorPath.localeCompare(right.candidate.designatorPath)
  );
  const plans: WeavePlan[] = [];
  const firstPayloadEntries: FirstPayloadBatchEntry[] = [];

  for (const selection of selections) {
    const candidate = selection.candidate;
    const target = selection.target;
    const designatorPath = candidate.designatorPath;
    const knopPath = toKnopPath(designatorPath);

    withBatchTargetDiagnostic(designatorPath, () => {
      if (target?.recursive) {
        throw new WeaveInputError(
          "Multi-target payload weave requires exact target designators; recursive target selection is not supported for a payload batch.",
        );
      }

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

      const detectedSlice = classifyWeaveSlice(meshBase, candidate, target);
      const slice = detectedSlice ?? (target !== undefined &&
          candidate.payloadArtifact?.currentArtifactHistoryPath !== undefined
        ? "laterPayloadWeave"
        : undefined);
      assertPayloadNamingSupportedForSlice(slice, designatorPath, target);

      if (
        slice === "laterPayloadWeave" && payloadTargetIsAlreadyCurrent(
          candidate,
          target,
        )
      ) {
        return;
      }

      if (slice === "firstPayloadWeave") {
        firstPayloadEntries.push(resolveFirstPayloadBatchEntry(
          meshBase,
          currentMeshInventoryTurtle,
          currentMeshMetadataTurtle,
          selection,
          supportHistoryPolicies,
          namingPolicies,
        ));
        plans.push(planFirstPayloadWeave(
          meshBase,
          currentMeshInventoryTurtle,
          currentMeshMetadataTurtle,
          candidate,
          target,
          supportHistoryPolicies,
          namingPolicies,
        ));
        return;
      }

      if (slice === "laterPayloadWeave") {
        plans.push(planLaterPayloadWeave(
          meshBase,
          candidate,
          target,
          supportHistoryPolicies,
          namingPolicies,
        ));
        return;
      }

      throw new WeaveInputError(
        `Multi-target weave supports explicit payload targets only; ${designatorPath} is currently ${
          slice ?? "not weaveable"
        }.`,
      );
    });
  }

  if (plans.length === 0) {
    return {
      meshBase,
      wovenDesignatorPaths: [],
      createdFiles: [],
      updatedFiles: [],
      createdPages: [],
    };
  }

  return mergePayloadBatchPlans(
    meshBase,
    currentMeshInventoryTurtle,
    currentMeshMetadataTurtle,
    plans,
    firstPayloadEntries,
  );
}

function resolveFirstPayloadBatchEntry(
  meshBase: string,
  currentMeshInventoryTurtle: string,
  currentMeshMetadataTurtle: string | undefined,
  selection: SelectedWeaveableKnopCandidate,
  supportHistoryPolicies?: WeaveSupportHistoryPolicies,
  namingPolicies?: WeaveNamingPolicies,
): FirstPayloadBatchEntry {
  const candidate = selection.candidate;
  const target = selection.target;
  const payloadArtifact = candidate.payloadArtifact!;
  const designatorPath = candidate.designatorPath;
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
      designatorPath,
    )
    : undefined;
  assertCurrentPayloadArtifactShape(
    meshBase,
    candidate.currentKnopInventoryTurtle,
    designatorPath,
    payloadArtifact,
  );
  const payloadIsRdfDocument = payloadArtifact.payloadIsRdfDocument ??
    currentPayloadArtifactIsRdfDocument(
      meshBase,
      candidate.currentKnopInventoryTurtle,
      designatorPath,
    );
  const payloadLayout = resolveFirstPayloadVersionLayout(
    meshBase,
    designatorPath,
    payloadArtifact.workingLocalRelativePath,
    candidate.currentKnopInventoryTurtle,
    payloadArtifact.currentArtifactHistoryPath,
    target,
    namingPolicies,
  );

  return {
    selection,
    payloadLayout,
    payloadIsRdfDocument,
    ...(meshInventoryProgression ? { meshInventoryProgression } : {}),
  };
}

function mergePayloadBatchPlans(
  meshBase: string,
  currentMeshInventoryTurtle: string,
  currentMeshMetadataTurtle: string | undefined,
  plans: readonly WeavePlan[],
  firstPayloadEntries: readonly FirstPayloadBatchEntry[],
): WeavePlan {
  const createdFiles: PlannedFile[] = [];
  const createdBinaryFiles: PlannedBinaryFile[] = [];
  const updatedFiles: PlannedFile[] = [];
  const createdPages: ResourcePageModel[] = [];
  const createdPaths = new Set<string>();
  const updatedPaths = new Set<string>();
  const pagePaths = new Set<string>();
  const firstPayloadProgression = resolveBatchMeshInventoryProgression(
    firstPayloadEntries,
  );
  const mergedMeshInventoryTurtle = firstPayloadEntries.length === 0
    ? undefined
    : renderBatchedFirstPayloadWovenMeshInventoryTurtle(
      currentMeshInventoryTurtle,
      meshBase,
      firstPayloadEntries.map((entry) => ({
        designatorPath: entry.selection.candidate.designatorPath,
        workingLocalRelativePath: entry.selection.candidate.payloadArtifact!
          .workingLocalRelativePath,
        repositorySourceFloatingLocator: entry.selection.candidate
          .payloadArtifact!.repositorySourceFloatingLocator,
        payloadIsRdfDocument: entry.payloadIsRdfDocument,
      })),
      firstPayloadProgression,
    );

  if (firstPayloadProgression && mergedMeshInventoryTurtle) {
    addCreatedFile(createdFiles, createdPaths, updatedPaths, {
      path: `${firstPayloadProgression.nextStatePath}/ttl/inventory.ttl`,
      contents: mergedMeshInventoryTurtle,
    });
  }
  if (mergedMeshInventoryTurtle) {
    addUpdatedFile(updatedFiles, updatedPaths, createdPaths, {
      path: "_mesh/_inventory/inventory.ttl",
      contents: mergedMeshInventoryTurtle,
    });
  }

  for (const plan of plans) {
    for (const file of plan.createdFiles) {
      if (isSharedMeshInventoryFile(file.path)) {
        continue;
      }
      addCreatedFile(createdFiles, createdPaths, updatedPaths, file);
    }
    for (const file of plan.createdBinaryFiles ?? []) {
      addCreatedBinaryFile(
        createdBinaryFiles,
        createdPaths,
        updatedPaths,
        file,
      );
    }
    for (const file of plan.updatedFiles) {
      if (isSharedMeshInventoryFile(file.path)) {
        continue;
      }
      addUpdatedFile(updatedFiles, updatedPaths, createdPaths, file);
    }
    for (const page of plan.createdPages) {
      if (pagePaths.has(page.path)) {
        continue;
      }
      createdPages.push(page);
      pagePaths.add(page.path);
    }
  }

  if (firstPayloadProgression) {
    addUpdatedFile(updatedFiles, updatedPaths, createdPaths, {
      path: "_mesh/_meta/meta.ttl",
      contents: renderMeshMetadataWithMeshInventoryProgression(
        currentMeshMetadataTurtle,
        firstPayloadProgression,
      ),
    });
  }

  return {
    meshBase,
    wovenDesignatorPaths: plans.flatMap((plan) => plan.wovenDesignatorPaths),
    createdFiles,
    ...(createdBinaryFiles.length > 0 ? { createdBinaryFiles } : {}),
    updatedFiles,
    createdPages,
  };
}

function resolveBatchMeshInventoryProgression(
  firstPayloadEntries: readonly FirstPayloadBatchEntry[],
): FirstPayloadBatchEntry["meshInventoryProgression"] {
  const progressions = firstPayloadEntries
    .map((entry) => entry.meshInventoryProgression)
    .filter((progression) => progression !== undefined);
  if (progressions.length === 0) {
    return undefined;
  }
  if (progressions.length !== firstPayloadEntries.length) {
    throw new WeaveInputError(
      "Multi-target payload weave found conflicting MeshInventory history policies across requested targets.",
    );
  }

  const [first, ...rest] = progressions;
  for (const progression of rest) {
    if (!meshInventoryProgressionsEqual(first!, progression)) {
      throw new WeaveInputError(
        "Multi-target payload weave found impossible MeshInventory progression across requested targets.",
      );
    }
  }

  return first;
}

function meshInventoryProgressionsEqual(
  left: NonNullable<FirstPayloadBatchEntry["meshInventoryProgression"]>,
  right: NonNullable<FirstPayloadBatchEntry["meshInventoryProgression"]>,
): boolean {
  return left.historyPath === right.historyPath &&
    left.latestStatePath === right.latestStatePath &&
    left.latestStateOrdinal === right.latestStateOrdinal &&
    left.latestManifestationPath === right.latestManifestationPath &&
    left.nextStatePath === right.nextStatePath &&
    left.nextStateOrdinal === right.nextStateOrdinal &&
    left.nextHistoryOrdinal === right.nextHistoryOrdinal;
}

function isSharedMeshInventoryFile(path: string): boolean {
  return path === "_mesh/_inventory/inventory.ttl" ||
    path === "_mesh/_meta/meta.ttl" ||
    path.startsWith("_mesh/_inventory/_history");
}

function addCreatedFile(
  files: PlannedFile[],
  createdPaths: Set<string>,
  updatedPaths: ReadonlySet<string>,
  file: PlannedFile,
): void {
  if (createdPaths.has(file.path) || updatedPaths.has(file.path)) {
    throw new WeaveInputError(
      `Multi-target payload weave produced a conflicting created file: ${file.path}`,
    );
  }
  files.push(file);
  createdPaths.add(file.path);
}

function addCreatedBinaryFile(
  files: PlannedBinaryFile[],
  createdPaths: Set<string>,
  updatedPaths: ReadonlySet<string>,
  file: PlannedBinaryFile,
): void {
  if (createdPaths.has(file.path) || updatedPaths.has(file.path)) {
    throw new WeaveInputError(
      `Multi-target payload weave produced a conflicting created file: ${file.path}`,
    );
  }
  files.push(file);
  createdPaths.add(file.path);
}

function addUpdatedFile(
  files: PlannedFile[],
  updatedPaths: Set<string>,
  createdPaths: ReadonlySet<string>,
  file: PlannedFile,
): void {
  if (createdPaths.has(file.path)) {
    throw new WeaveInputError(
      `Multi-target payload weave attempted to update a newly created file: ${file.path}`,
    );
  }
  if (updatedPaths.has(file.path)) {
    throw new WeaveInputError(
      `Multi-target payload weave produced a conflicting updated file: ${file.path}`,
    );
  }
  files.push(file);
  updatedPaths.add(file.path);
}

function withBatchTargetDiagnostic<T>(
  designatorPath: string,
  operation: () => T,
): T {
  try {
    return operation();
  } catch (error) {
    if (error instanceof WeaveInputError) {
      throw new WeaveInputError(
        `Target ${
          formatDesignatorPathForDisplay(designatorPath)
        }: ${error.message}`,
      );
    }
    throw error;
  }
}

function payloadTargetIsAlreadyCurrent(
  candidate: WeaveableKnopCandidate,
  target?: NormalizedVersionTargetSpec,
): boolean {
  const payloadArtifact = candidate.payloadArtifact;
  if (!payloadArtifact || !payloadContentsMatchLatest(payloadArtifact)) {
    return false;
  }
  if (
    target?.historySegment !== undefined &&
    payloadArtifact.currentArtifactHistoryPath?.endsWith(
        `/${target.historySegment}`,
      ) !== true
  ) {
    return false;
  }
  if (
    target?.stateSegment !== undefined &&
    payloadArtifact.latestHistoricalStatePath?.endsWith(
        `/${target.stateSegment}`,
      ) !== true
  ) {
    return false;
  }
  if (
    target?.manifestationSegment !== undefined &&
    payloadArtifact.latestHistoricalSnapshotPath?.includes(
        `/${target.manifestationSegment}/`,
      ) !== true
  ) {
    return false;
  }

  return true;
}

function payloadContentsMatchLatest(
  payloadArtifact: WeaveableKnopCandidate["payloadArtifact"],
): boolean {
  if (!payloadArtifact) {
    return false;
  }
  if (payloadArtifact.currentPayloadBytes !== undefined) {
    return payloadArtifact.latestHistoricalSnapshotBytes !== undefined &&
      bytesEqual(
        payloadArtifact.currentPayloadBytes,
        payloadArtifact.latestHistoricalSnapshotBytes,
      );
  }

  return payloadArtifact.latestHistoricalSnapshotTurtle !== undefined &&
    payloadArtifact.currentPayloadTurtle ===
      payloadArtifact.latestHistoricalSnapshotTurtle;
}

function bytesEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.byteLength !== right.byteLength) {
    return false;
  }
  for (let index = 0; index < left.byteLength; index += 1) {
    if (left[index] !== right[index]) {
      return false;
    }
  }
  return true;
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
  const payloadIsRdfDocument = payloadArtifact.payloadIsRdfDocument ??
    currentPayloadArtifactIsRdfDocument(
      meshBase,
      candidate.currentKnopInventoryTurtle,
      designatorPath,
    );
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
  const payloadSnapshotBytes = payloadArtifact.currentPayloadBytes;
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
        {
          payloadIsRdfDocument,
          knopMetadataHistoryPolicy,
          knopInventoryHistoryPolicy,
        },
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
      payloadIsRdfDocument,
    );

  return {
    meshBase,
    wovenDesignatorPaths: [designatorPath],
    createdFiles: [
      ...(meshInventoryProgression === undefined ? [] : [{
        path: `${meshInventoryProgression.nextStatePath}/ttl/inventory.ttl`,
        contents: wovenMeshInventoryTurtle,
      }]),
      ...(payloadSnapshotBytes === undefined
        ? [{
          path: payloadSnapshotPath,
          contents: payloadArtifact.currentPayloadTurtle,
        }]
        : []),
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
    ...(payloadSnapshotBytes === undefined ? {} : {
      createdBinaryFiles: [{
        path: payloadSnapshotPath,
        contents: payloadSnapshotBytes,
      }],
    }),
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

  const wovenMeshInventoryTurtle = meshInventoryProgression === undefined
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
        contents: renderGenericExtractedIdentifierPage(
          meshBase,
          designatorPath,
        ),
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
  supportHistoryPolicies?: WeaveSupportHistoryPolicies,
): WeavePlan {
  const pageDefinitionArtifact = candidate.resourcePageDefinitionArtifact!;
  const designatorPath = candidate.designatorPath;
  const versionPageDefinition = pageDefinitionArtifact
    .currentArtifactHistoryExists ||
    shouldMaterializeSupportHistory(
      supportHistoryPolicies?.resourcePageDefinition ?? "versioned",
    );
  if (!versionPageDefinition) {
    if (
      pageDefinitionArtifact.currentArtifactHistoryPath !== undefined ||
      pageDefinitionArtifact.latestHistoricalStatePath !== undefined
    ) {
      throw new WeaveInputError(
        `ResourcePageDefinition current-only weave cannot use a partial explicit history for ${designatorPath}.`,
      );
    }
    const renderedKnopInventory =
      renderCurrentOnlyPageDefinitionWovenKnopInventoryTurtle(
        meshBase,
        candidate.currentKnopInventoryTurtle,
        designatorPath,
        pageDefinitionArtifact.workingLocalRelativePath,
      );

    return {
      meshBase,
      wovenDesignatorPaths: [designatorPath],
      createdFiles: [],
      updatedFiles: [
        {
          path: `${toKnopPath(designatorPath)}/_inventory/inventory.ttl`,
          contents: renderedKnopInventory,
        },
      ],
      createdPages: buildCurrentOnlyPageDefinitionWeavePages(designatorPath),
    };
  }

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

function planLaterPayloadWeave(
  meshBase: string,
  candidate: WeaveableKnopCandidate,
  target?: NormalizedVersionTargetSpec,
  supportHistoryPolicies?: WeaveSupportHistoryPolicies,
  namingPolicies?: WeaveNamingPolicies,
): WeavePlan {
  const payloadArtifact = candidate.payloadArtifact!;
  const designatorPath = candidate.designatorPath;
  const knopPath = toKnopPath(designatorPath);
  const payloadLayout = resolveLaterPayloadVersionLayout(
    meshBase,
    designatorPath,
    payloadArtifact,
    candidate.currentKnopInventoryTurtle,
    target,
    namingPolicies,
  );
  const readModel = resolveLaterPayloadWeaveReadModel(
    meshBase,
    candidate.currentKnopInventoryTurtle,
    designatorPath,
    payloadArtifact,
    payloadLayout,
    {
      knopMetadataHistoryPolicy: supportHistoryPolicies?.knopMetadata,
      knopInventoryHistoryPolicy: supportHistoryPolicies?.knopInventory,
    },
  );

  const payloadSnapshotPath = `${payloadLayout.nextManifestationPath}/${
    toFileName(payloadArtifact.workingLocalRelativePath)
  }`;
  const knopMetadataHistoryPolicy = readModel.knopMetadataHistoryPolicy;
  const knopInventoryHistoryPolicy = readModel.knopInventoryHistoryPolicy;
  const knopInventoryProgression = readModel.knopInventoryProgression;
  const wovenKnopInventoryTurtle =
    renderKnopInventoryWithPreservedSupportArtifacts({
      meshBase,
      currentKnopInventoryTurtle: candidate.currentKnopInventoryTurtle,
      renderedKnopInventoryTurtle: renderLaterPayloadWovenKnopInventoryTurtle(
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
      ...(knopInventoryProgression
        ? [{
          path: `${knopInventoryProgression.nextStatePath}/ttl/inventory.ttl`,
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
    createdPages: buildLaterPayloadWeavePages(
      designatorPath,
      payloadLayout,
      { knopInventoryProgression },
    ),
  };
}

function toFileName(path: string): string {
  const segments = path.split("/");
  return segments[segments.length - 1]!;
}
