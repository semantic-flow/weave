import { toKnopPath, toReferenceCatalogPath } from "../designator_segments.ts";
import {
  SFLO_NAMESPACE,
  SFLO_TURTLE_PREFIX_DECLARATION,
} from "../rdf/namespaces.ts";
import { toArtifactManifestationPath } from "./artifact_manifestation_paths.ts";
import { WeaveInputError } from "./errors.ts";
import type {
  MeshInventoryProgression,
  PageDefinitionWeaveProgression,
} from "./progression_models.ts";
import {
  renderCurrentWorkingFileDeclaration,
  renderCurrentWorkingFileLocator,
} from "./source_locator_renderers.ts";
import {
  shouldMaterializeSupportHistory,
  type SupportArtifactHistoryPolicy,
} from "./support_history_policy.ts";
import {
  omitInitialKnopMetadataHistory,
  omitKnopInventoryHistory,
} from "./support_history_renderers.ts";
import {
  appendPredicateToSubjectBlock,
  findSubjectBlockIndex,
  replaceSubjectBlock,
  splitTurtleBlocks,
  upsertSubjectBlockAfter,
} from "./turtle_blocks.ts";

const SFLO_HAS_KNOP_ASSET_BUNDLE_IRI = `${SFLO_NAMESPACE}hasKnopAssetBundle`;
const SFLO_HAS_RESOURCE_PAGE_DEFINITION_IRI =
  `${SFLO_NAMESPACE}hasResourcePageDefinition`;
const SFLO_KNOP_ASSET_BUNDLE_IRI = `${SFLO_NAMESPACE}KnopAssetBundle`;
const SFLO_RESOURCE_PAGE_DEFINITION_IRI =
  `${SFLO_NAMESPACE}ResourcePageDefinition`;

export function renderFirstKnopWovenKnopInventoryTurtle(
  meshBase: string,
  designatorPath: string,
  options?: { knopMetadataHistoryPolicy?: SupportArtifactHistoryPolicy },
): string {
  const knopPath = toKnopPath(designatorPath);
  const shouldVersionKnopMetadata = shouldMaterializeSupportHistory(
    options?.knopMetadataHistoryPolicy ?? "versioned",
  );

  const turtle = `@base <${meshBase}> .
${SFLO_TURTLE_PREFIX_DECLARATION}
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

<${knopPath}> a sflo:Knop ;
  sflo:hasKnopMetadata <${knopPath}/_meta> ;
  sflo:hasKnopInventory <${knopPath}/_inventory> ;
  sflo:hasWorkingKnopInventoryFile <${knopPath}/_inventory/inventory.ttl> ;
  sflo:hasResourcePage <${knopPath}/index.html> .

<${knopPath}/_meta> a sflo:KnopMetadata, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasArtifactHistory <${knopPath}/_meta/_history001> ;
  sflo:currentArtifactHistory <${knopPath}/_meta/_history001> ;
  sflo:nextHistoryOrdinal "2"^^xsd:nonNegativeInteger ;
  sflo:hasWorkingLocatedFile <${knopPath}/_meta/meta.ttl> ;
  sflo:hasResourcePage <${knopPath}/_meta/index.html> .

<${knopPath}/_meta/_history001> a sflo:ArtifactHistory ;
  sflo:historyOrdinal "1"^^xsd:nonNegativeInteger ;
  sflo:hasHistoricalState <${knopPath}/_meta/_history001/_s0001> ;
  sflo:latestHistoricalState <${knopPath}/_meta/_history001/_s0001> ;
  sflo:nextStateOrdinal "2"^^xsd:nonNegativeInteger ;
  sflo:hasResourcePage <${knopPath}/_meta/_history001/index.html> .

<${knopPath}/_meta/_history001/_s0001> a sflo:HistoricalState ;
  sflo:stateOrdinal "1"^^xsd:nonNegativeInteger ;
  sflo:hasManifestation <${knopPath}/_meta/_history001/_s0001/ttl> ;
  sflo:locatedFileForState <${knopPath}/_meta/_history001/_s0001/ttl/meta.ttl> ;
  sflo:hasResourcePage <${knopPath}/_meta/_history001/_s0001/index.html> .

<${knopPath}/_meta/_history001/_s0001/ttl> a sflo:ArtifactManifestation, sflo:RdfDocument ;
  sflo:locatedFileForManifestation <${knopPath}/_meta/_history001/_s0001/ttl/meta.ttl> ;
  sflo:hasResourcePage <${knopPath}/_meta/_history001/_s0001/ttl/index.html> .

<${knopPath}/_inventory> a sflo:KnopInventory, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasArtifactHistory <${knopPath}/_inventory/_history001> ;
  sflo:currentArtifactHistory <${knopPath}/_inventory/_history001> ;
  sflo:nextHistoryOrdinal "2"^^xsd:nonNegativeInteger ;
  sflo:hasWorkingLocatedFile <${knopPath}/_inventory/inventory.ttl> ;
  sflo:hasResourcePage <${knopPath}/_inventory/index.html> .

<${knopPath}/_inventory/_history001> a sflo:ArtifactHistory ;
  sflo:historyOrdinal "1"^^xsd:nonNegativeInteger ;
  sflo:hasHistoricalState <${knopPath}/_inventory/_history001/_s0001> ;
  sflo:latestHistoricalState <${knopPath}/_inventory/_history001/_s0001> ;
  sflo:nextStateOrdinal "2"^^xsd:nonNegativeInteger ;
  sflo:hasResourcePage <${knopPath}/_inventory/_history001/index.html> .

<${knopPath}/_inventory/_history001/_s0001> a sflo:HistoricalState ;
  sflo:stateOrdinal "1"^^xsd:nonNegativeInteger ;
  sflo:hasManifestation <${knopPath}/_inventory/_history001/_s0001/ttl> ;
  sflo:locatedFileForState <${knopPath}/_inventory/_history001/_s0001/ttl/inventory.ttl> ;
  sflo:hasResourcePage <${knopPath}/_inventory/_history001/_s0001/index.html> .

<${knopPath}/_inventory/_history001/_s0001/ttl> a sflo:ArtifactManifestation, sflo:RdfDocument ;
  sflo:locatedFileForManifestation <${knopPath}/_inventory/_history001/_s0001/ttl/inventory.ttl> ;
  sflo:hasResourcePage <${knopPath}/_inventory/_history001/_s0001/ttl/index.html> .

<${knopPath}/_meta/meta.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<${knopPath}/_inventory/inventory.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<${knopPath}/_meta/_history001/_s0001/ttl/meta.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<${knopPath}/_inventory/_history001/_s0001/ttl/inventory.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<${knopPath}/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${knopPath}/_meta/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${knopPath}/_meta/_history001/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${knopPath}/_meta/_history001/_s0001/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${knopPath}/_meta/_history001/_s0001/ttl/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${knopPath}/_inventory/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${knopPath}/_inventory/_history001/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${knopPath}/_inventory/_history001/_s0001/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${knopPath}/_inventory/_history001/_s0001/ttl/index.html> a sflo:ResourcePage, sflo:LocatedFile .
`;

  return shouldVersionKnopMetadata
    ? turtle
    : omitInitialKnopMetadataHistory(turtle, knopPath);
}

