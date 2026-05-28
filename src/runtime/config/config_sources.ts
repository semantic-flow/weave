import { resolve, toFileUrl } from "@std/path";
import { Parser, type Quad, type Term } from "n3";
import { toKnopPath } from "../../core/designator_segments.ts";
import {
  RDF_NAMESPACE,
  SFCFG_NAMESPACE,
  SFLO_NAMESPACE,
} from "../../core/rdf/namespaces.ts";
import {
  type ArtifactResolutionRequest,
  type ArtifactResolutionResult,
  parseArtifactResolutionSpecQuads,
  resolveArtifactResolutionRequest,
} from "../artifact_resolution/resolver.ts";
import {
  type LocalPathLocatorKind,
  type OperationalLocalPathPolicy,
  resolveAllowedLocalPath,
} from "../operational/local_path_policy.ts";
import {
  type ProjectedInheritedConfigSource,
  resolveKnopInheritedConfigSources,
} from "./inheritance.ts";

const RDF_TYPE_IRI = `${RDF_NAMESPACE}type`;
const SFCFG_CONFIG_SOURCE_IRI = `${SFCFG_NAMESPACE}ConfigSource`;
const SFCFG_HAS_CONFIG_SOURCE_IRI = `${SFCFG_NAMESPACE}hasConfigSource`;
const SFCFG_HAS_INHERITABLE_CONFIG_SOURCE_IRI =
  `${SFCFG_NAMESPACE}hasInheritableConfigSource`;
const SFLO_SEMANTIC_MESH_IRI = `${SFLO_NAMESPACE}SemanticMesh`;
const SFLO_KNOP_IRI = `${SFLO_NAMESPACE}Knop`;

export interface MeshLocalConfigInput {
  turtle: string;
  source: string;
}

export type ConfigSourceLayerRole =
  | "meshLocal"
  | "knopInherited"
  | "knopLocal";

export interface LayeredConfigInput extends MeshLocalConfigInput {
  layerRole: ConfigSourceLayerRole;
  sourceOrder: number;
  authorityScopeKey?: string;
}

export interface KnopConfigScopeInput {
  scopeKey: string;
  turtle: string;
  source?: string;
}

export interface ConfigSourceResolutionTraceEntry {
  kind: "configSource";
  status: "accepted" | "skipped";
  declaredInSource: string;
  attachmentSubject: string;
  attachmentProperty:
    | typeof SFCFG_HAS_CONFIG_SOURCE_IRI
    | typeof SFCFG_HAS_INHERITABLE_CONFIG_SOURCE_IRI;
  sourceTerm: string;
  sourceIri?: string;
  requested: ArtifactResolutionRequest;
  resolvedLocalRelativePath?: string;
  resolvedLocatedFileIri?: string;
  resolvedHistoricalStateIri?: string;
  contentDigest?: string;
  layerRole: ConfigSourceLayerRole;
  sourceOrder?: number;
  authoredScopeKey?: string;
  offeredByScopeKey?: string;
  projectedToScopeKey?: string;
  projection?: "ancestorInherited" | "selfInclusiveOffer";
  reason?: string;
}

export interface DiscoverMeshLocalConfigSourcesOptions {
  meshRoot: string;
  meshBase: string;
  localPathPolicy: OperationalLocalPathPolicy;
  seedDocuments: readonly MeshLocalConfigInput[];
}

export interface DiscoverKnopConfigSourcesOptions {
  meshRoot: string;
  meshBase: string;
  localPathPolicy: OperationalLocalPathPolicy;
  knopScopePath: readonly KnopConfigScopeInput[];
}

interface ParsedConfigSourceDocument extends MeshLocalConfigInput {
  quads: readonly Quad[];
}

interface ConfigSourceAttachment {
  document: ParsedConfigSourceDocument;
  subjectKey: string;
  attachmentProperty:
    | typeof SFCFG_HAS_CONFIG_SOURCE_IRI
    | typeof SFCFG_HAS_INHERITABLE_CONFIG_SOURCE_IRI;
  sourceTerm: string;
  sourceIri?: string;
  object: Term;
  authoredScopeKey?: string;
  offeredByScopeKey?: string;
  projectedToScopeKey?: string;
  projection?: "ancestorInherited" | "selfInclusiveOffer";
}

export class ConfigSourceDiscoveryError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "ConfigSourceDiscoveryError";
  }
}

