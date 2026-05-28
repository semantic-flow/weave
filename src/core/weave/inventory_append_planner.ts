import { Parser, type Quad, type Term } from "n3";
import { XSD_NAMESPACE } from "../rdf/namespaces.ts";
import { escapeTurtleString } from "../rdf/turtle.ts";
import { WeaveInputError } from "./errors.ts";

const XSD_STRING_IRI = `${XSD_NAMESPACE}string`;

export interface InventoryAppendPlannerInput {
  readonly baseIri: string;
  readonly currentInventoryTurtle: string;
  readonly requestedSettledFactsTurtle: string;
  readonly singleValuedSettledPredicates?: readonly string[];
  readonly currentInventoryLabel?: string;
  readonly requestedFactsLabel?: string;
}

export interface InventoryFactSummary {
  readonly key: string;
  readonly subject: string;
  readonly predicate: string;
  readonly object: string;
  readonly turtle: string;
}

export interface InventoryFactConflict {
  readonly predicate: string;
  readonly requested: InventoryFactSummary;
  readonly existing: readonly InventoryFactSummary[];
  readonly message: string;
}

export type InventoryAppendPlan =
  | {
    readonly kind: "unchanged";
    readonly outputTurtle: string;
    readonly alreadyPresent: readonly InventoryFactSummary[];
    readonly missing: readonly [];
    readonly conflicts: readonly [];
    readonly appendTurtle: "";
  }
  | {
    readonly kind: "append";
    readonly outputTurtle: string;
    readonly alreadyPresent: readonly InventoryFactSummary[];
    readonly missing: readonly InventoryFactSummary[];
    readonly conflicts: readonly [];
    readonly appendTurtle: string;
  }
  | {
    readonly kind: "conflict";
    readonly alreadyPresent: readonly InventoryFactSummary[];
    readonly missing: readonly InventoryFactSummary[];
    readonly conflicts: readonly InventoryFactConflict[];
  };

interface RequestedFact {
  readonly quad: Quad;
  readonly summary: InventoryFactSummary;
}

export function planInventoryAppend(
  input: InventoryAppendPlannerInput,
): InventoryAppendPlan {
  const currentLabel = input.currentInventoryLabel ?? "current inventory";
  const requestedLabel = input.requestedFactsLabel ?? "requested inventory";
  const currentQuads = parseTurtle(
    input.baseIri,
    input.currentInventoryTurtle,
    currentLabel,
  );
  const requestedFacts = parseRequestedFacts(
    input.baseIri,
    input.requestedSettledFactsTurtle,
    requestedLabel,
  );
  const singleValuedPredicates = new Set(
    input.singleValuedSettledPredicates ?? [],
  );
  const currentKeys = new Set(currentQuads.map(toQuadKey));
  const currentBySubjectPredicate = groupBySubjectPredicate(currentQuads);
  const alreadyPresent: InventoryFactSummary[] = [];
  const missing: InventoryFactSummary[] = [];
  const conflicts: InventoryFactConflict[] = [];

  for (const requestedFact of requestedFacts) {
    const requestedQuad = requestedFact.quad;
    const sameSlotFacts = currentBySubjectPredicate.get(
      toSubjectPredicateKey(requestedQuad),
    ) ?? [];
    const hasConflict = singleValuedPredicates.has(
      requestedQuad.predicate.value,
    );
    const conflictingFacts = hasConflict
      ? sameSlotFacts.filter((quad) =>
        !rdfTermsEqual(quad.object, requestedQuad.object)
      )
      : [];

    if (conflictingFacts.length > 0) {
      const existing = conflictingFacts.map(toFactSummary);
      conflicts.push({
        predicate: requestedQuad.predicate.value,
        requested: requestedFact.summary,
        existing,
        message: formatConflictMessage(requestedFact.summary, existing),
      });
      continue;
    }

    if (currentKeys.has(requestedFact.summary.key)) {
      alreadyPresent.push(requestedFact.summary);
    } else {
      missing.push(requestedFact.summary);
    }
  }

  if (conflicts.length > 0) {
    return {
      kind: "conflict",
      alreadyPresent,
      missing,
      conflicts,
    };
  }

  if (missing.length === 0) {
    return {
      kind: "unchanged",
      outputTurtle: input.currentInventoryTurtle,
      alreadyPresent,
      missing: [],
      conflicts: [],
      appendTurtle: "",
    };
  }

  const appendTurtle = `${missing.map((fact) => fact.turtle).join("\n")}\n`;
  return {
    kind: "append",
    outputTurtle: appendToCurrentTurtle(
      input.currentInventoryTurtle,
      appendTurtle,
    ),
    alreadyPresent,
    missing,
    conflicts: [],
    appendTurtle,
  };
}

function parseTurtle(baseIri: string, turtle: string, label: string): Quad[] {
  try {
    return new Parser({ baseIRI: baseIri }).parse(turtle);
  } catch {
    throw new WeaveInputError(`Could not parse ${label} Turtle.`);
  }
}