export function renderFirstReferenceCatalogWovenKnopInventoryTurtle(
  meshBase: string,
  designatorPath: string,
  workingLocalRelativePath: string,
): string {
  const knopPath = toKnopPath(designatorPath);
  const referenceCatalogPath = `${knopPath}/_references`;
  const referenceCatalogManifestationPath = toArtifactManifestationPath(
    `${referenceCatalogPath}/_history001/_s0001`,
    workingLocalRelativePath,
  );
  const currentWorkingFileLocator = renderCurrentWorkingFileLocator(
    workingLocalRelativePath,
  );
  const currentWorkingFileDeclaration = renderCurrentWorkingFileDeclaration(
    workingLocalRelativePath,
  );

  return `@base <${meshBase}> .
${SFLO_TURTLE_PREFIX_DECLARATION}
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

<${knopPath}> a sflo:Knop ;
  sflo:hasKnopMetadata <${knopPath}/_meta> ;
  sflo:hasKnopInventory <${knopPath}/_inventory> ;
  sflo:hasWorkingKnopInventoryFile <${knopPath}/_inventory/inventory.ttl> ;
  sflo:hasReferenceCatalog <${referenceCatalogPath}> ;
  sflo:hasResourcePage <${knopPath}/index.html> .

<${knopPath}/_meta> a sflo:KnopMetadata, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasArtifactHistory <${knopPath}/_meta/_history001> ;
  sflo:currentArtifactHistory <${knopPath}/_meta/_history001> ;
  sflo:nextHistoryOrdinal "2"^^xsd:nonNegativeInteger ;
  sflo:hasWorkingLocatedFile <${knopPath}/_meta/meta.ttl> ;
  sflo:hasResourcePage <${knopPath}/_meta/index.html> .

<${knopPath}/_meta/_history001> a sflo:ArtifactHistory ;
  sflo:historyOrdinal "1"^^xsd:nonNegativeInteger ;
  sflo:hasHistoricalState <${knopPath}/_meta/_history001/_s0001> ;
  sflo:latestHistoricalState <${knopPath}/_meta/_history001/_s0001> ;
  sflo:nextStateOrdinal "2"^^xsd:nonNegativeInteger ;
  sflo:hasResourcePage <${knopPath}/_meta/_history001/index.html> .

<${knopPath}/_meta/_history001/_s0001> a sflo:HistoricalState ;
  sflo:stateOrdinal "1"^^xsd:nonNegativeInteger ;
  sflo:hasManifestation <${knopPath}/_meta/_history001/_s0001/ttl> ;
  sflo:locatedFileForState <${knopPath}/_meta/_history001/_s0001/ttl/meta.ttl> ;
  sflo:hasResourcePage <${knopPath}/_meta/_history001/_s0001/index.html> .

<${knopPath}/_meta/_history001/_s0001/ttl> a sflo:ArtifactManifestation, sflo:RdfDocument ;
  sflo:locatedFileForManifestation <${knopPath}/_meta/_history001/_s0001/ttl/meta.ttl> ;
  sflo:hasResourcePage <${knopPath}/_meta/_history001/_s0001/ttl/index.html> .

<${knopPath}/_inventory> a sflo:KnopInventory, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasArtifactHistory <${knopPath}/_inventory/_history001> ;
  sflo:currentArtifactHistory <${knopPath}/_inventory/_history001> ;
  sflo:nextHistoryOrdinal "2"^^xsd:nonNegativeInteger ;
  sflo:hasWorkingLocatedFile <${knopPath}/_inventory/inventory.ttl> ;
  sflo:hasResourcePage <${knopPath}/_inventory/index.html> .

<${referenceCatalogPath}> a sflo:ReferenceCatalog, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasArtifactHistory <${referenceCatalogPath}/_history001> ;
  sflo:currentArtifactHistory <${referenceCatalogPath}/_history001> ;
  sflo:nextHistoryOrdinal "2"^^xsd:nonNegativeInteger ;
  ${currentWorkingFileLocator}
  sflo:hasResourcePage <${referenceCatalogPath}/index.html> .

<${knopPath}/_inventory/_history001> a sflo:ArtifactHistory ;
  sflo:historyOrdinal "1"^^xsd:nonNegativeInteger ;
  sflo:hasHistoricalState <${knopPath}/_inventory/_history001/_s0001> ;
  sflo:hasHistoricalState <${knopPath}/_inventory/_history001/_s0002> ;
  sflo:latestHistoricalState <${knopPath}/_inventory/_history001/_s0002> ;
  sflo:nextStateOrdinal "3"^^xsd:nonNegativeInteger ;
  sflo:hasResourcePage <${knopPath}/_inventory/_history001/index.html> .

<${knopPath}/_inventory/_history001/_s0001> a sflo:HistoricalState ;
  sflo:stateOrdinal "1"^^xsd:nonNegativeInteger ;
  sflo:hasManifestation <${knopPath}/_inventory/_history001/_s0001/ttl> ;
  sflo:locatedFileForState <${knopPath}/_inventory/_history001/_s0001/ttl/inventory.ttl> ;
  sflo:hasResourcePage <${knopPath}/_inventory/_history001/_s0001/index.html> .

<${knopPath}/_inventory/_history001/_s0001/ttl> a sflo:ArtifactManifestation, sflo:RdfDocument ;
  sflo:locatedFileForManifestation <${knopPath}/_inventory/_history001/_s0001/ttl/inventory.ttl> ;
  sflo:hasResourcePage <${knopPath}/_inventory/_history001/_s0001/ttl/index.html> .

<${knopPath}/_inventory/_history001/_s0002> a sflo:HistoricalState ;
  sflo:stateOrdinal "2"^^xsd:nonNegativeInteger ;
  sflo:previousHistoricalState <${knopPath}/_inventory/_history001/_s0001> ;
  sflo:hasManifestation <${knopPath}/_inventory/_history001/_s0002/ttl> ;
  sflo:locatedFileForState <${knopPath}/_inventory/_history001/_s0002/ttl/inventory.ttl> ;
  sflo:hasResourcePage <${knopPath}/_inventory/_history001/_s0002/index.html> .

<${knopPath}/_inventory/_history001/_s0002/ttl> a sflo:ArtifactManifestation, sflo:RdfDocument ;
  sflo:locatedFileForManifestation <${knopPath}/_inventory/_history001/_s0002/ttl/inventory.ttl> ;
  sflo:hasResourcePage <${knopPath}/_inventory/_history001/_s0002/ttl/index.html> .

<${referenceCatalogPath}/_history001> a sflo:ArtifactHistory ;
  sflo:historyOrdinal "1"^^xsd:nonNegativeInteger ;
  sflo:hasHistoricalState <${referenceCatalogPath}/_history001/_s0001> ;
  sflo:latestHistoricalState <${referenceCatalogPath}/_history001/_s0001> ;
  sflo:nextStateOrdinal "2"^^xsd:nonNegativeInteger ;
  sflo:hasResourcePage <${referenceCatalogPath}/_history001/index.html> .

<${referenceCatalogPath}/_history001/_s0001> a sflo:HistoricalState ;
  sflo:stateOrdinal "1"^^xsd:nonNegativeInteger ;
  sflo:hasManifestation <${referenceCatalogManifestationPath}> ;
  sflo:locatedFileForState <${referenceCatalogManifestationPath}/${
    toFileName(workingLocalRelativePath)
  }> ;
  sflo:hasResourcePage <${referenceCatalogPath}/_history001/_s0001/index.html> .

<${referenceCatalogManifestationPath}> a sflo:ArtifactManifestation, sflo:RdfDocument ;
  sflo:locatedFileForManifestation <${referenceCatalogManifestationPath}/${
    toFileName(workingLocalRelativePath)
  }> ;
  sflo:hasResourcePage <${referenceCatalogManifestationPath}/index.html> .

<${knopPath}/_meta/meta.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<${knopPath}/_inventory/inventory.ttl> a sflo:LocatedFile, sflo:RdfDocument .

${currentWorkingFileDeclaration}

<${knopPath}/_meta/_history001/_s0001/ttl/meta.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<${knopPath}/_inventory/_history001/_s0001/ttl/inventory.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<${knopPath}/_inventory/_history001/_s0002/ttl/inventory.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<${referenceCatalogManifestationPath}/${
    toFileName(workingLocalRelativePath)
  }> a sflo:LocatedFile, sflo:RdfDocument .

<${knopPath}/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${knopPath}/_meta/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${knopPath}/_meta/_history001/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${knopPath}/_meta/_history001/_s0001/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${knopPath}/_meta/_history001/_s0001/ttl/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${knopPath}/_inventory/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${knopPath}/_inventory/_history001/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${knopPath}/_inventory/_history001/_s0001/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${knopPath}/_inventory/_history001/_s0001/ttl/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${knopPath}/_inventory/_history001/_s0002/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${knopPath}/_inventory/_history001/_s0002/ttl/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${referenceCatalogPath}/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${referenceCatalogPath}/_history001/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${referenceCatalogPath}/_history001/_s0001/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${referenceCatalogManifestationPath}/index.html> a sflo:ResourcePage, sflo:LocatedFile .
`;
}

