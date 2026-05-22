import { dirname, join } from "@std/path";
import { Parser, type Quad } from "n3";
import {
  toDesignatorResourcePagePath,
  toKnopPath,
} from "../../core/designator_segments.ts";
import type { PlannedFile } from "../../core/planned_file.ts";
import type {
  KnopArtifactLinkModel,
  RepositorySourceFloatingLocator,
  ResourcePageChildIdentifierModel,
  ResourcePageExtractionSourceModel,
  ResourcePageHistoryGroupModel,
  ResourcePageModel,
  ResourcePageRawSourcePanelModel,
  ResourcePageReferenceLinkModel,
} from "../../core/weave/resource_page_models.ts";
import {
  collectHistoryGroupsByResourcePath
    as collectResourcePageHistoryGroupsByResourcePath,
  findHistoryForState,
  findHistoryStateForManifestation,
  isHistoryComponentResource,
  mergeHistoryGroupsByResourcePath,
} from "../../core/weave/resource_page_history_groups.ts";
import { extractResourceReferenceLinks } from "../../core/weave/resource_page_reference_links.ts";
import {
  type NormalizedTargetSpec,
  type NormalizedVersionTargetSpec,
  resolveTargetSelections,
} from "../../core/targeting.ts";
import {
  type GenerateRequest,
  type ValidateRequest,
  type VersionRequest,
  WeaveInputError,
  type WeaveRequest,
} from "../../core/weave/weave.ts";
import {
  listKnopDesignatorPaths,
  resolveExtractionSourceInventoryState,
  resolvePayloadArtifactInventoryState,
  resolveResourcePageDefinitionInventoryState,
} from "../mesh/inventory.ts";
import {
  loadOperationalLocalPathPolicy,
  LocalPathAccessError,
  type OperationalLocalPathPolicy,
} from "../operational/local_path_policy.ts";
import { createRuntimeTiming, type RuntimeTiming } from "../timing.ts";
import { resolveRuntimeLoggers } from "../logging/factory.ts";
import type { AuditLogger } from "../logging/audit_logger.ts";
import type { StructuredLogger } from "../logging/logger.ts";
import {
  loadKnopSourceRegistryArtifact,
  loadReferenceCatalogWorkingArtifact,
} from "./artifact_loaders.ts";
import { loadEffectiveConfigForExecution } from "./execution_config.ts";
import { WeaveRuntimeError } from "./errors.ts";
export { WeaveRuntimeError } from "./errors.ts";
import {
  ensureWorkspaceRootExists,
  loadMeshState,
  type MeshState,
} from "./mesh_state.ts";
import {
  type PreparedWeaveExecution,
  prepareWeaveExecution,
} from "./prepared_execution.ts";
import type { WeaveProgressHandler } from "./progress.ts";
export type { WeaveProgressEvent, WeaveProgressHandler } from "./progress.ts";
import {
  normalizeGenerateRequest,
  normalizeValidateRequest,
  normalizeVersionRequest,
  normalizeWeaveRequest,
} from "./request_normalization.ts";
import {
  addCurrentKnopInventoryRawSourcePanel,
  addExtractionSourceRawSourcePanels,
  addPayloadRawSourcePanels,
  addReferenceTargetSourceRawSourcePanels,
  addSupportArtifactRawSourcePanels,
  collectMeshSupportRawSourcePanels,
  findRawSourcePanelsForPage,
} from "./raw_source_panels.ts";
import { timeOptional, timeOptionalSync } from "./timing_helpers.ts";
import {
  prepareVersionExecution,
  validateVersionPlanRdf,
  writePreparedVersion,
} from "./version_execution.ts";
import { toWorkspaceRelativePath } from "./workspace_paths.ts";
import {
  type CustomIdentifierPageModelInput,
  describeResourcePageDefinitionArtifact,
  loadActiveCustomIdentifierPage,
  loadResourcePageDefinitionWorkingArtifact,
  ResourcePageDefinitionResolutionError,
} from "./page_definition.ts";
import { renderResourcePages } from "./pages.ts";
import { SFLO_NAMESPACE } from "../../core/rdf/namespaces.ts";
import {
  type EffectiveConfig,
  type HistoryTrackingPolicy,
} from "../config/effective_config.ts";
import {
  listGeneratedResourcePagePaths,
  type ListGeneratedResourcePagePathsInput,
  ResourcePagePolicyError,
} from "./resource_page_policy.ts";
import { validatePublicationPreset } from "../publication/presets.ts";

const SFLO_HAS_KNOP_METADATA_IRI = `${SFLO_NAMESPACE}hasKnopMetadata`;
const SFLO_HAS_KNOP_INVENTORY_IRI = `${SFLO_NAMESPACE}hasKnopInventory`;
const SFLO_HAS_PAYLOAD_ARTIFACT_IRI = `${SFLO_NAMESPACE}hasPayloadArtifact`;
const SFLO_HAS_REFERENCE_CATALOG_IRI = `${SFLO_NAMESPACE}hasReferenceCatalog`;
const SFLO_HAS_RESOURCE_PAGE_DEFINITION_IRI =
  `${SFLO_NAMESPACE}hasResourcePageDefinition`;
const SFLO_HAS_KNOP_ASSET_BUNDLE_IRI = `${SFLO_NAMESPACE}hasKnopAssetBundle`;
const RDF_TYPE_IRI = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type";
const DCTERMS_TITLE_IRI = "http://purl.org/dc/terms/title";

export interface ExecuteValidateOptions {
  meshRoot: string;
  request?: ValidateRequest;
  scope?: ValidateScope;
}

export interface ExecuteVersionOptions {
  meshRoot: string;
  request?: VersionRequest;
  historyTrackingPolicyOverride?: HistoryTrackingPolicy;
  onProgress?: WeaveProgressHandler;
}

export interface ExecuteGenerateOptions {
  meshRoot: string;
  request?: GenerateRequest;
  operationalLogger?: StructuredLogger;
  now?: () => Date;
  includeSemanticFlowMetadata?: boolean;
  historyTrackingPolicyOverride?: HistoryTrackingPolicy;
}

export interface ExecuteWeaveOptions {
  meshRoot: string;
  request?: WeaveRequest;
  operationalLogger?: StructuredLogger;
  auditLogger?: AuditLogger;
  now?: () => Date;
  historyTrackingPolicyOverride?: HistoryTrackingPolicy;
  onProgress?: WeaveProgressHandler;
  validateBefore?: boolean;
  validateAfter?: boolean;
}

export type ValidateScope = "mesh" | "publication";

export interface ValidateFinding {
  severity: "error";
  message: string;
}

export interface ValidateResult {
  scope: ValidateScope;
  meshBase?: string;
  validatedDesignatorPaths: readonly string[];
  findings: readonly ValidateFinding[];
}

export interface VersionResult {
  meshBase: string;
  versionedDesignatorPaths: readonly string[];
  createdPaths: readonly string[];
  updatedPaths: readonly string[];
}

export interface GenerateResult {
  meshBase: string;
  generatedDesignatorPaths: readonly string[];
  createdPaths: readonly string[];
  updatedPaths: readonly string[];
  skippedTimestampOnlyPaths: readonly string[];
}

export interface WeaveResult {
  meshBase: string;
  wovenDesignatorPaths: readonly string[];
  createdPaths: readonly string[];
  updatedPaths: readonly string[];
  skippedTimestampOnlyPaths: readonly string[];
}

interface GenerateDesignatorContext {
  designatorPath: string;
  payloadWorkingLocalRelativePath?: string;
  payloadWorkingAccessUrl?: string;
  payloadRepositorySourceFloatingLocator?: RepositorySourceFloatingLocator;
  extractionSource?: ResourcePageExtractionSourceModel;
  references: readonly ResourcePageReferenceLinkModel[];
  governedArtifacts: readonly KnopArtifactLinkModel[];
  supportingArtifacts: readonly KnopArtifactLinkModel[];
  pagePaths: readonly string[];
  customIdentifierPage?: CustomIdentifierPageModelInput;
  historyGroupsByResourcePath: ReadonlyMap<
    string,
    readonly ResourcePageHistoryGroupModel[]
  >;
  pageDescriptions: ReadonlyMap<string, string>;
  rawSourcePanels: ReadonlyMap<
    string,
    readonly ResourcePageRawSourcePanelModel[]
  >;
}

