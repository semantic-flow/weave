import { join } from "@std/path";
import * as pathPosix from "@std/path/posix";
import { Parser, type Quad, type Term } from "n3";
import {
  appendMeshPath,
  normalizeSafeDesignatorPath,
  toKnopPath,
} from "../../core/designator_segments.ts";
import { RDF_NAMESPACE, SFLO_NAMESPACE } from "../../core/rdf/namespaces.ts";
import {
  type RepositorySourceFloatingLocatorState,
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
import type {
  ArtifactResolutionContentMode,
  ArtifactResolutionContext,
  ArtifactResolutionMode,
  ArtifactResolutionObservedCoordinates,
  ArtifactResolutionOptions,
  ArtifactResolutionRequest,
  ArtifactResolutionResult,
} from "./models.ts";
export type {
  ArtifactResolutionContent,
  ArtifactResolutionContentMode,
  ArtifactResolutionContext,
  ArtifactResolutionMode,
  ArtifactResolutionObservedCoordinates,
  ArtifactResolutionOptions,
  ArtifactResolutionRequest,
  ArtifactResolutionResult,
} from "./models.ts";

const RDF_TYPE_IRI = `${RDF_NAMESPACE}type`;
const SFLO_TARGET_ARTIFACT_IRI = `${SFLO_NAMESPACE}targetArtifact`;
const SFLO_TARGET_ARTIFACT_HISTORY_IRI =
  `${SFLO_NAMESPACE}targetArtifactHistory`;
const SFLO_TARGET_HISTORICAL_STATE_IRI =
  `${SFLO_NAMESPACE}targetHistoricalState`;
const SFLO_TARGET_MANIFESTATION_IRI = `${SFLO_NAMESPACE}targetManifestation`;
const SFLO_TARGET_LOCATED_FILE_IRI = `${SFLO_NAMESPACE}targetLocatedFile`;
const SFLO_TARGET_LOCAL_RELATIVE_PATH_IRI =
  `${SFLO_NAMESPACE}targetLocalRelativePath`;
const SFLO_TARGET_ACCESS_URL_IRI = `${SFLO_NAMESPACE}targetAccessUrl`;
const SFLO_TARGET_REPOSITORY_SOURCE_IRI =
  `${SFLO_NAMESPACE}targetRepositorySource`;
const SFLO_HAS_REPOSITORY_SOURCE_FLOATING_LOCATOR_IRI =
  `${SFLO_NAMESPACE}hasRepositorySourceFloatingLocator`;
const SFLO_HAS_ARTIFACT_RESOLUTION_MODE_IRI =
  `${SFLO_NAMESPACE}hasArtifactResolutionMode`;
const SFLO_ARTIFACT_RESOLUTION_MODE_WORKING_IRI =
  `${SFLO_NAMESPACE}artifactResolutionMode_working`;
const SFLO_ARTIFACT_RESOLUTION_MODE_LATEST_STATE_IRI =
  `${SFLO_NAMESPACE}artifactResolutionMode_latestState`;
const SFLO_HAS_FALLBACK_ARTIFACT_RESOLUTION_SPEC_IRI =
  `${SFLO_NAMESPACE}hasFallbackArtifactResolutionSpec`;
const SFLO_EXPECTS_CONTENT_DIGEST_IRI = `${SFLO_NAMESPACE}expectsContentDigest`;
const SFLO_CURRENT_ARTIFACT_HISTORY_IRI =
  `${SFLO_NAMESPACE}currentArtifactHistory`;
const SFLO_HAS_ARTIFACT_HISTORY_IRI = `${SFLO_NAMESPACE}hasArtifactHistory`;
const SFLO_HAS_HISTORICAL_STATE_IRI = `${SFLO_NAMESPACE}hasHistoricalState`;
const SFLO_ARTIFACT_HISTORY_IRI = `${SFLO_NAMESPACE}ArtifactHistory`;
const SFLO_HISTORICAL_STATE_IRI = `${SFLO_NAMESPACE}HistoricalState`;
const SFLO_LATEST_HISTORICAL_STATE_IRI =
  `${SFLO_NAMESPACE}latestHistoricalState`;
const SFLO_LOCATED_FILE_FOR_STATE_IRI = `${SFLO_NAMESPACE}locatedFileForState`;

const PAGE_DEFINITION_ARTIFACT_SUFFIX = "/_knop/_page";
const ROOT_PAGE_DEFINITION_ARTIFACT_PATH = "_knop/_page";
const ROOT_REFERENCE_CATALOG_PATH = "_knop/_references";
const REFERENCE_CATALOG_SUFFIX = "/_knop/_references";

interface ArtifactResolutionSpecParseOptions {
  sourceDescription?: string;
}

interface ArtifactResolutionSpecQuadsOptions
  extends ArtifactResolutionSpecParseOptions, ArtifactResolutionOptions {}

export type ArtifactResolutionFailureKind =
  | "validation"
  | "unsupported"
  | "unsafe"
  | "unavailable"
  | "digestMismatch"
  | "decodeFailure";

interface ArtifactResolutionErrorOptions extends ErrorOptions {
  kind?: ArtifactResolutionFailureKind;
}

interface TargetArtifactDescriptor {
  kind: "payload" | "referenceCatalog" | "resourcePageDefinition";
  designatorPath: string;
  artifactPath: string;
}

interface TargetArtifactInventory {
  meshBase: string;
  target: TargetArtifactDescriptor;
  turtle: string;
  quads: readonly Quad[];
}

export class ArtifactResolutionError extends Error {
  readonly kind: ArtifactResolutionFailureKind;

  constructor(message: string, options: ArtifactResolutionErrorOptions = {}) {
    super(message, { cause: options.cause });
    this.name = "ArtifactResolutionError";
    this.kind = options.kind ?? "validation";
  }
}

export function parseArtifactResolutionSpecTurtle(
  turtle: string,
  subjectIri: string,
  baseIri: string,
  options: ArtifactResolutionSpecParseOptions = {},
): ArtifactResolutionRequest {
  let quads: Quad[];
  try {
    quads = new Parser({ baseIRI: baseIri }).parse(turtle);
  } catch (error) {
    throw new ArtifactResolutionError(
      `Could not parse ArtifactResolutionSpec Turtle${
        options.sourceDescription ? ` from ${options.sourceDescription}` : ""
      }.`,
      { cause: error },
    );
  }
  return parseArtifactResolutionSpecQuads(quads, subjectIri, options);
}

export function parseArtifactResolutionSpecQuads(
  quads: readonly Quad[],
  subject: Term | string,
  options: ArtifactResolutionSpecParseOptions = {},
): ArtifactResolutionRequest {
  const subjectKey = typeof subject === "string"
    ? termKeyFromSubjectString(subject)
    : toTermKey(subject);
  const sourceIri = subjectKey.startsWith("NamedNode:")
    ? subjectKey.slice("NamedNode:".length)
    : undefined;
  const sourceDescription = options.sourceDescription ??
    (sourceIri ?? subjectKey);

  const targetArtifactIri = optionalUniqueNamedNodeObject(
    quads,
    subjectKey,
    SFLO_TARGET_ARTIFACT_IRI,
    sourceDescription,
  );
  const targetArtifactHistoryIri = optionalUniqueNamedNodeObject(
    quads,
    subjectKey,
    SFLO_TARGET_ARTIFACT_HISTORY_IRI,
    sourceDescription,
  );
  const targetHistoricalStateIri = optionalUniqueNamedNodeObject(
    quads,
    subjectKey,
    SFLO_TARGET_HISTORICAL_STATE_IRI,
    sourceDescription,
  );
  const targetManifestationIri = optionalUniqueNamedNodeObject(
    quads,
    subjectKey,
    SFLO_TARGET_MANIFESTATION_IRI,
    sourceDescription,
  );
  const targetLocatedFileIri = optionalUniqueNamedNodeObject(
    quads,
    subjectKey,
    SFLO_TARGET_LOCATED_FILE_IRI,
    sourceDescription,
  );
  const targetLocalRelativePath = optionalUniqueLiteralObject(
    quads,
    subjectKey,
    SFLO_TARGET_LOCAL_RELATIVE_PATH_IRI,
    sourceDescription,
  );
  const targetAccessUrl = optionalUniqueLiteralObject(
    quads,
    subjectKey,
    SFLO_TARGET_ACCESS_URL_IRI,
    sourceDescription,
  );
  const targetRepositorySourceTerm = optionalUniqueResourceObject(
    quads,
    subjectKey,
    SFLO_TARGET_REPOSITORY_SOURCE_IRI,
    sourceDescription,
  );
  const repositorySourceFloatingLocatorTerm = optionalUniqueResourceObject(
    quads,
    subjectKey,
    SFLO_HAS_REPOSITORY_SOURCE_FLOATING_LOCATOR_IRI,
    sourceDescription,
  );
  const fallbackArtifactResolutionSpecTerm = optionalUniqueResourceObject(
    quads,
    subjectKey,
    SFLO_HAS_FALLBACK_ARTIFACT_RESOLUTION_SPEC_IRI,
    sourceDescription,
  );
  const modeIri = optionalUniqueNamedNodeObject(
    quads,
    subjectKey,
    SFLO_HAS_ARTIFACT_RESOLUTION_MODE_IRI,
    sourceDescription,
  );
  const expectedContentDigest = optionalUniqueLiteralObject(
    quads,
    subjectKey,
    SFLO_EXPECTS_CONTENT_DIGEST_IRI,
    sourceDescription,
  );

  return compactRequest({
    sourceTerm: subjectKey,
    ...(sourceIri ? { sourceIri } : {}),
    sourceDescription,
    ...(targetArtifactIri ? { targetArtifactIri } : {}),
    ...(targetArtifactHistoryIri ? { targetArtifactHistoryIri } : {}),
    ...(targetHistoricalStateIri ? { targetHistoricalStateIri } : {}),
    ...(targetManifestationIri ? { targetManifestationIri } : {}),
    ...(targetLocatedFileIri ? { targetLocatedFileIri } : {}),
    ...(targetLocalRelativePath ? { targetLocalRelativePath } : {}),
    ...(targetAccessUrl ? { targetAccessUrl } : {}),
    ...(targetRepositorySourceTerm ? { targetRepositorySourceTerm } : {}),
    ...(repositorySourceFloatingLocatorTerm
      ? { repositorySourceFloatingLocatorTerm }
      : {}),
    ...(fallbackArtifactResolutionSpecTerm
      ? { fallbackArtifactResolutionSpecTerm }
      : {}),
    ...(modeIri
      ? { mode: parseResolutionMode(modeIri, sourceDescription) }
      : {}),
    ...(expectedContentDigest ? { expectedContentDigest } : {}),
  });
}

export async function resolveArtifactResolutionSpecQuads(
  context: ArtifactResolutionContext,
  quads: readonly Quad[],
  subject: Term | string,
  options: ArtifactResolutionSpecQuadsOptions = {},
): Promise<ArtifactResolutionResult> {
  const request = parseArtifactResolutionSpecQuads(quads, subject, options);
  return await resolveParsedArtifactResolutionSpec(
    context,
    quads,
    request,
    options,
  );
}

async function resolveParsedArtifactResolutionSpec(
  context: ArtifactResolutionContext,
  quads: readonly Quad[],
  request: ArtifactResolutionRequest,
  options: ArtifactResolutionOptions,
): Promise<ArtifactResolutionResult> {
  const primaryRequest = withoutFallbackSpec(request);
  try {
    return await resolveArtifactResolutionRequest(
      context,
      primaryRequest,
      options,
    );
  } catch (error) {
    if (
      request.fallbackArtifactResolutionSpecTerm === undefined ||
      !isFallbackEligiblePrimary(primaryRequest, error)
    ) {
      throw error;
    }

    const primaryError = error as ArtifactResolutionError;
    const fallbackTerm = request.fallbackArtifactResolutionSpecTerm;
    const fallbackDescription = `${describeRequest(primaryRequest)} fallback ${
      describeTermKey(fallbackTerm)
    }`;
    const fallbackRequest = parseArtifactResolutionSpecQuads(
      quads,
      fallbackTerm,
      { sourceDescription: fallbackDescription },
    );
    if (fallbackRequest.fallbackArtifactResolutionSpecTerm !== undefined) {
      throw new ArtifactResolutionError(
        `${fallbackDescription} declares a nested hasFallbackArtifactResolutionSpec, which this resolver slice does not support.`,
        { kind: "unsupported", cause: primaryError },
      );
    }

    try {
      return await resolveArtifactResolutionRequest(
        context,
        fallbackRequest,
        options,
      );
    } catch (fallbackError) {
      if (fallbackError instanceof ArtifactResolutionError) {
        throw new ArtifactResolutionError(
          `${
            describeRequest(primaryRequest)
          } failed before fallback: ${primaryError.message} Fallback ${
            describeRequest(fallbackRequest)
          } also failed: ${fallbackError.message}`,
          { kind: fallbackError.kind, cause: fallbackError },
        );
      }
      throw fallbackError;
    }
  }
}

export async function resolveArtifactResolutionRequest(
  context: ArtifactResolutionContext,
  request: ArtifactResolutionRequest,
  options: ArtifactResolutionOptions = {},
): Promise<ArtifactResolutionResult> {
  const normalizedRequest = compactRequest(request);
  const contentMode = options.contentMode ?? "bytes";

  rejectUnsupportedRequestForms(normalizedRequest);
  rejectContradictoryRequest(normalizedRequest);

  if (normalizedRequest.targetLocalRelativePath !== undefined) {
    return await resolveDirectTargetLocalRelativePath(
      context,
      normalizedRequest,
      contentMode,
    );
  }

  if (normalizedRequest.targetLocatedFileIri !== undefined) {
    return await resolveExactLocatedFile(
      context,
      normalizedRequest,
      contentMode,
    );
  }

  if (normalizedRequest.targetArtifactIri !== undefined) {
    if (normalizedRequest.targetHistoricalStateIri !== undefined) {
      return await resolveExactHistoricalState(
        context,
        normalizedRequest,
        contentMode,
      );
    }
    if (
      normalizedRequest.mode === "latestState" ||
      normalizedRequest.targetArtifactHistoryIri !== undefined
    ) {
      return await resolveTargetArtifactLatestState(
        context,
        normalizedRequest,
        contentMode,
      );
    }
    return await resolveTargetArtifactWorking(
      context,
      normalizedRequest,
      contentMode,
    );
  }

  if (normalizedRequest.targetHistoricalStateIri !== undefined) {
    throw new ArtifactResolutionError(
      `${
        describeRequest(normalizedRequest)
      } declares targetHistoricalState without targetArtifact; this resolver slice requires the target artifact for ownership checks.`,
    );
  }

  throw new ArtifactResolutionError(
    `${
      describeRequest(normalizedRequest)
    } does not declare a supported target locator.`,
  );
}

function rejectUnsupportedRequestForms(
  request: ArtifactResolutionRequest,
): void {
  if (request.targetAccessUrl !== undefined) {
    throw new ArtifactResolutionError(
      `${
        describeRequest(request)
      } declares targetAccessUrl, which ordinary artifact resolution does not fetch.`,
      { kind: "unsupported" },
    );
  }
  if (request.targetRepositorySourceTerm !== undefined) {
    throw new ArtifactResolutionError(
      `${
        describeRequest(request)
      } declares targetRepositorySource, which this resolver slice does not fetch or map to local checkouts.`,
      { kind: "unsupported" },
    );
  }
  if (request.repositorySourceFloatingLocatorTerm !== undefined) {
    throw new ArtifactResolutionError(
      `${
        describeRequest(request)
      } declares hasRepositorySourceFloatingLocator directly on the resolution spec, which this resolver slice does not support yet.`,
      { kind: "unsupported" },
    );
  }
  if (request.fallbackArtifactResolutionSpecTerm !== undefined) {
    throw new ArtifactResolutionError(
      `${
        describeRequest(request)
      } declares hasFallbackArtifactResolutionSpec, which this resolver slice does not support yet.`,
      { kind: "unsupported" },
    );
  }
  if (request.targetManifestationIri !== undefined) {
    throw new ArtifactResolutionError(
      `${
        describeRequest(request)
      } declares targetManifestation, which this resolver slice does not support yet.`,
      { kind: "unsupported" },
    );
  }
}

function rejectContradictoryRequest(request: ArtifactResolutionRequest): void {
  if (
    request.targetLocalRelativePath !== undefined &&
    (request.targetArtifactIri !== undefined ||
      request.targetArtifactHistoryIri !== undefined ||
      request.targetHistoricalStateIri !== undefined ||
      request.targetLocatedFileIri !== undefined)
  ) {
    throw new ArtifactResolutionError(
      `${
        describeRequest(request)
      } declares targetLocalRelativePath with another target locator; this resolver requires one independent locator.`,
    );
  }
  if (
    request.targetLocatedFileIri !== undefined &&
    (request.targetArtifactIri !== undefined ||
      request.targetArtifactHistoryIri !== undefined ||
      request.targetHistoricalStateIri !== undefined)
  ) {
    throw new ArtifactResolutionError(
      `${
        describeRequest(request)
      } declares targetLocatedFile with another target locator; this resolver requires one independent locator.`,
    );
  }
  if (
    request.mode === "working" &&
    (request.targetArtifactHistoryIri !== undefined ||
      request.targetHistoricalStateIri !== undefined)
  ) {
    throw new ArtifactResolutionError(
      `${
        describeRequest(request)
      } requests working resolution with exact or history coordinates.`,
    );
  }
  if (
    request.mode === "latestState" &&
    request.targetHistoricalStateIri !== undefined
  ) {
    throw new ArtifactResolutionError(
      `${
        describeRequest(request)
      } requests latest-state mode with an exact targetHistoricalState.`,
    );
  }
}

async function resolveDirectTargetLocalRelativePath(
  context: ArtifactResolutionContext,
  request: ArtifactResolutionRequest,
  contentMode: ArtifactResolutionContentMode,
): Promise<ArtifactResolutionResult> {
  const localRelativePath = normalizeLocalRelativePath(
    request.targetLocalRelativePath!,
    SFLO_TARGET_LOCAL_RELATIVE_PATH_IRI,
    request,
  );
  const absolutePath = resolvePolicyPath(
    context.localPathPolicy,
    "targetLocalRelativePath",
    localRelativePath,
    request,
  );

  return await resultForResolvedPath(
    context,
    request,
    {
      localRelativePath,
    },
    absolutePath,
    contentMode,
  );
}

async function resolveExactLocatedFile(
  context: ArtifactResolutionContext,
  request: ArtifactResolutionRequest,
  contentMode: ArtifactResolutionContentMode,
): Promise<ArtifactResolutionResult> {
  const localRelativePath = requireMeshPathFromIri(
    context.meshBase,
    request.targetLocatedFileIri!,
    `${describeRequest(request)} targetLocatedFile must be an in-mesh IRI.`,
  );
  const absolutePath = resolvePolicyPath(
    context.localPathPolicy,
    "workingLocalRelativePath",
    localRelativePath,
    request,
  );

  return await resultForResolvedPath(
    context,
    request,
    {
      locatedFileIri: request.targetLocatedFileIri,
      localRelativePath,
    },
    absolutePath,
    contentMode,
  );
}

async function resolveTargetArtifactWorking(
  context: ArtifactResolutionContext,
  request: ArtifactResolutionRequest,
  contentMode: ArtifactResolutionContentMode,
): Promise<ArtifactResolutionResult> {
  const inventory = await loadTargetArtifactInventory(context, request);
  const working = resolveTargetArtifactWorkingSource(inventory, request);
  const absolutePath = working.repositorySourceFloatingLocator
    ? await resolveRepositorySourceFloatingPath(
      context.localPathPolicy,
      working.repositorySourceFloatingLocator,
      request,
    )
    : resolvePolicyPath(
      context.localPathPolicy,
      "workingLocalRelativePath",
      working.workingLocalRelativePath,
      request,
    );

  return await resultForResolvedPath(
    context,
    request,
    {
      ...(working.workingLocatedFilePath
        ? {
          locatedFileIri:
            new URL(working.workingLocatedFilePath, context.meshBase).href,
        }
        : {}),
      localRelativePath: working.workingLocalRelativePath,
    },
    absolutePath,
    contentMode,
  );
}

async function resolveTargetArtifactLatestState(
  context: ArtifactResolutionContext,
  request: ArtifactResolutionRequest,
  contentMode: ArtifactResolutionContentMode,
): Promise<ArtifactResolutionResult> {
  const inventory = await loadTargetArtifactInventory(context, request);
  if (inventory.target.kind !== "payload") {
    throw new ArtifactResolutionError(
      `${
        describeRequest(request)
      } requests latest-state resolution for ${inventory.target.artifactPath}; this resolver slice supports latest-state targetArtifact only for payload artifacts.`,
      { kind: "unsupported" },
    );
  }

  const latest = resolvePayloadLatestState(
    context.meshBase,
    inventory,
    request,
  );
  const absolutePath = resolvePolicyPath(
    context.localPathPolicy,
    "workingLocalRelativePath",
    latest.snapshotPath,
    request,
  );

  return await resultForResolvedPath(
    context,
    request,
    {
      historicalStateIri: latest.stateIri,
      ...(latest.locatedFileWasAsserted
        ? { locatedFileIri: latest.locatedFileIri }
        : {}),
      localRelativePath: latest.snapshotPath,
    },
    absolutePath,
    contentMode,
  );
}

async function resolveExactHistoricalState(
  context: ArtifactResolutionContext,
  request: ArtifactResolutionRequest,
  contentMode: ArtifactResolutionContentMode,
): Promise<ArtifactResolutionResult> {
  const inventory = await loadTargetArtifactInventory(context, request);
  if (inventory.target.kind !== "payload") {
    throw new ArtifactResolutionError(
      `${
        describeRequest(request)
      } requests exact state resolution for ${inventory.target.artifactPath}; this resolver slice supports targetHistoricalState only for payload artifacts.`,
      { kind: "unsupported" },
    );
  }

  const exact = resolvePayloadExactState(context.meshBase, inventory, request);
  const absolutePath = resolvePolicyPath(
    context.localPathPolicy,
    "workingLocalRelativePath",
    exact.snapshotPath,
    request,
  );

  return await resultForResolvedPath(
    context,
    request,
    {
      historicalStateIri: exact.stateIri,
      ...(exact.locatedFileWasAsserted
        ? { locatedFileIri: exact.locatedFileIri }
        : {}),
      localRelativePath: exact.snapshotPath,
    },
    absolutePath,
    contentMode,
  );
}

async function resultForResolvedPath(
  context: ArtifactResolutionContext,
  request: ArtifactResolutionRequest,
  observed: ArtifactResolutionObservedCoordinates,
  absolutePath: string,
  contentMode: ArtifactResolutionContentMode,
): Promise<ArtifactResolutionResult> {
  if (contentMode === "none") {
    if (request.expectedContentDigest !== undefined) {
      throw new ArtifactResolutionError(
        `${
          describeRequest(request)
        } declares expectsContentDigest, but contentMode=none cannot verify it.`,
      );
    }
    return {
      requested: request,
      observed,
    };
  }

  const bytes = await readResolvedBytes(context, absolutePath, request);
  const contentDigest = await sha256Digest(bytes);
  verifyExpectedDigest(request, contentDigest);
  return {
    requested: request,
    observed: {
      ...observed,
      contentDigest,
    },
    content: {
      bytes,
      ...(contentMode === "text" ? { text: decodeUtf8(bytes, request) } : {}),
    },
  };
}

async function readResolvedBytes(
  context: ArtifactResolutionContext,
  absolutePath: string,
  request: ArtifactResolutionRequest,
): Promise<Uint8Array> {
  const stagedContents = context.overlay?.get(absolutePath);
  if (stagedContents !== undefined) {
    return new TextEncoder().encode(stagedContents);
  }

  try {
    return await Deno.readFile(absolutePath);
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      throw new ArtifactResolutionError(
        `${
          describeRequest(request)
        } resolved to a missing local file: ${absolutePath}`,
        { kind: "unavailable" },
      );
    }
    throw error;
  }
}

