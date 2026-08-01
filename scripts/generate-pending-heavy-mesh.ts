import { dirname, join, resolve } from "@std/path";
import { executeExtractAllTerms } from "../src/runtime/extract/extract.ts";
import { executeIntegrate } from "../src/runtime/integrate/integrate.ts";
import { executeMeshCreate } from "../src/runtime/mesh/create.ts";
import { executeWeave } from "../src/runtime/weave/weave.ts";

export type MeshInventoryHistoryPolicy = "current-only" | "versioned";

export interface GeneratePendingHeavyMeshOptions {
  outputPath: string;
  count: number;
  meshInventoryHistoryPolicy: MeshInventoryHistoryPolicy;
  termContentBytes?: number;
  sourceDesignatorPath?: string;
}

export interface GeneratePendingHeavyMeshResult {
  meshRoot: string;
  count: number;
  meshInventoryHistoryPolicy: MeshInventoryHistoryPolicy;
  termContentBytes: number;
  sourceDesignatorPath: string;
  extractedDesignatorPaths: readonly string[];
}

const DEFAULT_SOURCE_DESIGNATOR_PATH = "source";
const SOURCE_WORKING_FILE_PATH = "source.ttl";

export async function generatePendingHeavyMesh(
  options: GeneratePendingHeavyMeshOptions,
): Promise<GeneratePendingHeavyMeshResult> {
  assertPositiveInteger(options.count, "count");
  const termContentBytes = options.termContentBytes ?? 0;
  assertNonNegativeInteger(termContentBytes, "termContentBytes");
  const sourceDesignatorPath = options.sourceDesignatorPath ??
    DEFAULT_SOURCE_DESIGNATOR_PATH;
  const meshRoot = resolve(options.outputPath);
  await ensureEmptyOutputDirectory(meshRoot);

  const meshBase = `https://example.test/weave-memory-${crypto.randomUUID()}/`;
  await executeMeshCreate({
    workspaceRoot: meshRoot,
    request: {
      meshBase,
      publicationProfile: "none",
    },
  });

  await Deno.writeTextFile(
    join(meshRoot, "_mesh/_config/config.ttl"),
    meshInventoryConfigTurtle(options.meshInventoryHistoryPolicy),
  );

  await executeWeave({ meshRoot });
  await Deno.writeTextFile(
    join(meshRoot, SOURCE_WORKING_FILE_PATH),
    renderSourcePayload(meshBase, options.count, termContentBytes),
  );
  await executeIntegrate({
    meshRoot,
    request: {
      designatorPath: sourceDesignatorPath,
      source: SOURCE_WORKING_FILE_PATH,
    },
  });
  await executeWeave({
    meshRoot,
    request: {
      targets: [{ designatorPath: sourceDesignatorPath }],
    },
  });

  const extraction = await executeExtractAllTerms({
    meshRoot,
    request: { sourceDesignatorPath },
  });
  if (extraction.extractedDesignatorPaths.length !== options.count) {
    throw new Error(
      `Expected ${options.count} extracted terms, but created ${extraction.extractedDesignatorPaths.length}.`,
    );
  }

  return {
    meshRoot,
    count: options.count,
    meshInventoryHistoryPolicy: options.meshInventoryHistoryPolicy,
    termContentBytes,
    sourceDesignatorPath,
    extractedDesignatorPaths: extraction.extractedDesignatorPaths,
  };
}

function renderSourcePayload(
  meshBase: string,
  count: number,
  termContentBytes: number,
): string {
  const terms = Array.from({ length: count }, (_, index) => {
    const ordinal = String(index + 1).padStart(6, "0");
    const description = termContentBytes === 0
      ? ""
      : ` ;\n  schema:description "${
        deterministicTermContent(ordinal, termContentBytes)
      }"`;
    return `<term-${ordinal}> a schema:DefinedTerm ;\n  schema:name "Term ${ordinal}"${description} .`;
  });
  return `@base <${meshBase}> .
@prefix schema: <https://schema.org/> .

${terms.join("\n\n")}
`;
}

function deterministicTermContent(ordinal: string, bytes: number): string {
  const prefix = `Term ${ordinal}:`;
  if (bytes <= prefix.length) {
    return prefix.slice(0, bytes);
  }
  return prefix + "x".repeat(bytes - prefix.length);
}

