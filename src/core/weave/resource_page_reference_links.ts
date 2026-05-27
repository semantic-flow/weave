import { Parser, type Quad } from "n3";
import { toReferenceCatalogPath } from "../designator_segments.ts";
import { SFLO_NAMESPACE } from "../rdf/namespaces.ts";
import type {
  ResourcePageReferenceLinkModel,
  ResourcePageReferenceTargetModel,
} from "./resource_page_models.ts";

const SFLO_HAS_REFERENCE_LINK_IRI = `${SFLO_NAMESPACE}hasReferenceLink`;
const SFLO_HAS_REFERENCE_ROLE_IRI = `${SFLO_NAMESPACE}hasReferenceRole`;
const SFLO_HAS_REFERENCE_SOURCE_IRI = `${SFLO_NAMESPACE}hasReferenceSource`;
const SFLO_TARGET_HISTORICAL_STATE_IRI =
  `${SFLO_NAMESPACE}targetHistoricalState`;
const SFLO_TARGET_ARTIFACT_IRI = `${SFLO_NAMESPACE}targetArtifact`;
const SFLO_REFERENCE_LINK_FOR_IRI = `${SFLO_NAMESPACE}referenceLinkFor`;
const SFLO_REFERENCE_LINK_IRI = `${SFLO_NAMESPACE}ReferenceLink`;
export const SFLO_REFERENCE_ROLE_CANONICAL_IRI =
  `${SFLO_NAMESPACE}referenceRole_canonical`;
const RDF_TYPE_IRI = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type";

export interface ParsedResourceReferenceLink {
  roleIris: readonly string[];
  model: ResourcePageReferenceLinkModel;
  referenceTargetPaths: readonly string[];
  referenceTargetStatePaths: readonly string[];
}

export function extractResourceReferenceLinks(
  meshBase: string,
  designatorPath: string,
  referenceCatalogTurtle: string,
  createParseError: (message: string) => Error = (message) =>
    new Error(message),
): readonly ParsedResourceReferenceLink[] {
  const quads = parseReferenceCatalogQuads(
    meshBase,
    referenceCatalogTurtle,
    `Could not parse the current ReferenceCatalog while collecting references for ${designatorPath}.`,
    createParseError,
  );
  const referenceCatalogIri = new URL(
    toReferenceCatalogPath(designatorPath),
    meshBase,
  ).href;
  const linkSubjectPrefix = `${referenceCatalogIri}#`;
  const designatorIri = new URL(designatorPath, meshBase).href;
  const linkSubjects = new Set<string>();

  for (const quad of quads) {
    if (
      quad.subject.termType !== "NamedNode" ||
      !quad.subject.value.startsWith(linkSubjectPrefix)
    ) {
      continue;
    }

    const subjectIri = quad.subject.value;
    if (
      hasNamedNodeObject(
        quads,
        subjectIri,
        RDF_TYPE_IRI,
        SFLO_REFERENCE_LINK_IRI,
      ) &&
      hasNamedNodeObject(
        quads,
        subjectIri,
        SFLO_REFERENCE_LINK_FOR_IRI,
        designatorIri,
      ) &&
      hasNamedNodeObject(
        quads,
        designatorIri,
        SFLO_HAS_REFERENCE_LINK_IRI,
        subjectIri,
      )
    ) {
      linkSubjects.add(subjectIri);
    }
  }

  const links: ParsedResourceReferenceLink[] = [];
  for (const subjectIri of [...linkSubjects].sort()) {
    const roleIris = findNamedNodeObjects(
      quads,
      subjectIri,
      SFLO_HAS_REFERENCE_ROLE_IRI,
    );
    const referenceSourceIris = findNamedNodeObjects(
      quads,
      subjectIri,
      SFLO_HAS_REFERENCE_SOURCE_IRI,
    );
    const referenceTargetIris = referenceSourceIris.flatMap((sourceIri) =>
      findNamedNodeObjects(quads, sourceIri, SFLO_TARGET_ARTIFACT_IRI)
    );
    const referenceTargetStateIris = referenceSourceIris.flatMap((sourceIri) =>
      findNamedNodeObjects(
        quads,
        sourceIri,
        SFLO_TARGET_HISTORICAL_STATE_IRI,
      )
    );
    const targets = toResourcePageReferenceTargets([
      ...referenceTargetIris,
      ...referenceTargetStateIris,
    ]);

    if (roleIris.length === 0 || targets.length === 0) {
      continue;
    }

    const referenceTargetPaths = referenceTargetIris.flatMap((iri) => {
      const meshPath = toMeshPath(meshBase, iri);
      return meshPath === undefined ? [] : [meshPath];
    });
    const referenceTargetStatePaths = referenceTargetStateIris.flatMap(
      (iri) => {
        const meshPath = toMeshPath(meshBase, iri);
        return meshPath === undefined ? [] : [meshPath];
      },
    );

    for (const roleIri of roleIris) {
      links.push({
        roleIris: [roleIri],
        model: {
          roleLabel: toReferenceRoleLabel(roleIri),
          targets,
        },
        referenceTargetPaths,
        referenceTargetStatePaths,
      });
    }
  }

  return links;
}