export function renderCurrentOnlyReferenceCatalogWovenKnopInventoryTurtle(
  _meshBase: string,
  currentKnopInventoryTurtle: string,
  designatorPath: string,
  workingLocalRelativePath: string,
): string {
  const referenceCatalogPath = toReferenceCatalogPath(designatorPath);
  const referenceCatalogPagePath = `${referenceCatalogPath}/index.html`;
  const blocks = splitTurtleBlocks(currentKnopInventoryTurtle);
  const currentReferenceCatalogBlockIndex = findSubjectBlockIndex(
    blocks,
    referenceCatalogPath,
  );
  if (currentReferenceCatalogBlockIndex === -1) {
    throw new WeaveInputError(
      `Current KnopInventory did not contain ReferenceCatalog block <${referenceCatalogPath}>.`,
    );
  }

  const currentReferenceCatalogBlock =
    blocks[currentReferenceCatalogBlockIndex]!;
  if (
    !currentReferenceCatalogBlock.includes(`<${workingLocalRelativePath}>`) &&
    !currentReferenceCatalogBlock.includes(`"${workingLocalRelativePath}"`)
  ) {
    throw new WeaveInputError(
      `Current ReferenceCatalog block did not carry the expected working file for ${designatorPath}.`,
    );
  }

  const blocksWithReferencePage = replaceSubjectBlock(
    blocks,
    referenceCatalogPath,
    appendPredicateToSubjectBlock(
      currentReferenceCatalogBlock,
      `sflo:hasResourcePage <${referenceCatalogPagePath}>`,
    ),
  );
  const finalBlocks = upsertSubjectBlockAfter(
    blocksWithReferencePage,
    referenceCatalogPath,
    referenceCatalogPagePath,
    renderResourcePageLocatedFileBlock(referenceCatalogPagePath),
  );

  return `${finalBlocks.join("\n\n")}\n`;
}