export async function discoverMeshLocalConfigSources(
  options: DiscoverMeshLocalConfigSourcesOptions,
): Promise<{
  configInputs: readonly MeshLocalConfigInput[];
  resolutionTrace: readonly ConfigSourceResolutionTraceEntry[];
}> {
  const activeMeshIri = new URL(
    "_mesh",
    ensureDirectoryIri(options.meshBase),
  ).href;
  const activeMeshSubjectKey = `NamedNode:${activeMeshIri}`;
  const context = {
    meshRoot: options.meshRoot,
    meshBase: options.meshBase,
    localPathPolicy: options.localPathPolicy,
  };
  const configInputs: MeshLocalConfigInput[] = [];
  const resolutionTrace: ConfigSourceResolutionTraceEntry[] = [];
  const seenAttachments = new Set<string>();
  const seenResolvedSources = new Set<string>();

  async function discoverFromDocument(
    document: ParsedConfigSourceDocument,
    stack: readonly string[],
  ): Promise<void> {
    const attachments = collectMeshLocalConfigSourceAttachments(
      document,
      activeMeshSubjectKey,
      activeMeshIri,
    );
    for (const attachment of attachments) {
      await resolveAttachment(attachment, stack);
    }
  }

  async function resolveAttachment(
    attachment: ConfigSourceAttachment,
    stack: readonly string[],
  ): Promise<void> {
    const attachmentKey =
      `${attachment.document.source} ${attachment.sourceTerm}`;
    if (seenAttachments.has(attachmentKey)) {
      return;
    }
    seenAttachments.add(attachmentKey);

    const sourceDescription =
      `${attachment.document.source} ${SFCFG_HAS_CONFIG_SOURCE_IRI} ${attachment.sourceTerm}`;
    const request = parseArtifactResolutionSpecQuads(
      attachment.document.quads,
      attachment.object,
      { sourceDescription },
    );
    const result = await resolveArtifactResolutionRequest(
      context,
      request,
      { contentMode: "text" },
    );
    const resolvedIdentity = resolvedConfigSourceIdentity(result);

    if (stack.includes(resolvedIdentity)) {
      throw new ConfigSourceDiscoveryError(
        `Cyclic mesh-local config-source reference detected: ${
          [...stack, resolvedIdentity].join(" -> ")
        }`,
      );
    }

    if (seenResolvedSources.has(resolvedIdentity)) {
      resolutionTrace.push(traceEntryForAttachment(
        attachment,
        result,
        "skipped",
        "meshLocal",
        undefined,
        "duplicate resolved config source",
      ));
      return;
    }
    seenResolvedSources.add(resolvedIdentity);

    const text = result.content?.text;
    if (text === undefined) {
      throw new ConfigSourceDiscoveryError(
        `Resolved config source did not provide Turtle text: ${sourceDescription}`,
      );
    }

    const source = sourceLabelForResult(result, options.localPathPolicy);
    configInputs.push({ turtle: text, source });
    resolutionTrace.push(traceEntryForAttachment(
      attachment,
      result,
      "accepted",
    ));

    await discoverFromDocument(
      parseConfigSourceDocument({ turtle: text, source }),
      [...stack, resolvedIdentity],
    );
  }

  for (const document of options.seedDocuments.map(parseConfigSourceDocument)) {
    await discoverFromDocument(document, []);
  }

  return { configInputs, resolutionTrace };
}