function decodeUtf8(
  bytes: Uint8Array,
  request: ArtifactResolutionRequest,
): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch (error) {
    throw new ArtifactResolutionError(
      `${describeRequest(request)} resolved bytes are not valid UTF-8 text.`,
      { cause: error, kind: "decodeFailure" },
    );
  }
}

function resolveInventoryState<T>(
  resolve: () => T,
  parseErrorMessage: string,
  missingWorkingFileMessage: string,
): T {
  try {
    return resolve();
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === missingWorkingFileMessage) {
        throw new ArtifactResolutionError(error.message, {
          kind: "unavailable",
          cause: error,
        });
      }
      if (error.message === parseErrorMessage) {
        throw new ArtifactResolutionError(error.message, {
          kind: "validation",
          cause: error,
        });
      }
    }
    throw error;
  }
}

function resolveTargetArtifactWorkingSource(
  inventory: TargetArtifactInventory,
  request: ArtifactResolutionRequest,
): {
  workingLocalRelativePath: string;
  workingLocatedFilePath?: string;
  repositorySourceFloatingLocator?: RepositorySourceFloatingLocatorState;
} {
  const parseErrorMessage = `${
    describeRequest(request)
  } could not parse the target artifact inventory.`;
  const missingWorkingFileMessage = `${
    describeRequest(request)
  } target artifact is missing a current working file.`;

  if (inventory.target.kind === "payload") {
    const state = resolveInventoryState(
      () =>
        resolvePayloadArtifactInventoryState(
          inventory.meshBase,
          inventory.turtle,
          inventory.target.designatorPath,
          {
            parseErrorMessage,
            missingWorkingFileMessage,
          },
        ),
      parseErrorMessage,
      missingWorkingFileMessage,
    );
    if (!state) {
      throw new ArtifactResolutionError(
        `${
          describeRequest(request)
        } target payload artifact is not registered in its owning Knop inventory: ${inventory.target.artifactPath}`,
      );
    }
    return {
      workingLocalRelativePath: state.workingLocalRelativePath,
      ...(state.workingLocatedFilePath
        ? { workingLocatedFilePath: state.workingLocatedFilePath }
        : {}),
      ...(state.repositorySourceFloatingLocator
        ? {
          repositorySourceFloatingLocator:
            state.repositorySourceFloatingLocator,
        }
        : {}),
    };
  }

  if (inventory.target.kind === "referenceCatalog") {
    const state = resolveInventoryState(
      () =>
        resolveReferenceCatalogInventoryState(
          inventory.meshBase,
          inventory.turtle,
          inventory.target.designatorPath,
          {
            parseErrorMessage,
            missingWorkingFileMessage,
          },
        ),
      parseErrorMessage,
      missingWorkingFileMessage,
    );
    if (!state) {
      throw new ArtifactResolutionError(
        `${
          describeRequest(request)
        } target ReferenceCatalog is not registered in its owning Knop inventory: ${inventory.target.artifactPath}`,
      );
    }
    return {
      workingLocalRelativePath: state.workingLocalRelativePath,
    };
  }

  const state = resolveInventoryState(
    () =>
      resolveResourcePageDefinitionInventoryState(
        inventory.meshBase,
        inventory.turtle,
        inventory.target.designatorPath,
        {
          parseErrorMessage,
          missingWorkingFileMessage,
        },
      ),
    parseErrorMessage,
    missingWorkingFileMessage,
  );
  if (!state || state.artifactPath !== inventory.target.artifactPath) {
    throw new ArtifactResolutionError(
      `${
        describeRequest(request)
      } target ResourcePageDefinition is not registered in its owning Knop inventory: ${inventory.target.artifactPath}`,
    );
  }

  return {
    workingLocalRelativePath: state.workingLocalRelativePath,
  };
}

