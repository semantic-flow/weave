import { Parser, type Quad } from "n3";

const RDF_TYPE_IRI = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type";
const SFLO_NAMESPACE =
  "https://semantic-flow.github.io/semantic-flow-ontology/";
const SFLO_ARTIFACT_HISTORY_IRI = `${SFLO_NAMESPACE}ArtifactHistory`;
const SFLO_CURRENT_ARTIFACT_HISTORY_IRI =
  `${SFLO_NAMESPACE}currentArtifactHistory`;
const SFLO_HAS_PAYLOAD_ARTIFACT_IRI = `${SFLO_NAMESPACE}hasPayloadArtifact`;
const SFLO_HAS_REFERENCE_CATALOG_IRI = `${SFLO_NAMESPACE}hasReferenceCatalog`;
const SFLO_HAS_WORKING_LOCATED_FILE_IRI =
  `${SFLO_NAMESPACE}hasWorkingLocatedFile`;
const SFLO_KNOP_IRI = `${SFLO_NAMESPACE}Knop`;
const SFLO_LATEST_HISTORICAL_STATE_IRI =
  `${SFLO_NAMESPACE}latestHistoricalState`;
const SFLO_REFERENCE_LINK_FOR_IRI = `${SFLO_NAMESPACE}referenceLinkFor`;
const SFLO_REFERENCE_LINK_IRI = `${SFLO_NAMESPACE}ReferenceLink`;
const SFLO_REFERENCE_TARGET_IRI = `${SFLO_NAMESPACE}referenceTarget`;
const SFLO_REFERENCE_TARGET_STATE_IRI =
  `${SFLO_NAMESPACE}referenceTargetState`;

export interface PayloadArtifactInventoryState {
  workingFilePath: string;
  currentArtifactHistoryPath?: string;
  currentArtifactHistoryExists: boolean;
  latestHistoricalStatePath?: string;
}

export interface ReferenceCatalogInventoryState {
  workingFilePath: string;
}

export function listKnopDesignatorPaths(
  meshBase: string,
  inventoryTurtle: string,
  parseErrorMessage: string,
): readonly string[] {
  const quads = parseInventoryQuads(
    meshBase,
    inventoryTurtle,
    parseErrorMessage,
  );
  const designatorPaths = new Set<string>();

  for (const quad of quads) {
    if (
      quad.subject.termType !== "NamedNode" ||
      quad.predicate.value !== RDF_TYPE_IRI ||
      quad.object.termType !== "NamedNode" ||
      quad.object.value !== SFLO_KNOP_IRI
    ) {
      continue;
    }

    const subjectPath = tryToMeshPath(meshBase, quad.subject.value);
    if (!subjectPath?.endsWith("/_knop")) {
      continue;
    }

    const designatorPath = subjectPath.slice(0, -"/_knop".length);
    if (designatorPath.length === 0) {
      continue;
    }

    designatorPaths.add(designatorPath);
  }

  return [...designatorPaths].sort((left, right) => left.localeCompare(right));
}

export function resolvePayloadArtifactInventoryState(
  meshBase: string,
  inventoryTurtle: string,
  designatorPath: string,
  messages: {
    parseErrorMessage: string;
    missingWorkingFileMessage: string;
  },
): PayloadArtifactInventoryState | undefined {
  const quads = parseInventoryQuads(
    meshBase,
    inventoryTurtle,
    messages.parseErrorMessage,
  );
  const knopIri = toMeshIri(meshBase, `${designatorPath}/_knop`);
  const payloadArtifactIri = toMeshIri(meshBase, designatorPath);

  if (
    !hasNamedNodeObject(
      quads,
      knopIri,
      SFLO_HAS_PAYLOAD_ARTIFACT_IRI,
      payloadArtifactIri,
    )
  ) {
    return undefined;
  }

  const workingFilePath = requireUniqueNamedNodePath(
    quads,
    meshBase,
    payloadArtifactIri,
    SFLO_HAS_WORKING_LOCATED_FILE_IRI,
    messages.missingWorkingFileMessage,
  );
  const currentArtifactHistoryPath = resolveOptionalUniqueNamedNodePath(
    quads,
    meshBase,
    payloadArtifactIri,
    SFLO_CURRENT_ARTIFACT_HISTORY_IRI,
    messages.parseErrorMessage,
  );
  const currentArtifactHistoryExists = currentArtifactHistoryPath
    ? hasNamedNodeObject(
      quads,
      toMeshIri(meshBase, currentArtifactHistoryPath),
      RDF_TYPE_IRI,
      SFLO_ARTIFACT_HISTORY_IRI,
    )
    : false;
  const latestHistoricalStatePath =
    currentArtifactHistoryPath && currentArtifactHistoryExists
      ? resolveOptionalUniqueNamedNodePath(
        quads,
        meshBase,
        toMeshIri(meshBase, currentArtifactHistoryPath),
        SFLO_LATEST_HISTORICAL_STATE_IRI,
        messages.parseErrorMessage,
      )
      : undefined;

  return {
    workingFilePath,
    currentArtifactHistoryPath,
    currentArtifactHistoryExists,
    latestHistoricalStatePath,
  };
}