export async function executeValidate(
  options: ExecuteValidateOptions,
): Promise<ValidateResult> {
  const scope = options.scope ?? "mesh";
  const timing = createRuntimeTiming(`validate.${scope}`);
  let status = "succeeded";
  try {
    if (scope === "publication") {
      const meshRoot = resolveExecutionMeshRoot(options);
      await timing.time(
        "ensureWorkspaceRoot",
        () => ensureWorkspaceRootExists(meshRoot),
      );
      const meshState = await timing.time(
        "loadMeshState",
        () => loadMeshState(meshRoot),
      );
      const publicationValidation = await timing.time(
        "validatePublicationPreset",
        () =>
          validatePublicationPreset({
            meshRoot,
            currentMeshConfigTurtle: meshState.currentMeshConfigTurtle,
          }),
      );
      status = publicationValidation.findings.length > 0
        ? "findings"
        : "succeeded";
      timing.setField("findings", publicationValidation.findings.length);

      return {
        scope,
        meshBase: meshState.meshBase,
        validatedDesignatorPaths: [],
        findings: publicationValidation.findings,
      };
    }

    const targets = normalizeValidateRequest(options.request);
    const meshRoot = resolveExecutionMeshRoot(options);
    const localPathPolicy = await timing.time(
      "loadOperationalLocalPathPolicy",
      () => loadOperationalLocalPathPolicy(meshRoot),
    );
    const prepared = await prepareVersionExecution(
      meshRoot,
      toNormalizedVersionTargets(targets),
      localPathPolicy,
      false,
      undefined,
      undefined,
      timing,
    );
    timing.timeSync("validateRdf", () => validateVersionPlanRdf(prepared.plan));
    const publicationValidation = await timing.time(
      "validatePublicationPreset",
      () =>
        validatePublicationPreset({
          meshRoot,
          currentMeshConfigTurtle: prepared.meshState.currentMeshConfigTurtle,
        }),
    );
    status = publicationValidation.findings.length > 0
      ? "findings"
      : "succeeded";
    timing.setField(
      "validatedDesignatorPaths",
      prepared.plan.versionedDesignatorPaths.length,
    );
    timing.setField("createdFiles", prepared.plan.createdFiles.length);
    timing.setField("updatedFiles", prepared.plan.updatedFiles.length);
    timing.setField("findings", publicationValidation.findings.length);

    return {
      scope,
      meshBase: prepared.meshState.meshBase,
      validatedDesignatorPaths: prepared.plan.versionedDesignatorPaths,
      findings: publicationValidation.findings,
    };
  } catch (error) {
    if (
      error instanceof WeaveInputError || error instanceof WeaveRuntimeError
    ) {
      status = "failed";
      timing.setField("findings", 1);
      return {
        scope,
        validatedDesignatorPaths: [],
        findings: [{
          severity: "error",
          message: error.message,
        }],
      };
    }
    throw error;
  } finally {
    timing.finish({ status });
  }
}

export async function executeVersion(
  options: ExecuteVersionOptions,
): Promise<VersionResult> {
  const timing = createRuntimeTiming("version");
  let status = "succeeded";
  try {
    const normalizedRequest = timing.timeSync(
      "normalizeRequest",
      () => normalizeVersionRequest(options.request),
    );
    const meshRoot = resolveExecutionMeshRoot(options);
    const localPathPolicy = await timing.time(
      "loadOperationalLocalPathPolicy",
      () => loadOperationalLocalPathPolicy(meshRoot),
    );
    const prepared = await prepareVersionExecution(
      meshRoot,
      normalizedRequest.targets,
      localPathPolicy,
      normalizedRequest.overwriteExistingState,
      options.historyTrackingPolicyOverride,
      options.onProgress,
      timing,
    );
    const result = await writePreparedVersion(
      meshRoot,
      localPathPolicy,
      prepared,
      {
        validateRdf: true,
        timing,
        phasePrefix: "write",
      },
    );
    timing.setField(
      "versionedDesignatorPaths",
      result.versionedDesignatorPaths.length,
    );
    timing.setField("createdFiles", result.createdPaths.length);
    timing.setField("updatedFiles", result.updatedPaths.length);
    return result;
  } catch (error) {
    status = "failed";
    throw error;
  } finally {
    timing.finish({ status });
  }
}

export async function executeGenerate(
  options: ExecuteGenerateOptions,
): Promise<GenerateResult> {
  const timing = createRuntimeTiming("generate");
  let status = "succeeded";
  const { operationalLogger } = resolveRuntimeLoggers(options);
  try {
    const targets = timing.timeSync(
      "normalizeRequest",
      () => normalizeGenerateRequest(options.request),
    );
    const meshRoot = resolveExecutionMeshRoot(options);
    await timing.time(
      "ensureWorkspaceRoot",
      () => ensureWorkspaceRootExists(meshRoot),
    );
    const localPathPolicy = await timing.time(
      "loadOperationalLocalPathPolicy",
      () => loadOperationalLocalPathPolicy(meshRoot),
    );
    const result = await generatePreparedPages({
      meshRoot,
      localPathPolicy,
      targets,
      operationalLogger,
      now: options.now,
      includeSemanticFlowMetadata: options.includeSemanticFlowMetadata ?? false,
      historyTrackingPolicyOverride: options.historyTrackingPolicyOverride,
      timing,
    });
    timing.setField(
      "generatedDesignatorPaths",
      result.generatedDesignatorPaths.length,
    );
    timing.setField("createdFiles", result.createdPaths.length);
    timing.setField("updatedFiles", result.updatedPaths.length);
    timing.setField(
      "timestampOnlySkippedFiles",
      result.skippedTimestampOnlyPaths.length,
    );
    return result;
  } catch (error) {
    status = "failed";
    throw error;
  } finally {
    timing.finish({ status });
  }
}

async function generatePreparedPages(options: {
  meshRoot: string;
  localPathPolicy: OperationalLocalPathPolicy;
  targets: readonly NormalizedTargetSpec[];
  operationalLogger: StructuredLogger;
  now?: () => Date;
  includeSemanticFlowMetadata: boolean;
  historyTrackingPolicyOverride?: HistoryTrackingPolicy;
  timing?: RuntimeTiming;
  phasePrefix?: string;
}): Promise<GenerateResult> {
  const phase = (name: string) =>
    options.phasePrefix ? `${options.phasePrefix}.${name}` : name;
  const meshState = await timeOptional(
    options.timing,
    phase("loadMeshState"),
    () => loadMeshState(options.meshRoot),
  );
  const effectiveConfig = await timeOptional(
    options.timing,
    phase("loadEffectiveConfig"),
    () =>
      loadEffectiveConfigForExecution(
        options.historyTrackingPolicyOverride,
      ),
  );
  const allDesignatorPaths = timeOptionalSync(
    options.timing,
    phase("listDesignatorPaths"),
    () =>
      listKnopDesignatorPaths(
        meshState.meshBase,
        meshState.currentMeshInventoryTurtle,
        "Could not parse the current MeshInventory while resolving generate targets.",
      ),
  );
  const selectedDesignatorPaths = timeOptionalSync(
    options.timing,
    phase("resolveTargets"),
    () =>
      resolveSelectedDesignatorPaths(
        allDesignatorPaths,
        options.targets,
      ),
  );
  const pageFiles = await timeOptional(
    options.timing,
    phase("collectGeneratedPageFiles"),
    () =>
      collectGeneratedPageFiles(
        options.meshRoot,
        options.localPathPolicy,
        meshState,
        selectedDesignatorPaths,
        options.targets.length === 0,
        options.targets.length > 0,
        effectiveConfig,
        resolveGeneratedAt(options.now),
        options.includeSemanticFlowMetadata,
        options.timing,
        phase("collectGeneratedPageFiles"),
      ),
  );
  const writeResult = await timeOptional(
    options.timing,
    phase("writePages"),
    () => writeGeneratedPagesUpsert(options.meshRoot, pageFiles),
  );

  const result = {
    meshBase: meshState.meshBase,
    generatedDesignatorPaths: selectedDesignatorPaths,
    createdPaths: writeResult.createdPaths.map((path) =>
      toWorkspaceRelativePath(options.localPathPolicy, path)
    ),
    updatedPaths: writeResult.updatedPaths.map((path) =>
      toWorkspaceRelativePath(options.localPathPolicy, path)
    ),
    skippedTimestampOnlyPaths: writeResult.skippedTimestampOnlyPaths.map((
      path,
    ) => toWorkspaceRelativePath(options.localPathPolicy, path)),
  };
  if (result.skippedTimestampOnlyPaths.length > 0) {
    await options.operationalLogger.info(
      "generate.timestampOnlySkipped",
      "Skipped generated pages with timestamp-only differences",
      {
        skippedTimestampOnlyPaths: result.skippedTimestampOnlyPaths,
      },
    );
  }
  return result;
}

