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
  return `${nextBlocks.join("\n\n")}\n`;
}

export function renderExactExtractionSourceBlock(
  extractionSourcePath: string,
  sourceDesignatorPath: string,
  sourceStatePath: string,
  sourceEvidence: ExtractionSourceEvidenceModel | undefined,
): string {
  const facts: [string, string][] = [
    ["sflo:hasTargetArtifact", `<${sourceDesignatorPath}>`],
    ["sflo:hasRequestedTargetState", `<${sourceStatePath}>`],
    ...toExtractionSourceEvidenceFacts(sourceEvidence),
  ];

  return `<${extractionSourcePath}> a sflo:ExtractionSource ;
${
    facts.map(([predicate, object], index) =>
      `  ${predicate} ${object}${index === facts.length - 1 ? " ." : " ;"}`
    ).join("\n")
  }`;
}

function toExtractionSourceEvidenceFacts(
  sourceEvidence: ExtractionSourceEvidenceModel | undefined,
): [string, string][] {
  if (!sourceEvidence) {
    return [];
  }

  const facts: [string, string][] = [];
  if (sourceEvidence.sourceStatePath !== undefined) {
    facts.push([
      "sflo:hasObservedSourceState",
      `<${sourceEvidence.sourceStatePath}>`,
    ]);
  }
  if (sourceEvidence.sourceManifestationPath !== undefined) {
    facts.push([
      "sflo:hasObservedSourceManifestation",
      `<${sourceEvidence.sourceManifestationPath}>`,
    ]);
  }
  if (sourceEvidence.sourceLocatedFilePath !== undefined) {
    facts.push([
      "sflo:hasObservedSourceLocatedFile",
      `<${sourceEvidence.sourceLocatedFilePath}>`,
    ]);
  }
  if (sourceEvidence.sourceLocalRelativePath !== undefined) {
    facts.push([
      "sflo:observedSourceLocalRelativePath",
      `"${escapeTurtleString(sourceEvidence.sourceLocalRelativePath)}"`,
    ]);
  }
  if (sourceEvidence.sourceDigest !== undefined) {
    facts.push([
      "sflo:observedSourceDigest",
      `"${escapeTurtleString(sourceEvidence.sourceDigest)}"`,
    ]);
  }
  if (sourceEvidence.observedAt !== undefined) {
    facts.push([
      "sflo:observedAt",
      `"${escapeTurtleString(sourceEvidence.observedAt)}"`,
    ]);
  }

  return facts;
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
