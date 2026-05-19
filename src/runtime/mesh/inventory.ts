import { Parser, type Quad } from "n3";
import * as pathPosix from "@std/path/posix";
import {
  toKnopPath,
  toReferenceCatalogPath,
} from "../../core/designator_segments.ts";
import { SFLO_NAMESPACE } from "../../core/rdf/namespaces.ts";

const RDF_TYPE_IRI = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type";
const SFLO_ARTIFACT_RESOLUTION_MODE_PINNED_IRI =
  `${SFLO_NAMESPACE}artifactResolutionMode_pinned`;
const SFLO_ARTIFACT_RESOLUTION_MODE_CURRENT_IRI =
  `${SFLO_NAMESPACE}artifactResolutionMode_current`;
const SFLO_ARTIFACT_RESOLUTION_MODE_WORKING_IRI =
  `${SFLO_NAMESPACE}artifactResolutionMode_working`;
const SFLO_ARTIFACT_RESOLUTION_MODE_LATEST_STATE_IRI =
  `${SFLO_NAMESPACE}artifactResolutionMode_latestState`;
const SFLO_EXTRACTION_SOURCE_IRI = `${SFLO_NAMESPACE}ExtractionSource`;
const SFLO_HAS_ARTIFACT_RESOLUTION_MODE_IRI =
  `${SFLO_NAMESPACE}hasArtifactResolutionMode`;
const SFLO_HAS_EXTRACTION_SOURCE_IRI = `${SFLO_NAMESPACE}hasExtractionSource`;
const SFLO_HAS_KNOP_SOURCE_REGISTRY_IRI =
  `${SFLO_NAMESPACE}hasKnopSourceRegistry`;
const SFLO_HAS_REQUESTED_TARGET_STATE_IRI =
  `${SFLO_NAMESPACE}hasRequestedTargetState`;
const SFLO_HAS_TARGET_ARTIFACT_IRI = `${SFLO_NAMESPACE}hasTargetArtifact`;
const SFLO_HAS_OBSERVED_SOURCE_LOCATED_FILE_IRI =
  `${SFLO_NAMESPACE}hasObservedSourceLocatedFile`;
const SFLO_OBSERVED_SOURCE_LOCAL_RELATIVE_PATH_IRI =
  `${SFLO_NAMESPACE}observedSourceLocalRelativePath`;
const SFLO_HAS_OBSERVED_SOURCE_MANIFESTATION_IRI =
  `${SFLO_NAMESPACE}hasObservedSourceManifestation`;
const SFLO_HAS_OBSERVED_SOURCE_STATE_IRI =
  `${SFLO_NAMESPACE}hasObservedSourceState`;
const SFLO_OBSERVED_SOURCE_DIGEST_IRI = `${SFLO_NAMESPACE}observedSourceDigest`;
const SFLO_OBSERVED_AT_IRI = `${SFLO_NAMESPACE}observedAt`;
const SFLO_ARTIFACT_HISTORY_IRI = `${SFLO_NAMESPACE}ArtifactHistory`;
const SFLO_CURRENT_ARTIFACT_HISTORY_IRI =
  `${SFLO_NAMESPACE}currentArtifactHistory`;
const SFLO_LOCATED_FILE_FOR_MANIFESTATION_IRI =
  `${SFLO_NAMESPACE}locatedFileForManifestation`;
const SFLO_HAS_MANIFESTATION_IRI = `${SFLO_NAMESPACE}hasManifestation`;
const SFLO_HAS_PAYLOAD_ARTIFACT_IRI = `${SFLO_NAMESPACE}hasPayloadArtifact`;
const SFLO_HAS_REFERENCE_CATALOG_IRI = `${SFLO_NAMESPACE}hasReferenceCatalog`;
const SFLO_HAS_WORKING_LOCATED_FILE_IRI =
  `${SFLO_NAMESPACE}hasWorkingLocatedFile`;
const SFLO_WORKING_FILE_PATH_IRI = `${SFLO_NAMESPACE}workingLocalRelativePath`;
const SFLO_KNOP_IRI = `${SFLO_NAMESPACE}Knop`;
const SFLO_LATEST_HISTORICAL_STATE_IRI =
  `${SFLO_NAMESPACE}latestHistoricalState`;