export async function executeWeave(
  options: ExecuteWeaveOptions,
): Promise<WeaveResult> {
  const timing = createRuntimeTiming("weave");
  let status = "succeeded";
  const { operationalLogger, auditLogger } = resolveLoggers(options);
  const meshRoot = resolveExecutionMeshRoot(options);
  const initialPolicy = await timing.time(
    "loadOperationalLocalPathPolicy",
    () => loadOperationalLocalPathPolicy(meshRoot),
  );
  const workspaceRoot = initialPolicy.workspaceRoot;
  let wovenDesignatorPaths: readonly string[] = [];

  await operationalLogger.info("weave.started", "Starting local weave", {
    workspaceRoot,
    targets: options.request?.targets ?? [],
  });
  await auditLogger.record("weave.started", "Local weave started", {
    workspaceRoot,
    targets: options.request?.targets ?? [],
  });

  try {
    if (options.validateBefore) {
      const validation = await timing.time(
        "validateBefore",
        () =>
          executeValidate({
            meshRoot,
            scope: "mesh",
          }),
      );
      assertValidationPassed(validation, "before weaving");
    }

    const normalizedRequest = normalizeWeaveRequest(options.request);
    let preparedExecution: PreparedWeaveExecution;
    try {
      preparedExecution = await prepareWeaveExecution(
        meshRoot,
        normalizedRequest,
        initialPolicy,
        options.historyTrackingPolicyOverride,
        options.onProgress,
        timing,
      );
      timing.timeSync(
        "version.validateRdf",
        () => validateVersionPlanRdf(preparedExecution.version.plan),
      );
    } catch (error) {
      if (error instanceof WeaveRuntimeError) {
        throw new WeaveInputError(error.message);
      }
      throw error;
    }

    const versionResult = await writePreparedVersion(
      meshRoot,
      initialPolicy,
      preparedExecution.version,
      { validateRdf: false, timing, phasePrefix: "version.write" },
    );
    wovenDesignatorPaths = versionResult.versionedDesignatorPaths;

    const generateResult = await timing.time(
      "generate",
      () =>
        generatePreparedPages({
          meshRoot,
          localPathPolicy: initialPolicy,
          targets: preparedExecution.request.targetPreparation.sharedTargets,
          operationalLogger,
          now: options.now,
          includeSemanticFlowMetadata: false,
          historyTrackingPolicyOverride: options.historyTrackingPolicyOverride,
          timing,
          phasePrefix: "generate",
        }),
    );

    const result: WeaveResult = {
      meshBase: versionResult.meshBase,
      wovenDesignatorPaths,
      createdPaths: [
        ...versionResult.createdPaths,
        ...generateResult.createdPaths,
      ],
      updatedPaths: [
        ...versionResult.updatedPaths,
        ...generateResult.updatedPaths,
      ],
      skippedTimestampOnlyPaths: generateResult.skippedTimestampOnlyPaths,
    };

    if (options.validateAfter) {
      const validation = await timing.time(
        "validateAfter",
        () =>
          executeValidate({
            meshRoot,
            scope: "mesh",
          }),
      );
      assertValidationPassed(validation, "after weaving");
    }

    await operationalLogger.info("weave.succeeded", "Local weave succeeded", {
      workspaceRoot,
      wovenDesignatorPaths: result.wovenDesignatorPaths,
      createdPaths: result.createdPaths,
      updatedPaths: result.updatedPaths,
      skippedTimestampOnlyPaths: result.skippedTimestampOnlyPaths,
    });
    await auditLogger.record("weave.succeeded", "Local weave succeeded", {
      workspaceRoot,
      wovenDesignatorPaths: result.wovenDesignatorPaths,
      createdPaths: result.createdPaths,
      updatedPaths: result.updatedPaths,
      skippedTimestampOnlyPaths: result.skippedTimestampOnlyPaths,
    });

    timing.setField(
      "wovenDesignatorPaths",
      result.wovenDesignatorPaths.length,
    );
    timing.setField("createdFiles", result.createdPaths.length);
    timing.setField("updatedFiles", result.updatedPaths.length);
    timing.setField(
      "timestampOnlySkippedFiles",
      result.skippedTimestampOnlyPaths.length,
    );
    return result;
  } catch (error) {
    status = "failed";
    const message = error instanceof Error ? error.message : String(error);
    await operationalLogger.error("weave.failed", "Local weave failed", {
      workspaceRoot,
      wovenDesignatorPaths,
      error: message,
    });
    await auditLogger.record("weave.failed", "Local weave failed", {
      workspaceRoot,
      wovenDesignatorPaths,
      error: message,
    });

    if (
      error instanceof WeaveInputError || error instanceof WeaveRuntimeError
    ) {
      throw error;
    }
    throw new WeaveRuntimeError(message);
  } finally {
    timing.finish({ status });
  }
}

export function describeWeaveResult(result: WeaveResult): string {
  return `Wove ${result.wovenDesignatorPaths.length} designator path and created ${result.createdPaths.length} files while updating ${result.updatedPaths.length} working artifacts.`;
}

export function describeValidateResult(result: ValidateResult): string {
  if (result.scope === "publication") {
    const findingLabel = result.findings.length === 1 ? "issue" : "issues";
    return `Validated publication surface and found ${result.findings.length} ${findingLabel}.`;
  }

  const validatedLabel = result.validatedDesignatorPaths.length === 1
    ? "designator path"
    : "designator paths";
  const findingLabel = result.findings.length === 1 ? "issue" : "issues";
  return `Validated ${result.validatedDesignatorPaths.length} ${validatedLabel} and found ${result.findings.length} ${findingLabel}.`;
}

export function describeVersionResult(result: VersionResult): string {
  const designatorLabel = result.versionedDesignatorPaths.length === 1
    ? "designator path"
    : "designator paths";
  return `Versioned ${result.versionedDesignatorPaths.length} ${designatorLabel} and created ${result.createdPaths.length} files while updating ${result.updatedPaths.length} working artifacts.`;
}

export function describeGenerateResult(result: GenerateResult): string {
  const designatorLabel = result.generatedDesignatorPaths.length === 1
    ? "designator path"
    : "designator paths";
  return `Generated ${result.generatedDesignatorPaths.length} ${designatorLabel} and created ${result.createdPaths.length} files while updating ${result.updatedPaths.length} existing pages.`;
}

function resolveLoggers(
  options: ExecuteWeaveOptions,
): {
  operationalLogger: StructuredLogger;
  auditLogger: AuditLogger;
} {
  return resolveRuntimeLoggers(options);
}

function assertValidationPassed(
  result: ValidateResult,
  phaseLabel: string,
): void {
  if (result.findings.length === 0) {
    return;
  }

  throw new WeaveInputError(
    `Whole-mesh validation ${phaseLabel} failed:\n${
      result.findings.map((finding) =>
        `${finding.severity}: ${finding.message}`
      ).join("\n")
    }`,
  );
}

function toNormalizedVersionTargets(
  targets: readonly NormalizedTargetSpec[],
): readonly NormalizedVersionTargetSpec[] {
  return targets.map((target) => ({
    source: { ...target.source },
    designatorPath: target.designatorPath,
    recursive: target.recursive,
  }));
}

function resolveExecutionMeshRoot(
  options:
    | ExecuteValidateOptions
    | ExecuteVersionOptions
    | ExecuteGenerateOptions
    | ExecuteWeaveOptions,
): string {
  if (options.meshRoot.trim().length === 0) {
    throw new WeaveRuntimeError("mesh root is required");
  }
  return options.meshRoot;
}

