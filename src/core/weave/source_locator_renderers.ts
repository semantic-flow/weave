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
): string {
  if (repositorySourceFloatingLocator !== undefined) {
    return "";
  }
  return usesMeshLocalWorkingLocatedFile(workingLocalRelativePath)
    ? `<${workingLocalRelativePath}> a sflo:LocatedFile, sflo:RdfDocument .`
    : "";
}

export function renderRepositorySourceFloatingLocatorBlankNode(
  locator: RepositorySourceFloatingLocator,
): string {
  return `[
    a sflo:RepositorySourceFloatingLocator ;
    sflo:sourceRepositoryUrl ${JSON.stringify(locator.repositoryUrl)} ;
    sflo:sourceRepositoryPathFromRoot ${
    JSON.stringify(locator.repositoryPathFromRoot)
  }
  ]`;
}
