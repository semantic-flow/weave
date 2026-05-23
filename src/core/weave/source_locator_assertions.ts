import type { Quad } from "n3";
import { SFLO_NAMESPACE } from "../rdf/namespaces.ts";
import type {
  PayloadWorkingArtifact,
  ReferenceTargetSourcePayloadArtifact,
} from "./candidates.ts";
import { WeaveInputError } from "./errors.ts";
import {
  hasSubjectPredicateFact,
  hasTermKeyNamedNodeFact,
  resolveUniqueLiteralValuesForTermKey,
  toAbsoluteIri,
  toMeshRelativePath,
  toRdfTermKey,
} from "./rdf_helpers.ts";
import type { RepositorySourceFloatingLocator } from "./source_models.ts";
import { normalizeWorkingLocalRelativePathLiteral } from "./working_file_paths.ts";

const RDF_TYPE_IRI = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type";
const SFLO_HAS_WORKING_LOCATED_FILE_IRI =
  `${SFLO_NAMESPACE}hasWorkingLocatedFile`;
const SFLO_HAS_REPOSITORY_SOURCE_FLOATING_LOCATOR_IRI =
  `${SFLO_NAMESPACE}hasRepositorySourceFloatingLocator`;
const SFLO_REPOSITORY_SOURCE_FLOATING_LOCATOR_IRI =
  `${SFLO_NAMESPACE}RepositorySourceFloatingLocator`;
const SFLO_SOURCE_REPOSITORY_URL_IRI = `${SFLO_NAMESPACE}sourceRepositoryUrl`;
const SFLO_SOURCE_REPOSITORY_PATH_FROM_ROOT_IRI =
  `${SFLO_NAMESPACE}sourceRepositoryPathFromRoot`;
const SFLO_WORKING_FILE_PATH_IRI = `${SFLO_NAMESPACE}workingLocalRelativePath`;

export function assertHasCurrentPayloadSourceLocator(
  quads: readonly Quad[],
  meshBase: string,
  errorMessage: string,
  subjectValue: string,
  payloadArtifact: PayloadWorkingArtifact,
): void {
  const repositorySourceFloatingLocator =
    payloadArtifact.repositorySourceFloatingLocator;

  if (repositorySourceFloatingLocator === undefined) {
    assertHasCurrentWorkingFileLocator(
      quads,
      meshBase,
      errorMessage,
      subjectValue,
      payloadArtifact.workingLocalRelativePath,
    );
    return;
  }

  if (
    hasSubjectPredicateFact(
      quads,
      meshBase,
      subjectValue,
      SFLO_HAS_WORKING_LOCATED_FILE_IRI,
    ) ||
    hasSubjectPredicateFact(
      quads,
      meshBase,
      subjectValue,
      SFLO_WORKING_FILE_PATH_IRI,
    )
  ) {
    throw new WeaveInputError(errorMessage);
  }

  assertHasRepositorySourceFloatingLocator(
    quads,
    meshBase,
    errorMessage,
    subjectValue,
    repositorySourceFloatingLocator,
  );
}

export function assertHasCurrentSourceLocator(
  quads: readonly Quad[],
  meshBase: string,
  errorMessage: string,
  subjectValue: string,
  sourceArtifact: Pick<
    ReferenceTargetSourcePayloadArtifact,
    "workingLocalRelativePath" | "repositorySourceFloatingLocator"
  >,
): void {
  if (sourceArtifact.repositorySourceFloatingLocator === undefined) {
    assertHasCurrentWorkingFileLocator(
      quads,
      meshBase,
      errorMessage,
      subjectValue,
      sourceArtifact.workingLocalRelativePath,
    );
    return;
  }

  if (
    hasSubjectPredicateFact(
      quads,
      meshBase,
      subjectValue,
      SFLO_HAS_WORKING_LOCATED_FILE_IRI,
    ) ||
    hasSubjectPredicateFact(
      quads,
      meshBase,
      subjectValue,
      SFLO_WORKING_FILE_PATH_IRI,
    )
  ) {
    throw new WeaveInputError(errorMessage);
  }

  assertHasRepositorySourceFloatingLocator(
    quads,
    meshBase,
    errorMessage,
    subjectValue,
    sourceArtifact.repositorySourceFloatingLocator,
  );
}

