import {
  normalizeSafeDesignatorPath,
  SAFE_DESIGNATOR_SEGMENT_PATTERN,
} from "./designator_segments.ts";

export interface TargetSpec {
  designatorPath: string;
  recursive?: boolean;
}

export interface VersionTargetSpec extends TargetSpec {
  historySegment?: string;
  stateSegment?: string;
}

export interface NormalizedTargetSpec<T extends TargetSpec = TargetSpec> {
  source: T;
  designatorPath: string;
  recursive: boolean;
}

export interface NormalizedVersionTargetSpec
  extends NormalizedTargetSpec<VersionTargetSpec> {
  historySegment?: string;
  stateSegment?: string;
}

export interface ResolvedTargetSelection<T extends TargetSpec = TargetSpec> {
  designatorPath: string;
  target?: NormalizedTargetSpec<T>;
}

export function normalizeTargetSpecs(
  targets: readonly unknown[] | undefined,
  fieldName: string,
  createError: (message: string) => Error,
): readonly NormalizedTargetSpec[] {
  return normalizeTargets(
    targets,
    fieldName,
    createError,
    false,
  );
}

export function normalizeVersionTargetSpecs(
  targets: readonly unknown[] | undefined,
  fieldName: string,
  createError: (message: string) => Error,
): readonly NormalizedVersionTargetSpec[] {
  return normalizeTargets(
    targets,
    fieldName,
    createError,
    true,
  ) as readonly NormalizedVersionTargetSpec[];
}

export function resolveTargetSelections<T extends TargetSpec>(
  candidateDesignatorPaths: readonly string[],
  targets: readonly NormalizedTargetSpec<T>[],
  createError: (message: string) => Error,
): readonly ResolvedTargetSelection<T>[] {
  if (targets.length === 0) {
    return candidateDesignatorPaths.map((designatorPath) => ({
      designatorPath,
    }));
  }

  const resolved: ResolvedTargetSelection<T>[] = [];

  for (const designatorPath of candidateDesignatorPaths) {
    const matches = targets.filter((target) =>
      target.designatorPath === designatorPath ||
      (target.recursive &&
        designatorPath.startsWith(`${target.designatorPath}/`))
    );
    if (matches.length === 0) {
      continue;
    }

    const mostSpecificLength = Math.max(
      ...matches.map((target) => target.designatorPath.length),
    );
    const mostSpecific = matches.filter((target) =>
      target.designatorPath.length === mostSpecificLength
    );

    if (mostSpecific.length !== 1) {
      throw createError(
        `Target selection is ambiguous for ${designatorPath}.`,
      );
    }

    resolved.push({
      designatorPath,
      target: mostSpecific[0]!,
    });
  }

  if (resolved.length === 0) {
    throw createError("Requested targets did not match any weave candidates.");
  }

  return resolved;
}

function normalizeTargets(
  targets: readonly unknown[] | undefined,
  fieldName: string,
  createError: (message: string) => Error,
  allowVersionFields: boolean,
): readonly (NormalizedTargetSpec | NormalizedVersionTargetSpec)[] {
  if (targets === undefined) {
    return [];
  }
  if (!Array.isArray(targets)) {
    throw createError(`${fieldName} must be an array`);
  }

  const normalized = targets.map((target, index) =>
    normalizeTarget(
      target,
      `${fieldName}[${index}]`,
      createError,
      allowVersionFields,
    )
  );
  const seen = new Set<string>();

  for (const target of normalized) {
    if (seen.has(target.designatorPath)) {
      throw createError(
        `${fieldName} contains an ambiguous duplicate designatorPath: ${target.designatorPath}`,
      );
    }
    seen.add(target.designatorPath);
  }

  return normalized;
}

function normalizeTarget(
  target: unknown,
  fieldName: string,
  createError: (message: string) => Error,
  allowVersionFields: boolean,
): NormalizedTargetSpec | NormalizedVersionTargetSpec {
  if (!target || typeof target !== "object" || Array.isArray(target)) {
    throw createError(`${fieldName} must be an object`);
  }

  const record = target as Record<string, unknown>;
  const allowedKeys = allowVersionFields
    ? new Set(["designatorPath", "recursive", "historySegment", "stateSegment"])
    : new Set(["designatorPath", "recursive"]);

  for (const key of Object.keys(record)) {
    if (!allowedKeys.has(key)) {
      throw createError(`${fieldName}.${key} is not supported`);
    }
  }

  const designatorPath = normalizeSafeDesignatorPath(
    requireString(
      record.designatorPath,
      `${fieldName}.designatorPath`,
      createError,
    ),
    `${fieldName}.designatorPath`,
    createError,
  );
  const recursive = normalizeOptionalBoolean(
    record.recursive,
    `${fieldName}.recursive`,
    createError,
  ) ?? false;

  if (!allowVersionFields) {
    return {
      source: {
        designatorPath,
        ...(recursive ? { recursive: true } : {}),
      },
      designatorPath,
      recursive,
    };
  }

  const historySegment = normalizeOptionalSegment(
    record.historySegment,
    `${fieldName}.historySegment`,
    createError,
  );
  const stateSegment = normalizeOptionalSegment(
    record.stateSegment,
    `${fieldName}.stateSegment`,
    createError,
  );

  return {
    source: {
      designatorPath,
      ...(recursive ? { recursive: true } : {}),
      ...(historySegment ? { historySegment } : {}),
      ...(stateSegment ? { stateSegment } : {}),
    },
    designatorPath,
    recursive,
    historySegment,
    stateSegment,
  };
}

function requireString(
  value: unknown,
  fieldName: string,
  createError: (message: string) => Error,
): string {
  if (typeof value !== "string") {
    throw createError(`${fieldName} must be a string`);
  }

  return value;
}

function normalizeOptionalBoolean(
  value: unknown,
  fieldName: string,
  createError: (message: string) => Error,
): boolean | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "boolean") {
    throw createError(`${fieldName} must be a boolean`);
  }

  return value;
}

function normalizeOptionalSegment(
  value: unknown,
  fieldName: string,
  createError: (message: string) => Error,
): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "string") {
    throw createError(`${fieldName} must be a string`);
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw createError(`${fieldName} is required`);
  }
  if (!SAFE_DESIGNATOR_SEGMENT_PATTERN.test(trimmed)) {
    throw createError(
      `${fieldName} must match [A-Za-z0-9._-]+`,
    );
  }

  return trimmed;
}
