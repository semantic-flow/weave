import {
  toDesignatorResourcePagePath,
  toKnopPath,
} from "../designator_segments.ts";
import {
  SFLO_NAMESPACE,
  SFLO_TURTLE_PREFIX_DECLARATION,
} from "../rdf/namespaces.ts";
import { WeaveInputError } from "./errors.ts";
import {
  planInventoryAppend,
  prepareCurrentInventory,
  type PreparedCurrentInventory,
  renderInventoryAppendPlan,
} from "./inventory_append_planner.ts";
import type { MeshInventoryProgression } from "./progression_models.ts";
import {
  renderCurrentWorkingFileDeclaration,
  renderCurrentWorkingFileLocator,
  resolveCurrentWorkingFileLocatorTerm,
} from "./source_locator_renderers.ts";
import type { RepositorySourceFloatingLocator } from "./source_models.ts";
import { splitTurtleBlocks, upsertSubjectBlockAfter } from "./turtle_blocks.ts";

const SFLO_HAS_REPOSITORY_SOURCE_FLOATING_LOCATOR_IRI =
  `${SFLO_NAMESPACE}hasRepositorySourceFloatingLocator`;
const SFLO_HAS_WORKING_LOCATED_FILE_IRI =
  `${SFLO_NAMESPACE}hasWorkingLocatedFile`;
const SFLO_WORKING_LOCAL_RELATIVE_PATH_IRI =
  `${SFLO_NAMESPACE}workingLocalRelativePath`;
const LEGACY_INVENTORY_PROGRESSION_PREDICATES = new Set([
  `${SFLO_NAMESPACE}currentArtifactHistory`,
  `${SFLO_NAMESPACE}nextHistoryOrdinal`,
  `${SFLO_NAMESPACE}latestHistoricalState`,
  `${SFLO_NAMESPACE}nextStateOrdinal`,
]);
const BATCHED_EXTRACTED_SINGLE_VALUED_PREDICATES = [
  `${SFLO_NAMESPACE}currentArtifactHistory`,
  `${SFLO_NAMESPACE}hasWorkingKnopInventoryFile`,
  `${SFLO_NAMESPACE}hasWorkingLocatedFile`,
  `${SFLO_NAMESPACE}historyOrdinal`,
  `${SFLO_NAMESPACE}latestHistoricalState`,
  `${SFLO_NAMESPACE}nextHistoryOrdinal`,
  `${SFLO_NAMESPACE}nextStateOrdinal`,
  `${SFLO_NAMESPACE}previousHistoricalState`,
  `${SFLO_NAMESPACE}stateOrdinal`,
] as const;
const FIRST_PAYLOAD_SINGLE_VALUED_PREDICATES = [
  ...BATCHED_EXTRACTED_SINGLE_VALUED_PREDICATES,
  SFLO_HAS_REPOSITORY_SOURCE_FLOATING_LOCATOR_IRI,
  `${SFLO_NAMESPACE}sourceRepositoryUrl`,
  `${SFLO_NAMESPACE}sourceRepositoryPathFromRoot`,
  SFLO_WORKING_LOCAL_RELATIVE_PATH_IRI,
] as const;

