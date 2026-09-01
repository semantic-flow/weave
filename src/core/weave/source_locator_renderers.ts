import { toPayloadSourceRepositoryFloatingLocatorPath } from "../designator_segments.ts";
import { SFLO_NAMESPACE } from "../rdf/namespaces.ts";
import type { RepositorySourceFloatingLocator } from "./source_models.ts";
import { usesMeshLocalWorkingLocatedFile } from "./working_file_paths.ts";

export interface CurrentWorkingFileLocatorTerm {
  predicateIri: string;
  objectTermType: "NamedNode" | "Literal";
  objectValue: string;
}

export function resolveCurrentWorkingFileLocatorTerm(
  designatorPath: string,
  workingLocalRelativePath: string,
  repositorySourceFloatingLocator?: RepositorySourceFloatingLocator,
): CurrentWorkingFileLocatorTerm {
  if (repositorySourceFloatingLocator !== undefined) {
    return {
      predicateIri: `${SFLO_NAMESPACE}hasRepositorySourceFloatingLocator`,
      objectTermType: "NamedNode",
      objectValue: toPayloadSourceRepositoryFloatingLocatorPath(
        designatorPath,
      ),
    };
  }
  if (usesMeshLocalWorkingLocatedFile(workingLocalRelativePath)) {
    return {
      predicateIri: `${SFLO_NAMESPACE}hasWorkingLocatedFile`,
      objectTermType: "NamedNode",
      objectValue: workingLocalRelativePath,
    };
  }
  return {
    predicateIri: `${SFLO_NAMESPACE}workingLocalRelativePath`,
    objectTermType: "Literal",
    objectValue: workingLocalRelativePath,
  };
}

export function renderCurrentWorkingFileLocator(
  designatorPath: string,
  workingLocalRelativePath: string,
  repositorySourceFloatingLocator?: RepositorySourceFloatingLocator,
  options: { terminal?: "." | ";" } = {},
): string {
  const terminal = options.terminal ?? ";";
  const locator = resolveCurrentWorkingFileLocatorTerm(
    designatorPath,
    workingLocalRelativePath,
    repositorySourceFloatingLocator,
  );
  const predicate = `sflo:${locator.predicateIri.slice(SFLO_NAMESPACE.length)}`;
  const object = locator.objectTermType === "NamedNode"
    ? `<${locator.objectValue}>`
    : JSON.stringify(locator.objectValue);
  return `${predicate} ${object} ${terminal}`;
}

export function renderCurrentWorkingFileDeclaration(
  designatorPath: string,
  workingLocalRelativePath: string,
  repositorySourceFloatingLocator?: RepositorySourceFloatingLocator,
  options: { locatedFileIsRdfDocument?: boolean } = {},
): string {
  if (repositorySourceFloatingLocator !== undefined) {
    return renderRepositorySourceFloatingLocatorNamedBlock(
      designatorPath,
      repositorySourceFloatingLocator,
    );
  }
  const locatedFileTypes = options.locatedFileIsRdfDocument === false
    ? "sflo:LocatedFile"
    : "sflo:LocatedFile, sflo:RdfDocument";
  return usesMeshLocalWorkingLocatedFile(workingLocalRelativePath)
    ? `<${workingLocalRelativePath}> a ${locatedFileTypes} .`
    : "";
}

export function renderRepositorySourceFloatingLocatorNamedBlock(
  designatorPath: string,
  locator: RepositorySourceFloatingLocator,
): string {
  const locatorPath = toPayloadSourceRepositoryFloatingLocatorPath(
    designatorPath,
  );
  const repositoryUrl = JSON.stringify(locator.repositoryUrl);
  const repositoryPathFromRoot = JSON.stringify(locator.repositoryPathFromRoot);
  return `<${locatorPath}> a sflo:RepositorySourceFloatingLocator ;
  sflo:sourceRepositoryUrl ${repositoryUrl} ;
  sflo:sourceRepositoryPathFromRoot ${repositoryPathFromRoot} .`;
}
