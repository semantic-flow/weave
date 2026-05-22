import { dirname, join } from "@std/path";
import {
  toDesignatorResourcePagePath,
  toKnopPath,
} from "../../core/designator_segments.ts";
import type { PlannedFile } from "../../core/planned_file.ts";
import type {
  ResourcePageHistoryGroupModel,
  ResourcePageModel,
  ResourcePageRawSourcePanelModel,
} from "../../core/weave/resource_page_models.ts";
import {
  findHistoryForState,
  findHistoryStateForManifestation,
  isHistoryComponentResource,
} from "../../core/weave/resource_page_history_groups.ts";
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
import { listKnopDesignatorPaths } from "../mesh/inventory.ts";
import {
  loadOperationalLocalPathPolicy,
  type OperationalLocalPathPolicy,
} from "../operational/local_path_policy.ts";
import { createRuntimeTiming, type RuntimeTiming } from "../timing.ts";
import { resolveRuntimeLoggers } from "../logging/factory.ts";
import type { AuditLogger } from "../logging/audit_logger.ts";
import type { StructuredLogger } from "../logging/logger.ts";
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
  collectMeshSupportRawSourcePanels,
  findRawSourcePanelsForPage,
} from "./raw_source_panels.ts";
import {
  collectChildIdentifiersByResourcePath,
  collectDesignatorRdfTypesByResourcePath,
  collectHistoryGroupsByResourcePath,
  extractResourceTitle,
  findHistoryGroupsForResource,
  findOwnerRawSourcePanelsForArtifactHistory,
  findOwnerRawSourcePanelsForArtifactHistoryInContext,
  isChildIdentifierResourcePath,
  listRuntimeGeneratedResourcePagePaths,
  loadBestEffortGenerateDesignatorContexts,
  loadGenerateDesignatorContexts,
  resolveKnopOwnerTitle,
  toKnopChildIdentifiers,
  toLastPathSegment,
  toParentResourcePath,
} from "./page_contexts.ts";
import { timeOptional, timeOptionalSync } from "./timing_helpers.ts";
import {
  prepareVersionExecution,
  validateVersionPlanRdf,
  writePreparedVersion,
} from "./version_execution.ts";
import { toWorkspaceRelativePath } from "./workspace_paths.ts";
import { renderResourcePages } from "./pages.ts";
import {
  type EffectiveConfig,
  type HistoryTrackingPolicy,
} from "../config/effective_config.ts";
import { validatePublicationPreset } from "../publication/presets.ts";

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

function resolveGeneratedAt(now?: () => Date): Date {
  if (now) {
    return now();
  }
  const generatedAt = Deno.env.get("WEAVE_GENERATED_AT");
  return generatedAt ? new Date(generatedAt) : new Date();
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

function formatOwnerResourcePath(resourcePath: string): string {
  if (resourcePath === "." || resourcePath.length === 0) {
    return "/";
  }
  return resourcePath;
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