function resolvePayloadLatestState(
  meshBase: string,
  inventory: TargetArtifactInventory,
  request: ArtifactResolutionRequest,
): {
  stateIri: string;
  statePath: string;
  snapshotPath: string;
  locatedFileIri: string;
  locatedFileWasAsserted: boolean;
} {
  const targetArtifactIri = request.targetArtifactIri!;
  const requestedHistoryIri = request.targetArtifactHistoryIri;
  const historyIri = requestedHistoryIri ??
    requiredNamedNodeObject(
      inventory.quads,
      targetArtifactIri,
      SFLO_CURRENT_ARTIFACT_HISTORY_IRI,
      `${
        describeRequest(request)
      } requests latest-state resolution for ${inventory.target.artifactPath}, but that artifact has no currentArtifactHistory.`,
      "unavailable",
    );
  const historyPath = requireMeshPathFromIri(
    meshBase,
    historyIri,
    `${
      describeRequest(request)
    } requests latest-state resolution outside the mesh: ${historyIri}.`,
  );
  assertHistoryBelongsToArtifact(
    inventory.quads,
    targetArtifactIri,
    historyIri,
    request,
  );
  assertTypedHistory(inventory.quads, historyIri, historyPath, request);

  const stateIri = requiredNamedNodeObject(
    inventory.quads,
    historyIri,
    SFLO_LATEST_HISTORICAL_STATE_IRI,
    `${
      describeRequest(request)
    } requests latest-state resolution for ${inventory.target.artifactPath}, but ${historyPath} has no latestHistoricalState.`,
    "unavailable",
  );
  return resolvePayloadStateSnapshot(
    meshBase,
    inventory,
    request,
    historyPath,
    stateIri,
  );
}