function resolveSelectedDesignatorPaths(
  allDesignatorPaths: readonly string[],
  targets:
    | readonly NormalizedTargetSpec[]
    | readonly NormalizedVersionTargetSpec[],
): readonly string[] {
  return resolveTargetSelections(
    allDesignatorPaths,
    targets,
    (message) => new WeaveInputError(message),
  ).map((selection) => selection.designatorPath);
}

async function collectGeneratedPageFiles(
  workspaceRoot: string,
  localPathPolicy: OperationalLocalPathPolicy,
  meshState: MeshState,
  selectedDesignatorPaths: readonly string[],
  includeAllMeshPages: boolean,
  hasExplicitGenerateTargets: boolean,
  effectiveConfig: EffectiveConfig,
  generatedAt: Date,
  includeSemanticFlowMetadata: boolean,
  timing?: RuntimeTiming,
  phasePrefix = "collectGeneratedPageFiles",
): Promise<readonly PlannedFile[]> {
  const phase = (name: string) => `${phasePrefix}.${name}`;
  const pageModels: ResourcePageModel[] = [];
  const pagePaths = new Set<string>();
  const selectedSet = new Set(selectedDesignatorPaths);
  const designatorContexts = await timeOptional(
    timing,
    phase("loadDesignatorContexts"),
    () =>
      loadGenerateDesignatorContexts(
        workspaceRoot,
        localPathPolicy,
        meshState,
        selectedDesignatorPaths,
        effectiveConfig,
        hasExplicitGenerateTargets,
        timing,
        phase("loadDesignatorContexts"),
      ),
  );
  const publicIdentifierPaths = new Map(
    designatorContexts.map((context) => [
      toDesignatorResourcePagePath(context.designatorPath),
      context,
    ]),
  );
  const knopResourcePaths = new Map(
    designatorContexts.map((context) => [
      toKnopPath(context.designatorPath),
      context,
    ]),
  );
  const meshRawSourcePanels = await timeOptional(
    timing,
    phase("collectMeshSupportRawSourcePanels"),
    () => collectMeshSupportRawSourcePanels(workspaceRoot, meshState),
  );
  const meshHistoryGroups = timeOptionalSync(
    timing,
    phase("collectMeshHistoryGroups"),
    () =>
      collectHistoryGroupsByResourcePath(
        meshState.meshBase,
        meshState.currentMeshInventoryTurtle,
        "Could not parse the current MeshInventory while collecting ResourcePage histories.",
      ),
  );
  const allPagePaths = timeOptionalSync(
    timing,
    phase("listRuntimeGeneratedResourcePagePaths"),
    () =>
      listRuntimeGeneratedResourcePagePaths(
        {
          meshBase: meshState.meshBase,
          inventoryTurtle: meshState.currentMeshInventoryTurtle,
          parseErrorMessage:
            "Could not parse the current MeshInventory while collecting ResourcePages.",
          config: effectiveConfig,
          explicitRequest: hasExplicitGenerateTargets,
        },
      ),
  );
  const generatedResourcePaths = collectGeneratedResourcePaths(
    allPagePaths,
    includeAllMeshPages,
    selectedSet,
  );
  const displayedChildResourcePaths = collectDisplayedChildResourcePaths(
    allPagePaths,
    generatedResourcePaths,
  );
  const childTypeHintContexts = await timeOptional(
    timing,
    phase("loadChildTypeHintContexts"),
    () =>
      loadBestEffortGenerateDesignatorContexts(
        workspaceRoot,
        localPathPolicy,
        meshState,
        displayedChildResourcePaths.filter((resourcePath) =>
          !selectedSet.has(resourcePath)
        ),
        effectiveConfig,
        hasExplicitGenerateTargets,
        timing,
        phase("loadChildTypeHintContexts"),
      ),
  );
  const childRdfTypesByResourcePath = collectDesignatorRdfTypesByResourcePath(
    meshState.meshBase,
    [...designatorContexts, ...childTypeHintContexts],
  );
  const childIdentifiersByResourcePath = collectChildIdentifiersByResourcePath(
    allPagePaths,
    childRdfTypesByResourcePath,
  );

  for (const pagePath of allPagePaths) {
    if (
      !shouldGenerateRuntimePagePath(
        pagePath,
        includeAllMeshPages,
        selectedSet,
      )
    ) {
      continue;
    }
    if (pagePaths.has(pagePath)) {
      continue;
    }

    const publicContext = publicIdentifierPaths.get(pagePath);
    const resourcePath = toResourcePath(pagePath);
    if (publicContext) {
      const historyGroups = publicContext.historyGroupsByResourcePath.get(
        resourcePath,
      ) ?? findHistoryGroupsForResource(resourcePath, designatorContexts);
      if (isHistoryComponentResource(resourcePath, historyGroups ?? [])) {
        pageModels.push({
          kind: "simple",
          path: pagePath,
          description: describeSemanticFlowResource(
            meshState.meshBase,
            resourcePath,
            historyGroups ?? [],
          ),
          childIdentifiers: childIdentifiersByResourcePath.get(
            resourcePath,
          ),
          historyGroups,
        });
      } else if (publicContext.customIdentifierPage) {
        pageModels.push({
          kind: "customIdentifier",
          path: pagePath,
          designatorPath: publicContext.designatorPath,
          definitionPath: publicContext.customIdentifierPage.definitionPath,
          stylesheetPaths: publicContext.customIdentifierPage.stylesheetPaths,
          regions: publicContext.customIdentifierPage.regions,
        });
      } else {
        pageModels.push({
          kind: "identifier",
          path: pagePath,
          designatorPath: publicContext.designatorPath,
          workingLocalRelativePath:
            publicContext.payloadWorkingLocalRelativePath,
          workingAccessUrl: publicContext.payloadWorkingAccessUrl,
          repositorySourceFloatingLocator:
            publicContext.payloadRepositorySourceFloatingLocator,
          extractionSource: publicContext.extractionSource,
          references: publicContext.references,
          childIdentifiers: childIdentifiersByResourcePath.get(
            resourcePath,
          ),
          historyGroups,
          rawSourcePanels: publicContext.rawSourcePanels.get(pagePath),
        });
      }
    } else if (knopResourcePaths.has(resourcePath)) {
      const knopContext = knopResourcePaths.get(resourcePath)!;
      pageModels.push({
        kind: "knop",
        path: pagePath,
        designatorPath: knopContext.designatorPath,
        ownerTitle: resolveKnopOwnerTitle(meshState.meshBase, knopContext),
        governedArtifacts: knopContext.governedArtifacts,
        supportingArtifacts: knopContext.supportingArtifacts,
        childIdentifiers: toKnopChildIdentifiers(
          knopContext.supportingArtifacts,
          childIdentifiersByResourcePath.get(resourcePath),
        ),
      });
    } else {
      const rawSourcePanels = meshRawSourcePanels.get(pagePath) ??
        findRawSourcePanelsForPage(pagePath, designatorContexts);
      const historyGroups = meshHistoryGroups.get(resourcePath) ??
        findHistoryGroupsForResource(resourcePath, designatorContexts);
      pageModels.push({
        kind: "simple",
        path: pagePath,
        description: describeSemanticFlowResource(
          meshState.meshBase,
          resourcePath,
          historyGroups ?? [],
          rawSourcePanels ??
            findOwnerRawSourcePanelsForArtifactHistory(
              resourcePath,
              historyGroups ?? [],
              meshRawSourcePanels,
              designatorContexts,
            ),
        ),
        childIdentifiers: childIdentifiersByResourcePath.get(
          resourcePath,
        ),
        historyGroups,
        rawSourcePanels,
      });
    }
    pagePaths.add(pagePath);
  }

  for (const context of designatorContexts) {
    for (const pagePath of context.pagePaths) {
      if (pagePaths.has(pagePath)) {
        continue;
      }

      const resourcePath = toResourcePath(pagePath);
      const rawSourcePanels = context.rawSourcePanels.get(pagePath);
      const historyGroups = context.historyGroupsByResourcePath.get(
        resourcePath,
      );
      pageModels.push({
        ...(resourcePath === toKnopPath(context.designatorPath)
          ? {
            kind: "knop" as const,
            path: pagePath,
            designatorPath: context.designatorPath,
            ownerTitle: resolveKnopOwnerTitle(meshState.meshBase, context),
            governedArtifacts: context.governedArtifacts,
            supportingArtifacts: context.supportingArtifacts,
            childIdentifiers: toKnopChildIdentifiers(
              context.supportingArtifacts,
              childIdentifiersByResourcePath.get(resourcePath),
            ),
          }
          : {
            kind: "simple" as const,
            path: pagePath,
            description: context.pageDescriptions.get(pagePath) ??
              describeSemanticFlowResource(
                meshState.meshBase,
                resourcePath,
                historyGroups ?? [],
                rawSourcePanels ??
                  findOwnerRawSourcePanelsForArtifactHistoryInContext(
                    resourcePath,
                    historyGroups ?? [],
                    context,
                  ),
              ),
            childIdentifiers: childIdentifiersByResourcePath.get(
              resourcePath,
            ),
            historyGroups,
            rawSourcePanels,
          }),
      });
      pagePaths.add(pagePath);
    }
  }

  const meshFaviconPath = await resolveMeshFaviconPath(workspaceRoot);
  return await timeOptional(
    timing,
    phase("renderResourcePages"),
    () =>
      renderResourcePages(meshState.meshBase, pageModels, {
        generatedAt,
        includeSemanticFlowMetadata,
        meshFaviconPath,
      }),
  );
}

