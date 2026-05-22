import { Parser, type Quad } from "n3";
import { SAFE_DESIGNATOR_SEGMENT_PATTERN } from "../designator_segments.ts";
import { WeaveInputError } from "./errors.ts";

const XSD_NON_NEGATIVE_INTEGER_IRI =
  "http://www.w3.org/2001/XMLSchema#nonNegativeInteger";

export function parseWeaveShapeQuads(
  meshBase: string,
  turtle: string,
  errorMessage: string,
): Quad[] {
  try {
    return new Parser({ baseIRI: meshBase }).parse(turtle);
  } catch {
    throw new WeaveInputError(errorMessage);
  }
}

export function requireSingleNamedNodeObject(
  quads: readonly Quad[],
  subjectIri: string,
  predicateIri: string,
  errorMessage: string,
): string {
  const values = quads.flatMap((quad) =>
    quad.subject.termType === "NamedNode" &&
      quad.subject.value === subjectIri &&
      quad.predicate.value === predicateIri &&
      quad.object.termType === "NamedNode"
      ? [quad.object.value]
      : []
  );

  if (values.length !== 1) {
    throw new WeaveInputError(errorMessage);
  }

  return values[0]!;
}

export function requireSingleNonNegativeIntegerLiteral(
  quads: readonly Quad[],
  subjectIri: string,
  predicateIri: string,
  errorMessage: string,
): number {
  const values = quads.flatMap((quad) =>
    quad.subject.termType === "NamedNode" &&
      quad.subject.value === subjectIri &&
      quad.predicate.value === predicateIri &&
      quad.object.termType === "Literal" &&
      quad.object.datatype.value === XSD_NON_NEGATIVE_INTEGER_IRI
      ? [quad.object.value]
      : []
  );

  if (values.length !== 1) {
    throw new WeaveInputError(errorMessage);
  }

  const parsed = Number(values[0]);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new WeaveInputError(errorMessage);
  }

  return parsed;
}

export function resolveOptionalNonNegativeIntegerLiteral(
  quads: readonly Quad[],
  subjectIri: string,
  predicateIri: string,
  errorMessage: string,
): number | undefined {
  const values = quads.flatMap((quad) =>
    quad.subject.termType === "NamedNode" &&
      quad.subject.value === subjectIri &&
      quad.predicate.value === predicateIri &&
      quad.object.termType === "Literal" &&
      quad.object.datatype.value === XSD_NON_NEGATIVE_INTEGER_IRI
      ? [quad.object.value]
      : []
  );

  if (values.length > 1) {
    throw new WeaveInputError(errorMessage);
  }
  if (values.length === 0) {
    return undefined;
  }

  const parsed = Number(values[0]);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new WeaveInputError(errorMessage);
  }

  return parsed;
}

export function requireOptionalNamedNodeObject(
  quads: readonly Quad[],
  subjectIri: string,
  predicateIri: string,
  errorMessage: string,
): string | undefined {
  const values = quads.flatMap((quad) =>
    quad.subject.termType === "NamedNode" &&
      quad.subject.value === subjectIri &&
      quad.predicate.value === predicateIri &&
      quad.object.termType === "NamedNode"
      ? [quad.object.value]
      : []
  );

  if (values.length > 1) {
    throw new WeaveInputError(errorMessage);
  }

  return values[0];
}

export function resolveOptionalLiteralObject(
  quads: readonly Quad[],
  meshBase: string,
  subjectValue: string,
  predicateIri: string,
  errorMessage: string,
): string | undefined {
  const subjectIri = toAbsoluteIri(meshBase, subjectValue);
  const values = new Set<string>();
  for (const quad of quads) {
    if (
      quad.subject.termType === "NamedNode" &&
      quad.subject.value === subjectIri &&
      quad.predicate.value === predicateIri &&
      quad.object.termType === "Literal"
    ) {
      values.add(quad.object.value);
    }
  }

  if (values.size > 1) {
    throw new WeaveInputError(errorMessage);
  }

  return values.values().next().value;
}

export function resolveOptionalSegmentHint(
  quads: readonly Quad[],
  subjectIri: string,
  predicateIri: string,
  errorMessage: string,
): string | undefined {
  const values = quads.flatMap((quad) =>
    quad.subject.termType === "NamedNode" &&
      quad.subject.value === subjectIri &&
      quad.predicate.value === predicateIri &&
      quad.object.termType === "Literal"
      ? [quad.object.value]
      : []
  );

  if (values.length > 1) {
    throw new WeaveInputError(errorMessage);
  }
  const value = values[0];
  if (value === undefined) {
    return undefined;
  }
  if (!SAFE_DESIGNATOR_SEGMENT_PATTERN.test(value)) {
    throw new WeaveInputError(errorMessage);
  }

  return value;
}

export function resolveNamedNodeObjectPaths(
  quads: readonly Quad[],
  meshBase: string,
  subjectValue: string,
  predicateIri: string,
  errorMessage: string,
): string[] {
  const subjectIri = toAbsoluteIri(meshBase, subjectValue);
  return quads.flatMap((quad) =>
    quad.subject.termType === "NamedNode" &&
      quad.subject.value === subjectIri &&
      quad.predicate.value === predicateIri &&
      quad.object.termType === "NamedNode"
      ? [toMeshRelativePath(meshBase, quad.object.value, errorMessage)]
      : []
  );
}

