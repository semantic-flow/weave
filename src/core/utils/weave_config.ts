/** Returns the _config file of a site */
export async function getConfigFile(
  path?: string,
  defaultPaths: string[] = ["_weave_config.js", "_weave_config.ts"],
): Promise<string | undefined> {
  if (path) {
    try {
      return await Deno.realPath(path);
    } catch {
      throw new Error(`Config file not found (${path})`);
    }
  }

  for (const path of defaultPaths) {
    try {
      return await Deno.realPath(path);
    } catch {
      // Ignore
    }
  }
}