const SFLO_LOCATED_FILE_FOR_STATE_IRI = `${SFLO_NAMESPACE}locatedFileForState`;
const SFLO_REFERENCE_LINK_FOR_IRI = `${SFLO_NAMESPACE}referenceLinkFor`;
const SFLO_REFERENCE_LINK_IRI = `${SFLO_NAMESPACE}ReferenceLink`;
const SFLO_REFERENCE_TARGET_IRI = `${SFLO_NAMESPACE}referenceTarget`;
const SFLO_REFERENCE_TARGET_STATE_IRI = `${SFLO_NAMESPACE}referenceTargetState`;
const SFLO_HAS_KNOP_ASSET_BUNDLE_IRI = `${SFLO_NAMESPACE}hasKnopAssetBundle`;
const SFLO_HAS_RESOURCE_PAGE_DEFINITION_IRI =
  `${SFLO_NAMESPACE}hasResourcePageDefinition`;

export interface PayloadArtifactInventoryState {
  workingLocalRelativePath: string;
  workingLocatedFilePath?: string;
  currentArtifactHistoryPath?: string;
  currentArtifactHistoryExists: boolean;
  latestHistoricalStatePath?: string;
  latestHistoricalSnapshotPath?: string;
}

export interface ReferenceCatalogInventoryState {
  workingLocalRelativePath: string;
}

export interface ReferenceTargetLinkState {
  referenceTargetPath: string;
  referenceTargetStatePath: string;
}

export interface ExtractionSourceInventoryState {
  sourceArtifactPath: string;
  requestedTargetStatePath?: string;
  artifactResolutionModeIri: string;
  observedSourceStatePath?: string;
  observedSourceManifestationPath?: string;
  observedSourceLocatedFilePath?: string;
  observedSourceLocalRelativePath?: string;
  observedSourceDigest?: string;
  observedAt?: string;
}

export interface KnopSourceRegistryInventoryState {
  sourceRegistryPath: string;
  workingLocalRelativePath: string;
}

export interface ResourcePageDefinitionInventoryState {
  artifactPath: string;
  workingLocalRelativePath: string;
  currentArtifactHistoryPath?: string;
  currentArtifactHistoryExists: boolean;
  latestHistoricalStatePath?: string;
  assetBundlePath?: string;
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
    if (subjectPath === undefined) {
      continue;
    }
    if (subjectPath !== "_knop" && !subjectPath.endsWith("/_knop")) {
      continue;
    }

    designatorPaths.add(
      subjectPath === "_knop" ? "" : subjectPath.slice(0, -"/_knop".length),
    );
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
  const knopIri = toMeshIri(meshBase, toKnopPath(designatorPath));
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

