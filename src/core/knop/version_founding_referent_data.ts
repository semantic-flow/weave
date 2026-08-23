import { Parser, type Quad, type Term } from "n3";
import {
  toFoundingReferentDataPath,
  toKnopPath,
} from "../designator_segments.ts";
import type { PlannedBinaryFile, PlannedFile } from "../planned_file.ts";
import { sha256ContentDigest } from "../rdf/content_digest.ts";
import {
  RDF_NAMESPACE,
  SFLO_NAMESPACE,
  SFLO_TURTLE_PREFIX_DECLARATION,
  XSD_NAMESPACE,
} from "../rdf/namespaces.ts";
import {
  planInventoryAppend,
  prepareCurrentInventory,
  renderInventoryAppendPlan,
} from "../weave/inventory_append_planner.ts";
import {
  appendPredicateToSubjectBlock,
  splitTurtleBlocks,
} from "../weave/turtle_blocks.ts";
import { validateFoundingReferentData } from "./founding_referent_data.ts";

const RDF_TYPE_IRI = `${RDF_NAMESPACE}type`;
const XSD_NON_NEGATIVE_INTEGER_IRI = `${XSD_NAMESPACE}nonNegativeInteger`;
const SFLO_CURRENT_ARTIFACT_HISTORY_IRI =
  `${SFLO_NAMESPACE}currentArtifactHistory`;
const SFLO_DEFAULT_ARTIFACT_HISTORY_IRI =
  `${SFLO_NAMESPACE}defaultArtifactHistory`;
const SFLO_DIGITAL_ARTIFACT_IRI = `${SFLO_NAMESPACE}DigitalArtifact`;
const SFLO_FOUNDING_REFERENT_DATA_IRI = `${SFLO_NAMESPACE}FoundingReferentData`;
const SFLO_HAS_ARTIFACT_HISTORY_IRI = `${SFLO_NAMESPACE}hasArtifactHistory`;
const SFLO_HAS_CONTENT_DIGEST_IRI = `${SFLO_NAMESPACE}hasContentDigest`;
const SFLO_HAS_FOUNDING_REFERENT_DATA_IRI =
  `${SFLO_NAMESPACE}hasFoundingReferentData`;
const SFLO_HAS_MANIFESTATION_IRI = `${SFLO_NAMESPACE}hasManifestation`;
const SFLO_HAS_WORKING_LOCATED_FILE_IRI =
  `${SFLO_NAMESPACE}hasWorkingLocatedFile`;
const SFLO_HISTORY_ORDINAL_IRI = `${SFLO_NAMESPACE}historyOrdinal`;
const SFLO_LATEST_HISTORICAL_STATE_IRI =
  `${SFLO_NAMESPACE}latestHistoricalState`;
const SFLO_LOCATED_FILE_FOR_MANIFESTATION_IRI =
  `${SFLO_NAMESPACE}locatedFileForManifestation`;
const SFLO_LOCATED_FILE_FOR_STATE_IRI = `${SFLO_NAMESPACE}locatedFileForState`;
const SFLO_LOCATED_FILE_IRI = `${SFLO_NAMESPACE}LocatedFile`;
const SFLO_NEXT_HISTORY_ORDINAL_IRI = `${SFLO_NAMESPACE}nextHistoryOrdinal`;
const SFLO_NEXT_STATE_ORDINAL_IRI = `${SFLO_NAMESPACE}nextStateOrdinal`;
const SFLO_PREVIOUS_HISTORICAL_STATE_IRI =
  `${SFLO_NAMESPACE}previousHistoricalState`;
const SFLO_RDF_DOCUMENT_IRI = `${SFLO_NAMESPACE}RdfDocument`;
const SFLO_STATE_ORDINAL_IRI = `${SFLO_NAMESPACE}stateOrdinal`;

export interface PlanFoundingReferentDataVersionInput {
  meshBase: string;
  designatorPath: string;
  currentKnopInventoryTurtle: string;
  bytes: Uint8Array;
}

