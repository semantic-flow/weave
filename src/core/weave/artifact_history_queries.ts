import type { Quad } from "n3";
import { SFLO_NAMESPACE } from "../rdf/namespaces.ts";
import { WeaveInputError } from "./errors.ts";
import {
  hasNamedNodeFact,
  toAbsoluteIri,
  toMeshRelativePath,
} from "./rdf_helpers.ts";

const RDF_TYPE_IRI = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type";
const SFLO_ARTIFACT_HISTORY_IRI = `${SFLO_NAMESPACE}ArtifactHistory`;
const SFLO_LATEST_HISTORICAL_STATE_IRI =
  `${SFLO_NAMESPACE}latestHistoricalState`;

export function isDeclaredArtifactHistory(
  quads: readonly Quad[],
  meshBase: string,
  historyPath: string,
): boolean {
  return hasNamedNodeFact(
    quads,
    meshBase,
    historyPath,
    RDF_TYPE_IRI,
    SFLO_ARTIFACT_HISTORY_IRI,
  );
}

export function requirePayloadCurrentStatePathFromInventory(
  quads: readonly Quad[],
  meshBase: string,
  designatorPath: string,
  historyPath: string,
  errorMessage: string,
  diagnostics?: {
    missingMessage?: string;
    conflictMessage?: string;
  },
): string {
  const historyIri = toAbsoluteIri(meshBase, historyPath);
  const values = new Set<string>();
  for (const quad of quads) {
    if (
      quad.subject.termType === "NamedNode" &&
      quad.subject.value === historyIri &&
      quad.predicate.value === SFLO_LATEST_HISTORICAL_STATE_IRI &&
      quad.object.termType === "NamedNode"
    ) {
      values.add(toMeshRelativePath(meshBase, quad.object.value, errorMessage));
    }
  }
  if (values.size === 0) {
    throw new WeaveInputError(diagnostics?.missingMessage ?? errorMessage);
  }
  if (values.size > 1) {
    throw new WeaveInputError(diagnostics?.conflictMessage ?? errorMessage);
  }
  const currentStatePath = values.values().next().value!;
  if (!currentStatePath.startsWith(`${historyPath}/`)) {
    throw new WeaveInputError(
      `Current payload historical state for ${designatorPath} was outside the current payload history: ${currentStatePath}`,
    );
  }

  return currentStatePath;
}
