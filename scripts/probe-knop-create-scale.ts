import { join } from "@std/path";
import { executeKnopCreate } from "../src/runtime/knop/create.ts";
import { executeMeshCreate } from "../src/runtime/mesh/create.ts";
import { executeWeave } from "../src/runtime/weave/weave.ts";

const DEFAULT_COUNT = 3;
const MESH_BASE = "https://example.org/stagecraft-scale-probe/";

export const KNOP_CREATE_SCALE_PROBE_HELP =
  `Usage: deno run --allow-read --allow-write --allow-env scripts/probe-knop-create-scale.ts [options]

Options:
  --count <positive integer>  Number of sequential Knops to create (default: ${DEFAULT_COUNT})
  --preserve                 Keep the temporary workspace and report its path
  -h, --help                 Show this help
`;

export interface KnopCreateScaleProbeOptions {
  count?: number;
  preserveWorkspace?: boolean;
  workspaceRoot?: string;
}

export interface KnopCreateScaleProbeArgs {
  count: number;
  preserveWorkspace: boolean;
  help: boolean;
}

export interface KnopCreateScaleProbeResult {
  workload: "knop.create-scale";
  requestedCreateCount: number;
  successfulCreateCount: number;
  createdFileCount: number;
  updatedFileCount: number;
  finalMeshInventoryBytes: number;
  elapsedMs: number;
  createElapsedMs: number;
  workspacePreserved: boolean;
  workspaceRoot?: string;
}

export async function runKnopCreateScaleProbe(
  options: KnopCreateScaleProbeOptions = {},
): Promise<KnopCreateScaleProbeResult> {
  const count = options.count ?? DEFAULT_COUNT;
  assertValidCount(count);
  const ownsWorkspace = options.workspaceRoot === undefined;
  const preserveWorkspace = (options.preserveWorkspace ?? false) ||
    !ownsWorkspace;
  const workspaceRoot = options.workspaceRoot ?? await Deno.makeTempDir({
    prefix: "weave-knop-create-scale-",
  });
  const startedAt = performance.now();
  let successfulCreateCount = 0;
  let createdFileCount = 0;
  let updatedFileCount = 0;
  let createStartedAt = startedAt;

  try {
    await executeMeshCreate({
      workspaceRoot,
      request: { meshBase: MESH_BASE },
    });
    await executeWeave({ meshRoot: workspaceRoot });

    const designatorWidth = Math.max(4, String(count).length);
    createStartedAt = performance.now();
    for (let index = 1; index <= count; index += 1) {
      const result = await executeKnopCreate({
        workspaceRoot,
        request: {
          designatorPath: `stagecraft/iri-${
            String(index).padStart(
              designatorWidth,
              "0",
            )
          }`,
        },
      });
      successfulCreateCount += 1;
      createdFileCount += result.createdPaths.length;
      updatedFileCount += result.updatedPaths.length;
    }
    const createFinishedAt = performance.now();

    const finalMeshInventoryBytes = (await Deno.stat(join(
      workspaceRoot,
      "_mesh/_inventory/inventory.ttl",
    ))).size;
    const result: KnopCreateScaleProbeResult = {
      workload: "knop.create-scale",
      requestedCreateCount: count,
      successfulCreateCount,
      createdFileCount,
      updatedFileCount,
      finalMeshInventoryBytes,
      elapsedMs: performance.now() - startedAt,
      createElapsedMs: createFinishedAt - createStartedAt,
      workspacePreserved: preserveWorkspace,
      ...(preserveWorkspace ? { workspaceRoot } : {}),
    };

    return result;
  } finally {
    if (ownsWorkspace && !preserveWorkspace) {
      await Deno.remove(workspaceRoot, { recursive: true });
    }
  }
}

function assertValidCount(count: number): void {
  if (!Number.isSafeInteger(count) || count < 1) {
    throw new Error("--count must be a positive integer");
  }
}

export function parseKnopCreateScaleProbeArgs(
  args: readonly string[],
): KnopCreateScaleProbeArgs {
  let count = DEFAULT_COUNT;
  let preserveWorkspace = false;
  let help = false;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index]!;
    if (argument === "--help" || argument === "-h") {
      help = true;
      continue;
    }
    if (argument === "--preserve") {
      preserveWorkspace = true;
      continue;
    }
    if (argument === "--count") {
      const value = args[index + 1];
      if (value === undefined) {
        throw new Error("--count requires a value");
      }
      count = Number(value);
      index += 1;
      continue;
    }
    if (argument.startsWith("--count=")) {
      count = Number(argument.slice("--count=".length));
      continue;
    }
    throw new Error(`unknown argument: ${argument}`);
  }

  if (!help) {
    assertValidCount(count);
  }
  return { count, preserveWorkspace, help };
}

if (import.meta.main) {
  const args = parseKnopCreateScaleProbeArgs(Deno.args);
  if (args.help) {
    console.log(KNOP_CREATE_SCALE_PROBE_HELP);
  } else {
    const result = await runKnopCreateScaleProbe(args);
    console.log(JSON.stringify(result));
  }
}