function listRuntimeGeneratedResourcePagePaths(
  input: ListGeneratedResourcePagePathsInput,
): readonly string[] {
  try {
    return listGeneratedResourcePagePaths(input);
  } catch (error) {
    if (error instanceof ResourcePagePolicyError) {
      throw new WeaveRuntimeError(error.message);
    }
    throw error;
  }
}

function collectGeneratedResourcePaths(
  pagePaths: readonly string[],
  includeAllMeshPages: boolean,
  selectedSet: ReadonlySet<string>,
): readonly string[] {
  const resourcePaths = new Set<string>();

  for (const pagePath of pagePaths) {
    if (
      shouldGenerateRuntimePagePath(pagePath, includeAllMeshPages, selectedSet)
    ) {
      resourcePaths.add(toResourcePath(pagePath));
    }
  }

  return [...resourcePaths].sort((left, right) => left.localeCompare(right));
}

function shouldGenerateRuntimePagePath(
  pagePath: string,
  includeAllMeshPages: boolean,
  selectedSet: ReadonlySet<string>,
): boolean {
  return includeAllMeshPages ||
    pagePath.startsWith("_mesh/") ||
    selectedSet.has(toResourcePath(pagePath));
}

function collectDisplayedChildResourcePaths(
  pagePaths: readonly string[],
  parentResourcePaths: readonly string[],
): readonly string[] {
  const parentSet = new Set(parentResourcePaths);
  const childPaths = new Set<string>();

  for (const pagePath of pagePaths) {
    const childPath = toResourcePath(pagePath);
    if (
      isChildIdentifierResourcePath(childPath) &&
      parentSet.has(toParentResourcePath(childPath))
    ) {
      childPaths.add(childPath);
    }
  }

  return [...childPaths].sort((left, right) => left.localeCompare(right));
}

async function resolveMeshFaviconPath(
  meshRoot: string,
): Promise<string | undefined> {
  try {
    const stat = await Deno.stat(join(meshRoot, "favicon.ico"));
    return stat.isFile ? "favicon.ico" : undefined;
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      return undefined;
    }
    throw error;
  }
}

function collectChildIdentifiersByResourcePath(
  pagePaths: readonly string[],
  rdfTypesByResourcePath: ReadonlyMap<string, readonly string[]> = new Map(),
): ReadonlyMap<string, readonly ResourcePageChildIdentifierModel[]> {
  const resourcePaths = pagePaths.map((pagePath) => toResourcePath(pagePath));
  const childIdentifiersByResourcePath = new Map<
    string,
    ResourcePageChildIdentifierModel[]
  >();

  for (const childPath of resourcePaths) {
    if (!isChildIdentifierResourcePath(childPath)) {
      continue;
    }
    const parentPath = toParentResourcePath(childPath);
    const childIdentifiers = childIdentifiersByResourcePath.get(parentPath) ??
      [];
    const rdfTypes = rdfTypesByResourcePath.get(childPath);
    childIdentifiers.push({
      label: toLastPathSegment(childPath),
      path: childPath,
      ...(rdfTypes && rdfTypes.length > 0 ? { rdfTypes } : {}),
    });
    childIdentifiersByResourcePath.set(parentPath, childIdentifiers);
  }

  for (const childIdentifiers of childIdentifiersByResourcePath.values()) {
    childIdentifiers.sort((left, right) =>
      left.label.localeCompare(right.label, "en", { sensitivity: "base" })
    );
  }

  return childIdentifiersByResourcePath;
}

function collectDesignatorRdfTypesByResourcePath(
  meshBase: string,
  contexts: readonly GenerateDesignatorContext[],
): ReadonlyMap<string, readonly string[]> {
  const typesByResourcePath = new Map<string, readonly string[]>();

  for (const context of contexts) {
    const pagePath = toDesignatorResourcePagePath(context.designatorPath);
    const panels = context.rawSourcePanels.get(pagePath);
    if (!panels) {
      continue;
    }
    const types = extractResourceRdfTypes(
      meshBase,
      context.designatorPath,
      panels,
    );
    if (types.length > 0) {
      typesByResourcePath.set(context.designatorPath, types);
    }
  }

  return typesByResourcePath;
}

function toKnopChildIdentifiers(
  supportingArtifacts: readonly KnopArtifactLinkModel[],
  discoveredChildren: readonly ResourcePageChildIdentifierModel[] = [],
): readonly ResourcePageChildIdentifierModel[] {
  const childByPath = new Map<string, ResourcePageChildIdentifierModel>();
  for (const child of discoveredChildren) {
    childByPath.set(child.path, child);
  }
  for (const artifact of supportingArtifacts) {
    childByPath.set(artifact.path, {
      label: toLastPathSegment(artifact.path),
      path: artifact.path,
    });
  }

  return Array.from(childByPath.values()).sort((left, right) =>
    left.label.localeCompare(right.label, "en", { sensitivity: "base" })
  );
}

function resolveKnopOwnerTitle(
  meshBase: string,
  context: GenerateDesignatorContext,
): string | undefined {
  const ownerPagePath = toDesignatorResourcePagePath(context.designatorPath);
  const rawSourcePanels = context.rawSourcePanels.get(ownerPagePath);
  return rawSourcePanels
    ? extractResourceTitle(meshBase, context.designatorPath, rawSourcePanels)
    : undefined;
}

function isChildIdentifierResourcePath(resourcePath: string): boolean {
  if (resourcePath.length === 0) {
    return false;
  }
  const parentPath = toParentResourcePath(resourcePath);
  if (parentPath === "_knop" || parentPath.endsWith("/_knop")) {
    return true;
  }

  return !resourcePath.split("/").some((segment) => segment.startsWith("_"));
}

function toParentResourcePath(resourcePath: string): string {
  const lastSlash = resourcePath.lastIndexOf("/");
  return lastSlash === -1 ? "" : resourcePath.slice(0, lastSlash);
}

function resolveGeneratedAt(now?: () => Date): Date {
  if (now) {
    return now();
  }
  const generatedAt = Deno.env.get("WEAVE_GENERATED_AT");
  return generatedAt ? new Date(generatedAt) : new Date();
}

async function loadBestEffortGenerateDesignatorContexts(
  workspaceRoot: string,
  localPathPolicy: OperationalLocalPathPolicy,
  meshState: MeshState,
  designatorPaths: readonly string[],
  effectiveConfig: EffectiveConfig,
  hasExplicitGenerateTargets: boolean,
  timing?: RuntimeTiming,
  phasePrefix = "loadBestEffortGenerateDesignatorContexts",
): Promise<readonly GenerateDesignatorContext[]> {
  const phase = (name: string) => `${phasePrefix}.${name}`;
  const contexts: GenerateDesignatorContext[] = [];
  const seen = new Set<string>();

  for (const designatorPath of designatorPaths) {
    if (seen.has(designatorPath)) {
      continue;
    }
    seen.add(designatorPath);

    try {
      contexts.push(
        ...await timeOptional(
          timing,
          phase("designator"),
          () =>
            loadGenerateDesignatorContexts(
              workspaceRoot,
              localPathPolicy,
              meshState,
              [designatorPath],
              effectiveConfig,
              hasExplicitGenerateTargets,
              timing,
              phase("designator"),
            ),
        ),
      );
    } catch (error) {
      if (
        error instanceof Deno.errors.NotFound ||
        error instanceof LocalPathAccessError ||
        error instanceof WeaveRuntimeError
      ) {
        continue;
      }
      throw error;
    }
  }

  return contexts;
}

