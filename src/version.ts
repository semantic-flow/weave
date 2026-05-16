import denoConfig from "../deno.json" with { type: "json" };

const version = denoConfig.version;

if (typeof version !== "string" || !isSupportedVersion(version)) {
  throw new Error(
    "root deno.json must declare a semver-compatible string version",
  );
}

export const WEAVE_VERSION = version;

function isSupportedVersion(value: string): boolean {
  return /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(
    value,
  );
}