function meshInventoryConfigTurtle(
  policy: MeshInventoryHistoryPolicy,
): string {
  const policyLocalName = policy === "versioned"
    ? "historyTrackingPolicy_versioned"
    : "historyTrackingPolicy_currentOnly";
  return `@prefix sfcfg: <https://semantic-flow.github.io/sflo/config/> .

<> a sfcfg:MeshConfig ;
  sfcfg:hasPublicationProfile sfcfg:publicationProfile_none ;
  sfcfg:hasPolicyBinding <#mesh-inventory-history> .

<#mesh-inventory-history> a sfcfg:PolicyBinding ;
  sfcfg:bindsPolicy <#history-policy> ;
  sfcfg:appliesToPolicyTarget <#mesh-inventory> .

<#history-policy> a sfcfg:PolicyDefinition ;
  sfcfg:hasHistoryTrackingPolicy sfcfg:${policyLocalName} .

<#mesh-inventory> a sfcfg:ArtifactRolePolicyTarget ;
  sfcfg:hasArtifactRole sfcfg:artifactRole_meshInventory .
`;
}

async function ensureEmptyOutputDirectory(path: string): Promise<void> {
  try {
    const stat = await Deno.stat(path);
    if (!stat.isDirectory) {
      throw new Error(`Output path exists and is not a directory: ${path}`);
    }
    for await (const _entry of Deno.readDir(path)) {
      throw new Error(`Output directory must be empty: ${path}`);
    }
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      await Deno.mkdir(path, { recursive: true });
      return;
    }
    throw error;
  }
}

function assertPositiveInteger(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error(`${name} must be a positive integer.`);
  }
}

function assertNonNegativeInteger(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${name} must be a non-negative integer.`);
  }
}

interface ParsedArgs {
  outputPath: string;
  count: number;
  meshInventoryHistoryPolicy: MeshInventoryHistoryPolicy;
  termContentBytes: number;
  sourceDesignatorPath: string;
}

function parseArgs(args: readonly string[]): ParsedArgs {
  let outputPath: string | undefined;
  let count: number | undefined;
  let meshInventoryHistoryPolicy: MeshInventoryHistoryPolicy = "current-only";
  let termContentBytes = 0;
  let sourceDesignatorPath = DEFAULT_SOURCE_DESIGNATOR_PATH;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]!;
    const value = args[index + 1];
    if (arg === "--output" && value !== undefined) {
      outputPath = value;
      index += 1;
      continue;
    }
    if (arg === "--count" && value !== undefined) {
      count = Number(value);
      index += 1;
      continue;
    }
    if (arg === "--mesh-inventory-history" && value !== undefined) {
      if (value !== "current-only" && value !== "versioned") {
        throw new Error(
          "--mesh-inventory-history must be current-only or versioned.",
        );
      }
      meshInventoryHistoryPolicy = value;
      index += 1;
      continue;
    }
    if (arg === "--term-content-bytes" && value !== undefined) {
      termContentBytes = Number(value);
      index += 1;
      continue;
    }
    if (arg === "--source-designator-path" && value !== undefined) {
      sourceDesignatorPath = value;
      index += 1;
      continue;
    }
    throw new Error(`Unknown or incomplete argument: ${arg}`);
  }

  if (outputPath === undefined) {
    throw new Error("--output is required.");
  }
  if (count === undefined) {
    throw new Error("--count is required.");
  }
  assertPositiveInteger(count, "--count");
  assertNonNegativeInteger(termContentBytes, "--term-content-bytes");
  return {
    outputPath,
    count,
    meshInventoryHistoryPolicy,
    termContentBytes,
    sourceDesignatorPath,
  };
}

if (import.meta.main) {
  try {
    const result = await generatePendingHeavyMesh(parseArgs(Deno.args));
    console.log(JSON.stringify(result));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    console.error(
      `Usage: deno run -A ${
        resolve(
          dirname(import.meta.filename!),
          "generate-pending-heavy-mesh.ts",
        )
      } --output <empty-dir> --count <N> --mesh-inventory-history <current-only|versioned> [--term-content-bytes <n>] [--source-designator-path <path>]`,
    );
    Deno.exit(1);
  }
}
