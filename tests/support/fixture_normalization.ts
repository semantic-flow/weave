export function normalizeLegacyFixtureRdf(contents: string): string {
  return normalizeArtifactResolutionObservationBlocks(
    normalizeExtractionSourceObservations(
      normalizeArtifactResolutionTerms(
        normalizeReferenceLinkSources(contents),
      ),
    ),
  );
}

function normalizeArtifactResolutionTerms(contents: string): string {
  const replacements: readonly (readonly [string, string])[] = [
    ["sflo:ArtifactResolutionTarget", "sflo:ArtifactResolutionSpec"],
    ["<ArtifactResolutionTarget>", "<ArtifactResolutionSpec>"],
    [
      "<https://semantic-flow.github.io/sflo/ontology/ArtifactResolutionTarget>",
      "<https://semantic-flow.github.io/sflo/ontology/ArtifactResolutionSpec>",
    ],
    ["sflo:hasTargetArtifact", "sflo:targetArtifact"],
    ["<hasTargetArtifact>", "<targetArtifact>"],
    [
      "<https://semantic-flow.github.io/sflo/ontology/hasTargetArtifact>",
      "<https://semantic-flow.github.io/sflo/ontology/targetArtifact>",
    ],
    ["sflo:hasTargetLocatedFile", "sflo:targetLocatedFile"],
    ["<hasTargetLocatedFile>", "<targetLocatedFile>"],
    [
      "<https://semantic-flow.github.io/sflo/ontology/hasTargetLocatedFile>",
      "<https://semantic-flow.github.io/sflo/ontology/targetLocatedFile>",
    ],
    ["sflo:hasTargetDistribution", "sflo:targetManifestation"],
    ["<hasTargetDistribution>", "<targetManifestation>"],
    [
      "<https://semantic-flow.github.io/sflo/ontology/hasTargetDistribution>",
      "<https://semantic-flow.github.io/sflo/ontology/targetManifestation>",
    ],
    ["sflo:hasRequestedTargetHistory", "sflo:targetArtifactHistory"],
    ["<hasRequestedTargetHistory>", "<targetArtifactHistory>"],
    [
      "<https://semantic-flow.github.io/sflo/ontology/hasRequestedTargetHistory>",
      "<https://semantic-flow.github.io/sflo/ontology/targetArtifactHistory>",
    ],
    ["sflo:hasRequestedTargetState", "sflo:targetHistoricalState"],
    ["<hasRequestedTargetState>", "<targetHistoricalState>"],
    [
      "<https://semantic-flow.github.io/sflo/ontology/hasRequestedTargetState>",
      "<https://semantic-flow.github.io/sflo/ontology/targetHistoricalState>",
    ],
    ["sflo:hasTargetRepositorySource", "sflo:targetRepositorySource"],
    ["<hasTargetRepositorySource>", "<targetRepositorySource>"],
    [
      "<https://semantic-flow.github.io/sflo/ontology/hasTargetRepositorySource>",
      "<https://semantic-flow.github.io/sflo/ontology/targetRepositorySource>",
    ],
  ];

  let next = contents;
  for (const [from, to] of replacements) {
    next = next.replaceAll(from, to);
  }
  return next;
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
          `sflo:targetArtifact <${targetPath}>`,
          ...(statePath ? [`sflo:targetHistoricalState <${statePath}>`] : []),
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
    const observedSpecFacts: string[] = [];
    const observationFacts: string[] = [];

    for (const line of lines.slice(1)) {
      const fact = parseFactLine(line);
      if (!fact) {
        sourceFacts.push(line.trim().replace(/[.;]$/, ""));
        continue;
      }

      const [predicate, object] = fact;
      const observationFact = toObservationFact(predicate);
      if (observationFact?.target === "observedSpec") {
        observedSpecFacts.push(`${observationFact.predicate} ${object}`);
      } else if (observationFact?.target === "observation") {
        observationFacts.push(`${observationFact.predicate} ${object}`);
      } else {
        sourceFacts.push(`${predicate} ${object}`);
      }
    }

    if (observedSpecFacts.length === 0 && observationFacts.length === 0) {
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
        [
          `sflo:observedArtifactResolutionSpec ${
            renderObservedArtifactResolutionSpec(observedSpecFacts)
          }`,
          ...observationFacts,
        ],
      ),
    );
  }

  return changed ? joinBlocks(nextBlocks, contents) : contents;
}

