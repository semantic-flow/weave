import { Parser, type Quad } from "n3";
import {
  appendMeshPath,
  normalizeSafeDesignatorPath,
  SAFE_DESIGNATOR_SEGMENT_PATTERN,
  toKnopPath,
} from "../designator_segments.ts";
import type { PlannedFile } from "../planned_file.ts";
import {
  SFCFG_TURTLE_PREFIX_DECLARATION,
  SFLO_NAMESPACE,
  SFLO_TURTLE_PREFIX_DECLARATION,
} from "../rdf/namespaces.ts";

const SFLO_CURRENT_ARTIFACT_HISTORY_IRI =
  `${SFLO_NAMESPACE}currentArtifactHistory`;
const SFLO_HAS_PAYLOAD_ARTIFACT_IRI = `${SFLO_NAMESPACE}hasPayloadArtifact`;

export interface ResolvedPayloadHistoryIntentRequest {
  meshBase: string;
  designatorPath: string;
  historySegment: string;
  currentKnopInventoryTurtle: string;
}

export interface ResolvedPayloadNextStateIntentRequest {
  meshBase: string;
  designatorPath: string;
  stateSegment: string;
  currentKnopInventoryTurtle: string;
}

export interface PayloadVersionIntentPlan {
  meshBase: string;
  designatorPath: string;
  payloadArtifactIri: string;
  currentArtifactHistoryPath: string;
  nextStateSegmentHint?: string;
  updatedFiles: readonly PlannedFile[];
}

export class PayloadVersionIntentInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PayloadVersionIntentInputError";
  }
}

export function planSetPayloadHistoryIntent(
  request: ResolvedPayloadHistoryIntentRequest,
): PayloadVersionIntentPlan {
  const meshBase = normalizeMeshBase(request.meshBase);
  const designatorPath = normalizeDesignatorPath(request.designatorPath);
  const historySegment = normalizeSegment(
    request.historySegment,
    "historySegment",
  );
  const currentKnopInventoryTurtle = normalizeInventoryTurtle(
    request.currentKnopInventoryTurtle,
  );
  const quads = parseInventoryQuads(currentKnopInventoryTurtle, designatorPath);
  assertPayloadArtifactShape(quads, meshBase, designatorPath);

  const currentArtifactHistoryPath = appendMeshPath(
    designatorPath,
    historySegment,
  );
  const nextKnopInventoryTurtle = upsertNamedNodePredicate(
    currentKnopInventoryTurtle,
    designatorPath,
    "sflo:currentArtifactHistory",
    currentArtifactHistoryPath,
  );

  return toPlan({
    meshBase,
    designatorPath,
    currentArtifactHistoryPath,
    before: currentKnopInventoryTurtle,
    after: nextKnopInventoryTurtle,
  });
}

export function planSetPayloadNextStateIntent(
  request: ResolvedPayloadNextStateIntentRequest,
): PayloadVersionIntentPlan {
  const meshBase = normalizeMeshBase(request.meshBase);
  const designatorPath = normalizeDesignatorPath(request.designatorPath);
  const stateSegment = normalizeSegment(request.stateSegment, "stateSegment");
  const currentKnopInventoryTurtle = normalizeInventoryTurtle(
    request.currentKnopInventoryTurtle,
  );
  const quads = parseInventoryQuads(currentKnopInventoryTurtle, designatorPath);
  assertPayloadArtifactShape(quads, meshBase, designatorPath);

  const currentArtifactHistoryPath =
    resolveCurrentArtifactHistoryPath(quads, meshBase, designatorPath) ??
      appendMeshPath(designatorPath, "_history001");
  let nextKnopInventoryTurtle = upsertNamedNodePredicate(
    currentKnopInventoryTurtle,
    designatorPath,
    "sflo:currentArtifactHistory",
    currentArtifactHistoryPath,
  );
  nextKnopInventoryTurtle = ensureSfcfgPrefix(nextKnopInventoryTurtle);
  nextKnopInventoryTurtle = upsertLiteralPredicate(
    nextKnopInventoryTurtle,
    currentArtifactHistoryPath,
    "sfcfg:hasNextStateSegmentHint",
    stateSegment,
  );

  return toPlan({
    meshBase,
    designatorPath,
    currentArtifactHistoryPath,
    nextStateSegmentHint: stateSegment,
    before: currentKnopInventoryTurtle,
    after: nextKnopInventoryTurtle,
  });
}

