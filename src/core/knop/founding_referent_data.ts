import { Lexer, Parser, type Quad, type Term } from "n3";
import {
  RDF_NAMESPACE,
  SFCFG_NAMESPACE,
  SFLO_NAMESPACE,
} from "../rdf/namespaces.ts";

export const MAX_FOUNDING_REFERENT_DATA_BYTES = 64 * 1024;
export const MAX_FOUNDING_REFERENT_DATA_TRIPLES = 256;

const RDF_TYPE_IRI = `${RDF_NAMESPACE}type`;

export type FoundingReferentDataErrorCode =
  | "root-refused"
  | "source-too-large"
  | "invalid-utf8"
  | "forbidden-base"
  | "malformed-turtle"
  | "empty-graph"
  | "too-many-triples"
  | "unsupported-rdf-term"
  | "relative-iri"
  | "wrong-subject"
  | "forbidden-core-vocabulary";

export class FoundingReferentDataInputError extends Error {
  readonly code: FoundingReferentDataErrorCode;

  constructor(code: FoundingReferentDataErrorCode, message: string) {
    super(message);
    this.name = "FoundingReferentDataInputError";
    this.code = code;
  }
}

export interface ValidateFoundingReferentDataInput {
  meshBase: string;
  designatorPath: string;
  bytes: Uint8Array;
}

export interface ValidatedFoundingReferentData {
  publicReferentIri: string;
  bytes: Uint8Array;
  tripleCount: number;
}

export function validateFoundingReferentData(
  input: ValidateFoundingReferentDataInput,
): ValidatedFoundingReferentData {
  if (input.designatorPath.length === 0) {
    throw new FoundingReferentDataInputError(
      "root-refused",
      "Founding referent data is not supported for the root designator.",
    );
  }
  if (input.bytes.byteLength > MAX_FOUNDING_REFERENT_DATA_BYTES) {
    throw new FoundingReferentDataInputError(
      "source-too-large",
      "Founding referent data exceeds the 64 KiB source limit.",
    );
  }

  const bytes = new Uint8Array(input.bytes.byteLength);
  bytes.set(input.bytes);
  let decoded: string;
  try {
    decoded = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new FoundingReferentDataInputError(
      "invalid-utf8",
      "Founding referent data must be valid UTF-8.",
    );
  }
  const turtle = decoded.startsWith("\uFEFF") ? decoded.slice(1) : decoded;

  assertNoBaseDirective(turtle);
  const quads = parseFoundingTurtle(turtle);
  if (quads.length === 0) {
    throw new FoundingReferentDataInputError(
      "empty-graph",
      "Founding referent data must contain at least one triple.",
    );
  }
  if (quads.length > MAX_FOUNDING_REFERENT_DATA_TRIPLES) {
    throw new FoundingReferentDataInputError(
      "too-many-triples",
      "Founding referent data exceeds the 256 triple limit.",
    );
  }

  const publicReferentIri = new URL(
    input.designatorPath,
    input.meshBase,
  ).href;
  for (const quad of quads) {
    assertFoundingQuad(quad, publicReferentIri);
  }

  return {
    publicReferentIri,
    bytes,
    tripleCount: quads.length,
  };
}

function assertNoBaseDirective(turtle: string): void {
  let tokens: Array<{ type: string }>;
  try {
    tokens = new Lexer().tokenize(turtle) as Array<{ type: string }>;
  } catch {
    throw new FoundingReferentDataInputError(
      "malformed-turtle",
      "Founding referent data must be valid Turtle.",
    );
  }
  if (
    tokens.some((token) => {
      const tokenType = token.type.toLowerCase();
      return tokenType === "@base" || tokenType === "base";
    })
  ) {
    throw new FoundingReferentDataInputError(
      "forbidden-base",
      "Founding referent data must not declare a base IRI.",
    );
  }
}

function parseFoundingTurtle(turtle: string): Quad[] {
  try {
    return new Parser({ format: "text/turtle" }).parse(turtle);
  } catch {
    throw new FoundingReferentDataInputError(
      "malformed-turtle",
      "Founding referent data must be valid Turtle.",
    );
  }
}

function assertFoundingQuad(quad: Quad, publicReferentIri: string): void {
  if (
    quad.graph.termType !== "DefaultGraph" ||
    quad.subject.termType !== "NamedNode" ||
    quad.predicate.termType !== "NamedNode" ||
    (quad.object.termType !== "NamedNode" && quad.object.termType !== "Literal")
  ) {
    throw new FoundingReferentDataInputError(
      "unsupported-rdf-term",
      "Founding referent data contains an unsupported RDF term.",
    );
  }

  assertAbsoluteNamedNode(quad.subject);
  assertAbsoluteNamedNode(quad.predicate);
  if (quad.subject.value !== publicReferentIri) {
    throw new FoundingReferentDataInputError(
      "wrong-subject",
      "Every founding referent data subject must exactly match the public referent IRI.",
    );
  }
  if (isCoreNamespaceIri(quad.predicate.value)) {
    throw new FoundingReferentDataInputError(
      "forbidden-core-vocabulary",
      "Founding referent data predicates must not use SFLO or SFCFG vocabulary.",
    );
  }

  if (quad.object.termType === "NamedNode") {
    assertAbsoluteNamedNode(quad.object);
    if (
      quad.predicate.value === RDF_TYPE_IRI &&
      isCoreNamespaceIri(quad.object.value)
    ) {
      throw new FoundingReferentDataInputError(
        "forbidden-core-vocabulary",
        "Founding referent data rdf:type objects must not use SFLO or SFCFG vocabulary.",
      );
    }
  } else {
    assertAbsoluteNamedNode(quad.object.datatype);
  }
}

function assertAbsoluteNamedNode(term: Term): void {
  if (term.termType !== "NamedNode" || !isAbsoluteIri(term.value)) {
    throw new FoundingReferentDataInputError(
      "relative-iri",
      "Every named node in founding referent data must be an absolute IRI.",
    );
  }
}

function isAbsoluteIri(value: string): boolean {
  try {
    return new URL(value).protocol.length > 0;
  } catch {
    return false;
  }
}

function isCoreNamespaceIri(value: string): boolean {
  return value.startsWith(SFLO_NAMESPACE) || value.startsWith(SFCFG_NAMESPACE);
}