export interface FoundingReferentDataVersionPlan {
  meshBase: string;
  designatorPath: string;
  foundingReferentDataIri: string;
  historyIri: string;
  stateIri: string;
  manifestationIri: string;
  snapshotIri: string;
  snapshotPath: string;
  contentDigest: string;
  createdBinaryFiles: readonly PlannedBinaryFile[];
  updatedFiles: readonly PlannedFile[];
}

export class FoundingReferentDataVersionInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FoundingReferentDataVersionInputError";
  }
}

export async function planFoundingReferentDataVersion(
  input: PlanFoundingReferentDataVersionInput,
): Promise<FoundingReferentDataVersionPlan> {
  const validated = validateFoundingReferentData({
    meshBase: input.meshBase,
    designatorPath: input.designatorPath,
    bytes: input.bytes,
  });
  const knopPath = toKnopPath(input.designatorPath);
  const foundingPath = toFoundingReferentDataPath(input.designatorPath);
  const workingPath = `${foundingPath}/data.ttl`;
  const quads = parseInventory(
    input.meshBase,
    input.currentKnopInventoryTurtle,
  );
  assertFoundingInventoryBaseShape(
    input.meshBase,
    quads,
    knopPath,
    foundingPath,
    workingPath,
  );

  const historyPaths = namedObjectPaths(
    input.meshBase,
    quads,
    foundingPath,
    SFLO_HAS_ARTIFACT_HISTORY_IRI,
  );
  let stateOrdinal: number;
  let historyPath: string;
  let previousStatePath: string | undefined;
  let progressionTurtle = input.currentKnopInventoryTurtle;
  if (historyPaths.length === 0) {
    assertNoHistoryProgression(input.meshBase, quads, foundingPath);
    stateOrdinal = 1;
    historyPath = `${foundingPath}/_history001`;
  } else {
    if (historyPaths.length !== 1) {
      throw malformedInventory();
    }
    historyPath = historyPaths[0]!;
    if (historyPath !== `${foundingPath}/_history001`) {
      throw malformedInventory();
    }
    assertSingleNamedFact(
      quads,
      input.meshBase,
      foundingPath,
      SFLO_DEFAULT_ARTIFACT_HISTORY_IRI,
      historyPath,
    );
    assertSingleNamedFact(
      quads,
      input.meshBase,
      foundingPath,
      SFLO_CURRENT_ARTIFACT_HISTORY_IRI,
      historyPath,
    );
    previousStatePath = requireSingleNamedObjectPath(
      input.meshBase,
      quads,
      historyPath,
      SFLO_LATEST_HISTORICAL_STATE_IRI,
    );
    stateOrdinal = requireSingleNonNegativeInteger(
      input.meshBase,
      quads,
      historyPath,
      SFLO_NEXT_STATE_ORDINAL_IRI,
    );
    if (
      previousStatePath !==
        `${historyPath}/${toStateSegment(stateOrdinal - 1)}` ||
      stateOrdinal < 2
    ) {
      throw malformedInventory();
    }
    progressionTurtle = advanceHistoryProgression({
      currentTurtle: input.currentKnopInventoryTurtle,
      historyPath,
      previousStatePath,
      nextStatePath: `${historyPath}/${toStateSegment(stateOrdinal)}`,
      nextStateOrdinal: stateOrdinal + 1,
    });
  }

  const statePath = `${historyPath}/${toStateSegment(stateOrdinal)}`;
  const manifestationPath = `${statePath}/ttl`;
  const snapshotPath = `${manifestationPath}/data.ttl`;
  const contentDigest = await sha256ContentDigest(validated.bytes);
  const prepared = prepareCurrentInventory({
    baseIri: input.meshBase,
    currentInventoryTurtle: progressionTurtle,
    currentInventoryLabel:
      "current KnopInventory for founding referent data version",
  });
  const appendPlan = planInventoryAppend({
    preparedCurrentInventory: prepared,
    requestedSettledFactsTurtle: renderRequestedFacts({
      meshBase: input.meshBase,
      knopPath,
      foundingPath,
      workingPath,
      historyPath,
      statePath,
      stateOrdinal,
      previousStatePath,
      manifestationPath,
      snapshotPath,
      contentDigest,
    }),
    singleValuedSettledPredicates: [
      SFLO_HAS_FOUNDING_REFERENT_DATA_IRI,
      SFLO_HAS_WORKING_LOCATED_FILE_IRI,
      SFLO_DEFAULT_ARTIFACT_HISTORY_IRI,
      SFLO_CURRENT_ARTIFACT_HISTORY_IRI,
      SFLO_NEXT_HISTORY_ORDINAL_IRI,
      SFLO_HISTORY_ORDINAL_IRI,
      SFLO_LATEST_HISTORICAL_STATE_IRI,
      SFLO_NEXT_STATE_ORDINAL_IRI,
      SFLO_STATE_ORDINAL_IRI,
      SFLO_PREVIOUS_HISTORICAL_STATE_IRI,
      SFLO_HAS_MANIFESTATION_IRI,
      SFLO_LOCATED_FILE_FOR_STATE_IRI,
      SFLO_LOCATED_FILE_FOR_MANIFESTATION_IRI,
      SFLO_HAS_CONTENT_DIGEST_IRI,
    ],
    currentInventoryLabel:
      "current KnopInventory for founding referent data version",
    requestedFactsLabel:
      `founding referent data state facts for ${input.designatorPath}`,
  });
  if (appendPlan.kind === "conflict") {
    throw new FoundingReferentDataVersionInputError(
      "Founding referent data version facts conflict with the current KnopInventory.",
    );
  }
  const outputTurtle = renderInventoryAppendPlan({
    preparedCurrentInventory: prepared,
    plan: appendPlan,
    outputLabel: `founding referent data version for ${input.designatorPath}`,
  });

  return {
    meshBase: input.meshBase,
    designatorPath: input.designatorPath,
    foundingReferentDataIri: new URL(foundingPath, input.meshBase).href,
    historyIri: new URL(historyPath, input.meshBase).href,
    stateIri: new URL(statePath, input.meshBase).href,
    manifestationIri: new URL(manifestationPath, input.meshBase).href,
    snapshotIri: new URL(snapshotPath, input.meshBase).href,
    snapshotPath,
    contentDigest,
    createdBinaryFiles: [{ path: snapshotPath, contents: validated.bytes }],
    updatedFiles: [{
      path: `${knopPath}/_inventory/inventory.ttl`,
      contents: outputTurtle,
    }],
  };
}