export function renderCurrentOnlyPageDefinitionWovenKnopInventoryTurtle(
  _meshBase: string,
  currentKnopInventoryTurtle: string,
  designatorPath: string,
  workingLocalRelativePath: string,
): string {
  const pageDefinitionPath = `${toKnopPath(designatorPath)}/_page`;
  const pageDefinitionPagePath = `${pageDefinitionPath}/index.html`;
  const blocks = splitTurtleBlocks(currentKnopInventoryTurtle);
  const currentPageDefinitionBlockIndex = findSubjectBlockIndex(
    blocks,
    pageDefinitionPath,
  );
  if (currentPageDefinitionBlockIndex === -1) {
    throw new WeaveInputError(
      `Current KnopInventory did not contain ResourcePageDefinition block <${pageDefinitionPath}>.`,
    );
  }

  const currentPageDefinitionBlock = blocks[currentPageDefinitionBlockIndex]!;
  if (
    !currentPageDefinitionBlock.includes(`<${workingLocalRelativePath}>`) &&
    !currentPageDefinitionBlock.includes(`"${workingLocalRelativePath}"`)
  ) {
    throw new WeaveInputError(
      `Current ResourcePageDefinition block did not carry the expected working file for ${designatorPath}.`,
    );
  }

  const blocksWithPage = replaceSubjectBlock(
    blocks,
    pageDefinitionPath,
    appendPredicateToSubjectBlock(
      currentPageDefinitionBlock,
      `sflo:hasResourcePage <${pageDefinitionPagePath}>`,
    ),
  );
  const finalBlocks = upsertSubjectBlockAfter(
    blocksWithPage,
    pageDefinitionPath,
    pageDefinitionPagePath,
    renderResourcePageLocatedFileBlock(pageDefinitionPagePath),
  );

  return `${finalBlocks.join("\n\n")}\n`;
}