function resolvePayloadExactState(
  meshBase: string,
  inventory: TargetArtifactInventory,
  request: ArtifactResolutionRequest,
): {
  stateIri: string;
  statePath: string;
  snapshotPath: string;
  locatedFileIri: string;
  locatedFileWasAsserted: boolean;
} {
  const targetArtifactIri = request.targetArtifactIri!;
  const stateIri = request.targetHistoricalStateIri!;
  const statePath = requireMeshPathFromIri(
    meshBase,
    stateIri,
    `${describeRequest(request)} targetHistoricalState must be an in-mesh IRI.`,
  );
  const historyPath = request.targetArtifactHistoryIri !== undefined
    ? requireMeshPathFromIri(
      meshBase,
      request.targetArtifactHistoryIri,
      `${
        describeRequest(request)
      } targetArtifactHistory must be an in-mesh IRI.`,
    )
    : pathPosix.dirname(statePath);
  const historyIri = new URL(historyPath, meshBase).href;

  if (!statePath.startsWith(`${historyPath}/`)) {
    throw new ArtifactResolutionError(
      `${
        describeRequest(request)
      } targetHistoricalState ${statePath} is outside requested history ${historyPath}.`,
    );
  }
  assertHistoryBelongsToArtifact(
    inventory.quads,
    targetArtifactIri,
    historyIri,
    request,
  );
  assertTypedHistory(inventory.quads, historyIri, historyPath, request);
  assertStateBelongsToHistory(
    inventory.quads,
    historyIri,
    stateIri,
    statePath,
    request,
  );
  assertTypedHistoricalState(inventory.quads, stateIri, statePath, request);

  return resolvePayloadStateSnapshot(
    meshBase,
    inventory,
    request,
    historyPath,
    stateIri,
  );
}

