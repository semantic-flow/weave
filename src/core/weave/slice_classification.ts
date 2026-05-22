import type { Quad } from "n3";
import { toKnopPath } from "../designator_segments.ts";
import { SFCFG_NAMESPACE, SFLO_NAMESPACE } from "../rdf/namespaces.ts";
import type { NormalizedVersionTargetSpec } from "../targeting.ts";
import type { WeaveableKnopCandidate } from "./candidates.ts";
import { WeaveInputError } from "./errors.ts";
import {
  hasLiteralFact,
  hasNamedNodeFact,
  parseWeaveShapeQuads,
  resolveNamedNodeObjectPaths,
  resolveOptionalNamedNodePath,
  toAbsoluteIri,
} from "./rdf_helpers.ts";
import type { WeaveSlice } from "./slices.ts";
import {
  isDeclaredArtifactHistory,
  requirePayloadCurrentStatePathFromInventory,
} from "./artifact_history_queries.ts";

const XSD_NON_NEGATIVE_INTEGER_IRI =
  "http://www.w3.org/2001/XMLSchema#nonNegativeInteger";
const SFCFG_HAS_NEXT_STATE_SEGMENT_HINT_IRI =
  `${SFCFG_NAMESPACE}hasNextStateSegmentHint`;
const SFLO_HAS_EXTRACTION_SOURCE_IRI = `${SFLO_NAMESPACE}hasExtractionSource`;
const SFLO_HAS_RESOURCE_PAGE_DEFINITION_IRI =
  `${SFLO_NAMESPACE}hasResourcePageDefinition`;
const SFLO_CURRENT_ARTIFACT_HISTORY_IRI =
  `${SFLO_NAMESPACE}currentArtifactHistory`;
const SFLO_HAS_ARTIFACT_HISTORY_IRI = `${SFLO_NAMESPACE}hasArtifactHistory`;
const SFLO_HAS_HISTORICAL_STATE_IRI = `${SFLO_NAMESPACE}hasHistoricalState`;
const SFLO_HAS_PAYLOAD_ARTIFACT_IRI = `${SFLO_NAMESPACE}hasPayloadArtifact`;
const SFLO_HAS_REFERENCE_CATALOG_IRI = `${SFLO_NAMESPACE}hasReferenceCatalog`;
const SFLO_HAS_RESOURCE_PAGE_IRI = `${SFLO_NAMESPACE}hasResourcePage`;
const SFLO_LATEST_HISTORICAL_STATE_IRI =
  `${SFLO_NAMESPACE}latestHistoricalState`;
const SFLO_NEXT_STATE_ORDINAL_IRI = `${SFLO_NAMESPACE}nextStateOrdinal`;

export function classifyWeaveSlice(
  meshBase: string,
  candidate: WeaveableKnopCandidate,
  target?: NormalizedVersionTargetSpec,
): WeaveSlice | undefined {
  const slice = detectPendingWeaveSlice(
    meshBase,
    candidate.designatorPath,
    candidate.currentKnopInventoryTurtle,
    target,
  );

  if (
    slice === "firstExtractedKnopWeave" &&
    !candidate.referenceTargetSourcePayloadArtifact
  ) {
    throw new WeaveInputError(
      `Extracted weave candidate ${candidate.designatorPath} is missing its woven source payload state.`,
    );
  }

  if (
    slice === "firstReferenceCatalogWeave" &&
    !candidate.referenceCatalogArtifact
  ) {
    throw new WeaveInputError(
      `ReferenceCatalog weave candidate ${candidate.designatorPath} is missing working catalog state.`,
    );
  }

  if (
    slice === "pageDefinitionWeave" && !candidate.resourcePageDefinitionArtifact
  ) {
    throw new WeaveInputError(
      `ResourcePageDefinition weave candidate ${candidate.designatorPath} is missing working page-definition state.`,
    );
  }

  if (slice === "firstPayloadWeave" && !candidate.payloadArtifact) {
    throw new WeaveInputError(
      `Payload weave candidate ${candidate.designatorPath} is missing working payload state.`,
    );
  }

  if (slice === "secondPayloadWeave" && !candidate.payloadArtifact) {
    throw new WeaveInputError(
      `Payload weave candidate ${candidate.designatorPath} is missing working payload state.`,
    );
  }

  return slice;
}

