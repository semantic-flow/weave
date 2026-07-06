import {
  formatDesignatorPathForDisplay,
  toDesignatorResourcePagePath,
  toKnopPath,
  toReferenceCatalogPath,
} from "../designator_segments.ts";
import { toArtifactManifestationPath } from "./artifact_manifestation_paths.ts";
import type { PayloadVersionLayout } from "./payload_version_layout.ts";
import type {
  MeshInventoryProgression,
  PageDefinitionWeaveProgression,
} from "./progression_models.ts";
import type {
  IdentifierResourcePageModel,
  ReferenceCatalogCurrentLinkModel,
  ReferenceCatalogResourcePageModel,
  ResourcePageModel,
  SimpleResourcePageModel,
} from "./resource_page_models.ts";
import type { RepositorySourceFloatingLocator } from "./source_models.ts";
import {
  shouldMaterializeSupportHistory,
  type SupportArtifactHistoryPolicy,
} from "./support_history_policy.ts";

export function buildFirstKnopWeavePages(
  designatorPath: string,
  meshInventoryProgression: MeshInventoryProgression | undefined,
  options?: { knopMetadataHistoryPolicy?: SupportArtifactHistoryPolicy },
): readonly ResourcePageModel[] {
  const knopPath = toKnopPath(designatorPath);
  const designatorPagePath = toDesignatorResourcePagePath(designatorPath);
  const displayDesignatorPath = formatDesignatorPathForDisplay(designatorPath);

  const pages: readonly ResourcePageModel[] = [
    ...(meshInventoryProgression === undefined
      ? []
      : buildMeshInventoryProgressionPages(meshInventoryProgression)),
    identifierPage(designatorPagePath, designatorPath),
    simplePage(
      `${knopPath}/index.html`,
      `Resource page for the Knop associated with the ${displayDesignatorPath} designator.`,
    ),
    simplePage(
      `${knopPath}/_meta/index.html`,
      `Resource page for the ${displayDesignatorPath} KnopMetadata artifact.`,
    ),
    simplePage(
      `${knopPath}/_meta/_history001/index.html`,
      `Resource page for the current explicit history of the ${displayDesignatorPath} KnopMetadata artifact.`,
    ),
    simplePage(
      `${knopPath}/_meta/_history001/_s0001/index.html`,
      `Resource page for the first ${displayDesignatorPath} KnopMetadata historical state.`,
    ),
    simplePage(
      `${knopPath}/_meta/_history001/_s0001/ttl/index.html`,
      `Resource page for the Turtle manifestation of the first ${displayDesignatorPath} KnopMetadata historical state.`,
    ),
    simplePage(
      `${knopPath}/_inventory/index.html`,
      `Resource page for the ${displayDesignatorPath} KnopInventory artifact.`,
    ),
    simplePage(
      `${knopPath}/_inventory/_history001/index.html`,
      `Resource page for the current explicit history of the ${displayDesignatorPath} KnopInventory artifact.`,
    ),
    simplePage(
      `${knopPath}/_inventory/_history001/_s0001/index.html`,
      `Resource page for the first ${displayDesignatorPath} KnopInventory historical state.`,
    ),
    simplePage(
      `${knopPath}/_inventory/_history001/_s0001/ttl/index.html`,
      `Resource page for the Turtle manifestation of the first ${displayDesignatorPath} KnopInventory historical state.`,
    ),
  ];
  return shouldMaterializeSupportHistory(
      options?.knopMetadataHistoryPolicy ?? "versioned",
    )
    ? pages
    : omitInitialKnopMetadataHistoryPages(pages, knopPath);
}

