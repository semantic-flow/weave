import type { Quad } from "n3";
import {
  SFLO_NAMESPACE,
  SFLO_TURTLE_PREFIX_DECLARATION,
} from "../rdf/namespaces.ts";
import { WeaveInputError as BaseWeaveInputError } from "./errors.ts";
import {
  planInventoryAppend,
  prepareCurrentInventory,
  type PreparedCurrentInventory,
  renderInventoryAppendPlan,
} from "./inventory_append_planner.ts";
import { assertNoLegacyMeshInventoryProgression } from "./mesh_inventory_progression_assertions.ts";
import {
  type MeshSupportHistoryPolicies,
  shouldMaterializeSupportHistory as shouldMaterializeSupportHistoryPolicy,
  type SupportArtifactHistoryPolicy,
} from "./support_history_policy.ts";
import {
  filterResourcePageFactsFromPlannedFiles,
  type ResourcePageGenerationConfig,
  type WeaveResourcePageGenerationPolicies,
} from "./resource_page_policy.ts";
import type { VersionPlan } from "./version_plan.ts";
import { splitTurtleBlocks, upsertSubjectBlockAfter } from "./turtle_blocks.ts";

class WeaveInputError extends BaseWeaveInputError {
  constructor(message: string) {
    super(message, "unsupported-mesh-shape");
  }
}

const SFLO_HAS_ARTIFACT_HISTORY_IRI = `${SFLO_NAMESPACE}hasArtifactHistory`;
const XSD_TURTLE_PREFIX_DECLARATION =
  "@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .";
const INITIAL_SUPPORT_SINGLE_VALUED_PREDICATES = [
  `${SFLO_NAMESPACE}historyOrdinal`,
  `${SFLO_NAMESPACE}stateOrdinal`,
  `${SFLO_NAMESPACE}locatedFileForState`,
  `${SFLO_NAMESPACE}locatedFileForManifestation`,
] as const;

export interface PlanMeshSupportResourcePagesInput {
  meshBase: string;
  currentMeshInventoryTurtle: string;
  currentMeshMetadataTurtle: string;
  currentMeshConfigTurtle?: string;
  supportHistoryPolicies?: MeshSupportHistoryPolicies;
  resourcePageGenerationConfig?: ResourcePageGenerationConfig;
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
  const preparedCurrentInventory = prepareCurrentInventory({
    baseIri: meshBase,
    currentInventoryTurtle: currentMeshInventoryTurtle,
    currentInventoryLabel: "current MeshInventory for mesh support pages",
  });
  assertNoLegacyMeshInventoryProgression(
    preparedCurrentInventory,
    "plan mesh support ResourcePages",
  );
  const quads = preparedCurrentInventory.quads;
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
      SFLO_HAS_ARTIFACT_HISTORY_IRI,
      resource.historyPath!,
    )
  );

  if (needsInitialSupportHistory) {
    return applyResourcePageGenerationPolicies(
      planInitialMeshSupportResourcePageWeave({
        meshBase,
        preparedCurrentInventory,
        currentMeshMetadataTurtle: input.currentMeshMetadataTurtle,
        currentMeshConfigTurtle: input.currentMeshConfigTurtle,
        hasConfig: hasSubject(quads, meshBase, "_mesh/_config"),
        supportHistoryPolicies: input.supportHistoryPolicies,
      }),
      input.resourcePageGenerationPolicies,
      { config: input.resourcePageGenerationConfig },
    );
  }

  for (const resource of supportResources) {
    if (!hasSubject(quads, meshBase, resource.path)) {
      throw new WeaveInputError(
        `Current mesh inventory did not contain support resource <${resource.path}>.`,
      );
    }
  }
  const requestedSettledFactsTurtle = `@base <${meshBase}> .
${SFLO_TURTLE_PREFIX_DECLARATION}

${
    supportResources.map((resource) =>
      `<${resource.path}> sflo:hasResourcePage <${resource.pagePath}> .