async function loadGenerateDesignatorContexts(
  workspaceRoot: string,
  localPathPolicy: OperationalLocalPathPolicy,
  meshState: MeshState,
  designatorPaths: readonly string[],
  effectiveConfig: EffectiveConfig,
  hasExplicitGenerateTargets: boolean,
  timing?: RuntimeTiming,
  phasePrefix = "loadGenerateDesignatorContexts",
): Promise<readonly GenerateDesignatorContext[]> {
  const phase = (name: string) => `${phasePrefix}.${name}`;
  const contexts: GenerateDesignatorContext[] = [];

  for (const designatorPath of designatorPaths) {
    const knopInventoryPath = join(
      workspaceRoot,
      `${toKnopPath(designatorPath)}/_inventory/inventory.ttl`,
    );
    let currentKnopInventoryTurtle: string;

    try {
      currentKnopInventoryTurtle = await timeOptional(
        timing,
        phase("readKnopInventory"),
        () => Deno.readTextFile(knopInventoryPath),
      );
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) {
        continue;
      }
      throw error;
    }

    const payloadArtifact = resolvePayloadArtifactInventoryState(
      meshState.meshBase,
      currentKnopInventoryTurtle,
      designatorPath,
      {
        parseErrorMessage:
          `Could not parse the current Knop inventory while collecting pages for ${designatorPath}.`,
        missingWorkingFileMessage:
          `Could not resolve the working payload file for ${designatorPath}.`,
      },
    );
    const pageDescriptions = new Map<string, string>();
    const rawSourcePanels = new Map<
      string,
      readonly ResourcePageRawSourcePanelModel[]
    >();
    const artifactLinks = collectKnopArtifactLinks(
      meshState.meshBase,
      currentKnopInventoryTurtle,
      designatorPath,
    );
    const currentKnopInventoryQuads = parseInventoryQuads(
      meshState.meshBase,
      currentKnopInventoryTurtle,
      `Could not parse the current Knop inventory while collecting current KnopInventory source panel for ${designatorPath}.`,
    );
    await addCurrentKnopInventoryRawSourcePanel(
      rawSourcePanels,
      workspaceRoot,
      meshState.meshBase,
      currentKnopInventoryQuads,
      designatorPath,
      currentKnopInventoryTurtle,
    );
    const resourcePageDefinitionState =
      resolveResourcePageDefinitionInventoryState(
        meshState.meshBase,
        currentKnopInventoryTurtle,
        designatorPath,
        {
          parseErrorMessage:
            `Could not parse the current Knop inventory while resolving the ResourcePageDefinition for ${designatorPath}.`,
          missingWorkingFileMessage:
            `Could not resolve the working ResourcePageDefinition file for ${designatorPath}.`,
        },
      );
    const referenceCatalogArtifact = await timeOptional(
      timing,
      phase("loadReferenceCatalogArtifact"),
      () =>
        loadReferenceCatalogWorkingArtifact(
          workspaceRoot,
          localPathPolicy,
          meshState.meshBase,
          designatorPath,
          currentKnopInventoryTurtle,
        ),
    );
    const referenceLinks = referenceCatalogArtifact
      ? extractResourceReferenceLinks(
        meshState.meshBase,
        designatorPath,
        referenceCatalogArtifact.currentReferenceCatalogTurtle,
        (message) => new WeaveRuntimeError(message),
      )
      : [];
    const sourceRegistryArtifact = await timeOptional(
      timing,
      phase("loadSourceRegistryArtifact"),
      () =>
        loadKnopSourceRegistryArtifact(
          localPathPolicy,
          meshState.meshBase,
          designatorPath,
          currentKnopInventoryTurtle,
        ),
    );
    const extractionSource = resolveExtractionSourceInventoryState(
      meshState.meshBase,
      currentKnopInventoryTurtle,
      designatorPath,
      {
        parseErrorMessage:
          `Could not parse the current Knop inventory while resolving page source facts for ${designatorPath}.`,
        missingExtractionSourceMessage:
          `Could not resolve the current extracted source binding for ${designatorPath}.`,
        missingTargetArtifactMessage:
          `Could not resolve the current extracted source target for ${designatorPath}.`,
        missingRequestedTargetStateMessage:
          `Could not resolve the current extracted source target state for ${designatorPath}.`,
        unsupportedResolutionModeMessage:
          `Unsupported ExtractionSource resolution mode for ${designatorPath}.`,
      },
      sourceRegistryArtifact?.turtle,
    );
    const ownHistoryGroupsByResourcePath = timeOptionalSync(
      timing,
      phase("collectOwnHistoryGroups"),
      () =>
        collectHistoryGroupsByResourcePath(
          meshState.meshBase,
          currentKnopInventoryTurtle,
          `Could not parse the current Knop inventory while collecting ResourcePage histories for ${designatorPath}.`,
        ),
    );
    const ancestorHistoryGroupsByResourcePath = await timeOptional(
      timing,
      phase("collectAncestorHistoryGroups"),
      () =>
        collectAncestorHistoryGroupsByResourcePath(
          workspaceRoot,
          meshState.meshBase,
          designatorPath,
        ),
    );
    const sourceHistoryGroupsByResourcePath = extractionSource
      ? await timeOptional(
        timing,
        phase("collectExtractionSourceHistoryGroups"),
        () =>
          collectExtractionSourceHistoryGroupsByResourcePath(
            workspaceRoot,
            meshState.meshBase,
            designatorPath,
            extractionSource.sourceArtifactPath,
          ),
      )
      : new Map<string, readonly ResourcePageHistoryGroupModel[]>();
    let customIdentifierPage: CustomIdentifierPageModelInput | undefined;
    const pagePaths = timeOptionalSync(
      timing,
      phase("listResourcePagePaths"),
      () =>
        listRuntimeGeneratedResourcePagePaths({
          meshBase: meshState.meshBase,
          inventoryTurtle: currentKnopInventoryTurtle,
          parseErrorMessage:
            `Could not parse the current Knop inventory while collecting ResourcePages for ${designatorPath}.`,
          config: effectiveConfig,
          explicitRequest: hasExplicitGenerateTargets,
        }),
    );

    try {
      const resourcePageDefinitionArtifact = await timeOptional(
        timing,
        phase("loadResourcePageDefinitionArtifact"),
        () =>
          loadResourcePageDefinitionWorkingArtifact(
            workspaceRoot,
            localPathPolicy,
            designatorPath,
            resourcePageDefinitionState,
          ),
      );
      customIdentifierPage = await timeOptional(
        timing,
        phase("loadActiveCustomIdentifierPage"),
        () =>
          loadActiveCustomIdentifierPage(
            workspaceRoot,
            localPathPolicy,
            meshState.meshBase,
            designatorPath,
            resourcePageDefinitionArtifact,
          ),
      );

      if (resourcePageDefinitionArtifact) {
        pageDescriptions.set(
          `${resourcePageDefinitionArtifact.artifactPath}/index.html`,
          describeResourcePageDefinitionArtifact(designatorPath),
        );
      }
    } catch (error) {
      if (error instanceof ResourcePageDefinitionResolutionError) {
        throw new WeaveRuntimeError(error.message);
      }
      throw error;
    }

    contexts.push({
      designatorPath,
      payloadWorkingLocalRelativePath: payloadArtifact
        ?.workingLocalRelativePath,
      payloadWorkingAccessUrl: payloadArtifact?.workingAccessUrl,
      ...(payloadArtifact?.repositorySourceFloatingLocator
        ? {
          payloadRepositorySourceFloatingLocator:
            payloadArtifact.repositorySourceFloatingLocator,
        }
        : {}),
      ...(extractionSource
        ? {
          extractionSource: {
            sourceArtifactPath: extractionSource.sourceArtifactPath,
            ...(extractionSource.requestedTargetStatePath
              ? {
                requestedTargetStatePath:
                  extractionSource.requestedTargetStatePath,
              }
              : {}),
            ...(extractionSource.artifactResolutionModeIri
              ? {
                artifactResolutionModeIri:
                  extractionSource.artifactResolutionModeIri,
              }
              : {}),
          },
        }
        : {}),
      references: referenceLinks.map((link) => link.model),
      ...artifactLinks,
      customIdentifierPage,
      historyGroupsByResourcePath: mergeHistoryGroupsByResourcePath(
        ownHistoryGroupsByResourcePath,
        ancestorHistoryGroupsByResourcePath,
        sourceHistoryGroupsByResourcePath,
      ),
      pageDescriptions,
      rawSourcePanels,
      pagePaths,
    });

    if (payloadArtifact) {
      await timeOptional(
        timing,
        phase("addPayloadRawSourcePanels"),
        () =>
          addPayloadRawSourcePanels(
            rawSourcePanels,
            workspaceRoot,
            meshState.meshBase,
            currentKnopInventoryQuads,
            designatorPath,
            payloadArtifact,
          ),
      );
    } else if (extractionSource) {
      await timeOptional(
        timing,
        phase("addExtractionSourceRawSourcePanels"),
        () =>
          addExtractionSourceRawSourcePanels(
            rawSourcePanels,
            workspaceRoot,
            localPathPolicy,
            meshState.meshBase,
            designatorPath,
            extractionSource.sourceArtifactPath,
            extractionSource.requestedTargetStatePath,
            extractionSource.artifactResolutionModeIri,
          ),
      );
    } else if (referenceCatalogArtifact) {
      await timeOptional(
        timing,
        phase("addReferenceTargetSourceRawSourcePanels"),
        () =>
          addReferenceTargetSourceRawSourcePanels(
            rawSourcePanels,
            workspaceRoot,
            localPathPolicy,
            meshState.meshBase,
            designatorPath,
            referenceLinks,
          ),
      );
    }
    await timeOptional(
      timing,
      phase("addSupportArtifactRawSourcePanels"),
      () =>
        addSupportArtifactRawSourcePanels(
          rawSourcePanels,
          workspaceRoot,
          localPathPolicy,
          meshState.meshBase,
          currentKnopInventoryQuads,
          artifactLinks.supportingArtifacts,
        ),
    );
  }

  return contexts;
}

