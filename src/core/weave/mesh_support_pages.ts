import { Parser } from "n3";
import type { Quad } from "n3";
import { SFLO_NAMESPACE } from "../rdf/namespaces.ts";
import { WeaveInputError } from "./errors.ts";
import {
  type MeshSupportHistoryPolicies,
  shouldMaterializeSupportHistory as shouldMaterializeSupportHistoryPolicy,
  type SupportArtifactHistoryPolicy,
} from "./support_history_policy.ts";
import {
  filterResourcePageFactsFromPlannedFiles,
  type WeaveResourcePageGenerationPolicies,
} from "./resource_page_policy.ts";
import type { VersionPlan } from "./version_plan.ts";

const SFLO_CURRENT_ARTIFACT_HISTORY_IRI =
  `${SFLO_NAMESPACE}currentArtifactHistory`;
const SFLO_HAS_RESOURCE_PAGE_IRI = `${SFLO_NAMESPACE}hasResourcePage`;
const XSD_TURTLE_PREFIX_DECLARATION =
  "@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .";

export interface PlanMeshSupportResourcePagesInput {
  meshBase: string;
  currentMeshInventoryTurtle: string;
  currentMeshMetadataTurtle: string;
  currentMeshConfigTurtle?: string;
  supportHistoryPolicies?: MeshSupportHistoryPolicies;
  resourcePageGenerationPolicies?: WeaveResourcePageGenerationPolicies;
}

export type {
  MeshSupportHistoryPolicies,
  SupportArtifactHistoryPolicy,
} from "./support_history_policy.ts";

interface MeshSupportResource {
  path: string;
  pagePath: string;
  description: string;
  historyPolicy?: SupportArtifactHistoryPolicy;
  historyPath?: string;
  statePath?: string;
  manifestationPath?: string;
  snapshotPath?: string;
  currentTurtle?: string;
}

export function planMeshSupportResourcePages(
  input: PlanMeshSupportResourcePagesInput,
): VersionPlan {
  const meshBase = normalizeMeshBase(input.meshBase);
  const currentMeshInventoryTurtle = input.currentMeshInventoryTurtle;
  const quads = parseWeaveShapeQuads(
    meshBase,
    currentMeshInventoryTurtle,
    "Could not parse the current MeshInventory while planning mesh support ResourcePages.",
  );
  const supportResources = buildMeshSupportResources(input, quads, meshBase);
  const versionedSupportResources = supportResources.filter(
    shouldMaterializeSupportHistory,
  );
  const needsInitialSupportHistory = versionedSupportResources.some((
    resource,
  ) =>
    !hasNamedNodeFact(
      quads,
      meshBase,
      resource.path,
      SFLO_CURRENT_ARTIFACT_HISTORY_IRI,
      resource.historyPath!,
    )
  );

  if (needsInitialSupportHistory) {
    return applyResourcePageGenerationPolicies(
      planInitialMeshSupportResourcePageWeave({
        meshBase,
        currentMeshInventoryTurtle,
        currentMeshMetadataTurtle: input.currentMeshMetadataTurtle,
        currentMeshConfigTurtle: input.currentMeshConfigTurtle,
        hasConfig: hasSubject(quads, meshBase, "_mesh/_config"),
        supportHistoryPolicies: input.supportHistoryPolicies,
      }),
      input.resourcePageGenerationPolicies,
    );
  }

  const existingPagePaths = new Set(
    supportResources
      .filter((resource) =>
        hasNamedNodeFact(
          quads,
          meshBase,
          resource.path,
          SFLO_HAS_RESOURCE_PAGE_IRI,
          resource.pagePath,
        )
      )
      .map((resource) => resource.pagePath),
  );

  if (existingPagePaths.size === supportResources.length) {
    return applyResourcePageGenerationPolicies(
      {
        meshBase,
        versionedDesignatorPaths: [],
        createdFiles: [],
        updatedFiles: [{
          path: "_mesh/_inventory/inventory.ttl",
          contents: currentMeshInventoryTurtle,
        }],
      },
      input.resourcePageGenerationPolicies,
      { omitUnchangedUpdates: true },
    );
  }

  let blocks = normalizeMeshInventoryHeader(
    splitTurtleBlocks(currentMeshInventoryTurtle),
  );
  for (const resource of supportResources) {
    if (findSubjectBlockIndex(blocks, resource.path) === -1) {
      throw new WeaveInputError(
        `Current mesh inventory did not contain support resource <${resource.path}>.`,
      );
    }
    blocks = replaceSubjectBlock(
      blocks,
      resource.path,
      appendResourcePageFactToBlock(
        blocks[findSubjectBlockIndex(blocks, resource.path)]!,
        resource.pagePath,
      ),
    );
    blocks = upsertSubjectBlockAfter(
      blocks,
      resource.path,
      resource.pagePath,
      renderResourcePageLocatedFileBlock(resource.pagePath),
    );
  }

  return applyResourcePageGenerationPolicies({
    meshBase,
    versionedDesignatorPaths: [],
    createdFiles: [],
    updatedFiles: [{
      path: "_mesh/_inventory/inventory.ttl",
      contents: `${blocks.join("\n\n")}\n`,
    }],
  }, input.resourcePageGenerationPolicies);
}