export function resolveReferenceCatalogInventoryState(
  meshBase: string,
  inventoryTurtle: string,
  designatorPath: string,
  messages: {
    parseErrorMessage: string;
    missingWorkingFileMessage: string;
  },
): ReferenceCatalogInventoryState | undefined {
  const quads = parseInventoryQuads(
    meshBase,
    inventoryTurtle,
    messages.parseErrorMessage,
  );
  const knopIri = toMeshIri(meshBase, `${designatorPath}/_knop`);
  const referenceCatalogIri = toMeshIri(
    meshBase,
    `${designatorPath}/_knop/_references`,
  );

  if (
    !hasNamedNodeObject(
      quads,
      knopIri,
      SFLO_HAS_REFERENCE_CATALOG_IRI,
      referenceCatalogIri,
    )
  ) {
    return undefined;
  }

  return {
    workingFilePath: requireUniqueNamedNodePath(
      quads,
      meshBase,
      referenceCatalogIri,
      SFLO_HAS_WORKING_LOCATED_FILE_IRI,
      messages.missingWorkingFileMessage,
    ),
  };
}

export function resolveReferenceTargetDesignatorPath(
  meshBase: string,
  referenceCatalogTurtle: string,
  designatorPath: string,
  messages: {
    parseErrorMessage: string;
    missingReferenceLinkMessage: string;
    missingReferenceTargetMessage: string;
  },
): string {
  const quads = parseInventoryQuads(
    meshBase,
    referenceCatalogTurtle,
    messages.parseErrorMessage,
  );
  const linkSubjectPrefix = `${
    toMeshIri(meshBase, `${designatorPath}/_knop/_references`)
  }#`;
  const designatorIri = toMeshIri(meshBase, designatorPath);
  const linkSubjects = new Set<string>();

  for (const quad of quads) {
    if (quad.subject.termType !== "NamedNode") {
      continue;
    }

    const subjectIri = quad.subject.value;
    if (!subjectIri.startsWith(linkSubjectPrefix)) {
      continue;
    }
    if (!hasNamedNodeObject(quads, subjectIri, RDF_TYPE_IRI, SFLO_REFERENCE_LINK_IRI)) {
      continue;
    }
    if (
      !hasNamedNodeObject(
        quads,
        subjectIri,
        SFLO_REFERENCE_LINK_FOR_IRI,
        designatorIri,
      )
    ) {
      continue;
    }
    if (
      !resolveOptionalUniqueNamedNodePath(
        quads,
        meshBase,
        subjectIri,
        SFLO_REFERENCE_TARGET_STATE_IRI,
        messages.missingReferenceLinkMessage,
      )
    ) {
      continue;
    }

    linkSubjects.add(subjectIri);
  }

  if (linkSubjects.size === 0) {
    throw new Error(messages.missingReferenceLinkMessage);
  }

  const referenceTargetPaths = new Set<string>();
  for (const quad of quads) {
    if (
      quad.subject.termType !== "NamedNode" ||
      !linkSubjects.has(quad.subject.value) ||
      quad.predicate.value !== SFLO_REFERENCE_TARGET_IRI ||
      quad.object.termType !== "NamedNode"
    ) {
      continue;
    }

    referenceTargetPaths.add(
      requireMeshPath(
        meshBase,
        quad.object.value,
        messages.missingReferenceTargetMessage,
      ),
    );
  }

  if (referenceTargetPaths.size !== 1) {
    throw new Error(messages.missingReferenceTargetMessage);
  }

  return referenceTargetPaths.values().next().value!;
}

function parseInventoryQuads(
  meshBase: string,
  inventoryTurtle: string,
  parseErrorMessage: string,
): readonly Quad[] {
  try {
    return new Parser({ baseIRI: meshBase }).parse(inventoryTurtle);
  } catch {
    throw new Error(parseErrorMessage);
  }
}

function hasNamedNodeObject(
  quads: readonly Quad[],
  subjectIri: string,
  predicateIri: string,
  objectIri: string,
): boolean {
  return quads.some((quad) =>
    quad.subject.termType === "NamedNode" &&
    quad.subject.value === subjectIri &&
    quad.predicate.value === predicateIri &&
    quad.object.termType === "NamedNode" &&
    quad.object.value === objectIri
  );
}

function requireUniqueNamedNodePath(
  quads: readonly Quad[],
  meshBase: string,
  subjectIri: string,
  predicateIri: string,
  errorMessage: string,
): string {
  const value = resolveOptionalUniqueNamedNodePath(
    quads,
    meshBase,
    subjectIri,
    predicateIri,
    errorMessage,
  );

  if (!value) {
    throw new Error(errorMessage);
  }

  return value;
}

function resolveOptionalUniqueNamedNodePath(
  quads: readonly Quad[],
  meshBase: string,
  subjectIri: string,
  predicateIri: string,
  errorMessage: string,
): string | undefined {
  const values = new Set<string>();

  for (const quad of quads) {
    if (
      quad.subject.termType !== "NamedNode" ||
      quad.subject.value !== subjectIri ||
      quad.predicate.value !== predicateIri ||
      quad.object.termType !== "NamedNode"
    ) {
      continue;
    }

    values.add(requireMeshPath(meshBase, quad.object.value, errorMessage));
  }

  if (values.size === 0) {
    return undefined;
  }
  if (values.size !== 1) {
    throw new Error(errorMessage);
  }

  return values.values().next().value!;
}

function toMeshIri(meshBase: string, meshPath: string): string {
  return new URL(meshPath, meshBase).href;
}

function requireMeshPath(
  meshBase: string,
  iri: string,
  errorMessage: string,
): string {
  const meshPath = tryToMeshPath(meshBase, iri);
  if (!meshPath) {
    throw new Error(errorMessage);
  }
  return meshPath;
}

function tryToMeshPath(meshBase: string, iri: string): string | undefined {
  if (!iri.startsWith(meshBase)) {
    return undefined;
  }

  const meshPath = iri.slice(meshBase.length);
  if (
    meshPath.length === 0 ||
    meshPath.includes("#") ||
    meshPath.includes("?")
  ) {
    return undefined;
  }

  return meshPath;
}
