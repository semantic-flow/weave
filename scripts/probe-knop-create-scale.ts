import { join } from "@std/path";
import { versionFoundingReferentData } from "../src/api/version_founding_referent_data.ts";
import { sha256ContentDigest } from "../src/core/rdf/content_digest.ts";
import { executeKnopCreate } from "../src/runtime/knop/create.ts";
import { executeMeshCreate } from "../src/runtime/mesh/create.ts";
import { executeWeave } from "../src/runtime/weave/weave.ts";

const DEFAULT_COUNT = 3;
const MESH_BASE = "https://example.org/stagecraft-scale-probe/";

export const KNOP_CREATE_SCALE_PROBE_HELP =
  `Usage: deno run --allow-read --allow-write --allow-env scripts/probe-knop-create-scale.ts [options]

Options:
  --count <positive integer>  Number of sequential Knops to create (default: ${DEFAULT_COUNT})
  --founding                 Add founding bytes and settle state 1 for every Knop
  --preserve                 Keep the temporary workspace and report its path
  -h, --help                 Show this help
`;

export interface KnopCreateScaleProbeOptions {
  count?: number;
  preserveWorkspace?: boolean;
  workspaceRoot?: string;
  founding?: boolean;
}

export interface KnopCreateScaleProbeArgs {
  count: number;
  preserveWorkspace: boolean;
  founding: boolean;
  help: boolean;
}

export interface KnopCreateScaleProbeResult {
  workload: "knop.create-scale" | "knop.create-founding-scale";
  requestedCreateCount: number;
  successfulCreateCount: number;
  createdFileCount: number;
  updatedFileCount: number;
  finalMeshInventoryBytes: number;
  meshInventoryBytesRead: number;
  meshInventoryBytesWritten: number;
  elapsedMs: number;
  createElapsedMs: number;
  settlementElapsedMs?: number;
  verifiedSnapshotDigestCount?: number;
  foundingPageCount?: number;
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
  const founding = options.founding ?? false;
  const workspaceRoot = options.workspaceRoot ?? await Deno.makeTempDir({
    prefix: "weave-knop-create-scale-",
  });
  const startedAt = performance.now();
  let successfulCreateCount = 0;
  let createdFileCount = 0;
  let updatedFileCount = 0;
  let createStartedAt = startedAt;
  let meshInventoryBytesRead = 0;
  let meshInventoryBytesWritten = 0;
  let settlementElapsedMs: number | undefined;
  let verifiedSnapshotDigestCount: number | undefined;
  let foundingPageCount: number | undefined;

  try {
    await executeMeshCreate({
      workspaceRoot,
      request: { meshBase: MESH_BASE },
    });
    await executeWeave({ meshRoot: workspaceRoot });

    const designatorWidth = Math.max(4, String(count).length);
    const designatorPaths: string[] = [];
    createStartedAt = performance.now();
    for (let index = 1; index <= count; index += 1) {
      const designatorPath = `stagecraft/iri-${
        String(index).padStart(designatorWidth, "0")
      }`;
      designatorPaths.push(designatorPath);
      meshInventoryBytesRead += (await Deno.stat(join(
        workspaceRoot,
        "_mesh/_inventory/inventory.ttl",
      ))).size;
      const result = await executeKnopCreate({
        workspaceRoot,
        request: {
          designatorPath,
          ...(founding
            ? {
              foundingData: new TextEncoder().encode(
                `<${
                  new URL(designatorPath, MESH_BASE).href
                }> <https://stagecraft.example/vocab/incarnationOf> <https://original.example/items/${index}> .\n`,
              ),
            }
            : {}),
        },
      });
      successfulCreateCount += 1;
      createdFileCount += result.createdPaths.length;
      updatedFileCount += result.updatedPaths.length;
      meshInventoryBytesWritten += (await Deno.stat(join(
        workspaceRoot,
        "_mesh/_inventory/inventory.ttl",
      ))).size;
    }
    const createFinishedAt = performance.now();

    if (founding) {
      const settlementStartedAt = performance.now();
      verifiedSnapshotDigestCount = 0;
      foundingPageCount = 0;
      for (const designatorPath of designatorPaths) {
        const versioned = await versionFoundingReferentData({
          meshRoot: workspaceRoot,
          designatorPath,
        });
        createdFileCount += versioned.createdPaths.length;
        updatedFileCount += versioned.updatedPaths.length;
        const snapshotBytes = await Deno.readFile(
          join(workspaceRoot, versioned.snapshotPath),
        );
        if (
          await sha256ContentDigest(snapshotBytes) !== versioned.contentDigest
        ) {
          throw new Error(
            `snapshot digest verification failed: ${versioned.snapshotPath}`,
          );
        }
        verifiedSnapshotDigestCount += 1;
        try {
          await Deno.stat(join(
            workspaceRoot,
            `${designatorPath}/_knop/_founding/index.html`,
          ));
          foundingPageCount += 1;
        } catch (error) {
          if (!(error instanceof Deno.errors.NotFound)) throw error;
        }
      }
      settlementElapsedMs = performance.now() - settlementStartedAt;
    }

    const finalMeshInventoryBytes = (await Deno.stat(join(
      workspaceRoot,
      "_mesh/_inventory/inventory.ttl",
    ))).size;
    const result: KnopCreateScaleProbeResult = {
      workload: founding ? "knop.create-founding-scale" : "knop.create-scale",
      requestedCreateCount: count,
      successfulCreateCount,
      createdFileCount,
      updatedFileCount,
      finalMeshInventoryBytes,
      meshInventoryBytesRead,
      meshInventoryBytesWritten,
      elapsedMs: performance.now() - startedAt,
      createElapsedMs: createFinishedAt - createStartedAt,
      ...(settlementElapsedMs === undefined ? {} : { settlementElapsedMs }),
      ...(verifiedSnapshotDigestCount === undefined ? {} : {
        verifiedSnapshotDigestCount,
      }),
      ...(foundingPageCount === undefined ? {} : { foundingPageCount }),
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
  let founding = false;
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
    if (argument === "--founding") {
      founding = true;
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
  return { count, preserveWorkspace, founding, help };
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
