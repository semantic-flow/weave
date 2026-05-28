import { dirname, join } from "@std/path";
import { toKnopPath } from "../../core/designator_segments.ts";
import { SFLO_NAMESPACE } from "../../core/rdf/namespaces.ts";
import type {
  PayloadWorkingArtifact,
  ReferenceCatalogWorkingArtifact,
  ResourcePageDefinitionWorkingArtifact,
  WeaveableKnopCandidate,
} from "../../core/weave/candidates.ts";
import {
  resolveExtractionSourceInventoryState,
  resolveKnopSourceRegistryInventoryState,
  resolvePayloadArtifactInventoryState,
  resolveReferenceCatalogInventoryState,
  resolveResourcePageDefinitionInventoryState,
} from "../mesh/inventory.ts";
import {
  ArtifactResolutionError,
  resolveArtifactResolutionRequest,
} from "../artifact_resolution/resolver.ts";
import {
  LocalPathAccessError,
  type OperationalLocalPathPolicy,
  resolveAllowedLocalPath,
  resolveRepositorySourceFloatingLocalPath,
} from "../operational/local_path_policy.ts";
import { WeaveRuntimeError } from "./errors.ts";
import {
  loadResourcePageDefinitionWorkingArtifact,
  ResourcePageDefinitionResolutionError,
} from "./page_definition.ts";
import { readTextFileWithOverlay } from "./planning_context.ts";

const SFLO_HAS_EXTRACTION_SOURCE_IRI = `${SFLO_NAMESPACE}hasExtractionSource`;

export async function loadPayloadWorkingArtifact(
  _workspaceRoot: string,
  localPathPolicy: OperationalLocalPathPolicy,
  meshBase: string,
  designatorPath: string,
  currentKnopInventoryTurtle: string,
  overlay?: ReadonlyMap<string, string>,
): Promise<PayloadWorkingArtifact | undefined> {
  const payloadArtifact = resolvePayloadArtifactInventoryState(
    meshBase,
    currentKnopInventoryTurtle,
    designatorPath,
    {
      parseErrorMessage:
        `Could not parse the current Knop inventory while resolving the payload artifact for ${designatorPath}.`,
      missingWorkingFileMessage:
        `Could not resolve the working payload file for ${designatorPath}.`,
    },
  );
  if (!payloadArtifact) {
    return undefined;
  }
  const workingLocalRelativePath = payloadArtifact.workingLocalRelativePath;
  const currentArtifactHistoryPath = payloadArtifact.currentArtifactHistoryPath;
  const latestHistoricalStatePath = payloadArtifact.currentArtifactHistoryExists
    ? payloadArtifact.latestHistoricalStatePath
    : undefined;
  const latestHistoricalSnapshotPath = latestHistoricalStatePath
    ? payloadArtifact.latestHistoricalSnapshotPath ??
      toPayloadHistoricalSnapshotPath(
        latestHistoricalStatePath,
        workingLocalRelativePath,
      )
    : undefined;

  let currentPayloadTurtle: string;
  let currentPayloadBytes: Uint8Array | undefined;
  let latestHistoricalSnapshotTurtle: string | undefined;
  let latestHistoricalSnapshotBytes: Uint8Array | undefined;
  try {
    const absoluteCurrentPayloadPath =
      payloadArtifact.repositorySourceFloatingLocator
        ? await resolveRepositorySourceFloatingLocalPath(
          localPathPolicy,
          payloadArtifact.repositorySourceFloatingLocator,
        )
        : resolveAllowedLocalPath(
          localPathPolicy,
          "workingLocalRelativePath",
          workingLocalRelativePath,
        );
    const currentPayload = await readPayloadFileWithOverlay(
      absoluteCurrentPayloadPath,
      overlay,
    );
    currentPayloadTurtle = currentPayload.text;
    currentPayloadBytes = isTextLikePayloadPath(workingLocalRelativePath)
      ? undefined
      : currentPayload.bytes;
  } catch (error) {
    if (error instanceof LocalPathAccessError) {
      throw new WeaveRuntimeError(
        `Working payload file for ${designatorPath} is outside the allowed local-path boundary: ${workingLocalRelativePath}`,
      );
    }
    if (error instanceof Deno.errors.NotFound) {
      throw new WeaveRuntimeError(
        `Workspace is missing the working payload file for ${designatorPath}: ${workingLocalRelativePath}`,
      );
    }
    throw error;
  }

  if (latestHistoricalSnapshotPath) {
    try {
      const latestHistoricalSnapshot = await readPayloadFileWithOverlay(
        resolveAllowedLocalPath(
          localPathPolicy,
          "workingLocalRelativePath",
          latestHistoricalSnapshotPath,
        ),
        overlay,
      );
      if (isTextLikePayloadPath(latestHistoricalSnapshotPath)) {
        latestHistoricalSnapshotTurtle = latestHistoricalSnapshot.text;
      } else {
        latestHistoricalSnapshotBytes = latestHistoricalSnapshot.bytes;
      }
    } catch (error) {
      if (error instanceof LocalPathAccessError) {
        throw new WeaveRuntimeError(
          `Latest payload historical snapshot for ${designatorPath} is outside the allowed local-path boundary: ${latestHistoricalSnapshotPath}`,
        );
      }
      if (error instanceof Deno.errors.NotFound) {
        throw new WeaveRuntimeError(
          `Workspace is missing the latest payload historical snapshot for ${designatorPath}: ${latestHistoricalSnapshotPath}`,
        );
      }
      throw error;
    }
  }

  return {
    workingLocalRelativePath,
    ...(payloadArtifact.workingAccessUrl
      ? { workingAccessUrl: payloadArtifact.workingAccessUrl }
      : {}),
    currentPayloadTurtle,
    ...(currentPayloadBytes ? { currentPayloadBytes } : {}),
    payloadIsRdfDocument: payloadArtifact.payloadIsRdfDocument,
    ...(payloadArtifact.repositorySourceFloatingLocator
      ? {
        repositorySourceFloatingLocator:
          payloadArtifact.repositorySourceFloatingLocator,
      }
      : {}),
    currentArtifactHistoryPath,
    ...(latestHistoricalSnapshotPath ? { latestHistoricalSnapshotPath } : {}),
    latestHistoricalSnapshotTurtle,
    latestHistoricalSnapshotBytes,
    latestHistoricalStatePath,
  };
}