function assertFoundingInventoryBaseShape(
  meshBase: string,
  quads: readonly Quad[],
  knopPath: string,
  foundingPath: string,
  workingPath: string,
): void {
  assertSingleNamedFact(
    quads,
    meshBase,
    knopPath,
    SFLO_HAS_FOUNDING_REFERENT_DATA_IRI,
    foundingPath,
  );
  for (
    const typeIri of [
      SFLO_FOUNDING_REFERENT_DATA_IRI,
      SFLO_DIGITAL_ARTIFACT_IRI,
      SFLO_RDF_DOCUMENT_IRI,
    ]
  ) {
    assertNamedFact(quads, meshBase, foundingPath, RDF_TYPE_IRI, typeIri);
  }
  assertSingleNamedFact(
    quads,
    meshBase,
    foundingPath,
    SFLO_HAS_WORKING_LOCATED_FILE_IRI,
    workingPath,
  );
  assertNamedFact(
    quads,
    meshBase,
    workingPath,
    RDF_TYPE_IRI,
    SFLO_LOCATED_FILE_IRI,
  );
  assertNamedFact(
    quads,
    meshBase,
    workingPath,
    RDF_TYPE_IRI,
    SFLO_RDF_DOCUMENT_IRI,
  );
  if (
    objects(quads, meshBase, workingPath, SFLO_HAS_CONTENT_DIGEST_IRI).length >
      0
  ) {
    throw malformedInventory();
  }
}

