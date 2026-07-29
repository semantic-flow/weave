import { fromFileUrl, isAbsolute, join } from "@std/path";
import {
  createBinaryBundleMetadata,
  readRootVersion,
  type ReleasePlatform,
  selectReleasePlatforms,
} from "./release/metadata.ts";

export interface BuildBinariesOptions {
  outDir: string;
  platformLabels: string[];
  commit?: string;
  built?: string;
}

export interface DenoCompileArgsOptions {
  entrypoint: string;
  executablePath: string;
  platform: ReleasePlatform;
}

const DEFAULT_OUT_DIR = "dist/binaries";

if (import.meta.main) {
  try {
    await buildBinaries(parseBuildBinariesArgs(Deno.args));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    Deno.exit(1);
  }
}

export function parseBuildBinariesArgs(
  args: readonly string[],
): BuildBinariesOptions {
  let outDir = DEFAULT_OUT_DIR;
  let commit: string | undefined;
  let built: string | undefined;
  const platformLabels: string[] = [];

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    switch (arg) {
      case "--":
        break;
      case "--out-dir":
        index += 1;
        outDir = requireArgumentValue(args[index], "--out-dir");
        break;
      case "--platform":
        index += 1;
        platformLabels.push(requireArgumentValue(args[index], "--platform"));
        break;
      case "--commit":
        index += 1;
        commit = requireArgumentValue(args[index], "--commit");
        break;
      case "--built":
        index += 1;
        built = requireArgumentValue(args[index], "--built");
        break;
      default:
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
        if (arg.startsWith("--commit=")) {
          commit = requireArgumentValue(
            arg.slice("--commit=".length),
            "--commit",
          );
          break;
        }
        if (arg.startsWith("--built=")) {
          built = requireArgumentValue(arg.slice("--built=".length), "--built");
          break;
        }
        throw new Error(`Unsupported build:binaries argument: ${arg}`);
    }
  }

  return { outDir, platformLabels, commit, built };
}

export async function buildBinaries(
  options: BuildBinariesOptions,
): Promise<void> {
  const version = readRootVersion();
  const platforms = selectReleasePlatforms(options.platformLabels);
  const repoRoot = fromFileUrl(new URL("..", import.meta.url));
  const entrypoint = join(repoRoot, "src", "main.ts");
  const outDir = resolveRepoPath(repoRoot, options.outDir);

  await withStampedBuildInfo(repoRoot, options, async () => {
    for (const platform of platforms) {
      await buildPlatformBinary({
        entrypoint,
        outDir,
        platform,
        repoRoot,
        version,
      });
    }
  });
}

// Stamps src/generated/build_info.ts for the duration of the compile and
// always restores the checked-in bytes, so local builds never leave the tree
// dirty. Without --commit/--built the checked-in nulls ship, which is the
// honest value for an unidentified build.
export async function withStampedBuildInfo(
  repoRoot: string,
  options: { commit?: string; built?: string },
  build: () => Promise<void>,
): Promise<void> {
  if (options.commit === undefined && options.built === undefined) {
    await build();
    return;
  }
  if (
    options.built !== undefined &&
    Number.isNaN(Date.parse(options.built))
  ) {
    throw new Error(`--built must be an ISO-8601 timestamp: ${options.built}`);
  }
  if (options.commit !== undefined && !/^[0-9a-f]{40}$/.test(options.commit)) {
    throw new Error(
      `--commit must be a full 40-hex git SHA: ${options.commit}`,
    );
  }

  const buildInfoPath = join(repoRoot, "src", "generated", "build_info.ts");
  const originalSource = await Deno.readTextFile(buildInfoPath);
  const stampedSource = originalSource
    .replace(
      "commit: null,",
      `commit: ${JSON.stringify(options.commit ?? null)},`,
    )
    .replace(
      "built: null,",
      `built: ${JSON.stringify(options.built ?? null)},`,
    );
  if (stampedSource === originalSource) {
    throw new Error(
      `Could not stamp build info: expected null placeholders in ${buildInfoPath}`,
    );
  }

  await Deno.writeTextFile(buildInfoPath, stampedSource);
  try {
    await build();
  } finally {
    await Deno.writeTextFile(buildInfoPath, originalSource);
  }
}

async function buildPlatformBinary(options: {
  entrypoint: string;
  outDir: string;
  platform: ReleasePlatform;
  repoRoot: string;
  version: string;
}): Promise<void> {
  const platformOutDir = join(options.outDir, options.platform.label);
  await Deno.mkdir(platformOutDir, { recursive: true });

  const executablePath = join(
    platformOutDir,
    options.platform.executableName,
  );
  const command = new Deno.Command("deno", {
    args: createDenoCompileArgs({
      entrypoint: options.entrypoint,
      executablePath,
      platform: options.platform,
    }),
    cwd: options.repoRoot,
    stdout: "inherit",
    stderr: "inherit",
  });

  console.log(
    `Building ${options.platform.label} binary with ${options.platform.denoTarget}`,
  );
  const status = await command.spawn().status;
  if (!status.success) {
    throw new Error(
      `deno compile failed for ${options.platform.label} with exit code ${status.code}`,
    );
  }

  const metadata = createBinaryBundleMetadata(
    options.version,
    options.platform,
  );
  await Deno.writeTextFile(
    join(platformOutDir, "bundle-metadata.json"),
    `${JSON.stringify(metadata, null, 2)}\n`,
  );
}

export function createDenoCompileArgs(
  options: DenoCompileArgsOptions,
): string[] {
  return [
    "compile",
    "--allow-read",
    "--allow-write",
    "--allow-env",
    "--allow-run=git,deno",
    "--include",
    "defaults",
    "--target",
    options.platform.denoTarget,
    "--output",
    options.executablePath,
    options.entrypoint,
  ];
}

function resolveRepoPath(repoRoot: string, path: string): string {
  if (isAbsolute(path)) {
    return path;
  }
  return join(repoRoot, path);
}

function requireArgumentValue(value: string | undefined, name: string): string {
  if (value === undefined || value.trim().length === 0) {
    throw new Error(`${name} requires a value`);
  }
  return value;
}
