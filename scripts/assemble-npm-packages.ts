import { fromFileUrl, join } from "@std/path";
import {
  createPlatformPackageJson,
  createWrapperPackageJson,
  NPM_COMMAND_NAME,
  NPM_PACKAGES_METADATA_FILENAME,
  npmPackagePath,
  type NpmPackagesMetadata,
  type NpmPlatformPackageMetadata,
  renderPlatformReadme,
  renderWrapperBinScript,
  renderWrapperReadme,
} from "./release/npm.ts";
import {
  assertBinaryBundleMetadata,
  createBinaryBundleMetadata,
  NPM_WRAPPER_PACKAGE_NAME,
  readBinaryBundleMetadata,
  readRootVersionFrom,
  type ReleasePlatform,
  selectReleasePlatforms,
} from "./release/metadata.ts";

export interface AssembleNpmPackagesOptions {
  root: string;
  buildDir: string;
  outDir: string;
  platformLabels: string[];
}

export interface AssembleNpmPackagesResult {
  wrapperPackageDir: string;
  platformPackageDirs: string[];
  packagesMetadataPath: string;
}

const defaultRoot = fromFileUrl(new URL("..", import.meta.url));
const defaultBuildDir = "dist/binaries";
const defaultOutDir = "dist/npm";

if (import.meta.main) {
  try {
    const result = await assembleNpmPackages(
      parseAssembleNpmPackagesArgs(Deno.args),
    );
    console.log(`Assembled wrapper package: ${result.wrapperPackageDir}`);
    for (const packageDir of result.platformPackageDirs) {
      console.log(`Assembled platform package: ${packageDir}`);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    Deno.exit(1);
  }
}

export function parseAssembleNpmPackagesArgs(
  args: readonly string[],
): AssembleNpmPackagesOptions {
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
        throw new Error(`Unsupported assemble:npm-packages argument: ${arg}`);
    }
  }

  return { root, buildDir, outDir, platformLabels };
}

export async function assembleNpmPackages(
  options: AssembleNpmPackagesOptions,
): Promise<AssembleNpmPackagesResult> {
  const version = await readRootVersionFrom(options.root);
  const platforms = selectReleasePlatforms(options.platformLabels);
  const buildDir = resolveRootPath(options.root, options.buildDir);
  const outDir = resolveRootPath(options.root, options.outDir);

  const wrapperPackageDir = await writeWrapperPackage({
    outDir,
    platforms,
    root: options.root,
    version,
  });
  const platformResults: PlatformPackageAssemblyResult[] = [];

  for (const platform of platforms) {
    platformResults.push(
      await writePlatformPackage({
        buildDir,
        outDir,
        platform,
        root: options.root,
        version,
      }),
    );
  }

  const packagesMetadataPath = join(outDir, NPM_PACKAGES_METADATA_FILENAME);
  const packagesMetadata = createNpmPackagesMetadata({
    platformPackages: platformResults.map((result) => result.publishMetadata),
    version,
    wrapperPackageDir,
  });
  await writeJsonFile(packagesMetadataPath, packagesMetadata);

  return {
    wrapperPackageDir,
    platformPackageDirs: platformResults.map((result) => result.packageDir),
    packagesMetadataPath,
  };
}

async function writeWrapperPackage(options: {
  outDir: string;
  platforms: readonly ReleasePlatform[];
  root: string;
  version: string;
}): Promise<string> {
  const packageDir = npmPackagePath(options.outDir, NPM_WRAPPER_PACKAGE_NAME);
  await Deno.mkdir(join(packageDir, "bin"), { recursive: true });
  await writeJsonFile(
    join(packageDir, "package.json"),
    createWrapperPackageJson(options.version, options.platforms),
  );
  const binPath = join(packageDir, "bin", "weave.js");
  await Deno.writeTextFile(
    binPath,
    renderWrapperBinScript(options.platforms),
  );
  await chmodExecutable(binPath);
  await Deno.writeTextFile(
    join(packageDir, "README.md"),
    renderWrapperReadme(options.version),
  );
  await copyLicenseIfPresent(options.root, packageDir);
  return packageDir;
}

interface PlatformPackageAssemblyResult {
  packageDir: string;
  publishMetadata: NpmPlatformPackageMetadata;
}

function createNpmPackagesMetadata(options: {
  platformPackages: NpmPlatformPackageMetadata[];
  version: string;
  wrapperPackageDir: string;
}): NpmPackagesMetadata {
  return {
    createdAt: new Date().toISOString(),
    version: options.version,
    wrapperPackageName: NPM_WRAPPER_PACKAGE_NAME,
    wrapperPackageDir: options.wrapperPackageDir,
    wrapperPackageJsonPath: join(options.wrapperPackageDir, "package.json"),
    commandName: NPM_COMMAND_NAME,
    platformPackages: options.platformPackages,
  };
}

async function writePlatformPackage(options: {
  buildDir: string;
  outDir: string;
  platform: ReleasePlatform;
  root: string;
  version: string;
}): Promise<PlatformPackageAssemblyResult> {
  const platformBuildDir = join(options.buildDir, options.platform.label);
  const metadataPath = join(platformBuildDir, "bundle-metadata.json");
  const metadata = await readBinaryBundleMetadata(metadataPath);
  const expectedMetadata = createBinaryBundleMetadata(
    options.version,
    options.platform,
  );
  assertBinaryBundleMetadata(metadata, expectedMetadata, metadataPath);

  const packageDir = npmPackagePath(options.outDir, metadata.packageName);
  await Deno.mkdir(join(packageDir, "bin"), { recursive: true });
  await writeJsonFile(
    join(packageDir, "package.json"),
    createPlatformPackageJson(metadata),
  );
  await Deno.copyFile(metadataPath, join(packageDir, "bundle-metadata.json"));
  await Deno.writeTextFile(
    join(packageDir, "README.md"),
    renderPlatformReadme(metadata),
  );
  await copyLicenseIfPresent(options.root, packageDir);

  const sourceBinaryPath = join(platformBuildDir, metadata.executableName);
  const targetBinaryPath = join(packageDir, "bin", metadata.executableName);
  await Deno.copyFile(sourceBinaryPath, targetBinaryPath);
  await chmodExecutable(targetBinaryPath);

  return {
    packageDir,
    publishMetadata: {
      packageName: metadata.packageName,
      platform: metadata.platform,
      packageDir,
      packageJsonPath: join(packageDir, "package.json"),
      os: metadata.os,
      cpu: metadata.cpu,
      executableName: metadata.executableName,
      executablePath: targetBinaryPath,
      bundleMetadataPath: join(packageDir, "bundle-metadata.json"),
    },
  };
}

async function copyLicenseIfPresent(root: string, packageDir: string) {
  try {
    await Deno.copyFile(join(root, "LICENSE"), join(packageDir, "LICENSE"));
  } catch (error) {
    if (!(error instanceof Deno.errors.NotFound)) {
      throw error;
    }
  }
}

async function writeJsonFile(path: string, value: unknown): Promise<void> {
  await Deno.writeTextFile(path, `${JSON.stringify(value, null, 2)}\n`);
}

async function chmodExecutable(path: string): Promise<void> {
  if (Deno.build.os !== "windows") {
    await Deno.chmod(path, 0o755);
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
