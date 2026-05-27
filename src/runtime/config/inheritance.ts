export type ConfigInheritanceAcceptancePolicy =
  | "acceptAndPropagate"
  | "acceptDoNotPropagate"
  | "blockInherited";

export type ConfigInheritanceOfferPolicy =
  | "offerDescendantsOnly"
  | "offerSelfAndDescendants";

export type InheritedConfigProjection =
  | "ancestorInherited"
  | "selfInclusiveOffer";

export interface ConfigInheritanceScope<TSource = string> {
  scopeKey: string;
  inboundPolicy?: ConfigInheritanceAcceptancePolicy;
  offerPolicy?: ConfigInheritanceOfferPolicy;
  inheritableSources?: readonly TSource[];
}

export interface KnopInheritedConfigResolutionInput<TSource = string> {
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
    knopScopePath,
  } = normalizeResolutionInput(input);

  if (knopScopePath.length === 0) {
    throw new ConfigInheritanceError(
      "Cannot resolve inherited config for an empty scope path",
    );
  }

  assertUniqueScopeKeys(knopScopePath);

  let incoming: readonly ProjectedInheritedConfigSource<TSource>[] = [];

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
): KnopInheritedConfigResolutionInput<TSource> {
  if (Array.isArray(input)) {
    const knopScopePath = input as readonly ConfigInheritanceScope<TSource>[];

    return {
      knopScopePath,
    };
  }

  const resolutionInput = input as KnopInheritedConfigResolutionInput<TSource>;

  return {
    knopScopePath: resolutionInput.knopScopePath,
  };
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
): void {
  const seenScopeKeys = new Set<string>();

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
