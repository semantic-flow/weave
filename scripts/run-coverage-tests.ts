import {
  coverageCodecovJunitPath,
  coverageDir,
  coverageJunitPath,
} from "./coverage-paths.ts";
import { normalizeDenoJunitFile } from "./normalize-deno-junit.ts";
import { prepareCoverageDir } from "./prepare-coverage-dir.ts";

export interface RunCoverageTestsOptions {
  root: string;
  codecovJunitPath: string;
}

if (import.meta.main) {
  const status = await runCoverageTests(parseRunCoverageTestsArgs(Deno.args));
  Deno.exit(status.code);
}

export function parseRunCoverageTestsArgs(
  args: readonly string[],
): RunCoverageTestsOptions {
  let root = Deno.cwd();
  let codecovJunitPath = coverageCodecovJunitPath;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    switch (arg) {
      case "--":
        break;
      case "--root":
        index += 1;
        root = requireArgumentValue(args[index], "--root");
        break;
      case "--codecov-junit":
        index += 1;
        codecovJunitPath = requireArgumentValue(args[index], "--codecov-junit");
        break;
      default:
        if (arg.startsWith("--root=")) {
          root = requireArgumentValue(arg.slice("--root=".length), "--root");
          break;
        }
        if (arg.startsWith("--codecov-junit=")) {
          codecovJunitPath = requireArgumentValue(
            arg.slice("--codecov-junit=".length),
            "--codecov-junit",
          );
          break;
        }
        throw new Error(`Unsupported coverage test argument: ${arg}`);
    }
  }

  return { root, codecovJunitPath };
}

export async function runCoverageTests(
  options: RunCoverageTestsOptions,
): Promise<Deno.CommandStatus> {
  await prepareCoverageDir();

  const status = await new Deno.Command("deno", {
    args: coverageTestArgs(),
    cwd: options.root,
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  }).spawn().status;

  try {
    await normalizeDenoJunitFile({
      inputPath: coverageJunitPath,
      outputPath: options.codecovJunitPath,
    });
  } catch (error) {
    if (status.success) {
      throw error;
    }
    console.error(
      error instanceof Error
        ? `Unable to normalize Deno JUnit report after failing tests: ${error.message}`
        : `Unable to normalize Deno JUnit report after failing tests: ${
          String(error)
        }`,
    );
  }

  return status;
}

export function coverageTestArgs(): string[] {
  return [
    "test",
    "--clean",
    "--preload=tests/support/test_tmp_harness.ts",
    "--allow-read",
    "--allow-write",
    "--allow-run=git,deno",
    "--allow-env",
    `--coverage=${coverageDir}`,
    "--coverage-raw-data-only",
    `--junit-path=${coverageJunitPath}`,
    "src",
    "tests",
  ];
}

function requireArgumentValue(value: string | undefined, name: string): string {
  if (value === undefined || value.trim().length === 0) {
    throw new Error(`${name} requires a value`);
  }
  return value;
}
