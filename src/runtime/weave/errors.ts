import type {
  MeshValidationFindingAttribution,
  MeshValidationFindingCode,
} from "../../core/weave/errors.ts";

export class WeaveRuntimeError extends Error {
  readonly findingCode?: MeshValidationFindingCode;
  readonly path?: string;
  readonly designatorPath?: string;

  constructor(
    message: string,
    findingCode?: MeshValidationFindingCode,
    attribution: MeshValidationFindingAttribution = {},
  ) {
    super(message);
    this.name = "WeaveRuntimeError";
    this.findingCode = findingCode;
    this.path = attribution.path;
    this.designatorPath = attribution.designatorPath;
  }
}