function collectKnopArtifactLinks(
  meshBase: string,
  currentKnopInventoryTurtle: string,
  designatorPath: string,
): {
  governedArtifacts: readonly KnopArtifactLinkModel[];
  supportingArtifacts: readonly KnopArtifactLinkModel[];
} {
  const quads = parseInventoryQuads(
    meshBase,
    currentKnopInventoryTurtle,
    `Could not parse the current Knop inventory while collecting Knop artifacts for ${designatorPath}.`,
  );
  const knopIri = new URL(toKnopPath(designatorPath), meshBase).href;

  return {
    governedArtifacts: collectKnopArtifactLinksForPredicates(
      meshBase,
      quads,
      knopIri,
      [[SFLO_HAS_PAYLOAD_ARTIFACT_IRI, "PayloadArtifact"]],
    ),
    supportingArtifacts: collectKnopArtifactLinksForPredicates(
      meshBase,
      quads,
      knopIri,
      [
        [SFLO_HAS_KNOP_METADATA_IRI, "KnopMetadata"],
        [SFLO_HAS_KNOP_INVENTORY_IRI, "KnopInventory"],
        [SFLO_HAS_REFERENCE_CATALOG_IRI, "ReferenceCatalog"],
        [SFLO_HAS_RESOURCE_PAGE_DEFINITION_IRI, "ResourcePageDefinition"],
        [SFLO_HAS_KNOP_ASSET_BUNDLE_IRI, "KnopAssetBundle"],
      ],
    ),
  };
}

async function collectExtractionSourceHistoryGroupsByResourcePath(
  workspaceRoot: string,
  meshBase: string,
  designatorPath: string,
  sourceArtifactPath: string,
): Promise<
  ReadonlyMap<string, readonly ResourcePageHistoryGroupModel[]>
> {
  const sourceKnopInventoryPath = join(
    workspaceRoot,
    `${toKnopPath(sourceArtifactPath)}/_inventory/inventory.ttl`,
  );

  try {
    return collectHistoryGroupsByResourcePath(
      meshBase,
      await Deno.readTextFile(sourceKnopInventoryPath),
      `Could not parse the source Knop inventory while collecting ResourcePage histories for ${designatorPath}.`,
    );
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      throw new WeaveRuntimeError(
        `Workspace is missing the page source payload inventory for ${designatorPath}: ${
          toKnopPath(sourceArtifactPath)
        }/_inventory/inventory.ttl`,
      );
    }
    throw error;
  }
}

async function collectAncestorHistoryGroupsByResourcePath(
  workspaceRoot: string,
  meshBase: string,
  designatorPath: string,
): Promise<
  ReadonlyMap<string, readonly ResourcePageHistoryGroupModel[]>
> {
  const maps: ReadonlyMap<
    string,
    readonly ResourcePageHistoryGroupModel[]
  >[] = [];

  for (const ancestorPath of listAncestorDesignatorPaths(designatorPath)) {
    const ancestorKnopInventoryPath = join(
      workspaceRoot,
      `${toKnopPath(ancestorPath)}/_inventory/inventory.ttl`,
    );

    try {
      const historyGroupsByResourcePath = collectHistoryGroupsByResourcePath(
        meshBase,
        await Deno.readTextFile(ancestorKnopInventoryPath),
        `Could not parse the ancestor Knop inventory while collecting ResourcePage histories for ${designatorPath}.`,
      );
      if (historyGroupsByResourcePath.has(designatorPath)) {
        maps.push(historyGroupsByResourcePath);
      }
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) {
        continue;
      }
      throw error;
    }
  }

  return mergeHistoryGroupsByResourcePath(...maps);
}

function listAncestorDesignatorPaths(
  designatorPath: string,
): readonly string[] {
  const segments = designatorPath.split("/").filter((segment) =>
    segment.length > 0
  );
  const ancestors: string[] = [];

  for (let index = segments.length - 1; index > 0; index -= 1) {
    ancestors.push(segments.slice(0, index).join("/"));
  }

  return ancestors;
}

function collectHistoryGroupsByResourcePath(
  meshBase: string,
  inventoryTurtle: string,
  parseErrorMessage: string,
): ReadonlyMap<string, readonly ResourcePageHistoryGroupModel[]> {
  return collectResourcePageHistoryGroupsByResourcePath(
    meshBase,
    inventoryTurtle,
    parseErrorMessage,
    (message) => new WeaveRuntimeError(message),
  );
}

function collectKnopArtifactLinksForPredicates(
  meshBase: string,
  quads: readonly Quad[],
  knopIri: string,
  predicates: readonly (readonly [predicateIri: string, label: string])[],
): readonly KnopArtifactLinkModel[] {
  const links: KnopArtifactLinkModel[] = [];
  const seen = new Set<string>();

  for (const [predicateIri, label] of predicates) {
    for (const quad of quads) {
      if (
        quad.subject.termType !== "NamedNode" ||
        quad.subject.value !== knopIri ||
        quad.predicate.value !== predicateIri ||
        quad.object.termType !== "NamedNode"
      ) {
        continue;
      }

      const path = toMeshPath(meshBase, quad.object.value);
      if (!path || seen.has(path)) {
        continue;
      }

      links.push({ label, path });
      seen.add(path);
    }
  }

  return links;
}

function findHistoryGroupsForResource(
  resourcePath: string,
  contexts: readonly GenerateDesignatorContext[],
): readonly ResourcePageHistoryGroupModel[] | undefined {
  for (const context of contexts) {
    const historyGroups = context.historyGroupsByResourcePath.get(
      resourcePath,
    );
    if (historyGroups) {
      return historyGroups;
    }
  }
  return undefined;
}

