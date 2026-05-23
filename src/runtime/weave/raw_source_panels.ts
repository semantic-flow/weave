import { dirname, join } from "@std/path";
import { Parser, type Quad } from "n3";
import {
  toDesignatorResourcePagePath,
  toKnopPath,
} from "../../core/designator_segments.ts";
import { SFLO_NAMESPACE } from "../../core/rdf/namespaces.ts";
import type { RepositorySourceFloatingLocator } from "../../core/weave/source_models.ts";
import type {
  KnopArtifactLinkModel,
  ResourcePageRawSourcePanelModel,
} from "../../core/weave/resource_page_models.ts";
import {
  type ParsedResourceReferenceLink,
  SFLO_REFERENCE_ROLE_CANONICAL_IRI,
} from "../../core/weave/resource_page_reference_links.ts";
import { resolvePayloadArtifactInventoryState } from "../mesh/inventory.ts";
import {
  LocalPathAccessError,
  type OperationalLocalPathPolicy,
  resolveAllowedLocalPath,
  resolveRepositorySourceFloatingLocalPath,
} from "../operational/local_path_policy.ts";
import { toPayloadHistoricalSnapshotPath } from "./artifact_loaders.ts";
import { WeaveRuntimeError } from "./errors.ts";
import type { MeshState } from "./mesh_state.ts";

const SFLO_ARTIFACT_HISTORY_IRI = `${SFLO_NAMESPACE}ArtifactHistory`;
const SFLO_CURRENT_ARTIFACT_HISTORY_IRI =
  `${SFLO_NAMESPACE}currentArtifactHistory`;
const SFLO_LATEST_HISTORICAL_STATE_IRI =
  `${SFLO_NAMESPACE}latestHistoricalState`;
const SFLO_HAS_MANIFESTATION_IRI = `${SFLO_NAMESPACE}hasManifestation`;
const SFLO_LOCATED_FILE_FOR_MANIFESTATION_IRI =
  `${SFLO_NAMESPACE}locatedFileForManifestation`;
const SFLO_LOCATED_FILE_FOR_STATE_IRI = `${SFLO_NAMESPACE}locatedFileForState`;
const SFLO_HAS_WORKING_LOCATED_FILE_IRI =
  `${SFLO_NAMESPACE}hasWorkingLocatedFile`;
const SFLO_WORKING_FILE_PATH_IRI = `${SFLO_NAMESPACE}workingLocalRelativePath`;
const SFLO_ARTIFACT_RESOLUTION_MODE_WORKING_IRI =
  `${SFLO_NAMESPACE}artifactResolutionMode_working`;
const SFLO_ARTIFACT_RESOLUTION_MODE_LATEST_STATE_IRI =
  `${SFLO_NAMESPACE}artifactResolutionMode_latestState`;
const RDF_TYPE_IRI = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type";
const RAW_SOURCE_INLINE_BYTE_LIMIT = 1024 * 1024;

interface PayloadSourceArtifact {
  workingLocalRelativePath: string;
  repositorySourceFloatingLocator?: RepositorySourceFloatingLocator;
  latestHistoricalStatePath?: string;
  latestHistoricalSnapshotPath?: string;
  latestHistoricalSnapshotTurtle?: string;
}

export async function collectMeshSupportRawSourcePanels(
  workspaceRoot: string,
  meshState: MeshState,
): Promise<ReadonlyMap<string, readonly ResourcePageRawSourcePanelModel[]>> {
  const rawSourcePanels = new Map<
    string,
    readonly ResourcePageRawSourcePanelModel[]
  >();
  const quads = parseInventoryQuads(
    meshState.meshBase,
    meshState.currentMeshInventoryTurtle,
    "Could not parse the current MeshInventory while collecting mesh support source panels.",
  );

  if (
    !(await addLatestHistoricalRawSourcePanelForCurrentArtifact(
      rawSourcePanels,
      workspaceRoot,
      meshState.meshBase,
      quads,
      "_mesh/_inventory",
      "_mesh/_inventory/inventory.ttl",
      "_mesh/_inventory/index.html",
    ))
  ) {
    addRawSourcePanel(rawSourcePanels, "_mesh/_inventory/index.html", {
      label: "Current MeshInventory file",
      sourcePath: "_mesh/_inventory/inventory.ttl",
      contents: meshState.currentMeshInventoryTurtle,
    });
  }

  for (
    const support of [
      {
        artifactPath: "_mesh/_meta",
        pagePath: "_mesh/_meta/index.html",
        sourcePath: "_mesh/_meta/meta.ttl",
        label: "Current MeshMetadata file",
      },
      {
        artifactPath: "_mesh/_config",
        pagePath: "_mesh/_config/index.html",
        sourcePath: "_mesh/_config/config.ttl",
        label: "Current MeshConfig file",
      },
    ]
  ) {
    if (
      await addLatestHistoricalRawSourcePanelForCurrentArtifact(
        rawSourcePanels,
        workspaceRoot,
        meshState.meshBase,
        quads,
        support.artifactPath,
        support.sourcePath,
        support.pagePath,
      )
    ) {
      continue;
    }

    try {
      addRawSourcePanel(
        rawSourcePanels,
        support.pagePath,
        await readRawSourcePanel(
          join(workspaceRoot, support.sourcePath),
          support.sourcePath,
          support.label,
        ),
      );
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) {
        continue;
      }
      throw error;
    }
  }

  return rawSourcePanels;
}

