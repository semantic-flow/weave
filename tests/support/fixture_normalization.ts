export function normalizeLegacyFixtureRdf(contents: string): string {
  return normalizeExtractionSourceObservations(
    normalizeReferenceLinkSources(contents),
  );
}

function normalizeReferenceLinkSources(contents: string): string {
  const blocks = splitBlocks(contents);
  let changed = false;
  const nextBlocks: string[] = [];

  for (const block of blocks) {
    if (
      !block.includes("sflo:ReferenceLink") ||
      !block.includes("sflo:referenceTarget")
    ) {
      nextBlocks.push(block);
      continue;
    }

    const subjectPath = getSubjectPath(block);
    const targetMatch = block.match(/sflo:referenceTarget <([^>]*)>/);
    if (!subjectPath || !targetMatch) {
      nextBlocks.push(block);
      continue;
    }

    const targetPath = targetMatch[1]!;
    const statePath = block.match(/sflo:referenceTargetState <([^>]*)>/)?.[1];
    const sourcePath = `${subjectPath}-source`;
    const replacementLine = `  sflo:hasReferenceSource <${sourcePath}> .`;
    const nextBlock = statePath
      ? block.replace(
        /[ ]{2}sflo:referenceTarget <[^>]*> ;\n[ ]{2}sflo:referenceTargetState <[^>]*> \./,
        replacementLine,
      )
      : block.replace(
        /[ ]{2}sflo:referenceTarget <[^>]*> \./,
        replacementLine,
      );

    if (nextBlock === block) {
      nextBlocks.push(block);
      continue;
    }

    changed = true;
    nextBlocks.push(nextBlock);
    nextBlocks.push(
      renderTypedBlock(
        sourcePath,
        "sflo:ReferenceSource",
        [
          `sflo:hasTargetArtifact <${targetPath}>`,
          ...(statePath ? [`sflo:hasRequestedTargetState <${statePath}>`] : []),
        ],
      ),
    );
  }

  return changed ? joinBlocks(nextBlocks, contents) : contents;
}

function normalizeExtractionSourceObservations(contents: string): string {
  const blocks = splitBlocks(contents);
  let changed = false;
  const nextBlocks: string[] = [];

  for (const block of blocks) {
    if (
      !block.includes("sflo:ExtractionSource") ||
      !hasLegacyObservationTerm(block)
    ) {
      nextBlocks.push(block);
      continue;
    }

    const subjectPath = getSubjectPath(block);
    if (!subjectPath) {
      nextBlocks.push(block);
      continue;
    }

    const observationPath = `${subjectPath}-observation-001`;
    const lines = block.split("\n");
    const header = lines[0]!.replace(/ \.$/, " ;");
    const sourceFacts: string[] = [];
    const observationFacts: string[] = [];

    for (const line of lines.slice(1)) {
      const fact = parseFactLine(line);
      if (!fact) {
        sourceFacts.push(line.trim().replace(/[.;]$/, ""));
        continue;
      }

      const [predicate, object] = fact;
      const observationPredicate = toObservationPredicate(predicate);
      if (observationPredicate) {
        observationFacts.push(`${observationPredicate} ${object}`);
      } else {
        sourceFacts.push(`${predicate} ${object}`);
      }
    }

    if (observationFacts.length === 0) {
      nextBlocks.push(block);
      continue;
    }

    if (
      !sourceFacts.some((fact) =>
        fact.startsWith("sflo:hasResolutionObservation ")
      )
    ) {
      sourceFacts.push(`sflo:hasResolutionObservation <${observationPath}>`);
    }

    changed = true;
    nextBlocks.push(renderBlockWithHeader(header, sourceFacts));
    nextBlocks.push(
      renderTypedBlock(
        observationPath,
        "sflo:ArtifactResolutionObservation",
        observationFacts,
      ),
    );
  }

  return changed ? joinBlocks(nextBlocks, contents) : contents;
}

function splitBlocks(contents: string): string[] {
  return contents.trimEnd().split("\n\n");
}

function joinBlocks(blocks: readonly string[], original: string): string {
  return `${blocks.join("\n\n")}${original.endsWith("\n") ? "\n" : ""}`;
}

function getSubjectPath(block: string): string | undefined {
  return block.match(/^<([^>]*)>/)?.[1];
}

function hasLegacyObservationTerm(block: string): boolean {
  return block.includes("sflo:hasObservedSource") ||
    block.includes("sflo:observedSource") ||
    block.includes("sflo:observedAt");
}

function parseFactLine(line: string): [string, string] | undefined {
  const match = line.match(/^[ ]{2}(sflo:[^\s]+) (.+?) [.;]$/);
  return match ? [match[1]!, match[2]!] : undefined;
}

function toObservationPredicate(predicate: string): string | undefined {
  switch (predicate) {
    case "sflo:hasObservedSourceState":
      return "sflo:hasObservedTargetState";
    case "sflo:hasObservedSourceManifestation":
      return "sflo:hasObservedTargetManifestation";
    case "sflo:hasObservedSourceLocatedFile":
      return "sflo:hasObservedTargetLocatedFile";
    case "sflo:observedSourceLocalRelativePath":
      return "sflo:observedTargetLocalRelativePath";
    case "sflo:observedSourceDigest":
      return "sflo:observedContentDigest";
    case "sflo:observedAt":
      return "sflo:observedAt";
    default:
      return undefined;
  }
}

function renderTypedBlock(
  subjectPath: string,
  typeName: string,
  facts: readonly string[],
): string {
  return renderBlockWithHeader(`<${subjectPath}> a ${typeName} ;`, facts);
}

function renderBlockWithHeader(
  header: string,
  facts: readonly string[],
): string {
  if (facts.length === 0) {
    return header.replace(/ ;$/, " .");
  }
  return `${header}
${
    facts.map((fact, index) =>
      `  ${fact}${index === facts.length - 1 ? " ." : " ;"}`
    ).join("\n")
  }`;
}