export async function discoverKnopConfigSources(
  options: DiscoverKnopConfigSourcesOptions,
): Promise<{
  configInputs: readonly LayeredConfigInput[];
  resolutionTrace: readonly ConfigSourceResolutionTraceEntry[];
}> {
  if (options.knopScopePath.length === 0) {
    return { configInputs: [], resolutionTrace: [] };
  }

  const context = {
    meshRoot: options.meshRoot,
    meshBase: options.meshBase,
    localPathPolicy: options.localPathPolicy,
  };
  const parsedScopes = options.knopScopePath.map((scope) => {
    const source = scope.source ??
      `${toKnopPath(scope.scopeKey)}/_meta/meta.ttl`;
    return {
      scopeKey: scope.scopeKey,
      subjectKey: `NamedNode:${
        new URL(
          toKnopPath(scope.scopeKey),
          ensureDirectoryIri(options.meshBase),
        )
          .href
      }`,
      document: parseConfigSourceDocument({
        turtle: scope.turtle,
        source,
      }),
    };
  });
  const scopes = parsedScopes.map((scope) => {
    const attachments = collectKnopConfigSourceAttachments(
      scope.document,
      scope.subjectKey,
      scope.scopeKey,
    );
    return {
      ...scope,
      localSources: attachments.localSources,
      inheritableSources: attachments.inheritableSources,
    };
  });
  const targetScope = scopes.at(-1)!;
  const targetScopeKey = targetScope.scopeKey;
  const projectedInheritedSources = resolveKnopInheritedConfigSources(
    scopes.map((scope) => ({
      scopeKey: scope.scopeKey,
      inheritableSources: scope.inheritableSources,
    })),
  );

  const inherited = await resolveLayeredConfigSourceAttachments({
    context,
    localPathPolicy: options.localPathPolicy,
    layerRole: "knopInherited",
    initialAttachments: orderProjectedInheritedSourcesForPrecedence(
      projectedInheritedSources,
    ).map((projection) =>
      toProjectedConfigSourceAttachment(projection, targetScopeKey)
    ),
  });
  const local = await resolveLayeredConfigSourceAttachments({
    context,
    localPathPolicy: options.localPathPolicy,
    layerRole: "knopLocal",
    initialAttachments: targetScope.localSources,
  });

  return {
    configInputs: [
      ...inherited.configInputs,
      ...local.configInputs,
    ],
    resolutionTrace: [
      ...inherited.resolutionTrace,
      ...local.resolutionTrace,
    ],
  };
}

function collectMeshLocalConfigSourceAttachments(
  document: ParsedConfigSourceDocument,
  activeMeshSubjectKey: string,
  activeMeshIri: string,
): readonly ConfigSourceAttachment[] {
  const attachments = new Map<string, ConfigSourceAttachment>();

  for (const quad of document.quads) {
    if (
      quad.predicate.value !== SFCFG_HAS_CONFIG_SOURCE_IRI &&
      quad.predicate.value !== SFCFG_HAS_INHERITABLE_CONFIG_SOURCE_IRI
    ) {
      continue;
    }

    const subjectKey = toTermKey(quad.subject);
    if (quad.predicate.value === SFCFG_HAS_INHERITABLE_CONFIG_SOURCE_IRI) {
      throw new ConfigSourceDiscoveryError(
        `${SFCFG_HAS_INHERITABLE_CONFIG_SOURCE_IRI} in ${document.source} is supported only by Knop metadata discovery, not mesh-local config-source discovery.`,
      );
    }

    if (subjectKey !== activeMeshSubjectKey) {
      if (
        hasNamedNodeObject(
          document.quads,
          subjectKey,
          RDF_TYPE_IRI,
          SFLO_KNOP_IRI,
        )
      ) {
        throw new ConfigSourceDiscoveryError(
          `${SFCFG_HAS_CONFIG_SOURCE_IRI} on sflo:Knop in ${document.source} is supported only by Knop metadata discovery, not mesh-local config-source discovery.`,
        );
      }
      throw new ConfigSourceDiscoveryError(
        `${SFCFG_HAS_CONFIG_SOURCE_IRI} in ${document.source} is supported only on the active SemanticMesh <${activeMeshIri}> in this implementation slice; found ${
          describeTerm(quad.subject)
        }.`,
      );
    }
    if (
      !hasNamedNodeObject(
        document.quads,
        subjectKey,
        RDF_TYPE_IRI,
        SFLO_SEMANTIC_MESH_IRI,
      )
    ) {
      throw new ConfigSourceDiscoveryError(
        `${SFCFG_HAS_CONFIG_SOURCE_IRI} in ${document.source} requires the active mesh attachment subject to be typed ${SFLO_SEMANTIC_MESH_IRI}.`,
      );
    }

    if (quad.object.termType === "Literal") {
      throw new ConfigSourceDiscoveryError(
        `${SFCFG_HAS_CONFIG_SOURCE_IRI} values in ${document.source} must be named or blank nodes.`,
      );
    }

    const sourceTerm = toTermKey(quad.object);
    requireTermHasType(
      document.quads,
      sourceTerm,
      SFCFG_CONFIG_SOURCE_IRI,
      document.source,
    );
    attachments.set(sourceTerm, {
      document,
      subjectKey,
      attachmentProperty: SFCFG_HAS_CONFIG_SOURCE_IRI,
      sourceTerm,
      ...(quad.object.termType === "NamedNode"
        ? { sourceIri: quad.object.value }
        : {}),
      object: quad.object,
    });
  }

  return [...attachments.values()].sort((left, right) =>
    left.sourceTerm.localeCompare(right.sourceTerm)
  );
}

