import type { RepositorySourceFloatingLocator } from "./source_models.ts";
import { usesMeshLocalWorkingLocatedFile } from "./working_file_paths.ts";

export function renderCurrentWorkingFileLocator(
  workingLocalRelativePath: string,
  repositorySourceFloatingLocator?: RepositorySourceFloatingLocator,
): string {
  if (repositorySourceFloatingLocator !== undefined) {
    return `sflo:hasRepositorySourceFloatingLocator ${
      renderRepositorySourceFloatingLocatorBlankNode(
        repositorySourceFloatingLocator,
      )
    } ;`;
  }
  return usesMeshLocalWorkingLocatedFile(workingLocalRelativePath)
    ? `sflo:hasWorkingLocatedFile <${workingLocalRelativePath}> ;`
    : `sflo:workingLocalRelativePath ${
      JSON.stringify(workingLocalRelativePath)
    } ;`;
}

export function renderCurrentWorkingFileDeclaration(
  workingLocalRelativePath: string,
  repositorySourceFloatingLocator?: RepositorySourceFloatingLocator,
  options: { locatedFileIsRdfDocument?: boolean } = {},
): string {
  if (repositorySourceFloatingLocator !== undefined) {
    return "";
  }
  const locatedFileTypes = options.locatedFileIsRdfDocument === false
    ? "sflo:LocatedFile"
    : "sflo:LocatedFile, sflo:RdfDocument";
  return usesMeshLocalWorkingLocatedFile(workingLocalRelativePath)
    ? `<${workingLocalRelativePath}> a ${locatedFileTypes} .`
    : "";
}

export function renderRepositorySourceFloatingLocatorBlankNode(
  locator: RepositorySourceFloatingLocator,
): string {
  const repositoryUrl = JSON.stringify(locator.repositoryUrl);
  const repositoryPathFromRoot = JSON.stringify(locator.repositoryPathFromRoot);
  return `[
    a sflo:RepositorySourceFloatingLocator ;
    sflo:sourceRepositoryUrl ${repositoryUrl} ;
    sflo:sourceRepositoryPathFromRoot ${repositoryPathFromRoot}
  ]`;
}