function resolvePayloadStateSnapshot(
  meshBase: string,
  inventory: TargetArtifactInventory,
  request: ArtifactResolutionRequest,
  historyPath: string,
  stateIri: string,
): {
  stateIri: string;
  statePath: string;
  snapshotPath: string;
  locatedFileIri: string;
  locatedFileWasAsserted: boolean;
} {
  const statePath = requireMeshPathFromIri(
    meshBase,
    stateIri,
    `${describeRequest(request)} resolved state outside the mesh: ${stateIri}.`,
  );
  if (!statePath.startsWith(`${historyPath}/`)) {
    throw new ArtifactResolutionError(
      `${
        describeRequest(request)
      } resolved state ${statePath} outside requested history ${historyPath}.`,
    );
  }

  const locatedFileIri = optionalNamedNodeObject(
    inventory.quads,
    stateIri,
    SFLO_LOCATED_FILE_FOR_STATE_IRI,
    `${
      describeRequest(request)
    } has multiple locatedFileForState values for ${statePath}.`,
  );
  if (locatedFileIri !== undefined) {
    const snapshotPath = requireMeshPathFromIri(
      meshBase,
      locatedFileIri,
      `${
        describeRequest(request)
      } resolved located file outside the mesh: ${locatedFileIri}.`,
    );
    return {
      stateIri,
      statePath,
      snapshotPath,
      locatedFileIri,
      locatedFileWasAsserted: true,
    };
  }

  const working = resolveTargetArtifactWorkingSource(inventory, request);
  const snapshotPath = toPayloadHistoricalSnapshotPath(
    statePath,
    working.workingLocalRelativePath,
  );
  return {
    stateIri,
    statePath,
    snapshotPath,
    locatedFileIri: new URL(snapshotPath, meshBase).href,
    locatedFileWasAsserted: false,
  };
}