function isTextLikePayloadPath(path: string): boolean {
  return /\.(css|csv|html|json|jsonld|md|nt|nq|owl|rdf|svg|text|trig|ttl|txt|xml)$/i
    .test(path);
}

async function readPayloadFileWithOverlay(
  absolutePath: string,
  overlay?: ReadonlyMap<string, string>,
): Promise<{ text: string; bytes?: Uint8Array }> {
  const stagedContents = overlay?.get(absolutePath);
  if (stagedContents !== undefined) {
    return {
      text: stagedContents,
      bytes: new TextEncoder().encode(stagedContents),
    };
  }

  const bytes = await Deno.readFile(absolutePath);
  return {
    text: new TextDecoder().decode(bytes),
    bytes,
  };
}

export async function loadReferenceTargetSourcePayloadArtifact(
  workspaceRoot: string,
  localPathPolicy: OperationalLocalPathPolicy,
  meshBase: string,
  designatorPath: string,
  currentKnopInventoryTurtle: string,
  overlay?: ReadonlyMap<string, string>,
): Promise<WeaveableKnopCandidate["referenceTargetSourcePayloadArtifact"]> {
  const sourceRegistryArtifact = await loadKnopSourceRegistryArtifact(
    localPathPolicy,
    meshBase,
    designatorPath,
    currentKnopInventoryTurtle,
    overlay,
  );
  const extractionSource = resolveExtractionSourceInventoryState(
    meshBase,
    currentKnopInventoryTurtle,
    designatorPath,
    {
      parseErrorMessage:
        `Could not parse the current Knop inventory while resolving the extracted weave source for ${designatorPath}.`,
      missingExtractionSourceMessage:
        `Could not resolve the current extracted source binding for ${designatorPath}.`,
      missingTargetArtifactMessage:
        `Could not resolve the current extracted source target for ${designatorPath}.`,
      missingRequestedTargetStateMessage:
        `Could not resolve the current extracted source target state for ${designatorPath}.`,
      unsupportedResolutionModeMessage:
        `Unsupported ExtractionSource resolution mode for ${designatorPath}.`,
    },
    sourceRegistryArtifact?.turtle,
  );
  if (!extractionSource) {
    return undefined;
  }

  const sourceDesignatorPath = extractionSource.sourceArtifactPath;
  const sourceKnopInventoryPath = join(
    workspaceRoot,
    `${toKnopPath(sourceDesignatorPath)}/_inventory/inventory.ttl`,
  );
  let sourceKnopInventoryTurtle: string;

  try {
    sourceKnopInventoryTurtle = await readTextFileWithOverlay(
      sourceKnopInventoryPath,
      overlay,
    );
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      throw new WeaveRuntimeError(
        `Workspace is missing the woven source payload inventory for ${designatorPath}: ${
          toKnopPath(sourceDesignatorPath)
        }/_inventory/inventory.ttl`,
      );
    }
    throw error;
  }

  const sourcePayloadArtifact = await loadPayloadWorkingArtifact(
    workspaceRoot,
    localPathPolicy,
    meshBase,
    sourceDesignatorPath,
    sourceKnopInventoryTurtle,
    overlay,
  );
  if (!sourcePayloadArtifact?.latestHistoricalStatePath) {
    throw new WeaveRuntimeError(
      `Extracted weave source for ${designatorPath} is missing a woven current payload history: ${sourceDesignatorPath}`,
    );
  }
  const selectedHistoricalStatePath =
    extractionSource.requestedTargetStatePath ??
      sourcePayloadArtifact.latestHistoricalStatePath;
  if (!selectedHistoricalStatePath) {
    throw new WeaveRuntimeError(
      `Extracted weave source for ${designatorPath} is missing an exact or latest source state.`,
    );
  }
  const selectedSource = await resolveSelectedExtractionSource(
    workspaceRoot,
    localPathPolicy,
    meshBase,
    designatorPath,
    extractionSource.sourceArtifactPath,
    selectedHistoricalStatePath,
    overlay,
  );

  return {
    designatorPath: sourceDesignatorPath,
    workingLocalRelativePath: sourcePayloadArtifact.workingLocalRelativePath,
    currentPayloadTurtle: sourcePayloadArtifact.currentPayloadTurtle,
    ...(sourcePayloadArtifact.repositorySourceFloatingLocator
      ? {
        repositorySourceFloatingLocator:
          sourcePayloadArtifact.repositorySourceFloatingLocator,
      }
      : {}),
    ...(sourceRegistryArtifact
      ? {
        sourceRegistryWorkingLocalRelativePath:
          sourceRegistryArtifact.workingLocalRelativePath,
        currentSourceRegistryTurtle: sourceRegistryArtifact.turtle,
      }
      : {}),
    latestHistoricalSnapshotPath: selectedSource.snapshotPath,
    latestHistoricalSnapshotTurtle: selectedSource.snapshotTurtle,
    latestHistoricalStatePath: selectedSource.sourceEvidence.sourceStatePath,
    sourceEvidence: selectedSource.sourceEvidence,
  };
}