export function renderFirstKnopWovenMeshInventoryTurtle(
  currentMeshInventoryTurtle: string,
  meshBase: string,
  designatorPath: string,
  meshInventoryProgression: MeshInventoryProgression,
): string {
  const preparedCurrentInventory = prepareCurrentInventory({
    baseIri: meshBase,
    currentInventoryTurtle: currentMeshInventoryTurtle,
    currentInventoryLabel:
      `current MeshInventory for first-Knop weave ${designatorPath}`,
  });
  assertNoLegacyMeshInventoryProgression(
    preparedCurrentInventory,
    `append versioned first-Knop MeshInventory facts for ${designatorPath}`,
  );
  const plan = planInventoryAppend({
    preparedCurrentInventory,
    requestedSettledFactsTurtle:
      renderFirstKnopMeshInventoryRequestedFactsTurtle(
        meshBase,
        designatorPath,
        meshInventoryProgression,
      ),
    singleValuedSettledPredicates: BATCHED_EXTRACTED_SINGLE_VALUED_PREDICATES,
    currentInventoryLabel:
      `current MeshInventory for first-Knop weave ${designatorPath}`,
    requestedFactsLabel:
      `versioned first-Knop MeshInventory facts for ${designatorPath}`,
  });
  if (plan.kind === "conflict") {
    throw new WeaveInputError(
      `Could not append versioned first-Knop MeshInventory facts for ${designatorPath}: ${
        plan.conflicts.map((conflict) => conflict.message).join(" ")
      }`,
    );
  }

  return renderInventoryAppendPlan({
    preparedCurrentInventory,
    plan,
    outputLabel:
      `versioned first-Knop MeshInventory append for ${designatorPath}`,
  });
}

function assertNoLegacyMeshInventoryProgression(
  preparedCurrentInventory: PreparedCurrentInventory,
  operation: string,
): void {
  const carriedPredicates = [
    ...new Set(
      preparedCurrentInventory.quads
        .map((quad) => quad.predicate.value)
        .filter((predicate) =>
          LEGACY_INVENTORY_PROGRESSION_PREDICATES.has(predicate)
        ),
    ),
  ].sort((left, right) => left.localeCompare(right));
  if (carriedPredicates.length === 0) {
    return;
  }

  throw new WeaveInputError(
    `Could not ${operation} because the current MeshInventory contains legacy inventory-owned mutable progression predicates: ${
      carriedPredicates.map((predicate) => `<${predicate}>`).join(", ")
    }. Regenerate the fixture or use an explicit repair path before retrying weave.`,
  );
}

export function renderMeshMetadataWithMeshInventoryProgression(
  currentMeshMetadataTurtle: string | undefined,
  meshInventoryProgression: MeshInventoryProgression,
): string {
  if (currentMeshMetadataTurtle === undefined) {
    throw new WeaveInputError(
      "Current MeshMetadata is required to update MeshInventory progression.",
    );
  }

  let blocks = splitTurtleBlocks(currentMeshMetadataTurtle);
  blocks = upsertSubjectBlockAfter(
    blocks,
    "_mesh",
    "_mesh/_inventory",
    renderMeshInventoryMetaProgressionBlock(meshInventoryProgression),
  );
  blocks = upsertSubjectBlockAfter(
    blocks,
    "_mesh/_inventory",
    meshInventoryProgression.historyPath,
    renderMeshInventoryHistoryMetaProgressionBlock(
      meshInventoryProgression,
    ),
  );

  return `${blocks.join("\n\n")}\n`;
}

export function renderFirstPayloadWovenMeshInventoryTurtle(
  currentMeshInventoryTurtle: string,
  meshBase: string,
  designatorPath: string,
  workingLocalRelativePath: string,
  meshInventoryProgression: MeshInventoryProgression,
  repositorySourceFloatingLocator?: RepositorySourceFloatingLocator,
  payloadIsRdfDocument = true,
): string {
  const preparedCurrentInventory = prepareCurrentInventory({
    baseIri: meshBase,
    currentInventoryTurtle: currentMeshInventoryTurtle,
    currentInventoryLabel:
      `current MeshInventory for first-payload weave ${designatorPath}`,
  });
  assertNoLegacyMeshInventoryProgression(
    preparedCurrentInventory,
    `append versioned first-payload MeshInventory facts for ${designatorPath}`,
  );
  assertCompatibleFirstPayloadWorkingLocator(
    preparedCurrentInventory,
    designatorPath,
    workingLocalRelativePath,
    repositorySourceFloatingLocator,
  );
  const plan = planInventoryAppend({
    preparedCurrentInventory,
    requestedSettledFactsTurtle:
      renderFirstPayloadMeshInventoryRequestedFactsTurtle(
        meshBase,
        designatorPath,
        workingLocalRelativePath,
        meshInventoryProgression,
        repositorySourceFloatingLocator,
        payloadIsRdfDocument,
      ),
    singleValuedSettledPredicates: FIRST_PAYLOAD_SINGLE_VALUED_PREDICATES,
    currentInventoryLabel:
      `current MeshInventory for first-payload weave ${designatorPath}`,
    requestedFactsLabel:
      `versioned first-payload MeshInventory facts for ${designatorPath}`,
  });
  if (plan.kind === "conflict") {
    throw new WeaveInputError(
      `Could not append versioned first-payload MeshInventory facts for ${designatorPath}: ${
        plan.conflicts.map((conflict) => conflict.message).join(" ")
      }`,
    );
  }

  return renderInventoryAppendPlan({
    preparedCurrentInventory,
    plan,
    outputLabel:
      `versioned first-payload MeshInventory append for ${designatorPath}`,
  });
}

