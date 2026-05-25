import {
  toDesignatorResourcePagePath,
  toKnopPath,
} from "../designator_segments.ts";
import {
  SFLO_NAMESPACE,
  SFLO_TURTLE_PREFIX_DECLARATION,
} from "../rdf/namespaces.ts";
import { WeaveInputError } from "./errors.ts";
import type { MeshInventoryProgression } from "./progression_models.ts";
import { hasNamedNodeFact, parseWeaveShapeQuads } from "./rdf_helpers.ts";
import {
  renderCurrentWorkingFileDeclaration,
  renderCurrentWorkingFileLocator,
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
const SFLO_HAS_RESOURCE_PAGE_IRI = `${SFLO_NAMESPACE}hasResourcePage`;

export function renderFirstKnopWovenMeshInventoryTurtle(
  currentMeshInventoryTurtle: string,
  meshBase: string,
  designatorPath: string,
  meshInventoryProgression: MeshInventoryProgression,
): string {
  const knopPath = toKnopPath(designatorPath);
  const designatorPagePath = toDesignatorResourcePagePath(designatorPath);
  const historyPath = meshInventoryProgression.historyPath;
  const latestManifestationPath =
    meshInventoryProgression.latestManifestationPath;
  const nextStatePath = meshInventoryProgression.nextStatePath;
  const nextStateOrdinal = meshInventoryProgression.nextStateOrdinal;
  const nextManifestationPath = `${nextStatePath}/ttl`;
  const initialBlocks = normalizeMeshInventoryHeader(
    splitTurtleBlocks(currentMeshInventoryTurtle),
  );
  if (
    findSubjectBlockIndex(initialBlocks, "_mesh") === -1 ||
    findSubjectBlockIndex(
        initialBlocks,
        latestManifestationPath,
      ) === -1 ||
    findSubjectBlockIndex(initialBlocks, "_mesh/index.html") === -1
  ) {
    return renderLegacyFirstKnopWovenMeshInventoryTurtle(
      meshBase,
      designatorPath,
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
  blocks = upsertSubjectBlockAfter(
    blocks,
    "_mesh",
    designatorPath,
    renderMeshIdentifierBlock(designatorPath),
  );
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
      nextStateOrdinal,
      nextStatePath,
    ),
  );
  blocks = upsertSubjectBlockAfter(
    blocks,
    latestManifestationPath,
    nextStatePath,
    renderMeshInventoryStateBlock(
      nextStatePath,
      nextStateOrdinal,
      meshInventoryProgression.latestStatePath,
    ),
  );
  blocks = upsertSubjectBlockAfter(
    blocks,
    nextStatePath,
    nextManifestationPath,
    renderMeshInventoryStateManifestationBlock(nextStatePath),
  );
  blocks = upsertSubjectBlockAfter(
    blocks,
    `${latestManifestationPath}/inventory.ttl`,
    `${nextManifestationPath}/inventory.ttl`,
    renderLocatedFileBlock(`${nextManifestationPath}/inventory.ttl`),
  );
  blocks = upsertSubjectBlockAfter(
    blocks,
    "_mesh/index.html",
    designatorPagePath,
    renderResourcePageLocatedFileBlock(designatorPagePath),
  );
  blocks = upsertSubjectBlockAfter(
    blocks,
    designatorPagePath,
    `${knopPath}/index.html`,
    renderResourcePageLocatedFileBlock(`${knopPath}/index.html`),
  );
  blocks = upsertSubjectBlockAfter(
    blocks,
    `${latestManifestationPath}/index.html`,
    `${nextStatePath}/index.html`,
    renderResourcePageLocatedFileBlock(`${nextStatePath}/index.html`),
  );
  blocks = upsertSubjectBlockAfter(
    blocks,
    `${nextStatePath}/index.html`,
    `${nextManifestationPath}/index.html`,
    renderResourcePageLocatedFileBlock(
      `${nextManifestationPath}/index.html`,
    ),
  );

  return `${blocks.join("\n\n")}\n`;
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

export function renderFirstPayloadWovenCurrentOnlyMeshInventoryTurtle(
  currentMeshInventoryTurtle: string,
  meshBase: string,
  designatorPath: string,
): string {
  const knopPath = toKnopPath(designatorPath);
  const designatorPagePath = toDesignatorResourcePagePath(designatorPath);
  const quads = parseWeaveShapeQuads(
    meshBase,
    currentMeshInventoryTurtle,
    `Could not parse current MeshInventory while weaving ${designatorPath}.`,
  );
  const additions: string[] = [];

  if (
    !hasNamedNodeFact(
      quads,
      meshBase,
      "_mesh",
      SFLO_HAS_KNOP_IRI,
      knopPath,
    )
  ) {
    additions.push(`<_mesh> sflo:hasKnop <${knopPath}> .`);
  }
  if (
    !hasNamedNodeFact(
      quads,
      meshBase,
      designatorPath,
      SFLO_HAS_RESOURCE_PAGE_IRI,
      designatorPagePath,
    )
  ) {
    additions.push(
      `<${designatorPath}> sflo:hasResourcePage <${designatorPagePath}> .`,
    );
  }
  if (
    !hasNamedNodeFact(
      quads,
      meshBase,
      knopPath,
      SFLO_HAS_RESOURCE_PAGE_IRI,
      `${knopPath}/index.html`,
    )
  ) {
    additions.push(
      `<${knopPath}> sflo:hasResourcePage <${knopPath}/index.html> .`,
    );
  }

  additions.push(
    renderResourcePageLocatedFileBlock(designatorPagePath),
    renderResourcePageLocatedFileBlock(`${knopPath}/index.html`),
  );

  return `${currentMeshInventoryTurtle.trimEnd()}\n\n${
    additions.join("\n\n")
  }\n`;
}

export function renderGenericFirstExtractedKnopWovenMeshInventoryTurtle(
  currentMeshInventoryTurtle: string,
  designatorPath: string,
  meshInventoryProgression: MeshInventoryProgression,
): string {
  const knopPath = toKnopPath(designatorPath);
  const designatorPagePath = toDesignatorResourcePagePath(designatorPath);
  const parentDesignatorPath = toParentDesignatorPath(designatorPath);
  const historyPath = meshInventoryProgression.historyPath;
  const latestManifestationPath =
    meshInventoryProgression.latestManifestationPath;
  const nextStatePath = meshInventoryProgression.nextStatePath;
  const nextStateOrdinal = meshInventoryProgression.nextStateOrdinal;
  const nextManifestationPath = `${nextStatePath}/ttl`;
  let blocks = normalizeMeshInventoryHeader(
    splitTurtleBlocks(currentMeshInventoryTurtle),
  );
  const preferredAnchorResourcePath = parentDesignatorPath ?? "_mesh";
  const anchorResourcePath = findSubjectBlockIndex(
      blocks,
      preferredAnchorResourcePath,
    ) === -1
    ? "_mesh"
    : preferredAnchorResourcePath;
  const preferredAnchorPagePath = parentDesignatorPath === undefined
    ? "_mesh/index.html"
    : toDesignatorResourcePagePath(parentDesignatorPath);
  const anchorPagePath = findSubjectBlockIndex(
      blocks,
      preferredAnchorPagePath,
    ) === -1
    ? "_mesh/index.html"
    : preferredAnchorPagePath;

  blocks = upsertSubjectBlockAfter(
    blocks,
    anchorResourcePath,
    designatorPath,
    renderMeshIdentifierBlock(designatorPath),
  );
  blocks = replaceSubjectBlock(
    blocks,
    "_mesh/_inventory",
    renderMeshInventoryArtifactBlock(historyPath),
  );
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
      nextStateOrdinal,
      nextStatePath,
    ),
  );
  blocks = upsertSubjectBlockAfter(
    blocks,
    latestManifestationPath,
    nextStatePath,
    renderMeshInventoryStateBlock(
      nextStatePath,
      nextStateOrdinal,
      meshInventoryProgression.latestStatePath,
    ),
  );
  blocks = upsertSubjectBlockAfter(
    blocks,
    nextStatePath,
    nextManifestationPath,
    renderMeshInventoryStateManifestationBlock(nextStatePath),
  );
  blocks = upsertSubjectBlockAfter(
    blocks,
    `${latestManifestationPath}/inventory.ttl`,
    `${nextManifestationPath}/inventory.ttl`,
    renderLocatedFileBlock(`${nextManifestationPath}/inventory.ttl`),
  );
  blocks = upsertSubjectBlockAfter(
    blocks,
    anchorPagePath,
    designatorPagePath,
    renderResourcePageLocatedFileBlock(designatorPagePath),
  );
  blocks = upsertSubjectBlockAfter(
    blocks,
    designatorPagePath,
    `${knopPath}/index.html`,
    renderResourcePageLocatedFileBlock(`${knopPath}/index.html`),
  );
  blocks = upsertSubjectBlockAfter(
    blocks,
    `${latestManifestationPath}/index.html`,
    `${nextStatePath}/index.html`,
    renderResourcePageLocatedFileBlock(`${nextStatePath}/index.html`),
  );
  blocks = upsertSubjectBlockAfter(
    blocks,
    `${nextStatePath}/index.html`,
    `${nextManifestationPath}/index.html`,
    renderResourcePageLocatedFileBlock(
      `${nextManifestationPath}/index.html`,
    ),
  );

  return `${blocks.join("\n\n")}\n`;
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

function renderLegacyFirstKnopWovenMeshInventoryTurtle(
  meshBase: string,
  designatorPath: string,
): string {
  const knopPath = toKnopPath(designatorPath);
  const designatorPagePath = toDesignatorResourcePagePath(designatorPath);

  return `@base <${meshBase}> .
${SFLO_TURTLE_PREFIX_DECLARATION}
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

<_mesh> a sflo:SemanticMesh ;
  sflo:meshBase "${meshBase}"^^xsd:anyURI ;
  sflo:hasMeshMetadata <_mesh/_meta> ;
  sflo:hasMeshInventory <_mesh/_inventory> ;
  sflo:hasKnop <${knopPath}> ;
  sflo:hasResourcePage <_mesh/index.html> .

<${designatorPath}>
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
  sflo:latestHistoricalState <_mesh/_inventory/_history001/_s0002> ;
  sflo:nextStateOrdinal "3"^^xsd:nonNegativeInteger ;
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

<_mesh/_meta/meta.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<_mesh/_inventory/inventory.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<_mesh/_meta/_history001/_s0001/ttl/meta.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<_mesh/_inventory/_history001/_s0001/ttl/inventory.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<_mesh/_inventory/_history001/_s0002/ttl/inventory.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<${knopPath}/_inventory/inventory.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<_mesh/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${designatorPagePath}> a sflo:ResourcePage, sflo:LocatedFile .

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
`;
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
    workingLocalRelativePath,
    repositorySourceFloatingLocator,
  );
  const currentWorkingFileDeclaration = renderCurrentWorkingFileDeclaration(
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

function toParentDesignatorPath(designatorPath: string): string | undefined {
  const lastSlash = designatorPath.lastIndexOf("/");
  return lastSlash === -1 ? undefined : designatorPath.slice(0, lastSlash);
}

function toStateSegment(stateOrdinal: number): string {
  return `_s${stateOrdinal.toString().padStart(4, "0")}`;
}