async function resolveSelectedExtractionSource(
  workspaceRoot: string,
  localPathPolicy: OperationalLocalPathPolicy,
  meshBase: string,
  designatorPath: string,
  sourceArtifactPath: string,
  selectedHistoricalStatePath: string,
  overlay?: ReadonlyMap<string, string>,
): Promise<{
  snapshotPath: string;
  snapshotTurtle: string;
  sourceEvidence: {
    sourceStatePath: string;
    sourceManifestationPath: string;
    sourceLocatedFilePath: string;
    sourceDigest: string;
  };
}> {
  try {
    const result = await resolveArtifactResolutionRequest(
      {
        meshRoot: workspaceRoot,
        meshBase,
        localPathPolicy,
        ...(overlay ? { overlay } : {}),
      },
      {
        sourceDescription:
          `ExtractionSource selected source for ${designatorPath}`,
        targetArtifactIri: new URL(sourceArtifactPath, meshBase).href,
        targetHistoricalStateIri: new URL(
          selectedHistoricalStatePath,
          meshBase,
        ).href,
      },
      { contentMode: "text" },
    );
    const snapshotPath = result.observed.localRelativePath;
    const snapshotTurtle = result.content?.text;
    const sourceDigest = result.observed.contentDigest;
    const sourceStatePath = result.observed.historicalStateIri === undefined
      ? undefined
      : requireObservedMeshPath(
        meshBase,
        result.observed.historicalStateIri,
        `ExtractionSource selected source for ${designatorPath} resolved a source state outside the mesh.`,
      );
    if (
      snapshotPath === undefined ||
      snapshotTurtle === undefined ||
      sourceDigest === undefined ||
      sourceStatePath === undefined
    ) {
      throw new WeaveRuntimeError(
        `ExtractionSource selected source for ${designatorPath} did not resolve to text content with observed state, local path, and digest.`,
      );
    }

    return {
      snapshotPath,
      snapshotTurtle,
      sourceEvidence: {
        sourceStatePath,
        sourceManifestationPath: dirname(snapshotPath).replaceAll("\\", "/"),
        sourceLocatedFilePath: snapshotPath,
        sourceDigest,
      },
    };
  } catch (error) {
    if (error instanceof ArtifactResolutionError) {
      throw new WeaveRuntimeError(error.message);
    }
    throw error;
  }
}