export function buildFirstPayloadWeavePages(
  designatorPath: string,
  payloadLayout: PayloadVersionLayout,
  workingLocalRelativePath: string,
  meshInventoryProgression: MeshInventoryProgression | undefined,
  options?: {
    workingAccessUrl?: string;
    repositorySourceFloatingLocator?: RepositorySourceFloatingLocator;
    knopMetadataHistoryPolicy?: SupportArtifactHistoryPolicy;
    knopInventoryHistoryPolicy?: SupportArtifactHistoryPolicy;
  },
): readonly ResourcePageModel[] {
  const knopPath = toKnopPath(designatorPath);
  const designatorPagePath = toDesignatorResourcePagePath(designatorPath);
  const displayDesignatorPath = formatDesignatorPathForDisplay(designatorPath);

  const pages: readonly ResourcePageModel[] = [
    ...(meshInventoryProgression === undefined
      ? []
      : buildMeshInventoryProgressionPages(meshInventoryProgression)),
    identifierPage(
      designatorPagePath,
      designatorPath,
      {
        workingLocalRelativePath,
        workingAccessUrl: options?.workingAccessUrl,
        repositorySourceFloatingLocator: options
          ?.repositorySourceFloatingLocator,
      },
    ),
    simplePage(
      `${payloadLayout.historyPath}/index.html`,
      `Resource page for the current explicit history of the ${displayDesignatorPath} payload artifact.`,
    ),
    simplePage(
      `${payloadLayout.nextStatePath}/index.html`,
      `Resource page for the first historical state of the ${displayDesignatorPath} payload artifact.`,
    ),
    simplePage(
      `${payloadLayout.nextManifestationPath}/index.html`,
      `Resource page for the Turtle manifestation of the first ${displayDesignatorPath} payload historical state.`,
    ),
    simplePage(
      `${knopPath}/index.html`,
      `Resource page for the Knop associated with the ${displayDesignatorPath} designator.`,
    ),
    simplePage(
      `${knopPath}/_meta/index.html`,
      `Resource page for the ${displayDesignatorPath} KnopMetadata artifact.`,
    ),
    simplePage(
      `${knopPath}/_meta/_history001/index.html`,
      `Resource page for the current explicit history of the ${displayDesignatorPath} KnopMetadata artifact.`,
    ),
    simplePage(
      `${knopPath}/_meta/_history001/_s0001/index.html`,
      `Resource page for the first ${displayDesignatorPath} KnopMetadata historical state.`,
    ),
    simplePage(
      `${knopPath}/_meta/_history001/_s0001/ttl/index.html`,
      `Resource page for the Turtle manifestation of the first ${displayDesignatorPath} KnopMetadata historical state.`,
    ),
    simplePage(
      `${knopPath}/_inventory/index.html`,
      `Resource page for the ${displayDesignatorPath} KnopInventory artifact.`,
    ),
    simplePage(
      `${knopPath}/_inventory/_history001/index.html`,
      `Resource page for the current explicit history of the ${displayDesignatorPath} KnopInventory artifact.`,
    ),
    simplePage(
      `${knopPath}/_inventory/_history001/_s0001/index.html`,
      `Resource page for the first ${displayDesignatorPath} KnopInventory historical state.`,
    ),
    simplePage(
      `${knopPath}/_inventory/_history001/_s0001/ttl/index.html`,
      `Resource page for the Turtle manifestation of the first ${displayDesignatorPath} KnopInventory historical state.`,
    ),
  ];
  let outputPages = pages;
  if (
    !shouldMaterializeSupportHistory(
      options?.knopMetadataHistoryPolicy ?? "versioned",
    )
  ) {
    outputPages = omitInitialKnopMetadataHistoryPages(outputPages, knopPath);
  }
  if (
    !shouldMaterializeSupportHistory(
      options?.knopInventoryHistoryPolicy ?? "versioned",
    )
  ) {
    outputPages = omitInitialKnopInventoryHistoryPages(outputPages, knopPath);
  }
  return outputPages;
}

