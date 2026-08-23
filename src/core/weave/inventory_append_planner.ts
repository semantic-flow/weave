import { Parser, type Quad, type Term } from "n3";
import {
  RDF_NAMESPACE,
  SFLO_NAMESPACE,
  XSD_NAMESPACE,
} from "../rdf/namespaces.ts";
import { escapeTurtleString } from "../rdf/turtle.ts";
import { WeaveInputError } from "./errors.ts";

const XSD_STRING_IRI = `${XSD_NAMESPACE}string`;
const RDF_TYPE_IRI = `${RDF_NAMESPACE}type`;
const preparedCurrentInventoryBrand: unique symbol = Symbol(
  "PreparedCurrentInventory",
);

export interface PreparedCurrentInventory {
  readonly baseIri: string;
  readonly turtle: string;
  readonly quads: readonly Quad[];
  readonly [preparedCurrentInventoryBrand]: true;
}

export interface PrepareCurrentInventoryInput {
  readonly baseIri: string;
  readonly currentInventoryTurtle: string;
  readonly currentInventoryLabel?: string;
}

interface InventoryAppendPlannerCommonInput {
  readonly requestedSettledFactsTurtle: string;
  readonly singleValuedSettledPredicates?: readonly string[];
  readonly currentInventoryLabel?: string;
  readonly requestedFactsLabel?: string;
}

export type InventoryAppendPlannerInput =
  & InventoryAppendPlannerCommonInput
  & (
    | {
      readonly baseIri: string;
      readonly currentInventoryTurtle: string;
      readonly preparedCurrentInventory?: never;
    }
    | {
      readonly preparedCurrentInventory: PreparedCurrentInventory;
      readonly baseIri?: never;
      readonly currentInventoryTurtle?: never;
    }
  );

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

export type RenderableInventoryAppendPlan = Exclude<
  InventoryAppendPlan,
  { readonly kind: "conflict" }
>;

export interface RenderInventoryAppendPlanInput {
  readonly preparedCurrentInventory: PreparedCurrentInventory;
  readonly plan: RenderableInventoryAppendPlan;
  readonly outputLabel?: string;
}

interface RequestedFact {
  readonly quad: Quad;
  readonly summary: InventoryFactSummary;
}

/** Parses and validates current inventory bytes once for indexed readers and append planning. */
export function prepareCurrentInventory(
  input: PrepareCurrentInventoryInput,
): PreparedCurrentInventory {
  const label = input.currentInventoryLabel ?? "current inventory";
  const quads = parseTurtle(
    input.baseIri,
    input.currentInventoryTurtle,
    label,
  );
  for (const quad of quads) {
    if (quad.graph.termType !== "DefaultGraph") {
      throw new WeaveInputError(
        `Could not prepare ${label} because current inventory facts must be in the default graph.`,
      );
    }
  }

  return Object.freeze({
    baseIri: input.baseIri,
    turtle: input.currentInventoryTurtle,
    quads: Object.freeze(quads),
    [preparedCurrentInventoryBrand]: true as const,
  });
}

/**
 * Plans from either raw Turtle convenience input or an opaque prepared value.
 * Prepared input keeps the preserved bytes and parsed quads consistent by construction.
 */