export async function addCurrentKnopInventoryRawSourcePanel(
  rawSourcePanels: Map<string, readonly ResourcePageRawSourcePanelModel[]>,
  workspaceRoot: string,
  meshBase: string,
  quads: readonly Quad[],
  designatorPath: string,
  currentKnopInventoryTurtle: string,
): Promise<void> {
  const currentKnopInventoryPagePath = `${
    toKnopPath(designatorPath)
  }/_inventory/index.html`;
  const currentKnopInventoryWorkingPath = `${
    toKnopPath(designatorPath)
  }/_inventory/inventory.ttl`;
  if (
    !(await addLatestHistoricalRawSourcePanelForCurrentArtifact(
      rawSourcePanels,
      workspaceRoot,
      meshBase,
      quads,
      `${toKnopPath(designatorPath)}/_inventory`,
      currentKnopInventoryWorkingPath,
      currentKnopInventoryPagePath,
    ))
  ) {
    addRawSourcePanel(
      rawSourcePanels,
      currentKnopInventoryPagePath,
      {
        label: "Current KnopInventory file",
        sourcePath: currentKnopInventoryWorkingPath,
        contents: currentKnopInventoryTurtle,
      },
    );
  }
}

export function findRawSourcePanelsForPage(
  pagePath: string,
  contexts: readonly {
    rawSourcePanels: ReadonlyMap<
      string,
      readonly ResourcePageRawSourcePanelModel[]
    >;
  }[],
): readonly ResourcePageRawSourcePanelModel[] | undefined {
  for (const context of contexts) {
    const panels = context.rawSourcePanels.get(pagePath);
    if (panels) {
      return panels;
    }
  }
  return undefined;
}

export async function addSupportArtifactRawSourcePanels(
  rawSourcePanels: Map<string, readonly ResourcePageRawSourcePanelModel[]>,
  workspaceRoot: string,
  localPathPolicy: OperationalLocalPathPolicy,
  meshBase: string,
  quads: readonly Quad[],
  supportArtifacts: readonly KnopArtifactLinkModel[],
): Promise<void> {
  for (const artifact of supportArtifacts) {
    const pagePath = toDesignatorResourcePagePath(artifact.path);
    if (rawSourcePanels.has(pagePath)) {
      continue;
    }

    const workingLocalRelativePath = resolveArtifactWorkingLocalRelativePath(
      quads,
      meshBase,
      artifact.path,
    );
    if (!workingLocalRelativePath) {
      continue;
    }

    if (
      await addLatestHistoricalRawSourcePanelForCurrentArtifact(
        rawSourcePanels,
        workspaceRoot,
        meshBase,
        quads,
        artifact.path,
        workingLocalRelativePath,
        pagePath,
      )
    ) {
      continue;
    }

    try {
      addRawSourcePanel(
        rawSourcePanels,
        pagePath,
        await readRawSourcePanel(
          resolveAllowedLocalPath(
            localPathPolicy,
            "workingLocalRelativePath",
            workingLocalRelativePath,
          ),
          workingLocalRelativePath,
          `Current ${artifact.label} file`,
        ),
      );
    } catch (error) {
      if (
        error instanceof Deno.errors.NotFound ||
        error instanceof LocalPathAccessError
      ) {
        continue;
      }
      throw error;
    }
  }
}

