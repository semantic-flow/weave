import type { PlannedFile } from "../planned_file.ts";

const reservedDesignatorSegments = new Set(["_knop", "_mesh"]);

export interface KnopCreateRequest {
  designatorPath: string;
}

export interface ResolvedKnopCreateRequest extends KnopCreateRequest {
  meshBase: string;
  currentMeshInventoryTurtle: string;
}

export interface KnopCreatePlan {
  meshBase: string;
  designatorPath: string;
  knopIri: string;
  createdFiles: readonly PlannedFile[];
  updatedFiles: readonly PlannedFile[];
}

export class KnopCreateInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "KnopCreateInputError";
  }
}

export function planKnopCreate(
  request: ResolvedKnopCreateRequest,
): KnopCreatePlan {
  const meshBase = normalizeMeshBase(request.meshBase);
  const designatorPath = normalizeDesignatorPath(request.designatorPath);
  const knopPath = toKnopPath(designatorPath);
  const knopInventoryPath = `${knopPath}/_inventory/inventory.ttl`;
  const updatedMeshInventoryTurtle = renderUpdatedMeshInventoryTurtle(
    request.currentMeshInventoryTurtle,
    knopPath,
  );

  return {
    meshBase,
    designatorPath,
    knopIri: new URL(knopPath, meshBase).href,
    createdFiles: [
      {
        path: `${knopPath}/_meta/meta.ttl`,
        contents: renderKnopMetadataTurtle(meshBase, designatorPath),
      },
      {
        path: knopInventoryPath,
        contents: renderKnopInventoryTurtle(meshBase, knopPath),
      },
    ],
    updatedFiles: [
      {
        path: "_mesh/_inventory/inventory.ttl",
        contents: updatedMeshInventoryTurtle,
      },
    ],
  };
}

function normalizeMeshBase(meshBase: string): string {
  const trimmed = meshBase.trim();
  if (trimmed.length === 0) {
    throw new KnopCreateInputError("meshBase is required");
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new KnopCreateInputError("meshBase must be an absolute IRI");
  }

  if (!url.pathname.endsWith("/")) {
    throw new KnopCreateInputError("meshBase must end with '/'");
  }
  if (url.search.length > 0 || url.hash.length > 0) {
    throw new KnopCreateInputError(
      "meshBase must not include a query or fragment",
    );
  }

  return url.href;
}

function normalizeDesignatorPath(designatorPath: string): string {
  const trimmed = designatorPath.trim();
  if (trimmed.length === 0) {
    throw new KnopCreateInputError("designatorPath is required");
  }
  if (trimmed.startsWith("/") || trimmed.endsWith("/")) {
    throw new KnopCreateInputError(
      "designatorPath must not start or end with '/'",
    );
  }
  if (
    trimmed.includes("\\") || trimmed.includes("?") || trimmed.includes("#")
  ) {
    throw new KnopCreateInputError(
      "designatorPath contains unsupported path characters",
    );
  }

  const segments = trimmed.split("/");
  if (segments.some((segment) => segment.length === 0)) {
    throw new KnopCreateInputError(
      "designatorPath must not contain empty path segments",
    );
  }
  if (segments.some((segment) => segment === "." || segment === "..")) {
    throw new KnopCreateInputError(
      "designatorPath must not contain '.' or '..' path segments",
    );
  }
  if (segments.some((segment) => reservedDesignatorSegments.has(segment))) {
    throw new KnopCreateInputError(
      "designatorPath must not contain reserved path segments",
    );
  }

  return trimmed;
}

function renderKnopMetadataTurtle(
  meshBase: string,
  designatorPath: string,
): string {
  const knopPath = toKnopPath(designatorPath);
  return `@base <${meshBase}> .
@prefix sflo: <https://semantic-flow.github.io/semantic-flow-ontology/> .

<${knopPath}> a sflo:Knop ;
  sflo:designatorPath "${designatorPath}" ;
  sflo:hasWorkingKnopInventoryFile <${knopPath}/_inventory/inventory.ttl> .
`;
}

function renderKnopInventoryTurtle(
  meshBase: string,
  knopPath: string,
): string {
  return `@base <${meshBase}> .
@prefix sflo: <https://semantic-flow.github.io/semantic-flow-ontology/> .

<${knopPath}> a sflo:Knop ;
  sflo:hasKnopMetadata <${knopPath}/_meta> ;
  sflo:hasKnopInventory <${knopPath}/_inventory> ;
  sflo:hasWorkingKnopInventoryFile <${knopPath}/_inventory/inventory.ttl> .

<${knopPath}/_meta> a sflo:KnopMetadata, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasWorkingLocatedFile <${knopPath}/_meta/meta.ttl> .

<${knopPath}/_inventory> a sflo:KnopInventory, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasWorkingLocatedFile <${knopPath}/_inventory/inventory.ttl> .

<${knopPath}/_meta/meta.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<${knopPath}/_inventory/inventory.ttl> a sflo:LocatedFile, sflo:RdfDocument .
`;
}

