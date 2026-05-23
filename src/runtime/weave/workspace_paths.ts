import { join, relative } from "@std/path";
import type { OperationalLocalPathPolicy } from "../operational/local_path_policy.ts";

export function toWorkspaceRelativePath(
  policy: OperationalLocalPathPolicy,
  meshRelativePath: string,
): string {
  const path = relative(
    policy.workspaceRoot,
    join(policy.meshRoot, meshRelativePath),
  ).replaceAll("\\", "/");
  return path.length === 0 ? "." : path;
}
