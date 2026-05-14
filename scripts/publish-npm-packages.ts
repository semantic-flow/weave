import { fromFileUrl, join } from "@std/path";
import { readRootVersionFrom } from "./release/metadata.ts";
import {
  NPM_COMMAND_NAME,
  NPM_PACKAGES_METADATA_FILENAME,
  npmPackagePath,
  type NpmPackagesMetadata,
  type NpmPlatformPackageMetadata,
  readNpmPackagesMetadata,
} from "./release/npm.ts";

export interface PublishNpmPackagesOptions {
  root: string;
  inputDir: string;
  npmBin: string;
  tag: string;
  dryRun: boolean;
  provenance: boolean;
}

export interface NpmPublishTarget {
  packageName: string;
  packageDir: string;
}

const defaultRoot = fromFileUrl(new URL("..", import.meta.url));
const defaultInputDir = "dist/npm";

if (import.meta.main) {
  try {
    await publishNpmPackages(parsePublishNpmPackagesArgs(Deno.args));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    Deno.exit(1);
  }
}

export function parsePublishNpmPackagesArgs(
  args: readonly string[],
): PublishNpmPackagesOptions {
  let root = defaultRoot;
  let inputDir = defaultInputDir;
  let npmBin = "npm";
  let tag = "latest";
  let dryRun = false;
  let provenance = false;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    switch (arg) {
      case "--":
        break;
      case "--root":
        index += 1;
        root = requireArgumentValue(args[index], "--root");
        break;
      case "--input-dir":
        index += 1;
        inputDir = requireArgumentValue(args[index], "--input-dir");
        break;
      case "--npm-bin":
        index += 1;
        npmBin = requireArgumentValue(args[index], "--npm-bin");
        break;
      case "--tag":
        index += 1;
        tag = requireArgumentValue(args[index], "--tag");
        break;
      case "--dry-run":
        dryRun = true;
        break;
      case "--provenance":
        provenance = true;
        break;
      default:
        if (arg.startsWith("--root=")) {
          root = requireArgumentValue(arg.slice("--root=".length), "--root");
          break;
        }
        if (arg.startsWith("--input-dir=")) {
          inputDir = requireArgumentValue(
            arg.slice("--input-dir=".length),
            "--input-dir",
          );
          break;
        }
        if (arg.startsWith("--npm-bin=")) {
          npmBin = requireArgumentValue(
            arg.slice("--npm-bin=".length),
            "--npm-bin",
          );
          break;
        }
        if (arg.startsWith("--tag=")) {
          tag = requireArgumentValue(arg.slice("--tag=".length), "--tag");
          break;
        }
        throw new Error(`Unsupported publish:npm-packages argument: ${arg}`);
    }
  }

  return { root, inputDir, npmBin, tag, dryRun, provenance };
}

export async function publishNpmPackages(
  options: PublishNpmPackagesOptions,
): Promise<NpmPublishTarget[]> {
  const version = await readRootVersionFrom(options.root);
  const inputDir = resolveRootPath(options.root, options.inputDir);
  const metadata = await readNpmPackagesMetadata(
    join(inputDir, NPM_PACKAGES_METADATA_FILENAME),
  );
  assertNpmPackagesVersion(metadata, version);

  const targets = await resolvedPublicationOrder(metadata, inputDir);
  const packageDirsByName = new Map(
    targets.map((target) => [target.packageName, target.packageDir]),
  );

  const wrapperDir = packageDirsByName.get(metadata.wrapperPackageName);
  if (wrapperDir === undefined) {
    throw new Error(
      `Resolved publication order did not include wrapper package ${metadata.wrapperPackageName}`,
    );
  }
  await restoreWrapperPackageExecutableModes(wrapperDir);

  for (const platformPackage of metadata.platformPackages) {
    const packageDir = packageDirsByName.get(platformPackage.packageName);
    if (packageDir === undefined) {
      throw new Error(
        `Resolved publication order did not include platform package ${platformPackage.packageName}`,
      );
    }
    await restorePlatformPackageExecutableModes(packageDir, platformPackage);
  }

  for (const target of targets) {
    await runCommand({
      args: npmPublishArgs(options),
      command: options.npmBin,
      cwd: target.packageDir,
    });
  }

  return targets;
}

export function publicationOrder(
  metadata: NpmPackagesMetadata,
): NpmPublishTarget[] {
  return [
    ...metadata.platformPackages
      .slice()
      .sort((left, right) => left.packageName.localeCompare(right.packageName))
      .map((entry) => ({
        packageName: entry.packageName,
        packageDir: entry.packageDir,
      })),
    {
      packageName: metadata.wrapperPackageName,
      packageDir: metadata.wrapperPackageDir,
    },
  ];
}

export async function resolvedPublicationOrder(
  metadata: NpmPackagesMetadata,
  inputDir: string,
): Promise<NpmPublishTarget[]> {
  const ordered = publicationOrder(metadata);
  const resolvedTargets: NpmPublishTarget[] = [];

  for (const target of ordered) {
    resolvedTargets.push({
      packageName: target.packageName,
      packageDir: await resolvePackageDir(
        inputDir,
        target.packageName,
        target.packageDir,
      ),
    });
  }

  return resolvedTargets;
}

export function npmPublishArgs(options: {
  tag: string;
  dryRun: boolean;
  provenance: boolean;
}): string[] {
  const args = ["publish", "--tag", options.tag];
  if (options.dryRun) {
    args.push("--dry-run");
  } else if (options.provenance) {
    args.push("--provenance");
  }
  return args;
}

async function resolvePackageDir(
  inputDir: string,
  packageName: string,
  preferredPath: string,
): Promise<string> {
  const candidates = [
    preferredPath,
    npmPackagePath(inputDir, packageName),
  ];

  for (const candidate of candidates) {
    try {
      const stat = await Deno.stat(candidate);
      if (stat.isDirectory) {
        return candidate;
      }
    } catch (error) {
      if (!(error instanceof Deno.errors.NotFound)) {
        throw error;
      }
    }
  }

  throw new Error(
    `Could not resolve assembled npm package ${packageName} under ${inputDir}`,
  );
}

async function restoreWrapperPackageExecutableModes(
  packageDir: string,
): Promise<void> {
  await chmodExecutable(join(packageDir, "bin", `${NPM_COMMAND_NAME}.js`));
}

async function restorePlatformPackageExecutableModes(
  packageDir: string,
  platformPackage: NpmPlatformPackageMetadata,
): Promise<void> {
  await chmodExecutable(
    join(packageDir, "bin", platformPackage.executableName),
  );
}

async function chmodExecutable(path: string): Promise<void> {
  if (Deno.build.os !== "windows") {
    await Deno.chmod(path, 0o755);
  }
}

async function runCommand(options: {
  command: string;
  args: string[];
  cwd: string;
}): Promise<void> {
  console.log(
    `$ (cd ${options.cwd} && ${options.command} ${options.args.join(" ")})`,
  );
  const command = new Deno.Command(options.command, {
    args: options.args,
    cwd: options.cwd,
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  });
  const status = await command.spawn().status;
  if (!status.success) {
    throw new Error(
      `Command failed with exit code ${status.code}: ${options.command} ${
        options.args.join(" ")
      }`,
    );
  }
}

function assertNpmPackagesVersion(
  metadata: NpmPackagesMetadata,
  expectedVersion: string,
): void {
  if (metadata.version !== expectedVersion) {
    throw new Error(
      `npm package metadata version ${metadata.version} does not match root version ${expectedVersion}`,
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