function renderUpdatedMeshInventoryTurtle(
  currentMeshInventoryTurtle: string,
  knopPath: string,
): string {
  if (currentMeshInventoryTurtle.includes(`<${knopPath}> a sflo:Knop ;`)) {
    throw new KnopCreateInputError(
      `mesh inventory already registers knop: ${knopPath}`,
    );
  }

  const knopInventoryPath = `${knopPath}/_inventory/inventory.ttl`;
  const lines = currentMeshInventoryTurtle.split("\n");

  insertKnopIntoMeshBlock(lines, knopPath);
  insertKnopBlock(lines, knopPath, knopInventoryPath);
  insertKnopInventoryLocatedFile(lines, knopInventoryPath);

  return lines.join("\n");
}

function insertKnopIntoMeshBlock(lines: string[], knopPath: string): void {
  const meshLineIndex = lines.indexOf("<_mesh> a sflo:SemanticMesh ;");
  if (meshLineIndex === -1) {
    throw new KnopCreateInputError(
      "current mesh inventory is missing the _mesh block",
    );
  }

  let lastPredicateIndex = meshLineIndex + 1;
  while (
    lastPredicateIndex < lines.length &&
    lines[lastPredicateIndex].startsWith("  ")
  ) {
    lastPredicateIndex += 1;
  }
  lastPredicateIndex -= 1;

  if (lastPredicateIndex <= meshLineIndex) {
    throw new KnopCreateInputError(
      "current mesh inventory has an invalid _mesh block",
    );
  }

  const lastPredicateLine = lines[lastPredicateIndex];
  if (lastPredicateLine.includes(`sflo:hasKnop <${knopPath}>`)) {
    throw new KnopCreateInputError(
      `mesh inventory already registers knop: ${knopPath}`,
    );
  }

  if (lastPredicateLine.includes("sflo:hasResourcePage")) {
    lines.splice(lastPredicateIndex, 0, `  sflo:hasKnop <${knopPath}> ;`);
    return;
  }

  lines[lastPredicateIndex] = lastPredicateLine.replace(/\.\s*$/, " ;");
  lines.splice(lastPredicateIndex + 1, 0, `  sflo:hasKnop <${knopPath}> .`);
}

function insertKnopBlock(
  lines: string[],
  knopPath: string,
  knopInventoryPath: string,
): void {
  const meshMetadataIndex = lines.indexOf(
    "<_mesh/_meta> a sflo:MeshMetadata, sflo:DigitalArtifact, sflo:RdfDocument ;",
  );
  if (meshMetadataIndex === -1) {
    throw new KnopCreateInputError(
      "current mesh inventory is missing the mesh metadata block",
    );
  }

  lines.splice(
    meshMetadataIndex,
    0,
    `<${knopPath}> a sflo:Knop ;`,
    `  sflo:hasWorkingKnopInventoryFile <${knopInventoryPath}> .`,
    "",
  );
}

function insertKnopInventoryLocatedFile(
  lines: string[],
  knopInventoryPath: string,
): void {
  const resourcePageIndex = lines.indexOf(
    "<_mesh/index.html> a sflo:ResourcePage, sflo:LocatedFile .",
  );
  if (resourcePageIndex !== -1) {
    lines.splice(
      resourcePageIndex,
      0,
      `<${knopInventoryPath}> a sflo:LocatedFile, sflo:RdfDocument .`,
      "",
    );
    return;
  }

  const lastLocatedFileIndex = findLastIndex(
    lines,
    (line) => line.endsWith("a sflo:LocatedFile, sflo:RdfDocument ."),
  );
  if (lastLocatedFileIndex === -1) {
    throw new KnopCreateInputError(
      "current mesh inventory is missing the located file declarations",
    );
  }

  lines.splice(
    lastLocatedFileIndex + 1,
    0,
    "",
    `<${knopInventoryPath}> a sflo:LocatedFile, sflo:RdfDocument .`,
  );
}

function findLastIndex<T>(
  values: readonly T[],
  predicate: (value: T) => boolean,
): number {
  for (let index = values.length - 1; index >= 0; index -= 1) {
    if (predicate(values[index]!)) {
      return index;
    }
  }
  return -1;
}

function toKnopPath(designatorPath: string): string {
  return `${designatorPath}/_knop`;
}
