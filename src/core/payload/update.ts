import type { PlannedFile } from "../planned_file.ts";

const reservedDesignatorSegments = new Set(["_knop", "_mesh"]);

export interface PayloadUpdateRequest {
  designatorPath: string;
  workingFilePath: string;
  replacementPayloadTurtle: string;
}

export interface ResolvedPayloadUpdateRequest extends PayloadUpdateRequest {
  meshBase: string;
  currentKnopInventoryTurtle: string;
}

export interface PayloadUpdatePlan {
  meshBase: string;
  designatorPath: string;
  payloadArtifactIri: string;
  workingFilePath: string;
  updatedFiles: readonly PlannedFile[];
}

export class PayloadUpdateInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PayloadUpdateInputError";
  }
}

export function planPayloadUpdate(
  request: ResolvedPayloadUpdateRequest,
): PayloadUpdatePlan {
  const meshBase = normalizeMeshBase(request.meshBase);
  const designatorPath = normalizeDesignatorPath(request.designatorPath);
  const workingFilePath = normalizeWorkingFilePath(request.workingFilePath);
  const replacementPayloadTurtle = normalizeReplacementPayloadTurtle(
    request.replacementPayloadTurtle,
  );

  assertCurrentPayloadArtifactShape(
    request.currentKnopInventoryTurtle,
    designatorPath,
    workingFilePath,
  );

  return {
    meshBase,
    designatorPath,
    payloadArtifactIri: new URL(designatorPath, meshBase).href,
    workingFilePath,
    updatedFiles: [{
      path: workingFilePath,
      contents: replacementPayloadTurtle,
    }],
  };
}

function normalizeMeshBase(meshBase: string): string {
  const trimmed = meshBase.trim();
  if (trimmed.length === 0) {
    throw new PayloadUpdateInputError("meshBase is required");
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new PayloadUpdateInputError("meshBase must be an absolute IRI");
  }

  if (!url.pathname.endsWith("/")) {
    throw new PayloadUpdateInputError("meshBase must end with '/'");
  }
  if (url.search.length > 0 || url.hash.length > 0) {
    throw new PayloadUpdateInputError(
      "meshBase must not include a query or fragment",
    );
  }

  return url.href;
}

function normalizeDesignatorPath(designatorPath: string): string {
  const trimmed = designatorPath.trim();
  if (trimmed.length === 0) {
    throw new PayloadUpdateInputError("designatorPath is required");
  }
  if (trimmed.startsWith("/") || trimmed.endsWith("/")) {
    throw new PayloadUpdateInputError(
      "designatorPath must not start or end with '/'",
    );
  }
  if (
    trimmed.includes("\\") || trimmed.includes("?") || trimmed.includes("#")
  ) {
    throw new PayloadUpdateInputError(
      "designatorPath contains unsupported path characters",
    );
  }

  const segments = trimmed.split("/");
  if (segments.some((segment) => segment.length === 0)) {
    throw new PayloadUpdateInputError(
      "designatorPath must not contain empty path segments",
    );
  }
  if (segments.some((segment) => segment === "." || segment === "..")) {
    throw new PayloadUpdateInputError(
      "designatorPath must not contain '.' or '..' path segments",
    );
  }
  if (segments.some((segment) => reservedDesignatorSegments.has(segment))) {
    throw new PayloadUpdateInputError(
      "designatorPath must not contain reserved path segments",
    );
  }

  return trimmed;
}

function normalizeWorkingFilePath(workingFilePath: string): string {
  const trimmed = workingFilePath.trim();
  if (trimmed.length === 0) {
    throw new PayloadUpdateInputError("workingFilePath is required");
  }
  if (trimmed.startsWith("/") || trimmed.endsWith("/")) {
    throw new PayloadUpdateInputError(
      "workingFilePath must be a mesh-relative file path",
    );
  }
  if (
    trimmed.includes("\\") || trimmed.includes("?") || trimmed.includes("#") ||
    /\s/.test(trimmed)
  ) {
    throw new PayloadUpdateInputError(
      "workingFilePath contains unsupported path characters",
    );
  }

  const segments = trimmed.split("/");
  if (segments.some((segment) => segment.length === 0)) {
    throw new PayloadUpdateInputError(
      "workingFilePath must not contain empty path segments",
    );
  }
  if (segments.some((segment) => segment === "." || segment === "..")) {
    throw new PayloadUpdateInputError(
      "workingFilePath must be a mesh-relative file path",
    );
  }

  return trimmed;
}

function normalizeReplacementPayloadTurtle(
  replacementPayloadTurtle: string,
): string {
  if (replacementPayloadTurtle.trim().length === 0) {
    throw new PayloadUpdateInputError("replacement payload bytes are required");
  }

  return replacementPayloadTurtle;
}

function assertCurrentPayloadArtifactShape(
  currentKnopInventoryTurtle: string,
  designatorPath: string,
  workingFilePath: string,
): void {
  const knopPath = `${designatorPath}/_knop`;
  const requiredFragments = [
    `<${knopPath}> a sflo:Knop ;`,
    `sflo:hasPayloadArtifact <${designatorPath}> ;`,
    `<${designatorPath}> a sflo:PayloadArtifact, sflo:DigitalArtifact, sflo:RdfDocument ;`,
    `sflo:hasWorkingLocatedFile <${workingFilePath}> ;`,
    `sflo:currentArtifactHistory <${designatorPath}/_history001> ;`,
  ];

  for (const fragment of requiredFragments) {
    if (!currentKnopInventoryTurtle.includes(fragment)) {
      throw new PayloadUpdateInputError(
        `The current local payload.update slice only supports the settled woven payload shape for ${designatorPath}.`,
      );
    }
  }
}
