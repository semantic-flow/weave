import {
  type NormalizedTargetSpec,
  type NormalizedVersionTargetSpec,
  normalizeTargetSpecs,
  normalizeVersionTargetSpecs,
  type PreparedWeaveTargets,
  prepareWeaveTargets,
} from "../../core/targeting.ts";
import type {
  GenerateRequest,
  ValidateRequest,
  VersionRequest,
  WeaveRequest,
} from "../../core/weave/requests.ts";
import { WeaveInputError } from "../../core/weave/weave.ts";

export interface NormalizedVersionRequest {
  targets: readonly NormalizedVersionTargetSpec[];
  overwriteExistingState: boolean;
}

export interface NormalizedWeaveRequest {
  targetPreparation: PreparedWeaveTargets;
  overwriteExistingState: boolean;
}

export function normalizeValidateRequest(
  request: ValidateRequest | undefined,
): readonly NormalizedTargetSpec[] {
  assertSupportedRequestKeys(request, "request", new Set(["targets"]));
  return normalizeTargetSpecs(
    request?.targets,
    "request.targets",
    (message) => new WeaveInputError(message),
  );
}

export function normalizeGenerateRequest(
  request: GenerateRequest | undefined,
): readonly NormalizedTargetSpec[] {
  assertSupportedRequestKeys(request, "request", new Set(["targets"]));
  return normalizeTargetSpecs(
    request?.targets,
    "request.targets",
    (message) => new WeaveInputError(message),
  );
}

export function normalizeVersionRequest(
  request: VersionRequest | undefined,
): NormalizedVersionRequest {
  assertSupportedRequestKeys(
    request,
    "request",
    new Set(["targets", "overwriteExistingState"]),
  );
  const overwriteExistingState = normalizeOptionalBooleanRequestField(
    request?.overwriteExistingState,
    "request.overwriteExistingState",
  ) ?? false;
  return {
    targets: normalizeVersionTargetSpecs(
      request?.targets,
      "request.targets",
      (message) => new WeaveInputError(message),
    ),
    overwriteExistingState,
  };
}

export function normalizeWeaveRequest(
  request: WeaveRequest | undefined,
): NormalizedWeaveRequest {
  assertSupportedRequestKeys(
    request,
    "request",
    new Set(["targets", "overwriteExistingState"]),
  );
  const overwriteExistingState = normalizeOptionalBooleanRequestField(
    request?.overwriteExistingState,
    "request.overwriteExistingState",
  ) ?? false;
  return {
    targetPreparation: prepareWeaveTargets(
      request?.targets,
      "request.targets",
      (message) => new WeaveInputError(message),
    ),
    overwriteExistingState,
  };
}

function assertSupportedRequestKeys(
  request: unknown,
  fieldName: string,
  allowedKeys: ReadonlySet<string>,
): void {
  if (request === undefined) {
    return;
  }
  if (!request || typeof request !== "object" || Array.isArray(request)) {
    throw new WeaveInputError(`${fieldName} must be an object`);
  }

  for (const key of Object.keys(request)) {
    if (!allowedKeys.has(key)) {
      throw new WeaveInputError(`${fieldName}.${key} is not supported`);
    }
  }
}

function normalizeOptionalBooleanRequestField(
  value: unknown,
  fieldName: string,
): boolean | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "boolean") {
    throw new WeaveInputError(`${fieldName} must be a boolean`);
  }

  return value;
}
