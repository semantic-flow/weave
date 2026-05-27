import { coverageCodecovJunitPath } from "./coverage-paths.ts";
import { runCoverageTests } from "./run-coverage-tests.ts";
import {
  parseUploadCodecovTestResultsArgs,
  uploadCodecovTestResults,
  type UploadCodecovTestResultsOptions,
} from "./upload-codecov-test-results.ts";

if (import.meta.main) {
  const uploadOptions = analyticsUploadOptions(Deno.args);

  const testStatus = await runCoverageTests({
    root: uploadOptions.root,
    codecovJunitPath: uploadOptions.reportPath,
  });

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
    reportPath: coverageCodecovJunitPath,
  };
}

function reportArgProvided(args: readonly string[]): boolean {
  return args.some((arg) => arg === "--report" || arg.startsWith("--report="));
}