export async function addPayloadRawSourcePanels(
  rawSourcePanels: Map<string, readonly ResourcePageRawSourcePanelModel[]>,
  workspaceRoot: string,
  meshBase: string,
  quads: readonly Quad[],
  designatorPath: string,
  payloadArtifact: PayloadSourceArtifact,
): Promise<void> {
  const currentPagePath = toDesignatorResourcePagePath(designatorPath);
  await addLatestHistoricalRawSourcePanelForCurrentArtifact(
    rawSourcePanels,
    workspaceRoot,
    meshBase,
    quads,
    designatorPath,
    payloadArtifact.workingLocalRelativePath,
    currentPagePath,
    payloadArtifact.latestHistoricalSnapshotPath,
    payloadArtifact.latestHistoricalSnapshotTurtle,
  );
}

export async function addReferenceTargetSourceRawSourcePanels(
  rawSourcePanels: Map<string, readonly ResourcePageRawSourcePanelModel[]>,
  workspaceRoot: string,
  localPathPolicy: OperationalLocalPathPolicy,
  meshBase: string,
  designatorPath: string,
  referenceLinks: readonly ParsedResourceReferenceLink[],
): Promise<void> {
  const seen = new Set<string>();

  for (const link of referenceLinks) {
    if (!link.roleIris.includes(SFLO_REFERENCE_ROLE_CANONICAL_IRI)) {
      continue;
    }

    for (const referenceTargetPath of link.referenceTargetPaths) {
      const key = `${referenceTargetPath}\u0000${
        link.referenceTargetStatePaths.join("\u0000")
      }`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);

      await addCanonicalReferenceSourceRawSourcePanel(
        rawSourcePanels,
        workspaceRoot,
        localPathPolicy,
        meshBase,
        designatorPath,
        referenceTargetPath,
        link.referenceTargetStatePaths[0],
      );
    }
  }
}

export async function addExtractionSourceRawSourcePanels(
  rawSourcePanels: Map<string, readonly ResourcePageRawSourcePanelModel[]>,
  workspaceRoot: string,
  localPathPolicy: OperationalLocalPathPolicy,
  meshBase: string,
  designatorPath: string,
  sourceArtifactPath: string,
  requestedTargetStatePath: string | undefined,
  artifactResolutionModeIri: string | undefined,
): Promise<void> {
  const sourceKnopInventoryPath = join(
    workspaceRoot,
    `${toKnopPath(sourceArtifactPath)}/_inventory/inventory.ttl`,
  );
  let sourceKnopInventoryTurtle: string;

  try {
    sourceKnopInventoryTurtle = await Deno.readTextFile(
      sourceKnopInventoryPath,
    );
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      throw new WeaveRuntimeError(
        `Workspace is missing the page source payload inventory for ${designatorPath}: ${
          toKnopPath(sourceArtifactPath)
        }/_inventory/inventory.ttl`,
      );
    }
    throw error;
  }

  const sourcePayloadArtifact = resolvePayloadArtifactInventoryState(
    meshBase,
    sourceKnopInventoryTurtle,
    sourceArtifactPath,
    {
      parseErrorMessage:
        `Could not parse the source Knop inventory while resolving page source facts for ${designatorPath}.`,
      missingWorkingFileMessage:
        `Could not resolve the source working payload file for ${designatorPath}.`,
    },
  );
  if (!sourcePayloadArtifact) {
    return;
  }

  if (artifactResolutionModeIri === SFLO_ARTIFACT_RESOLUTION_MODE_WORKING_IRI) {
    try {
      addRawSourcePanel(
        rawSourcePanels,
        toDesignatorResourcePagePath(designatorPath),
        await readRawSourcePanel(
          await resolvePayloadWorkingSourcePath(
            localPathPolicy,
            sourcePayloadArtifact,
          ),
          sourcePayloadArtifact.workingLocalRelativePath,
          "Working source file",
        ),
      );
    } catch (error) {
      if (
        error instanceof Deno.errors.NotFound ||
        error instanceof LocalPathAccessError
      ) {
        return;
      }
      throw error;
    }
    return;
  }

  if (
    artifactResolutionModeIri === SFLO_ARTIFACT_RESOLUTION_MODE_LATEST_STATE_IRI
  ) {
    requestedTargetStatePath = sourcePayloadArtifact.latestHistoricalStatePath;
  }
  if (!requestedTargetStatePath) {
    throw new WeaveRuntimeError(
      `Extracted page source for ${designatorPath} is missing an exact target state.`,
    );
  }

  const snapshotPath = sourcePayloadArtifact.latestHistoricalStatePath ===
        requestedTargetStatePath &&
      sourcePayloadArtifact.latestHistoricalSnapshotPath
    ? sourcePayloadArtifact.latestHistoricalSnapshotPath
    : toPayloadHistoricalSnapshotPath(
      requestedTargetStatePath,
      sourcePayloadArtifact.workingLocalRelativePath,
    );

  try {
    addRawSourcePanel(
      rawSourcePanels,
      toDesignatorResourcePagePath(designatorPath),
      await readRawSourcePanel(
        join(workspaceRoot, snapshotPath),
        snapshotPath,
        "Exact source file",
      ),
    );
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      throw new WeaveRuntimeError(
        `Workspace is missing the exact page source file for ${designatorPath}: ${snapshotPath}`,
      );
    }
    throw error;
  }
}

