import { Parser, type Quad } from "n3";
import * as pathPosix from "@std/path/posix";
import {
  toKnopPath,
  toReferenceCatalogPath,
} from "../../core/designator_segments.ts";
import { SFLO_NAMESPACE } from "../../core/rdf/namespaces.ts";
import type {
  ArtifactResolutionObservedCoordinates,
  ArtifactResolutionRequest,
} from "../artifact_resolution/models.ts";

const RDF_TYPE_IRI = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type";
const SFLO_ARTIFACT_RESOLUTION_MODE_WORKING_IRI =
  `${SFLO_NAMESPACE}artifactResolutionMode_working`;
const SFLO_ARTIFACT_RESOLUTION_MODE_LATEST_STATE_IRI =
  `${SFLO_NAMESPACE}artifactResolutionMode_latestState`;
const SFLO_EXTRACTION_SOURCE_IRI = `${SFLO_NAMESPACE}ExtractionSource`;
const SFLO_IMPORT_SOURCE_IRI = `${SFLO_NAMESPACE}ImportSource`;
const SFLO_INTEGRATION_SOURCE_IRI = `${SFLO_NAMESPACE}IntegrationSource`;
const SFLO_HAS_ARTIFACT_RESOLUTION_MODE_IRI =
  `${SFLO_NAMESPACE}hasArtifactResolutionMode`;
const SFLO_HAS_EXTRACTION_SOURCE_IRI = `${SFLO_NAMESPACE}hasExtractionSource`;
const SFLO_HAS_KNOP_SOURCE_REGISTRY_IRI =
  `${SFLO_NAMESPACE}hasKnopSourceRegistry`;
const SFLO_HAS_SOURCE_BINDING_IRI = `${SFLO_NAMESPACE}hasSourceBinding`;
const SFLO_TARGET_HISTORICAL_STATE_IRI =
  `${SFLO_NAMESPACE}targetHistoricalState`;
const SFLO_TARGET_ARTIFACT_IRI = `${SFLO_NAMESPACE}targetArtifact`;
const SFLO_TARGET_REPOSITORY_SOURCE_IRI =
  `${SFLO_NAMESPACE}targetRepositorySource`;
const SFLO_TARGET_LOCATED_FILE_IRI = `${SFLO_NAMESPACE}targetLocatedFile`;
const SFLO_TARGET_LOCAL_RELATIVE_PATH_IRI =
  `${SFLO_NAMESPACE}targetLocalRelativePath`;
const SFLO_TARGET_MANIFESTATION_IRI = `${SFLO_NAMESPACE}targetManifestation`;
const SFLO_TARGET_ACCESS_URL_IRI = `${SFLO_NAMESPACE}targetAccessUrl`;
const SFLO_EXPECTS_CONTENT_DIGEST_IRI = `${SFLO_NAMESPACE}expectsContentDigest`;
const SFLO_OBSERVED_ARTIFACT_RESOLUTION_SPEC_IRI =
  `${SFLO_NAMESPACE}observedArtifactResolutionSpec`;
const SFLO_OBSERVED_CONTENT_DIGEST_IRI =
  `${SFLO_NAMESPACE}observedContentDigest`;
const SFLO_OBSERVED_AT_IRI = `${SFLO_NAMESPACE}observedAt`;
const SFLO_HAS_RESOLUTION_OBSERVATION_IRI =
  `${SFLO_NAMESPACE}hasResolutionObservation`;
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
const SFLO_HAS_REPOSITORY_SOURCE_FLOATING_LOCATOR_IRI =
  `${SFLO_NAMESPACE}hasRepositorySourceFloatingLocator`;
const SFLO_SOURCE_REPOSITORY_URL_IRI = `${SFLO_NAMESPACE}sourceRepositoryUrl`;
const SFLO_SOURCE_REPOSITORY_REF_IRI = `${SFLO_NAMESPACE}sourceRepositoryRef`;
const SFLO_SOURCE_REPOSITORY_COMMIT_IRI =
  `${SFLO_NAMESPACE}sourceRepositoryCommit`;
const SFLO_SOURCE_REPOSITORY_PATH_IRI = `${SFLO_NAMESPACE}sourceRepositoryPath`;
const SFLO_SOURCE_REPOSITORY_PATH_FROM_ROOT_IRI =
  `${SFLO_NAMESPACE}sourceRepositoryPathFromRoot`;