export function renderSubsequentPageDefinitionWovenKnopInventoryTurtle(
  meshBase: string,
  designatorPath: string,
  workingLocalRelativePath: string,
  progression: PageDefinitionWeaveProgression,
  knopInventoryProgression: MeshInventoryProgression,
  assetBundlePath?: string,
  hasReferenceCatalog = true,
): string {
  const knopPath = toKnopPath(designatorPath);
  const referenceCatalogPath = `${knopPath}/_references`;
  const pageDefinitionPath = `${knopPath}/_page`;
  const referenceCatalogLines = hasReferenceCatalog
    ? `  sflo:hasReferenceCatalog <${referenceCatalogPath}> ;\n`
    : "";
  const assetBundleLines = assetBundlePath
    ? ` ;
  <${SFLO_HAS_KNOP_ASSET_BUNDLE_IRI}> <${assetBundlePath}>`
    : "";
  const assetBundleBlock = assetBundlePath
    ? `<${assetBundlePath}> a <${SFLO_KNOP_ASSET_BUNDLE_IRI}> .\n\n`
    : "";
  const currentWorkingFileLocator = renderCurrentWorkingFileLocator(
    workingLocalRelativePath,
  );
  const currentWorkingFileDeclaration = renderCurrentWorkingFileDeclaration(
    workingLocalRelativePath,
  );
  const pageDefinitionStateBlocks = Array.from(
    { length: progression.nextStateOrdinal },
    (_, index) => {
      const stateOrdinal = index + 1;
      const statePath = `${progression.historyPath}/${
        toStateSegment(stateOrdinal)
      }`;
      return renderPageDefinitionStateBlock(
        statePath,
        stateOrdinal,
        stateOrdinal > 1
          ? `${progression.historyPath}/${toStateSegment(stateOrdinal - 1)}`
          : undefined,
      );
    },
  ).join("\n\n");
  const pageDefinitionManifestationBlocks = Array.from(
    { length: progression.nextStateOrdinal },
    (_, index) =>
      renderPageDefinitionStateManifestationBlock(
        `${progression.historyPath}/${toStateSegment(index + 1)}`,
      ),
  ).join("\n\n");
  const knopInventoryStateBlocks = Array.from(
    { length: knopInventoryProgression.nextStateOrdinal },
    (_, index) => {
      const stateOrdinal = index + 1;
      const statePath = `${knopInventoryProgression.historyPath}/${
        toStateSegment(stateOrdinal)
      }`;
      return renderMeshInventoryStateBlock(
        statePath,
        stateOrdinal,
        stateOrdinal > 1
          ? `${knopInventoryProgression.historyPath}/${
            toStateSegment(stateOrdinal - 1)
          }`
          : undefined,
      );
    },
  ).join("\n\n");
  const knopInventoryManifestationBlocks = Array.from(
    { length: knopInventoryProgression.nextStateOrdinal },
    (_, index) =>
      renderMeshInventoryStateManifestationBlock(
        `${knopInventoryProgression.historyPath}/${toStateSegment(index + 1)}`,
      ),
  ).join("\n\n");
  const knopInventoryLocatedFileBlocks = Array.from(
    { length: knopInventoryProgression.nextStateOrdinal },
    (_, index) =>
      renderLocatedFileBlock(
        `${knopInventoryProgression.historyPath}/${
          toStateSegment(index + 1)
        }/ttl/inventory.ttl`,
      ),
  ).join("\n\n");
  const knopInventoryResourcePageBlocks = Array.from(
    { length: knopInventoryProgression.nextStateOrdinal },
    (_, index) => {
      const statePath = `${knopInventoryProgression.historyPath}/${
        toStateSegment(index + 1)
      }`;
      return `${renderResourcePageLocatedFileBlock(`${statePath}/index.html`)}

${renderResourcePageLocatedFileBlock(`${statePath}/ttl/index.html`)}`;
    },
  ).join("\n\n");
  const pageDefinitionLocatedFileBlocks = Array.from(
    { length: progression.nextStateOrdinal },
    (_, index) =>
      renderLocatedFileBlock(
        `${progression.historyPath}/${toStateSegment(index + 1)}/ttl/page.ttl`,
      ),
  ).join("\n\n");
  const pageDefinitionResourcePageBlocks = Array.from(
    { length: progression.nextStateOrdinal },
    (_, index) => {
      const statePath = `${progression.historyPath}/${
        toStateSegment(index + 1)
      }`;
      return `${renderResourcePageLocatedFileBlock(`${statePath}/index.html`)}

${renderResourcePageLocatedFileBlock(`${statePath}/ttl/index.html`)}`;
    },
  ).join("\n\n");
  const referenceCatalogArtifactBlock = hasReferenceCatalog
    ? `

<${referenceCatalogPath}> a sflo:ReferenceCatalog, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasArtifactHistory <${referenceCatalogPath}/_history001> ;
  sflo:currentArtifactHistory <${referenceCatalogPath}/_history001> ;
  sflo:nextHistoryOrdinal "2"^^xsd:nonNegativeInteger ;
  sflo:hasWorkingLocatedFile <${referenceCatalogPath}/references.ttl> ;
  sflo:hasResourcePage <${referenceCatalogPath}/index.html> .`
    : "";
  const referenceCatalogHistoryBlocks = hasReferenceCatalog
    ? `

<${knopPath}/_references/_history001> a sflo:ArtifactHistory ;
  sflo:historyOrdinal "1"^^xsd:nonNegativeInteger ;
  sflo:hasHistoricalState <${knopPath}/_references/_history001/_s0001> ;
  sflo:latestHistoricalState <${knopPath}/_references/_history001/_s0001> ;
  sflo:nextStateOrdinal "2"^^xsd:nonNegativeInteger ;
  sflo:hasResourcePage <${knopPath}/_references/_history001/index.html> .

<${knopPath}/_references/_history001/_s0001> a sflo:HistoricalState ;
  sflo:stateOrdinal "1"^^xsd:nonNegativeInteger ;
  sflo:hasManifestation <${knopPath}/_references/_history001/_s0001/ttl> ;
  sflo:locatedFileForState <${knopPath}/_references/_history001/_s0001/ttl/references.ttl> ;
  sflo:hasResourcePage <${knopPath}/_references/_history001/_s0001/index.html> .

<${knopPath}/_references/_history001/_s0001/ttl> a sflo:ArtifactManifestation, sflo:RdfDocument ;
  sflo:locatedFileForManifestation <${knopPath}/_references/_history001/_s0001/ttl/references.ttl> ;
  sflo:hasResourcePage <${knopPath}/_references/_history001/_s0001/ttl/index.html> .`
    : "";
  const referenceCatalogLocatedFileBlock = hasReferenceCatalog
    ? `\n\n<${referenceCatalogPath}/references.ttl> a sflo:LocatedFile, sflo:RdfDocument .`
    : "";
  const referenceCatalogHistoricalLocatedFileBlock = hasReferenceCatalog
    ? `\n\n<${knopPath}/_references/_history001/_s0001/ttl/references.ttl> a sflo:LocatedFile, sflo:RdfDocument .`
    : "";
  const referenceCatalogResourcePageBlocks = hasReferenceCatalog
    ? `\n\n<${referenceCatalogPath}/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${referenceCatalogPath}/_history001/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${referenceCatalogPath}/_history001/_s0001/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${knopPath}/_references/_history001/_s0001/ttl/index.html> a sflo:ResourcePage, sflo:LocatedFile .`
    : "";

  return `@base <${meshBase}> .
${SFLO_TURTLE_PREFIX_DECLARATION}
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

<${knopPath}> a sflo:Knop ;
  sflo:hasKnopMetadata <${knopPath}/_meta> ;
  sflo:hasKnopInventory <${knopPath}/_inventory> ;
  sflo:hasWorkingKnopInventoryFile <${knopPath}/_inventory/inventory.ttl> ;
${referenceCatalogLines}
  sflo:hasResourcePage <${knopPath}/index.html> ;
  <${SFLO_HAS_RESOURCE_PAGE_DEFINITION_IRI}> <${pageDefinitionPath}>${assetBundleLines} .

<${knopPath}/_meta> a sflo:KnopMetadata, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasArtifactHistory <${knopPath}/_meta/_history001> ;
  sflo:currentArtifactHistory <${knopPath}/_meta/_history001> ;
  sflo:nextHistoryOrdinal "2"^^xsd:nonNegativeInteger ;
  sflo:hasWorkingLocatedFile <${knopPath}/_meta/meta.ttl> ;
  sflo:hasResourcePage <${knopPath}/_meta/index.html> .

<${knopPath}/_meta/_history001> a sflo:ArtifactHistory ;
  sflo:historyOrdinal "1"^^xsd:nonNegativeInteger ;
  sflo:hasHistoricalState <${knopPath}/_meta/_history001/_s0001> ;
  sflo:latestHistoricalState <${knopPath}/_meta/_history001/_s0001> ;
  sflo:nextStateOrdinal "2"^^xsd:nonNegativeInteger ;
  sflo:hasResourcePage <${knopPath}/_meta/_history001/index.html> .

<${knopPath}/_meta/_history001/_s0001> a sflo:HistoricalState ;
  sflo:stateOrdinal "1"^^xsd:nonNegativeInteger ;
  sflo:hasManifestation <${knopPath}/_meta/_history001/_s0001/ttl> ;
  sflo:locatedFileForState <${knopPath}/_meta/_history001/_s0001/ttl/meta.ttl> ;
  sflo:hasResourcePage <${knopPath}/_meta/_history001/_s0001/index.html> .

<${knopPath}/_meta/_history001/_s0001/ttl> a sflo:ArtifactManifestation, sflo:RdfDocument ;
  sflo:locatedFileForManifestation <${knopPath}/_meta/_history001/_s0001/ttl/meta.ttl> ;
  sflo:hasResourcePage <${knopPath}/_meta/_history001/_s0001/ttl/index.html> .

<${knopPath}/_inventory> a sflo:KnopInventory, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasArtifactHistory <${knopInventoryProgression.historyPath}> ;
  sflo:currentArtifactHistory <${knopInventoryProgression.historyPath}> ;
  sflo:nextHistoryOrdinal "2"^^xsd:nonNegativeInteger ;
  sflo:hasWorkingLocatedFile <${knopPath}/_inventory/inventory.ttl> ;
  sflo:hasResourcePage <${knopPath}/_inventory/index.html> .
${referenceCatalogArtifactBlock}

<${pageDefinitionPath}> a <${SFLO_RESOURCE_PAGE_DEFINITION_IRI}>, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasArtifactHistory <${progression.historyPath}> ;
  sflo:currentArtifactHistory <${progression.historyPath}> ;
  sflo:nextHistoryOrdinal "2"^^xsd:nonNegativeInteger ;
  ${currentWorkingFileLocator}
  sflo:hasResourcePage <${pageDefinitionPath}/index.html> .

${assetBundleBlock}<${progression.historyPath}> a sflo:ArtifactHistory ;
${
    Array.from({ length: progression.nextStateOrdinal }, (_, index) =>
      `  sflo:hasHistoricalState <${progression.historyPath}/${
        toStateSegment(index + 1)
      }> ;`).join("\n")
  }
  sflo:historyOrdinal "1"^^xsd:nonNegativeInteger ;
  sflo:latestHistoricalState <${progression.nextStatePath}> ;
  sflo:nextStateOrdinal "${
    progression.nextStateOrdinal + 1
  }"^^xsd:nonNegativeInteger ;
  sflo:hasResourcePage <${progression.historyPath}/index.html> .

${pageDefinitionStateBlocks}

${pageDefinitionManifestationBlocks}

<${knopInventoryProgression.historyPath}> a sflo:ArtifactHistory ;
${
    Array.from(
      { length: knopInventoryProgression.nextStateOrdinal },
      (_, index) =>
        `  sflo:hasHistoricalState <${knopInventoryProgression.historyPath}/${
          toStateSegment(index + 1)
        }> ;`,
    ).join("\n")
  }
  sflo:historyOrdinal "1"^^xsd:nonNegativeInteger ;
  sflo:latestHistoricalState <${knopInventoryProgression.nextStatePath}> ;
  sflo:nextStateOrdinal "${
    knopInventoryProgression.nextStateOrdinal + 1
  }"^^xsd:nonNegativeInteger ;
  sflo:hasResourcePage <${knopInventoryProgression.historyPath}/index.html> .

${knopInventoryStateBlocks}

${knopInventoryManifestationBlocks}
${referenceCatalogHistoryBlocks}

<${knopPath}/_meta/meta.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<${knopPath}/_inventory/inventory.ttl> a sflo:LocatedFile, sflo:RdfDocument .
${referenceCatalogLocatedFileBlock}

${currentWorkingFileDeclaration}

<${knopPath}/_meta/_history001/_s0001/ttl/meta.ttl> a sflo:LocatedFile, sflo:RdfDocument .

${knopInventoryLocatedFileBlocks}
${referenceCatalogHistoricalLocatedFileBlock}

${pageDefinitionLocatedFileBlocks}

<${knopPath}/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${knopPath}/_meta/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${knopPath}/_meta/_history001/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${knopPath}/_meta/_history001/_s0001/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${knopPath}/_meta/_history001/_s0001/ttl/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${knopPath}/_inventory/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${knopInventoryProgression.historyPath}/index.html> a sflo:ResourcePage, sflo:LocatedFile .

${knopInventoryResourcePageBlocks}
${referenceCatalogResourcePageBlocks}

<${pageDefinitionPath}/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${progression.historyPath}/index.html> a sflo:ResourcePage, sflo:LocatedFile .

${pageDefinitionResourcePageBlocks}
`;
}