function applyResourcePageGenerationPolicies(
  plan: VersionPlan,
  policies?: WeaveResourcePageGenerationPolicies,
  options: { omitUnchangedUpdates?: boolean } = {},
): VersionPlan {
  const updatedFiles = filterResourcePageFactsFromPlannedFiles(
    plan.meshBase,
    plan.updatedFiles,
    policies,
  );
  return {
    ...plan,
    createdFiles: filterResourcePageFactsFromPlannedFiles(
      plan.meshBase,
      plan.createdFiles,
      policies,
    ),
    updatedFiles: options.omitUnchangedUpdates
      ? updatedFiles.filter((file, index) =>
        file.contents !== plan.updatedFiles[index]?.contents
      )
      : updatedFiles,
  };
}

function buildMeshSupportResources(
  input: {
    currentMeshMetadataTurtle: string;
    currentMeshConfigTurtle?: string;
    supportHistoryPolicies?: MeshSupportHistoryPolicies;
  },
  quads: readonly Quad[],
  meshBase: string,
): readonly MeshSupportResource[] {
  const historyPolicies = resolveMeshSupportHistoryPolicies(
    input.supportHistoryPolicies,
  );

  return [
    {
      path: "_mesh",
      pagePath: "_mesh/index.html",
      description: "Resource page for the SemanticMesh.",
    },
    {
      path: "_mesh/_meta",
      pagePath: "_mesh/_meta/index.html",
      description: "Resource page for the current MeshMetadata artifact.",
      historyPolicy: historyPolicies.meshMetadata,
      historyPath: "_mesh/_meta/_history001",
      statePath: "_mesh/_meta/_history001/_s0001",
      manifestationPath: "_mesh/_meta/_history001/_s0001/ttl",
      snapshotPath: "_mesh/_meta/_history001/_s0001/ttl/meta.ttl",
      currentTurtle: input.currentMeshMetadataTurtle,
    },
    {
      path: "_mesh/_inventory",
      pagePath: "_mesh/_inventory/index.html",
      description: "Resource page for the current MeshInventory artifact.",
      historyPolicy: historyPolicies.meshInventory,
      historyPath: "_mesh/_inventory/_history001",
      statePath: "_mesh/_inventory/_history001/_s0001",
      manifestationPath: "_mesh/_inventory/_history001/_s0001/ttl",
      snapshotPath: "_mesh/_inventory/_history001/_s0001/ttl/inventory.ttl",
      currentTurtle: "",
    },
    ...(hasSubject(quads, meshBase, "_mesh/_config")
      ? [{
        path: "_mesh/_config",
        pagePath: "_mesh/_config/index.html",
        description: "Resource page for the current MeshConfig artifact.",
        historyPolicy: historyPolicies.config,
        historyPath: "_mesh/_config/_history001",
        statePath: "_mesh/_config/_history001/_s0001",
        manifestationPath: "_mesh/_config/_history001/_s0001/ttl",
        snapshotPath: "_mesh/_config/_history001/_s0001/ttl/config.ttl",
        currentTurtle: input.currentMeshConfigTurtle,
      }]
      : []),
  ];
}

function resolveMeshSupportHistoryPolicies(
  policies?: MeshSupportHistoryPolicies,
): Required<MeshSupportHistoryPolicies> {
  return {
    meshMetadata: policies?.meshMetadata ?? "versioned",
    meshInventory: policies?.meshInventory ?? "versioned",
    config: policies?.config ?? "versioned",
  };
}

