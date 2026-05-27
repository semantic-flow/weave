import { resolve } from "@std/path";
import { coverageJunitPath } from "./coverage-paths.ts";

const defaultReportPath = coverageJunitPath;
const defaultFlags = ["deno", "local"];
const defaultName = "local-test-results";
const tokenEnvNames = ["CODECOV_TOKEN_SEMANTIC_FLOW", "CODECOV_TOKEN"] as const;

export interface UploadCodecovTestResultsOptions {
  root: string;
  reportPath: string;
  flags: readonly string[];
  name: string;
}

export interface UploadCodecovTestResultsResult {
  command: string;
  code: number;
  success: boolean;
}

if (import.meta.main) {
  try {
    const result = await uploadCodecovTestResults(
      parseUploadCodecovTestResultsArgs(Deno.args),
    );
    Deno.exit(result.code);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    Deno.exit(1);
  }
}

export function parseUploadCodecovTestResultsArgs(
  args: readonly string[],
): UploadCodecovTestResultsOptions {
  let root = Deno.cwd();
  let reportPath = defaultReportPath;
  const flags: string[] = [];
  let name = Deno.env.get("CODECOV_TEST_RESULTS_NAME") ?? defaultName;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    switch (arg) {
      case "--":
        break;
      case "--root":
        index += 1;
        root = requireArgumentValue(args[index], "--root");
        break;
      case "--report":
        index += 1;
        reportPath = requireArgumentValue(args[index], "--report");
        break;
      case "--flag":
        index += 1;
        flags.push(requireArgumentValue(args[index], "--flag"));
        break;
      case "--name":
        index += 1;
        name = requireArgumentValue(args[index], "--name");
        break;
      default:
        if (arg.startsWith("--root=")) {
          root = requireArgumentValue(arg.slice("--root=".length), "--root");
          break;
        }
        if (arg.startsWith("--report=")) {
          reportPath = requireArgumentValue(
            arg.slice("--report=".length),
            "--report",
          );
          break;
        }
        if (arg.startsWith("--flag=")) {
          flags.push(
            requireArgumentValue(arg.slice("--flag=".length), "--flag"),
          );
          break;
        }
        if (arg.startsWith("--name=")) {
          name = requireArgumentValue(arg.slice("--name=".length), "--name");
          break;
        }
        throw new Error(`Unsupported codecov:test-results argument: ${arg}`);
    }
  }

  return {
    root,
    reportPath,
    flags: flags.length > 0 ? flags : configuredFlags(),
    name,
  };
}

export async function uploadCodecovTestResults(
  options: UploadCodecovTestResultsOptions,
): Promise<UploadCodecovTestResultsResult> {
  const token = resolveCodecovToken();
  if (token === undefined) {
    throw new Error(
      "CODECOV_TOKEN_SEMANTIC_FLOW or CODECOV_TOKEN must be set before uploading local test results to Codecov",
    );
  }

  const reportFile = resolve(options.root, options.reportPath);
  try {
    const stat = await Deno.stat(reportFile);
    if (!stat.isFile) {
      throw new Error(
        `Codecov test results report is not a file: ${reportFile}`,
      );
    }
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      throw new Error(
        `Codecov test results report not found: ${reportFile}. Run deno task test:coverage or deno task test:analytics first, or pass --report.`,
      );
    }
    throw error;
  }

  const command = await findCodecovCommand();
  const args = [
    "do-upload",
    "--report-type",
    "test_results",
    "--file",
    options.reportPath,
    "--name",
    options.name,
    "-Z",
  ];
  for (const flag of options.flags) {
    args.push("--flag", flag);
  }

  console.log(
    `Uploading ${options.reportPath} to Codecov Test Analytics with ${command}`,
  );
  const status = await new Deno.Command(command, {
    args,
    cwd: options.root,
    env: { CODECOV_TOKEN: token },
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  }).spawn().status;

  return {
    command,
    code: status.code,
    success: status.success,
  };
}

export function resolveCodecovToken(): string | undefined {
  for (const name of tokenEnvNames) {
    const token = Deno.env.get(name);
    if (token !== undefined && token.trim().length > 0) {
      return token;
    }
  }
  return undefined;
}

function configuredFlags(): string[] {
  const rawFlags = Deno.env.get("CODECOV_TEST_RESULTS_FLAGS");
  if (rawFlags === undefined || rawFlags.trim().length === 0) {
    return defaultFlags;
  }
  const flags = rawFlags.split(",").map((flag) => flag.trim()).filter(Boolean);
  return flags.length > 0 ? flags : defaultFlags;
}

async function findCodecovCommand(): Promise<string> {
  for (const command of ["codecovcli", "codecov"]) {
    try {
      const output = await new Deno.Command(command, {
        args: ["--version"],
        stdout: "null",
        stderr: "null",
      }).output();
      if (output.success) {
        return command;
      }
    } catch (error) {
      if (!(error instanceof Deno.errors.NotFound)) {
        throw error;
      }
    }
  }

  throw new Error(
    "Codecov CLI not found. Install it with pip install codecov-cli, or put the Codecov binary on PATH.",
  );
}

function requireArgumentValue(value: string | undefined, name: string): string {
  if (value === undefined || value.trim().length === 0) {
    throw new Error(`${name} requires a value`);
  }
  return value;
}
