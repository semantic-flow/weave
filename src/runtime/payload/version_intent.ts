import { join } from "@std/path";
import {
  normalizeSafeDesignatorPath,
  toKnopPath,
} from "../../core/designator_segments.ts";
import {
  PayloadVersionIntentInputError,
  type PayloadVersionIntentPlan,
  planSetPayloadHistoryIntent,
  planSetPayloadNextStateIntent,
} from "../../core/payload/version_intent.ts";
import {
  MeshMetadataResolutionError,
  resolveMeshBaseFromMetadataTurtle,
} from "../mesh/metadata.ts";
import { resolveRuntimeLoggers } from "../logging/factory.ts";
import type { AuditLogger } from "../logging/audit_logger.ts";
import type { StructuredLogger } from "../logging/logger.ts";

export interface SetPayloadHistoryIntentRequest {
  designatorPath: string;
  historySegment: string;
}

export interface SetPayloadNextStateIntentRequest {
  designatorPath: string;
  stateSegment: string;
}

export interface ExecuteSetPayloadHistoryIntentOptions {
  meshRoot: string;
  request: SetPayloadHistoryIntentRequest;
  operationalLogger?: StructuredLogger;
  auditLogger?: AuditLogger;
}

export interface ExecuteSetPayloadNextStateIntentOptions {
  meshRoot: string;
  request: SetPayloadNextStateIntentRequest;
  operationalLogger?: StructuredLogger;
  auditLogger?: AuditLogger;
}

export interface SetPayloadVersionIntentResult {
  meshBase: string;
  designatorPath: string;
  payloadArtifactIri: string;
  currentArtifactHistoryPath: string;
  nextStateSegmentHint?: string;
  updatedPaths: readonly string[];
}

export class PayloadVersionIntentRuntimeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PayloadVersionIntentRuntimeError";
  }
}

export async function executeSetPayloadHistoryIntent(
  options: ExecuteSetPayloadHistoryIntentOptions,
): Promise<SetPayloadVersionIntentResult> {
  const { operationalLogger, auditLogger } = resolveLoggers(options);
  const designatorPath = options.request.designatorPath;
  const historySegment = options.request.historySegment;
  let plan: PayloadVersionIntentPlan | undefined;

  await operationalLogger.info(
    "payload.setHistory.started",
    "Starting payload history intent update",
    { meshRoot: options.meshRoot, designatorPath, historySegment },
  );
  await auditLogger.record(
    "payload.setHistory.started",
    "Payload history intent update started",
    { meshRoot: options.meshRoot, designatorPath, historySegment },
  );

  try {
    const payloadState = await loadCurrentPayloadInventory(
      options.meshRoot,
      designatorPath,
    );
    plan = planSetPayloadHistoryIntent({
      meshBase: payloadState.meshBase,
      designatorPath: payloadState.designatorPath,
      historySegment,
      currentKnopInventoryTurtle: payloadState.currentKnopInventoryTurtle,
    });
    await writePlan(options.meshRoot, plan);
  } catch (error) {
    await logFailure({
      operationalLogger,
      auditLogger,
      event: "payload.setHistory.failed",
      message: "Payload history intent update failed",
      meshRoot: options.meshRoot,
      designatorPath,
      historySegment,
      plan,
      error,
    });
    throw normalizeRuntimeError(error);
  }

  const result = toResult(plan);
  await operationalLogger.info(
    "payload.setHistory.succeeded",
    "Payload history intent update succeeded",
    { meshRoot: options.meshRoot, ...result },
  );
  await auditLogger.record(
    "payload.setHistory.succeeded",
    "Payload history intent update succeeded",
    { meshRoot: options.meshRoot, ...result },
  );
  return result;
}

export async function executeSetPayloadNextStateIntent(
  options: ExecuteSetPayloadNextStateIntentOptions,
): Promise<SetPayloadVersionIntentResult> {
  const { operationalLogger, auditLogger } = resolveLoggers(options);
  const designatorPath = options.request.designatorPath;
  const stateSegment = options.request.stateSegment;
  let plan: PayloadVersionIntentPlan | undefined;

  await operationalLogger.info(
    "payload.setNextState.started",
    "Starting payload next-state intent update",
    { meshRoot: options.meshRoot, designatorPath, stateSegment },
  );
  await auditLogger.record(
    "payload.setNextState.started",
    "Payload next-state intent update started",
    { meshRoot: options.meshRoot, designatorPath, stateSegment },
  );

  try {
    const payloadState = await loadCurrentPayloadInventory(
      options.meshRoot,
      designatorPath,
    );
    plan = planSetPayloadNextStateIntent({
      meshBase: payloadState.meshBase,
      designatorPath: payloadState.designatorPath,
      stateSegment,
      currentKnopInventoryTurtle: payloadState.currentKnopInventoryTurtle,
    });
    await writePlan(options.meshRoot, plan);
  } catch (error) {
    await logFailure({
      operationalLogger,
      auditLogger,
      event: "payload.setNextState.failed",
      message: "Payload next-state intent update failed",
      meshRoot: options.meshRoot,
      designatorPath,
      stateSegment,
      plan,
      error,
    });
    throw normalizeRuntimeError(error);
  }

  const result = toResult(plan);
  await operationalLogger.info(
    "payload.setNextState.succeeded",
    "Payload next-state intent update succeeded",
    { meshRoot: options.meshRoot, ...result },
  );
  await auditLogger.record(
    "payload.setNextState.succeeded",
    "Payload next-state intent update succeeded",
    { meshRoot: options.meshRoot, ...result },
  );
  return result;
}

