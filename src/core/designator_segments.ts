export const RESERVED_DESIGNATOR_SEGMENTS: ReadonlySet<string> = new Set([
  "_knop",
  "_mesh",
]);

export const SAFE_DESIGNATOR_SEGMENT_PATTERN = /^[A-Za-z0-9._-]+$/;
export const ROOT_DESIGNATOR_PATH = "";
export const ROOT_DESIGNATOR_CLI_SENTINEL = "/";

export function normalizeSafeDesignatorPath(
  designatorPath: string,
  fieldName: string,
  createError: (message: string) => Error,
  options?: {
    allowRoot?: boolean;
  },
): string {
  const trimmed = designatorPath.trim();
  if (trimmed.length === 0) {
    if (options?.allowRoot) {
      return ROOT_DESIGNATOR_PATH;
    }
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
        `normalizeSafeDesignatorPath rejected segment "${segment}" in ${fieldName}: path validation only accepts path segments matching [A-Za-z0-9._-]+`,
      );
    }
  }

  return trimmed;
}

export function normalizeCliDesignatorPath(
  designatorPath: string,
  fieldName: string,
  createError: (message: string) => Error,
): string {
  const trimmed = designatorPath.trim();
  if (trimmed.length === 0) {
    throw createError(`${fieldName} is required`);
  }

  return trimmed === ROOT_DESIGNATOR_CLI_SENTINEL
    ? ROOT_DESIGNATOR_PATH
    : normalizeSafeDesignatorPath(trimmed, fieldName, createError);
}

export function formatDesignatorPathForDisplay(designatorPath: string): string {
  return designatorPath.length === 0
    ? ROOT_DESIGNATOR_CLI_SENTINEL
    : designatorPath;
}

export function appendMeshPath(basePath: string, suffix: string): string {
  if (suffix.length === 0) {
    return basePath;
  }

  // Mesh-relative support-artifact paths stay relative even for the root
  // designator. Callers should use these helpers instead of hand-building
  // `${designatorPath}/...` paths, which tend to reintroduce leading-slash
  // bugs for the root path.
  return basePath.length === 0 ? suffix : `${basePath}/${suffix}`;
}

export function toKnopPath(designatorPath: string): string {
  return appendMeshPath(designatorPath, "_knop");
}

export function toReferenceCatalogPath(designatorPath: string): string {
  return appendMeshPath(toKnopPath(designatorPath), "_references");
}

export function toDesignatorResourcePagePath(designatorPath: string): string {
  return appendMeshPath(designatorPath, "index.html");
}

export function isDirectChildMeshPath(
  parentPath: string,
  childPath: string,
): boolean {
  if (parentPath.length === 0) {
    return childPath.length > 0 && !childPath.includes("/");
  }
  if (!childPath.startsWith(`${parentPath}/`)) {
    return false;
  }

  return !childPath.slice(parentPath.length + 1).includes("/");
}
