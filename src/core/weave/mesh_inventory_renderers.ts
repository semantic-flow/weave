import {
  toDesignatorResourcePagePath,
  toKnopPath,
  toPayloadSourceRepositoryFloatingLocatorPath,
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
import { parseWeaveShapeQuads } from "./rdf_helpers.ts";
import {
  renderCurrentWorkingFileDeclaration,
  renderCurrentWorkingFileLocator,
  renderRepositorySourceFloatingLocatorNamedBlock,
} from "./source_locator_renderers.ts";
import type { RepositorySourceFloatingLocator } from "./source_models.ts";
import {
  findSubjectBlockIndex,
  normalizeMeshInventoryHeader,
  replaceSubjectBlock,
  splitTurtleBlocks,
  upsertSubjectBlockAfter,
} from "./turtle_blocks.ts";

const SFLO_HAS_KNOP_IRI = `${SFLO_NAMESPACE}hasKnop`;
const FIRST_KNOP_LEGACY_INVENTORY_PROGRESSION_PREDICATES = new Set([
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
  assertNoLegacyFirstKnopInventoryProgression(
    preparedCurrentInventory,
    designatorPath,
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

function assertNoLegacyFirstKnopInventoryProgression(
  preparedCurrentInventory: PreparedCurrentInventory,
  designatorPath: string,
): void {
  const carriedPredicates = [
    ...new Set(
      preparedCurrentInventory.quads
        .map((quad) => quad.predicate.value)
        .filter((predicate) =>
          FIRST_KNOP_LEGACY_INVENTORY_PROGRESSION_PREDICATES.has(predicate)
        ),
    ),
  ].sort((left, right) => left.localeCompare(right));
  if (carriedPredicates.length === 0) {
    return;
  }

  throw new WeaveInputError(
    `Could not append versioned first-Knop MeshInventory facts for ${designatorPath} because the current MeshInventory contains legacy inventory-owned mutable progression predicates: ${
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
  const knopPath = toKnopPath(designatorPath);
  const rootDesignatorPath = toRootDesignatorPath(designatorPath);
  const rootKnopPath = toKnopPath(rootDesignatorPath);
  const designatorPagePath = toDesignatorResourcePagePath(designatorPath);
  const rootPagePath = toDesignatorResourcePagePath(rootDesignatorPath);
  const preferredDesignatorPageAnchorPath =
    rootDesignatorPath === designatorPath ? "_mesh/index.html" : rootPagePath;
  const historyPath = meshInventoryProgression.historyPath;
  const nextStatePath = meshInventoryProgression.nextStatePath;
  const nextStateManifestationPath = `${nextStatePath}/ttl`;
  const initialBlocks = normalizeMeshInventoryHeader(
    splitTurtleBlocks(currentMeshInventoryTurtle),
  );
  if (
    findSubjectBlockIndex(initialBlocks, "_mesh") === -1 ||
    findSubjectBlockIndex(
        initialBlocks,
        meshInventoryProgression.latestManifestationPath,
      ) === -1
  ) {
    if (meshInventoryProgression.latestStateOrdinal !== 2) {
      throw new WeaveInputError(
        "Could not extend the current mesh inventory for a later first payload weave because the required current-state subject blocks were missing.",
      );
    }
    return renderLegacyFirstPayloadWovenMeshInventoryTurtle(
      meshBase,
      designatorPath,
      workingLocalRelativePath,
      repositorySourceFloatingLocator,
      payloadIsRdfDocument,
    );
  }
  let blocks = initialBlocks;
  const knopPaths = resolveMeshRootKnopPaths(
    meshBase,
    currentMeshInventoryTurtle,
  );

  if (!knopPaths.includes(knopPath)) {
    knopPaths.push(knopPath);
  }
  const designatorPageAnchorPath = findSubjectBlockIndex(
      blocks,
      preferredDesignatorPageAnchorPath,
    ) === -1
    ? "_mesh/index.html"
    : preferredDesignatorPageAnchorPath;
  const preferredKnopPageAnchorPath = rootDesignatorPath === designatorPath
    ? designatorPagePath
    : `${rootKnopPath}/index.html`;
  const knopPageAnchorPath = findSubjectBlockIndex(
      blocks,
      preferredKnopPageAnchorPath,
    ) === -1
    ? designatorPagePath
    : preferredKnopPageAnchorPath;

  blocks = replaceSubjectBlock(
    blocks,
    "_mesh",
    renderMeshRootBlock(meshBase, knopPaths),
  );
  blocks = replaceSubjectBlock(
    blocks,
    "_mesh/_inventory",
    renderMeshInventoryArtifactBlock(historyPath),
  );
  blocks = replaceSubjectBlock(
    blocks,
    designatorPath,
    renderMeshPayloadArtifactBlockWithResourcePage(
      designatorPath,
      workingLocalRelativePath,
      repositorySourceFloatingLocator,
      payloadIsRdfDocument,
    ),
  );
  if (repositorySourceFloatingLocator !== undefined) {
    blocks = upsertSubjectBlockAfter(
      blocks,
      designatorPath,
      toPayloadSourceRepositoryFloatingLocatorPath(designatorPath),
      renderRepositorySourceFloatingLocatorNamedBlock(
        designatorPath,
        repositorySourceFloatingLocator,
      ),
    );
  }
  blocks = replaceSubjectBlock(
    blocks,
    knopPath,
    renderMeshKnopBlockWithResourcePage(knopPath),
  );
  blocks = replaceSubjectBlock(
    blocks,
    historyPath,
    renderMeshInventoryHistoryBlock(
      historyPath,
      meshInventoryProgression.nextStateOrdinal,
      nextStatePath,
    ),
  );
  blocks = upsertSubjectBlockAfter(
    blocks,
    meshInventoryProgression.latestManifestationPath,
    nextStatePath,
    renderMeshInventoryStateBlock(
      nextStatePath,
      meshInventoryProgression.nextStateOrdinal,
      meshInventoryProgression.latestStatePath,
    ),
  );
  blocks = upsertSubjectBlockAfter(
    blocks,
    nextStatePath,
    nextStateManifestationPath,
    renderMeshInventoryStateManifestationBlock(nextStatePath),
  );
  blocks = upsertSubjectBlockAfter(
    blocks,
    `${meshInventoryProgression.latestManifestationPath}/inventory.ttl`,
    `${nextStateManifestationPath}/inventory.ttl`,
    renderLocatedFileBlock(`${nextStateManifestationPath}/inventory.ttl`),
  );
  blocks = upsertSubjectBlockAfter(
    blocks,
    designatorPageAnchorPath,
    designatorPagePath,
    renderResourcePageLocatedFileBlock(designatorPagePath),
  );
  blocks = upsertSubjectBlockAfter(
    blocks,
    knopPageAnchorPath,
    `${knopPath}/index.html`,
    renderResourcePageLocatedFileBlock(`${knopPath}/index.html`),
  );
  blocks = upsertSubjectBlockAfter(
    blocks,
    `${meshInventoryProgression.latestManifestationPath}/index.html`,
    `${nextStatePath}/index.html`,
    renderResourcePageLocatedFileBlock(`${nextStatePath}/index.html`),
  );
  blocks = upsertSubjectBlockAfter(
    blocks,
    `${nextStatePath}/index.html`,
    `${nextStateManifestationPath}/index.html`,
    renderResourcePageLocatedFileBlock(
      `${nextStateManifestationPath}/index.html`,
    ),
  );

  return `${blocks.join("\n\n")}\n`;
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
    const historyPath = meshInventoryProgression.historyPath;
    const nextStatePath = meshInventoryProgression.nextStatePath;
    const nextManifestationPath = `${nextStatePath}/ttl`;
    blocks.push(
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
    );
  }

  return `@base <${meshBase}> .
${SFLO_TURTLE_PREFIX_DECLARATION}
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

${blocks.join("\n\n")}
`;
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

function renderLegacyFirstPayloadWovenMeshInventoryTurtle(
  meshBase: string,
  designatorPath: string,
  workingLocalRelativePath: string,
  repositorySourceFloatingLocator?: RepositorySourceFloatingLocator,
  payloadIsRdfDocument = true,
): string {
  const knopPath = toKnopPath(designatorPath);
  const designatorPagePath = toDesignatorResourcePagePath(designatorPath);
  const rootDesignatorPath = toRootDesignatorPath(designatorPath);
  const rootKnopPath = toKnopPath(rootDesignatorPath);
  const rootPagePath = toDesignatorResourcePagePath(rootDesignatorPath);
  const distinctKnopPaths = rootKnopPath === knopPath
    ? [knopPath]
    : [rootKnopPath, knopPath];
  const meshRootKnopLines = distinctKnopPaths.map((path) =>
    `  sflo:hasKnop <${path}> ;`
  ).join("\n");
  const rootIdentifierBlock = rootDesignatorPath === designatorPath
    ? ""
    : `<${rootDesignatorPath}>
  sflo:hasResourcePage <${rootPagePath}> .
`;
  const rootKnopBlock = rootKnopPath === knopPath
    ? ""
    : `<${rootKnopPath}> a sflo:Knop ;
  sflo:hasWorkingKnopInventoryFile <${rootKnopPath}/_inventory/inventory.ttl> ;
  sflo:hasResourcePage <${rootKnopPath}/index.html> .
`;
  const rootKnopInventoryFileBlock = rootKnopPath === knopPath
    ? ""
    : `<${rootKnopPath}/_inventory/inventory.ttl> a sflo:LocatedFile, sflo:RdfDocument .`;
  const rootPageFileBlock = rootDesignatorPath === designatorPath
    ? ""
    : `<${rootPagePath}> a sflo:ResourcePage, sflo:LocatedFile .`;
  const rootKnopPageFileBlock = rootKnopPath === knopPath
    ? ""
    : `<${rootKnopPath}/index.html> a sflo:ResourcePage, sflo:LocatedFile .`;
  const currentWorkingFileLocator = renderCurrentWorkingFileLocator(
    designatorPath,
    workingLocalRelativePath,
    repositorySourceFloatingLocator,
  );
  const currentWorkingFileDeclaration = renderCurrentWorkingFileDeclaration(
    designatorPath,
    workingLocalRelativePath,
    repositorySourceFloatingLocator,
    { locatedFileIsRdfDocument: payloadIsRdfDocument },
  );
  const payloadTypes = renderPayloadArtifactTypes(payloadIsRdfDocument);

  return `@base <${meshBase}> .
${SFLO_TURTLE_PREFIX_DECLARATION}
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

<_mesh> a sflo:SemanticMesh ;
  sflo:meshBase "${meshBase}"^^xsd:anyURI ;
  sflo:hasMeshMetadata <_mesh/_meta> ;
  sflo:hasMeshInventory <_mesh/_inventory> ;
${meshRootKnopLines}
  sflo:hasResourcePage <_mesh/index.html> .

${rootIdentifierBlock}
${rootKnopBlock}

<${designatorPath}> a ${payloadTypes} ;
  ${currentWorkingFileLocator}
  sflo:hasResourcePage <${designatorPagePath}> .

<${knopPath}> a sflo:Knop ;
  sflo:hasWorkingKnopInventoryFile <${knopPath}/_inventory/inventory.ttl> ;
  sflo:hasResourcePage <${knopPath}/index.html> .

<_mesh/_meta> a sflo:MeshMetadata, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasArtifactHistory <_mesh/_meta/_history001> ;
  sflo:currentArtifactHistory <_mesh/_meta/_history001> ;
  sflo:nextHistoryOrdinal "2"^^xsd:nonNegativeInteger ;
  sflo:hasWorkingLocatedFile <_mesh/_meta/meta.ttl> ;
  sflo:hasResourcePage <_mesh/_meta/index.html> .

<_mesh/_meta/_history001> a sflo:ArtifactHistory ;
  sflo:historyOrdinal "1"^^xsd:nonNegativeInteger ;
  sflo:hasHistoricalState <_mesh/_meta/_history001/_s0001> ;
  sflo:latestHistoricalState <_mesh/_meta/_history001/_s0001> ;
  sflo:nextStateOrdinal "2"^^xsd:nonNegativeInteger ;
  sflo:hasResourcePage <_mesh/_meta/_history001/index.html> .

<_mesh/_meta/_history001/_s0001> a sflo:HistoricalState ;
  sflo:stateOrdinal "1"^^xsd:nonNegativeInteger ;
  sflo:hasManifestation <_mesh/_meta/_history001/_s0001/ttl> ;
  sflo:locatedFileForState <_mesh/_meta/_history001/_s0001/ttl/meta.ttl> ;
  sflo:hasResourcePage <_mesh/_meta/_history001/_s0001/index.html> .

<_mesh/_meta/_history001/_s0001/ttl> a sflo:ArtifactManifestation, sflo:RdfDocument ;
  sflo:locatedFileForManifestation <_mesh/_meta/_history001/_s0001/ttl/meta.ttl> ;
  sflo:hasResourcePage <_mesh/_meta/_history001/_s0001/ttl/index.html> .

<_mesh/_inventory> a sflo:MeshInventory, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasArtifactHistory <_mesh/_inventory/_history001> ;
  sflo:currentArtifactHistory <_mesh/_inventory/_history001> ;
  sflo:nextHistoryOrdinal "2"^^xsd:nonNegativeInteger ;
  sflo:hasWorkingLocatedFile <_mesh/_inventory/inventory.ttl> ;
  sflo:hasResourcePage <_mesh/_inventory/index.html> .

<_mesh/_inventory/_history001> a sflo:ArtifactHistory ;
  sflo:historyOrdinal "1"^^xsd:nonNegativeInteger ;
  sflo:hasHistoricalState <_mesh/_inventory/_history001/_s0001> ;
  sflo:hasHistoricalState <_mesh/_inventory/_history001/_s0002> ;
  sflo:hasHistoricalState <_mesh/_inventory/_history001/_s0003> ;
  sflo:latestHistoricalState <_mesh/_inventory/_history001/_s0003> ;
  sflo:nextStateOrdinal "4"^^xsd:nonNegativeInteger ;
  sflo:hasResourcePage <_mesh/_inventory/_history001/index.html> .

<_mesh/_inventory/_history001/_s0001> a sflo:HistoricalState ;
  sflo:stateOrdinal "1"^^xsd:nonNegativeInteger ;
  sflo:hasManifestation <_mesh/_inventory/_history001/_s0001/ttl> ;
  sflo:locatedFileForState <_mesh/_inventory/_history001/_s0001/ttl/inventory.ttl> ;
  sflo:hasResourcePage <_mesh/_inventory/_history001/_s0001/index.html> .

<_mesh/_inventory/_history001/_s0001/ttl> a sflo:ArtifactManifestation, sflo:RdfDocument ;
  sflo:locatedFileForManifestation <_mesh/_inventory/_history001/_s0001/ttl/inventory.ttl> ;
  sflo:hasResourcePage <_mesh/_inventory/_history001/_s0001/ttl/index.html> .

<_mesh/_inventory/_history001/_s0002> a sflo:HistoricalState ;
  sflo:stateOrdinal "2"^^xsd:nonNegativeInteger ;
  sflo:previousHistoricalState <_mesh/_inventory/_history001/_s0001> ;
  sflo:hasManifestation <_mesh/_inventory/_history001/_s0002/ttl> ;
  sflo:locatedFileForState <_mesh/_inventory/_history001/_s0002/ttl/inventory.ttl> ;
  sflo:hasResourcePage <_mesh/_inventory/_history001/_s0002/index.html> .

<_mesh/_inventory/_history001/_s0002/ttl> a sflo:ArtifactManifestation, sflo:RdfDocument ;
  sflo:locatedFileForManifestation <_mesh/_inventory/_history001/_s0002/ttl/inventory.ttl> ;
  sflo:hasResourcePage <_mesh/_inventory/_history001/_s0002/ttl/index.html> .

<_mesh/_inventory/_history001/_s0003> a sflo:HistoricalState ;
  sflo:stateOrdinal "3"^^xsd:nonNegativeInteger ;
  sflo:previousHistoricalState <_mesh/_inventory/_history001/_s0002> ;
  sflo:hasManifestation <_mesh/_inventory/_history001/_s0003/ttl> ;
  sflo:locatedFileForState <_mesh/_inventory/_history001/_s0003/ttl/inventory.ttl> ;
  sflo:hasResourcePage <_mesh/_inventory/_history001/_s0003/index.html> .

<_mesh/_inventory/_history001/_s0003/ttl> a sflo:ArtifactManifestation, sflo:RdfDocument ;
  sflo:locatedFileForManifestation <_mesh/_inventory/_history001/_s0003/ttl/inventory.ttl> ;
  sflo:hasResourcePage <_mesh/_inventory/_history001/_s0003/ttl/index.html> .

<_mesh/_meta/meta.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<_mesh/_inventory/inventory.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<_mesh/_meta/_history001/_s0001/ttl/meta.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<_mesh/_inventory/_history001/_s0001/ttl/inventory.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<_mesh/_inventory/_history001/_s0002/ttl/inventory.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<_mesh/_inventory/_history001/_s0003/ttl/inventory.ttl> a sflo:LocatedFile, sflo:RdfDocument .

${rootKnopInventoryFileBlock}

<${knopPath}/_inventory/inventory.ttl> a sflo:LocatedFile, sflo:RdfDocument .

${currentWorkingFileDeclaration}

<_mesh/index.html> a sflo:ResourcePage, sflo:LocatedFile .

${rootPageFileBlock}

<${designatorPagePath}> a sflo:ResourcePage, sflo:LocatedFile .

${rootKnopPageFileBlock}

<${knopPath}/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<_mesh/_meta/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<_mesh/_meta/_history001/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<_mesh/_meta/_history001/_s0001/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<_mesh/_meta/_history001/_s0001/ttl/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<_mesh/_inventory/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<_mesh/_inventory/_history001/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<_mesh/_inventory/_history001/_s0001/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<_mesh/_inventory/_history001/_s0001/ttl/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<_mesh/_inventory/_history001/_s0002/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<_mesh/_inventory/_history001/_s0002/ttl/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<_mesh/_inventory/_history001/_s0003/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<_mesh/_inventory/_history001/_s0003/ttl/index.html> a sflo:ResourcePage, sflo:LocatedFile .
`;
}

function renderMeshIdentifierBlock(designatorPath: string): string {
  const designatorPagePath = toDesignatorResourcePagePath(designatorPath);
  return `<${designatorPath}>
  sflo:hasResourcePage <${designatorPagePath}> .`;
}

function renderMeshRootBlock(
  meshBase: string,
  knopPaths: readonly string[],
): string {
  const knopLines = knopPaths.map((knopPath) =>
    `  sflo:hasKnop <${knopPath}> ;`
  ).join("\n");

  return `<_mesh> a sflo:SemanticMesh ;
  sflo:meshBase "${meshBase}"^^xsd:anyURI ;
  sflo:hasMeshMetadata <_mesh/_meta> ;
  sflo:hasMeshInventory <_mesh/_inventory> ;
${knopLines}
  sflo:hasResourcePage <_mesh/index.html> .`;
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

function resolveMeshRootKnopPaths(
  meshBase: string,
  currentMeshInventoryTurtle: string,
): string[] {
  const quads = parseWeaveShapeQuads(
    meshBase,
    currentMeshInventoryTurtle,
    "Could not parse the current MeshInventory while preserving mesh knop entries.",
  );
  const meshIri = new URL("_mesh", meshBase).href;
  const knopPaths: string[] = [];

  for (const quad of quads) {
    if (
      quad.subject.termType !== "NamedNode" ||
      quad.subject.value !== meshIri ||
      quad.predicate.value !== SFLO_HAS_KNOP_IRI ||
      quad.object.termType !== "NamedNode"
    ) {
      continue;
    }

    const objectPath = tryToMeshPath(meshBase, quad.object.value);
    if (!objectPath || knopPaths.includes(objectPath)) {
      continue;
    }
    knopPaths.push(objectPath);
  }

  return knopPaths;
}

function tryToMeshPath(meshBase: string, iri: string): string | undefined {
  if (!iri.startsWith(meshBase)) {
    return undefined;
  }

  const suffix = iri.slice(meshBase.length);
  return suffix.length === 0 ? undefined : suffix;
}

function toRootDesignatorPath(designatorPath: string): string {
  const firstSlash = designatorPath.indexOf("/");
  return firstSlash === -1
    ? designatorPath
    : designatorPath.slice(0, firstSlash);
}

function toStateSegment(stateOrdinal: number): string {
  return `_s${stateOrdinal.toString().padStart(4, "0")}`;
}
