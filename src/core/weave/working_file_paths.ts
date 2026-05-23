import * as pathPosix from "@std/path/posix";

export function normalizeWorkingLocalRelativePathLiteral(
  value: string,
): string {
  const trimmed = value.trim();

  if (
    trimmed.length === 0 ||
    trimmed.startsWith("/") ||
    trimmed.endsWith("/") ||
    /^[A-Za-z]:/.test(trimmed)
  ) {
    throw new Error("invalid workingLocalRelativePath");
  }
  if (
    trimmed.includes("\\") ||
    trimmed.includes("?") ||
    trimmed.includes("#") ||
    /\s/.test(trimmed)
  ) {
    throw new Error("invalid workingLocalRelativePath");
  }

  const normalized = pathPosix.normalize(trimmed);
  if (normalized === "." || normalized === "..") {
    throw new Error("invalid workingLocalRelativePath");
  }

  const segments = normalized.split("/");
  if (segments.some((segment) => segment.length === 0)) {
    throw new Error("invalid workingLocalRelativePath");
  }

  return normalized;
}

export function usesMeshLocalWorkingLocatedFile(
  workingLocalRelativePath: string,
): boolean {
  return !normalizeWorkingLocalRelativePathLiteral(workingLocalRelativePath)
    .startsWith("../");
}