function shouldMaterializeSupportHistory(
  resource: MeshSupportResource,
): boolean {
  return shouldMaterializeSupportHistoryPolicy(resource.historyPolicy);
}

function planInitialMeshSupportResourcePageWeave(input: {
  meshBase: string;
  currentMeshInventoryTurtle: string;
  currentMeshMetadataTurtle: string;
  currentMeshConfigTurtle?: string;
  hasConfig: boolean;
  supportHistoryPolicies?: MeshSupportHistoryPolicies;
}): VersionPlan {
  const historyPolicies = resolveMeshSupportHistoryPolicies(
    input.supportHistoryPolicies,
  );
  const supportResources: readonly MeshSupportResource[] = [
    {
      path: "_mesh/_meta",
      pagePath: "_mesh/_meta/index.html",
      description: "Resource page for the current MeshMetadata artifact.",
      historyPolicy: historyPolicies.meshMetadata,
      historyPath: "_mesh/_meta/_history001",
      statePath: "_mesh/_meta/_history001/_s0001",
      manifestationPath: "_mesh/_meta/_history001/_s0001/ttl",
      snapshotPath: "_mesh/_meta/_history001/_s0001/ttl/meta.ttl",
      currentTurtle: input.currentMeshMetadataTurtle,
    },
    {
      path: "_mesh/_inventory",
      pagePath: "_mesh/_inventory/index.html",
      description: "Resource page for the current MeshInventory artifact.",
      historyPolicy: historyPolicies.meshInventory,
      historyPath: "_mesh/_inventory/_history001",
      statePath: "_mesh/_inventory/_history001/_s0001",
      manifestationPath: "_mesh/_inventory/_history001/_s0001/ttl",
      snapshotPath: "_mesh/_inventory/_history001/_s0001/ttl/inventory.ttl",
      currentTurtle: "",
    },
    ...(input.hasConfig
      ? [{
        path: "_mesh/_config",
        pagePath: "_mesh/_config/index.html",
        description: "Resource page for the current MeshConfig artifact.",
        historyPolicy: historyPolicies.config,
        historyPath: "_mesh/_config/_history001",
        statePath: "_mesh/_config/_history001/_s0001",
        manifestationPath: "_mesh/_config/_history001/_s0001/ttl",
        snapshotPath: "_mesh/_config/_history001/_s0001/ttl/config.ttl",
        currentTurtle: input.currentMeshConfigTurtle,
      }]
      : []),
  ];
  const blocks = normalizeMeshInventoryHeader(
    splitTurtleBlocks(input.currentMeshInventoryTurtle),
  );

  for (const support of supportResources) {
    if (findSubjectBlockIndex(blocks, support.path) === -1) {
      throw new WeaveInputError(
        `Current mesh inventory did not contain support resource <${support.path}>.`,
      );
    }
    if (support.currentTurtle === undefined) {
      throw new WeaveInputError(
        `Current mesh support file was missing for <${support.path}>.`,
      );
    }
  }

  let nextBlocks = blocks;
  nextBlocks = replaceSubjectBlock(
    nextBlocks,
    "_mesh",
    appendResourcePageFactToBlock(
      nextBlocks[findSubjectBlockIndex(nextBlocks, "_mesh")]!,
      "_mesh/index.html",
    ),
  );
  nextBlocks = upsertSubjectBlockAfter(
    nextBlocks,
    "_mesh",
    "_mesh/index.html",
    renderResourcePageLocatedFileBlock("_mesh/index.html"),
  );

  for (const support of supportResources) {
    const currentBlock = appendResourcePageFactToBlock(
      nextBlocks[findSubjectBlockIndex(nextBlocks, support.path)]!,
      support.pagePath,
    );
    nextBlocks = replaceSubjectBlock(
      nextBlocks,
      support.path,
      shouldMaterializeSupportHistory(support)
        ? appendInitialSupportHistoryFactsToBlock(
          currentBlock,
          support.historyPath!,
        )
        : currentBlock,
    );
    nextBlocks = upsertSubjectBlockAfter(
      nextBlocks,
      support.path,
      support.pagePath,
      renderResourcePageLocatedFileBlock(support.pagePath),
    );

    if (!shouldMaterializeSupportHistory(support)) {
      continue;
    }

    nextBlocks = upsertSubjectBlockAfter(
      nextBlocks,
      support.path,
      support.historyPath!,
      renderInitialSupportHistoryBlock(
        support.historyPath!,
        support.statePath!,
      ),
    );
    nextBlocks = upsertSubjectBlockAfter(
      nextBlocks,
      support.historyPath!,
      support.statePath!,
      renderInitialSupportStateBlock(
        support.statePath!,
        support.manifestationPath!,
        support.snapshotPath!,
      ),
    );
    nextBlocks = upsertSubjectBlockAfter(
      nextBlocks,
      support.statePath!,
      support.manifestationPath!,
      renderInitialSupportManifestationBlock(
        support.manifestationPath!,
        support.snapshotPath!,
      ),
    );
    nextBlocks = upsertSubjectBlockAfter(
      nextBlocks,
      currentSupportWorkingFilePath(support),
      support.snapshotPath!,
      renderLocatedFileBlock(support.snapshotPath!),
    );
    nextBlocks = upsertSubjectBlockAfter(
      nextBlocks,
      support.pagePath,
      `${support.historyPath!}/index.html`,
      renderResourcePageLocatedFileBlock(`${support.historyPath!}/index.html`),
    );
    nextBlocks = upsertSubjectBlockAfter(
      nextBlocks,
      `${support.historyPath!}/index.html`,
      `${support.statePath!}/index.html`,
      renderResourcePageLocatedFileBlock(`${support.statePath!}/index.html`),
    );
    nextBlocks = upsertSubjectBlockAfter(
      nextBlocks,
      `${support.statePath!}/index.html`,
      `${support.manifestationPath!}/index.html`,
      renderResourcePageLocatedFileBlock(
        `${support.manifestationPath!}/index.html`,
      ),
    );
  }

  const updatedInventoryTurtle = `${nextBlocks.join("\n\n")}\n`;
  const versionedSupportResources = supportResources.filter(
    shouldMaterializeSupportHistory,
  );
  const versionedInventory = versionedSupportResources.find((support) =>
    support.path === "_mesh/_inventory"
  );
  const updatedMeshMetadataTurtle = versionedInventory === undefined
    ? input.currentMeshMetadataTurtle
    : renderInitialMeshMetadataWithMeshInventoryProgression(
      input.currentMeshMetadataTurtle,
      versionedInventory,
    );

  return {
    meshBase: input.meshBase,
    versionedDesignatorPaths: [],
    createdFiles: [
      ...versionedSupportResources
        .filter((support) => support.path !== "_mesh/_inventory")
        .map((support) => ({
          path: support.snapshotPath!,
          contents: support.path === "_mesh/_meta"
            ? updatedMeshMetadataTurtle
            : support.currentTurtle!,
        })),
      ...(versionedInventory === undefined ? [] : [{
        path: versionedInventory.snapshotPath!,
        contents: updatedInventoryTurtle,
      }]),
    ],
    updatedFiles: [
      ...(versionedInventory === undefined ? [] : [{
        path: "_mesh/_meta/meta.ttl",
        contents: updatedMeshMetadataTurtle,
      }]),
      {
        path: "_mesh/_inventory/inventory.ttl",
        contents: updatedInventoryTurtle,
      },
    ],
  };
}

