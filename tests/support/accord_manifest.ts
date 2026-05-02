import type {
  FileExpectation,
  ManifestDocument,
  TransitionCase,
} from "../../dependencies/github.com/spectacular-voyage/accord/src/manifest/model.ts";

export async function readSingleTransitionCase(
  manifestPath: string,
): Promise<TransitionCase> {
  const raw = JSON.parse(
    await Deno.readTextFile(manifestPath),
  ) as ManifestDocument;
  const cases = raw.hasCase ?? [];
  if (cases.length !== 1) {
    throw new Error(
      `Expected exactly one TransitionCase in ${manifestPath}, found ${cases.length}.`,
    );
  }
  return cases[0];
}

export function getManifestFileExpectations(
  transitionCase: TransitionCase,
): FileExpectation[] {
  return transitionCase.hasFileExpectation ?? [];
}

export function shouldCompareManifestTextFileContents(path: string): boolean {
  return !path.endsWith(".html");
}