export function buildFirstExtractedKnopWeavePages(
  designatorPath: string,
  meshInventoryProgression: MeshInventoryProgression | undefined,
  options?: {
    knopMetadataHistoryPolicy?: SupportArtifactHistoryPolicy;
    knopInventoryHistoryPolicy?: SupportArtifactHistoryPolicy;
  },
): readonly ResourcePageModel[] {
  const knopPath = toKnopPath(designatorPath);
  const displayDesignatorPath = formatDesignatorPathForDisplay(designatorPath);
  const versionKnopMetadata = shouldMaterializeSupportHistory(
    options?.knopMetadataHistoryPolicy ?? "versioned",
  );
  const versionKnopInventory = shouldMaterializeSupportHistory(
    options?.knopInventoryHistoryPolicy ?? "versioned",
  );

  return [
    ...(meshInventoryProgression === undefined ? [] : [
      simplePage(
        `${meshInventoryProgression.nextStatePath}/index.html`,
        `Resource page for the ${
          toOrdinalLabel(meshInventoryProgression.nextStateOrdinal)
        } MeshInventory historical state.`,
      ),
      simplePage(
        `${meshInventoryProgression.nextStatePath}/ttl/index.html`,
        `Resource page for the Turtle manifestation of the ${
          toOrdinalLabel(meshInventoryProgression.nextStateOrdinal)
        } MeshInventory historical state.`,
      ),
    ]),
    simplePage(
      `${knopPath}/index.html`,
      `Resource page for the Knop associated with the ${displayDesignatorPath} designator.`,
    ),
    simplePage(
      `${knopPath}/_meta/index.html`,
      `Resource page for the ${displayDesignatorPath} KnopMetadata artifact.`,
    ),
    ...(versionKnopMetadata
      ? [
        simplePage(
          `${knopPath}/_meta/_history001/_s0001/index.html`,
          `Resource page for the first ${displayDesignatorPath} KnopMetadata historical state.`,
        ),
        simplePage(
          `${knopPath}/_meta/_history001/_s0001/ttl/index.html`,
          `Resource page for the Turtle manifestation of the first ${displayDesignatorPath} KnopMetadata historical state.`,
        ),
      ]
      : []),
    simplePage(
      `${knopPath}/_inventory/index.html`,
      `Resource page for the ${displayDesignatorPath} KnopInventory artifact.`,
    ),
    ...(versionKnopInventory
      ? [
        simplePage(
          `${knopPath}/_inventory/_history001/_s0001/index.html`,
          `Resource page for the first ${displayDesignatorPath} KnopInventory historical state.`,
        ),
        simplePage(
          `${knopPath}/_inventory/_history001/_s0001/ttl/index.html`,
          `Resource page for the Turtle manifestation of the first ${displayDesignatorPath} KnopInventory historical state.`,
        ),
      ]
      : []),
  ];
}

export function buildFirstReferenceCatalogWeavePages(
  designatorPath: string,
  workingLocalRelativePath: string,
  currentLinks: readonly ReferenceCatalogCurrentLinkModel[],
): readonly ResourcePageModel[] {
  const knopPath = toKnopPath(designatorPath);
  const referenceCatalogPath = toReferenceCatalogPath(designatorPath);
  const displayDesignatorPath = formatDesignatorPathForDisplay(designatorPath);
  const referenceCatalogManifestationPath = toArtifactManifestationPath(
    `${referenceCatalogPath}/_history001/_s0001`,
    workingLocalRelativePath,
  );

  return [
    simplePage(
      `${knopPath}/_inventory/_history001/_s0002/index.html`,
      `Resource page for the second ${displayDesignatorPath} KnopInventory historical state.`,
    ),
    simplePage(
      `${knopPath}/_inventory/_history001/_s0002/ttl/index.html`,
      `Resource page for the Turtle manifestation of the second ${displayDesignatorPath} KnopInventory historical state.`,
    ),
    referenceCatalogPage(
      `${referenceCatalogPath}/index.html`,
      referenceCatalogPath,
      designatorPath,
      currentLinks,
    ),
    simplePage(
      `${referenceCatalogPath}/_history001/index.html`,
      `Resource page for the current explicit history of the ${displayDesignatorPath} ReferenceCatalog artifact.`,
    ),
    simplePage(
      `${referenceCatalogPath}/_history001/_s0001/index.html`,
      `Resource page for the first ${displayDesignatorPath} ReferenceCatalog historical state.`,
    ),
    simplePage(
      `${referenceCatalogManifestationPath}/index.html`,
      `Resource page for the Turtle manifestation of the first ${displayDesignatorPath} ReferenceCatalog historical state.`,
    ),
  ];
}

export function buildCurrentOnlyReferenceCatalogWeavePages(
  designatorPath: string,
  currentLinks: readonly ReferenceCatalogCurrentLinkModel[],
): readonly ResourcePageModel[] {
  const referenceCatalogPath = toReferenceCatalogPath(designatorPath);

  return [
    referenceCatalogPage(
      `${referenceCatalogPath}/index.html`,
      referenceCatalogPath,
      designatorPath,
      currentLinks,
    ),
  ];
}