function assertCompatibleFirstPayloadWorkingLocator(
  preparedCurrentInventory: PreparedCurrentInventory,
  designatorPath: string,
  workingLocalRelativePath: string,
  repositorySourceFloatingLocator?: RepositorySourceFloatingLocator,
): void {
  const subjectIri = new URL(designatorPath, preparedCurrentInventory.baseIri)
    .href;
  const expectedLocator = resolveCurrentWorkingFileLocatorTerm(
    designatorPath,
    workingLocalRelativePath,
    repositorySourceFloatingLocator,
  );
  const expectedValue = expectedLocator.objectTermType === "NamedNode"
    ? new URL(expectedLocator.objectValue, preparedCurrentInventory.baseIri)
      .href
    : expectedLocator.objectValue;
  const carriedLocators = preparedCurrentInventory.quads.filter((quad) =>
    quad.subject.termType === "NamedNode" &&
    quad.subject.value === subjectIri &&
    (quad.predicate.value === SFLO_HAS_WORKING_LOCATED_FILE_IRI ||
      quad.predicate.value === SFLO_WORKING_LOCAL_RELATIVE_PATH_IRI ||
      quad.predicate.value ===
        SFLO_HAS_REPOSITORY_SOURCE_FLOATING_LOCATOR_IRI)
  );
  if (carriedLocators.length === 0) {
    return;
  }
  if (
    carriedLocators.every((quad) =>
      quad.predicate.value === expectedLocator.predicateIri &&
      quad.object.termType === expectedLocator.objectTermType &&
      quad.object.value === expectedValue
    )
  ) {
    return;
  }

  throw new WeaveInputError(
    `Could not append versioned first-payload MeshInventory facts for ${designatorPath} because the current MeshInventory has a conflicting working locator for <${designatorPath}>. Keep exactly the requested working locator before retrying weave.`,
  );
}

export interface BatchedFirstPayloadMeshInventoryTarget {
  designatorPath: string;
  workingLocalRelativePath: string;
  repositorySourceFloatingLocator?: RepositorySourceFloatingLocator;
  payloadIsRdfDocument?: boolean;
}

export function renderBatchedFirstPayloadWovenMeshInventoryTurtle(
  currentMeshInventoryTurtle: string,
  meshBase: string,
  targets: readonly BatchedFirstPayloadMeshInventoryTarget[],
  meshInventoryProgression: MeshInventoryProgression | undefined,
): string {
  return targets.reduce(
    (turtle, target) =>
      meshInventoryProgression === undefined
        ? renderFirstPayloadWovenCurrentOnlyMeshInventoryTurtle(
          turtle,
          meshBase,
          target.designatorPath,
        )
        : renderFirstPayloadWovenMeshInventoryTurtle(
          turtle,
          meshBase,
          target.designatorPath,
          target.workingLocalRelativePath,
          meshInventoryProgression,
          target.repositorySourceFloatingLocator,
          target.payloadIsRdfDocument ?? true,
        ),
    currentMeshInventoryTurtle,
  );
}

