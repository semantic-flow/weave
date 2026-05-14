import { fromFileUrl, join } from "@std/path";
import {
  createBinaryBundleMetadata,
  readRootVersion,
  type ReleasePlatform,
  selectReleasePlatforms,
} from "./release/metadata.ts";

export interface BuildBinariesOptions {
  outDir: string;
  platformLabels: string[];
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
        throw new Error(`Unsupported build:binaries argument: ${arg}`);
    }
  }

  return { outDir, platformLabels };
}

export async function buildBinaries(
  options: BuildBinariesOptions,
): Promise<void> {
  const version = readRootVersion();
  const platforms = selectReleasePlatforms(options.platformLabels);
  const repoRoot = fromFileUrl(new URL("..", import.meta.url));
  const entrypoint = join(repoRoot, "src", "main.ts");
  const outDir = resolveRepoPath(repoRoot, options.outDir);

  for (const platform of platforms) {
    await buildPlatformBinary({
      entrypoint,
      outDir,
      platform,
      repoRoot,
      version,
    });
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
    args: [
      "compile",
      "--allow-read",
      "--allow-write",
      "--allow-env",
      "--allow-run=git,deno",
      "--target",
      options.platform.denoTarget,
      "--output",
      executablePath,
      options.entrypoint,
    ],
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

function resolveRepoPath(repoRoot: string, path: string): string {
  if (path.startsWith("/")) {
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