function assertNoHistoryProgression(
  meshBase: string,
  quads: readonly Quad[],
  foundingPath: string,
): void {
  for (
    const predicate of [
      SFLO_DEFAULT_ARTIFACT_HISTORY_IRI,
      SFLO_CURRENT_ARTIFACT_HISTORY_IRI,
      SFLO_NEXT_HISTORY_ORDINAL_IRI,
    ]
  ) {
    if (objects(quads, meshBase, foundingPath, predicate).length > 0) {
      throw malformedInventory();
    }
  }
}

function advanceHistoryProgression(input: {
  currentTurtle: string;
  historyPath: string;
  previousStatePath: string;
  nextStatePath: string;
  nextStateOrdinal: number;
}): string {
  const blocks = splitTurtleBlocks(input.currentTurtle);
  const original = blocks.find((block) =>
    block.startsWith(`<${input.historyPath}>`)
  );
  if (original === undefined) throw malformedInventory();
  let replacement = original.replace(
    new RegExp(
      `sflo:latestHistoricalState <${escapeRegExp(input.previousStatePath)}>`,
    ),
    `sflo:latestHistoricalState <${input.nextStatePath}>`,
  );
  replacement = replacement.replace(
    /sflo:nextStateOrdinal "\d+"\^\^(?:xsd:nonNegativeInteger|<http:\/\/www\.w3\.org\/2001\/XMLSchema#nonNegativeInteger>)/,
    `sflo:nextStateOrdinal "${input.nextStateOrdinal}"^^<${XSD_NON_NEGATIVE_INTEGER_IRI}>`,
  );
  if (replacement === original) throw malformedInventory();
  replacement = appendPredicateToSubjectBlock(
    replacement,
    `sflo:hasHistoricalState <${input.nextStatePath}>`,
  );
  const index = input.currentTurtle.indexOf(original);
  if (index === -1 || input.currentTurtle.indexOf(original, index + 1) !== -1) {
    throw malformedInventory();
  }
  return `${input.currentTurtle.slice(0, index)}${replacement}${
    input.currentTurtle.slice(index + original.length)
  }`;
}

function renderRequestedFacts(input: {
  meshBase: string;
  knopPath: string;
  foundingPath: string;
  workingPath: string;
  historyPath: string;
  statePath: string;
  stateOrdinal: number;
  previousStatePath?: string;
  manifestationPath: string;
  snapshotPath: string;
  contentDigest: string;
}): string {
  const previous = input.previousStatePath === undefined
    ? ""
    : `  sflo:previousHistoricalState <${input.previousStatePath}> ;\n`;
  return `@base <${input.meshBase}> .
${SFLO_TURTLE_PREFIX_DECLARATION}
@prefix xsd: <${XSD_NAMESPACE}> .

<${input.knopPath}> sflo:hasFoundingReferentData <${input.foundingPath}> .

<${input.foundingPath}> a sflo:FoundingReferentData, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasWorkingLocatedFile <${input.workingPath}> ;
  sflo:hasArtifactHistory <${input.historyPath}> ;
  sflo:defaultArtifactHistory <${input.historyPath}> ;
  sflo:currentArtifactHistory <${input.historyPath}> ;
  sflo:nextHistoryOrdinal "2"^^xsd:nonNegativeInteger .

<${input.historyPath}> a sflo:ArtifactHistory ;
  sflo:historyOrdinal "1"^^xsd:nonNegativeInteger ;
  sflo:hasHistoricalState <${input.statePath}> ;
  sflo:latestHistoricalState <${input.statePath}> ;
  sflo:nextStateOrdinal "${input.stateOrdinal + 1}"^^xsd:nonNegativeInteger .

<${input.statePath}> a sflo:HistoricalState ;
  sflo:stateOrdinal "${input.stateOrdinal}"^^xsd:nonNegativeInteger ;
${previous}  sflo:hasManifestation <${input.manifestationPath}> ;
  sflo:locatedFileForState <${input.snapshotPath}> .

<${input.manifestationPath}> a sflo:ArtifactManifestation, sflo:RdfDocument ;
  sflo:hasContentDigest "${input.contentDigest}" ;
  sflo:locatedFileForManifestation <${input.snapshotPath}> .

<${input.workingPath}> a sflo:LocatedFile, sflo:RdfDocument .

<${input.snapshotPath}> a sflo:LocatedFile, sflo:RdfDocument ;
  sflo:hasContentDigest "${input.contentDigest}" .
`;
}

function parseInventory(meshBase: string, turtle: string): Quad[] {
  try {
    return new Parser({ baseIRI: meshBase }).parse(turtle);
  } catch {
    throw malformedInventory();
  }
}

function assertNamedFact(
  quads: readonly Quad[],
  meshBase: string,
  subjectPath: string,
  predicateIri: string,
  objectPathOrIri: string,
): void {
  const expected = isAbsoluteIri(objectPathOrIri)
    ? objectPathOrIri
    : new URL(objectPathOrIri, meshBase).href;
  const matches = objects(quads, meshBase, subjectPath, predicateIri);
  if (
    !matches.some((term) =>
      term.termType === "NamedNode" && term.value === expected
    )
  ) {
    throw malformedInventory();
  }
}

function assertSingleNamedFact(
  quads: readonly Quad[],
  meshBase: string,
  subjectPath: string,
  predicateIri: string,
  objectPathOrIri: string,
): void {
  const matches = objects(quads, meshBase, subjectPath, predicateIri);
  assertNamedFact(quads, meshBase, subjectPath, predicateIri, objectPathOrIri);
  if (matches.length !== 1) throw malformedInventory();
}

function namedObjectPaths(
  meshBase: string,
  quads: readonly Quad[],
  subjectPath: string,
  predicateIri: string,
): string[] {
  return objects(quads, meshBase, subjectPath, predicateIri).map((term) => {
    if (term.termType !== "NamedNode" || !term.value.startsWith(meshBase)) {
      throw malformedInventory();
    }
    return term.value.slice(meshBase.length);
  });
}

function requireSingleNamedObjectPath(
  meshBase: string,
  quads: readonly Quad[],
  subjectPath: string,
  predicateIri: string,
): string {
  const matches = namedObjectPaths(meshBase, quads, subjectPath, predicateIri);
  if (matches.length !== 1) throw malformedInventory();
  return matches[0]!;
}

function requireSingleNonNegativeInteger(
  meshBase: string,
  quads: readonly Quad[],
  subjectPath: string,
  predicateIri: string,
): number {
  const matches = objects(quads, meshBase, subjectPath, predicateIri);
  if (
    matches.length !== 1 || matches[0]!.termType !== "Literal" ||
    matches[0]!.datatype.value !== XSD_NON_NEGATIVE_INTEGER_IRI ||
    !/^\d+$/.test(matches[0]!.value)
  ) {
    throw malformedInventory();
  }
  const value = Number(matches[0]!.value);
  if (!Number.isSafeInteger(value)) throw malformedInventory();
  return value;
}

function objects(
  quads: readonly Quad[],
  meshBase: string,
  subjectPath: string,
  predicateIri: string,
): Term[] {
  const subjectIri = new URL(subjectPath, meshBase).href;
  return quads.filter((quad) =>
    quad.subject.termType === "NamedNode" &&
    quad.subject.value === subjectIri &&
    quad.predicate.value === predicateIri
  ).map((quad) => quad.object);
}

function malformedInventory(): FoundingReferentDataVersionInputError {
  return new FoundingReferentDataVersionInputError(
    "Current KnopInventory has an unsupported founding referent data shape.",
  );
}

function toStateSegment(ordinal: number): string {
  return `_s${String(ordinal).padStart(4, "0")}`;
}

function isAbsoluteIri(value: string): boolean {
  try {
    return new URL(value).protocol.length > 0;
  } catch {
    return false;
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