export function renderBatchedFirstExtractedKnopWovenMeshInventoryTurtle(
  currentMeshInventoryTurtle: string,
  meshBase: string,
  designatorPaths: readonly string[],
  meshInventoryProgression: MeshInventoryProgression | undefined,
): string {
  const orderedDesignatorPaths = [...new Set(designatorPaths)].sort((
    left,
    right,
  ) => left.localeCompare(right));
  const preparedCurrentInventory = prepareCurrentInventory({
    baseIri: meshBase,
    currentInventoryTurtle: currentMeshInventoryTurtle,
    currentInventoryLabel: "current MeshInventory for extracted-Knop batch",
  });
  const plan = planInventoryAppend({
    preparedCurrentInventory,
    requestedSettledFactsTurtle:
      renderExtractedKnopMeshInventoryRequestedFactsTurtle(
        meshBase,
        orderedDesignatorPaths,
        meshInventoryProgression,
      ),
    singleValuedSettledPredicates: BATCHED_EXTRACTED_SINGLE_VALUED_PREDICATES,
    currentInventoryLabel: "current MeshInventory for extracted-Knop batch",
    requestedFactsLabel: "batched extracted-Knop MeshInventory facts",
  });
  if (plan.kind === "conflict") {
    throw new WeaveInputError(
      `Could not append batched extracted-Knop MeshInventory facts: ${
        plan.conflicts.map((conflict) => conflict.message).join(" ")
      }`,
    );
  }

  return renderInventoryAppendPlan({
    preparedCurrentInventory,
    plan,
    outputLabel: "batched extracted-Knop MeshInventory append",
  });
}

function renderExtractedKnopMeshInventoryRequestedFactsTurtle(
  meshBase: string,
  orderedDesignatorPaths: readonly string[],
  meshInventoryProgression: MeshInventoryProgression | undefined,
): string {
  const blocks = orderedDesignatorPaths.flatMap((designatorPath) => {
    const knopPath = toKnopPath(designatorPath);
    return [
      renderMeshIdentifierBlock(designatorPath),
      renderMeshKnopBlockWithResourcePage(knopPath),
      renderLocatedFileBlock(`${knopPath}/_inventory/inventory.ttl`),
      renderResourcePageLocatedFileBlock(
        toDesignatorResourcePagePath(designatorPath),
      ),
      renderResourcePageLocatedFileBlock(`${knopPath}/index.html`),
    ];
  });
  if (meshInventoryProgression !== undefined) {
    blocks.push(
      ...renderMeshInventoryProgressionRequestedBlocks(
        meshInventoryProgression,
      ),
    );
  }

  return `@base <${meshBase}> .
${SFLO_TURTLE_PREFIX_DECLARATION}
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

${blocks.join("\n\n")}
`;
}

function renderFirstPayloadMeshInventoryRequestedFactsTurtle(
  meshBase: string,
  designatorPath: string,
  workingLocalRelativePath: string,
  meshInventoryProgression: MeshInventoryProgression,
  repositorySourceFloatingLocator?: RepositorySourceFloatingLocator,
  payloadIsRdfDocument = true,
): string {
  const knopPath = toKnopPath(designatorPath);
  const designatorPagePath = toDesignatorResourcePagePath(designatorPath);
  const currentWorkingFileDeclaration = renderCurrentWorkingFileDeclaration(
    designatorPath,
    workingLocalRelativePath,
    repositorySourceFloatingLocator,
    { locatedFileIsRdfDocument: payloadIsRdfDocument },
  );
  const blocks = [
    `<_mesh> sflo:hasKnop <${knopPath}> .`,
    renderMeshPayloadArtifactBlockWithResourcePage(
      designatorPath,
      workingLocalRelativePath,
      repositorySourceFloatingLocator,
      payloadIsRdfDocument,
    ),
    renderMeshKnopBlockWithResourcePage(knopPath),
    renderLocatedFileBlock(`${knopPath}/_inventory/inventory.ttl`),
    ...(currentWorkingFileDeclaration.length === 0
      ? []
      : [currentWorkingFileDeclaration]),
    renderResourcePageLocatedFileBlock(designatorPagePath),
    renderResourcePageLocatedFileBlock(`${knopPath}/index.html`),
    ...renderMeshInventoryProgressionRequestedBlocks(
      meshInventoryProgression,
    ),
  ];

  return `@base <${meshBase}> .
${SFLO_TURTLE_PREFIX_DECLARATION}
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

${blocks.join("\n\n")}
`;
}

