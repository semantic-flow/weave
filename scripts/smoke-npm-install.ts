import { fromFileUrl, isAbsolute, join } from "@std/path";
import { readRootVersionFrom } from "./release/metadata.ts";
import {
  NPM_PACKAGES_METADATA_FILENAME,
  npmPackagePath,
  type NpmPackagesMetadata,
  type NpmPlatformPackageMetadata,
  readNpmPackagesMetadata,
} from "./release/npm.ts";

export interface SmokeNpmInstallOptions {
  root: string;
  inputDir: string;
  workDir: string;
  npmBin: string;
}

export interface SmokeNpmInstallResult {
  projectDir: string;
  wrapperTarball: string;
  platformTarball: string;
  versionOutput: string;
}

const defaultRoot = fromFileUrl(new URL("..", import.meta.url));
const defaultInputDir = "dist/npm";
const defaultWorkDir = "dist/npm-install-smoke";

if (import.meta.main) {
  try {
    const result = await smokeNpmInstall(parseSmokeNpmInstallArgs(Deno.args));
    console.log(result.versionOutput.trim());
    console.log(`npm install smoke passed in ${result.projectDir}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    Deno.exit(1);
  }
}

export function parseSmokeNpmInstallArgs(
  args: readonly string[],
): SmokeNpmInstallOptions {
  let root = defaultRoot;
  let inputDir = defaultInputDir;
  let workDir = defaultWorkDir;
  let npmBin = "npm";

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
      case "--work-dir":
        index += 1;
        workDir = requireArgumentValue(args[index], "--work-dir");
        break;
      case "--npm-bin":
        index += 1;
        npmBin = requireArgumentValue(args[index], "--npm-bin");
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
        if (arg.startsWith("--work-dir=")) {
          workDir = requireArgumentValue(
            arg.slice("--work-dir=".length),
            "--work-dir",
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
        throw new Error(`Unsupported smoke:npm-install argument: ${arg}`);
    }
  }

  return { root, inputDir, workDir, npmBin };
}

export async function smokeNpmInstall(
  options: SmokeNpmInstallOptions,
): Promise<SmokeNpmInstallResult> {
  const version = await readRootVersionFrom(options.root);
  const inputDir = resolveRootPath(options.root, options.inputDir);
  const workDir = resolveRootPath(options.root, options.workDir);
  const packagesMetadata = await readNpmPackagesMetadata(
    join(inputDir, NPM_PACKAGES_METADATA_FILENAME),
  );
  assertNpmPackagesVersion(packagesMetadata, version);
  const platformPackage = hostNpmPlatformPackage(packagesMetadata);
  const wrapperDir = await resolvePackageDir(
    inputDir,
    packagesMetadata.wrapperPackageName,
    packagesMetadata.wrapperPackageDir,
  );
  const platformDir = await resolvePackageDir(
    inputDir,
    platformPackage.packageName,
    platformPackage.packageDir,
  );

  await ensurePackageDir(wrapperDir);
  await ensurePackageDir(platformDir);
  await restoreExecutableModes(wrapperDir, platformDir, platformPackage);

  const wrapperTarball = await npmPack(options.npmBin, wrapperDir);
  const platformTarball = await npmPack(options.npmBin, platformDir);
  const projectDir = join(workDir, "project");

  await resetDirectory(workDir);
  await Deno.mkdir(projectDir, { recursive: true });
  await Deno.writeTextFile(
    join(projectDir, "package.json"),
    `${JSON.stringify({ name: "weave-npm-install-smoke", private: true })}\n`,
  );

  await runCommand({
    command: options.npmBin,
    args: [
      "install",
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
      "--no-package-lock",
      wrapperTarball,
      platformTarball,
    ],
    cwd: projectDir,
  });

  const versionOutput = await runCommand({
    command: localProjectCommandPath(projectDir, packagesMetadata.commandName),
    args: ["--version"],
    cwd: projectDir,
    stdout: "piped",
  });
  const expectedVersionOutput = `${packagesMetadata.commandName} ${version}`;
  if (versionOutput.trim() !== expectedVersionOutput) {
    throw new Error(
      `Expected npm-installed ${packagesMetadata.commandName} --version to print ${expectedVersionOutput}, got ${versionOutput.trim()}`,
    );
  }

  return {
    projectDir,
    wrapperTarball,
    platformTarball,
    versionOutput,
  };
}

export function currentNodeArch(): string {
  switch (Deno.build.arch) {
    case "x86_64":
      return "x64";
    case "aarch64":
      return "arm64";
    default:
      return Deno.build.arch;
  }
}

export function currentNodePlatform(): string {
  return Deno.build.os === "windows" ? "win32" : Deno.build.os;
}

export function hostNpmPlatformPackage(
  metadata: NpmPackagesMetadata,
  os: string = currentNodePlatform(),
  cpu: string = currentNodeArch(),
): NpmPlatformPackageMetadata {
  const platform = metadata.platformPackages.find((entry) =>
    entry.os === os && entry.cpu === cpu
  );
  if (platform === undefined) {
    throw new Error(
      `No Weave npm platform package supports host ${os}/${cpu}`,
    );
  }
  return platform;
}

export function localProjectCommandPath(
  projectDir: string,
  command: string,
  os: string = Deno.build.os,
): string {
  return join(
    projectDir,
    "node_modules",
    ".bin",
    os === "windows" ? `${command}.cmd` : command,
  );
}

async function npmPack(
  npmBin: string,
  packageDir: string,
): Promise<string> {
  const output = await runCommand({
    command: npmBin,
    args: ["pack", "--json"],
    cwd: packageDir,
    stdout: "piped",
  });
  const parsed = JSON.parse(output) as Array<{ filename?: string }>;
  const filename = parsed[0]?.filename;
  if (filename === undefined || filename.length === 0) {
    throw new Error(`npm pack did not return a filename for ${packageDir}`);
  }
  return join(packageDir, filename);
}

async function runCommand(options: {
  command: string;
  args: string[];
  cwd: string;
  stdout?: "inherit" | "piped";
}): Promise<string> {
  const command = new Deno.Command(options.command, {
    args: options.args,
    cwd: options.cwd,
    stdin: "null",
    stdout: options.stdout ?? "inherit",
    stderr: "inherit",
  });
  const output = await command.output();
  if (!output.success) {
    throw new Error(
      `Command failed with exit code ${output.code}: ${options.command} ${
        options.args.join(" ")
      }`,
    );
  }
  return options.stdout === "piped"
    ? new TextDecoder().decode(output.stdout)
    : "";
}

async function restoreExecutableModes(
  wrapperDir: string,
  platformDir: string,
  platformPackage: NpmPlatformPackageMetadata,
): Promise<void> {
  await chmodExecutable(join(wrapperDir, "bin", "weave.js"));
  await chmodExecutable(
    join(platformDir, "bin", platformPackage.executableName),
  );
}

async function chmodExecutable(path: string): Promise<void> {
  if (Deno.build.os !== "windows") {
    await Deno.chmod(path, 0o755);
  }
}

async function ensurePackageDir(path: string): Promise<void> {
  const stat = await Deno.stat(path).catch((error) => {
    if (error instanceof Deno.errors.NotFound) {
      throw new Error(`Missing assembled npm package directory: ${path}`);
    }
    throw error;
  });
  if (!stat.isDirectory) {
    throw new Error(`Assembled npm package path is not a directory: ${path}`);
  }
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

async function resetDirectory(path: string): Promise<void> {
  await Deno.remove(path, { recursive: true }).catch((error) => {
    if (!(error instanceof Deno.errors.NotFound)) {
      throw error;
    }
  });
  await Deno.mkdir(path, { recursive: true });
}

function resolveRootPath(root: string, path: string): string {
  if (isAbsolute(path)) {
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