function collectKnopConfigSourceAttachments(
  document: ParsedConfigSourceDocument,
  activeKnopSubjectKey: string,
  activeScopeKey: string,
): {
  localSources: readonly ConfigSourceAttachment[];
  inheritableSources: readonly ConfigSourceAttachment[];
} {
  const localSources = new Map<string, ConfigSourceAttachment>();
  const inheritableSources = new Map<string, ConfigSourceAttachment>();

  for (const quad of document.quads) {
    if (
      quad.predicate.value !== SFCFG_HAS_CONFIG_SOURCE_IRI &&
      quad.predicate.value !== SFCFG_HAS_INHERITABLE_CONFIG_SOURCE_IRI
    ) {
      continue;
    }

    const subjectKey = toTermKey(quad.subject);
    if (subjectKey !== activeKnopSubjectKey) {
      throw new ConfigSourceDiscoveryError(
        `${quad.predicate.value} in ${document.source} is supported only on the active Knop ${activeKnopSubjectKey}; found ${
          describeTerm(quad.subject)
        }.`,
      );
    }
    requireTermHasType(
      document.quads,
      subjectKey,
      SFLO_KNOP_IRI,
      document.source,
    );
    if (quad.object.termType === "Literal") {
      throw new ConfigSourceDiscoveryError(
        `${quad.predicate.value} values in ${document.source} must be named or blank nodes.`,
      );
    }

    const sourceTerm = toTermKey(quad.object);
    requireTermHasType(
      document.quads,
      sourceTerm,
      SFCFG_CONFIG_SOURCE_IRI,
      document.source,
    );
    const attachment: ConfigSourceAttachment = {
      document,
      subjectKey,
      attachmentProperty: quad.predicate.value as
        | typeof SFCFG_HAS_CONFIG_SOURCE_IRI
        | typeof SFCFG_HAS_INHERITABLE_CONFIG_SOURCE_IRI,
      sourceTerm,
      ...(quad.object.termType === "NamedNode"
        ? { sourceIri: quad.object.value }
        : {}),
      object: quad.object,
      authoredScopeKey: activeScopeKey,
      offeredByScopeKey: activeScopeKey,
    };
    const attachmentMap = quad.predicate.value === SFCFG_HAS_CONFIG_SOURCE_IRI
      ? localSources
      : inheritableSources;
    attachmentMap.set(sourceTerm, attachment);
  }

  return {
    localSources: sortAttachments(localSources.values()),
    inheritableSources: sortAttachments(inheritableSources.values()),
  };
}

function sortAttachments(
  attachments: Iterable<ConfigSourceAttachment>,
): readonly ConfigSourceAttachment[] {
  return [...attachments].sort((left, right) =>
    left.sourceTerm.localeCompare(right.sourceTerm)
  );
}

function toProjectedConfigSourceAttachment(
  projection: ProjectedInheritedConfigSource<ConfigSourceAttachment>,
  targetScopeKey: string,
): ConfigSourceAttachment {
  return {
    ...projection.source,
    offeredByScopeKey: projection.offeredByScopeKey,
    projectedToScopeKey: targetScopeKey,
    projection: projection.projection,
  };
}

function orderProjectedInheritedSourcesForPrecedence(
  projections: readonly ProjectedInheritedConfigSource<
    ConfigSourceAttachment
  >[],
): readonly ProjectedInheritedConfigSource<ConfigSourceAttachment>[] {
  const ordered: ProjectedInheritedConfigSource<ConfigSourceAttachment>[] = [];
  for (let index = projections.length - 1; index >= 0;) {
    const offeredByScopeKey = projections[index]!.offeredByScopeKey;
    let groupStart = index;
    while (
      groupStart > 0 &&
      projections[groupStart - 1]!.offeredByScopeKey === offeredByScopeKey
    ) {
      groupStart -= 1;
    }
    ordered.push(...projections.slice(groupStart, index + 1));
    index = groupStart - 1;
  }
  return ordered;
}