<${resource.pagePath}> a sflo:ResourcePage, sflo:LocatedFile .`
    ).join("\n\n")
  }
`;
  const appendPlan = planInventoryAppend({
    preparedCurrentInventory,
    requestedSettledFactsTurtle,
    currentInventoryLabel: "current MeshInventory for mesh support pages",
    requestedFactsLabel: "mesh support ResourcePage facts",
  });
  if (appendPlan.kind === "conflict") {
    throw new WeaveInputError(
      `Could not append mesh support ResourcePage facts: ${
        appendPlan.conflicts.map((conflict) => conflict.message).join(" ")
      }`,
    );
  }
  const updatedMeshInventoryTurtle = renderInventoryAppendPlan({
    preparedCurrentInventory,
    plan: appendPlan,
    outputLabel: "mesh support ResourcePage inventory append",
  });

  return applyResourcePageGenerationPolicies(
    {
      meshBase,
      versionedDesignatorPaths: [],
      createdFiles: [],
      updatedFiles: updatedMeshInventoryTurtle === currentMeshInventoryTurtle
        ? []
        : [{
          path: "_mesh/_inventory/inventory.ttl",
          contents: updatedMeshInventoryTurtle,
        }],
    },
    input.resourcePageGenerationPolicies,
    {
      config: input.resourcePageGenerationConfig,
    },
  );
}

function applyResourcePageGenerationPolicies(
  plan: VersionPlan,
  policies?: WeaveResourcePageGenerationPolicies,
  options: {
    config?: ResourcePageGenerationConfig;
  } = {},
): VersionPlan {
  const updatedFiles = filterResourcePageFactsFromPlannedFiles(
    plan.meshBase,
    plan.updatedFiles,
    policies,
    false,
    options.config,
  );
  return {
    ...plan,
    createdFiles: filterResourcePageFactsFromPlannedFiles(
      plan.meshBase,
      plan.createdFiles,
      policies,
      false,
      options.config,
    ),
    updatedFiles,
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
  preparedCurrentInventory: PreparedCurrentInventory;
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
  const preparedCurrentInventory = input.preparedCurrentInventory;

  for (const path of ["_mesh", ...supportResources.map(({ path }) => path)]) {
    if (!hasSubject(preparedCurrentInventory.quads, input.meshBase, path)) {
      throw new WeaveInputError(
        `Current mesh inventory did not contain support resource <${path}>.`,
      );
    }
  }
  for (const support of supportResources) {
    if (support.currentTurtle === undefined) {
      throw new WeaveInputError(
        `Current mesh support file was missing for <${support.path}>.`,
      );
    }
  }

  const appendPlan = planInventoryAppend({
    preparedCurrentInventory,
    requestedSettledFactsTurtle: renderInitialMeshSupportRequestedFactsTurtle(
      input.meshBase,
      supportResources,
    ),
    singleValuedSettledPredicates: INITIAL_SUPPORT_SINGLE_VALUED_PREDICATES,
    currentInventoryLabel: "current MeshInventory for initial mesh support",
    requestedFactsLabel: "initial mesh-support MeshInventory facts",
  });
  if (appendPlan.kind === "conflict") {
    throw new WeaveInputError(
      `Could not append initial mesh-support MeshInventory facts: ${
        appendPlan.conflicts.map((conflict) => conflict.message).join(" ")
      }`,
    );
  }
  const updatedInventoryTurtle = renderInventoryAppendPlan({
    preparedCurrentInventory,
    plan: appendPlan,
    outputLabel: "initial mesh-support MeshInventory append",
  });
  const versionedSupportResources = supportResources.filter(
    shouldMaterializeSupportHistory,
  );
  const versionedInventory = versionedSupportResources.find((support) =>
    support.path === "_mesh/_inventory"
  );
  const updatedMeshMetadataTurtle = versionedSupportResources.length === 0
    ? input.currentMeshMetadataTurtle
    : renderInitialMeshMetadataWithSupportProgression(
      input.currentMeshMetadataTurtle,
      versionedSupportResources,
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
      ...(versionedSupportResources.length === 0 ? [] : [{
        path: "_mesh/_meta/meta.ttl",
        contents: updatedMeshMetadataTurtle,
      }]),
      ...(updatedInventoryTurtle === preparedCurrentInventory.turtle ? [] : [{
        path: "_mesh/_inventory/inventory.ttl",
        contents: updatedInventoryTurtle,
      }]),
    ],
  };
}

