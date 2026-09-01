import { toPayloadSourceRepositoryFloatingLocatorPath } from "../designator_segments.ts";
import type { RepositorySourceFloatingLocator } from "./source_models.ts";
import { usesMeshLocalWorkingLocatedFile } from "./working_file_paths.ts";

export function renderCurrentWorkingFileLocator(
  designatorPath: string,
  workingLocalRelativePath: string,
  repositorySourceFloatingLocator?: RepositorySourceFloatingLocator,
  options: { terminal?: "." | ";" } = {},
): string {
  const terminal = options.terminal ?? ";";
  if (repositorySourceFloatingLocator !== undefined) {
    return `sflo:hasRepositorySourceFloatingLocator <${
      toPayloadSourceRepositoryFloatingLocatorPath(designatorPath)
    }> ${terminal}`;
  }
  return usesMeshLocalWorkingLocatedFile(workingLocalRelativePath)
    ? `sflo:hasWorkingLocatedFile <${workingLocalRelativePath}> ${terminal}`
    : `sflo:workingLocalRelativePath ${
      JSON.stringify(workingLocalRelativePath)
    } ${terminal}`;
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
