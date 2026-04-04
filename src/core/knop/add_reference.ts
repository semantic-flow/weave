import type { PlannedFile } from "../planned_file.ts";

const reservedDesignatorSegments = new Set(["_knop", "_mesh"]);

const referenceRoleIriByToken = {
  canonical:
    "https://semantic-flow.github.io/semantic-flow-ontology/ReferenceRole/Canonical",
  supplemental:
    "https://semantic-flow.github.io/semantic-flow-ontology/ReferenceRole/Supplemental",
  deprecated:
    "https://semantic-flow.github.io/semantic-flow-ontology/ReferenceRole/Deprecated",
} as const;

type ReferenceRoleToken = keyof typeof referenceRoleIriByToken;

export interface KnopAddReferenceRequest {
  designatorPath: string;
  referenceTargetDesignatorPath: string;
  referenceRole: string;
}

export interface ResolvedKnopAddReferenceRequest
  extends KnopAddReferenceRequest {
  meshBase: string;
  currentKnopInventoryTurtle: string;
}

export interface KnopAddReferencePlan {
  meshBase: string;
  designatorPath: string;
  referenceTargetDesignatorPath: string;
  referenceCatalogIri: string;
  referenceLinkIri: string;
  referenceRoleIri: string;
  referenceTargetIri: string;
  createdFiles: readonly PlannedFile[];
  updatedFiles: readonly PlannedFile[];
}

export class KnopAddReferenceInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "KnopAddReferenceInputError";
  }
}

export function planKnopAddReference(
  request: ResolvedKnopAddReferenceRequest,
): KnopAddReferencePlan {
  const meshBase = normalizeMeshBase(request.meshBase);
  const designatorPath = normalizeDesignatorPath(request.designatorPath);
  const referenceTargetDesignatorPath = normalizeDesignatorPath(
    request.referenceTargetDesignatorPath,
  );
  const referenceRoleToken = normalizeReferenceRole(request.referenceRole);
  const referenceRoleIri = referenceRoleIriByToken[referenceRoleToken];
  const knopPath = toKnopPath(designatorPath);
  const referenceCatalogPath = `${knopPath}/_references`;
  const referenceLinkPath = `${referenceCatalogPath}#reference001`;

  return {
    meshBase,
    designatorPath,
    referenceTargetDesignatorPath,
    referenceCatalogIri: new URL(referenceCatalogPath, meshBase).href,
    referenceLinkIri: new URL(referenceLinkPath, meshBase).href,
    referenceRoleIri,
    referenceTargetIri: new URL(referenceTargetDesignatorPath, meshBase).href,
    createdFiles: [
      {
        path: `${referenceCatalogPath}/references.ttl`,
        contents: renderReferencesTurtle(
          meshBase,
          designatorPath,
          referenceTargetDesignatorPath,
          referenceRoleIri,
        ),
      },
    ],
    updatedFiles: [
      {
        path: `${knopPath}/_inventory/inventory.ttl`,
        contents: renderUpdatedKnopInventoryTurtle(
          request.currentKnopInventoryTurtle,
          knopPath,
        ),
      },
    ],
  };
}

function normalizeMeshBase(meshBase: string): string {
  const trimmed = meshBase.trim();
  if (trimmed.length === 0) {
    throw new KnopAddReferenceInputError("meshBase is required");
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new KnopAddReferenceInputError("meshBase must be an absolute IRI");
  }

  if (!url.pathname.endsWith("/")) {
    throw new KnopAddReferenceInputError("meshBase must end with '/'");
  }
  if (url.search.length > 0 || url.hash.length > 0) {
    throw new KnopAddReferenceInputError(
      "meshBase must not include a query or fragment",
    );
  }

  return url.href;
}

function normalizeDesignatorPath(designatorPath: string): string {
  const trimmed = designatorPath.trim();
  if (trimmed.length === 0) {
    throw new KnopAddReferenceInputError("designatorPath is required");
  }
  if (trimmed.startsWith("/") || trimmed.endsWith("/")) {
    throw new KnopAddReferenceInputError(
      "designatorPath must not start or end with '/'",
    );
  }
  if (
    trimmed.includes("\\") || trimmed.includes("?") || trimmed.includes("#")
  ) {
    throw new KnopAddReferenceInputError(
      "designatorPath contains unsupported path characters",
    );
  }

  const segments = trimmed.split("/");
  if (segments.some((segment) => segment.length === 0)) {
    throw new KnopAddReferenceInputError(
      "designatorPath must not contain empty path segments",
    );
  }
  if (segments.some((segment) => segment === "." || segment === "..")) {
    throw new KnopAddReferenceInputError(
      "designatorPath must not contain '.' or '..' path segments",
    );
  }
  if (segments.some((segment) => reservedDesignatorSegments.has(segment))) {
    throw new KnopAddReferenceInputError(
      "designatorPath must not contain reserved path segments",
    );
  }

  return trimmed;
}

function normalizeReferenceRole(referenceRole: string): ReferenceRoleToken {
  const normalized = referenceRole.trim().toLowerCase();
  if (normalized.length === 0) {
    throw new KnopAddReferenceInputError("referenceRole is required");
  }
  if (normalized in referenceRoleIriByToken) {
    return normalized as ReferenceRoleToken;
  }
  throw new KnopAddReferenceInputError(
    `Unsupported referenceRole: ${referenceRole}`,
  );
}