function renderMeshInventoryProgressionRequestedBlocks(
  meshInventoryProgression: MeshInventoryProgression,
): readonly string[] {
  const historyPath = meshInventoryProgression.historyPath;
  const nextStatePath = meshInventoryProgression.nextStatePath;
  const nextManifestationPath = `${nextStatePath}/ttl`;
  return [
    renderMeshInventoryArtifactBlock(historyPath),
    renderMeshInventoryHistoryBlock(
      historyPath,
      meshInventoryProgression.nextStateOrdinal,
      nextStatePath,
    ),
    renderMeshInventoryStateBlock(
      nextStatePath,
      meshInventoryProgression.nextStateOrdinal,
      meshInventoryProgression.latestStatePath,
    ),
    renderMeshInventoryStateManifestationBlock(nextStatePath),
    renderLocatedFileBlock(`${nextManifestationPath}/inventory.ttl`),
    renderResourcePageLocatedFileBlock(`${nextStatePath}/index.html`),
    renderResourcePageLocatedFileBlock(
      `${nextManifestationPath}/index.html`,
    ),
  ];
}

function renderFirstKnopMeshInventoryRequestedFactsTurtle(
  meshBase: string,
  designatorPath: string,
  meshInventoryProgression: MeshInventoryProgression,
): string {
  return `${
    renderExtractedKnopMeshInventoryRequestedFactsTurtle(
      meshBase,
      [designatorPath],
      meshInventoryProgression,
    ).trimEnd()
  }

<_mesh> sflo:hasKnop <${toKnopPath(designatorPath)}> .
`;
}

/*
 * Batched extracted-term rendering intentionally has no block-replacement
 * fallback. The append planner owns duplicate detection, conflict refusal,
 * exact-prefix preservation, and compact suffix rendering for this path.
 */

export function renderFirstPayloadWovenCurrentOnlyMeshInventoryTurtle(
  currentMeshInventoryTurtle: string,
  meshBase: string,
  designatorPath: string,
): string {
  const preparedCurrentInventory = prepareCurrentInventory({
    baseIri: meshBase,
    currentInventoryTurtle: currentMeshInventoryTurtle,
    currentInventoryLabel:
      `current MeshInventory for current-only weave ${designatorPath}`,
  });
  const plan = planInventoryAppend({
    preparedCurrentInventory,
    requestedSettledFactsTurtle:
      renderCurrentOnlyPayloadLikeMeshInventoryRequestedFactsTurtle(
        meshBase,
        designatorPath,
      ),
    currentInventoryLabel:
      `current MeshInventory for current-only weave ${designatorPath}`,
    requestedFactsLabel:
      `current-only MeshInventory page facts for ${designatorPath}`,
  });
  if (plan.kind === "conflict") {
    throw new WeaveInputError(
      `Could not append current-only MeshInventory page facts for ${designatorPath}.`,
    );
  }

  return renderInventoryAppendPlan({
    preparedCurrentInventory,
    plan,
    outputLabel: `current-only MeshInventory append for ${designatorPath}`,
  });
}