export function detectPendingWeaveSlice(
  meshBase: string,
  designatorPath: string,
  currentKnopInventoryTurtle: string,
  target?: NormalizedVersionTargetSpec,
): WeaveSlice | undefined {
  const knopPath = toKnopPath(designatorPath);
  const referenceCatalogPath = `${knopPath}/_references`;
  const pageDefinitionPath = `${knopPath}/_page`;
  const errorMessage =
    `Could not parse the current KnopInventory while detecting the pending weave slice for ${designatorPath}.`;
  const quads = parseWeaveShapeQuads(
    meshBase,
    currentKnopInventoryTurtle,
    errorMessage,
  );
  const payloadRelationship = hasNamedNodeFact(
    quads,
    meshBase,
    knopPath,
    SFLO_HAS_PAYLOAD_ARTIFACT_IRI,
    designatorPath,
  );
  const payloadHistoryPath = resolveOptionalNamedNodePath(
    quads,
    meshBase,
    designatorPath,
    SFLO_CURRENT_ARTIFACT_HISTORY_IRI,
    errorMessage,
  );
  const payloadArtifactHistoryPaths = resolveNamedNodeObjectPaths(
    quads,
    meshBase,
    designatorPath,
    SFLO_HAS_ARTIFACT_HISTORY_IRI,
    errorMessage,
  );
  const payloadHasDeclaredArtifactHistory = [
    ...(payloadHistoryPath ? [payloadHistoryPath] : []),
    ...payloadArtifactHistoryPaths,
  ].some((historyPath) =>
    isDeclaredArtifactHistory(quads, meshBase, historyPath)
  );
  const extractionSourceRelationship = hasNamedNodeFact(
    quads,
    meshBase,
    knopPath,
    SFLO_HAS_EXTRACTION_SOURCE_IRI,
    `${knopPath}/_sources#extraction-source`,
  );
  const referenceCatalogRelationship = hasNamedNodeFact(
    quads,
    meshBase,
    knopPath,
    SFLO_HAS_REFERENCE_CATALOG_IRI,
    referenceCatalogPath,
  );
  const referenceCatalogHasHistory = hasNamedNodeFact(
    quads,
    meshBase,
    referenceCatalogPath,
    SFLO_HAS_ARTIFACT_HISTORY_IRI,
    `${referenceCatalogPath}/_history001`,
  );
  const referenceCatalogHasResourcePage = hasNamedNodeFact(
    quads,
    meshBase,
    referenceCatalogPath,
    SFLO_HAS_RESOURCE_PAGE_IRI,
    `${referenceCatalogPath}/index.html`,
  );
  const pageDefinitionRelationship = hasNamedNodeFact(
    quads,
    meshBase,
    knopPath,
    SFLO_HAS_RESOURCE_PAGE_DEFINITION_IRI,
    pageDefinitionPath,
  );
  const knopInventoryHasHistory = hasNamedNodeFact(
    quads,
    meshBase,
    `${knopPath}/_inventory`,
    SFLO_HAS_ARTIFACT_HISTORY_IRI,
    `${knopPath}/_inventory/_history001`,
  );
  const knopInventoryHasCurrentResourcePages = hasNamedNodeFact(
    quads,
    meshBase,
    knopPath,
    SFLO_HAS_RESOURCE_PAGE_IRI,
    `${knopPath}/index.html`,
  ) && hasNamedNodeFact(
    quads,
    meshBase,
    `${knopPath}/_inventory`,
    SFLO_HAS_RESOURCE_PAGE_IRI,
    `${knopPath}/_inventory/index.html`,
  );
  const knopInventoryIsWoven = knopInventoryHasHistory ||
    knopInventoryHasCurrentResourcePages;

  if (
    referenceCatalogRelationship &&
    knopInventoryIsWoven &&
    !referenceCatalogHasHistory &&
    !referenceCatalogHasResourcePage
  ) {
    return "firstReferenceCatalogWeave";
  }

  if (extractionSourceRelationship && !knopInventoryIsWoven) {
    return "firstExtractedKnopWeave";
  }

  if (pageDefinitionRelationship && knopInventoryHasHistory) {
    return "pageDefinitionWeave";
  }

  if (payloadRelationship && !payloadHasDeclaredArtifactHistory) {
    return "firstPayloadWeave";
  }

  if (
    payloadRelationship &&
    payloadHistoryPath &&
    !isDeclaredArtifactHistory(quads, meshBase, payloadHistoryPath) &&
    payloadHasDeclaredArtifactHistory
  ) {
    return "secondPayloadWeave";
  }

  if (
    payloadRelationship &&
    payloadHistoryPath &&
    isDeclaredArtifactHistory(quads, meshBase, payloadHistoryPath) &&
    hasNextStateSegmentHint(quads, meshBase, payloadHistoryPath)
  ) {
    return "secondPayloadWeave";
  }

  if (
    payloadRelationship &&
    payloadHistoryPath &&
    hasNamedNodeFact(
      quads,
      meshBase,
      payloadHistoryPath,
      SFLO_LATEST_HISTORICAL_STATE_IRI,
      requirePayloadCurrentStatePathFromInventory(
        quads,
        meshBase,
        designatorPath,
        payloadHistoryPath,
        errorMessage,
      ),
    ) &&
    hasLiteralFact(
      quads,
      meshBase,
      payloadHistoryPath,
      SFLO_NEXT_STATE_ORDINAL_IRI,
      "2",
      XSD_NON_NEGATIVE_INTEGER_IRI,
    ) &&
    (!knopInventoryHasHistory ||
      (hasNamedNodeFact(
        quads,
        meshBase,
        `${knopPath}/_inventory/_history001`,
        SFLO_LATEST_HISTORICAL_STATE_IRI,
        `${knopPath}/_inventory/_history001/_s0001`,
      ) &&
        !hasNamedNodeFact(
          quads,
          meshBase,
          `${knopPath}/_inventory/_history001`,
          SFLO_HAS_HISTORICAL_STATE_IRI,
          `${knopPath}/_inventory/_history001/_s0002`,
        )))
  ) {
    return "secondPayloadWeave";
  }

  if (
    payloadRelationship &&
    payloadHasDeclaredArtifactHistory &&
    knopInventoryHasHistory &&
    hasPayloadVersionNamingTarget(target)
  ) {
    return "secondPayloadWeave";
  }

  if (
    !knopInventoryHasHistory &&
    hasNamedNodeFact(
      quads,
      meshBase,
      knopPath,
      SFLO_HAS_RESOURCE_PAGE_IRI,
      `${knopPath}/index.html`,
    )
  ) {
    return undefined;
  }

  if (!knopInventoryHasHistory) {
    return "firstKnopWeave";
  }

  return undefined;
}

function hasNextStateSegmentHint(
  quads: readonly Quad[],
  meshBase: string,
  historyPath: string,
): boolean {
  const subjectIri = toAbsoluteIri(meshBase, historyPath);
  return quads.some((quad) =>
    quad.subject.termType === "NamedNode" &&
    quad.subject.value === subjectIri &&
    quad.predicate.value === SFCFG_HAS_NEXT_STATE_SEGMENT_HINT_IRI &&
    quad.object.termType === "Literal"
  );
}

function hasPayloadVersionNamingTarget(
  target?: NormalizedVersionTargetSpec,
): boolean {
  return target !== undefined &&
    (target.historySegment !== undefined ||
      target.stateSegment !== undefined ||
      target.manifestationSegment !== undefined);
}
