import { dirname, join } from "@std/path";
import { Parser } from "n3";
import type { PlannedFile } from "../../core/planned_file.ts";
import {
  type PayloadWorkingArtifact,
  planWeave,
  type WeaveableKnopCandidate,
  WeaveInputError,
  type WeavePlan,
  type WeaveRequest,
} from "../../core/weave/weave.ts";
import { resolveRuntimeLoggers } from "../logging/factory.ts";
import type { AuditLogger } from "../logging/audit_logger.ts";
import type { StructuredLogger } from "../logging/logger.ts";
import { renderResourcePages } from "./pages.ts";

export interface ExecuteWeaveOptions {
  workspaceRoot: string;
  request?: WeaveRequest;
  operationalLogger?: StructuredLogger;
  auditLogger?: AuditLogger;
}

export interface WeaveResult {
  meshBase: string;
  wovenDesignatorPaths: readonly string[];
  createdPaths: readonly string[];
  updatedPaths: readonly string[];
}

export class WeaveRuntimeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WeaveRuntimeError";
  }
}

export async function executeWeave(
  options: ExecuteWeaveOptions,
): Promise<WeaveResult> {
  const { operationalLogger, auditLogger } = resolveLoggers(options);
  const workspaceRoot = options.workspaceRoot;
  let plan: WeavePlan | undefined;
  let createdOutputFiles: readonly PlannedFile[] = [];

  await operationalLogger.info("weave.started", "Starting local weave", {
    workspaceRoot,
    designatorPaths: options.request?.designatorPaths ?? [],
  });
  await auditLogger.record("weave.started", "Local weave started", {
    workspaceRoot,
    designatorPaths: options.request?.designatorPaths ?? [],
  });

  try {
    await ensureWorkspaceRootExists(workspaceRoot);
    const meshState = await loadMeshState(workspaceRoot);
    const weaveableKnops = await loadWeaveableKnopCandidates(
      workspaceRoot,
      meshState.currentMeshInventoryTurtle,
    );
    plan = planWeave({
      request: options.request ?? {},
      meshBase: meshState.meshBase,
      currentMeshInventoryTurtle: meshState.currentMeshInventoryTurtle,
      weaveableKnops,
    });
    createdOutputFiles = [
      ...plan.createdFiles,
      ...renderResourcePages(plan.meshBase, plan.createdPages),
    ];
    assertUpdatedTargetsExist(workspaceRoot, plan.updatedFiles);
    await assertCreateTargetsDoNotExist(workspaceRoot, createdOutputFiles);
    validateRdfFiles([...plan.createdFiles, ...plan.updatedFiles]);
    await writeFiles(workspaceRoot, createdOutputFiles, true);
    await writeFiles(workspaceRoot, plan.updatedFiles, false);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await operationalLogger.error("weave.failed", "Local weave failed", {
      workspaceRoot,
      wovenDesignatorPaths: plan?.wovenDesignatorPaths,
      error: message,
    });
    await auditLogger.record("weave.failed", "Local weave failed", {
      workspaceRoot,
      wovenDesignatorPaths: plan?.wovenDesignatorPaths,
      error: message,
    });

    if (
      error instanceof WeaveInputError || error instanceof WeaveRuntimeError
    ) {
      throw error;
    }
    throw new WeaveRuntimeError(message);
  }

  const result: WeaveResult = {
    meshBase: plan.meshBase,
    wovenDesignatorPaths: plan.wovenDesignatorPaths,
    createdPaths: createdOutputFiles.map((file) => file.path),
    updatedPaths: plan.updatedFiles.map((file) => file.path),
  };

  await operationalLogger.info("weave.succeeded", "Local weave succeeded", {
    workspaceRoot,
    wovenDesignatorPaths: result.wovenDesignatorPaths,
    createdPaths: result.createdPaths,
    updatedPaths: result.updatedPaths,
  });
  await auditLogger.record("weave.succeeded", "Local weave succeeded", {
    workspaceRoot,
    wovenDesignatorPaths: result.wovenDesignatorPaths,
    createdPaths: result.createdPaths,
    updatedPaths: result.updatedPaths,
  });

  return result;
}

export function describeWeaveResult(result: WeaveResult): string {
  return `Wove ${result.wovenDesignatorPaths.length} designator path and created ${result.createdPaths.length} files while updating ${result.updatedPaths.length} working artifacts.`;
}

function resolveLoggers(
  options: ExecuteWeaveOptions,
): {
  operationalLogger: StructuredLogger;
  auditLogger: AuditLogger;
} {
  return resolveRuntimeLoggers(options);
}

async function ensureWorkspaceRootExists(workspaceRoot: string): Promise<void> {
  let stat: Deno.FileInfo;
  try {
    stat = await Deno.stat(workspaceRoot);
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      throw new WeaveRuntimeError(
        `Workspace root does not exist: ${workspaceRoot}`,
      );
    }
    throw error;
  }

  if (!stat.isDirectory) {
    throw new WeaveRuntimeError(
      `Workspace root is not a directory: ${workspaceRoot}`,
    );
  }
}