function parseReferenceCatalogQuads(
  meshBase: string,
  referenceCatalogTurtle: string,
  parseErrorMessage: string,
  createParseError: (message: string) => Error,
): readonly Quad[] {
  try {
    return new Parser({ baseIRI: meshBase }).parse(referenceCatalogTurtle);
  } catch {
    throw createParseError(parseErrorMessage);
  }
}

function toResourcePageReferenceTargets(
  values: readonly string[],
): readonly ResourcePageReferenceTargetModel[] {
  const targets = new Map<string, ResourcePageReferenceTargetModel>();

  for (const value of values) {
    targets.set(value, {
      href: value,
      label: value,
    });
  }

  return [...targets.values()].sort((left, right) =>
    left.label.localeCompare(right.label)
  );
}

function hasNamedNodeObject(
  quads: readonly Quad[],
  subjectIri: string,
  predicateIri: string,
  objectIri: string,
): boolean {
  return quads.some((quad) =>
    quad.subject.termType === "NamedNode" &&
    quad.subject.value === subjectIri &&
    quad.predicate.value === predicateIri &&
    quad.object.termType === "NamedNode" &&
    quad.object.value === objectIri
  );
}

function findNamedNodeObjects(
  quads: readonly Quad[],
  subjectIri: string,
  predicateIri: string,
): readonly string[] {
  const values = new Set<string>();

  for (const quad of quads) {
    if (
      quad.subject.termType === "NamedNode" &&
      quad.subject.value === subjectIri &&
      quad.predicate.value === predicateIri &&
      quad.object.termType === "NamedNode"
    ) {
      values.add(quad.object.value);
    }
  }

  return [...values].sort();
}

function toReferenceRoleLabel(referenceRoleIri: string): string {
  const localName = toLastIriSegment(referenceRoleIri);
  const referenceRolePrefix = "referenceRole_";
  return localName.startsWith(referenceRolePrefix)
    ? localName.slice(referenceRolePrefix.length)
    : localName;
}

function toLastIriSegment(iri: string): string {
  const hashIndex = iri.lastIndexOf("#");
  const slashIndex = iri.lastIndexOf("/");
  const index = Math.max(hashIndex, slashIndex);
  return index === -1 ? iri : iri.slice(index + 1);
}

function toMeshPath(meshBase: string, iri: string): string | undefined {
  const meshUrl = new URL(meshBase);
  const iriUrl = new URL(iri);
  if (iriUrl.origin !== meshUrl.origin) {
    return undefined;
  }
  const basePath = meshUrl.pathname.endsWith("/")
    ? meshUrl.pathname
    : `${meshUrl.pathname}/`;
  if (!iriUrl.pathname.startsWith(basePath)) {
    return undefined;
  }
  return decodeURIComponent(iriUrl.pathname.slice(basePath.length));
}