export function renderFirstExtractedKnopWovenKnopInventoryTurtle(
  meshBase: string,
  designatorPath: string,
  options?: {
    knopMetadataHistoryPolicy?: SupportArtifactHistoryPolicy;
    knopInventoryHistoryPolicy?: SupportArtifactHistoryPolicy;
  },
): string {
  const knopPath = toKnopPath(designatorPath);
  const sourceRegistryPath = `${knopPath}/_sources`;
  const sourcesFilePath = `${sourceRegistryPath}/sources.ttl`;
  const extractionSourcePath = `${sourceRegistryPath}#extraction-source`;
  const shouldVersionKnopMetadata = shouldMaterializeSupportHistory(
    options?.knopMetadataHistoryPolicy ?? "versioned",
  );
  const shouldVersionKnopInventory = shouldMaterializeSupportHistory(
    options?.knopInventoryHistoryPolicy ?? "versioned",
  );

  const turtle = `@base <${meshBase}> .
${SFLO_TURTLE_PREFIX_DECLARATION}
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

<${knopPath}> a sflo:Knop ;
  sflo:hasKnopMetadata <${knopPath}/_meta> ;
  sflo:hasKnopInventory <${knopPath}/_inventory> ;
  sflo:hasKnopSourceRegistry <${sourceRegistryPath}> ;
  sflo:hasExtractionSource <${extractionSourcePath}> ;
  sflo:hasWorkingKnopInventoryFile <${knopPath}/_inventory/inventory.ttl> ;
  sflo:hasResourcePage <${knopPath}/index.html> .

<${knopPath}/_meta> a sflo:KnopMetadata, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasArtifactHistory <${knopPath}/_meta/_history001> ;
  sflo:currentArtifactHistory <${knopPath}/_meta/_history001> ;
  sflo:nextHistoryOrdinal "2"^^xsd:nonNegativeInteger ;
  sflo:hasWorkingLocatedFile <${knopPath}/_meta/meta.ttl> ;
  sflo:hasResourcePage <${knopPath}/_meta/index.html> .

<${knopPath}/_meta/_history001> a sflo:ArtifactHistory ;
  sflo:historyOrdinal "1"^^xsd:nonNegativeInteger ;
  sflo:hasHistoricalState <${knopPath}/_meta/_history001/_s0001> ;
  sflo:latestHistoricalState <${knopPath}/_meta/_history001/_s0001> ;
  sflo:nextStateOrdinal "2"^^xsd:nonNegativeInteger ;
  sflo:hasResourcePage <${knopPath}/_meta/_history001/index.html> .

<${knopPath}/_meta/_history001/_s0001> a sflo:HistoricalState ;
  sflo:stateOrdinal "1"^^xsd:nonNegativeInteger ;
  sflo:hasManifestation <${knopPath}/_meta/_history001/_s0001/ttl> ;
  sflo:locatedFileForState <${knopPath}/_meta/_history001/_s0001/ttl/meta.ttl> ;
  sflo:hasResourcePage <${knopPath}/_meta/_history001/_s0001/index.html> .

<${knopPath}/_meta/_history001/_s0001/ttl> a sflo:ArtifactManifestation, sflo:RdfDocument ;
  sflo:locatedFileForManifestation <${knopPath}/_meta/_history001/_s0001/ttl/meta.ttl> ;
  sflo:hasResourcePage <${knopPath}/_meta/_history001/_s0001/ttl/index.html> .

<${knopPath}/_inventory> a sflo:KnopInventory, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasArtifactHistory <${knopPath}/_inventory/_history001> ;
  sflo:currentArtifactHistory <${knopPath}/_inventory/_history001> ;
  sflo:nextHistoryOrdinal "2"^^xsd:nonNegativeInteger ;
  sflo:hasWorkingLocatedFile <${knopPath}/_inventory/inventory.ttl> ;
  sflo:hasResourcePage <${knopPath}/_inventory/index.html> .

<${sourceRegistryPath}> a sflo:KnopSourceRegistry, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasWorkingLocatedFile <${sourcesFilePath}> .

<${knopPath}/_inventory/_history001> a sflo:ArtifactHistory ;
  sflo:historyOrdinal "1"^^xsd:nonNegativeInteger ;
  sflo:hasHistoricalState <${knopPath}/_inventory/_history001/_s0001> ;
  sflo:latestHistoricalState <${knopPath}/_inventory/_history001/_s0001> ;
  sflo:nextStateOrdinal "2"^^xsd:nonNegativeInteger ;
  sflo:hasResourcePage <${knopPath}/_inventory/_history001/index.html> .

<${knopPath}/_inventory/_history001/_s0001> a sflo:HistoricalState ;
  sflo:stateOrdinal "1"^^xsd:nonNegativeInteger ;
  sflo:hasManifestation <${knopPath}/_inventory/_history001/_s0001/ttl> ;
  sflo:locatedFileForState <${knopPath}/_inventory/_history001/_s0001/ttl/inventory.ttl> ;
  sflo:hasResourcePage <${knopPath}/_inventory/_history001/_s0001/index.html> .

<${knopPath}/_inventory/_history001/_s0001/ttl> a sflo:ArtifactManifestation, sflo:RdfDocument ;
  sflo:locatedFileForManifestation <${knopPath}/_inventory/_history001/_s0001/ttl/inventory.ttl> ;
  sflo:hasResourcePage <${knopPath}/_inventory/_history001/_s0001/ttl/index.html> .

<${knopPath}/_meta/meta.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<${knopPath}/_inventory/inventory.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<${sourcesFilePath}> a sflo:LocatedFile, sflo:RdfDocument .

<${knopPath}/_meta/_history001/_s0001/ttl/meta.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<${knopPath}/_inventory/_history001/_s0001/ttl/inventory.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<${knopPath}/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${knopPath}/_meta/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${knopPath}/_meta/_history001/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${knopPath}/_meta/_history001/_s0001/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${knopPath}/_meta/_history001/_s0001/ttl/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${knopPath}/_inventory/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${knopPath}/_inventory/_history001/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${knopPath}/_inventory/_history001/_s0001/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${knopPath}/_inventory/_history001/_s0001/ttl/index.html> a sflo:ResourcePage, sflo:LocatedFile .
`;

  let output = turtle;
  if (!shouldVersionKnopMetadata) {
    output = omitInitialKnopMetadataHistory(output, knopPath);
  }
  if (!shouldVersionKnopInventory) {
    output = omitKnopInventoryHistory(output, knopPath);
  }
  return output;
}

function renderPageDefinitionStateBlock(
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
  sflo:locatedFileForState <${statePath}/ttl/page.ttl> ;
  sflo:hasResourcePage <${statePath}/index.html> .`;
}

function renderPageDefinitionStateManifestationBlock(
  statePath: string,
): string {
  return `<${statePath}/ttl> a sflo:ArtifactManifestation, sflo:RdfDocument ;
  sflo:locatedFileForManifestation <${statePath}/ttl/page.ttl> ;
  sflo:hasResourcePage <${statePath}/ttl/index.html> .`;
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

function toFileName(path: string): string {
  const segments = path.split("/");
  return segments[segments.length - 1]!;
}

function toStateSegment(stateOrdinal: number): string {
  return `_s${String(stateOrdinal).padStart(4, "0")}`;
}