async function resolveLayeredConfigSourceAttachments(
  input: {
    context: {
      meshRoot: string;
      meshBase: string;
      localPathPolicy: OperationalLocalPathPolicy;
    };
    localPathPolicy: OperationalLocalPathPolicy;
    layerRole: "knopInherited" | "knopLocal";
    initialAttachments: readonly ConfigSourceAttachment[];
  },
): Promise<{
  configInputs: readonly LayeredConfigInput[];
  resolutionTrace: readonly ConfigSourceResolutionTraceEntry[];
}> {
  const configInputs: LayeredConfigInput[] = [];
  const resolutionTrace: ConfigSourceResolutionTraceEntry[] = [];
  const seenAttachments = new Set<string>();
  const seenResolvedSources = new Set<string>();
  let nextSourceOrder = 0;

  async function discoverFromAttachment(
    attachment: ConfigSourceAttachment,
    stack: readonly string[],
  ): Promise<void> {
    const attachmentKey =
      `${attachment.document.source} ${attachment.attachmentProperty} ${attachment.sourceTerm}`;
    if (seenAttachments.has(attachmentKey)) {
      return;
    }
    seenAttachments.add(attachmentKey);

    const sourceDescription =
      `${attachment.document.source} ${attachment.attachmentProperty} ${attachment.sourceTerm}`;
    const request = parseArtifactResolutionSpecQuads(
      attachment.document.quads,
      attachment.object,
      { sourceDescription },
    );
    const result = await resolveArtifactResolutionRequest(
      input.context,
      request,
      { contentMode: "text" },
    );
    const resolvedIdentity = resolvedConfigSourceIdentity(result);

    if (stack.includes(resolvedIdentity)) {
      throw new ConfigSourceDiscoveryError(
        `Cyclic ${input.layerRole} config-source reference detected: ${
          [...stack, resolvedIdentity].join(" -> ")
        }`,
      );
    }

    if (seenResolvedSources.has(resolvedIdentity)) {
      resolutionTrace.push(traceEntryForAttachment(
        attachment,
        result,
        "skipped",
        input.layerRole,
        undefined,
        "duplicate resolved config source",
      ));
      return;
    }
    seenResolvedSources.add(resolvedIdentity);

    const text = result.content?.text;
    if (text === undefined) {
      throw new ConfigSourceDiscoveryError(
        `Resolved config source did not provide Turtle text: ${sourceDescription}`,
      );
    }

    const sourceOrder = nextSourceOrder;
    nextSourceOrder += 1;
    const source = sourceLabelForResult(result, input.localPathPolicy);
    configInputs.push({
      turtle: text,
      source,
      layerRole: input.layerRole,
      sourceOrder,
      ...(attachment.projectedToScopeKey !== undefined
        ? { authorityScopeKey: attachment.projectedToScopeKey }
        : attachment.authoredScopeKey !== undefined
        ? { authorityScopeKey: attachment.authoredScopeKey }
        : {}),
    });
    resolutionTrace.push(traceEntryForAttachment(
      attachment,
      result,
      "accepted",
      input.layerRole,
      sourceOrder,
    ));

    const parsed = parseConfigSourceDocument({ turtle: text, source });
    const recursiveAttachments = collectKnopConfigSourceAttachments(
      parsed,
      attachment.subjectKey,
      attachment.authoredScopeKey ?? "",
    ).localSources.map((recursiveAttachment) => ({
      ...recursiveAttachment,
      authoredScopeKey: attachment.authoredScopeKey,
      offeredByScopeKey: attachment.offeredByScopeKey,
      projectedToScopeKey: attachment.projectedToScopeKey,
      projection: attachment.projection,
    }));
    for (const recursiveAttachment of recursiveAttachments) {
      await discoverFromAttachment(recursiveAttachment, [
        ...stack,
        resolvedIdentity,
      ]);
    }
  }

  for (const attachment of input.initialAttachments) {
    await discoverFromAttachment(attachment, []);
  }

  return { configInputs, resolutionTrace };
}

function parseConfigSourceDocument(
  document: MeshLocalConfigInput,
): ParsedConfigSourceDocument {
  try {
    return {
      ...document,
      quads: new Parser({ baseIRI: toParserBaseIri(document.source) }).parse(
        document.turtle,
      ),
    };
  } catch (error) {
    throw new ConfigSourceDiscoveryError(
      `Could not parse config source discovery input: ${document.source}`,
      { cause: error },
    );
  }
}

