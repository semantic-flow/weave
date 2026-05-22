import type { Quad } from "n3";
import { SFLO_NAMESPACE } from "../rdf/namespaces.ts";
import { WeaveInputError } from "./errors.ts";
import {
  hasNamedNodeFact,
  resolveOptionalNamedNodePath,
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
): string {
  const currentStatePath = resolveOptionalNamedNodePath(
    quads,
    meshBase,
    historyPath,
    SFLO_LATEST_HISTORICAL_STATE_IRI,
    errorMessage,
  );
  if (!currentStatePath) {
    throw new WeaveInputError(errorMessage);
  }
  if (!currentStatePath.startsWith(`${historyPath}/`)) {
    throw new WeaveInputError(
      `Current payload historical state for ${designatorPath} was outside the current payload history: ${currentStatePath}`,
    );
  }

  return currentStatePath;
}