function renderCurrentOnlyPayloadLikeMeshInventoryRequestedFactsTurtle(
  meshBase: string,
  designatorPath: string,
): string {
  const knopPath = toKnopPath(designatorPath);
  const designatorPagePath = toDesignatorResourcePagePath(designatorPath);
  return `@base <${meshBase}> .
${SFLO_TURTLE_PREFIX_DECLARATION}

<_mesh> sflo:hasKnop <${knopPath}> .

<${designatorPath}> sflo:hasResourcePage <${designatorPagePath}> .

<${knopPath}> sflo:hasResourcePage <${knopPath}/index.html> .

${renderResourcePageLocatedFileBlock(designatorPagePath)}

${renderResourcePageLocatedFileBlock(`${knopPath}/index.html`)}
`;
}

export function renderGenericFirstExtractedKnopWovenMeshInventoryTurtle(
  currentMeshInventoryTurtle: string,
  meshBase: string,
  designatorPath: string,
  meshInventoryProgression: MeshInventoryProgression,
): string {
  const preparedCurrentInventory = prepareCurrentInventory({
    baseIri: meshBase,
    currentInventoryTurtle: currentMeshInventoryTurtle,
    currentInventoryLabel:
      `current MeshInventory for extracted-Knop weave ${designatorPath}`,
  });
  const plan = planInventoryAppend({
    preparedCurrentInventory,
    requestedSettledFactsTurtle:
      renderExtractedKnopMeshInventoryRequestedFactsTurtle(
        meshBase,
        [designatorPath],
        meshInventoryProgression,
      ),
    singleValuedSettledPredicates: BATCHED_EXTRACTED_SINGLE_VALUED_PREDICATES,
    currentInventoryLabel:
      `current MeshInventory for extracted-Knop weave ${designatorPath}`,
    requestedFactsLabel:
      `versioned extracted-Knop MeshInventory facts for ${designatorPath}`,
  });
  if (plan.kind === "conflict") {
    throw new WeaveInputError(
      `Could not append versioned extracted-Knop MeshInventory facts for ${designatorPath}: ${
        plan.conflicts.map((conflict) => conflict.message).join(" ")
      }`,
    );
  }

  return renderInventoryAppendPlan({
    preparedCurrentInventory,
    plan,
    outputLabel:
      `versioned extracted-Knop MeshInventory append for ${designatorPath}`,
  });
}

function renderMeshInventoryMetaProgressionBlock(
  progression: MeshInventoryProgression,
): string {
  return `<_mesh/_inventory> a sflo:MeshInventory, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:currentArtifactHistory <${progression.historyPath}> ;
  sflo:nextHistoryOrdinal "${
    progression.nextHistoryOrdinal ?? 2
  }"^^xsd:nonNegativeInteger .`;
}

function renderMeshInventoryHistoryMetaProgressionBlock(
  progression: MeshInventoryProgression,
): string {
  return `<${progression.historyPath}> a sflo:ArtifactHistory ;
  sflo:latestHistoricalState <${progression.nextStatePath}> ;
  sflo:nextStateOrdinal "${
    progression.nextStateOrdinal + 1
  }"^^xsd:nonNegativeInteger .`;
}

function renderMeshIdentifierBlock(designatorPath: string): string {
  const designatorPagePath = toDesignatorResourcePagePath(designatorPath);
  return `<${designatorPath}>
  sflo:hasResourcePage <${designatorPagePath}> .`;
}

function renderMeshKnopBlockWithResourcePage(knopPath: string): string {
  return `<${knopPath}> a sflo:Knop ;
  sflo:hasWorkingKnopInventoryFile <${knopPath}/_inventory/inventory.ttl> ;
  sflo:hasResourcePage <${knopPath}/index.html> .`;
}

