import type { OperationalLocalPathPolicy } from "./local_path_policy.ts";
import type { RepositorySourceFloatingLocatorResolution } from "./repository_source_git.ts";

export type { RepositorySourceFloatingLocatorResolution };

// Repository-source resolution shells out to git. The weave/versioning modules
// that call it are also on the library API graph, which must stay
// subprocess-free under static analysis (see src/api/fs_purity_test.ts), so
// the git-backed implementation is loaded lazily at the moment a
// repository/floating source is actually resolved. versionPayloads refuses
// such sources up front, so the library path never loads it.
export async function resolveRepositorySourceFloatingLocalPath(
  policy: OperationalLocalPathPolicy,
  locator: RepositorySourceFloatingLocatorResolution,
): Promise<string> {
  const gitResolution = await import("./repository_source_git.ts");
  return await gitResolution.resolveRepositorySourceFloatingLocalPath(
    policy,
    locator,
  );
}
