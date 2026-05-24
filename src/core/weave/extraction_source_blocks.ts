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
  const facts: [string, string][] = [
    ["sflo:hasTargetArtifact", `<${sourceDesignatorPath}>`],
    ["sflo:hasRequestedTargetState", `<${sourceStatePath}>`],
    ...(sourceEvidence
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

  const observationBlock = renderExtractionSourceObservationBlock(
    observationPath,
    sourceEvidence,
  );
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

  const facts: [string, string][] = [];
  if (sourceEvidence.sourceStatePath !== undefined) {
    facts.push([
      "sflo:hasObservedTargetState",
      `<${sourceEvidence.sourceStatePath}>`,
    ]);
  }
  if (sourceEvidence.sourceManifestationPath !== undefined) {
    facts.push([
      "sflo:hasObservedTargetManifestation",
      `<${sourceEvidence.sourceManifestationPath}>`,
    ]);
  }
  if (sourceEvidence.sourceLocatedFilePath !== undefined) {
    facts.push([
      "sflo:hasObservedTargetLocatedFile",
      `<${sourceEvidence.sourceLocatedFilePath}>`,
    ]);
  }
  if (sourceEvidence.sourceLocalRelativePath !== undefined) {
    facts.push([
      "sflo:observedTargetLocalRelativePath",
      `"${escapeTurtleString(sourceEvidence.sourceLocalRelativePath)}"`,
    ]);
  }
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