function renderInitialMeshSupportRequestedFactsTurtle(
  meshBase: string,
  supportResources: readonly MeshSupportResource[],
): string {
  const meshPageFacts = `<_mesh> sflo:hasResourcePage <_mesh/index.html> .

${renderResourcePageLocatedFileBlock("_mesh/index.html")}`;
  const supportFacts = supportResources.map((support) => {
    const currentFacts =
      `<${support.path}> sflo:hasResourcePage <${support.pagePath}>${
        shouldMaterializeSupportHistory(support)
          ? ` ;\n  sflo:hasArtifactHistory <${support.historyPath!}>`
          : ""
      } .

${renderResourcePageLocatedFileBlock(support.pagePath)}`;
    if (!shouldMaterializeSupportHistory(support)) {
      return currentFacts;
    }

    return `${currentFacts}

${renderInitialSupportHistoryBlock(support.historyPath!, support.statePath!)}

${
      renderInitialSupportStateBlock(
        support.statePath!,
        support.manifestationPath!,
        support.snapshotPath!,
      )
    }

${
      renderInitialSupportManifestationBlock(
        support.manifestationPath!,
        support.snapshotPath!,
      )
    }

${renderLocatedFileBlock(support.snapshotPath!)}

${renderResourcePageLocatedFileBlock(`${support.historyPath!}/index.html`)}

${renderResourcePageLocatedFileBlock(`${support.statePath!}/index.html`)}

${
      renderResourcePageLocatedFileBlock(
        `${support.manifestationPath!}/index.html`,
      )
    }`;
  }).join("\n\n");

  return `@base <${meshBase}> .
${SFLO_TURTLE_PREFIX_DECLARATION}
${XSD_TURTLE_PREFIX_DECLARATION}

${meshPageFacts}

${supportFacts}
`;
}

function renderInitialMeshMetadataWithSupportProgression(
  currentMeshMetadataTurtle: string,
  versionedSupportResources: readonly MeshSupportResource[],
): string {
  const metadataWithPrefixes = ensureXsdPrefix(currentMeshMetadataTurtle);
  let blocks = splitTurtleBlocks(metadataWithPrefixes);
  let anchorPath = "_mesh";
  for (const support of versionedSupportResources) {
    blocks = upsertSubjectBlockAfter(
      blocks,
      anchorPath,
      support.path,
      renderInitialMeshSupportMetaProgressionBlock(support),
    );
    blocks = upsertSubjectBlockAfter(
      blocks,
      support.path,
      support.historyPath!,
      renderInitialMeshSupportHistoryMetaProgressionBlock(support),
    );
    anchorPath = support.historyPath!;
  }

  return `${blocks.join("\n\n")}\n`;
}

function renderInitialMeshSupportMetaProgressionBlock(
  support: MeshSupportResource,
): string {
  return `<${support.path}>
  sflo:currentArtifactHistory <${support.historyPath!}> ;
  sflo:nextHistoryOrdinal "2"^^xsd:nonNegativeInteger .`;
}

function renderInitialMeshSupportHistoryMetaProgressionBlock(
  support: MeshSupportResource,
): string {
  return `<${support.historyPath!}>
  sflo:latestHistoricalState <${support.statePath!}> ;
  sflo:nextStateOrdinal "2"^^xsd:nonNegativeInteger .`;
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

function renderLocatedFileBlock(path: string): string {
  return `<${path}> a sflo:LocatedFile, sflo:RdfDocument .`;
}

function renderResourcePageLocatedFileBlock(path: string): string {
  return `<${path}> a sflo:ResourcePage, sflo:LocatedFile .`;
}

function renderInitialSupportHistoryBlock(
  historyPath: string,
  statePath: string,
): string {
  return `<${historyPath}> a sflo:ArtifactHistory ;
  sflo:historyOrdinal "1"^^xsd:nonNegativeInteger ;
  sflo:hasHistoricalState <${statePath}> ;
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
