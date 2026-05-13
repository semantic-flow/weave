export type ConfigInheritanceAcceptancePolicy =
  | "acceptAndPropagate"
  | "acceptDoNotPropagate"
  | "blockInherited";

export type ConfigInheritanceOfferPolicy =
  | "offerDescendantsOnly"
  | "offerSelfAndDescendants";

export type InheritedConfigProjection =
  | "meshInherited"
  | "ancestorInherited"
  | "selfInclusiveOffer";

export interface ConfigInheritanceScope<TSource = string> {
  scopeKey: string;
  inboundPolicy?: ConfigInheritanceAcceptancePolicy;
  offerPolicy?: ConfigInheritanceOfferPolicy;
  inheritableSources?: readonly TSource[];
}

export interface KnopInheritedConfigResolutionInput<TSource = string> {
  meshScopeKey?: string;
  meshInheritableSources?: readonly TSource[];
  knopScopePath: readonly ConfigInheritanceScope<TSource>[];
}

export interface ProjectedInheritedConfigSource<TSource = string> {
  source: TSource;
  offeredByScopeKey: string;
  projection: InheritedConfigProjection;
}

export class ConfigInheritanceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigInheritanceError";
  }
}

export function resolveKnopInheritedConfigSources<TSource>(
  input:
    | readonly ConfigInheritanceScope<TSource>[]
    | KnopInheritedConfigResolutionInput<TSource>,
): readonly ProjectedInheritedConfigSource<TSource>[] {
  const {
    meshScopeKey,
    meshInheritableSources,
    knopScopePath,
  } = normalizeResolutionInput(input);

  if (knopScopePath.length === 0) {
    throw new ConfigInheritanceError(
      "Cannot resolve inherited config for an empty scope path",
    );
  }

  assertUniqueScopeKeys(knopScopePath, meshScopeKey);

  let incoming: readonly ProjectedInheritedConfigSource<TSource>[] =
    projectMeshInheritableSources(meshScopeKey, meshInheritableSources);

  for (let index = 0; index < knopScopePath.length; index += 1) {
    const scope = knopScopePath[index]!;
    const inboundPolicy = scope.inboundPolicy ?? "acceptAndPropagate";
    const acceptedIncoming = inboundPolicy === "blockInherited" ? [] : incoming;
    const isTargetScope = index === knopScopePath.length - 1;

    if (isTargetScope) {
      return [
        ...acceptedIncoming,
        ...projectSelfInclusiveOffers(scope),
      ];
    }

    incoming = [
      ...(inboundPolicy === "acceptAndPropagate" ? acceptedIncoming : []),
      ...projectDescendantOffers(scope),
    ];
  }

  return incoming;
}

function normalizeResolutionInput<TSource>(
  input:
    | readonly ConfigInheritanceScope<TSource>[]
    | KnopInheritedConfigResolutionInput<TSource>,
): Required<KnopInheritedConfigResolutionInput<TSource>> {
  if (Array.isArray(input)) {
    const knopScopePath = input as readonly ConfigInheritanceScope<TSource>[];

    return {
      meshScopeKey: "_mesh",
      meshInheritableSources: [],
      knopScopePath,
    };
  }

  const resolutionInput = input as KnopInheritedConfigResolutionInput<TSource>;

  return {
    meshScopeKey: resolutionInput.meshScopeKey ?? "_mesh",
    meshInheritableSources: resolutionInput.meshInheritableSources ?? [],
    knopScopePath: resolutionInput.knopScopePath,
  };
}

function projectMeshInheritableSources<TSource>(
  meshScopeKey: string,
  meshInheritableSources: readonly TSource[],
): readonly ProjectedInheritedConfigSource<TSource>[] {
  return meshInheritableSources.map((source) => ({
    source,
    offeredByScopeKey: meshScopeKey,
    projection: "meshInherited",
  }));
}

function projectDescendantOffers<TSource>(
  scope: ConfigInheritanceScope<TSource>,
): readonly ProjectedInheritedConfigSource<TSource>[] {
  return (scope.inheritableSources ?? []).map((source) => ({
    source,
    offeredByScopeKey: scope.scopeKey,
    projection: "ancestorInherited",
  }));
}

function projectSelfInclusiveOffers<TSource>(
  scope: ConfigInheritanceScope<TSource>,
): readonly ProjectedInheritedConfigSource<TSource>[] {
  if (scope.offerPolicy !== "offerSelfAndDescendants") {
    return [];
  }

  return (scope.inheritableSources ?? []).map((source) => ({
    source,
    offeredByScopeKey: scope.scopeKey,
    projection: "selfInclusiveOffer",
  }));
}

function assertUniqueScopeKeys<TSource>(
  scopePath: readonly ConfigInheritanceScope<TSource>[],
  meshScopeKey: string,
): void {
  if (meshScopeKey.trim().length === 0) {
    throw new ConfigInheritanceError(
      "Config inheritance mesh scope key must not be empty",
    );
  }

  const seenScopeKeys = new Set<string>([meshScopeKey]);

  for (const scope of scopePath) {
    if (scope.scopeKey !== "" && scope.scopeKey.trim().length === 0) {
      throw new ConfigInheritanceError(
        "Config inheritance scope keys must not be blank",
      );
    }
    if (seenScopeKeys.has(scope.scopeKey)) {
      throw new ConfigInheritanceError(
        `Duplicate config inheritance scope key: ${scope.scopeKey}`,
      );
    }

    seenScopeKeys.add(scope.scopeKey);
  }
}