function parseRequestedFacts(
  baseIri: string,
  turtle: string,
  label: string,
): RequestedFact[] {
  const seenKeys = new Set<string>();
  const facts: RequestedFact[] = [];

  for (const quad of parseTurtle(baseIri, turtle, label)) {
    assertAppendableRequestedFact(quad, label);
    const summary = toFactSummary(quad);
    if (seenKeys.has(summary.key)) {
      continue;
    }
    seenKeys.add(summary.key);
    facts.push({ quad, summary });
  }

  return facts;
}

function assertAppendableRequestedFact(quad: Quad, label: string): void {
  if (quad.graph.termType !== "DefaultGraph") {
    throw new WeaveInputError(
      `Could not plan ${label} append because requested inventory facts must be in the default graph.`,
    );
  }
  if (quad.subject.termType !== "NamedNode") {
    throw new WeaveInputError(
      `Could not plan ${label} append because requested inventory fact subjects must be named nodes.`,
    );
  }
  if (quad.predicate.termType !== "NamedNode") {
    throw new WeaveInputError(
      `Could not plan ${label} append because requested inventory fact predicates must be named nodes.`,
    );
  }
  if (
    quad.object.termType !== "NamedNode" &&
    quad.object.termType !== "Literal"
  ) {
    throw new WeaveInputError(
      `Could not plan ${label} append because requested inventory fact objects must be named nodes or literals.`,
    );
  }
}

function groupBySubjectPredicate(
  quads: readonly Quad[],
): ReadonlyMap<string, readonly Quad[]> {
  const groups = new Map<string, Quad[]>();

  for (const quad of quads) {
    const key = toSubjectPredicateKey(quad);
    const group = groups.get(key);
    if (group) {
      group.push(quad);
    } else {
      groups.set(key, [quad]);
    }
  }

  return groups;
}

function toSubjectPredicateKey(quad: Quad): string {
  return [
    toTermKey(quad.graph),
    toTermKey(quad.subject),
    toTermKey(quad.predicate),
  ].join("|");
}

function toQuadKey(quad: Quad): string {
  return [
    toTermKey(quad.graph),
    toTermKey(quad.subject),
    toTermKey(quad.predicate),
    toTermKey(quad.object),
  ].join("|");
}

function rdfTermsEqual(left: Term, right: Term): boolean {
  return toTermKey(left) === toTermKey(right);
}

function toTermKey(term: Term): string {
  if (term.termType === "Literal") {
    return [
      term.termType,
      term.value,
      term.language,
      term.datatype.value,
    ].join(":");
  }

  return `${term.termType}:${term.value}`;
}

function toFactSummary(quad: Quad): InventoryFactSummary {
  const subject = formatTermForMessage(quad.subject);
  const predicate = formatTermForMessage(quad.predicate);
  const object = formatTermForMessage(quad.object);
  return {
    key: toQuadKey(quad),
    subject,
    predicate,
    object,
    turtle: `${renderTurtleTerm(quad.subject)} ${
      renderTurtleTerm(quad.predicate)
    } ${renderTurtleTerm(quad.object)} .`,
  };
}

function renderTurtleTerm(term: Term): string {
  switch (term.termType) {
    case "NamedNode":
      return `<${term.value}>`;
    case "Literal":
      return renderTurtleLiteral(term);
    default:
      throw new WeaveInputError(
        "Could not render requested inventory append fact.",
      );
  }
}

function renderTurtleLiteral(term: Term & { termType: "Literal" }): string {
  const value = `"${escapeTurtleString(term.value)}"`;
  if (term.language.length > 0) {
    return `${value}@${term.language}`;
  }
  if (term.datatype.value === XSD_STRING_IRI) {
    return value;
  }
  return `${value}^^<${term.datatype.value}>`;
}

function formatTermForMessage(term: Term): string {
  switch (term.termType) {
    case "NamedNode":
      return `<${term.value}>`;
    case "BlankNode":
      return `_:${term.value}`;
    case "Literal":
      return renderTurtleLiteral(term);
    case "DefaultGraph":
      return "default graph";
    default:
      return `${term.termType}:${term.value}`;
  }
}

function formatConflictMessage(
  requested: InventoryFactSummary,
  existing: readonly InventoryFactSummary[],
): string {
  return `Requested settled inventory fact ${requested.turtle} conflicts with existing fact ${
    existing.map((fact) => fact.turtle).join(" ")
  }`;
}

function appendToCurrentTurtle(
  currentTurtle: string,
  appendTurtle: string,
): string {
  if (currentTurtle.length === 0) {
    return appendTurtle;
  }
  if (currentTurtle.endsWith("\n\n")) {
    return `${currentTurtle}${appendTurtle}`;
  }
  if (currentTurtle.endsWith("\n")) {
    return `${currentTurtle}\n${appendTurtle}`;
  }
  return `${currentTurtle}\n\n${appendTurtle}`;
}
