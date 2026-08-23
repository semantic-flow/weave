export type MeshValidationFindingCode =
  | "malformed-mesh-metadata"
  | "malformed-knop-metadata"
  | "malformed-inventory"
  | "malformed-config"
  | "missing-artifact"
  | "path-boundary-violation"
  | "unresolvable-extraction-source"
  | "malformed-page-definition"
  | "progression-conflict"
  | "naming-policy-violation"
  | "planned-rdf-invalid"
  | "plan-conflict"
  | "unsupported-mesh-shape"
  | "publication-path-leakage"
  | "publication-readiness"
  | "unsettled-founding-referent-data"
  | "content-digest-mismatch";

export interface MeshValidationFindingAttribution {
  path?: string;
  designatorPath?: string;
}

export class WeaveInputError extends Error {
  readonly findingCode?: MeshValidationFindingCode;
  readonly path?: string;
  readonly designatorPath?: string;

  constructor(
    message: string,
    findingCode?: MeshValidationFindingCode,
    attribution: MeshValidationFindingAttribution = {},
  ) {
    super(message);
    this.name = "WeaveInputError";
    this.findingCode = findingCode;
    this.path = attribution.path;
    this.designatorPath = attribution.designatorPath;
  }
}

export function ensureWeaveInputErrorFindingCode(
  error: unknown,
  findingCode: MeshValidationFindingCode,
  attribution: MeshValidationFindingAttribution = {},
): unknown {
  if (!(error instanceof WeaveInputError) || error.findingCode !== undefined) {
    return error;
  }
  return new WeaveInputError(error.message, findingCode, {
    ...(error.path === undefined ? {} : { path: error.path }),
    ...(error.designatorPath === undefined
      ? {}
      : { designatorPath: error.designatorPath }),
    ...attribution,
  });
}
