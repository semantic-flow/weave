import { Parser, type Quad } from "n3";
import { SFLO_NAMESPACE } from "../rdf/namespaces.ts";
import type { ResourcePageHistoryGroupModel } from "./resource_page_models.ts";

const SFLO_HAS_ARTIFACT_HISTORY_IRI = `${SFLO_NAMESPACE}hasArtifactHistory`;
const SFLO_CURRENT_ARTIFACT_HISTORY_IRI =
  `${SFLO_NAMESPACE}currentArtifactHistory`;
const SFLO_HAS_HISTORICAL_STATE_IRI = `${SFLO_NAMESPACE}hasHistoricalState`;
const SFLO_LATEST_HISTORICAL_STATE_IRI =
  `${SFLO_NAMESPACE}latestHistoricalState`;
const SFLO_HAS_MANIFESTATION_IRI = `${SFLO_NAMESPACE}hasManifestation`;
const SFLO_LOCATED_FILE_FOR_MANIFESTATION_IRI =
  `${SFLO_NAMESPACE}locatedFileForManifestation`;
const SFLO_LOCATED_FILE_FOR_STATE_IRI = `${SFLO_NAMESPACE}locatedFileForState`;
const SFLO_HISTORY_ORDINAL_IRI = `${SFLO_NAMESPACE}historyOrdinal`;
const SFLO_STATE_ORDINAL_IRI = `${SFLO_NAMESPACE}stateOrdinal`;

export function collectHistoryGroupsByResourcePath(
  meshBase: string,
  inventoryTurtle: string,
  parseErrorMessage: string,
  createParseError: (message: string) => Error = (message) =>
    new Error(message),
): ReadonlyMap<string, readonly ResourcePageHistoryGroupModel[]> {
  const quads = parseInventoryQuads(
    meshBase,
    inventoryTurtle,
    parseErrorMessage,
    createParseError,
  );
  const groupsByResourcePath = new Map<
    string,
    ResolvedResourcePageHistoryGroupModel[]
  >();
  const historyGroupByPath = new Map<
    string,
    ResolvedResourcePageHistoryGroupModel
  >();
  const currentHistoryByArtifactPath = new Map<string, string>();
  const resolveHistoryGroup = (historyPath: string) => {
    const cached = historyGroupByPath.get(historyPath);
    if (cached) {
      return cached;
    }
    const historyGroup = resolveArtifactHistoryGroup(
      meshBase,
      quads,
      historyPath,
    );
    historyGroupByPath.set(historyPath, historyGroup);
    return historyGroup;
  };

  for (const quad of quads) {
    if (
      quad.subject.termType !== "NamedNode" ||
      (quad.predicate.value !== SFLO_HAS_ARTIFACT_HISTORY_IRI &&
        quad.predicate.value !== SFLO_CURRENT_ARTIFACT_HISTORY_IRI) ||
      quad.object.termType !== "NamedNode"
    ) {
      continue;
    }

    const artifactPath = toMeshPath(meshBase, quad.subject.value);
    const historyPath = toMeshPath(meshBase, quad.object.value);
    if (artifactPath === undefined || historyPath === undefined) {
      continue;
    }

    if (quad.predicate.value === SFLO_CURRENT_ARTIFACT_HISTORY_IRI) {
      currentHistoryByArtifactPath.set(artifactPath, historyPath);
    }
    addHistoryGroup(
      groupsByResourcePath,
      artifactPath,
      resolveHistoryGroup(historyPath),
    );
  }

  for (const quad of quads) {
    if (
      quad.subject.termType !== "NamedNode" ||
      quad.predicate.value !== SFLO_HAS_HISTORICAL_STATE_IRI ||
      quad.object.termType !== "NamedNode"
    ) {
      continue;
    }

    const historyPath = toMeshPath(meshBase, quad.subject.value);
    if (historyPath === undefined) {
      continue;
    }

    addHistoryGroup(
      groupsByResourcePath,
      historyPath,
      resolveHistoryGroup(historyPath),
    );
  }

  for (const historyGroups of [...groupsByResourcePath.values()]) {
    for (const historyGroup of historyGroups) {
      for (const state of historyGroup.states) {
        addHistoryGroup(groupsByResourcePath, state.path, historyGroup);
        if (state.manifestationPath) {
          addHistoryGroup(
            groupsByResourcePath,
            state.manifestationPath,
            historyGroup,
          );
        }
      }
    }
  }

  for (const [resourcePath, historyGroups] of groupsByResourcePath) {
    groupsByResourcePath.set(
      resourcePath,
      sortHistoryGroupsByRecency(
        historyGroups,
        currentHistoryByArtifactPath.get(resourcePath),
      ),
    );
  }

  return groupsByResourcePath;
}

