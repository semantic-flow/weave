import { dirname, join } from "@std/path";
import { Parser } from "n3";
import {
  type FirstWeaveKnopCandidate,
  planWeave,
  WeaveInputError,
  type WeavePlan,
  type WeaveRequest,
} from "../../core/weave/weave.ts";
import { createRuntimeLoggers } from "../logging/factory.ts";
import type { AuditLogger } from "../logging/audit_logger.ts";
import type { StructuredLogger } from "../logging/logger.ts";

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
    const weaveableKnops = await loadFirstWeaveKnopCandidates(
      workspaceRoot,
      meshState.currentMeshInventoryTurtle,
    );
    plan = planWeave({
      request: options.request ?? {},
      meshBase: meshState.meshBase,
      currentMeshInventoryTurtle: meshState.currentMeshInventoryTurtle,
      weaveableKnops,
    });
    assertUpdatedTargetsExist(workspaceRoot, plan);
    await assertCreateTargetsDoNotExist(workspaceRoot, plan);
    validateRdfPlan(plan);
    await writeCreatedFiles(workspaceRoot, plan);
    await writeUpdatedFiles(workspaceRoot, plan);
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
    createdPaths: plan.createdFiles.map((file) => file.path),
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
  if (options.operationalLogger && options.auditLogger) {
    return {
      operationalLogger: options.operationalLogger,
      auditLogger: options.auditLogger,
    };
  }

  return createRuntimeLoggers();
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

async function loadFirstWeaveKnopCandidates(
  workspaceRoot: string,
  currentMeshInventoryTurtle: string,
): Promise<readonly FirstWeaveKnopCandidate[]> {
  const knopMatches = [
    ...currentMeshInventoryTurtle.matchAll(/<([^>]+\/_knop)> a sflo:Knop ;/g),
  ];
  const designatorPaths = knopMatches.map((match) =>
    match[1]!.slice(0, -"/_knop".length)
  );

  const candidates: FirstWeaveKnopCandidate[] = [];
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
    });
  }

  return candidates.sort((left, right) =>
    left.designatorPath.localeCompare(right.designatorPath)
  );
}

function assertUpdatedTargetsExist(
  workspaceRoot: string,
  plan: WeavePlan,
): void {
  for (const file of plan.updatedFiles) {
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
  plan: WeavePlan,
): Promise<void> {
  for (const file of plan.createdFiles) {
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

function validateRdfPlan(plan: WeavePlan): void {
  const parser = new Parser();

  for (const file of [...plan.createdFiles, ...plan.updatedFiles]) {
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

async function writeCreatedFiles(
  workspaceRoot: string,
  plan: WeavePlan,
): Promise<void> {
  for (const file of plan.createdFiles) {
    const absolutePath = join(workspaceRoot, file.path);
    await Deno.mkdir(dirname(absolutePath), { recursive: true });
    await Deno.writeTextFile(absolutePath, file.contents, { createNew: true });
  }
}

async function writeUpdatedFiles(
  workspaceRoot: string,
  plan: WeavePlan,
): Promise<void> {
  for (const file of plan.updatedFiles) {
    const absolutePath = join(workspaceRoot, file.path);
    await Deno.mkdir(dirname(absolutePath), { recursive: true });
    await Deno.writeTextFile(absolutePath, file.contents);
  }
}