function toPlan(options: {
  meshBase: string;
  designatorPath: string;
  currentArtifactHistoryPath: string;
  nextStateSegmentHint?: string;
  before: string;
  after: string;
}): PayloadVersionIntentPlan {
  validateInventoryTurtle(options.after, options.designatorPath);
  return {
    meshBase: options.meshBase,
    designatorPath: options.designatorPath,
    payloadArtifactIri: new URL(options.designatorPath, options.meshBase).href,
    currentArtifactHistoryPath: options.currentArtifactHistoryPath,
    ...(options.nextStateSegmentHint
      ? { nextStateSegmentHint: options.nextStateSegmentHint }
      : {}),
    updatedFiles: options.after === options.before ? [] : [{
      path: `${toKnopPath(options.designatorPath)}/_inventory/inventory.ttl`,
      contents: options.after,
    }],
  };
}

function normalizeMeshBase(meshBase: string): string {
  const trimmed = meshBase.trim();
  if (trimmed.length === 0) {
    throw new PayloadVersionIntentInputError("meshBase is required");
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new PayloadVersionIntentInputError(
      "meshBase must be an absolute IRI",
    );
  }

  if (!url.pathname.endsWith("/")) {
    throw new PayloadVersionIntentInputError("meshBase must end with '/'");
  }
  if (url.search.length > 0 || url.hash.length > 0) {
    throw new PayloadVersionIntentInputError(
      "meshBase must not include a query or fragment",
    );
  }

  return url.href;
}

function normalizeDesignatorPath(designatorPath: string): string {
  return normalizeSafeDesignatorPath(
    designatorPath,
    "designatorPath",
    (message) => new PayloadVersionIntentInputError(message),
    { allowRoot: true },
  );
}

function normalizeSegment(value: string, fieldName: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new PayloadVersionIntentInputError(`${fieldName} is required`);
  }
  if (!SAFE_DESIGNATOR_SEGMENT_PATTERN.test(trimmed)) {
    throw new PayloadVersionIntentInputError(
      `${fieldName} must match [A-Za-z0-9._-]+`,
    );
  }
  return trimmed;
}

function normalizeInventoryTurtle(turtle: string): string {
  if (turtle.trim().length === 0) {
    throw new PayloadVersionIntentInputError(
      "current Knop inventory Turtle is required",
    );
  }
  return turtle;
}

function parseInventoryQuads(turtle: string, designatorPath: string): Quad[] {
  try {
    return new Parser().parse(turtle);
  } catch {
    throw new PayloadVersionIntentInputError(
      `Could not parse the current Knop inventory for ${designatorPath}.`,
    );
  }
}

function validateInventoryTurtle(turtle: string, designatorPath: string): void {
  try {
    new Parser().parse(turtle);
  } catch {
    throw new PayloadVersionIntentInputError(
      `Could not render a valid Knop inventory for ${designatorPath}.`,
    );
  }
}

function assertPayloadArtifactShape(
  quads: readonly Quad[],
  meshBase: string,
  designatorPath: string,
): void {
  const knopPath = toKnopPath(designatorPath);
  if (
    !hasNamedNodeFact(
      quads,
      meshBase,
      knopPath,
      SFLO_HAS_PAYLOAD_ARTIFACT_IRI,
      designatorPath,
    )
  ) {
    throw new PayloadVersionIntentInputError(
      `Version intent can only be set for a payload artifact Knop: ${designatorPath}`,
    );
  }
}

function resolveCurrentArtifactHistoryPath(
  quads: readonly Quad[],
  meshBase: string,
  designatorPath: string,
): string | undefined {
  const subjectIri = toAbsoluteIri(meshBase, designatorPath);
  const values = quads.flatMap((quad) =>
    quad.subject.termType === "NamedNode" &&
      quad.subject.value === subjectIri &&
      quad.predicate.value === SFLO_CURRENT_ARTIFACT_HISTORY_IRI &&
      quad.object.termType === "NamedNode"
      ? [toMeshRelativePath(meshBase, quad.object.value)]
      : []
  );

  if (values.length > 1) {
    throw new PayloadVersionIntentInputError(
      `Current payload history is ambiguous for ${designatorPath}.`,
    );
  }
  const value = values[0];
  if (value !== undefined && !isDirectChildPath(designatorPath, value)) {
    throw new PayloadVersionIntentInputError(
      `Current payload history for ${designatorPath} is outside the payload designator path: ${value}`,
    );
  }

  return value;
}

function upsertNamedNodePredicate(
  turtle: string,
  subjectPath: string,
  predicate: string,
  objectPath: string,
): string {
  return upsertPredicateLine(
    turtle,
    subjectPath,
    predicate,
    `${predicate} <${objectPath}>`,
  );
}

function upsertLiteralPredicate(
  turtle: string,
  subjectPath: string,
  predicate: string,
  literalValue: string,
): string {
  return upsertPredicateLine(
    turtle,
    subjectPath,
    predicate,
    `${predicate} ${JSON.stringify(literalValue)}`,
  );
}