async function loadTargetArtifactInventory(
  context: ArtifactResolutionContext,
  request: ArtifactResolutionRequest,
): Promise<TargetArtifactInventory> {
  const artifactPath = requireMeshPathFromIri(
    context.meshBase,
    request.targetArtifactIri!,
    `${
      describeRequest(request)
    } targetArtifact must be an in-mesh governed artifact.`,
  );
  const target = describeSupportedTargetArtifact(artifactPath, request);
  const inventoryPath = join(
    context.meshRoot,
    toKnopPath(target.designatorPath),
    "_inventory/inventory.ttl",
  );
  const turtle = await readTextFile(context.overlay, inventoryPath, request);
  let quads: Quad[];
  try {
    quads = new Parser({ baseIRI: context.meshBase }).parse(turtle);
  } catch (error) {
    throw new ArtifactResolutionError(
      `${
        describeRequest(request)
      } could not parse target Knop inventory for ${target.artifactPath}.`,
      { cause: error },
    );
  }

  return { meshBase: context.meshBase, target, turtle, quads };
}

function describeSupportedTargetArtifact(
  artifactPath: string,
  request: ArtifactResolutionRequest,
): TargetArtifactDescriptor {
  if (
    artifactPath === ROOT_REFERENCE_CATALOG_PATH ||
    artifactPath.endsWith(REFERENCE_CATALOG_SUFFIX)
  ) {
    return {
      kind: "referenceCatalog",
      designatorPath: artifactPath === ROOT_REFERENCE_CATALOG_PATH
        ? ""
        : artifactPath.slice(0, -REFERENCE_CATALOG_SUFFIX.length),
      artifactPath,
    };
  }

  if (
    artifactPath === ROOT_PAGE_DEFINITION_ARTIFACT_PATH ||
    artifactPath.endsWith(PAGE_DEFINITION_ARTIFACT_SUFFIX)
  ) {
    return {
      kind: "resourcePageDefinition",
      designatorPath: artifactPath === ROOT_PAGE_DEFINITION_ARTIFACT_PATH
        ? ""
        : artifactPath.slice(0, -PAGE_DEFINITION_ARTIFACT_SUFFIX.length),
      artifactPath,
    };
  }

  try {
    return {
      kind: "payload",
      designatorPath: normalizeSafeDesignatorPath(
        artifactPath,
        "targetArtifact",
        (message) => new ArtifactResolutionError(message),
        { allowRoot: true },
      ),
      artifactPath,
    };
  } catch (error) {
    if (error instanceof ArtifactResolutionError) {
      throw new ArtifactResolutionError(
        `${
          describeRequest(request)
        } targets unsupported artifact ${artifactPath}; this resolver slice supports payload artifacts, ReferenceCatalog artifacts, and ResourcePageDefinition artifacts.`,
        { kind: "unsupported", cause: error },
      );
    }
    throw error;
  }
}

async function readTextFile(
  overlay: ReadonlyMap<string, string> | undefined,
  path: string,
  request: ArtifactResolutionRequest,
): Promise<string> {
  const staged = overlay?.get(path);
  if (staged !== undefined) {
    return staged;
  }
  try {
    return await Deno.readTextFile(path);
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      throw new ArtifactResolutionError(
        `${
          describeRequest(request)
        } target artifact inventory is missing: ${path}`,
        { kind: "unavailable" },
      );
    }
    throw error;
  }
}

function resolvePolicyPath(
  policy: OperationalLocalPathPolicy,
  locatorKind: "workingLocalRelativePath" | "targetLocalRelativePath",
  localRelativePath: string,
  request: ArtifactResolutionRequest,
): string {
  try {
    return resolveAllowedLocalPath(policy, locatorKind, localRelativePath);
  } catch (error) {
    if (error instanceof LocalPathAccessError) {
      throw new ArtifactResolutionError(
        `${
          describeRequest(request)
        } resolved ${locatorKind} outside the allowed local-path boundary: ${localRelativePath}`,
        { kind: "unsafe", cause: error },
      );
    }
    throw error;
  }
}

async function resolveRepositorySourceFloatingPath(
  policy: OperationalLocalPathPolicy,
  locator: RepositorySourceFloatingLocatorState,
  request: ArtifactResolutionRequest,
): Promise<string> {
  try {
    return await resolveRepositorySourceFloatingLocalPath(policy, locator);
  } catch (error) {
    if (error instanceof LocalPathAccessError) {
      throw new ArtifactResolutionError(
        `${
          describeRequest(request)
        } repository floating source did not match an allowed local checkout: ${locator.repositoryUrl} ${locator.repositoryPathFromRoot}`,
        { kind: "unsafe", cause: error },
      );
    }
    throw error;
  }
}