function renderReferencesTurtle(
  meshBase: string,
  designatorPath: string,
  referenceTargetDesignatorPath: string,
  referenceRoleIri: string,
): string {
  const referenceCatalogPath = `${toKnopPath(designatorPath)}/_references`;

  return `@base <${meshBase}> .
@prefix sflo: <https://semantic-flow.github.io/semantic-flow-ontology/> .

<${designatorPath}> sflo:hasReferenceLink <${referenceCatalogPath}#reference001> .

<${referenceCatalogPath}#reference001> a sflo:ReferenceLink ;
  sflo:referenceLinkFor <${designatorPath}> ;
  sflo:hasReferenceRole <${referenceRoleIri}> ;
  sflo:referenceTarget <${referenceTargetDesignatorPath}> .
`;
}

function renderUpdatedKnopInventoryTurtle(
  currentKnopInventoryTurtle: string,
  knopPath: string,
): string {
  const referenceCatalogPath = `${knopPath}/_references`;

  if (
    currentKnopInventoryTurtle.includes(
      `sflo:hasReferenceCatalog <${referenceCatalogPath}>`,
    ) ||
    currentKnopInventoryTurtle.includes(
      `<${referenceCatalogPath}> a sflo:ReferenceCatalog`,
    )
  ) {
    throw new KnopAddReferenceInputError(
      `knop inventory already registers reference catalog: ${referenceCatalogPath}`,
    );
  }

  const lines = currentKnopInventoryTurtle.split("\n");

  insertReferenceCatalogIntoKnopBlock(lines, knopPath);
  insertReferenceCatalogBlock(lines, knopPath);
  insertReferenceCatalogLocatedFile(lines, knopPath);

  return lines.join("\n");
}

function insertReferenceCatalogIntoKnopBlock(
  lines: string[],
  knopPath: string,
): void {
  const knopLineIndex = lines.indexOf(`<${knopPath}> a sflo:Knop ;`);
  if (knopLineIndex === -1) {
    throw new KnopAddReferenceInputError(
      `current knop inventory is missing the ${knopPath} block`,
    );
  }

  let lastPredicateIndex = knopLineIndex + 1;
  while (
    lastPredicateIndex < lines.length &&
    lines[lastPredicateIndex].startsWith("  ")
  ) {
    lastPredicateIndex += 1;
  }
  lastPredicateIndex -= 1;

  if (lastPredicateIndex <= knopLineIndex) {
    throw new KnopAddReferenceInputError(
      "current knop inventory has an invalid knop block",
    );
  }

  const referenceCatalogPath = `${knopPath}/_references`;
  const lastPredicateLine = lines[lastPredicateIndex];

  if (lastPredicateLine.includes("sflo:hasResourcePage")) {
    lines.splice(
      lastPredicateIndex,
      0,
      `  sflo:hasReferenceCatalog <${referenceCatalogPath}> ;`,
    );
    return;
  }

  lines[lastPredicateIndex] = lastPredicateLine.replace(/\.\s*$/, " ;");
  lines.splice(
    lastPredicateIndex + 1,
    0,
    `  sflo:hasReferenceCatalog <${referenceCatalogPath}> .`,
  );
}

function insertReferenceCatalogBlock(lines: string[], knopPath: string): void {
  const referenceCatalogPath = `${knopPath}/_references`;
  const inventoryHistoryIndex = lines.findIndex((line) =>
    line.startsWith(`<${knopPath}/_inventory/_history`)
  );
  const metaLocatedFileIndex = lines.indexOf(
    `<${knopPath}/_meta/meta.ttl> a sflo:LocatedFile, sflo:RdfDocument .`,
  );

  const insertionIndex = inventoryHistoryIndex >= 0
    ? inventoryHistoryIndex
    : metaLocatedFileIndex >= 0
    ? metaLocatedFileIndex
    : lines.length;

  spliceSeparatedBlock(
    lines,
    insertionIndex,
    [
      `<${referenceCatalogPath}> a sflo:ReferenceCatalog, sflo:DigitalArtifact, sflo:RdfDocument ;`,
      `  sflo:hasWorkingLocatedFile <${referenceCatalogPath}/references.ttl> .`,
    ],
  );
}

function insertReferenceCatalogLocatedFile(
  lines: string[],
  knopPath: string,
): void {
  const referenceCatalogPath = `${knopPath}/_references`;
  const historyLocatedFileIndex = lines.findIndex((line) =>
    (
      line.startsWith(`<${knopPath}/_meta/_history`) ||
      line.startsWith(`<${knopPath}/_inventory/_history`)
    ) && line.includes("a sflo:LocatedFile")
  );

  const insertionIndex = historyLocatedFileIndex >= 0
    ? historyLocatedFileIndex
    : lines.length > 0 && lines[lines.length - 1] === ""
    ? lines.length - 1
    : lines.length;

  spliceSeparatedBlock(
    lines,
    insertionIndex,
    [`<${referenceCatalogPath}/references.ttl> a sflo:LocatedFile, sflo:RdfDocument .`],
  );
}

function spliceSeparatedBlock(
  lines: string[],
  insertionIndex: number,
  blockLines: readonly string[],
): void {
  const entries = [...blockLines];

  if (insertionIndex > 0 && lines[insertionIndex - 1] !== "") {
    entries.unshift("");
  }
  if (insertionIndex < lines.length && lines[insertionIndex] !== "") {
    entries.push("");
  }

  lines.splice(insertionIndex, 0, ...entries);
}

function toKnopPath(designatorPath: string): string {
  return `${designatorPath}/_knop`;
}
