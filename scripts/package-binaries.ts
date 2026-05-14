import { fromFileUrl, join } from "@std/path";
import {
  type ArchiveEntry,
  createTarGzArchive,
  createZipArchive,
  renderChecksumFile,
  sha256Hex,
} from "./release/archive.ts";
import {
  type BinaryBundleMetadata,
  createBinaryBundleMetadata,
  readRootVersionFrom,
  type ReleasePlatform,
  selectReleasePlatforms,
} from "./release/metadata.ts";

export interface PackageBinariesOptions {
  root: string;
  buildDir: string;
  outDir: string;
  platformLabels: string[];
}

export interface PackageBinaryResult {
  platform: string;
  archivePath: string;
  checksumPath: string;
  checksum: string;
}

const defaultRoot = fromFileUrl(new URL("..", import.meta.url));
const defaultBuildDir = "dist/binaries";
const defaultOutDir = "dist/release";
const textEncoder = new TextEncoder();

if (import.meta.main) {
  try {
    const results = await packageBinaries(parsePackageBinariesArgs(Deno.args));
    for (const result of results) {
      console.log(`Packaged ${result.platform}: ${result.archivePath}`);
      console.log(`Checksum: ${result.checksumPath}`);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    Deno.exit(1);
  }
}

export function parsePackageBinariesArgs(
  args: readonly string[],
): PackageBinariesOptions {
  let root = defaultRoot;
  let buildDir = defaultBuildDir;
  let outDir = defaultOutDir;
  const platformLabels: string[] = [];

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    switch (arg) {
      case "--":
        break;
      case "--root":
        index += 1;
        root = requireArgumentValue(args[index], "--root");
        break;
      case "--build-dir":
        index += 1;
        buildDir = requireArgumentValue(args[index], "--build-dir");
        break;
      case "--out-dir":
        index += 1;
        outDir = requireArgumentValue(args[index], "--out-dir");
        break;
      case "--platform":
        index += 1;
        platformLabels.push(requireArgumentValue(args[index], "--platform"));
        break;
      default:
        if (arg.startsWith("--root=")) {
          root = requireArgumentValue(arg.slice("--root=".length), "--root");
          break;
        }
        if (arg.startsWith("--build-dir=")) {
          buildDir = requireArgumentValue(
            arg.slice("--build-dir=".length),
            "--build-dir",
          );
          break;
        }
        if (arg.startsWith("--out-dir=")) {
          outDir = requireArgumentValue(
            arg.slice("--out-dir=".length),
            "--out-dir",
          );
          break;
        }
        if (arg.startsWith("--platform=")) {
          platformLabels.push(
            requireArgumentValue(arg.slice("--platform=".length), "--platform"),
          );
          break;
        }
        throw new Error(`Unsupported package:binaries argument: ${arg}`);
    }
  }

  return { root, buildDir, outDir, platformLabels };
}

export async function packageBinaries(
  options: PackageBinariesOptions,
): Promise<PackageBinaryResult[]> {
  const version = await readRootVersionFrom(options.root);
  const platforms = selectReleasePlatforms(options.platformLabels);
  const buildDir = resolveRootPath(options.root, options.buildDir);
  const outDir = resolveRootPath(options.root, options.outDir);

  await Deno.mkdir(outDir, { recursive: true });

  const results: PackageBinaryResult[] = [];
  for (const platform of platforms) {
    results.push(
      await packagePlatformBinary({
        buildDir,
        outDir,
        platform,
        root: options.root,
        version,
      }),
    );
  }
  return results;
}

async function packagePlatformBinary(options: {
  buildDir: string;
  outDir: string;
  platform: ReleasePlatform;
  root: string;
  version: string;
}): Promise<PackageBinaryResult> {
  const platformBuildDir = join(options.buildDir, options.platform.label);
  const expectedMetadata = createBinaryBundleMetadata(
    options.version,
    options.platform,
  );
  const metadataPath = join(platformBuildDir, "bundle-metadata.json");
  const metadata = await readBundleMetadata(metadataPath);
  assertBundleMetadata(metadata, expectedMetadata, metadataPath);

  const entries = await createArchiveEntries({
    metadata,
    platformBuildDir,
    root: options.root,
  });
  const archiveBytes = options.platform.archiveExtension === ".zip"
    ? createZipArchive(entries)
    : await createTarGzArchive(entries);
  const archivePath = join(options.outDir, metadata.archiveName);
  const checksum = await sha256Hex(archiveBytes);
  const checksumPath = join(options.outDir, metadata.checksumName);

  await Deno.writeFile(archivePath, archiveBytes);
  await Deno.writeTextFile(
    checksumPath,
    renderChecksumFile(checksum, metadata.archiveName),
  );

  return {
    platform: options.platform.label,
    archivePath,
    checksumPath,
    checksum,
  };
}

async function createArchiveEntries(options: {
  metadata: BinaryBundleMetadata;
  platformBuildDir: string;
  root: string;
}): Promise<ArchiveEntry[]> {
  const bundlePrefix = options.metadata.bundleDirectoryName;
  const binaryPath = join(
    options.platformBuildDir,
    options.metadata.executableName,
  );
  const metadataPath = join(options.platformBuildDir, "bundle-metadata.json");
  const licensePath = join(options.root, "LICENSE");

  const entries: ArchiveEntry[] = [
    {
      name: `${bundlePrefix}/${options.metadata.executableName}`,
      data: await Deno.readFile(binaryPath),
      executable: true,
    },
    {
      name: `${bundlePrefix}/bundle-metadata.json`,
      data: await Deno.readFile(metadataPath),
    },
    {
      name: `${bundlePrefix}/README.md`,
      data: textEncoder.encode(renderArchiveReadme(options.metadata)),
    },
  ];

  try {
    entries.push({
      name: `${bundlePrefix}/LICENSE`,
      data: await Deno.readFile(licensePath),
    });
  } catch (error) {
    if (!(error instanceof Deno.errors.NotFound)) {
      throw error;
    }
  }

  return entries;
}

function renderArchiveReadme(metadata: BinaryBundleMetadata): string {
  const runPrefix = metadata.os === "win32" ? "" : "./";
  return `# Weave ${metadata.version} ${metadata.platform}

This archive contains the \`${metadata.executableName}\` CLI for ${metadata.platform}.

Run \`${runPrefix}${metadata.executableName} --version\` after extracting on a matching platform.
`;
}

async function readBundleMetadata(
  path: string,
): Promise<BinaryBundleMetadata> {
  return JSON.parse(await Deno.readTextFile(path)) as BinaryBundleMetadata;
}

function assertBundleMetadata(
  actual: BinaryBundleMetadata,
  expected: BinaryBundleMetadata,
  path: string,
): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `Bundle metadata does not match expected release metadata: ${path}`,
    );
  }
}

function resolveRootPath(root: string, path: string): string {
  if (path.startsWith("/")) {
    return path;
  }
  return join(root, path);
}

function requireArgumentValue(value: string | undefined, name: string): string {
  if (value === undefined || value.trim().length === 0) {
    throw new Error(`${name} requires a value`);
  }
  return value;
}
