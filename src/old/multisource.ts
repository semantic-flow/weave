import { resolve } from "https://deno.land/std/path/mod.ts";
import { weaveConfig } from "../../_weave_config.ts";
import { tidywovenDir } from "./tidywovenDir.ts";
import { prepareInclusions } from "./prepareInclusions.ts";

export default async function multisource(lumeBasePath: string) {
  const { global, inclusions } = weaveConfig;

  // Resolve global directories
  const wovenDir = resolve(lumeBasePath, global.wovenDir);
  const repoDir = resolve(lumeBasePath, global.repoDir);

  // Preserve the repoDir only if it's a subdirectory of wovenDir
  const preserveDirs = repoDir.startsWith(wovenDir) ? [repoDir] : [];

  // Clean up the combined directory
  await tidywovenDir(wovenDir, preserveDirs);

  // Prepare inclusions
  await prepareInclusions(repoDir, wovenDir, inclusions);
}