const SFLO_HAS_CONTENT_DIGEST_IRI = `${SFLO_NAMESPACE}hasContentDigest`;
const SFLO_WORKING_FILE_PATH_IRI = `${SFLO_NAMESPACE}workingLocalRelativePath`;
const SFLO_WORKING_ACCESS_URL_IRI = `${SFLO_NAMESPACE}workingAccessUrl`;
const SFLO_KNOP_IRI = `${SFLO_NAMESPACE}Knop`;
const SFLO_LATEST_HISTORICAL_STATE_IRI =
  `${SFLO_NAMESPACE}latestHistoricalState`;
const SFLO_LOCATED_FILE_FOR_STATE_IRI = `${SFLO_NAMESPACE}locatedFileForState`;
const SFLO_REFERENCE_LINK_FOR_IRI = `${SFLO_NAMESPACE}referenceLinkFor`;
const SFLO_REFERENCE_LINK_IRI = `${SFLO_NAMESPACE}ReferenceLink`;
const SFLO_HAS_REFERENCE_SOURCE_IRI = `${SFLO_NAMESPACE}hasReferenceSource`;
const SFLO_HAS_KNOP_ASSET_BUNDLE_IRI = `${SFLO_NAMESPACE}hasKnopAssetBundle`;
const SFLO_HAS_RESOURCE_PAGE_DEFINITION_IRI =
  `${SFLO_NAMESPACE}hasResourcePageDefinition`;

export interface PayloadArtifactInventoryState {
  workingLocalRelativePath: string;
  workingAccessUrl?: string;
  workingLocatedFilePath?: string;
  payloadIsRdfDocument?: boolean;
  repositorySourceFloatingLocator?: RepositorySourceFloatingLocatorState;
  currentArtifactHistoryPath?: string;
  currentArtifactHistoryExists: boolean;
  latestHistoricalStatePath?: string;
  latestHistoricalSnapshotPath?: string;
}

export interface RepositorySourceFloatingLocatorState {
  repositoryUrl: string;
  repositoryPathFromRoot: string;
}

export interface RepositorySourceLocatorState {
  repositoryUrl: string;
  repositoryRef: string;
  repositoryCommit?: string;
  repositoryPath: string;
  contentDigest?: string;
}

export interface ReferenceCatalogInventoryState {
  workingLocalRelativePath: string;
}

export interface ReferenceTargetLinkState {
  referenceTargetPath: string;
  referenceTargetStatePath?: string;
}

export interface ExtractionSourceInventoryState {
  sourceArtifactPath: string;
  requestedTargetStatePath?: string;
  artifactResolutionModeIri?: string;
  resolutionRequest: ArtifactResolutionRequest;
  resolutionObservation?: SourceRegistryResolutionObservationState;
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

export interface IntegrationSourceInventoryState {
  sourceBindingIri: string;
  sourceArtifactPath: string;
  targetLocalRelativePath?: string;
  artifactResolutionModeIri?: string;
  expectedContentDigest?: string;
  repositorySource?: RepositorySourceLocatorState;
  repositorySourceFloatingLocator?: RepositorySourceFloatingLocatorState;
  resolutionRequest: ArtifactResolutionRequest;
  resolutionObservation?: SourceRegistryResolutionObservationState;
  observedSourceLocalRelativePath?: string;
  observedSourceDigest?: string;
  observedAt?: string;
}

export interface ImportSourceInventoryState {
  sourceBindingIri: string;
  sourceArtifactPath: string;
  targetAccessUrl?: string;
  targetLocalRelativePath?: string;
  artifactResolutionModeIri?: string;
  expectedContentDigest?: string;
  resolutionRequest: ArtifactResolutionRequest;
  resolutionObservation?: SourceRegistryResolutionObservationState;
  observedSourceLocalRelativePath?: string;
  observedSourceDigest?: string;
  observedAt?: string;
}

export interface SourceRegistryResolutionObservationState {
  observed: ArtifactResolutionObservedCoordinates;
  observedAt?: string;
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