function normalizeArtifactResolutionObservationBlocks(
  contents: string,
): string {
  const blocks = splitBlocks(contents);
  let changed = false;
  const nextBlocks: string[] = [];

  for (const block of blocks) {
    if (
      !block.includes("sflo:ArtifactResolutionObservation") ||
      !hasRetiredObservedCoordinateTerm(block)
    ) {
      nextBlocks.push(block);
      continue;
    }

    const lines = block.split("\n");
    const header = lines[0]!;
    const observedSpecFacts: string[] = [];
    const observationFacts: string[] = [];

    for (const line of lines.slice(1)) {
      const fact = parseFactLine(line);
      if (!fact) {
        observationFacts.push(line.trim().replace(/[.;]$/, ""));
        continue;
      }

      const [predicate, object] = fact;
      const observationFact = toObservationFact(predicate);
      if (observationFact?.target === "observedSpec") {
        observedSpecFacts.push(`${observationFact.predicate} ${object}`);
      } else if (observationFact?.target === "observation") {
        observationFacts.push(`${observationFact.predicate} ${object}`);
      } else {
        observationFacts.push(`${predicate} ${object}`);
      }
    }

    changed = true;
    nextBlocks.push(
      renderBlockWithHeader(
        header,
        [
          `sflo:observedArtifactResolutionSpec ${
            renderObservedArtifactResolutionSpec(observedSpecFacts)
          }`,
          ...observationFacts,
        ],
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

function hasRetiredObservedCoordinateTerm(block: string): boolean {
  return block.includes("sflo:hasObservedSource") ||
    block.includes("sflo:hasObservedTarget") ||
    block.includes("sflo:observedSourceLocalRelativePath") ||
    block.includes("sflo:observedTargetLocalRelativePath");
}

function parseFactLine(line: string): [string, string] | undefined {
  const match = line.match(
    /^[ ]{2}(sflo:[^\s]+|<https:\/\/semantic-flow\.github\.io\/sflo\/ontology\/[^>]+>) (.+?) [.;]$/,
  );
  return match ? [normalizeSfloPredicate(match[1]!), match[2]!] : undefined;
}

function normalizeSfloPredicate(predicate: string): string {
  const iriMatch = predicate.match(
    /^<https:\/\/semantic-flow\.github\.io\/sflo\/ontology\/([^>]+)>$/,
  );
  return iriMatch ? `sflo:${iriMatch[1]}` : predicate;
}

function toObservationFact(
  predicate: string,
): { target: "observedSpec" | "observation"; predicate: string } | undefined {
  switch (predicate) {
    case "sflo:hasObservedSourceState":
    case "sflo:hasObservedTargetState":
      return {
        target: "observedSpec",
        predicate: "sflo:targetHistoricalState",
      };
    case "sflo:hasObservedSourceManifestation":
    case "sflo:hasObservedTargetManifestation":
      return { target: "observedSpec", predicate: "sflo:targetManifestation" };
    case "sflo:hasObservedSourceLocatedFile":
    case "sflo:hasObservedTargetLocatedFile":
      return { target: "observedSpec", predicate: "sflo:targetLocatedFile" };
    case "sflo:observedSourceLocalRelativePath":
    case "sflo:observedTargetLocalRelativePath":
      return {
        target: "observedSpec",
        predicate: "sflo:targetLocalRelativePath",
      };
    case "sflo:observedSourceDigest":
      return { target: "observation", predicate: "sflo:observedContentDigest" };
    case "sflo:observedAt":
      return { target: "observation", predicate: "sflo:observedAt" };
    default:
      return undefined;
  }
}

function renderObservedArtifactResolutionSpec(
  facts: readonly string[],
): string {
  const specFacts = ["a sflo:ArtifactResolutionSpec", ...facts];
  return `[
${
    specFacts.map((fact, index) =>
      `    ${fact}${index === specFacts.length - 1 ? "" : " ;"}`
    ).join("\n")
  }
  ]`;
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
