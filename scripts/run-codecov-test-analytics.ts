import { dirname, resolve } from "@std/path";
import { coverageDir, coverageJunitPath } from "./coverage-paths.ts";
import { prepareCoverageDir } from "./prepare-coverage-dir.ts";
import {
  parseUploadCodecovTestResultsArgs,
  uploadCodecovTestResults,
  type UploadCodecovTestResultsOptions,
} from "./upload-codecov-test-results.ts";

if (import.meta.main) {
  const uploadOptions = analyticsUploadOptions(Deno.args);
  await prepareCoverageDir();
  await ensureReportDirectory(uploadOptions.root, uploadOptions.reportPath);

  const testStatus = await runCommand(
    "deno",
    coverageTestArgs(uploadOptions),
    uploadOptions.root,
  );

  let uploadCode = 0;
  try {
    const uploadResult = await uploadCodecovTestResults(uploadOptions);
    uploadCode = uploadResult.code;
  } catch (error) {
    uploadCode = 1;
    console.error(error instanceof Error ? error.message : String(error));
  }

  if (!testStatus.success) {
    Deno.exit(testStatus.code);
  }
  Deno.exit(uploadCode);
}

export function analyticsUploadOptions(
  args: readonly string[],
): UploadCodecovTestResultsOptions {
  const options = parseUploadCodecovTestResultsArgs(args);
  return reportArgProvided(args) ? options : {
    ...options,
    reportPath: coverageJunitPath,
  };
}

export function coverageTestArgs(
  options: UploadCodecovTestResultsOptions,
): string[] {
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
    `--junit-path=${options.reportPath}`,
    "src",
    "tests",
  ];
}

async function runCommand(
  command: string,
  args: readonly string[],
  cwd: string,
): Promise<Deno.CommandStatus> {
  return await new Deno.Command(command, {
    args: [...args],
    cwd,
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  }).spawn().status;
}

async function ensureReportDirectory(
  root: string,
  reportPath: string,
): Promise<void> {
  await Deno.mkdir(dirname(resolve(root, reportPath)), { recursive: true });
}

function reportArgProvided(args: readonly string[]): boolean {
  return args.some((arg) => arg === "--report" || arg.startsWith("--report="));
}