function renderMeshPayloadArtifactBlockWithResourcePage(
  designatorPath: string,
  workingLocalRelativePath: string,
  repositorySourceFloatingLocator?: RepositorySourceFloatingLocator,
  payloadIsRdfDocument = true,
): string {
  const designatorPagePath = toDesignatorResourcePagePath(designatorPath);
  const currentWorkingFileLocator = renderCurrentWorkingFileLocator(
    designatorPath,
    workingLocalRelativePath,
    repositorySourceFloatingLocator,
  );
  const payloadTypes = renderPayloadArtifactTypes(payloadIsRdfDocument);
  return `<${designatorPath}> a ${payloadTypes} ;
  ${currentWorkingFileLocator}
  sflo:hasResourcePage <${designatorPagePath}> .`;
}

function renderPayloadArtifactTypes(payloadIsRdfDocument: boolean): string {
  return payloadIsRdfDocument
    ? "sflo:PayloadArtifact, sflo:DigitalArtifact, sflo:RdfDocument"
    : "sflo:PayloadArtifact, sflo:DigitalArtifact";
}

function renderMeshInventoryArtifactBlock(historyPath: string): string {
  return `<_mesh/_inventory> a sflo:MeshInventory, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasArtifactHistory <${historyPath}> ;
  sflo:hasWorkingLocatedFile <_mesh/_inventory/inventory.ttl> ;
  sflo:hasResourcePage <_mesh/_inventory/index.html> .`;
}

function renderMeshInventoryHistoryBlock(
  historyPath: string,
  latestStateOrdinal: number,
  latestStatePath = `${historyPath}/${toStateSegment(latestStateOrdinal)}`,
): string {
  const ordinalStatePaths = latestStatePath ===
      `${historyPath}/${toStateSegment(latestStateOrdinal)}`
    ? Array.from(
      { length: latestStateOrdinal },
      (_, index) => `${historyPath}/${toStateSegment(index + 1)}`,
    )
    : [
      ...Array.from(
        { length: latestStateOrdinal - 1 },
        (_, index) => `${historyPath}/${toStateSegment(index + 1)}`,
      ),
      latestStatePath,
    ];
  const stateFacts = ordinalStatePaths.map((statePath) =>
    `  sflo:hasHistoricalState <${statePath}> ;`
  ).join("\n");
  return `<${historyPath}> a sflo:ArtifactHistory ;
  sflo:historyOrdinal "1"^^xsd:nonNegativeInteger ;
${stateFacts}
  sflo:hasResourcePage <${historyPath}/index.html> .`;
}

function renderMeshInventoryStateBlock(
  statePath: string,
  stateOrdinal: number,
  previousStatePath?: string,
): string {
  return `<${statePath}> a sflo:HistoricalState ;
  sflo:stateOrdinal "${stateOrdinal}"^^xsd:nonNegativeInteger ;
${
    previousStatePath
      ? `  sflo:previousHistoricalState <${previousStatePath}> ;\n`
      : ""
  }  sflo:hasManifestation <${statePath}/ttl> ;
  sflo:locatedFileForState <${statePath}/ttl/inventory.ttl> ;
  sflo:hasResourcePage <${statePath}/index.html> .`;
}

function renderMeshInventoryStateManifestationBlock(statePath: string): string {
  return `<${statePath}/ttl> a sflo:ArtifactManifestation, sflo:RdfDocument ;
  sflo:locatedFileForManifestation <${statePath}/ttl/inventory.ttl> ;
  sflo:hasResourcePage <${statePath}/ttl/index.html> .`;
}

function renderLocatedFileBlock(path: string): string {
  return `<${path}> a sflo:LocatedFile, sflo:RdfDocument .`;
}

function renderResourcePageLocatedFileBlock(path: string): string {
  return `<${path}> a sflo:ResourcePage, sflo:LocatedFile .`;
}

function toStateSegment(stateOrdinal: number): string {
  return `_s${stateOrdinal.toString().padStart(4, "0")}`;
}