function renderInitialMeshMetadataWithMeshInventoryProgression(
  currentMeshMetadataTurtle: string,
  versionedInventory: MeshSupportResource,
): string {
  const metadataWithPrefixes = ensureXsdPrefix(currentMeshMetadataTurtle);
  let blocks = splitTurtleBlocks(metadataWithPrefixes);
  blocks = upsertSubjectBlockAfter(
    blocks,
    "_mesh",
    "_mesh/_inventory",
    renderInitialMeshInventoryMetaProgressionBlock(versionedInventory),
  );
  blocks = upsertSubjectBlockAfter(
    blocks,
    "_mesh/_inventory",
    versionedInventory.historyPath!,
    renderInitialMeshInventoryHistoryMetaProgressionBlock(versionedInventory),
  );

  return `${blocks.join("\n\n")}\n`;
}

function renderInitialMeshInventoryMetaProgressionBlock(
  versionedInventory: MeshSupportResource,
): string {
  return `<_mesh/_inventory> a sflo:MeshInventory, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:currentArtifactHistory <${versionedInventory.historyPath!}> ;
  sflo:nextHistoryOrdinal "2"^^xsd:nonNegativeInteger .`;
}

function renderInitialMeshInventoryHistoryMetaProgressionBlock(
  versionedInventory: MeshSupportResource,
): string {
  return `<${versionedInventory.historyPath!}> a sflo:ArtifactHistory ;
  sflo:latestHistoricalState <${versionedInventory.statePath!}> ;
  sflo:nextStateOrdinal "2"^^xsd:nonNegativeInteger .`;
}

