export const RESERVED_DESIGNATOR_SEGMENTS: ReadonlySet<string> = new Set([
  "_knop",
  "_mesh",
]);

export const SAFE_DESIGNATOR_SEGMENT_PATTERN = /^[A-Za-z0-9._-]+$/;

export function normalizeSafeDesignatorPath(
  designatorPath: string,
  fieldName: string,
  createError: (message: string) => Error,
): string {
  const trimmed = designatorPath.trim();
  if (trimmed.length === 0) {
    throw createError(`${fieldName} is required`);
  }
  if (trimmed.startsWith("/") || trimmed.endsWith("/")) {
    throw createError(`${fieldName} must not start or end with '/'`);
  }
  if (
    trimmed.includes("\\") || trimmed.includes("?") || trimmed.includes("#")
  ) {
    throw createError(`${fieldName} contains unsupported path characters`);
  }

  const segments = trimmed.split("/");
  if (segments.some((segment) => segment.length === 0)) {
    throw createError(`${fieldName} must not contain empty path segments`);
  }
  if (segments.some((segment) => segment === "." || segment === "..")) {
    throw createError(
      `${fieldName} must not contain '.' or '..' path segments`,
    );
  }
  if (
    segments.some((segment) => RESERVED_DESIGNATOR_SEGMENTS.has(segment))
  ) {
    throw createError(`${fieldName} must not contain reserved path segments`);
  }
  for (const segment of segments) {
    if (!SAFE_DESIGNATOR_SEGMENT_PATTERN.test(segment)) {
      throw createError(
        `normalizeDesignatorPath rejected segment "${segment}" in ${fieldName}: toKnopPath only accepts path segments matching [A-Za-z0-9._-]+`,
      );
    }
  }

  return trimmed;
}
