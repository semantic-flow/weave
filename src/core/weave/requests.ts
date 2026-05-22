import type { TargetSpec, VersionTargetSpec } from "../targeting.ts";

export interface WeaveRequest {
  targets?: readonly VersionTargetSpec[];
  overwriteExistingState?: boolean;
}

export interface ValidateRequest {
  targets?: readonly TargetSpec[];
}

export interface GenerateRequest {
  targets?: readonly TargetSpec[];
}

export interface VersionRequest {
  targets?: readonly VersionTargetSpec[];
  overwriteExistingState?: boolean;
}
