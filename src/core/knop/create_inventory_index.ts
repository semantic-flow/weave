import type { Quad } from "n3";

const RDF_TYPE_IRI = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type";

export interface IndexedLiteralObject {
  readonly value: string;
  readonly language: string;
  readonly datatypeIri: string;
}

export class KnopCreateInventoryIndex {
  readonly #namedNodeFactKeys = new Set<string>();
  readonly #quadsBySubjectPredicate = new Map<string, Quad[]>();
  readonly #typedSubjectIrisByType = new Map<string, Set<string>>();

  constructor(quads: Iterable<Quad>) {
    for (const quad of quads) {
      if (
        quad.subject.termType !== "NamedNode" ||
        quad.predicate.termType !== "NamedNode"
      ) {
        continue;
      }

      const subjectPredicateKey = toSubjectPredicateKey(
        quad.subject.value,
        quad.predicate.value,
      );
      const slot = this.#quadsBySubjectPredicate.get(subjectPredicateKey);
      if (slot) {
        slot.push(quad);
      } else {
        this.#quadsBySubjectPredicate.set(subjectPredicateKey, [quad]);
      }

      if (quad.object.termType !== "NamedNode") {
        continue;
      }
      this.#namedNodeFactKeys.add(toNamedNodeFactKey(
        quad.subject.value,
        quad.predicate.value,
        quad.object.value,
      ));

      if (quad.predicate.value === RDF_TYPE_IRI) {
        const subjects = this.#typedSubjectIrisByType.get(quad.object.value);
        if (subjects) {
          subjects.add(quad.subject.value);
        } else {
          this.#typedSubjectIrisByType.set(
            quad.object.value,
            new Set([quad.subject.value]),
          );
        }
      }
    }
  }

  hasNamedNodeFact(
    subjectIri: string,
    predicateIri: string,
    objectIri: string,
  ): boolean {
    return this.#namedNodeFactKeys.has(
      toNamedNodeFactKey(subjectIri, predicateIri, objectIri),
    );
  }

  hasLiteralFact(
    subjectIri: string,
    predicateIri: string,
    literalValue: string,
    datatypeIri: string,
    language = "",
  ): boolean {
    return this.#slot(subjectIri, predicateIri).some((quad) =>
      quad.object.termType === "Literal" &&
      quad.object.value === literalValue &&
      quad.object.language === language &&
      quad.object.datatype.value === datatypeIri
    );
  }

  hasSubjectPredicate(subjectIri: string, predicateIri: string): boolean {
    return this.#quadsBySubjectPredicate.has(
      toSubjectPredicateKey(subjectIri, predicateIri),
    );
  }

  listTypedSubjectIris(typeIri: string): readonly string[] {
    return [...(this.#typedSubjectIrisByType.get(typeIri) ?? [])];
  }

  listNamedNodeObjectIris(
    subjectIri: string,
    predicateIri: string,
  ): readonly string[] {
    const objectIris = new Set<string>();
    for (const quad of this.#slot(subjectIri, predicateIri)) {
      if (quad.object.termType === "NamedNode") {
        objectIris.add(quad.object.value);
      }
    }
    return [...objectIris];
  }

  listLiteralObjects(
    subjectIri: string,
    predicateIri: string,
  ): readonly IndexedLiteralObject[] {
    const objects = new Map<string, IndexedLiteralObject>();
    for (const quad of this.#slot(subjectIri, predicateIri)) {
      if (quad.object.termType !== "Literal") {
        continue;
      }
      const object = {
        value: quad.object.value,
        language: quad.object.language,
        datatypeIri: quad.object.datatype.value,
      };
      objects.set(
        `${object.value}\u0000${object.language}\u0000${object.datatypeIri}`,
        object,
      );
    }
    return [...objects.values()];
  }

  #slot(subjectIri: string, predicateIri: string): readonly Quad[] {
    return this.#quadsBySubjectPredicate.get(
      toSubjectPredicateKey(subjectIri, predicateIri),
    ) ?? [];
  }
}

function toSubjectPredicateKey(
  subjectIri: string,
  predicateIri: string,
): string {
  return `${subjectIri}\u0000${predicateIri}`;
}

function toNamedNodeFactKey(
  subjectIri: string,
  predicateIri: string,
  objectIri: string,
): string {
  return `${subjectIri}\u0000${predicateIri}\u0000${objectIri}`;
}