async function loadMeshState(
  workspaceRoot: string,
): Promise<{ meshBase: string; currentMeshInventoryTurtle: string }> {
  const meshMetadataPath = join(workspaceRoot, "_mesh/_meta/meta.ttl");
  const meshInventoryPath = join(
    workspaceRoot,
    "_mesh/_inventory/inventory.ttl",
  );
  let meshMetadataTurtle: string;
  let currentMeshInventoryTurtle: string;

  try {
    [meshMetadataTurtle, currentMeshInventoryTurtle] = await Promise.all([
      Deno.readTextFile(meshMetadataPath),
      Deno.readTextFile(meshInventoryPath),
    ]);
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      throw new WeaveRuntimeError(
        "Workspace does not contain an existing mesh support surface",
      );
    }
    throw error;
  }

  const meshBaseMatch = meshMetadataTurtle.match(
    /sflo:meshBase "([^"]+)"\^\^xsd:anyURI/,
  );
  if (!meshBaseMatch) {
    throw new WeaveRuntimeError(
      "Could not resolve meshBase from _mesh/_meta/meta.ttl",
    );
  }

  return {
    meshBase: meshBaseMatch[1]!,
    currentMeshInventoryTurtle,
  };
}

async function loadWeaveableKnopCandidates(
  workspaceRoot: string,
  currentMeshInventoryTurtle: string,
): Promise<readonly WeaveableKnopCandidate[]> {
  const knopMatches = [
    ...currentMeshInventoryTurtle.matchAll(/<([^>]+\/_knop)> a sflo:Knop ;/g),
  ];
  const designatorPaths = knopMatches.map((match) =>
    match[1]!.slice(0, -"/_knop".length)
  );

  const candidates: WeaveableKnopCandidate[] = [];
  for (const designatorPath of designatorPaths) {
    const knopPath = `${designatorPath}/_knop`;
    const metadataPath = join(workspaceRoot, `${knopPath}/_meta/meta.ttl`);
    const inventoryPath = join(
      workspaceRoot,
      `${knopPath}/_inventory/inventory.ttl`,
    );
    let currentKnopMetadataTurtle: string;
    let currentKnopInventoryTurtle: string;

    try {
      [currentKnopMetadataTurtle, currentKnopInventoryTurtle] = await Promise
        .all([
          Deno.readTextFile(metadataPath),
          Deno.readTextFile(inventoryPath),
        ]);
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) {
        continue;
      }
      throw error;
    }

    if (currentKnopInventoryTurtle.includes("sflo:hasArtifactHistory")) {
      continue;
    }

    candidates.push({
      designatorPath,
      currentKnopMetadataTurtle,
      currentKnopInventoryTurtle,
      payloadArtifact: await loadPayloadWorkingArtifact(
        workspaceRoot,
        designatorPath,
        currentKnopInventoryTurtle,
      ),
    });
  }

  return candidates.sort((left, right) =>
    left.designatorPath.localeCompare(right.designatorPath)
  );
}

async function loadPayloadWorkingArtifact(
  workspaceRoot: string,
  designatorPath: string,
  currentKnopInventoryTurtle: string,
): Promise<PayloadWorkingArtifact | undefined> {
  if (
    !currentKnopInventoryTurtle.includes(
      `sflo:hasPayloadArtifact <${designatorPath}>`,
    )
  ) {
    return undefined;
  }

  const payloadBlock = currentKnopInventoryTurtle
    .split("\n\n")
    .find((block) =>
      block.startsWith(
        `<${designatorPath}> a sflo:PayloadArtifact, sflo:DigitalArtifact, sflo:RdfDocument ;`,
      )
    );

  if (!payloadBlock) {
    throw new WeaveRuntimeError(
      `Could not resolve the payload artifact block for ${designatorPath}.`,
    );
  }

  const workingFilePathMatch = payloadBlock.match(
    /sflo:hasWorkingLocatedFile <([^>]+)>/,
  );
  if (!workingFilePathMatch) {
    throw new WeaveRuntimeError(
      `Could not resolve the working payload file for ${designatorPath}.`,
    );
  }

  const workingFilePath = workingFilePathMatch[1]!;
  try {
    return {
      workingFilePath,
      currentPayloadTurtle: await Deno.readTextFile(
        join(workspaceRoot, workingFilePath),
      ),
    };
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      throw new WeaveRuntimeError(
        `Workspace is missing the working payload file for ${designatorPath}: ${workingFilePath}`,
      );
    }
    throw error;
  }
}

function assertUpdatedTargetsExist(
  workspaceRoot: string,
  files: readonly PlannedFile[],
): void {
  for (const file of files) {
    const absolutePath = join(workspaceRoot, file.path);
    try {
      Deno.statSync(absolutePath);
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) {
        throw new WeaveRuntimeError(
          `weave target does not exist: ${file.path}`,
        );
      }
      throw error;
    }
  }
}

async function assertCreateTargetsDoNotExist(
  workspaceRoot: string,
  files: readonly PlannedFile[],
): Promise<void> {
  for (const file of files) {
    try {
      await Deno.stat(join(workspaceRoot, file.path));
      throw new WeaveRuntimeError(`weave target already exists: ${file.path}`);
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) {
        continue;
      }
      throw error;
    }
  }
}

function validateRdfFiles(files: readonly PlannedFile[]): void {
  const parser = new Parser();

  for (const file of files) {
    if (!file.path.endsWith(".ttl")) {
      continue;
    }
    try {
      parser.parse(file.contents);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new WeaveRuntimeError(
        `Generated RDF did not parse for ${file.path}: ${message}`,
      );
    }
  }
}

async function writeFiles(
  workspaceRoot: string,
  files: readonly PlannedFile[],
  createNew: boolean,
): Promise<void> {
  for (const file of files) {
    const absolutePath = join(workspaceRoot, file.path);
    await Deno.mkdir(dirname(absolutePath), { recursive: true });
    await Deno.writeTextFile(
      absolutePath,
      file.contents,
      createNew ? { createNew: true } : undefined,
    );
  }
}