export function buildSubsequentPageDefinitionWeavePages(
  designatorPath: string,
  progression: PageDefinitionWeaveProgression,
  knopInventoryProgression: MeshInventoryProgression,
): readonly ResourcePageModel[] {
  const knopPath = toKnopPath(designatorPath);
  const designatorPagePath = toDesignatorResourcePagePath(designatorPath);
  const displayDesignatorPath = formatDesignatorPathForDisplay(designatorPath);
  const pageDefinitionPath = `${knopPath}/_page`;

  return [
    identifierPage(designatorPagePath, designatorPath),
    simplePage(
      `${knopInventoryProgression.nextStatePath}/index.html`,
      `Resource page for the ${
        toOrdinalLabel(knopInventoryProgression.nextStateOrdinal)
      } ${displayDesignatorPath} KnopInventory historical state.`,
    ),
    simplePage(
      `${knopInventoryProgression.nextStatePath}/ttl/index.html`,
      `Resource page for the Turtle manifestation of the ${
        toOrdinalLabel(knopInventoryProgression.nextStateOrdinal)
      } ${displayDesignatorPath} KnopInventory historical state.`,
    ),
    simplePage(
      `${pageDefinitionPath}/index.html`,
      `Resource page for the ${displayDesignatorPath} ResourcePageDefinition artifact.`,
    ),
    simplePage(
      `${progression.historyPath}/index.html`,
      `Resource page for the current explicit history of the ${displayDesignatorPath} ResourcePageDefinition artifact.`,
    ),
    simplePage(
      `${progression.nextStatePath}/index.html`,
      `Resource page for the ${
        toOrdinalLabel(progression.nextStateOrdinal)
      } ${displayDesignatorPath} ResourcePageDefinition historical state.`,
    ),
    simplePage(
      `${progression.nextManifestationPath}/index.html`,
      `Resource page for the Turtle manifestation of the ${
        toOrdinalLabel(progression.nextStateOrdinal)
      } ${displayDesignatorPath} ResourcePageDefinition historical state.`,
    ),
  ];
}

export function buildCurrentOnlyPageDefinitionWeavePages(
  designatorPath: string,
): readonly ResourcePageModel[] {
  const knopPath = toKnopPath(designatorPath);
  const designatorPagePath = toDesignatorResourcePagePath(designatorPath);
  const displayDesignatorPath = formatDesignatorPathForDisplay(designatorPath);

  return [
    identifierPage(designatorPagePath, designatorPath),
    simplePage(
      `${knopPath}/_page/index.html`,
      `Resource page for the ${displayDesignatorPath} ResourcePageDefinition artifact.`,
    ),
  ];
}

export function buildLaterPayloadWeavePages(
  designatorPath: string,
  payloadLayout: PayloadVersionLayout,
  options?: { knopInventoryProgression?: MeshInventoryProgression },
): readonly ResourcePageModel[] {
  const displayDesignatorPath = formatDesignatorPathForDisplay(designatorPath);
  const payloadStateOrdinalLabel = payloadLayout.nextStateOrdinal === undefined
    ? "requested"
    : toOrdinalLabel(payloadLayout.nextStateOrdinal);
  const knopInventoryProgression = options?.knopInventoryProgression;
  const knopInventoryStateOrdinalLabel = knopInventoryProgression === undefined
    ? undefined
    : toOrdinalLabel(knopInventoryProgression.nextStateOrdinal);
  const pages: readonly ResourcePageModel[] = [
    simplePage(
      `${payloadLayout.nextStatePath}/index.html`,
      `Resource page for the ${payloadStateOrdinalLabel} historical state of the ${displayDesignatorPath} payload artifact.`,
    ),
    simplePage(
      `${payloadLayout.nextManifestationPath}/index.html`,
      `Resource page for the Turtle manifestation of the ${payloadStateOrdinalLabel} ${displayDesignatorPath} payload historical state.`,
    ),
    ...(knopInventoryProgression === undefined ? [] : [
      simplePage(
        `${knopInventoryProgression.nextStatePath}/index.html`,
        `Resource page for the ${knopInventoryStateOrdinalLabel} historical state of the ${displayDesignatorPath} KnopInventory artifact.`,
      ),
      simplePage(
        `${knopInventoryProgression.nextStatePath}/ttl/index.html`,
        `Resource page for the Turtle manifestation of the ${knopInventoryStateOrdinalLabel} ${displayDesignatorPath} KnopInventory historical state.`,
      ),
    ]),
  ];
  return pages;
}

