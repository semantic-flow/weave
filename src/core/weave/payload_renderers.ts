import type { Quad } from "n3";
import {
  toDesignatorResourcePagePath,
  toKnopPath,
} from "../designator_segments.ts";
import {
  SFLO_NAMESPACE,
  SFLO_TURTLE_PREFIX_DECLARATION,
} from "../rdf/namespaces.ts";
import { WeaveInputError } from "./errors.ts";
import type { PayloadVersionLayout } from "./payload_version_layout.ts";
import {
  parseWeaveShapeQuads,
  resolveNamedNodeObjectPaths,
  resolveOptionalNamedNodePath,
  resolveOptionalNonNegativeIntegerLiteral,
  toAbsoluteIri,
} from "./rdf_helpers.ts";
import {
  renderCurrentWorkingFileDeclaration,
  renderCurrentWorkingFileLocator,
} from "./source_locator_renderers.ts";
import type { RepositorySourceFloatingLocator } from "./source_models.ts";
import {
  omitInitialKnopMetadataHistory,
  omitKnopInventoryHistory,
} from "./support_history_renderers.ts";
import {
  shouldMaterializeSupportHistory,
  type SupportArtifactHistoryPolicy,
} from "./support_history_policy.ts";
import { renderSubjectPredicateBlock } from "./turtle_blocks.ts";

const SFLO_CURRENT_ARTIFACT_HISTORY_IRI =
  `${SFLO_NAMESPACE}currentArtifactHistory`;
const SFLO_HAS_ARTIFACT_HISTORY_IRI = `${SFLO_NAMESPACE}hasArtifactHistory`;
const SFLO_HAS_HISTORICAL_STATE_IRI = `${SFLO_NAMESPACE}hasHistoricalState`;
const SFLO_HAS_MANIFESTATION_IRI = `${SFLO_NAMESPACE}hasManifestation`;
const SFLO_LATEST_HISTORICAL_STATE_IRI =
  `${SFLO_NAMESPACE}latestHistoricalState`;
const SFLO_NEXT_STATE_ORDINAL_IRI = `${SFLO_NAMESPACE}nextStateOrdinal`;