export function planInventoryAppend(
  input: InventoryAppendPlannerInput,
): InventoryAppendPlan {
  const currentLabel = input.currentInventoryLabel ?? "current inventory";
  const requestedLabel = input.requestedFactsLabel ?? "requested inventory";
  const preparedCurrentInventory = input.preparedCurrentInventory ??
    prepareCurrentInventory({
      baseIri: input.baseIri,
      currentInventoryTurtle: input.currentInventoryTurtle,
      currentInventoryLabel: currentLabel,
    });
  const baseIri = preparedCurrentInventory.baseIri;
  const currentInventoryTurtle = preparedCurrentInventory.turtle;
  const currentQuads = preparedCurrentInventory.quads;
  const requestedFacts = parseRequestedFacts(
    baseIri,
    input.requestedSettledFactsTurtle,
    requestedLabel,
  );
  const singleValuedPredicates = new Set(
    input.singleValuedSettledPredicates ?? [],
  );
  const currentKeys = new Set(currentQuads.map(toQuadKey));
  const currentBySubjectPredicate = groupBySubjectPredicate(currentQuads);
  const requestedBySubjectPredicate = new Map<string, RequestedFact[]>();
  const alreadyPresent: InventoryFactSummary[] = [];
  const missing: InventoryFactSummary[] = [];
  const conflicts: InventoryFactConflict[] = [];

  for (const requestedFact of requestedFacts) {
    const requestedQuad = requestedFact.quad;
    const subjectPredicateKey = toSubjectPredicateKey(requestedQuad);
    const sameSlotFacts = currentBySubjectPredicate.get(
      subjectPredicateKey,
    ) ?? [];
    const hasConflict = singleValuedPredicates.has(
      requestedQuad.predicate.value,
    );
    const priorRequestedFacts = hasConflict
      ? requestedBySubjectPredicate.get(subjectPredicateKey) ?? []
      : [];
    const conflictingFacts = hasConflict
      ? [
        ...sameSlotFacts.filter((quad) =>
          !rdfTermsEqual(quad.object, requestedQuad.object)
        ).map(toFactSummary),
        ...priorRequestedFacts.filter((fact) =>
          !rdfTermsEqual(fact.quad.object, requestedQuad.object)
        ).map((fact) => fact.summary),
      ]
      : [];

    if (hasConflict) {
      requestedBySubjectPredicate.set(subjectPredicateKey, [
        ...priorRequestedFacts,
        requestedFact,
      ]);
    }

    if (conflictingFacts.length > 0) {
      conflicts.push({
        predicate: requestedQuad.predicate.value,
        requested: requestedFact.summary,
        existing: conflictingFacts,
        message: formatConflictMessage(
          requestedFact.summary,
          conflictingFacts,
        ),
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
      outputTurtle: currentInventoryTurtle,
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
      currentInventoryTurtle,
      appendTurtle,
    ),
    alreadyPresent,
    missing,
    conflicts: [],
    appendTurtle,
  };
}

/** Renders only planner-approved facts and verifies exact semantic union before returning bytes. */
export function renderInventoryAppendPlan(
  input: RenderInventoryAppendPlanInput,
): string {
  const { preparedCurrentInventory, plan } = input;
  const outputLabel = input.outputLabel ?? "inventory append";
  if (plan.kind === "unchanged") {
    if (plan.outputTurtle !== preparedCurrentInventory.turtle) {
      throw new WeaveInputError(
        `Could not render ${outputLabel} because the unchanged plan did not preserve the prepared inventory bytes.`,
      );
    }
    return plan.outputTurtle;
  }

  const compactAppendTurtle = renderSelfContainedCompactAppendTurtle(
    preparedCurrentInventory.baseIri,
    plan.appendTurtle,
    outputLabel,
  );
  const compactOutputTurtle = appendToCurrentTurtle(
    preparedCurrentInventory.turtle,
    compactAppendTurtle,
  );
  if (
    renderedAppendChunkMatchesPlan(
      preparedCurrentInventory.baseIri,
      plan,
      compactAppendTurtle,
      outputLabel,
    )
  ) {
    return compactOutputTurtle;
  }

  if (
    renderedAppendChunkMatchesPlan(
      preparedCurrentInventory.baseIri,
      plan,
      plan.appendTurtle,
      outputLabel,
    )
  ) {
    return plan.outputTurtle;
  }

  throw new WeaveInputError(
    `Could not render ${outputLabel} because rendered RDF did not equal the prepared inventory plus the planner-approved missing facts.`,
  );
}

function renderSelfContainedCompactAppendTurtle(
  baseIri: string,
  appendTurtle: string,
  label: string,
): string {
  const quads = parseTurtle(baseIri, appendTurtle, `${label} facts`);
  const subjects = new Map<
    string,
    {
      readonly subject: Term;
      readonly predicates: Map<string, {
        readonly predicate: Term;
        readonly objects: Term[];
      }>;
    }
  >();

  for (const quad of quads) {
    assertAppendableRequestedFact(quad, `${label} facts`);
    const subjectKey = toTermKey(quad.subject);
    let subject = subjects.get(subjectKey);
    if (!subject) {
      subject = {
        subject: quad.subject,
        predicates: new Map(),
      };
      subjects.set(subjectKey, subject);
    }

    const predicateKey = toTermKey(quad.predicate);
    let predicate = subject.predicates.get(predicateKey);
    if (!predicate) {
      predicate = {
        predicate: quad.predicate,
        objects: [],
      };
      subject.predicates.set(predicateKey, predicate);
    }
    if (
      !predicate.objects.some((object) => rdfTermsEqual(object, quad.object))
    ) {
      predicate.objects.push(quad.object);
    }
  }

  const blocks = [...subjects.values()].map((subject) => {
    const predicates = [...subject.predicates.values()].map((predicate) => {
      const renderedPredicate = predicate.predicate.value === RDF_TYPE_IRI
        ? "a"
        : renderCompactNamedNode(predicate.predicate, baseIri);
      const renderedObjects = predicate.objects.map((object) =>
        renderCompactTerm(object, baseIri)
      ).join(", ");
      return `${renderedPredicate} ${renderedObjects}`;
    });
    return `${renderCompactNamedNode(subject.subject, baseIri)} ${
      predicates.join(" ;\n  ")
    } .`;
  });

  return `@base <${baseIri}> .
@prefix sflo: <${SFLO_NAMESPACE}> .

${blocks.join("\n\n")}
`;
}

function renderCompactTerm(term: Term, baseIri: string): string {
  return term.termType === "Literal"
    ? renderTurtleLiteral(term)
    : renderCompactNamedNode(term, baseIri);
}

function renderCompactNamedNode(term: Term, baseIri: string): string {
  if (term.termType !== "NamedNode") {
    throw new WeaveInputError(
      "Could not compact an inventory append term that was not a named node.",
    );
  }
  if (term.value.startsWith(baseIri)) {
    return `<${term.value.slice(baseIri.length)}>`;
  }
  if (term.value.startsWith(SFLO_NAMESPACE)) {
    const localName = term.value.slice(SFLO_NAMESPACE.length);
    if (/^[A-Za-z_][A-Za-z0-9._-]*$/.test(localName)) {
      return `sflo:${localName}`;
    }
  }
  return `<${term.value}>`;
}

/**
 * The prepared current Turtle is already parsed and remains an exact output
 * prefix. Requested facts cannot contain blank nodes, so proving that the
 * self-contained suffix equals plan.missing proves the complete RDF union
 * without reparsing carried blank nodes under fresh parser-local labels.
 */
function renderedAppendChunkMatchesPlan(
  baseIri: string,
  plan: Extract<InventoryAppendPlan, { readonly kind: "append" }>,
  renderedAppendTurtle: string,
  label: string,
): boolean {
  let renderedAppendQuads: Quad[];
  try {
    renderedAppendQuads = parseTurtle(
      baseIri,
      renderedAppendTurtle,
      `${label} append`,
    );
  } catch {
    return false;
  }
  const plannedMissingKeys = new Set(plan.missing.map((fact) => fact.key));
  const renderedKeys = new Set(renderedAppendQuads.map(toQuadKey));
  return setsEqual(plannedMissingKeys, renderedKeys);
}

function setsEqual(left: ReadonlySet<string>, right: ReadonlySet<string>) {
  if (left.size !== right.size) {
    return false;
  }
  for (const key of left) {
    if (!right.has(key)) {
      return false;
    }
  }
  return true;
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
