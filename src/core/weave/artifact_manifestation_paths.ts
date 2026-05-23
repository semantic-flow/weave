import type { ManifestationNamingPolicy } from "./naming_policy.ts";

export function toArtifactManifestationPath(
  historyStatePath: string,
  workingLocalRelativePath: string,
  manifestationSegment?: string,
  manifestationNamingPolicy?: ManifestationNamingPolicy,
): string {
  return `${historyStatePath}/${
    manifestationSegment ??
      defaultManifestationSegment(
        workingLocalRelativePath,
        manifestationNamingPolicy,
      )
  }`;
}

function defaultManifestationSegment(
  workingLocalRelativePath: string,
  manifestationNamingPolicy: ManifestationNamingPolicy = "filenameDerived",
): string {
  switch (manifestationNamingPolicy) {
    case "filenameDerived":
    case "contentKindDerived":
      return toManifestationSegment(workingLocalRelativePath);
    case "ordinal":
      return "_m0001";
  }
}

function toManifestationSegment(workingLocalRelativePath: string): string {
  const fileName = toFileName(workingLocalRelativePath);
  const extensionIndex = fileName.lastIndexOf(".");
  return extensionIndex > 0 && extensionIndex < fileName.length - 1
    ? fileName.slice(extensionIndex + 1)
    : fileName.replaceAll(".", "-");
}

function toFileName(path: string): string {
  const segments = path.split("/");
  return segments[segments.length - 1]!;
}