export function requireLiteralValue(
  meshBase: string,
  turtle: string,
  subjectPath: string,
  predicateIri: string,
  label: string,
): string {
  const subjectIri = new URL(subjectPath, meshBase).href;
  const quad = parseTurtleQuads(meshBase, turtle, label).find((candidate) =>
    candidate.subject.termType === "NamedNode" &&
    candidate.subject.value === subjectIri &&
    candidate.predicate.value === predicateIri &&
    candidate.object.termType === "Literal"
  );

  if (!quad || quad.object.termType !== "Literal") {
    throw new WeaveInputError(
      `Could not resolve ${label} from the source payload.`,
    );
  }

  return quad.object.value;
}

export function requireNamedNodePath(
  meshBase: string,
  turtle: string,
  subjectPath: string,
  predicateIri: string,
  label: string,
): string {
  const subjectIri = new URL(subjectPath, meshBase).href;
  const quad = parseTurtleQuads(meshBase, turtle, label).find((candidate) =>
    candidate.subject.termType === "NamedNode" &&
    candidate.subject.value === subjectIri &&
    candidate.predicate.value === predicateIri &&
    candidate.object.termType === "NamedNode"
  );

  if (!quad || quad.object.termType !== "NamedNode") {
    throw new WeaveInputError(
      `Could not resolve ${label} from the source payload.`,
    );
  }

  return toMeshRelativePath(meshBase, quad.object.value, label);
}

export function parseTurtleQuads(
  meshBase: string,
  turtle: string,
  label: string,
): Quad[] {
  try {
    return new Parser({ baseIRI: meshBase }).parse(turtle);
  } catch {
    throw new WeaveInputError(
      `Could not parse the source payload Turtle while rendering ${label}.`,
    );
  }
}

export function toMeshRelativePath(
  meshBase: string,
  iri: string,
  label: string,
): string {
  if (!iri.startsWith(meshBase)) {
    throw new WeaveInputError(
      `Resolved IRI for ${label} was outside the current mesh base: ${iri}`,
    );
  }

  return iri.slice(meshBase.length);
}

export function hasNamedNodeFact(
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

export function hasTermKeyNamedNodeFact(
  quads: readonly Quad[],
  subjectKey: string,
  predicateIri: string,
  objectIri: string,
): boolean {
  return quads.some((quad) =>
    matchesRdfTermKey(quad.subject, subjectKey) &&
    quad.predicate.value === predicateIri &&
    quad.object.termType === "NamedNode" &&
    quad.object.value === objectIri
  );
}

export function resolveUniqueLiteralValuesForTermKey(
  quads: readonly Quad[],
  subjectKey: string,
  predicateIri: string,
  errorMessage: string,
): string[] {
  const values = new Set<string>();

  for (const quad of quads) {
    if (
      matchesRdfTermKey(quad.subject, subjectKey) &&
      quad.predicate.value === predicateIri &&
      quad.object.termType === "Literal"
    ) {
      values.add(quad.object.value);
    }
  }

  if (values.size > 1) {
    throw new WeaveInputError(errorMessage);
  }

  return Array.from(values);
}

export function matchesRdfTermKey(
  term: { termType: string; value: string },
  key: string | readonly string[],
): boolean {
  const termKey = toRdfTermKey(term);
  return typeof key === "string" ? termKey === key : key.includes(termKey);
}

export function toRdfTermKey(
  term: { termType: string; value: string },
): string {
  return `${term.termType}:${term.value}`;
}

export function hasSubject(
  quads: readonly Quad[],
  meshBase: string,
  subjectValue: string,
): boolean {
  const subjectIri = toAbsoluteIri(meshBase, subjectValue);
  return quads.some((quad) =>
    quad.subject.termType === "NamedNode" &&
    quad.subject.value === subjectIri
  );
}

export function hasLiteralFact(
  quads: readonly Quad[],
  meshBase: string,
  subjectValue: string,
  predicateIri: string,
  literalValue: string,
  datatypeIri?: string,
): boolean {
  const subjectIri = toAbsoluteIri(meshBase, subjectValue);

  return quads.some((quad) =>
    quad.subject.termType === "NamedNode" &&
    quad.subject.value === subjectIri &&
    quad.predicate.value === predicateIri &&
    quad.object.termType === "Literal" &&
    quad.object.value === literalValue &&
    (datatypeIri === undefined || quad.object.datatype.value === datatypeIri)
  );
}

export function hasPredicateFact(
  quads: readonly Quad[],
  predicateIri: string,
): boolean {
  return quads.some((quad) => quad.predicate.value === predicateIri);
}

export function hasSubjectPredicateFact(
  quads: readonly Quad[],
  meshBase: string,
  subjectValue: string,
  predicateIri: string,
): boolean {
  const subjectIri = toAbsoluteIri(meshBase, subjectValue);
  return quads.some((quad) =>
    quad.subject.termType === "NamedNode" &&
    quad.subject.value === subjectIri &&
    quad.predicate.value === predicateIri
  );
}

export function resolveOptionalNamedNodePath(
  quads: readonly Quad[],
  meshBase: string,
  subjectValue: string,
  predicateIri: string,
  errorMessage: string,
): string | undefined {
  const objectIri = requireOptionalNamedNodeObject(
    quads,
    toAbsoluteIri(meshBase, subjectValue),
    predicateIri,
    errorMessage,
  );

  return objectIri
    ? toMeshRelativePath(meshBase, objectIri, errorMessage)
    : undefined;
}

export function toAbsoluteIri(meshBase: string, value: string): string {
  return new URL(value, meshBase).href;
}