async function addLatestHistoricalRawSourcePanelForCurrentArtifact(
  rawSourcePanels: Map<string, readonly ResourcePageRawSourcePanelModel[]>,
  workspaceRoot: string,
  meshBase: string,
  quads: readonly Quad[],
  artifactPath: string,
  workingLocalRelativePath: string,
  currentPagePath: string,
  preloadedSnapshotPath?: string,
  preloadedSnapshotTurtle?: string,
): Promise<boolean> {
  const snapshotPath = resolvePreferredLatestHistoricalLocatedFilePath(
    quads,
    meshBase,
    artifactPath,
    workingLocalRelativePath,
  );
  if (!snapshotPath) {
    return false;
  }

  const latestHistoricalPanel = preloadedSnapshotPath === snapshotPath &&
      preloadedSnapshotTurtle !== undefined
    ? rawSourcePanelFromContents(
      snapshotPath,
      "Historical manifestation file",
      preloadedSnapshotTurtle,
    )
    : await readHistoricalRawSourcePanel(workspaceRoot, snapshotPath);
  if (!latestHistoricalPanel) {
    return false;
  }

  addRawSourcePanel(
    rawSourcePanels,
    currentPagePath,
    {
      ...latestHistoricalPanel,
      label: "Latest historical manifestation file",
    },
  );
  addRawSourcePanel(
    rawSourcePanels,
    `${dirname(latestHistoricalPanel.sourcePath)}/index.html`,
    latestHistoricalPanel,
  );
  return true;
}

async function addCanonicalReferenceSourceRawSourcePanel(
  rawSourcePanels: Map<string, readonly ResourcePageRawSourcePanelModel[]>,
  workspaceRoot: string,
  localPathPolicy: OperationalLocalPathPolicy,
  meshBase: string,
  designatorPath: string,
  referenceTargetPath: string,
  referenceTargetStatePath: string | undefined,
): Promise<void> {
  const sourceKnopInventoryPath = join(
    workspaceRoot,
    `${toKnopPath(referenceTargetPath)}/_inventory/inventory.ttl`,
  );
  let sourceKnopInventoryTurtle: string;

  try {
    sourceKnopInventoryTurtle = await Deno.readTextFile(
      sourceKnopInventoryPath,
    );
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      return;
    }
    throw error;
  }

  const sourcePayloadArtifact = resolvePayloadArtifactInventoryState(
    meshBase,
    sourceKnopInventoryTurtle,
    referenceTargetPath,
    {
      parseErrorMessage:
        `Could not parse the canonical reference target Knop inventory while resolving page source facts for ${designatorPath}.`,
      missingWorkingFileMessage:
        `Could not resolve the canonical reference target working payload file for ${designatorPath}.`,
    },
  );
  if (!sourcePayloadArtifact) {
    return;
  }

  if (!referenceTargetStatePath) {
    try {
      addRawSourcePanel(
        rawSourcePanels,
        toDesignatorResourcePagePath(designatorPath),
        await readRawSourcePanel(
          await resolvePayloadWorkingSourcePath(
            localPathPolicy,
            sourcePayloadArtifact,
          ),
          sourcePayloadArtifact.workingLocalRelativePath,
          "Current canonical reference source file",
        ),
      );
    } catch (error) {
      if (
        error instanceof Deno.errors.NotFound ||
        error instanceof LocalPathAccessError
      ) {
        return;
      }
      throw error;
    }
    return;
  }

  const snapshotPath = sourcePayloadArtifact.latestHistoricalStatePath ===
        referenceTargetStatePath &&
      sourcePayloadArtifact.latestHistoricalSnapshotPath
    ? sourcePayloadArtifact.latestHistoricalSnapshotPath
    : toPayloadHistoricalSnapshotPath(
      referenceTargetStatePath,
      sourcePayloadArtifact.workingLocalRelativePath,
    );

  try {
    addRawSourcePanel(
      rawSourcePanels,
      toDesignatorResourcePagePath(designatorPath),
      await readRawSourcePanel(
        join(workspaceRoot, snapshotPath),
        snapshotPath,
        "Exact canonical reference source file",
      ),
    );
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      return;
    }
    throw error;
  }
}

