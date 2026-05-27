import type { ExtractionSourceEvidenceModel } from "./candidates.ts";
import { WeaveInputError } from "./errors.ts";
import { findSubjectBlockIndex, splitTurtleBlocks } from "./turtle_blocks.ts";

export function replaceExtractionSourceBlock(
  turtle: string,
  extractionSourcePath: string,
  replacementBlock: string,
): string {
  const blocks = splitTurtleBlocks(turtle);
  const blockIndex = findSubjectBlockIndex(blocks, extractionSourcePath);
  if (blockIndex === -1) {
    throw new WeaveInputError(
      `Could not replace existing ExtractionSource block <${extractionSourcePath}>.`,
    );
  }

  const nextBlocks = [...blocks];
  nextBlocks[blockIndex] = replacementBlock;
  const staleObservationIndex = findSubjectBlockIndex(
    nextBlocks,
    `${extractionSourcePath}-observation-001`,
  );
  if (staleObservationIndex !== -1 && staleObservationIndex !== blockIndex) {
    nextBlocks.splice(staleObservationIndex, 1);
  }
  return `${nextBlocks.join("\n\n")}\n`;
}

export function renderExactExtractionSourceBlock(
  extractionSourcePath: string,
  sourceDesignatorPath: string,
  sourceStatePath: string,
  sourceEvidence: ExtractionSourceEvidenceModel | undefined,
): string {
  const observationPath = `${extractionSourcePath}-observation-001`;
  const observationBlock = renderExtractionSourceObservationBlock(
    observationPath,
    sourceEvidence,
  );
  const facts: [string, string][] = [
    ["sflo:targetArtifact", `<${sourceDesignatorPath}>`],
    ["sflo:targetHistoricalState", `<${sourceStatePath}>`],
    ...(observationBlock
      ? [["sflo:hasResolutionObservation", `<${observationPath}>`] as [
        string,
        string,
      ]]
      : []),
  ];

  const sourceBlock = `<${extractionSourcePath}> a sflo:ExtractionSource ;
${
    facts.map(([predicate, object], index) =>
      `  ${predicate} ${object}${index === facts.length - 1 ? " ." : " ;"}`
    ).join("\n")
  }`;

  return observationBlock
    ? `${sourceBlock}\n\n${observationBlock}`
    : sourceBlock;
}

function renderExtractionSourceObservationBlock(
  observationPath: string,
  sourceEvidence: ExtractionSourceEvidenceModel | undefined,
): string | undefined {
  if (!sourceEvidence) {
    return undefined;
  }

  const observedSpecFacts: [string, string][] = [
    ["a", "sflo:ArtifactResolutionSpec"],
  ];
  if (sourceEvidence.sourceStatePath !== undefined) {
    observedSpecFacts.push([
      "sflo:targetHistoricalState",
      `<${sourceEvidence.sourceStatePath}>`,
    ]);
  }
  if (sourceEvidence.sourceManifestationPath !== undefined) {
    observedSpecFacts.push([
      "sflo:targetManifestation",
      `<${sourceEvidence.sourceManifestationPath}>`,
    ]);
  }
  if (sourceEvidence.sourceLocatedFilePath !== undefined) {
    observedSpecFacts.push([
      "sflo:targetLocatedFile",
      `<${sourceEvidence.sourceLocatedFilePath}>`,
    ]);
  }
  if (sourceEvidence.sourceLocalRelativePath !== undefined) {
    observedSpecFacts.push([
      "sflo:targetLocalRelativePath",
      `"${escapeTurtleString(sourceEvidence.sourceLocalRelativePath)}"`,
    ]);
  }
  if (
    observedSpecFacts.length === 1 &&
    sourceEvidence.sourceDigest === undefined &&
    sourceEvidence.observedAt === undefined
  ) {
    return undefined;
  }
  const facts: [string, string][] = [
    [
      "sflo:observedArtifactResolutionSpec",
      renderObservedArtifactResolutionSpec(observedSpecFacts),
    ],
  ];
  if (sourceEvidence.sourceDigest !== undefined) {
    facts.push([
      "sflo:observedContentDigest",
      `"${escapeTurtleString(sourceEvidence.sourceDigest)}"`,
    ]);
  }
  if (sourceEvidence.observedAt !== undefined) {
    facts.push([
      "sflo:observedAt",
      `"${escapeTurtleString(sourceEvidence.observedAt)}"`,
    ]);
  }

  if (facts.length === 0) {
    return undefined;
  }

  return `<${observationPath}> a sflo:ArtifactResolutionObservation ;
${
    facts.map(([predicate, object], index) =>
      `  ${predicate} ${object}${index === facts.length - 1 ? " ." : " ;"}`
    ).join("\n")
  }`;
}

function renderObservedArtifactResolutionSpec(
  facts: readonly [string, string][],
): string {
  return `[
${
    facts.map(([predicate, object], index) =>
      `    ${predicate} ${object}${index === facts.length - 1 ? "" : " ;"}`
    ).join("\n")
  }
  ]`;
}

function escapeTurtleString(value: string): string {
  return value.replace(/[\b\t\n\f\r"\\]/g, (character) => {
    switch (character) {
      case "\b":
        return "\\b";
      case "\t":
        return "\\t";
      case "\n":
        return "\\n";
      case "\f":
        return "\\f";
      case "\r":
        return "\\r";
      case '"':
        return '\\"';
      case "\\":
        return "\\\\";
      default:
        return character;
    }
  });
}