function currentSupportWorkingFilePath(support: MeshSupportResource): string {
  switch (support.path) {
    case "_mesh/_inventory":
      return "_mesh/_inventory/inventory.ttl";
    case "_mesh/_meta":
      return "_mesh/_meta/meta.ttl";
    case "_mesh/_config":
      return "_mesh/_config/config.ttl";
    default:
      throw new WeaveInputError(
        `Unsupported mesh support resource <${support.path}>.`,
      );
  }
}

function normalizeMeshBase(meshBase: string): string {
  const trimmed = meshBase.trim();
  if (trimmed.length === 0) {
    throw new WeaveInputError("meshBase is required");
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new WeaveInputError("meshBase must be an absolute IRI");
  }

  if (!url.pathname.endsWith("/")) {
    throw new WeaveInputError("meshBase must end with '/'");
  }
  if (url.search.length > 0 || url.hash.length > 0) {
    throw new WeaveInputError("meshBase must not include a query or fragment");
  }

  return url.href;
}

function parseWeaveShapeQuads(
  meshBase: string,
  turtle: string,
  errorMessage: string,
): Quad[] {
  try {
    return new Parser({ baseIRI: meshBase }).parse(turtle);
  } catch {
    throw new WeaveInputError(errorMessage);
  }
}

function hasNamedNodeFact(
  quads: readonly Quad[],
  meshBase: string,
  subjectValue: string,
  predicateIri: string,
  objectValue: string,
): boolean {
  const subjectIri = toAbsoluteIri(meshBase, subjectValue);
  const objectIri = toAbsoluteIri(meshBase, objectValue);

  return quads.some((quad) =>
    quad.subject.termType === "NamedNode" &&
    quad.subject.value === subjectIri &&
    quad.predicate.value === predicateIri &&
    quad.object.termType === "NamedNode" &&
    quad.object.value === objectIri
  );
}

function hasSubject(
  quads: readonly Quad[],
  meshBase: string,
  subjectValue: string,
): boolean {
  const subjectIri = toAbsoluteIri(meshBase, subjectValue);
  return quads.some((quad) =>
    quad.subject.termType === "NamedNode" &&
    quad.subject.value === subjectIri
  );
}

function toAbsoluteIri(meshBase: string, value: string): string {
  return new URL(value, meshBase).href;
}

function splitTurtleBlocks(turtle: string): string[] {
  return turtle.trimEnd().split("\n\n");
}

function normalizeMeshInventoryHeader(blocks: string[]): string[] {
  if (blocks.length === 0) {
    return blocks;
  }

  const [header, ...rest] = blocks;
  return [
    header.replace(
      "@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .\n",
      "",
    ),
    ...rest,
  ];
}

function ensureXsdPrefix(turtle: string): string {
  if (turtle.includes(XSD_TURTLE_PREFIX_DECLARATION)) {
    return turtle;
  }

  const lines = turtle.split("\n");
  const prefixInsertIndex = lines.findLastIndex((line) =>
    line.trimStart().startsWith("@prefix ")
  );
  if (prefixInsertIndex >= 0) {
    lines.splice(prefixInsertIndex + 1, 0, XSD_TURTLE_PREFIX_DECLARATION);
    return lines.join("\n");
  }

  const baseInsertIndex = lines.findIndex((line) =>
    line.trimStart().startsWith("@base ")
  );
  if (baseInsertIndex >= 0) {
    lines.splice(baseInsertIndex + 1, 0, XSD_TURTLE_PREFIX_DECLARATION);
    return lines.join("\n");
  }

  return `${XSD_TURTLE_PREFIX_DECLARATION}\n${turtle}`;
}