function assertHistoryBelongsToArtifact(
  quads: readonly Quad[],
  targetArtifactIri: string,
  historyIri: string,
  request: ArtifactResolutionRequest,
): void {
  if (
    !hasNamedNodeObject(
      quads,
      targetArtifactIri,
      SFLO_HAS_ARTIFACT_HISTORY_IRI,
      historyIri,
    ) &&
    !hasNamedNodeObject(
      quads,
      targetArtifactIri,
      SFLO_CURRENT_ARTIFACT_HISTORY_IRI,
      historyIri,
    )
  ) {
    throw new ArtifactResolutionError(
      `${
        describeRequest(request)
      } targetArtifactHistory is not a history of targetArtifact.`,
    );
  }
}

function assertTypedHistory(
  quads: readonly Quad[],
  historyIri: string,
  historyPath: string,
  request: ArtifactResolutionRequest,
): void {
  if (
    !hasNamedNodeObject(
      quads,
      historyIri,
      RDF_TYPE_IRI,
      SFLO_ARTIFACT_HISTORY_IRI,
    )
  ) {
    throw new ArtifactResolutionError(
      `${
        describeRequest(request)
      } target history is not declared as an ArtifactHistory: ${historyPath}`,
    );
  }
}

function assertStateBelongsToHistory(
  quads: readonly Quad[],
  historyIri: string,
  stateIri: string,
  statePath: string,
  request: ArtifactResolutionRequest,
): void {
  if (
    !hasNamedNodeObject(
      quads,
      historyIri,
      SFLO_HAS_HISTORICAL_STATE_IRI,
      stateIri,
    ) &&
    !hasNamedNodeObject(
      quads,
      historyIri,
      SFLO_LATEST_HISTORICAL_STATE_IRI,
      stateIri,
    )
  ) {
    throw new ArtifactResolutionError(
      `${
        describeRequest(request)
      } targetHistoricalState is not declared in targetArtifactHistory: ${statePath}`,
    );
  }
}

