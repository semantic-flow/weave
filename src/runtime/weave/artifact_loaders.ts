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
  resolveHistoricalStateLocatedFilePath,
  resolveKnopSourceRegistryInventoryState,
  resolvePayloadArtifactInventoryState,
  resolveReferenceCatalogInventoryState,
  resolveResourcePageDefinitionInventoryState,
} from "../mesh/inventory.ts";
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
  workspaceRoot: string,
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
  const latestHistoricalSnapshotLocalPath = latestHistoricalSnapshotPath
    ? join(workspaceRoot, latestHistoricalSnapshotPath)
    : undefined;

  let currentPayloadTurtle: string;
  let latestHistoricalSnapshotTurtle: string | undefined;
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
    currentPayloadTurtle = await readTextFileWithOverlay(
      absoluteCurrentPayloadPath,
      overlay,
    );
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

  if (latestHistoricalSnapshotLocalPath) {
    try {
      latestHistoricalSnapshotTurtle = await readTextFileWithOverlay(
        latestHistoricalSnapshotLocalPath,
        overlay,
      );
    } catch (error) {
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
    ...(payloadArtifact.repositorySourceFloatingLocator
      ? {
        repositorySourceFloatingLocator:
          payloadArtifact.repositorySourceFloatingLocator,
      }
      : {}),
    currentArtifactHistoryPath,
    ...(latestHistoricalSnapshotPath ? { latestHistoricalSnapshotPath } : {}),
    latestHistoricalSnapshotTurtle,
    latestHistoricalStatePath,
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
  const selectedHistoricalSnapshotPath = resolveHistoricalStateLocatedFilePath(
    meshBase,
    sourceKnopInventoryTurtle,
    selectedHistoricalStatePath,
    `Could not parse the source Knop inventory while resolving the extracted source payload snapshot for ${designatorPath}.`,
  ) ?? (sourcePayloadArtifact.latestHistoricalStatePath ===
        selectedHistoricalStatePath &&
      sourcePayloadArtifact.latestHistoricalSnapshotPath
    ? sourcePayloadArtifact.latestHistoricalSnapshotPath
    : toPayloadHistoricalSnapshotPath(
      selectedHistoricalStatePath,
      sourcePayloadArtifact.workingLocalRelativePath,
    ));
  let selectedHistoricalSnapshotTurtle: string | undefined;
  try {
    selectedHistoricalSnapshotTurtle = await readTextFileWithOverlay(
      join(workspaceRoot, selectedHistoricalSnapshotPath),
      overlay,
    );
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      throw new WeaveRuntimeError(
        `Workspace is missing the extracted source payload snapshot for ${designatorPath}: ${selectedHistoricalSnapshotPath}`,
      );
    }
    throw error;
  }

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
    latestHistoricalSnapshotPath: selectedHistoricalSnapshotPath,
    latestHistoricalSnapshotTurtle: selectedHistoricalSnapshotTurtle,
    latestHistoricalStatePath: selectedHistoricalStatePath,
    sourceEvidence: {
      sourceStatePath: selectedHistoricalStatePath,
      sourceManifestationPath: dirname(selectedHistoricalSnapshotPath)
        .replaceAll(
          "\\",
          "/",
        ),
      sourceLocatedFilePath: selectedHistoricalSnapshotPath,
      sourceDigest: await sha256Digest(selectedHistoricalSnapshotTurtle),
    },
  };
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

async function sha256Digest(contents: string): Promise<string> {
  const bytes = new TextEncoder().encode(contents);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const hex = [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return `sha256:${hex}`;
}