function buildMeshInventoryProgressionPages(
  meshInventoryProgression: MeshInventoryProgression,
): readonly ResourcePageModel[] {
  const meshInventoryStateOrdinalLabel = toOrdinalLabel(
    meshInventoryProgression.nextStateOrdinal,
  );
  return [
    simplePage(
      `${meshInventoryProgression.nextStatePath}/index.html`,
      `Resource page for the ${meshInventoryStateOrdinalLabel} MeshInventory historical state.`,
    ),
    simplePage(
      `${meshInventoryProgression.nextStatePath}/ttl/index.html`,
      `Resource page for the Turtle manifestation of the ${meshInventoryStateOrdinalLabel} MeshInventory historical state.`,
    ),
  ];
}

function omitInitialKnopMetadataHistoryPages(
  pages: readonly ResourcePageModel[],
  knopPath: string,
): readonly ResourcePageModel[] {
  const metadataHistoryPagePrefix = `${knopPath}/_meta/_history001`;
  return pages.filter((page) =>
    page.path !== `${metadataHistoryPagePrefix}/index.html` &&
    !page.path.startsWith(`${metadataHistoryPagePrefix}/_s0001/`)
  );
}

function omitInitialKnopInventoryHistoryPages(
  pages: readonly ResourcePageModel[],
  knopPath: string,
): readonly ResourcePageModel[] {
  const inventoryHistoryPagePrefix = `${knopPath}/_inventory/_history001`;
  return pages.filter((page) =>
    page.path !== `${inventoryHistoryPagePrefix}/index.html` &&
    !page.path.startsWith(`${inventoryHistoryPagePrefix}/_s0001/`)
  );
}

function identifierPage(
  path: string,
  designatorPath: string,
  source?: {
    workingLocalRelativePath?: string;
    workingAccessUrl?: string;
    repositorySourceFloatingLocator?: RepositorySourceFloatingLocator;
  },
): IdentifierResourcePageModel {
  return {
    kind: "identifier",
    path,
    designatorPath,
    ...(source?.workingLocalRelativePath
      ? { workingLocalRelativePath: source.workingLocalRelativePath }
      : {}),
    ...(source?.workingAccessUrl
      ? { workingAccessUrl: source.workingAccessUrl }
      : {}),
    ...(source?.repositorySourceFloatingLocator
      ? {
        repositorySourceFloatingLocator: source.repositorySourceFloatingLocator,
      }
      : {}),
  };
}

function simplePage(
  path: string,
  description: string,
): SimpleResourcePageModel {
  return {
    kind: "simple",
    path,
    description,
  };
}

function referenceCatalogPage(
  path: string,
  catalogPath: string,
  ownerDesignatorPath: string,
  currentLinks: readonly ReferenceCatalogCurrentLinkModel[],
): ReferenceCatalogResourcePageModel {
  return {
    kind: "referenceCatalog",
    path,
    catalogPath,
    ownerDesignatorPath,
    currentLinks,
  };
}

function toOrdinalLabel(value: number): string {
  switch (value) {
    case 1:
      return "first";
    case 2:
      return "second";
    case 3:
      return "third";
    case 4:
      return "fourth";
    case 5:
      return "fifth";
    case 6:
      return "sixth";
    case 7:
      return "seventh";
    case 8:
      return "eighth";
    case 9:
      return "ninth";
    case 10:
      return "tenth";
    default:
      return `${value}${toOrdinalSuffix(value)}`;
  }
}

function toOrdinalSuffix(value: number): string {
  const mod100 = value % 100;
  if (mod100 >= 11 && mod100 <= 13) {
    return "th";
  }

  switch (value % 10) {
    case 1:
      return "st";
    case 2:
      return "nd";
    case 3:
      return "rd";
    default:
      return "th";
  }
}