function requireObservedMeshPath(
  meshBase: string,
  iri: string,
  errorMessage: string,
): string {
  if (!iri.startsWith(meshBase)) {
    throw new WeaveRuntimeError(errorMessage);
  }
  const meshPath = iri.slice(meshBase.length);
  if (meshPath.includes("#") || meshPath.includes("?")) {
    throw new WeaveRuntimeError(errorMessage);
  }
  return meshPath;
}

export async function loadKnopSourceRegistryArtifact(
  localPathPolicy: OperationalLocalPathPolicy,
  meshBase: string,
  designatorPath: string,
  currentKnopInventoryTurtle: string,
  overlay?: ReadonlyMap<string, string>,
): Promise<
  { workingLocalRelativePath: string; turtle: string } | undefined
> {
  const sourceRegistryState = resolveKnopSourceRegistryInventoryState(
    meshBase,
    currentKnopInventoryTurtle,
    designatorPath,
    {
      parseErrorMessage:
        `Could not parse the current Knop inventory while resolving source registry facts for ${designatorPath}.`,
      missingSourceRegistryMessage:
        `Could not resolve the current Knop source registry for ${designatorPath}.`,
      missingWorkingFileMessage:
        `Could not resolve the current Knop source registry working file for ${designatorPath}.`,
    },
  );
  if (sourceRegistryState === undefined) {
    return undefined;
  }

  let sourceRegistryPath: string;
  try {
    sourceRegistryPath = resolveAllowedLocalPath(
      localPathPolicy,
      "workingLocalRelativePath",
      sourceRegistryState.workingLocalRelativePath,
    );
  } catch (error) {
    if (error instanceof LocalPathAccessError) {
      throw new WeaveRuntimeError(
        `Working Knop source registry file for ${designatorPath} is outside the allowed local-path boundary: ${sourceRegistryState.workingLocalRelativePath}`,
      );
    }
    throw error;
  }
  try {
    return {
      workingLocalRelativePath: sourceRegistryState.workingLocalRelativePath,
      turtle: await readTextFileWithOverlay(sourceRegistryPath, overlay),
    };
  } catch (error) {
    if (
      error instanceof Deno.errors.NotFound &&
      !currentKnopInventoryTurtle.includes("hasExtractionSource") &&
      !currentKnopInventoryTurtle.includes(SFLO_HAS_EXTRACTION_SOURCE_IRI)
    ) {
      return undefined;
    }
    if (error instanceof Deno.errors.NotFound) {
      throw new WeaveRuntimeError(
        `Workspace is missing the Knop source registry for ${designatorPath}: ${sourceRegistryState.workingLocalRelativePath}`,
      );
    }
    throw error;
  }
}