function traceEntryForAttachment(
  attachment: ConfigSourceAttachment,
  result: ArtifactResolutionResult,
  status: ConfigSourceResolutionTraceEntry["status"],
  layerRole: ConfigSourceLayerRole = "meshLocal",
  sourceOrder?: number,
  reason?: string,
): ConfigSourceResolutionTraceEntry {
  return {
    kind: "configSource",
    status,
    declaredInSource: attachment.document.source,
    attachmentSubject: attachment.subjectKey,
    attachmentProperty: attachment.attachmentProperty,
    sourceTerm: attachment.sourceTerm,
    ...(attachment.sourceIri ? { sourceIri: attachment.sourceIri } : {}),
    requested: result.requested,
    ...(result.observed.localRelativePath
      ? { resolvedLocalRelativePath: result.observed.localRelativePath }
      : {}),
    ...(result.observed.locatedFileIri
      ? { resolvedLocatedFileIri: result.observed.locatedFileIri }
      : {}),
    ...(result.observed.historicalStateIri
      ? { resolvedHistoricalStateIri: result.observed.historicalStateIri }
      : {}),
    ...(result.observed.contentDigest
      ? { contentDigest: result.observed.contentDigest }
      : {}),
    layerRole,
    ...(sourceOrder !== undefined ? { sourceOrder } : {}),
    ...(attachment.authoredScopeKey !== undefined
      ? { authoredScopeKey: attachment.authoredScopeKey }
      : {}),
    ...(attachment.offeredByScopeKey !== undefined
      ? { offeredByScopeKey: attachment.offeredByScopeKey }
      : {}),
    ...(attachment.projectedToScopeKey !== undefined
      ? { projectedToScopeKey: attachment.projectedToScopeKey }
      : {}),
    ...(attachment.projection ? { projection: attachment.projection } : {}),
    ...(reason ? { reason } : {}),
  };
}

function resolvedConfigSourceIdentity(
  result: ArtifactResolutionResult,
): string {
  if (result.observed.localRelativePath) {
    return `local:${result.observed.localRelativePath}`;
  }
  if (result.observed.locatedFileIri) {
    return `located:${result.observed.locatedFileIri}`;
  }
  if (result.observed.historicalStateIri) {
    return `historical:${result.observed.historicalStateIri}`;
  }
  if (result.requested.sourceIri) {
    return `source:${result.requested.sourceIri}`;
  }
  return `request:${JSON.stringify(result.requested)}`;
}

function sourceLabelForResult(
  result: ArtifactResolutionResult,
  localPathPolicy: OperationalLocalPathPolicy,
): string {
  if (result.observed.localRelativePath) {
    const locatorKind = locatorKindForRequest(result.requested);
    try {
      return resolveAllowedLocalPath(
        localPathPolicy,
        locatorKind,
        result.observed.localRelativePath,
      );
    } catch {
      return result.observed.localRelativePath;
    }
  }

  return result.observed.locatedFileIri ??
    result.observed.historicalStateIri ??
    result.requested.sourceIri ??
    result.requested.sourceTerm ??
    "resolved config source";
}

function locatorKindForRequest(
  request: ArtifactResolutionRequest,
): LocalPathLocatorKind {
  return request.targetLocalRelativePath === undefined
    ? "workingLocalRelativePath"
    : "targetLocalRelativePath";
}

function requireTermHasType(
  quads: readonly Quad[],
  termKey: string,
  typeIri: string,
  source: string,
): void {
  if (!hasNamedNodeObject(quads, termKey, RDF_TYPE_IRI, typeIri)) {
    throw new ConfigSourceDiscoveryError(
      `Expected ${termKey} to be typed ${typeIri} in ${source}`,
    );
  }
}

function hasNamedNodeObject(
  quads: readonly Quad[],
  subjectKey: string,
  predicateIri: string,
  objectIri: string,
): boolean {
  return quads.some((quad) =>
    toTermKey(quad.subject) === subjectKey &&
    quad.predicate.value === predicateIri &&
    quad.object.termType === "NamedNode" &&
    quad.object.value === objectIri
  );
}

function describeTerm(term: Term): string {
  if (term.termType === "NamedNode") {
    return `<${term.value}>`;
  }
  return `${term.termType}:${term.value}`;
}

function toTermKey(term: Term): string {
  return `${term.termType}:${term.value}`;
}

function ensureDirectoryIri(iri: string): string {
  return iri.endsWith("/") ? iri : `${iri}/`;
}

function toParserBaseIri(source: string): string {
  try {
    return new URL(source).href;
  } catch {
    return toFileUrl(resolve(source)).href;
  }
}