  const workingLocalRelativePath = requireWorkingLocalRelativePath(
    quads,
    meshBase,
    payloadArtifactIri,
    messages.missingWorkingFileMessage,
  );
  const workingLocatedFilePath = resolveOptionalUniqueNamedNodePath(
    quads,
    meshBase,
    payloadArtifactIri,
    SFLO_HAS_WORKING_LOCATED_FILE_IRI,
    messages.parseErrorMessage,
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
  const latestHistoricalSnapshotPath = latestHistoricalStatePath
    ? resolveOptionalHistoricalStateLocatedFilePath(
      quads,
      meshBase,
      latestHistoricalStatePath,
      messages.parseErrorMessage,
    )
    : undefined;

  return {
    workingLocalRelativePath,
    ...(workingLocatedFilePath ? { workingLocatedFilePath } : {}),
    currentArtifactHistoryPath,
    currentArtifactHistoryExists,
    latestHistoricalStatePath,
    ...(latestHistoricalSnapshotPath ? { latestHistoricalSnapshotPath } : {}),
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
  const knopIri = toMeshIri(meshBase, toKnopPath(designatorPath));
  const referenceCatalogIri = toMeshIri(
    meshBase,
    toReferenceCatalogPath(designatorPath),
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
    workingLocalRelativePath: requireWorkingLocalRelativePath(
      quads,
      meshBase,
      referenceCatalogIri,
      messages.missingWorkingFileMessage,
    ),
  };
}

export function resolveExtractionSourceInventoryState(
  meshBase: string,
  inventoryTurtle: string,
  designatorPath: string,
  messages: {
    parseErrorMessage: string;
    missingExtractionSourceMessage: string;
    missingTargetArtifactMessage: string;
    missingRequestedTargetStateMessage: string;
    unsupportedResolutionModeMessage: string;
  },
  sourceRegistryTurtle?: string,
): ExtractionSourceInventoryState | undefined {
  const inventoryQuads = parseInventoryQuads(
    meshBase,
    inventoryTurtle,
    messages.parseErrorMessage,
  );
  const sourceRegistryQuads = sourceRegistryTurtle === undefined
    ? []
    : parseInventoryQuads(
      meshBase,
      sourceRegistryTurtle,
      messages.parseErrorMessage,
    );
  const knopIri = toMeshIri(meshBase, toKnopPath(designatorPath));
  const extractionSourceIri = resolveOptionalUniqueNamedNodeIri(
    inventoryQuads,
    knopIri,
    SFLO_HAS_EXTRACTION_SOURCE_IRI,
    messages.missingExtractionSourceMessage,
  );
  if (extractionSourceIri === undefined) {
    return undefined;
  }

  if (
    !hasNamedNodeObject(
      sourceRegistryQuads,
      extractionSourceIri,
      RDF_TYPE_IRI,
      SFLO_EXTRACTION_SOURCE_IRI,
    )
  ) {
    throw new Error(messages.missingExtractionSourceMessage);
  }

  const sourceArtifactPath = resolveOptionalUniqueNamedNodePath(
    sourceRegistryQuads,
    meshBase,
    extractionSourceIri,
    SFLO_HAS_TARGET_ARTIFACT_IRI,
    messages.missingTargetArtifactMessage,
  );
  if (!sourceArtifactPath) {
    throw new Error(messages.missingTargetArtifactMessage);
  }

  const requestedTargetStatePath = resolveOptionalUniqueNamedNodePath(
    sourceRegistryQuads,
    meshBase,
    extractionSourceIri,
    SFLO_HAS_REQUESTED_TARGET_STATE_IRI,
    messages.missingRequestedTargetStateMessage,
  );

  const artifactResolutionModeIri = resolveOptionalUniqueNamedNodeIri(
    sourceRegistryQuads,
    extractionSourceIri,
    SFLO_HAS_ARTIFACT_RESOLUTION_MODE_IRI,
    messages.unsupportedResolutionModeMessage,
  ) ?? (requestedTargetStatePath
    ? SFLO_ARTIFACT_RESOLUTION_MODE_PINNED_IRI
    : SFLO_ARTIFACT_RESOLUTION_MODE_WORKING_IRI);
  if (
    artifactResolutionModeIri !== SFLO_ARTIFACT_RESOLUTION_MODE_PINNED_IRI &&
    artifactResolutionModeIri !== SFLO_ARTIFACT_RESOLUTION_MODE_CURRENT_IRI &&
    artifactResolutionModeIri !== SFLO_ARTIFACT_RESOLUTION_MODE_WORKING_IRI &&
    artifactResolutionModeIri !== SFLO_ARTIFACT_RESOLUTION_MODE_LATEST_STATE_IRI
  ) {
    throw new Error(messages.unsupportedResolutionModeMessage);
  }
  if (
    artifactResolutionModeIri === SFLO_ARTIFACT_RESOLUTION_MODE_PINNED_IRI &&
    !requestedTargetStatePath
  ) {
    throw new Error(messages.missingRequestedTargetStateMessage);
  }

  return {
    sourceArtifactPath,
    ...(requestedTargetStatePath ? { requestedTargetStatePath } : {}),
    artifactResolutionModeIri,
    ...resolveExtractionSourceEvidenceState(
      sourceRegistryQuads,
      meshBase,
      extractionSourceIri,
      messages.parseErrorMessage,
    ),
  };
}

export function resolveKnopSourceRegistryInventoryState(
  meshBase: string,
  inventoryTurtle: string,
  designatorPath: string,
  messages: {
    parseErrorMessage: string;
    missingSourceRegistryMessage: string;
    missingWorkingFileMessage: string;
  },
): KnopSourceRegistryInventoryState | undefined {
  const quads = parseInventoryQuads(
    meshBase,
    inventoryTurtle,
    messages.parseErrorMessage,
  );
  const knopIri = toMeshIri(meshBase, toKnopPath(designatorPath));
  const sourceRegistryPath = resolveOptionalUniqueNamedNodePath(
    quads,
    meshBase,
    knopIri,
    SFLO_HAS_KNOP_SOURCE_REGISTRY_IRI,
    messages.missingSourceRegistryMessage,
  );
  if (sourceRegistryPath === undefined) {
    return undefined;
  }

  const workingLocalRelativePath = requireWorkingLocalRelativePath(
    quads,
    meshBase,
    toMeshIri(meshBase, sourceRegistryPath),
    messages.missingWorkingFileMessage,
  );

  return { sourceRegistryPath, workingLocalRelativePath };
}

function resolveExtractionSourceEvidenceState(
  quads: readonly Quad[],
  meshBase: string,
  extractionSourceIri: string,
  errorMessage: string,
): Omit<
  ExtractionSourceInventoryState,
  | "sourceArtifactPath"
  | "requestedTargetStatePath"
  | "artifactResolutionModeIri"
> {
  const observedSourceStatePath = resolveOptionalUniqueNamedNodePath(
    quads,
    meshBase,
    extractionSourceIri,
    SFLO_HAS_OBSERVED_SOURCE_STATE_IRI,
    errorMessage,
  );
  const observedSourceManifestationPath = resolveOptionalUniqueNamedNodePath(
    quads,
    meshBase,
    extractionSourceIri,
    SFLO_HAS_OBSERVED_SOURCE_MANIFESTATION_IRI,
    errorMessage,
  );
  const observedSourceLocatedFilePath = resolveOptionalUniqueNamedNodePath(
    quads,
    meshBase,
    extractionSourceIri,
    SFLO_HAS_OBSERVED_SOURCE_LOCATED_FILE_IRI,
    errorMessage,
  );
  const observedSourceLocalRelativePath = resolveOptionalUniqueLiteral(
    quads,
    extractionSourceIri,
    SFLO_OBSERVED_SOURCE_LOCAL_RELATIVE_PATH_IRI,
    errorMessage,
  );
  const observedSourceDigest = resolveOptionalUniqueLiteral(
    quads,
    extractionSourceIri,
    SFLO_OBSERVED_SOURCE_DIGEST_IRI,
    errorMessage,
  );
  const observedAt = resolveOptionalUniqueLiteral(
    quads,
    extractionSourceIri,
    SFLO_OBSERVED_AT_IRI,
    errorMessage,
  );

  return {
    ...(observedSourceStatePath ? { observedSourceStatePath } : {}),
    ...(observedSourceManifestationPath
      ? { observedSourceManifestationPath }
      : {}),
    ...(observedSourceLocatedFilePath ? { observedSourceLocatedFilePath } : {}),
    ...(observedSourceLocalRelativePath
      ? { observedSourceLocalRelativePath }
      : {}),
    ...(observedSourceDigest ? { observedSourceDigest } : {}),
    ...(observedAt ? { observedAt } : {}),
  };
}

export function resolveResourcePageDefinitionInventoryState(
  meshBase: string,
  inventoryTurtle: string,
  designatorPath: string,
  messages: {
    parseErrorMessage: string;
    missingWorkingFileMessage: string;
  },
): ResourcePageDefinitionInventoryState | undefined {
  const quads = parseInventoryQuads(
    meshBase,
    inventoryTurtle,
    messages.parseErrorMessage,
  );
  const knopIri = toMeshIri(meshBase, toKnopPath(designatorPath));
  const artifactPath = resolveOptionalUniqueNamedNodePath(
    quads,
    meshBase,
    knopIri,
    SFLO_HAS_RESOURCE_PAGE_DEFINITION_IRI,
    messages.parseErrorMessage,
  );

  if (!artifactPath) {
    return undefined;
  }

  const artifactIri = toMeshIri(meshBase, artifactPath);
  const workingLocalRelativePath = requireWorkingLocalRelativePath(
    quads,
    meshBase,
    artifactIri,
    messages.missingWorkingFileMessage,
  );
  const currentArtifactHistoryPath = resolveOptionalUniqueNamedNodePath(
    quads,
    meshBase,
    artifactIri,
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
  const assetBundlePath = resolveOptionalUniqueNamedNodePath(
    quads,
    meshBase,
    knopIri,
    SFLO_HAS_KNOP_ASSET_BUNDLE_IRI,
    messages.parseErrorMessage,
  );

  return {
    artifactPath,
    workingLocalRelativePath,
    currentArtifactHistoryPath,
    currentArtifactHistoryExists,
    latestHistoricalStatePath,
    assetBundlePath,
  };
}

export function resolveHistoricalStateLocatedFilePath(
  meshBase: string,
  inventoryTurtle: string,
  statePath: string,
  parseErrorMessage: string,
): string | undefined {
  return resolveOptionalHistoricalStateLocatedFilePath(
    parseInventoryQuads(meshBase, inventoryTurtle, parseErrorMessage),
    meshBase,
    statePath,
    parseErrorMessage,
  );
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
  return resolveReferenceTargetLinkState(
    meshBase,
    referenceCatalogTurtle,
    designatorPath,
    messages,
  ).referenceTargetPath;
}

export function resolveReferenceTargetLinkState(
  meshBase: string,
  referenceCatalogTurtle: string,
  designatorPath: string,
  messages: {
    parseErrorMessage: string;
    missingReferenceLinkMessage: string;
    missingReferenceTargetMessage: string;
  },
): ReferenceTargetLinkState {
  const referenceTargetLinkState = tryResolveReferenceTargetLinkState(
    meshBase,
    referenceCatalogTurtle,
    designatorPath,
    messages,
  );
  if (!referenceTargetLinkState) {
    throw new Error(messages.missingReferenceLinkMessage);
  }

  return referenceTargetLinkState;
}

export function tryResolveReferenceTargetLinkState(
  meshBase: string,
  referenceCatalogTurtle: string,
  designatorPath: string,
  messages: {
    parseErrorMessage: string;
    missingReferenceLinkMessage: string;
    missingReferenceTargetMessage: string;
  },
): ReferenceTargetLinkState | undefined {
  const quads = parseInventoryQuads(
    meshBase,
    referenceCatalogTurtle,
    messages.parseErrorMessage,
  );
  const linkSubjectPrefix = `${
    toMeshIri(meshBase, toReferenceCatalogPath(designatorPath))
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
    if (
      !hasNamedNodeObject(
        quads,
        subjectIri,
        RDF_TYPE_IRI,
        SFLO_REFERENCE_LINK_IRI,
      )
    ) {
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
    return undefined;
  }

  const referenceTargetPaths = new Set<string>();
  const referenceTargetStatePaths = new Set<string>();
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

  for (const subjectIri of linkSubjects) {
    const referenceTargetStatePath = resolveOptionalUniqueNamedNodePath(
      quads,
      meshBase,
      subjectIri,
      SFLO_REFERENCE_TARGET_STATE_IRI,
      messages.missingReferenceLinkMessage,
    );
    if (referenceTargetStatePath) {
      referenceTargetStatePaths.add(referenceTargetStatePath);
    }
  }

  if (referenceTargetPaths.size !== 1) {
    throw new Error(messages.missingReferenceTargetMessage);
  }
  if (referenceTargetStatePaths.size !== 1) {
    throw new Error(messages.missingReferenceLinkMessage);
  }

  return {
    referenceTargetPath: referenceTargetPaths.values().next().value!,
    referenceTargetStatePath: referenceTargetStatePaths.values().next().value!,
  };
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

function requireWorkingLocalRelativePath(
  quads: readonly Quad[],
  meshBase: string,
  subjectIri: string,
  errorMessage: string,
): string {
  const literalWorkingLocalRelativePath =
    resolveOptionalUniqueLiteralWorkingLocalRelativePath(
      quads,
      subjectIri,
      SFLO_WORKING_FILE_PATH_IRI,
      errorMessage,
    );
  const locatedWorkingLocalRelativePath = resolveOptionalUniqueNamedNodePath(
    quads,
    meshBase,
    subjectIri,
    SFLO_HAS_WORKING_LOCATED_FILE_IRI,
    errorMessage,
  );

  if (
    literalWorkingLocalRelativePath !== undefined &&
    locatedWorkingLocalRelativePath !== undefined &&
    literalWorkingLocalRelativePath !== locatedWorkingLocalRelativePath
  ) {
    throw new Error(errorMessage);
  }

  if (literalWorkingLocalRelativePath !== undefined) {
    return literalWorkingLocalRelativePath;
  }
  if (locatedWorkingLocalRelativePath !== undefined) {
    return locatedWorkingLocalRelativePath;
  }

  throw new Error(errorMessage);
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

function resolveOptionalUniqueNamedNodeIri(
  quads: readonly Quad[],
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

    values.add(quad.object.value);
  }

  if (values.size === 0) {
    return undefined;
  }
  if (values.size !== 1) {
    throw new Error(errorMessage);
  }

  return values.values().next().value!;
}

function resolveOptionalUniqueLiteral(
  quads: readonly Quad[],
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
      quad.object.termType !== "Literal"
    ) {
      continue;
    }

    values.add(quad.object.value);
  }

  if (values.size === 0) {
    return undefined;
  }
  if (values.size !== 1) {
    throw new Error(errorMessage);
  }

  return values.values().next().value!;
}

function resolveOptionalHistoricalStateLocatedFilePath(
  quads: readonly Quad[],
  meshBase: string,
  statePath: string,
  errorMessage: string,
): string | undefined {
  const stateIri = toMeshIri(meshBase, statePath);
  const shortcutLocatedFilePath = resolveOptionalUniqueNamedNodePath(
    quads,
    meshBase,
    stateIri,
    SFLO_LOCATED_FILE_FOR_STATE_IRI,
    errorMessage,
  );
  const manifestationPath = resolveOptionalUniqueNamedNodePath(
    quads,
    meshBase,
    stateIri,
    SFLO_HAS_MANIFESTATION_IRI,
    errorMessage,
  );
  const manifestationLocatedFilePath = manifestationPath
    ? resolveOptionalUniqueNamedNodePath(
      quads,
      meshBase,
      toMeshIri(meshBase, manifestationPath),
      SFLO_LOCATED_FILE_FOR_MANIFESTATION_IRI,
      errorMessage,
    )
    : undefined;

  if (
    shortcutLocatedFilePath !== undefined &&
    manifestationLocatedFilePath !== undefined &&
    shortcutLocatedFilePath !== manifestationLocatedFilePath
  ) {
    throw new Error(errorMessage);
  }

  return shortcutLocatedFilePath ?? manifestationLocatedFilePath;
}

function resolveOptionalUniqueLiteralWorkingLocalRelativePath(
  quads: readonly Quad[],
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
      quad.object.termType !== "Literal"
    ) {
      continue;
    }

    values.add(
      normalizeWorkingLocalRelativePath(quad.object.value, errorMessage),
    );
  }

  if (values.size === 0) {
    return undefined;
  }
  if (values.size !== 1) {
    throw new Error(errorMessage);
  }

  return values.values().next().value!;
}

function normalizeWorkingLocalRelativePath(
  value: string,
  errorMessage: string,
): string {
  const trimmed = value.trim();

  if (
    trimmed.length === 0 ||
    trimmed.startsWith("/") ||
    trimmed.endsWith("/") ||
    /^[A-Za-z]:/.test(trimmed)
  ) {
    throw new Error(errorMessage);
  }
  if (
    trimmed.includes("\\") ||
    trimmed.includes("?") ||
    trimmed.includes("#") ||
    /\s/.test(trimmed)
  ) {
    throw new Error(errorMessage);
  }

  const normalized = pathPosix.normalize(trimmed);
  if (normalized === "." || normalized === "..") {
    throw new Error(errorMessage);
  }
  const segments = normalized.split("/");
  if (segments.some((segment) => segment.length === 0)) {
    throw new Error(errorMessage);
  }

  return normalized;
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
  if (meshPath === undefined) {
    throw new Error(errorMessage);
  }
  return meshPath;
}

function tryToMeshPath(meshBase: string, iri: string): string | undefined {
  if (!iri.startsWith(meshBase)) {
    return undefined;
  }

  const meshPath = iri.slice(meshBase.length);
  if (meshPath.includes("#") || meshPath.includes("?")) {
    return undefined;
  }

  return meshPath;
}