async function readHistoricalRawSourcePanel(
  workspaceRoot: string,
  snapshotPath: string,
): Promise<ResourcePageRawSourcePanelModel | undefined> {
  try {
    return await readRawSourcePanel(
      join(workspaceRoot, snapshotPath),
      snapshotPath,
      "Historical manifestation file",
    );
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      return undefined;
    }
    throw error;
  }
}

function resolvePreferredLatestHistoricalLocatedFilePath(
  quads: readonly Quad[],
  meshBase: string,
  artifactPath: string,
  workingLocalRelativePath: string,
): string | undefined {
  const artifactIri = new URL(artifactPath, meshBase).href;
  const currentHistoryPath = resolveOptionalUniqueNamedNodeMeshPath(
    quads,
    meshBase,
    artifactIri,
    SFLO_CURRENT_ARTIFACT_HISTORY_IRI,
  );
  if (!currentHistoryPath) {
    return undefined;
  }

  const currentHistoryIri = new URL(currentHistoryPath, meshBase).href;
  if (
    !hasNamedNodeObject(
      quads,
      currentHistoryIri,
      RDF_TYPE_IRI,
      SFLO_ARTIFACT_HISTORY_IRI,
    )
  ) {
    return undefined;
  }

  const latestHistoricalStatePath = resolveOptionalUniqueNamedNodeMeshPath(
    quads,
    meshBase,
    currentHistoryIri,
    SFLO_LATEST_HISTORICAL_STATE_IRI,
  );
  if (!latestHistoricalStatePath) {
    return undefined;
  }

  return resolvePreferredHistoricalStateLocatedFilePath(
    quads,
    meshBase,
    latestHistoricalStatePath,
    workingLocalRelativePath,
  );
}

function resolvePreferredHistoricalStateLocatedFilePath(
  quads: readonly Quad[],
  meshBase: string,
  historicalStatePath: string,
  workingLocalRelativePath: string,
): string | undefined {
  const historicalStateIri = new URL(historicalStatePath, meshBase).href;
  const locatedFilePaths = new Set<string>();
  const shortcutLocatedFilePath = resolveOptionalUniqueNamedNodeMeshPath(
    quads,
    meshBase,
    historicalStateIri,
    SFLO_LOCATED_FILE_FOR_STATE_IRI,
  );
  if (shortcutLocatedFilePath) {
    locatedFilePaths.add(shortcutLocatedFilePath);
  }

  for (
    const manifestationIri of findNamedNodeObjects(
      quads,
      historicalStateIri,
      SFLO_HAS_MANIFESTATION_IRI,
    )
  ) {
    const manifestationLocatedFilePath = resolveOptionalUniqueNamedNodeMeshPath(
      quads,
      meshBase,
      manifestationIri,
      SFLO_LOCATED_FILE_FOR_MANIFESTATION_IRI,
    );
    if (manifestationLocatedFilePath) {
      locatedFilePaths.add(manifestationLocatedFilePath);
    }
  }

  return selectPreferredLocatedFilePath(
    [...locatedFilePaths],
    workingLocalRelativePath,
  );
}

function selectPreferredLocatedFilePath(
  locatedFilePaths: readonly string[],
  workingLocalRelativePath: string,
): string | undefined {
  const sortedPaths = [...locatedFilePaths].sort((left, right) =>
    left.localeCompare(right)
  );
  const preferredExtension = toPathExtension(workingLocalRelativePath);
  if (preferredExtension) {
    const extensionMatchedPath = sortedPaths.find((path) =>
      toPathExtension(path) === preferredExtension
    );
    if (extensionMatchedPath) {
      return extensionMatchedPath;
    }
  }

  return sortedPaths[0];
}

async function resolvePayloadWorkingSourcePath(
  localPathPolicy: OperationalLocalPathPolicy,
  payloadArtifact: PayloadSourceArtifact,
): Promise<string> {
  return payloadArtifact.repositorySourceFloatingLocator
    ? await resolveRepositorySourceFloatingLocalPath(
      localPathPolicy,
      payloadArtifact.repositorySourceFloatingLocator,
    )
    : resolveAllowedLocalPath(
      localPathPolicy,
      "workingLocalRelativePath",
      payloadArtifact.workingLocalRelativePath,
    );
}

