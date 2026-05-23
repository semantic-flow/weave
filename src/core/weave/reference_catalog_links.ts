import { SFLO_NAMESPACE } from "../rdf/namespaces.ts";
import { WeaveInputError } from "./errors.ts";
import {
  hasNamedNodeFact,
  parseWeaveShapeQuads,
  requireOptionalNamedNodeObject,
  requireSingleNamedNodeObject,
  toAbsoluteIri,
  toMeshRelativePath,
} from "./rdf_helpers.ts";
import type { ReferenceCatalogCurrentLinkModel } from "./resource_page_models.ts";

const RDF_TYPE_IRI = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type";
const SFLO_HAS_REFERENCE_LINK_IRI = `${SFLO_NAMESPACE}hasReferenceLink`;
const SFLO_HAS_REFERENCE_ROLE_IRI = `${SFLO_NAMESPACE}hasReferenceRole`;
const SFLO_REFERENCE_LINK_FOR_IRI = `${SFLO_NAMESPACE}referenceLinkFor`;
const SFLO_REFERENCE_LINK_IRI = `${SFLO_NAMESPACE}ReferenceLink`;
const SFLO_REFERENCE_TARGET_IRI = `${SFLO_NAMESPACE}referenceTarget`;
const SFLO_REFERENCE_TARGET_STATE_IRI = `${SFLO_NAMESPACE}referenceTargetState`;

export function extractCurrentReferenceCatalogLinks(
  meshBase: string,
  currentReferenceCatalogTurtle: string,
  designatorPath: string,
  referenceCatalogPath: string,
): readonly ReferenceCatalogCurrentLinkModel[] {
  const errorMessage =
    `Could not parse the current ReferenceCatalog working file for ${designatorPath}.`;
  const referenceCatalogIri = toAbsoluteIri(meshBase, referenceCatalogPath);
  const linkSubjectPrefix = `${referenceCatalogIri}#`;
  const quads = parseWeaveShapeQuads(
    meshBase,
    currentReferenceCatalogTurtle,
    errorMessage,
  );
  const linkSubjects = Array.from(
    new Set(
      quads.flatMap((quad) =>
        quad.subject.termType === "NamedNode" &&
          quad.subject.value.startsWith(linkSubjectPrefix)
          ? [quad.subject.value]
          : []
      ),
    ),
  );
  const links: ReferenceCatalogCurrentLinkModel[] = [];

  for (const subjectIri of linkSubjects) {
    const fragment = subjectIri.slice(linkSubjectPrefix.length);
    if (fragment.length === 0) {
      throw new WeaveInputError(
        errorMessage,
      );
    }

    if (
      !hasNamedNodeFact(
        quads,
        meshBase,
        designatorPath,
        SFLO_HAS_REFERENCE_LINK_IRI,
        subjectIri,
      )
    ) {
      throw new WeaveInputError(
        `ReferenceCatalog owner did not declare current link ${fragment} for ${designatorPath}.`,
      );
    }

    if (
      !hasNamedNodeFact(
        quads,
        meshBase,
        subjectIri,
        RDF_TYPE_IRI,
        SFLO_REFERENCE_LINK_IRI,
      )
    ) {
      throw new WeaveInputError(errorMessage);
    }

    const linkForIri = requireSingleNamedNodeObject(
      quads,
      subjectIri,
      SFLO_REFERENCE_LINK_FOR_IRI,
      errorMessage,
    );
    if (linkForIri !== toAbsoluteIri(meshBase, designatorPath)) {
      throw new WeaveInputError(
        `ReferenceCatalog link target subject did not match ${designatorPath}.`,
      );
    }

    const referenceRoleIri = requireSingleNamedNodeObject(
      quads,
      subjectIri,
      SFLO_HAS_REFERENCE_ROLE_IRI,
      errorMessage,
    );
    const referenceTargetIri = requireSingleNamedNodeObject(
      quads,
      subjectIri,
      SFLO_REFERENCE_TARGET_IRI,
      errorMessage,
    );
    const referenceTargetStateIri = requireOptionalNamedNodeObject(
      quads,
      subjectIri,
      SFLO_REFERENCE_TARGET_STATE_IRI,
      errorMessage,
    );

    links.push({
      fragment,
      referenceRoleLabel: toReferenceRoleLabel(referenceRoleIri),
      referenceTargetPath: toMeshRelativePath(
        meshBase,
        referenceTargetIri,
        `ReferenceCatalog link target for ${designatorPath}`,
      ),
      ...(referenceTargetStateIri
        ? {
          referenceTargetStatePath: toMeshRelativePath(
            meshBase,
            referenceTargetStateIri,
            `ReferenceCatalog link target state for ${designatorPath}`,
          ),
        }
        : {}),
    });
  }

  if (links.length === 0) {
    throw new WeaveInputError(
      `ReferenceCatalog working file did not contain any current links for ${designatorPath}.`,
    );
  }

  return links.sort((left, right) =>
    left.fragment.localeCompare(right.fragment)
  );
}

function toReferenceRoleLabel(referenceRoleIri: string): string {
  const localName = toLastPathSegment(referenceRoleIri);
  const referenceRolePrefix = "referenceRole_";
  return localName.startsWith(referenceRolePrefix)
    ? localName.slice(referenceRolePrefix.length)
    : localName.toLowerCase();
}

function toLastPathSegment(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1);
}