export function renderFirstPayloadWovenKnopInventoryTurtle(
  meshBase: string,
  designatorPath: string,
  payloadLayout: PayloadVersionLayout,
  workingLocalRelativePath: string,
  repositorySourceFloatingLocator?: RepositorySourceFloatingLocator,
  options?: {
    knopMetadataHistoryPolicy?: SupportArtifactHistoryPolicy;
    knopInventoryHistoryPolicy?: SupportArtifactHistoryPolicy;
  },
): string {
  const knopPath = toKnopPath(designatorPath);
  const designatorPagePath = toDesignatorResourcePagePath(designatorPath);
  const payloadSnapshotPath = `${payloadLayout.nextManifestationPath}/${
    toFileName(workingLocalRelativePath)
  }`;
  const currentWorkingFileLocator = renderCurrentWorkingFileLocator(
    workingLocalRelativePath,
    repositorySourceFloatingLocator,
  );
  const currentWorkingFileDeclaration = renderCurrentWorkingFileDeclaration(
    workingLocalRelativePath,
    repositorySourceFloatingLocator,
  );
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
  sflo:hasWorkingKnopInventoryFile <${knopPath}/_inventory/inventory.ttl> ;
  sflo:hasPayloadArtifact <${designatorPath}> ;
  sflo:hasResourcePage <${knopPath}/index.html> .

<${designatorPath}> a sflo:PayloadArtifact, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasArtifactHistory <${payloadLayout.historyPath}> ;
  sflo:currentArtifactHistory <${payloadLayout.historyPath}> ;
  sflo:nextHistoryOrdinal "2"^^xsd:nonNegativeInteger ;
  ${currentWorkingFileLocator}
  sflo:hasResourcePage <${designatorPagePath}> .

<${payloadLayout.historyPath}> a sflo:ArtifactHistory ;
  sflo:historyOrdinal "1"^^xsd:nonNegativeInteger ;
  sflo:hasHistoricalState <${payloadLayout.nextStatePath}> ;
  sflo:latestHistoricalState <${payloadLayout.nextStatePath}> ;
  sflo:nextStateOrdinal "2"^^xsd:nonNegativeInteger ;
  sflo:hasResourcePage <${payloadLayout.historyPath}/index.html> .

<${payloadLayout.nextStatePath}> a sflo:HistoricalState ;
  sflo:stateOrdinal "1"^^xsd:nonNegativeInteger ;
  sflo:hasManifestation <${payloadLayout.nextManifestationPath}> ;
  sflo:locatedFileForState <${payloadSnapshotPath}> ;
  sflo:hasResourcePage <${payloadLayout.nextStatePath}/index.html> .

<${payloadLayout.nextManifestationPath}> a sflo:ArtifactManifestation, sflo:RdfDocument ;
  sflo:locatedFileForManifestation <${payloadSnapshotPath}> ;
  sflo:hasResourcePage <${payloadLayout.nextManifestationPath}/index.html> .

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

${currentWorkingFileDeclaration}

<${payloadSnapshotPath}> a sflo:LocatedFile, sflo:RdfDocument .

<${knopPath}/_meta/_history001/_s0001/ttl/meta.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<${knopPath}/_inventory/_history001/_s0001/ttl/inventory.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<${designatorPagePath}> a sflo:ResourcePage, sflo:LocatedFile .

<${payloadLayout.historyPath}/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${payloadLayout.nextStatePath}/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${payloadLayout.nextManifestationPath}/index.html> a sflo:ResourcePage, sflo:LocatedFile .

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

interface RenderedArtifactHistoryModel {
  path: string;
  historyOrdinal?: number;
  latestStatePath?: string;
  nextStateOrdinal?: number;
  states: RenderedHistoricalStateModel[];
}

interface RenderedHistoricalStateModel {
  path: string;
  stateOrdinal?: number;
  previousStatePath?: string;
  manifestationPath: string;
  locatedFilePath: string;
}

interface HistoricalStateLocatedFileFallback {
  manifestationSegment: string;
  fileName: string;
}

function renderMultiHistoryPayloadWovenKnopInventoryTurtle(
  meshBase: string,
  designatorPath: string,
  payloadLayout: PayloadVersionLayout,
  workingLocalRelativePath: string,
  repositorySourceFloatingLocator: RepositorySourceFloatingLocator | undefined,
  currentKnopInventoryTurtle: string,
  options?: {
    knopInventoryHistoryPolicy?: SupportArtifactHistoryPolicy;
  },
): string {
  const knopPath = toKnopPath(designatorPath);
  const designatorPagePath = toDesignatorResourcePagePath(designatorPath);
  const payloadFileName = toFileName(workingLocalRelativePath);
  const currentWorkingFileLocator = renderCurrentWorkingFileLocator(
    workingLocalRelativePath,
    repositorySourceFloatingLocator,
  );
  const currentWorkingFileDeclaration = renderCurrentWorkingFileDeclaration(
    workingLocalRelativePath,
    repositorySourceFloatingLocator,
  );
  const errorMessage =
    `Could not parse the current KnopInventory while rendering multiple payload histories for ${designatorPath}.`;
  const quads = parseWeaveShapeQuads(
    meshBase,
    currentKnopInventoryTurtle,
    errorMessage,
  );
  const versionKnopInventory = shouldMaterializeSupportHistory(
    options?.knopInventoryHistoryPolicy ?? "versioned",
  );
  const payloadHistories = collectRenderedArtifactHistories(
    meshBase,
    quads,
    designatorPath,
    errorMessage,
  );
  const nextPayloadSnapshotPath =
    `${payloadLayout.nextManifestationPath}/${payloadFileName}`;
  upsertRenderedArtifactHistoryState(payloadHistories, {
    historyPath: payloadLayout.historyPath,
    statePath: payloadLayout.nextStatePath,
    manifestationPath: payloadLayout.nextManifestationPath,
    locatedFilePath: nextPayloadSnapshotPath,
    previousStatePath: payloadLayout.previousStatePath,
    stateOrdinal: payloadLayout.nextStateOrdinal,
  });

  const knopInventoryPath = `${knopPath}/_inventory`;
  const knopInventoryHistories = versionKnopInventory
    ? collectRenderedArtifactHistories(
      meshBase,
      quads,
      knopInventoryPath,
      errorMessage,
      {
        manifestationSegment: "ttl",
        fileName: "inventory.ttl",
      },
    )
    : [];
  const knopInventoryHistory = versionKnopInventory
    ? requireCurrentRenderedHistory(
      meshBase,
      quads,
      knopInventoryPath,
      knopInventoryHistories,
      errorMessage,
    )
    : undefined;
  if (
    versionKnopInventory &&
    knopInventoryHistory?.nextStateOrdinal === undefined
  ) {
    throw new WeaveInputError(errorMessage);
  }
  if (knopInventoryHistory !== undefined) {
    const nextKnopInventoryStatePath = `${knopInventoryHistory.path}/${
      toStateSegment(knopInventoryHistory.nextStateOrdinal!)
    }`;
    const previousKnopInventoryStatePath = knopInventoryHistory.latestStatePath;
    upsertRenderedArtifactHistoryState(knopInventoryHistories, {
      historyPath: knopInventoryHistory.path,
      statePath: nextKnopInventoryStatePath,
      manifestationPath: `${nextKnopInventoryStatePath}/ttl`,
      locatedFilePath: `${nextKnopInventoryStatePath}/ttl/inventory.ttl`,
      previousStatePath: previousKnopInventoryStatePath,
      stateOrdinal: knopInventoryHistory.nextStateOrdinal,
    });
  }

  const payloadHistoryPaths = payloadHistories.map((history) => history.path);
  const payloadHistoryBlocks = payloadHistories
    .map(renderRenderedArtifactHistoryBlock)
    .join("\n\n");
  const payloadStateBlocks = payloadHistories.flatMap((history) =>
    history.states.map(renderRenderedHistoricalStateBlock)
  ).join("\n\n");
  const payloadManifestationBlocks = payloadHistories.flatMap((history) =>
    history.states.map(renderRenderedManifestationBlock)
  ).join("\n\n");
  const payloadLocatedFileBlocks = payloadHistories.flatMap((history) =>
    history.states.map((state) =>
      `<${state.locatedFilePath}> a sflo:LocatedFile, sflo:RdfDocument .`
    )
  ).join("\n\n");
  const payloadResourcePageBlocks = renderRenderedHistoryResourcePageBlocks(
    payloadHistories,
  );

  const knopInventoryHistoryBlocks = knopInventoryHistories
    .map(renderRenderedArtifactHistoryBlock)
    .join("\n\n");
  const knopInventoryStateBlocks = knopInventoryHistories.flatMap((history) =>
    history.states.map(renderRenderedHistoricalStateBlock)
  ).join("\n\n");
  const knopInventoryManifestationBlocks = knopInventoryHistories.flatMap((
    history,
  ) => history.states.map(renderRenderedManifestationBlock)).join("\n\n");
  const knopInventoryLocatedFileBlocks = knopInventoryHistories.flatMap((
    history,
  ) =>
    history.states.map((state) =>
      `<${state.locatedFilePath}> a sflo:LocatedFile, sflo:RdfDocument .`
    )
  ).join("\n\n");
  const knopInventoryResourcePageBlocks =
    renderRenderedHistoryResourcePageBlocks(knopInventoryHistories);
  const payloadNextHistoryOrdinal = resolveOptionalNonNegativeIntegerLiteral(
    quads,
    toAbsoluteIri(meshBase, designatorPath),
    `${SFLO_NAMESPACE}nextHistoryOrdinal`,
    errorMessage,
  );
  const knopInventoryCurrentHistoryPath = knopInventoryHistory?.path;
  const knopInventoryNextHistoryOrdinal = versionKnopInventory
    ? resolveOptionalNonNegativeIntegerLiteral(
      quads,
      toAbsoluteIri(meshBase, knopInventoryPath),
      `${SFLO_NAMESPACE}nextHistoryOrdinal`,
      errorMessage,
    )
    : undefined;

  return `@base <${meshBase}> .
${SFLO_TURTLE_PREFIX_DECLARATION}
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

<${knopPath}> a sflo:Knop ;
  sflo:hasKnopMetadata <${knopPath}/_meta> ;
  sflo:hasKnopInventory <${knopPath}/_inventory> ;
  sflo:hasWorkingKnopInventoryFile <${knopPath}/_inventory/inventory.ttl> ;
  sflo:hasPayloadArtifact <${designatorPath}> ;
  sflo:hasResourcePage <${knopPath}/index.html> .

<${designatorPath}> a sflo:PayloadArtifact, sflo:DigitalArtifact, sflo:RdfDocument ;
${
    payloadHistoryPaths.map((historyPath) =>
      `  sflo:hasArtifactHistory <${historyPath}> ;`
    ).join("\n")
  }
  sflo:currentArtifactHistory <${payloadLayout.historyPath}> ;
${
    payloadNextHistoryOrdinal === undefined
      ? ""
      : `  sflo:nextHistoryOrdinal "${payloadNextHistoryOrdinal}"^^xsd:nonNegativeInteger ;
`
  }  ${currentWorkingFileLocator}
  sflo:hasResourcePage <${designatorPagePath}> .

${payloadHistoryBlocks}

${payloadStateBlocks}

${payloadManifestationBlocks}

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

<${knopInventoryPath}> a sflo:KnopInventory, sflo:DigitalArtifact, sflo:RdfDocument ;
${
    knopInventoryHistory === undefined || knopInventoryCurrentHistoryPath ===
        undefined
      ? ""
      : `  sflo:hasArtifactHistory <${knopInventoryHistory.path}> ;
  sflo:currentArtifactHistory <${knopInventoryCurrentHistoryPath}> ;
`
  }${
    knopInventoryNextHistoryOrdinal === undefined
      ? ""
      : `  sflo:nextHistoryOrdinal "${knopInventoryNextHistoryOrdinal}"^^xsd:nonNegativeInteger ;
`
  }  sflo:hasWorkingLocatedFile <${knopPath}/_inventory/inventory.ttl> ;
  sflo:hasResourcePage <${knopPath}/_inventory/index.html> .

${knopInventoryHistoryBlocks}

${knopInventoryStateBlocks}

${knopInventoryManifestationBlocks}

<${knopPath}/_meta/meta.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<${knopPath}/_inventory/inventory.ttl> a sflo:LocatedFile, sflo:RdfDocument .

${currentWorkingFileDeclaration}

<${knopPath}/_meta/_history001/_s0001/ttl/meta.ttl> a sflo:LocatedFile, sflo:RdfDocument .

${payloadLocatedFileBlocks}

${knopInventoryLocatedFileBlocks}

<${designatorPagePath}> a sflo:ResourcePage, sflo:LocatedFile .

${payloadResourcePageBlocks}

<${knopPath}/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${knopPath}/_meta/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${knopPath}/_meta/_history001/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${knopPath}/_meta/_history001/_s0001/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${knopPath}/_meta/_history001/_s0001/ttl/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${knopPath}/_inventory/index.html> a sflo:ResourcePage, sflo:LocatedFile .

${knopInventoryResourcePageBlocks}
`;
}

export function renderSecondPayloadWovenKnopInventoryTurtle(
  meshBase: string,
  designatorPath: string,
  payloadLayout: PayloadVersionLayout,
  workingLocalRelativePath: string,
  repositorySourceFloatingLocator: RepositorySourceFloatingLocator | undefined,
  currentKnopInventoryTurtle: string,
  options?: {
    knopMetadataHistoryPolicy?: SupportArtifactHistoryPolicy;
    knopInventoryHistoryPolicy?: SupportArtifactHistoryPolicy;
  },
): string {
  const applySupportHistoryPolicies = (turtle: string): string => {
    const knopPath = toKnopPath(designatorPath);
    let output = turtle;
    if (
      !shouldMaterializeSupportHistory(
        options?.knopMetadataHistoryPolicy ?? "versioned",
      )
    ) {
      output = omitInitialKnopMetadataHistory(output, knopPath);
    }
    if (
      !shouldMaterializeSupportHistory(
        options?.knopInventoryHistoryPolicy ?? "versioned",
      )
    ) {
      output = omitKnopInventoryHistory(output, knopPath);
    }
    return output;
  };

  if (
    payloadLayout.isNewHistory ||
    countArtifactHistoryPaths(
        meshBase,
        currentKnopInventoryTurtle,
        designatorPath,
      ) > 1
  ) {
    return applySupportHistoryPolicies(
      renderMultiHistoryPayloadWovenKnopInventoryTurtle(
        meshBase,
        designatorPath,
        payloadLayout,
        workingLocalRelativePath,
        repositorySourceFloatingLocator,
        currentKnopInventoryTurtle,
        { knopInventoryHistoryPolicy: options?.knopInventoryHistoryPolicy },
      ),
    );
  }

  const knopPath = toKnopPath(designatorPath);
  const designatorPagePath = toDesignatorResourcePagePath(designatorPath);
  const payloadStateOnePath = payloadLayout.currentStatePath!;
  const payloadStateOneManifestationPath = payloadLayout
    .currentManifestationPath!;
  const payloadStateTwoManifestationPath = payloadLayout.nextManifestationPath;
  const payloadFileName = toFileName(workingLocalRelativePath);
  const currentWorkingFileLocator = renderCurrentWorkingFileLocator(
    workingLocalRelativePath,
    repositorySourceFloatingLocator,
  );
  const currentWorkingFileDeclaration = renderCurrentWorkingFileDeclaration(
    workingLocalRelativePath,
    repositorySourceFloatingLocator,
  );

  return applySupportHistoryPolicies(`@base <${meshBase}> .
${SFLO_TURTLE_PREFIX_DECLARATION}
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

<${knopPath}> a sflo:Knop ;
  sflo:hasKnopMetadata <${knopPath}/_meta> ;
  sflo:hasKnopInventory <${knopPath}/_inventory> ;
  sflo:hasWorkingKnopInventoryFile <${knopPath}/_inventory/inventory.ttl> ;
  sflo:hasPayloadArtifact <${designatorPath}> ;
  sflo:hasResourcePage <${knopPath}/index.html> .

<${designatorPath}> a sflo:PayloadArtifact, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasArtifactHistory <${payloadLayout.historyPath}> ;
  sflo:currentArtifactHistory <${payloadLayout.historyPath}> ;
  sflo:nextHistoryOrdinal "2"^^xsd:nonNegativeInteger ;
  ${currentWorkingFileLocator}
  sflo:hasResourcePage <${designatorPagePath}> .

<${payloadLayout.historyPath}> a sflo:ArtifactHistory ;
  sflo:historyOrdinal "1"^^xsd:nonNegativeInteger ;
  sflo:hasHistoricalState <${payloadStateOnePath}> ;
  sflo:hasHistoricalState <${payloadLayout.nextStatePath}> ;
  sflo:latestHistoricalState <${payloadLayout.nextStatePath}> ;
  sflo:nextStateOrdinal "3"^^xsd:nonNegativeInteger ;
  sflo:hasResourcePage <${payloadLayout.historyPath}/index.html> .

<${payloadStateOnePath}> a sflo:HistoricalState ;
  sflo:stateOrdinal "1"^^xsd:nonNegativeInteger ;
  sflo:hasManifestation <${payloadStateOneManifestationPath}> ;
  sflo:locatedFileForState <${payloadStateOneManifestationPath}/${payloadFileName}> ;
  sflo:hasResourcePage <${payloadStateOnePath}/index.html> .

<${payloadStateOneManifestationPath}> a sflo:ArtifactManifestation, sflo:RdfDocument ;
  sflo:locatedFileForManifestation <${payloadStateOneManifestationPath}/${payloadFileName}> ;
  sflo:hasResourcePage <${payloadStateOneManifestationPath}/index.html> .

<${payloadLayout.nextStatePath}> a sflo:HistoricalState ;
  sflo:stateOrdinal "2"^^xsd:nonNegativeInteger ;
  sflo:previousHistoricalState <${payloadStateOnePath}> ;
  sflo:hasManifestation <${payloadStateTwoManifestationPath}> ;
  sflo:locatedFileForState <${payloadStateTwoManifestationPath}/${payloadFileName}> ;
  sflo:hasResourcePage <${payloadLayout.nextStatePath}/index.html> .

<${payloadStateTwoManifestationPath}> a sflo:ArtifactManifestation, sflo:RdfDocument ;
  sflo:locatedFileForManifestation <${payloadStateTwoManifestationPath}/${payloadFileName}> ;
  sflo:hasResourcePage <${payloadStateTwoManifestationPath}/index.html> .

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

<${knopPath}/_meta/meta.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<${knopPath}/_inventory/inventory.ttl> a sflo:LocatedFile, sflo:RdfDocument .

${currentWorkingFileDeclaration}

<${payloadStateOneManifestationPath}/${payloadFileName}> a sflo:LocatedFile, sflo:RdfDocument .

<${payloadStateTwoManifestationPath}/${payloadFileName}> a sflo:LocatedFile, sflo:RdfDocument .

<${knopPath}/_meta/_history001/_s0001/ttl/meta.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<${knopPath}/_inventory/_history001/_s0001/ttl/inventory.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<${knopPath}/_inventory/_history001/_s0002/ttl/inventory.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<${designatorPagePath}> a sflo:ResourcePage, sflo:LocatedFile .

<${payloadLayout.historyPath}/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${payloadStateOnePath}/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${payloadStateOneManifestationPath}/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${payloadLayout.nextStatePath}/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${payloadStateTwoManifestationPath}/index.html> a sflo:ResourcePage, sflo:LocatedFile .

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
`);
}

function countArtifactHistoryPaths(
  meshBase: string,
  currentKnopInventoryTurtle: string,
  artifactPath: string,
): number {
  const quads = parseWeaveShapeQuads(
    meshBase,
    currentKnopInventoryTurtle,
    `Could not parse the current KnopInventory while counting histories for ${artifactPath}.`,
  );
  return resolveNamedNodeObjectPaths(
    quads,
    meshBase,
    artifactPath,
    SFLO_HAS_ARTIFACT_HISTORY_IRI,
    `Could not resolve histories for ${artifactPath}.`,
  ).length;
}

function collectRenderedArtifactHistories(
  meshBase: string,
  quads: readonly Quad[],
  artifactPath: string,
  errorMessage: string,
  stateLocatedFileFallback?: HistoricalStateLocatedFileFallback,
): RenderedArtifactHistoryModel[] {
  return resolveNamedNodeObjectPaths(
    quads,
    meshBase,
    artifactPath,
    SFLO_HAS_ARTIFACT_HISTORY_IRI,
    errorMessage,
  ).sort((left, right) => left.localeCompare(right)).map((historyPath) => {
    const historyIri = toAbsoluteIri(meshBase, historyPath);
    const latestStatePath = resolveOptionalNamedNodePath(
      quads,
      meshBase,
      historyPath,
      SFLO_LATEST_HISTORICAL_STATE_IRI,
      errorMessage,
    );
    const nextStateOrdinal = resolveOptionalNonNegativeIntegerLiteral(
      quads,
      historyIri,
      SFLO_NEXT_STATE_ORDINAL_IRI,
      errorMessage,
    );
    const historyOrdinal = resolveOptionalNonNegativeIntegerLiteral(
      quads,
      historyIri,
      `${SFLO_NAMESPACE}historyOrdinal`,
      errorMessage,
    );
    const states = resolveNamedNodeObjectPaths(
      quads,
      meshBase,
      historyPath,
      SFLO_HAS_HISTORICAL_STATE_IRI,
      errorMessage,
    ).sort((left, right) => left.localeCompare(right)).map((statePath) =>
      collectRenderedHistoricalState(
        meshBase,
        quads,
        statePath,
        errorMessage,
        stateLocatedFileFallback,
      )
    );

    return {
      path: historyPath,
      ...(historyOrdinal === undefined ? {} : { historyOrdinal }),
      ...(latestStatePath === undefined ? {} : { latestStatePath }),
      ...(nextStateOrdinal === undefined ? {} : { nextStateOrdinal }),
      states,
    };
  });
}

function collectRenderedHistoricalState(
  meshBase: string,
  quads: readonly Quad[],
  statePath: string,
  errorMessage: string,
  stateLocatedFileFallback?: HistoricalStateLocatedFileFallback,
): RenderedHistoricalStateModel {
  const stateIri = toAbsoluteIri(meshBase, statePath);
  const manifestationPath = resolveOptionalNamedNodePath(
    quads,
    meshBase,
    statePath,
    SFLO_HAS_MANIFESTATION_IRI,
    errorMessage,
  );
  const stateLocatedFilePath = resolveOptionalNamedNodePath(
    quads,
    meshBase,
    statePath,
    `${SFLO_NAMESPACE}locatedFileForState`,
    errorMessage,
  );
  const manifestationLocatedFilePath = manifestationPath
    ? resolveOptionalNamedNodePath(
      quads,
      meshBase,
      manifestationPath,
      `${SFLO_NAMESPACE}locatedFileForManifestation`,
      errorMessage,
    )
    : undefined;
  const fallbackManifestationPath = stateLocatedFileFallback
    ? `${statePath}/${stateLocatedFileFallback.manifestationSegment}`
    : undefined;
  const manifestationPathWithFallback = manifestationPath ??
    fallbackManifestationPath;
  const fallbackLocatedFilePath = stateLocatedFileFallback
    ? `${manifestationPathWithFallback}/${stateLocatedFileFallback.fileName}`
    : undefined;
  const locatedFilePath = stateLocatedFilePath ??
    manifestationLocatedFilePath ??
    fallbackLocatedFilePath;
  if (!manifestationPathWithFallback || !locatedFilePath) {
    throw new WeaveInputError(errorMessage);
  }
  const previousStatePath = resolveOptionalNamedNodePath(
    quads,
    meshBase,
    statePath,
    `${SFLO_NAMESPACE}previousHistoricalState`,
    errorMessage,
  );
  const stateOrdinal = resolveOptionalNonNegativeIntegerLiteral(
    quads,
    stateIri,
    `${SFLO_NAMESPACE}stateOrdinal`,
    errorMessage,
  );

  return {
    path: statePath,
    ...(stateOrdinal === undefined ? {} : { stateOrdinal }),
    ...(previousStatePath === undefined ? {} : { previousStatePath }),
    manifestationPath: manifestationPathWithFallback,
    locatedFilePath,
  };
}

function upsertRenderedArtifactHistoryState(
  histories: RenderedArtifactHistoryModel[],
  state: {
    historyPath: string;
    statePath: string;
    manifestationPath: string;
    locatedFilePath: string;
    previousStatePath?: string;
    stateOrdinal?: number;
  },
): void {
  let history = histories.find((candidate) =>
    candidate.path === state.historyPath
  );
  if (!history) {
    history = {
      path: state.historyPath,
      ...(parseOptionalHistoryOrdinalFromPath(state.historyPath) === undefined
        ? {}
        : {
          historyOrdinal: parseOptionalHistoryOrdinalFromPath(
            state.historyPath,
          ),
        }),
      states: [],
    };
    histories.push(history);
    histories.sort((left, right) => left.path.localeCompare(right.path));
  }
  if (history.states.some((candidate) => candidate.path === state.statePath)) {
    throw new WeaveInputError(
      `Historical state already exists: ${state.statePath}`,
    );
  }
  history.states.push({
    path: state.statePath,
    ...(state.stateOrdinal === undefined
      ? {}
      : { stateOrdinal: state.stateOrdinal }),
    ...(state.previousStatePath === undefined
      ? {}
      : { previousStatePath: state.previousStatePath }),
    manifestationPath: state.manifestationPath,
    locatedFilePath: state.locatedFilePath,
  });
  history.states.sort((left, right) => left.path.localeCompare(right.path));
  history.latestStatePath = state.statePath;
  history.nextStateOrdinal = state.stateOrdinal === undefined
    ? history.nextStateOrdinal ?? 1
    : state.stateOrdinal + 1;
}

function requireCurrentRenderedHistory(
  meshBase: string,
  quads: readonly Quad[],
  artifactPath: string,
  histories: readonly RenderedArtifactHistoryModel[],
  errorMessage: string,
): RenderedArtifactHistoryModel {
  const currentHistoryPath = resolveOptionalNamedNodePath(
    quads,
    meshBase,
    artifactPath,
    SFLO_CURRENT_ARTIFACT_HISTORY_IRI,
    errorMessage,
  );
  const history = histories.find((candidate) =>
    candidate.path === currentHistoryPath
  );
  if (!history) {
    throw new WeaveInputError(errorMessage);
  }
  return history;
}

function renderRenderedArtifactHistoryBlock(
  history: RenderedArtifactHistoryModel,
): string {
  const predicates = [
    ...(history.historyOrdinal === undefined ? [] : [
      `sflo:historyOrdinal "${history.historyOrdinal}"^^xsd:nonNegativeInteger`,
    ]),
    ...history.states.map((state) => `sflo:hasHistoricalState <${state.path}>`),
    ...(history.latestStatePath === undefined
      ? []
      : [`sflo:latestHistoricalState <${history.latestStatePath}>`]),
    ...(history.nextStateOrdinal === undefined ? [] : [
      `sflo:nextStateOrdinal "${history.nextStateOrdinal}"^^xsd:nonNegativeInteger`,
    ]),
    `sflo:hasResourcePage <${history.path}/index.html>`,
  ];
  return renderSubjectPredicateBlock(
    history.path,
    "sflo:ArtifactHistory",
    predicates,
  );
}

function renderRenderedHistoricalStateBlock(
  state: RenderedHistoricalStateModel,
): string {
  const predicates = [
    ...(state.stateOrdinal === undefined
      ? []
      : [`sflo:stateOrdinal "${state.stateOrdinal}"^^xsd:nonNegativeInteger`]),
    ...(state.previousStatePath === undefined
      ? []
      : [`sflo:previousHistoricalState <${state.previousStatePath}>`]),
    `sflo:hasManifestation <${state.manifestationPath}>`,
    `sflo:locatedFileForState <${state.locatedFilePath}>`,
    `sflo:hasResourcePage <${state.path}/index.html>`,
  ];
  return renderSubjectPredicateBlock(
    state.path,
    "sflo:HistoricalState",
    predicates,
  );
}

function renderRenderedManifestationBlock(
  state: RenderedHistoricalStateModel,
): string {
  return renderSubjectPredicateBlock(
    state.manifestationPath,
    "sflo:ArtifactManifestation, sflo:RdfDocument",
    [
      `sflo:locatedFileForManifestation <${state.locatedFilePath}>`,
      `sflo:hasResourcePage <${state.manifestationPath}/index.html>`,
    ],
  );
}

function renderRenderedHistoryResourcePageBlocks(
  histories: readonly RenderedArtifactHistoryModel[],
): string {
  return histories.flatMap((history) => [
    `<${history.path}/index.html> a sflo:ResourcePage, sflo:LocatedFile .`,
    ...history.states.flatMap((state) => [
      `<${state.path}/index.html> a sflo:ResourcePage, sflo:LocatedFile .`,
      `<${state.manifestationPath}/index.html> a sflo:ResourcePage, sflo:LocatedFile .`,
    ]),
  ]).join("\n\n");
}

function toFileName(path: string): string {
  const segments = path.split("/");
  return segments[segments.length - 1]!;
}

function parseOptionalHistoryOrdinalFromPath(
  historyPath: string,
): number | undefined {
  const match = toLastPathSegment(historyPath).match(/^_history(\d+)$/);
  const parsed = match ? Number(match[1]) : Number.NaN;

  return Number.isInteger(parsed) && parsed >= 1 ? parsed : undefined;
}

function toStateSegment(stateOrdinal: number): string {
  return `_s${String(stateOrdinal).padStart(4, "0")}`;
}

function toLastPathSegment(path: string): string {
  const slashIndex = path.lastIndexOf("/");
  return slashIndex === -1 ? path : path.slice(slashIndex + 1);
}
