import { Parser, type Quad } from "n3";
import {
  appendMeshPath,
  normalizeSafeDesignatorPath,
  toKnopPath,
} from "../designator_segments.ts";
import type { PlannedFile } from "../planned_file.ts";

const RDF_TYPE_IRI = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type";
const SFLO_NAMESPACE =
  "https://semantic-flow.github.io/semantic-flow-ontology/";

export interface PayloadUpdateRequest {
  designatorPath: string;
  workingLocalRelativePath: string;
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
  workingLocalRelativePath: string;
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
  const workingLocalRelativePath = normalizeWorkingLocalRelativePath(
    request.workingLocalRelativePath,
  );
  const replacementPayloadTurtle = normalizeReplacementPayloadTurtle(
    request.replacementPayloadTurtle,
  );

  assertCurrentPayloadArtifactShape(
    request.currentKnopInventoryTurtle,
    designatorPath,
    workingLocalRelativePath,
  );

  return {
    meshBase,
    designatorPath,
    payloadArtifactIri: new URL(designatorPath, meshBase).href,
    workingLocalRelativePath,
    updatedFiles: [{
      path: workingLocalRelativePath,
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
  return normalizeSafeDesignatorPath(
    designatorPath,
    "designatorPath",
    (message) => new PayloadUpdateInputError(message),
    { allowRoot: true },
  );
}

function normalizeWorkingLocalRelativePath(
  workingLocalRelativePath: string,
): string {
  const trimmed = workingLocalRelativePath.trim();
  if (trimmed.length === 0) {
    throw new PayloadUpdateInputError("workingLocalRelativePath is required");
  }
  if (trimmed.startsWith("/") || trimmed.endsWith("/")) {
    throw new PayloadUpdateInputError(
      "workingLocalRelativePath must be a mesh-relative file path",
    );
  }
  if (
    trimmed.includes("\\") || trimmed.includes("?") || trimmed.includes("#") ||
    /\s/.test(trimmed)
  ) {
    throw new PayloadUpdateInputError(
      "workingLocalRelativePath contains unsupported path characters",
    );
  }

  const segments = trimmed.split("/");
  if (segments.some((segment) => segment.length === 0)) {
    throw new PayloadUpdateInputError(
      "workingLocalRelativePath must not contain empty path segments",
    );
  }
  if (segments.some((segment) => segment === "." || segment === "..")) {
    throw new PayloadUpdateInputError(
      "workingLocalRelativePath must be a mesh-relative file path",
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
  workingLocalRelativePath: string,
): void {
  const knopPath = toKnopPath(designatorPath);
  const requiredFragments = [
    {
      subject: toIriCandidates(currentKnopInventoryTurtle, knopPath),
      predicate: [RDF_TYPE_IRI],
      object: [`${SFLO_NAMESPACE}Knop`],
    },
    {
      subject: toIriCandidates(currentKnopInventoryTurtle, knopPath),
      predicate: [`${SFLO_NAMESPACE}hasPayloadArtifact`],
      object: toIriCandidates(currentKnopInventoryTurtle, designatorPath),
    },
    {
      subject: toIriCandidates(currentKnopInventoryTurtle, designatorPath),
      predicate: [RDF_TYPE_IRI],
      object: [`${SFLO_NAMESPACE}PayloadArtifact`],
    },
    {
      subject: toIriCandidates(currentKnopInventoryTurtle, designatorPath),
      predicate: [RDF_TYPE_IRI],
      object: [`${SFLO_NAMESPACE}DigitalArtifact`],
    },
    {
      subject: toIriCandidates(currentKnopInventoryTurtle, designatorPath),
      predicate: [RDF_TYPE_IRI],
      object: [`${SFLO_NAMESPACE}RdfDocument`],
    },
    {
      subject: toIriCandidates(currentKnopInventoryTurtle, designatorPath),
      predicate: [`${SFLO_NAMESPACE}hasWorkingLocatedFile`],
      object: toIriCandidates(
        currentKnopInventoryTurtle,
        workingLocalRelativePath,
      ),
    },
    {
      subject: toIriCandidates(currentKnopInventoryTurtle, designatorPath),
      predicate: [`${SFLO_NAMESPACE}currentArtifactHistory`],
      object: toIriCandidates(
        currentKnopInventoryTurtle,
        appendMeshPath(designatorPath, "_history001"),
      ),
    },
  ];
  const quadKeys = parseQuadKeys(currentKnopInventoryTurtle, designatorPath);

  for (const fragment of requiredFragments) {
    if (!quadSetHasAnyMatch(quadKeys, fragment)) {
      throw new PayloadUpdateInputError(
        `The current local payload.update slice only supports the settled woven payload shape for ${designatorPath}.`,
      );
    }
  }
}

function parseQuadKeys(
  currentKnopInventoryTurtle: string,
  designatorPath: string,
): ReadonlySet<string> {
  try {
    return new Set(
      new Parser().parse(currentKnopInventoryTurtle).map((quad: Quad) =>
        toQuadKey(quad.subject.value, quad.predicate.value, quad.object.value)
      ),
    );
  } catch {
    throw new PayloadUpdateInputError(
      `The current local payload.update slice only supports the settled woven payload shape for ${designatorPath}.`,
    );
  }
}

function quadSetHasAnyMatch(
  quadKeys: ReadonlySet<string>,
  fragment: {
    subject: readonly string[];
    predicate: readonly string[];
    object: readonly string[];
  },
): boolean {
  for (const subject of fragment.subject) {
    for (const predicate of fragment.predicate) {
      for (const object of fragment.object) {
        if (quadKeys.has(toQuadKey(subject, predicate, object))) {
          return true;
        }
      }
    }
  }

  return false;
}

function toIriCandidates(
  currentKnopInventoryTurtle: string,
  value: string,
): readonly string[] {
  const candidates = new Set<string>([value]);
  const baseIri = currentKnopInventoryTurtle.match(/^@base <([^>]+)> \./m)?.[1];

  if (baseIri) {
    candidates.add(new URL(value, baseIri).href);
  }

  return [...candidates];
}

function toQuadKey(subject: string, predicate: string, object: string): string {
  return `${subject} ${predicate} ${object}`;
}