async function readRawSourcePanel(
  absolutePath: string,
  sourcePath: string,
  label: string,
): Promise<ResourcePageRawSourcePanelModel> {
  const info = await Deno.stat(absolutePath);
  if (info.size > RAW_SOURCE_INLINE_BYTE_LIMIT) {
    return {
      label,
      sourcePath,
      omittedByteLength: info.size,
    };
  }

  return {
    label,
    sourcePath,
    contents: await Deno.readTextFile(absolutePath),
  };
}

function rawSourcePanelFromContents(
  sourcePath: string,
  label: string,
  contents: string,
): ResourcePageRawSourcePanelModel {
  const byteLength = new TextEncoder().encode(contents).byteLength;
  if (byteLength > RAW_SOURCE_INLINE_BYTE_LIMIT) {
    return {
      label,
      sourcePath,
      omittedByteLength: byteLength,
    };
  }

  return {
    label,
    sourcePath,
    contents,
  };
}

function addRawSourcePanel(
  rawSourcePanels: Map<string, readonly ResourcePageRawSourcePanelModel[]>,
  pagePath: string,
  panel: ResourcePageRawSourcePanelModel,
): void {
  rawSourcePanels.set(pagePath, [
    ...(rawSourcePanels.get(pagePath) ?? []),
    panel,
  ]);
}

function resolveArtifactWorkingLocalRelativePath(
  quads: readonly Quad[],
  meshBase: string,
  artifactPath: string,
): string | undefined {
  const artifactIri = new URL(artifactPath, meshBase).href;
  const literalValue = resolveOptionalUniqueLiteralObject(
    quads,
    artifactIri,
    SFLO_WORKING_FILE_PATH_IRI,
  );
  const locatedFileValue = resolveOptionalUniqueNamedNodeMeshPath(
    quads,
    meshBase,
    artifactIri,
    SFLO_HAS_WORKING_LOCATED_FILE_IRI,
  );

  if (
    literalValue !== undefined &&
    locatedFileValue !== undefined &&
    literalValue !== locatedFileValue
  ) {
    return undefined;
  }

  return literalValue ?? locatedFileValue;
}

function resolveOptionalUniqueLiteralObject(
  quads: readonly Quad[],
  subjectIri: string,
  predicateIri: string,
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

  return values.size === 1 ? values.values().next().value! : undefined;
}

function resolveOptionalUniqueNamedNodeMeshPath(
  quads: readonly Quad[],
  meshBase: string,
  subjectIri: string,
  predicateIri: string,
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

    const meshPath = toMeshPath(meshBase, quad.object.value);
    if (meshPath !== undefined) {
      values.add(meshPath);
    }
  }

  return values.size === 1 ? values.values().next().value! : undefined;
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

function findNamedNodeObjects(
  quads: readonly Quad[],
  subjectIri: string,
  predicateIri: string,
): readonly string[] {
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

  return [...values].sort();
}

function parseInventoryQuads(
  meshBase: string,
  inventoryTurtle: string,
  parseErrorMessage: string,
): readonly Quad[] {
  try {
    return new Parser({ baseIRI: meshBase }).parse(inventoryTurtle);
  } catch {
    throw new WeaveRuntimeError(parseErrorMessage);
  }
}

function toMeshPath(meshBase: string, iri: string): string | undefined {
  const meshUrl = new URL(meshBase);
  const iriUrl = new URL(iri);
  if (iriUrl.origin !== meshUrl.origin) {
    return undefined;
  }
  const basePath = meshUrl.pathname.endsWith("/")
    ? meshUrl.pathname
    : `${meshUrl.pathname}/`;
  if (!iriUrl.pathname.startsWith(basePath)) {
    return undefined;
  }
  return decodeURIComponent(iriUrl.pathname.slice(basePath.length));
}

function toPathExtension(path: string): string | undefined {
  const fileName = toFileName(path);
  const extensionIndex = fileName.lastIndexOf(".");
  if (extensionIndex <= 0 || extensionIndex === fileName.length - 1) {
    return undefined;
  }

  return fileName.slice(extensionIndex + 1).toLowerCase();
}

function toFileName(path: string): string {
  const segments = path.split("/");
  return segments[segments.length - 1]!;
}