function describeSemanticFlowResource(
  meshBase: string,
  resourcePath: string,
  historyGroups: readonly ResourcePageHistoryGroupModel[],
  ownerRawSourcePanels?: readonly ResourcePageRawSourcePanelModel[],
): string {
  const displayPath = resourcePath.length === 0 ? "/" : resourcePath;
  const manifestationState = findHistoryStateForManifestation(
    resourcePath,
    historyGroups,
  );
  if (manifestationState) {
    return `Artifact manifestation for the ${
      toLastPathSegment(manifestationState.path)
    } historical state`;
  }
  const stateHistory = findHistoryForState(resourcePath, historyGroups);
  if (stateHistory) {
    return `Historical state for the ${
      toLastPathSegment(stateHistory.path)
    } artifact history`;
  }
  if (historyGroups.some((group) => group.path === resourcePath)) {
    const ownerResourcePath = dirname(resourcePath);
    const ownerTitle = ownerRawSourcePanels
      ? extractResourceTitle(
        meshBase,
        ownerResourcePath,
        ownerRawSourcePanels,
      )
      : undefined;
    return `Artifact history for ${
      ownerTitle ?? formatOwnerResourcePath(ownerResourcePath)
    }`;
  }
  if (resourcePath === "_mesh") {
    return "Semantic Mesh.";
  }
  if (resourcePath.endsWith("/_knop") || resourcePath === "_knop") {
    return `Semantic Flow bundle of supporting data for ${
      formatOwnerResourcePath(dirname(resourcePath))
    }.`;
  }
  if (resourcePath.endsWith("/_meta")) {
    if (resourcePath === "_mesh/_meta") {
      return "Metadata for this Semantic Mesh";
    }
    return `Knop metadata for ${
      formatOwnerResourcePath(dirname(dirname(resourcePath)))
    }`;
  }
  if (resourcePath.endsWith("/_inventory")) {
    if (resourcePath === "_mesh/_inventory") {
      return "Inventory for this Semantic Mesh";
    }
    return `Inventory for ${formatOwnerResourcePath(dirname(resourcePath))}`;
  }
  if (resourcePath.endsWith("/_config")) {
    return "Configuration for this Semantic Mesh";
  }
  return `Semantic Flow resource ${displayPath}`;
}

function findOwnerRawSourcePanelsForArtifactHistory(
  resourcePath: string,
  historyGroups: readonly ResourcePageHistoryGroupModel[],
  meshRawSourcePanels: ReadonlyMap<
    string,
    readonly ResourcePageRawSourcePanelModel[]
  >,
  designatorContexts: readonly GenerateDesignatorContext[],
): readonly ResourcePageRawSourcePanelModel[] | undefined {
  if (!historyGroups.some((group) => group.path === resourcePath)) {
    return undefined;
  }
  const ownerPagePath = toDesignatorResourcePagePath(dirname(resourcePath));
  return meshRawSourcePanels.get(ownerPagePath) ??
    findRawSourcePanelsForPage(ownerPagePath, designatorContexts);
}

function findOwnerRawSourcePanelsForArtifactHistoryInContext(
  resourcePath: string,
  historyGroups: readonly ResourcePageHistoryGroupModel[],
  context: GenerateDesignatorContext,
): readonly ResourcePageRawSourcePanelModel[] | undefined {
  if (!historyGroups.some((group) => group.path === resourcePath)) {
    return undefined;
  }
  return context.rawSourcePanels.get(
    toDesignatorResourcePagePath(dirname(resourcePath)),
  );
}

function extractResourceTitle(
  meshBase: string,
  resourcePath: string,
  rawSourcePanels: readonly ResourcePageRawSourcePanelModel[],
): string | undefined {
  const canonical = new URL(resourcePath, meshBase).href;
  const quads = rawSourcePanels.flatMap((panel) =>
    panel.contents ? parseRawSourcePanel(canonical, panel.contents) : []
  );

  return findFirstLiteralObject(quads, canonical, DCTERMS_TITLE_IRI);
}

function extractResourceRdfTypes(
  meshBase: string,
  resourcePath: string,
  rawSourcePanels: readonly ResourcePageRawSourcePanelModel[],
): readonly string[] {
  const canonical = new URL(resourcePath, meshBase).href;
  const quads = rawSourcePanels.flatMap((panel) =>
    panel.contents ? parseRawSourcePanel(canonical, panel.contents) : []
  );
  const types = new Set<string>();

  for (const quad of quads) {
    if (
      quad.subject.termType === "NamedNode" &&
      quad.subject.value === canonical &&
      quad.predicate.value === RDF_TYPE_IRI &&
      quad.object.termType === "NamedNode"
    ) {
      types.add(quad.object.value);
    }
  }

  return [...types].sort();
}

function parseRawSourcePanel(
  canonical: string,
  turtle: string,
): readonly Quad[] {
  try {
    return new Parser({ baseIRI: canonical }).parse(turtle);
  } catch {
    return [];
  }
}

function findFirstLiteralObject(
  quads: readonly Quad[],
  subjectIri: string,
  predicateIri: string,
): string | undefined {
  for (const quad of quads) {
    if (
      quad.subject.termType === "NamedNode" &&
      quad.subject.value === subjectIri &&
      quad.predicate.value === predicateIri &&
      quad.object.termType === "Literal"
    ) {
      return quad.object.value;
    }
  }
  return undefined;
}

function formatOwnerResourcePath(resourcePath: string): string {
  if (resourcePath === "." || resourcePath.length === 0) {
    return "/";
  }
  return resourcePath;
}

function toLastPathSegment(path: string): string {
  const segments = path.split("/").filter((segment) => segment.length > 0);
  return segments[segments.length - 1] ?? "/";
}

function toMeshPath(meshBase: string, iri: string): string | undefined {
  const meshUrl = new URL(meshBase);
  const iriUrl = new URL(iri);
  if (iriUrl.origin !== meshUrl.origin) {
    return undefined;
  }
  const basePath = meshUrl.pathname.endsWith("/")
    ? meshUrl.pathname
    : `${meshUrl.pathname}/`;
  if (!iriUrl.pathname.startsWith(basePath)) {
    return undefined;
  }
  return decodeURIComponent(iriUrl.pathname.slice(basePath.length));
}

function parseInventoryQuads(
  meshBase: string,
  inventoryTurtle: string,
  parseErrorMessage: string,
): readonly Quad[] {
  try {
    return new Parser({ baseIRI: meshBase }).parse(inventoryTurtle);
  } catch {
    throw new WeaveRuntimeError(parseErrorMessage);
  }
}

function toResourcePath(pagePath: string): string {
  if (pagePath === "index.html") {
    return "";
  }
  return pagePath.endsWith("/index.html")
    ? pagePath.slice(0, -"/index.html".length)
    : pagePath;
}

const GENERATED_TIMESTAMP_FOOTER_PATTERN =
  /Generated on <span class="wf-term wf-date-tip" tabindex="0" title="[^"]*" data-tooltip="[^"]*">[^<]*<\/span> by/g;

function normalizeGeneratedTimestampFooters(contents: string): string {
  return contents.replace(
    GENERATED_TIMESTAMP_FOOTER_PATTERN,
    'Generated on <span class="wf-term wf-date-tip" tabindex="0" title="__WEAVE_GENERATED_AT__" data-tooltip="__WEAVE_GENERATED_AT__">__WEAVE_GENERATED_AT_DISPLAY__</span> by',
  );
}

async function writeGeneratedPagesUpsert(
  workspaceRoot: string,
  files: readonly PlannedFile[],
): Promise<{
  createdPaths: string[];
  updatedPaths: string[];
  skippedTimestampOnlyPaths: string[];
}> {
  const createdPaths: string[] = [];
  const updatedPaths: string[] = [];
  const skippedTimestampOnlyPaths: string[] = [];

  for (const file of files) {
    const absolutePath = join(workspaceRoot, file.path);
    let exists = false;
    let currentContents: string | undefined;

    try {
      currentContents = await Deno.readTextFile(absolutePath);
      exists = true;
    } catch (error) {
      if (!(error instanceof Deno.errors.NotFound)) {
        throw error;
      }
    }

    if (exists && currentContents === file.contents) {
      continue;
    }

    if (
      exists &&
      currentContents !== undefined &&
      normalizeGeneratedTimestampFooters(currentContents) ===
        normalizeGeneratedTimestampFooters(file.contents)
    ) {
      skippedTimestampOnlyPaths.push(file.path);
      continue;
    }

    await Deno.mkdir(dirname(absolutePath), { recursive: true });
    await Deno.writeTextFile(absolutePath, file.contents);

    if (exists) {
      updatedPaths.push(file.path);
    } else {
      createdPaths.push(file.path);
    }
  }

  return {
    createdPaths,
    updatedPaths,
    skippedTimestampOnlyPaths,
  };
}
