export type HistoryNamingPolicy = "ordinal" | "named";
export type StateNamingPolicy = "ordinal" | "semver" | "date";
export type ManifestationNamingPolicy =
  | "filenameDerived"
  | "contentKindDerived"
  | "ordinal";

export interface WeaveNamingPolicies {
  historyNamingPolicy?: HistoryNamingPolicy;
  stateNamingPolicy?: StateNamingPolicy;
  manifestationNamingPolicy?: ManifestationNamingPolicy;
}