export function describeSetPayloadHistoryIntentResult(
  result: SetPayloadVersionIntentResult,
): string {
  return `Set payload ${result.payloadArtifactIri} current history to ${result.currentArtifactHistoryPath} (updated ${result.updatedPaths.length} file${
    result.updatedPaths.length === 1 ? "" : "s"
  }).`;
}

export function describeSetPayloadNextStateIntentResult(
  result: SetPayloadVersionIntentResult,
): string {
  return `Set payload ${result.payloadArtifactIri} next state to ${result.currentArtifactHistoryPath}/${result.nextStateSegmentHint} (updated ${result.updatedPaths.length} file${
    result.updatedPaths.length === 1 ? "" : "s"
  }).`;
}

function resolveLoggers(options: {
  operationalLogger?: StructuredLogger;
  auditLogger?: AuditLogger;
}): {
  operationalLogger: StructuredLogger;
  auditLogger: AuditLogger;
} {
  return resolveRuntimeLoggers(options);
}

async function loadCurrentPayloadInventory(
  meshRoot: string,
  designatorPath: string,
): Promise<{
  meshBase: string;
  designatorPath: string;
  currentKnopInventoryTurtle: string;
}> {
  await ensureMeshRootExists(meshRoot);
  const normalizedDesignatorPath = normalizeSafeDesignatorPath(
    designatorPath,
    "designatorPath",
    (message) => new PayloadVersionIntentRuntimeError(message),
    { allowRoot: true },
  );
  const meshMetadataPath = join(meshRoot, "_mesh/_meta/meta.ttl");
  const knopInventoryPath = join(
    meshRoot,
    `${toKnopPath(normalizedDesignatorPath)}/_inventory/inventory.ttl`,
  );
  let meshMetadataTurtle: string;
  let currentKnopInventoryTurtle: string;

  try {
    [meshMetadataTurtle, currentKnopInventoryTurtle] = await Promise.all([
      Deno.readTextFile(meshMetadataPath),
      Deno.readTextFile(knopInventoryPath),
    ]);
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      throw new PayloadVersionIntentRuntimeError(
        `Mesh does not contain an existing payload surface for ${normalizedDesignatorPath}`,
      );
    }
    throw error;
  }

  let meshBase: string;
  try {
    meshBase = resolveMeshBaseFromMetadataTurtle(meshMetadataTurtle);
  } catch (error) {
    if (error instanceof MeshMetadataResolutionError) {
      throw new PayloadVersionIntentRuntimeError(error.message);
    }
    if (error instanceof Error) {
      throw new PayloadVersionIntentRuntimeError(
        `Could not resolve mesh base from metadata: ${error.message}`,
      );
    }
    throw error;
  }

  return {
    meshBase,
    designatorPath: normalizedDesignatorPath,
    currentKnopInventoryTurtle,
  };
}

async function ensureMeshRootExists(meshRoot: string): Promise<void> {
  let stat: Deno.FileInfo;
  try {
    stat = await Deno.stat(meshRoot);
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      throw new PayloadVersionIntentRuntimeError(
        `Mesh root does not exist: ${meshRoot}`,
      );
    }
    throw error;
  }

  if (!stat.isDirectory) {
    throw new PayloadVersionIntentRuntimeError(
      `Mesh root is not a directory: ${meshRoot}`,
    );
  }
}

async function writePlan(
  meshRoot: string,
  plan: PayloadVersionIntentPlan,
): Promise<void> {
  for (const file of plan.updatedFiles) {
    await Deno.writeTextFile(join(meshRoot, file.path), file.contents);
  }
}

function toResult(
  plan: PayloadVersionIntentPlan,
): SetPayloadVersionIntentResult {
  return {
    meshBase: plan.meshBase,
    designatorPath: plan.designatorPath,
    payloadArtifactIri: plan.payloadArtifactIri,
    currentArtifactHistoryPath: plan.currentArtifactHistoryPath,
    ...(plan.nextStateSegmentHint
      ? { nextStateSegmentHint: plan.nextStateSegmentHint }
      : {}),
    updatedPaths: plan.updatedFiles.map((file) => file.path),
  };
}

async function logFailure(options: {
  operationalLogger: StructuredLogger;
  auditLogger: AuditLogger;
  event: string;
  message: string;
  meshRoot: string;
  designatorPath: string;
  historySegment?: string;
  stateSegment?: string;
  plan?: PayloadVersionIntentPlan;
  error: unknown;
}): Promise<void> {
  const error = options.error instanceof Error
    ? options.error.message
    : String(options.error);
  const details = {
    meshRoot: options.meshRoot,
    designatorPath: options.designatorPath,
    historySegment: options.historySegment,
    stateSegment: options.stateSegment,
    payloadArtifactIri: options.plan?.payloadArtifactIri,
    currentArtifactHistoryPath: options.plan?.currentArtifactHistoryPath,
    error,
  };
  await options.operationalLogger.error(
    options.event,
    options.message,
    details,
  );
  await options.auditLogger.record(options.event, options.message, details);
}

function normalizeRuntimeError(error: unknown): Error {
  if (
    error instanceof PayloadVersionIntentInputError ||
    error instanceof PayloadVersionIntentRuntimeError
  ) {
    return error;
  }
  return new PayloadVersionIntentRuntimeError(
    error instanceof Error ? error.message : String(error),
  );
}