function replaceSubjectBlock(
  blocks: string[],
  subjectPath: string,
  replacementBlock: string,
): string[] {
  const index = findSubjectBlockIndex(blocks, subjectPath);
  if (index === -1) {
    throw new WeaveInputError(
      `Current mesh inventory did not contain subject block <${subjectPath}>.`,
    );
  }

  const nextBlocks = [...blocks];
  nextBlocks[index] = replacementBlock;
  return nextBlocks;
}

function upsertSubjectBlockAfter(
  blocks: string[],
  anchorSubjectPath: string,
  subjectPath: string,
  block: string,
): string[] {
  const existingIndex = findSubjectBlockIndex(blocks, subjectPath);
  if (existingIndex !== -1) {
    const nextBlocks = [...blocks];
    nextBlocks[existingIndex] = block;
    return nextBlocks;
  }

  const anchorIndex = findSubjectBlockIndex(blocks, anchorSubjectPath);
  if (anchorIndex === -1) {
    throw new WeaveInputError(
      `Current mesh inventory did not contain anchor subject block <${anchorSubjectPath}>.`,
    );
  }

  const nextBlocks = [...blocks];
  nextBlocks.splice(anchorIndex + 1, 0, block);
  return nextBlocks;
}

function findSubjectBlockIndex(
  blocks: readonly string[],
  subjectPath: string,
): number {
  return blocks.findIndex((block) =>
    getSubjectPathFromBlock(block) === subjectPath
  );
}

function getSubjectPathFromBlock(block: string): string | undefined {
  const match = block.match(/^<([^>]*)>/);
  return match?.[1];
}

function renderLocatedFileBlock(path: string): string {
  return `<${path}> a sflo:LocatedFile, sflo:RdfDocument .`;
}

function renderResourcePageLocatedFileBlock(path: string): string {
  return `<${path}> a sflo:ResourcePage, sflo:LocatedFile .`;
}

function appendResourcePageFactToBlock(
  block: string,
  pagePath: string,
): string {
  const fact = `sflo:hasResourcePage <${pagePath}>`;
  if (block.includes(fact)) {
    return block;
  }
  if (!block.endsWith(" .")) {
    throw new WeaveInputError(
      `Current mesh inventory subject block cannot receive ResourcePage fact for <${pagePath}>.`,
    );
  }
  return `${block.slice(0, -2)} ;\n  ${fact} .`;
}

function appendInitialSupportHistoryFactsToBlock(
  block: string,
  historyPath: string,
): string {
  if (block.includes("sflo:currentArtifactHistory")) {
    return block;
  }
  if (!block.endsWith(" .")) {
    throw new WeaveInputError(
      `Current mesh inventory subject block cannot receive history facts for <${historyPath}>.`,
    );
  }
  return `${
    block.slice(0, -2)
  } ;\n  sflo:hasArtifactHistory <${historyPath}> ;\n  sflo:currentArtifactHistory <${historyPath}> ;\n  sflo:nextHistoryOrdinal "2"^^xsd:nonNegativeInteger .`;
}

function renderInitialSupportHistoryBlock(
  historyPath: string,
  statePath: string,
): string {
  return `<${historyPath}> a sflo:ArtifactHistory ;
  sflo:historyOrdinal "1"^^xsd:nonNegativeInteger ;
  sflo:hasHistoricalState <${statePath}> ;
  sflo:latestHistoricalState <${statePath}> ;
  sflo:nextStateOrdinal "2"^^xsd:nonNegativeInteger ;
  sflo:hasResourcePage <${historyPath}/index.html> .`;
}

function renderInitialSupportStateBlock(
  statePath: string,
  manifestationPath: string,
  snapshotPath: string,
): string {
  return `<${statePath}> a sflo:HistoricalState ;
  sflo:stateOrdinal "1"^^xsd:nonNegativeInteger ;
  sflo:hasManifestation <${manifestationPath}> ;
  sflo:locatedFileForState <${snapshotPath}> ;
  sflo:hasResourcePage <${statePath}/index.html> .`;
}

function renderInitialSupportManifestationBlock(
  manifestationPath: string,
  snapshotPath: string,
): string {
  return `<${manifestationPath}> a sflo:ArtifactManifestation, sflo:RdfDocument ;
  sflo:locatedFileForManifestation <${snapshotPath}> ;
  sflo:hasResourcePage <${manifestationPath}/index.html> .`;
}
