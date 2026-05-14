import denoConfig from "../../deno.json" with { type: "json" };
import { join } from "@std/path";

export type ReleasePlatformLabel =
  | "linux-x64"
  | "windows-x64"
  | "macos-x64"
  | "macos-arm64";

export interface ReleasePlatform {
  label: ReleasePlatformLabel;
  denoTarget: string;
  os: "linux" | "darwin" | "win32";
  cpu: "x64" | "arm64";
  archiveExtension: ".tar.gz" | ".zip";
  executableName: "weave" | "weave.exe";
  npmPackageName: string;
}

export interface BinaryBundleMetadata {
  packageName: string;
  wrapperPackageName: string;
  version: string;
  platform: ReleasePlatformLabel;
  os: ReleasePlatform["os"];
  cpu: ReleasePlatform["cpu"];
  denoTarget: string;
  executableName: ReleasePlatform["executableName"];
  bundleDirectoryName: string;
  archiveName: string;
  checksumName: string;
}

export const NPM_WRAPPER_PACKAGE_NAME = "@semantic-flow/weave";

export const RELEASE_PLATFORMS: readonly ReleasePlatform[] = [
  {
    label: "linux-x64",
    denoTarget: "x86_64-unknown-linux-gnu",
    os: "linux",
    cpu: "x64",
    archiveExtension: ".tar.gz",
    executableName: "weave",
    npmPackageName: "@semantic-flow/weave-linux-x64",
  },
  {
    label: "windows-x64",
    denoTarget: "x86_64-pc-windows-msvc",
    os: "win32",
    cpu: "x64",
    archiveExtension: ".zip",
    executableName: "weave.exe",
    npmPackageName: "@semantic-flow/weave-windows-x64",
  },
  {
    label: "macos-x64",
    denoTarget: "x86_64-apple-darwin",
    os: "darwin",
    cpu: "x64",
    archiveExtension: ".tar.gz",
    executableName: "weave",
    npmPackageName: "@semantic-flow/weave-macos-x64",
  },
  {
    label: "macos-arm64",
    denoTarget: "aarch64-apple-darwin",
    os: "darwin",
    cpu: "arm64",
    archiveExtension: ".tar.gz",
    executableName: "weave",
    npmPackageName: "@semantic-flow/weave-macos-arm64",
  },
] as const;

export function readRootVersion(): string {
  return requireSupportedVersion(denoConfig.version);
}

export async function readRootVersionFrom(root: string): Promise<string> {
  const denoConfigPath = join(root, "deno.json");
  const config = JSON.parse(
    await Deno.readTextFile(denoConfigPath),
  ) as { version?: unknown };
  return requireSupportedVersion(config.version);
}

export function createBundleDirectoryName(
  version: string,
  platform: ReleasePlatform,
): string {
  if (!isSupportedVersion(version)) {
    throw new Error(`Unsupported release version: ${version}`);
  }
  return `weave-v${version}-${platform.label}`;
}

export function createArchiveName(
  version: string,
  platform: ReleasePlatform,
): string {
  return `${
    createBundleDirectoryName(version, platform)
  }${platform.archiveExtension}`;
}

export function createBinaryBundleMetadata(
  version: string,
  platform: ReleasePlatform,
): BinaryBundleMetadata {
  if (!isSupportedVersion(version)) {
    throw new Error(`Unsupported release version: ${version}`);
  }

  const bundleDirectoryName = createBundleDirectoryName(version, platform);
  const archiveName = `${bundleDirectoryName}${platform.archiveExtension}`;

  return {
    packageName: platform.npmPackageName,
    wrapperPackageName: NPM_WRAPPER_PACKAGE_NAME,
    version,
    platform: platform.label,
    os: platform.os,
    cpu: platform.cpu,
    denoTarget: platform.denoTarget,
    executableName: platform.executableName,
    bundleDirectoryName,
    archiveName,
    checksumName: `${archiveName}.sha256`,
  };
}

export function getReleasePlatform(
  label: string,
): ReleasePlatform | undefined {
  return RELEASE_PLATFORMS.find((platform) => platform.label === label);
}

export function selectReleasePlatforms(
  labels: readonly string[],
): ReleasePlatform[] {
  if (labels.length === 0) {
    return [...RELEASE_PLATFORMS];
  }

  const seen = new Set<string>();
  return labels.map((label) => {
    if (seen.has(label)) {
      throw new Error(`Release platform selected more than once: ${label}`);
    }
    seen.add(label);

    const platform = getReleasePlatform(label);
    if (platform === undefined) {
      const supported = RELEASE_PLATFORMS.map((entry) => entry.label).join(
        ", ",
      );
      throw new Error(
        `Unsupported release platform: ${label}. Supported platforms: ${supported}`,
      );
    }

    return platform;
  });
}

function requireSupportedVersion(value: unknown): string {
  if (typeof value !== "string" || !isSupportedVersion(value)) {
    throw new Error(
      "root deno.json must declare a semver-compatible string version",
    );
  }
  return value;
}

function isSupportedVersion(value: string): boolean {
  return /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(
    value,
  );
}