export function assertHasRepositorySourceFloatingLocator(
  quads: readonly Quad[],
  meshBase: string,
  errorMessage: string,
  subjectValue: string,
  expectedLocator: RepositorySourceFloatingLocator,
): void {
  const subjectIri = toAbsoluteIri(meshBase, subjectValue);
  const locatorKeys = new Set<string>();

  for (const quad of quads) {
    if (
      quad.subject.termType !== "NamedNode" ||
      quad.subject.value !== subjectIri ||
      quad.predicate.value !==
        SFLO_HAS_REPOSITORY_SOURCE_FLOATING_LOCATOR_IRI ||
      (quad.object.termType !== "NamedNode" &&
        quad.object.termType !== "BlankNode")
    ) {
      continue;
    }
    locatorKeys.add(toRdfTermKey(quad.object));
  }

  if (locatorKeys.size !== 1) {
    throw new WeaveInputError(errorMessage);
  }

  const locatorKey = locatorKeys.values().next().value!;
  if (
    !hasTermKeyNamedNodeFact(
      quads,
      locatorKey,
      RDF_TYPE_IRI,
      SFLO_REPOSITORY_SOURCE_FLOATING_LOCATOR_IRI,
    )
  ) {
    throw new WeaveInputError(errorMessage);
  }

  const repositoryUrls = resolveUniqueLiteralValuesForTermKey(
    quads,
    locatorKey,
    SFLO_SOURCE_REPOSITORY_URL_IRI,
    errorMessage,
  );
  let repositoryPaths: string[];
  try {
    repositoryPaths = resolveUniqueLiteralValuesForTermKey(
      quads,
      locatorKey,
      SFLO_SOURCE_REPOSITORY_PATH_FROM_ROOT_IRI,
      errorMessage,
    ).map((value) => normalizeWorkingLocalRelativePathLiteral(value));
  } catch (error) {
    if (error instanceof WeaveInputError) {
      throw error;
    }
    throw new WeaveInputError(errorMessage);
  }

  if (
    repositoryUrls.length !== 1 ||
    repositoryUrls[0] !== expectedLocator.repositoryUrl ||
    repositoryPaths.length !== 1 ||
    repositoryPaths[0] !== expectedLocator.repositoryPathFromRoot
  ) {
    throw new WeaveInputError(errorMessage);
  }
}

export function assertHasCurrentWorkingFileLocator(
  quads: readonly Quad[],
  meshBase: string,
  errorMessage: string,
  subjectValue: string,
  workingLocalRelativePath: string,
): void {
  const subjectIri = toAbsoluteIri(meshBase, subjectValue);
  const values = new Set<string>();

  for (const quad of quads) {
    if (
      quad.subject.termType !== "NamedNode" ||
      quad.subject.value !== subjectIri
    ) {
      continue;
    }

    if (
      quad.predicate.value === SFLO_HAS_WORKING_LOCATED_FILE_IRI &&
      quad.object.termType === "NamedNode"
    ) {
      try {
        values.add(
          toMeshRelativePath(
            meshBase,
            quad.object.value,
            `working file locator for ${subjectValue}`,
          ),
        );
      } catch {
        throw new WeaveInputError(errorMessage);
      }
      continue;
    }

    if (
      quad.predicate.value === SFLO_WORKING_FILE_PATH_IRI &&
      quad.object.termType === "Literal"
    ) {
      try {
        values.add(normalizeWorkingLocalRelativePathLiteral(quad.object.value));
      } catch {
        throw new WeaveInputError(errorMessage);
      }
    }
  }

  if (values.size !== 1 || !values.has(workingLocalRelativePath)) {
    throw new WeaveInputError(errorMessage);
  }
}