function upsertPredicateLine(
  turtle: string,
  subjectPath: string,
  predicate: string,
  predicateLineWithoutTerminator: string,
): string {
  const normalizedTurtle = turtle.endsWith("\n") ? turtle : `${turtle}\n`;
  const block = findSubjectBlock(normalizedTurtle, subjectPath);
  if (!block) {
    return `${normalizedTurtle.trimEnd()}\n\n<${subjectPath}> ${predicateLineWithoutTerminator} .\n`;
  }

  const replacement = renderBlockWithPredicate(
    subjectPath,
    block.contents,
    predicate,
    predicateLineWithoutTerminator,
  );
  return normalizedTurtle.slice(0, block.start) + replacement +
    normalizedTurtle.slice(block.end);
}

function renderBlockWithPredicate(
  subjectPath: string,
  block: string,
  predicate: string,
  predicateLineWithoutTerminator: string,
): string {
  const predicatePattern = new RegExp(
    `^\\s*${escapeRegExp(predicate)}\\s+`,
  );
  const singleLinePredicatePattern = new RegExp(
    `^<${escapeRegExp(subjectPath)}>\\s+${escapeRegExp(predicate)}\\s+`,
  );
  if (singleLinePredicatePattern.test(block.trim())) {
    return `<${subjectPath}> ${predicateLineWithoutTerminator} .\n`;
  }
  const lines = block.split("\n").filter((line) =>
    !predicatePattern.test(line)
  );
  while (lines.length > 0 && lines[lines.length - 1] === "") {
    lines.pop();
  }
  if (lines.length === 0) {
    throw new PayloadVersionIntentInputError(
      "Could not update an empty Turtle subject block.",
    );
  }

  const lastIndex = lines.length - 1;
  lines[lastIndex] = ensureContinuationTerminator(lines[lastIndex]!);
  lines.push(`  ${predicateLineWithoutTerminator} .`);
  return `${lines.join("\n")}\n`;
}

function ensureContinuationTerminator(line: string): string {
  if (line.trimEnd().endsWith(";")) {
    return line;
  }
  return line.replace(/\s*\.\s*$/, " ;");
}

function findSubjectBlock(
  turtle: string,
  subjectPath: string,
): { start: number; end: number; contents: string } | undefined {
  const match = new RegExp(`^<${escapeRegExp(subjectPath)}>`, "m").exec(
    turtle,
  );
  if (!match || match.index === undefined) {
    return undefined;
  }

  const start = match.index;
  const separatorIndex = turtle.indexOf("\n\n", start);
  const end = separatorIndex === -1 ? turtle.length : separatorIndex;
  return {
    start,
    end,
    contents: turtle.slice(start, end),
  };
}

function ensureSfcfgPrefix(turtle: string): string {
  if (turtle.includes("@prefix sfcfg:")) {
    return turtle;
  }
  if (turtle.includes(SFLO_TURTLE_PREFIX_DECLARATION)) {
    return turtle.replace(
      SFLO_TURTLE_PREFIX_DECLARATION,
      `${SFLO_TURTLE_PREFIX_DECLARATION}\n${SFCFG_TURTLE_PREFIX_DECLARATION}`,
    );
  }
  return `${SFCFG_TURTLE_PREFIX_DECLARATION}\n${turtle}`;
}

function hasNamedNodeFact(
  quads: readonly Quad[],
  meshBase: string,
  subjectValue: string,
  predicateIri: string,
  objectValue: string,
): boolean {
  const subjectIri = toAbsoluteIri(meshBase, subjectValue);
  const objectIri = toAbsoluteIri(meshBase, objectValue);
  return quads.some((quad) =>
    quad.subject.termType === "NamedNode" &&
    quad.subject.value === subjectIri &&
    quad.predicate.value === predicateIri &&
    quad.object.termType === "NamedNode" &&
    quad.object.value === objectIri
  );
}

function toAbsoluteIri(meshBase: string, path: string): string {
  return new URL(path, meshBase).href;
}

function toMeshRelativePath(meshBase: string, iri: string): string {
  const base = new URL(meshBase);
  const value = new URL(iri);
  if (
    value.origin !== base.origin || !value.pathname.startsWith(base.pathname)
  ) {
    throw new PayloadVersionIntentInputError(
      `IRI is outside the mesh base: ${iri}`,
    );
  }
  return decodeURI(value.pathname.slice(base.pathname.length));
}

function isDirectChildPath(parentPath: string, childPath: string): boolean {
  if (parentPath.length === 0) {
    return !childPath.includes("/");
  }
  return childPath.startsWith(`${parentPath}/`) &&
    !childPath.slice(parentPath.length + 1).includes("/");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