export function mergeHistoryGroupsByResourcePath(
  ...maps: readonly ReadonlyMap<
    string,
    readonly ResourcePageHistoryGroupModel[]
  >[]
): ReadonlyMap<string, readonly ResourcePageHistoryGroupModel[]> {
  const merged = new Map<string, ResourcePageHistoryGroupModel[]>();

  for (const map of maps) {
    for (const [resourcePath, groups] of map) {
      const existing = merged.get(resourcePath) ?? [];
      const existingPaths = new Set(existing.map((group) => group.path));
      for (const group of groups) {
        if (!existingPaths.has(group.path)) {
          existing.push(group);
          existingPaths.add(group.path);
        }
      }
      merged.set(resourcePath, existing);
    }
  }

  return merged;
}

export function findHistoryStateForManifestation(
  resourcePath: string,
  historyGroups: readonly ResourcePageHistoryGroupModel[],
): ResourcePageHistoryGroupModel["states"][number] | undefined {
  for (const group of historyGroups) {
    const state = group.states.find((candidate) =>
      candidate.manifestationPath === resourcePath
    );
    if (state) {
      return state;
    }
  }
  return undefined;
}

export function findHistoryForState(
  resourcePath: string,
  historyGroups: readonly ResourcePageHistoryGroupModel[],
): ResourcePageHistoryGroupModel | undefined {
  return historyGroups.find((group) =>
    group.states.some((state) => state.path === resourcePath)
  );
}

export function isHistoryComponentResource(
  resourcePath: string,
  historyGroups: readonly ResourcePageHistoryGroupModel[],
): boolean {
  return historyGroups.some((group) =>
    group.path === resourcePath ||
    group.states.some((state) =>
      state.path === resourcePath ||
      state.manifestationPath === resourcePath ||
      state.locatedFilePath === resourcePath
    )
  );
}

interface ResolvedResourcePageHistoryGroupModel
  extends ResourcePageHistoryGroupModel {
  historyOrdinal?: number;
  latestStatePath?: string;
  latestStateOrdinal?: number;
}

function addHistoryGroup(
  groupsByResourcePath: Map<string, ResolvedResourcePageHistoryGroupModel[]>,
  resourcePath: string,
  historyGroup: ResolvedResourcePageHistoryGroupModel,
): void {
  const existingGroups = groupsByResourcePath.get(resourcePath) ?? [];
  if (existingGroups.some((group) => group.path === historyGroup.path)) {
    return;
  }
  groupsByResourcePath.set(resourcePath, [...existingGroups, historyGroup]);
}

function sortHistoryGroupsByRecency(
  historyGroups: readonly ResolvedResourcePageHistoryGroupModel[],
  currentHistoryPath?: string,
): ResolvedResourcePageHistoryGroupModel[] {
  return [...historyGroups].sort((left, right) =>
    compareHistoryGroupRecency(left, right, currentHistoryPath)
  );
}

function compareHistoryGroupRecency(
  left: ResolvedResourcePageHistoryGroupModel,
  right: ResolvedResourcePageHistoryGroupModel,
  currentHistoryPath?: string,
): number {
  if (left.path === currentHistoryPath && right.path !== currentHistoryPath) {
    return -1;
  }
  if (right.path === currentHistoryPath && left.path !== currentHistoryPath) {
    return 1;
  }
  if (
    left.historyOrdinal !== undefined &&
    right.historyOrdinal !== undefined &&
    left.historyOrdinal !== right.historyOrdinal
  ) {
    return right.historyOrdinal - left.historyOrdinal;
  }
  if (
    left.latestStateOrdinal !== undefined &&
    right.latestStateOrdinal !== undefined &&
    left.latestStateOrdinal !== right.latestStateOrdinal
  ) {
    return right.latestStateOrdinal - left.latestStateOrdinal;
  }
  return 0;
}