export async function loadReferenceCatalogWorkingArtifact(
  _workspaceRoot: string,
  localPathPolicy: OperationalLocalPathPolicy,
  meshBase: string,
  designatorPath: string,
  currentKnopInventoryTurtle: string,
  overlay?: ReadonlyMap<string, string>,
): Promise<ReferenceCatalogWorkingArtifact | undefined> {
  const referenceCatalog = resolveReferenceCatalogInventoryState(
    meshBase,
    currentKnopInventoryTurtle,
    designatorPath,
    {
      parseErrorMessage:
        `Could not parse the current Knop inventory while resolving the ReferenceCatalog for ${designatorPath}.`,
      missingWorkingFileMessage:
        `Could not resolve the working ReferenceCatalog file for ${designatorPath}.`,
    },
  );
  if (!referenceCatalog) {
    return undefined;
  }
  const workingLocalRelativePath = referenceCatalog.workingLocalRelativePath;
  try {
    return {
      workingLocalRelativePath,
      currentReferenceCatalogTurtle: await readTextFileWithOverlay(
        resolveAllowedLocalPath(
          localPathPolicy,
          "workingLocalRelativePath",
          workingLocalRelativePath,
        ),
        overlay,
      ),
    };
  } catch (error) {
    if (error instanceof LocalPathAccessError) {
      throw new WeaveRuntimeError(
        `Working ReferenceCatalog file for ${designatorPath} is outside the allowed local-path boundary: ${workingLocalRelativePath}`,
      );
    }
    if (error instanceof Deno.errors.NotFound) {
      throw new WeaveRuntimeError(
        `Workspace is missing the working ReferenceCatalog file for ${designatorPath}: ${workingLocalRelativePath}`,
      );
    }
    throw error;
  }
}

export async function loadResourcePageDefinitionArtifact(
  workspaceRoot: string,
  localPathPolicy: OperationalLocalPathPolicy,
  meshBase: string,
  designatorPath: string,
  currentKnopInventoryTurtle: string,
): Promise<ResourcePageDefinitionWorkingArtifact | undefined> {
  const inventoryState = resolveResourcePageDefinitionInventoryState(
    meshBase,
    currentKnopInventoryTurtle,
    designatorPath,
    {
      parseErrorMessage:
        `Could not parse the current Knop inventory while resolving the ResourcePageDefinition for ${designatorPath}.`,
      missingWorkingFileMessage:
        `Could not resolve the working ResourcePageDefinition file for ${designatorPath}.`,
    },
  );

  try {
    return await loadResourcePageDefinitionWorkingArtifact(
      workspaceRoot,
      localPathPolicy,
      designatorPath,
      inventoryState,
    );
  } catch (error) {
    if (error instanceof ResourcePageDefinitionResolutionError) {
      throw new WeaveRuntimeError(error.message);
    }
    throw error;
  }
}

export function toPayloadHistoricalSnapshotPath(
  historyStatePath: string,
  workingLocalRelativePath: string,
): string {
  const fileName = toFileName(workingLocalRelativePath);
  const manifestationSegment = toDefaultManifestationSegment(fileName);
  return `${historyStatePath}/${manifestationSegment}/${fileName}`;
}

function toFileName(path: string): string {
  const segments = path.split("/");
  return segments[segments.length - 1]!;
}

function toDefaultManifestationSegment(fileName: string): string {
  const extensionIndex = fileName.lastIndexOf(".");
  return extensionIndex > 0 && extensionIndex < fileName.length - 1
    ? fileName.slice(extensionIndex + 1)
    : fileName.replaceAll(".", "-");
}