  const repositorySourceFloatingLocator =
    resolveOptionalRepositorySourceFloatingLocator(
      quads,
      payloadArtifactIri,
      messages.parseErrorMessage,
    );
  const workingLocalRelativePath = repositorySourceFloatingLocator
    ?.repositoryPathFromRoot ??
    requireWorkingLocalRelativePath(
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
  const workingAccessUrl = resolveOptionalUniqueLiteral(
    quads,
    payloadArtifactIri,
    SFLO_WORKING_ACCESS_URL_IRI,
    messages.parseErrorMessage,
  );
  const payloadIsRdfDocument = hasNamedNodeObject(
    quads,
    payloadArtifactIri,
    RDF_TYPE_IRI,
    `${SFLO_NAMESPACE}RdfDocument`,
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
    ...(workingAccessUrl ? { workingAccessUrl } : {}),
    ...(workingLocatedFilePath ? { workingLocatedFilePath } : {}),
    payloadIsRdfDocument,
    ...(repositorySourceFloatingLocator
      ? { repositorySourceFloatingLocator }
      : {}),
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
    SFLO_TARGET_ARTIFACT_IRI,
    messages.missingTargetArtifactMessage,
  );
  if (!sourceArtifactPath) {
    throw new Error(messages.missingTargetArtifactMessage);
  }

  const requestedTargetStatePath = resolveOptionalUniqueNamedNodePath(
    sourceRegistryQuads,
    meshBase,
    extractionSourceIri,
    SFLO_TARGET_HISTORICAL_STATE_IRI,
    messages.missingRequestedTargetStateMessage,
  );

  const artifactResolutionModeIri = resolveOptionalUniqueNamedNodeIri(
    sourceRegistryQuads,
    extractionSourceIri,
    SFLO_HAS_ARTIFACT_RESOLUTION_MODE_IRI,
    messages.unsupportedResolutionModeMessage,
  );
  if (
    artifactResolutionModeIri !== undefined &&
    artifactResolutionModeIri !== SFLO_ARTIFACT_RESOLUTION_MODE_WORKING_IRI &&
    artifactResolutionModeIri !== SFLO_ARTIFACT_RESOLUTION_MODE_LATEST_STATE_IRI
  ) {
    throw new Error(messages.unsupportedResolutionModeMessage);
  }
  const resolutionObservation = resolveSourceRegistryResolutionObservationState(
    sourceRegistryQuads,
    extractionSourceIri,
    messages.parseErrorMessage,
  );

  return {
    sourceArtifactPath,
    ...(requestedTargetStatePath ? { requestedTargetStatePath } : {}),
    ...(artifactResolutionModeIri ? { artifactResolutionModeIri } : {}),
    resolutionRequest: toSourceRegistryResolutionRequest(
      meshBase,
      extractionSourceIri,
      {
        sourceArtifactPath,
        targetHistoricalStatePath: requestedTargetStatePath,
        artifactResolutionModeIri,
      },
    ),
    ...(resolutionObservation ? { resolutionObservation } : {}),
    ...toLegacyObservedSourceEvidence(
      meshBase,
      resolutionObservation,
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

export function listIntegrationSourceInventoryStates(
  meshBase: string,
  sourceRegistryTurtle: string,
  sourceRegistryPath: string,
  messages: {
    parseErrorMessage: string;
    missingTargetArtifactMessage: string;
    unsupportedResolutionModeMessage: string;
  },
): readonly IntegrationSourceInventoryState[] {
  const quads = parseInventoryQuads(
    meshBase,
    sourceRegistryTurtle,
    messages.parseErrorMessage,
  );
  const sourceRegistryIri = toMeshIri(meshBase, sourceRegistryPath);
  const sourceBindingIris = resolveNamedNodeIris(
    quads,
    sourceRegistryIri,
    SFLO_HAS_SOURCE_BINDING_IRI,
  ).filter((sourceBindingIri) =>
    hasNamedNodeObject(
      quads,
      sourceBindingIri,
      RDF_TYPE_IRI,
      SFLO_INTEGRATION_SOURCE_IRI,
    )
  );

  if (sourceBindingIris.length === 0) {
    return [];
  }

  return sourceBindingIris.map((sourceBindingIri) => {
    const sourceArtifactPath = resolveOptionalUniqueNamedNodePath(
      quads,
      meshBase,
      sourceBindingIri,
      SFLO_TARGET_ARTIFACT_IRI,
      messages.missingTargetArtifactMessage,
    );
    if (!sourceArtifactPath) {
      throw new Error(messages.missingTargetArtifactMessage);
    }

    const artifactResolutionModeIri = resolveOptionalUniqueNamedNodeIri(
      quads,
      sourceBindingIri,
      SFLO_HAS_ARTIFACT_RESOLUTION_MODE_IRI,
      messages.unsupportedResolutionModeMessage,
    );
    if (
      artifactResolutionModeIri !== undefined &&
      artifactResolutionModeIri !== SFLO_ARTIFACT_RESOLUTION_MODE_WORKING_IRI
    ) {
      throw new Error(messages.unsupportedResolutionModeMessage);
    }

    const targetLocalRelativePath =
      resolveOptionalUniqueLiteralWorkingLocalRelativePath(
        quads,
        sourceBindingIri,
        SFLO_TARGET_LOCAL_RELATIVE_PATH_IRI,
        messages.parseErrorMessage,
      );
    const expectedContentDigest = resolveOptionalUniqueLiteral(
      quads,
      sourceBindingIri,
      SFLO_EXPECTS_CONTENT_DIGEST_IRI,
      messages.parseErrorMessage,
    );
    const repositorySource = resolveOptionalRepositorySourceLocator(
      quads,
      sourceBindingIri,
      messages.parseErrorMessage,
    );
    const repositorySourceFloatingLocator =
      resolveOptionalRepositorySourceFloatingLocator(
        quads,
        sourceBindingIri,
        messages.parseErrorMessage,
      );
    const resolutionObservation =
      resolveSourceRegistryResolutionObservationState(
        quads,
        sourceBindingIri,
        messages.parseErrorMessage,
      );

    return {
      sourceBindingIri,
      sourceArtifactPath,
      ...(targetLocalRelativePath ? { targetLocalRelativePath } : {}),
      ...(artifactResolutionModeIri ? { artifactResolutionModeIri } : {}),
      ...(expectedContentDigest ? { expectedContentDigest } : {}),
      ...(repositorySource ? { repositorySource } : {}),
      ...(repositorySourceFloatingLocator
        ? { repositorySourceFloatingLocator }
        : {}),
      resolutionRequest: toSourceRegistryResolutionRequest(
        meshBase,
        sourceBindingIri,
        {
          sourceArtifactPath,
          targetLocalRelativePath,
          artifactResolutionModeIri,
          expectedContentDigest,
        },
      ),
      ...(resolutionObservation ? { resolutionObservation } : {}),
      ...toLegacyObservedSourceEvidence(
        meshBase,
        resolutionObservation,
        messages.parseErrorMessage,
      ),
    };
  });
}

export function listImportSourceInventoryStates(
  meshBase: string,
  sourceRegistryTurtle: string,
  sourceRegistryPath: string,
  messages: {
    parseErrorMessage: string;
    missingTargetArtifactMessage: string;
    unsupportedResolutionModeMessage: string;
  },
): readonly ImportSourceInventoryState[] {
  const quads = parseInventoryQuads(
    meshBase,
    sourceRegistryTurtle,
    messages.parseErrorMessage,
  );
  const sourceRegistryIri = toMeshIri(meshBase, sourceRegistryPath);
  const sourceBindingIris = resolveNamedNodeIris(
    quads,
    sourceRegistryIri,
    SFLO_HAS_SOURCE_BINDING_IRI,
  ).filter((sourceBindingIri) =>
    hasNamedNodeObject(
      quads,
      sourceBindingIri,
      RDF_TYPE_IRI,
      SFLO_IMPORT_SOURCE_IRI,
    )
  );

  if (sourceBindingIris.length === 0) {
    return [];
  }

  return sourceBindingIris.map((sourceBindingIri) => {
    const sourceArtifactPath = resolveOptionalUniqueNamedNodePath(
      quads,
      meshBase,
      sourceBindingIri,
      SFLO_TARGET_ARTIFACT_IRI,
      messages.missingTargetArtifactMessage,
    );
    if (!sourceArtifactPath) {
      throw new Error(messages.missingTargetArtifactMessage);
    }

    const artifactResolutionModeIri = resolveOptionalUniqueNamedNodeIri(
      quads,
      sourceBindingIri,
      SFLO_HAS_ARTIFACT_RESOLUTION_MODE_IRI,
      messages.unsupportedResolutionModeMessage,
    );
    if (
      artifactResolutionModeIri !== undefined &&
      artifactResolutionModeIri !== SFLO_ARTIFACT_RESOLUTION_MODE_WORKING_IRI
    ) {
      throw new Error(messages.unsupportedResolutionModeMessage);
    }

    const targetAccessUrl = resolveOptionalUniqueLiteral(
      quads,
      sourceBindingIri,
      SFLO_TARGET_ACCESS_URL_IRI,
      messages.parseErrorMessage,
    );
    const targetLocalRelativePath =
      resolveOptionalUniqueLiteralWorkingLocalRelativePath(
        quads,
        sourceBindingIri,
        SFLO_TARGET_LOCAL_RELATIVE_PATH_IRI,
        messages.parseErrorMessage,
      );
    const expectedContentDigest = resolveOptionalUniqueLiteral(
      quads,
      sourceBindingIri,
      SFLO_EXPECTS_CONTENT_DIGEST_IRI,
      messages.parseErrorMessage,
    );
    const resolutionObservation =
      resolveSourceRegistryResolutionObservationState(
        quads,
        sourceBindingIri,
        messages.parseErrorMessage,
      );

    return {
      sourceBindingIri,
      sourceArtifactPath,
      ...(targetAccessUrl ? { targetAccessUrl } : {}),
      ...(targetLocalRelativePath ? { targetLocalRelativePath } : {}),
      ...(artifactResolutionModeIri ? { artifactResolutionModeIri } : {}),
      ...(expectedContentDigest ? { expectedContentDigest } : {}),
      resolutionRequest: toSourceRegistryResolutionRequest(
        meshBase,
        sourceBindingIri,
        {
          sourceArtifactPath,
          targetAccessUrl,
          targetLocalRelativePath,
          artifactResolutionModeIri,
          expectedContentDigest,
        },
      ),
      ...(resolutionObservation ? { resolutionObservation } : {}),
      ...toLegacyObservedSourceEvidence(
        meshBase,
        resolutionObservation,
        messages.parseErrorMessage,
      ),
    };
  });
}

function resolveObservedArtifactResolutionSpecKey(
  quads: readonly Quad[],
  observationIri: string,
  errorMessage: string,
): string {
  const observedSpecKey = resolveOptionalUniqueObjectTermKey(
    quads,
    observationIri,
    SFLO_OBSERVED_ARTIFACT_RESOLUTION_SPEC_IRI,
    errorMessage,
  );
  if (observedSpecKey === undefined) {
    throw new Error(errorMessage);
  }
  return observedSpecKey;
}

function toSourceRegistryResolutionRequest(
  meshBase: string,
  sourceIri: string,
  options: {
    sourceArtifactPath: string;
    targetHistoricalStatePath?: string;
    targetAccessUrl?: string;
    targetLocalRelativePath?: string;
    artifactResolutionModeIri?: string;
    expectedContentDigest?: string;
  },
): ArtifactResolutionRequest {
  const mode = toArtifactResolutionMode(options.artifactResolutionModeIri);
  return {
    sourceIri,
    targetArtifactIri: toMeshIri(meshBase, options.sourceArtifactPath),
    ...(options.targetHistoricalStatePath
      ? {
        targetHistoricalStateIri: toMeshIri(
          meshBase,
          options.targetHistoricalStatePath,
        ),
      }
      : {}),
    ...(options.targetAccessUrl
      ? { targetAccessUrl: options.targetAccessUrl }
      : {}),
    ...(options.targetLocalRelativePath
      ? { targetLocalRelativePath: options.targetLocalRelativePath }
      : {}),
    ...(mode ? { mode } : {}),
    ...(options.expectedContentDigest
      ? { expectedContentDigest: options.expectedContentDigest }
      : {}),
  };
}

function toArtifactResolutionMode(
  modeIri: string | undefined,
): "working" | "latestState" | undefined {
  if (modeIri === SFLO_ARTIFACT_RESOLUTION_MODE_WORKING_IRI) {
    return "working";
  }
  if (modeIri === SFLO_ARTIFACT_RESOLUTION_MODE_LATEST_STATE_IRI) {
    return "latestState";
  }
  return undefined;
}

function resolveSourceRegistryResolutionObservationState(
  quads: readonly Quad[],
  sourceIri: string,
  errorMessage: string,
): SourceRegistryResolutionObservationState | undefined {
  const observationIri = resolveOptionalUniqueNamedNodeIri(
    quads,
    sourceIri,
    SFLO_HAS_RESOLUTION_OBSERVATION_IRI,
    errorMessage,
  );
  if (observationIri === undefined) {
    return undefined;
  }

  const observedSpecKey = resolveObservedArtifactResolutionSpecKey(
    quads,
    observationIri,
    errorMessage,
  );
  const historicalStateIri = resolveOptionalUniqueNamedNodeIri(
    quads,
    observedSpecKey,
    SFLO_TARGET_HISTORICAL_STATE_IRI,
    errorMessage,
  );
  const manifestationIri = resolveOptionalUniqueNamedNodeIri(
    quads,
    observedSpecKey,
    SFLO_TARGET_MANIFESTATION_IRI,
    errorMessage,
  );
  const locatedFileIri = resolveOptionalUniqueNamedNodeIri(
    quads,
    observedSpecKey,
    SFLO_TARGET_LOCATED_FILE_IRI,
    errorMessage,
  );
  const localRelativePath =
    resolveOptionalUniqueLiteralWorkingLocalRelativePath(
      quads,
      observedSpecKey,
      SFLO_TARGET_LOCAL_RELATIVE_PATH_IRI,
      errorMessage,
    );
  const contentDigest = resolveOptionalUniqueLiteral(
    quads,
    observationIri,
    SFLO_OBSERVED_CONTENT_DIGEST_IRI,
    errorMessage,
  );
  const observedAt = resolveOptionalUniqueLiteral(
    quads,
    observationIri,
    SFLO_OBSERVED_AT_IRI,
    errorMessage,
  );

  return {
    observed: {
      ...(historicalStateIri ? { historicalStateIri } : {}),
      ...(manifestationIri ? { manifestationIri } : {}),
      ...(locatedFileIri ? { locatedFileIri } : {}),
      ...(localRelativePath ? { localRelativePath } : {}),
      ...(contentDigest ? { contentDigest } : {}),
    },
    ...(observedAt ? { observedAt } : {}),
  };
}

function toLegacyObservedSourceEvidence(
  meshBase: string,
  observation: SourceRegistryResolutionObservationState | undefined,
  errorMessage: string,
): {
  observedSourceStatePath?: string;
  observedSourceManifestationPath?: string;
  observedSourceLocatedFilePath?: string;
  observedSourceLocalRelativePath?: string;
  observedSourceDigest?: string;
  observedAt?: string;
} {
  if (observation === undefined) {
    return {};
  }

  return {
    ...(observation.observed.historicalStateIri
      ? {
        observedSourceStatePath: requireMeshPath(
          meshBase,
          observation.observed.historicalStateIri,
          errorMessage,
        ),
      }
      : {}),
    ...(observation.observed.manifestationIri
      ? {
        observedSourceManifestationPath: requireMeshPath(
          meshBase,
          observation.observed.manifestationIri,
          errorMessage,
        ),
      }
      : {}),
    ...(observation.observed.locatedFileIri
      ? {
        observedSourceLocatedFilePath: requireMeshPath(
          meshBase,
          observation.observed.locatedFileIri,
          errorMessage,
        ),
      }
      : {}),
    ...(observation.observed.localRelativePath
      ? {
        observedSourceLocalRelativePath: observation.observed.localRelativePath,
      }
      : {}),
    ...(observation.observed.contentDigest
      ? { observedSourceDigest: observation.observed.contentDigest }
      : {}),
    ...(observation.observedAt ? { observedAt: observation.observedAt } : {}),
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
      !resolveOptionalUniqueNamedNodeIri(
        quads,
        subjectIri,
        SFLO_HAS_REFERENCE_SOURCE_IRI,
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
  for (const subjectIri of linkSubjects) {
    const referenceSourceIri = resolveOptionalUniqueNamedNodeIri(
      quads,
      subjectIri,
      SFLO_HAS_REFERENCE_SOURCE_IRI,
      messages.missingReferenceLinkMessage,
    );
    if (referenceSourceIri === undefined) {
      continue;
    }

    const referenceTargetPath = resolveOptionalUniqueNamedNodePath(
      quads,
      meshBase,
      referenceSourceIri,
      SFLO_TARGET_ARTIFACT_IRI,
      messages.missingReferenceTargetMessage,
    );
    if (referenceTargetPath) {
      referenceTargetPaths.add(referenceTargetPath);
    }

    const referenceTargetStatePath = resolveOptionalUniqueNamedNodePath(
      quads,
      meshBase,
      referenceSourceIri,
      SFLO_TARGET_HISTORICAL_STATE_IRI,
      messages.missingReferenceLinkMessage,
    );
    if (referenceTargetStatePath) {
      referenceTargetStatePaths.add(referenceTargetStatePath);
    }
  }

  if (referenceTargetPaths.size !== 1) {
    throw new Error(messages.missingReferenceTargetMessage);
  }
  if (referenceTargetStatePaths.size > 1) {
    throw new Error(messages.missingReferenceLinkMessage);
  }

  return {
    referenceTargetPath: referenceTargetPaths.values().next().value!,
    ...(referenceTargetStatePaths.size === 1
      ? {
        referenceTargetStatePath: referenceTargetStatePaths.values().next()
          .value!,
      }
      : {}),
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
    resolveOptionalWorkingLocalRelativePath(
      quads,
      subjectIri,
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

function resolveOptionalWorkingLocalRelativePath(
  quads: readonly Quad[],
  subjectIri: string,
  errorMessage: string,
): string | undefined {
  return resolveOptionalUniqueLiteralWorkingLocalRelativePath(
    quads,
    subjectIri,
    SFLO_WORKING_FILE_PATH_IRI,
    errorMessage,
  );
}

function resolveOptionalRepositorySourceFloatingLocator(
  quads: readonly Quad[],
  subjectIri: string,
  errorMessage: string,
): RepositorySourceFloatingLocatorState | undefined {
  const locatorIri = resolveOptionalUniqueObjectTermKey(
    quads,
    subjectIri,
    SFLO_HAS_REPOSITORY_SOURCE_FLOATING_LOCATOR_IRI,
    errorMessage,
  );
  if (locatorIri === undefined) {
    return undefined;
  }

  const repositoryUrl = resolveOptionalUniqueLiteral(
    quads,
    locatorIri,
    SFLO_SOURCE_REPOSITORY_URL_IRI,
    errorMessage,
  );
  const repositoryPathFromRoot =
    resolveOptionalUniqueLiteralWorkingLocalRelativePath(
      quads,
      locatorIri,
      SFLO_SOURCE_REPOSITORY_PATH_FROM_ROOT_IRI,
      errorMessage,
    );
  if (
    repositoryUrl === undefined ||
    repositoryPathFromRoot === undefined ||
    repositoryPathFromRoot.startsWith("../")
  ) {
    throw new Error(errorMessage);
  }

  return {
    repositoryUrl,
    repositoryPathFromRoot,
  };
}

function resolveOptionalRepositorySourceLocator(
  quads: readonly Quad[],
  subjectIri: string,
  errorMessage: string,
): RepositorySourceLocatorState | undefined {
  const locatorIri = resolveOptionalUniqueObjectTermKey(
    quads,
    subjectIri,
    SFLO_TARGET_REPOSITORY_SOURCE_IRI,
    errorMessage,
  );
  if (locatorIri === undefined) {
    return undefined;
  }

  const repositoryUrl = resolveOptionalUniqueLiteral(
    quads,
    locatorIri,
    SFLO_SOURCE_REPOSITORY_URL_IRI,
    errorMessage,
  );
  const repositoryRef = resolveOptionalUniqueLiteral(
    quads,
    locatorIri,
    SFLO_SOURCE_REPOSITORY_REF_IRI,
    errorMessage,
  );
  const repositoryPath = resolveOptionalUniqueLiteralWorkingLocalRelativePath(
    quads,
    locatorIri,
    SFLO_SOURCE_REPOSITORY_PATH_IRI,
    errorMessage,
  );
  if (
    repositoryUrl === undefined ||
    repositoryRef === undefined ||
    repositoryPath === undefined ||
    repositoryPath.startsWith("../")
  ) {
    throw new Error(errorMessage);
  }

  const repositoryCommit = resolveOptionalUniqueLiteral(
    quads,
    locatorIri,
    SFLO_SOURCE_REPOSITORY_COMMIT_IRI,
    errorMessage,
  );
  const contentDigest = resolveOptionalUniqueLiteral(
    quads,
    locatorIri,
    SFLO_HAS_CONTENT_DIGEST_IRI,
    errorMessage,
  );

  return {
    repositoryUrl,
    repositoryRef,
    ...(repositoryCommit ? { repositoryCommit } : {}),
    repositoryPath,
    ...(contentDigest ? { contentDigest } : {}),
  };
}

function resolveNamedNodeIris(
  quads: readonly Quad[],
  subjectIri: string,
  predicateIri: string,
): readonly string[] {
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

  return [...values].sort();
}

function resolveOptionalUniqueObjectTermKey(
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
      (quad.object.termType !== "NamedNode" &&
        quad.object.termType !== "BlankNode")
    ) {
      continue;
    }

    values.add(`${quad.object.termType}:${quad.object.value}`);
  }

  if (values.size === 0) {
    return undefined;
  }
  if (values.size !== 1) {
    throw new Error(errorMessage);
  }

  return values.values().next().value!;
}

function resolveOptionalUniqueNamedNodePath(
  quads: readonly Quad[],
  meshBase: string,
  subjectIriOrKey: string,
  predicateIri: string,
  errorMessage: string,
): string | undefined {
  const values = new Set<string>();

  for (const quad of quads) {
    if (
      !matchesSubject(quad.subject, subjectIriOrKey) ||
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

function resolveNamedNodePaths(
  quads: readonly Quad[],
  meshBase: string,
  subjectIri: string,
  predicateIri: string,
  errorMessage: string,
): readonly string[] {
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

  return [...values].sort();
}

function resolveOptionalUniqueNamedNodeIri(
  quads: readonly Quad[],
  subjectIriOrKey: string,
  predicateIri: string,
  errorMessage: string,
): string | undefined {
  const values = new Set<string>();

  for (const quad of quads) {
    if (
      !matchesSubject(quad.subject, subjectIriOrKey) ||
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
  subjectIriOrKey: string,
  predicateIri: string,
  errorMessage: string,
): string | undefined {
  const values = new Set<string>();

  for (const quad of quads) {
    if (
      !matchesSubject(quad.subject, subjectIriOrKey) ||
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
  const manifestationLocatedFilePaths =
    resolveHistoricalStateManifestationLocatedFilePaths(
      quads,
      meshBase,
      stateIri,
      errorMessage,
    );

  if (
    shortcutLocatedFilePath !== undefined &&
    manifestationLocatedFilePaths.length > 0 &&
    !manifestationLocatedFilePaths.includes(shortcutLocatedFilePath)
  ) {
    throw new Error(errorMessage);
  }

  return shortcutLocatedFilePath ??
    (manifestationLocatedFilePaths.length === 1
      ? manifestationLocatedFilePaths[0]
      : undefined);
}

function resolveHistoricalStateManifestationLocatedFilePaths(
  quads: readonly Quad[],
  meshBase: string,
  stateIri: string,
  errorMessage: string,
): readonly string[] {
  const manifestationPaths = resolveNamedNodePaths(
    quads,
    meshBase,
    stateIri,
    SFLO_HAS_MANIFESTATION_IRI,
    errorMessage,
  );
  const locatedFilePaths = new Set<string>();

  for (const manifestationPath of manifestationPaths) {
    const locatedFilePath = resolveOptionalUniqueNamedNodePath(
      quads,
      meshBase,
      toMeshIri(meshBase, manifestationPath),
      SFLO_LOCATED_FILE_FOR_MANIFESTATION_IRI,
      errorMessage,
    );
    if (locatedFilePath) {
      locatedFilePaths.add(locatedFilePath);
    }
  }

  return [...locatedFilePaths].sort();
}

function resolveOptionalUniqueLiteralWorkingLocalRelativePath(
  quads: readonly Quad[],
  subjectIriOrKey: string,
  predicateIri: string,
  errorMessage: string,
): string | undefined {
  const values = new Set<string>();

  for (const quad of quads) {
    if (
      !matchesSubject(quad.subject, subjectIriOrKey) ||
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

function matchesSubject(
  subject: Quad["subject"],
  subjectIriOrKey: string,
): boolean {
  if (
    subjectIriOrKey.startsWith("NamedNode:") ||
    subjectIriOrKey.startsWith("BlankNode:")
  ) {
    return `${subject.termType}:${subject.value}` === subjectIriOrKey;
  }
  return subject.termType === "NamedNode" && subject.value === subjectIriOrKey;
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