function resolveArtifactHistoryGroup(
  meshBase: string,
  quads: readonly Quad[],
  historyPath: string,
): ResolvedResourcePageHistoryGroupModel {
  const historyIri = new URL(historyPath, meshBase).href;
  const statePaths = new Set<string>();
  const historyOrdinal = resolveOptionalNonNegativeIntegerLiteral(
    quads,
    historyIri,
    SFLO_HISTORY_ORDINAL_IRI,
  );
  const assertedLatestStatePath = resolveFirstMeshPathObject(
    meshBase,
    quads,
    historyIri,
    SFLO_LATEST_HISTORICAL_STATE_IRI,
  );

  for (const quad of quads) {
    if (
      quad.subject.termType === "NamedNode" &&
      quad.subject.value === historyIri &&
      quad.predicate.value === SFLO_HAS_HISTORICAL_STATE_IRI &&
      quad.object.termType === "NamedNode"
    ) {
      const statePath = toMeshPath(meshBase, quad.object.value);
      if (statePath) {
        statePaths.add(statePath);
      }
    }
  }

  const sortedStatePaths = [...statePaths].sort((left, right) =>
    left.localeCompare(right)
  );
  const latestStatePath = assertedLatestStatePath ??
    sortedStatePaths[sortedStatePaths.length - 1];
  const latestStateOrdinal = latestStatePath
    ? resolveOptionalNonNegativeIntegerLiteral(
      quads,
      new URL(latestStatePath, meshBase).href,
      SFLO_STATE_ORDINAL_IRI,
    )
    : undefined;

  return {
    label: "Artifact history",
    path: historyPath,
    ...(historyOrdinal === undefined ? {} : { historyOrdinal }),
    ...(latestStatePath === undefined ? {} : { latestStatePath }),
    ...(latestStateOrdinal === undefined ? {} : { latestStateOrdinal }),
    states: sortedStatePaths.map((statePath) =>
      resolveHistoricalStateModel(meshBase, quads, statePath)
    ),
  };
}

function resolveHistoricalStateModel(
  meshBase: string,
  quads: readonly Quad[],
  statePath: string,
): {
  path: string;
  manifestationPath?: string;
  locatedFilePath?: string;
} {
  const stateIri = new URL(statePath, meshBase).href;
  const shortcutLocatedFilePath = resolveFirstMeshPathObject(
    meshBase,
    quads,
    stateIri,
    SFLO_LOCATED_FILE_FOR_STATE_IRI,
  );
  const manifestationPath = resolveFirstMeshPathObject(
    meshBase,
    quads,
    stateIri,
    SFLO_HAS_MANIFESTATION_IRI,
  );
  const manifestationLocatedFilePath = manifestationPath
    ? resolveFirstMeshPathObject(
      meshBase,
      quads,
      new URL(manifestationPath, meshBase).href,
      SFLO_LOCATED_FILE_FOR_MANIFESTATION_IRI,
    )
    : undefined;

  return {
    path: statePath,
    ...(manifestationPath ? { manifestationPath } : {}),
    ...((shortcutLocatedFilePath ?? manifestationLocatedFilePath)
      ? {
        locatedFilePath: shortcutLocatedFilePath ??
          manifestationLocatedFilePath,
      }
      : {}),
  };
}

function resolveFirstMeshPathObject(
  meshBase: string,
  quads: readonly Quad[],
  subjectIri: string,
  predicateIri: string,
): string | undefined {
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
    if (meshPath) {
      return meshPath;
    }
  }
  return undefined;
}

function resolveOptionalNonNegativeIntegerLiteral(
  quads: readonly Quad[],
  subjectIri: string,
  predicateIri: string,
): number | undefined {
  for (const quad of quads) {
    if (
      quad.subject.termType !== "NamedNode" ||
      quad.subject.value !== subjectIri ||
      quad.predicate.value !== predicateIri ||
      quad.object.termType !== "Literal"
    ) {
      continue;
    }

    const value = quad.object.value;
    if (/^[0-9]+$/.test(value)) {
      return Number(value);
    }
  }
  return undefined;
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

function parseInventoryQuads(
  meshBase: string,
  inventoryTurtle: string,
  parseErrorMessage: string,
  createParseError: (message: string) => Error,
): readonly Quad[] {
  try {
    return new Parser({ baseIRI: meshBase }).parse(inventoryTurtle);
  } catch {
    throw createParseError(parseErrorMessage);
  }
}
