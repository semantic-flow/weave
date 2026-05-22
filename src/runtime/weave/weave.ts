import {
  type NormalizedTargetSpec,
  type NormalizedVersionTargetSpec,
} from "../../core/targeting.ts";
import {
  type GenerateRequest,
  type ValidateRequest,
  type VersionRequest,
  WeaveInputError,
  type WeaveRequest,
} from "../../core/weave/weave.ts";
import { loadOperationalLocalPathPolicy } from "../operational/local_path_policy.ts";
import { createRuntimeTiming } from "../timing.ts";
import { resolveRuntimeLoggers } from "../logging/factory.ts";
import type { AuditLogger } from "../logging/audit_logger.ts";
import type { StructuredLogger } from "../logging/logger.ts";
import { WeaveRuntimeError } from "./errors.ts";
export { WeaveRuntimeError } from "./errors.ts";
import { ensureWorkspaceRootExists, loadMeshState } from "./mesh_state.ts";
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
import { generatePreparedPages } from "./page_generation.ts";
import {
  prepareVersionExecution,
  validateVersionPlanRdf,
  writePreparedVersion,
} from "./version_execution.ts";
import { type HistoryTrackingPolicy } from "../config/effective_config.ts";
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