function assertTypedHistoricalState(
  quads: readonly Quad[],
  stateIri: string,
  statePath: string,
  request: ArtifactResolutionRequest,
): void {
  if (
    !hasNamedNodeObject(
      quads,
      stateIri,
      RDF_TYPE_IRI,
      SFLO_HISTORICAL_STATE_IRI,
    )
  ) {
    throw new ArtifactResolutionError(
      `${
        describeRequest(request)
      } targetHistoricalState is not declared as a HistoricalState: ${statePath}`,
    );
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

function requiredNamedNodeObject(
  quads: readonly Quad[],
  subjectIri: string,
  predicateIri: string,
  errorMessage: string,
  kind: ArtifactResolutionFailureKind = "validation",
): string {
  const value = optionalNamedNodeObject(
    quads,
    subjectIri,
    predicateIri,
    errorMessage,
  );
  if (value === undefined) {
    throw new ArtifactResolutionError(errorMessage, { kind });
  }
  return value;
}

function optionalNamedNodeObject(
  quads: readonly Quad[],
  subjectIri: string,
  predicateIri: string,
  errorMessage: string,
): string | undefined {
  const values = new Set<string>();
  for (const quad of quads) {
    if (
      quad.subject.termType === "NamedNode" &&
      quad.subject.value === subjectIri &&
      quad.predicate.value === predicateIri &&
      quad.object.termType === "NamedNode"
    ) {
      values.add(quad.object.value);
    }
  }
  if (values.size === 0) {
    return undefined;
  }
  if (values.size !== 1) {
    throw new ArtifactResolutionError(errorMessage);
  }
  return values.values().next().value!;
}

function requireMeshPathFromIri(
  meshBase: string,
  iri: string,
  errorMessage: string,
): string {
  if (!iri.startsWith(meshBase)) {
    throw new ArtifactResolutionError(errorMessage);
  }
  const meshPath = iri.slice(meshBase.length);
  if (meshPath.includes("#") || meshPath.includes("?")) {
    throw new ArtifactResolutionError(errorMessage);
  }
  return meshPath;
}

function normalizeLocalRelativePath(
  value: string,
  predicateIri: string,
  request: ArtifactResolutionRequest,
): string {
  const trimmed = value.trim();
  if (
    trimmed.length === 0 ||
    trimmed.includes("\\") ||
    trimmed.includes("?") ||
    trimmed.includes("#") ||
    pathPosix.isAbsolute(trimmed) ||
    /^[A-Za-z]:/.test(trimmed)
  ) {
    throw new ArtifactResolutionError(
      `${describeRequest(request)} has invalid ${predicateIri} value: ${value}`,
    );
  }
  const normalized = pathPosix.normalize(trimmed);
  if (normalized === ".") {
    throw new ArtifactResolutionError(
      `${describeRequest(request)} has invalid ${predicateIri} value: ${value}`,
    );
  }
  return normalized;
}

function parseResolutionMode(
  modeIri: string,
  sourceDescription: string,
): ArtifactResolutionMode {
  switch (modeIri) {
    case SFLO_ARTIFACT_RESOLUTION_MODE_WORKING_IRI:
      return "working";
    case SFLO_ARTIFACT_RESOLUTION_MODE_LATEST_STATE_IRI:
      return "latestState";
    default:
      throw new ArtifactResolutionError(
        `Unsupported ArtifactResolutionMode in ${sourceDescription}: ${modeIri}`,
        { kind: "unsupported" },
      );
  }
}

function optionalUniqueNamedNodeObject(
  quads: readonly Quad[],
  subjectKey: string,
  predicateIri: string,
  sourceDescription: string,
): string | undefined {
  const values = collectObjectTerms(quads, subjectKey, predicateIri)
    .filter((term) => term.startsWith("NamedNode:"))
    .map((term) => term.slice("NamedNode:".length));
  return optionalUnique(values, predicateIri, sourceDescription);
}

function optionalUniqueLiteralObject(
  quads: readonly Quad[],
  subjectKey: string,
  predicateIri: string,
  sourceDescription: string,
): string | undefined {
  const values = collectObjectTerms(quads, subjectKey, predicateIri)
    .filter((term) => term.startsWith("Literal:"))
    .map((term) => term.slice("Literal:".length));
  return optionalUnique(values, predicateIri, sourceDescription);
}

function optionalUniqueResourceObject(
  quads: readonly Quad[],
  subjectKey: string,
  predicateIri: string,
  sourceDescription: string,
): string | undefined {
  const values = collectObjectTerms(quads, subjectKey, predicateIri)
    .filter((term) =>
      term.startsWith("NamedNode:") || term.startsWith("BlankNode:")
    );
  return optionalUnique(values, predicateIri, sourceDescription);
}

function optionalUnique(
  values: readonly string[],
  predicateIri: string,
  sourceDescription: string,
): string | undefined {
  const uniqueValues = new Set(values);
  if (uniqueValues.size === 0) {
    return undefined;
  }
  if (uniqueValues.size !== 1) {
    throw new ArtifactResolutionError(
      `Expected at most one ${predicateIri} value in ${sourceDescription}.`,
    );
  }
  return uniqueValues.values().next().value!;
}

function collectObjectTerms(
  quads: readonly Quad[],
  subjectKey: string,
  predicateIri: string,
): readonly string[] {
  const values = new Set<string>();
  for (const quad of quads) {
    if (
      toTermKey(quad.subject) !== subjectKey ||
      quad.predicate.value !== predicateIri
    ) {
      continue;
    }
    if (quad.object.termType === "Literal") {
      values.add(`Literal:${quad.object.value}`);
      continue;
    }
    values.add(toTermKey(quad.object));
  }
  return [...values];
}

function termKeyFromSubjectString(subject: string): string {
  return subject.startsWith("NamedNode:") || subject.startsWith("BlankNode:")
    ? subject
    : `NamedNode:${subject}`;
}

function toTermKey(term: Term): string {
  return `${term.termType}:${term.value}`;
}

function compactRequest(
  request: ArtifactResolutionRequest,
): ArtifactResolutionRequest {
  return {
    ...(request.sourceTerm ? { sourceTerm: request.sourceTerm } : {}),
    ...(request.sourceIri ? { sourceIri: request.sourceIri } : {}),
    ...(request.sourceDescription
      ? { sourceDescription: request.sourceDescription }
      : {}),
    ...(request.targetArtifactIri
      ? { targetArtifactIri: request.targetArtifactIri }
      : {}),
    ...(request.targetArtifactHistoryIri
      ? { targetArtifactHistoryIri: request.targetArtifactHistoryIri }
      : {}),
    ...(request.targetHistoricalStateIri
      ? { targetHistoricalStateIri: request.targetHistoricalStateIri }
      : {}),
    ...(request.targetManifestationIri
      ? { targetManifestationIri: request.targetManifestationIri }
      : {}),
    ...(request.targetLocatedFileIri
      ? { targetLocatedFileIri: request.targetLocatedFileIri }
      : {}),
    ...(request.targetLocalRelativePath
      ? { targetLocalRelativePath: request.targetLocalRelativePath }
      : {}),
    ...(request.targetAccessUrl
      ? { targetAccessUrl: request.targetAccessUrl }
      : {}),
    ...(request.targetRepositorySourceTerm
      ? { targetRepositorySourceTerm: request.targetRepositorySourceTerm }
      : {}),
    ...(request.repositorySourceFloatingLocatorTerm
      ? {
        repositorySourceFloatingLocatorTerm:
          request.repositorySourceFloatingLocatorTerm,
      }
      : {}),
    ...(request.fallbackArtifactResolutionSpecTerm
      ? {
        fallbackArtifactResolutionSpecTerm:
          request.fallbackArtifactResolutionSpecTerm,
      }
      : {}),
    ...(request.mode ? { mode: request.mode } : {}),
    ...(request.expectedContentDigest
      ? { expectedContentDigest: request.expectedContentDigest }
      : {}),
  };
}

function withoutFallbackSpec(
  request: ArtifactResolutionRequest,
): ArtifactResolutionRequest {
  const { fallbackArtifactResolutionSpecTerm: _fallback, ...rest } = request;
  return compactRequest(rest);
}

function isFallbackEligiblePrimary(
  request: ArtifactResolutionRequest,
  error: unknown,
): error is ArtifactResolutionError {
  return error instanceof ArtifactResolutionError &&
    error.kind === "unavailable" &&
    request.targetArtifactIri !== undefined &&
    (request.targetHistoricalStateIri !== undefined ||
      request.targetArtifactHistoryIri !== undefined ||
      request.mode === "latestState");
}

function describeRequest(request: ArtifactResolutionRequest): string {
  return request.sourceDescription ?? request.sourceIri ?? request.sourceTerm ??
    "ArtifactResolutionSpec";
}

function describeTermKey(termKey: string): string {
  if (termKey.startsWith("NamedNode:")) {
    return `<${termKey.slice("NamedNode:".length)}>`;
  }
  if (termKey.startsWith("BlankNode:")) {
    return `_:${termKey.slice("BlankNode:".length)}`;
  }
  return termKey;
}

function toPayloadHistoricalSnapshotPath(
  statePath: string,
  workingLocalRelativePath: string,
): string {
  const fileName = toFileName(workingLocalRelativePath);
  const manifestationSegment = toDefaultManifestationSegment(fileName);
  return appendMeshPath(
    appendMeshPath(statePath, manifestationSegment),
    fileName,
  );
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

async function sha256Digest(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    bytes.buffer.slice(
      bytes.byteOffset,
      bytes.byteOffset + bytes.byteLength,
    ) as ArrayBuffer,
  );
  const hex = [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return `sha256:${hex}`;
}

function verifyExpectedDigest(
  request: ArtifactResolutionRequest,
  observedDigest: string,
): void {
  if (request.expectedContentDigest === undefined) {
    return;
  }
  if (!/^sha256:[0-9a-fA-F]{64}$/.test(request.expectedContentDigest)) {
    throw new ArtifactResolutionError(
      `${
        describeRequest(request)
      } declares unsupported expectsContentDigest value: ${request.expectedContentDigest}`,
      { kind: "validation" },
    );
  }
  if (
    request.expectedContentDigest.toLowerCase() !== observedDigest.toLowerCase()
  ) {
    throw new ArtifactResolutionError(
      `${
        describeRequest(request)
      } digest mismatch: expected ${request.expectedContentDigest}, observed ${observedDigest}.`,
      { kind: "digestMismatch" },
    );
  }
}
