import { Command } from "@cliffy/command";
import { Input } from "@cliffy/prompt";
import { join, resolve } from "@std/path";
import { ExtractInputError } from "../core/extract/extract.ts";
import { IntegrateInputError } from "../core/integrate/integrate.ts";
import { KnopAddReferenceInputError } from "../core/knop/add_reference.ts";
import { KnopCreateInputError } from "../core/knop/create.ts";
import { MeshCreateInputError } from "../core/mesh/create.ts";
import { PayloadUpdateInputError } from "../core/payload/update.ts";
import { WeaveInputError } from "../core/weave/weave.ts";
import { createRuntimeLoggers } from "../runtime/logging/factory.ts";
import {
  describeExtractResult,
  executeExtract,
  ExtractRuntimeError,
} from "../runtime/extract/extract.ts";
import {
  describeIntegrateResult,
  executeIntegrate,
  IntegrateRuntimeError,
} from "../runtime/integrate/integrate.ts";
import {
  describeKnopAddReferenceResult,
  executeKnopAddReference,
  KnopAddReferenceRuntimeError,
} from "../runtime/knop/add_reference.ts";
import {
  describeKnopCreateResult,
  executeKnopCreate,
  KnopCreateRuntimeError,
} from "../runtime/knop/create.ts";
import {
  describeMeshCreateResult,
  executeMeshCreate,
  MeshCreateRuntimeError,
} from "../runtime/mesh/create.ts";
import {
  describePayloadUpdateResult,
  executePayloadUpdate,
  PayloadUpdateRuntimeError,
} from "../runtime/payload/update.ts";
import {
  describeWeaveResult,
  executeWeave,
  WeaveRuntimeError,
} from "../runtime/weave/weave.ts";

export async function runWeaveCli(args: string[]): Promise<number> {
  let exitCode = 0;

  const command = new Command()
    .name("weave")
    .description("Filesystem-oriented Semantic Flow tooling.")
    .option(
      "--workspace <workspace:string>",
      "Workspace root to update for the default weave action.",
      { default: "." },
    )
    .option(
      "--target <target:string>",
      "Target spec as comma-separated key=value fields. Supported keys: designatorPath, recursive.",
      { collect: true },
    )
    .action(async (
      options: { workspace: string; target?: string[] },
    ) => {
      const workspaceRoot = resolve(options.workspace);
      const targets = resolveWeaveTargetSpecs(options.target);
      const logDir = join(workspaceRoot, ".weave", "logs");
      const { operationalLogger, auditLogger } = createRuntimeLoggers({
        logDir,
      });

      await auditLogger.command("weave", {
        workspaceRoot,
        targets,
        localMode: true,
      });

      const result = await executeWeave({
        workspaceRoot,
        request: targets.length > 0 ? { targets } : undefined,
        operationalLogger,
        auditLogger,
      });
      console.log(describeWeaveResult(result));
      for (const path of result.createdPaths) {
        console.log(path);
      }
      for (const path of result.updatedPaths) {
        console.log(path);
      }
    })
    .throwErrors()
    .command(
      "extract",
      new Command()
        .description(
          "Create a minimal Knop-managed surface for a local resource referenced inside a woven payload artifact.",
        )
        .arguments("<designatorPath:string>")
        .option(
          "--workspace <workspace:string>",
          "Workspace root to update.",
          { default: "." },
        )
        .action(async (options, designatorPath) => {
          const normalizedDesignatorPath = resolveRequiredArgumentValue(
            designatorPath,
            "extract requires a positional designatorPath",
            (message) => new ExtractInputError(message),
          );
          const workspaceRoot = resolve(options.workspace);
          const logDir = join(workspaceRoot, ".weave", "logs");
          const { operationalLogger, auditLogger } = createRuntimeLoggers({
            logDir,
          });

          await auditLogger.command("extract", {
            workspaceRoot,
            designatorPath: normalizedDesignatorPath,
            localMode: true,
          });

          const result = await executeExtract({
            workspaceRoot,
            request: {
              designatorPath: normalizedDesignatorPath,
            },
            operationalLogger,
            auditLogger,
          });
          console.log(describeExtractResult(result));
          for (const path of result.createdPaths) {
            console.log(path);
          }
          for (const path of result.updatedPaths) {
            console.log(path);
          }
        }),
    )
    .command(
      "integrate",
      new Command()
        .description(
          "Integrate a payload artifact source into a designator path.",
        )
        .arguments("<source:string> [designatorPath:string]")
        .option(
          "--designator-path <designatorPath:string>",
          "Designator path to assign to the integrated payload artifact.",
        )
        .option(
          "--workspace <workspace:string>",
          "Workspace root to update.",
          { default: "." },
        )
        .action(async (options, source, designatorPathArg) => {
          const workspaceRoot = resolve(options.workspace);
          const designatorPath = resolveIntegrateDesignatorPath(
            options,
            designatorPathArg,
          );
          const logDir = join(workspaceRoot, ".weave", "logs");
          const { operationalLogger, auditLogger } = createRuntimeLoggers({
            logDir,
          });

          await auditLogger.command("integrate", {
            workspaceRoot,
            designatorPath,
            source,
            localMode: true,
          });

          const result = await executeIntegrate({
            workspaceRoot,
            request: {
              designatorPath,
              source,
            },
            operationalLogger,
            auditLogger,
          });
          console.log(describeIntegrateResult(result));
          for (const path of result.createdPaths) {
            console.log(path);
          }
          for (const path of result.updatedPaths) {
            console.log(path);
          }
        }),
    )
    .command(
      "payload",
      new Command()
        .description("Payload operations.")
        .command(
          "update",
          new Command()
            .description(
              "Replace the working bytes of an existing payload artifact.",
            )
            .arguments("<source:string> [designatorPath:string]")
            .option(
              "--designator-path <designatorPath:string>",
              "Designator path of the existing payload artifact to update.",
            )
            .option(
              "--workspace <workspace:string>",
              "Workspace root to update.",
              { default: "." },
            )
            .action(async (options, source, designatorPathArg) => {
              const workspaceRoot = resolve(options.workspace);
              const designatorPath = resolvePayloadUpdateDesignatorPath(
                options,
                designatorPathArg,
              );
              const logDir = join(workspaceRoot, ".weave", "logs");
              const { operationalLogger, auditLogger } = createRuntimeLoggers({
                logDir,
              });

              await auditLogger.command("payload.update", {
                workspaceRoot,
                designatorPath,
                source,
                localMode: true,
              });

              const result = await executePayloadUpdate({
                workspaceRoot,
                request: {
                  designatorPath,
                  source,
                },
                operationalLogger,
                auditLogger,
              });
              console.log(describePayloadUpdateResult(result));
              for (const path of result.updatedPaths) {
                console.log(path);
              }
            }),
        ),
    )
    .command(
      "mesh",
      new Command()
        .description("Mesh operations.")
        .command(
          "create",
          new Command()
            .description(
              "Create the first mesh support artifacts in a workspace.",
            )
            .option(
              "--mesh-base <meshBase:string>",
              "Canonical base IRI for Semantic Flow identifiers in the mesh.",
            )
            .option(
              "--workspace <workspace:string>",
              "Workspace root to update.",
              { default: "." },
            )
            .option(
              "--interactive",
              "Prompt for meshBase when it was not provided on the command line.",
            )
            .action(async (options) => {
              const workspaceRoot = resolve(options.workspace);
              const meshBase = await resolveMeshBaseOption(options);
              const logDir = join(workspaceRoot, ".weave", "logs");
              const { operationalLogger, auditLogger } = createRuntimeLoggers({
                logDir,
              });

              await auditLogger.command("mesh.create", {
                workspaceRoot,
                localMode: true,
              });

              const result = await executeMeshCreate({
                workspaceRoot,
                request: { meshBase },
                operationalLogger,
                auditLogger,
              });
              console.log(describeMeshCreateResult(result));
              for (const path of result.createdPaths) {
                console.log(path);
              }
            }),
        ),
    )
    .command(
      "knop",
      new Command()
        .description("Knop operations.")
        .command(
          "add-reference",
          new Command()
            .description(
              "Create the first reference-catalog surface for a designator path.",
            )
            .arguments("<designatorPath:string>")
            .option(
              "--reference-target-designator-path <referenceTargetDesignatorPath:string>",
              "Designator path of the existing mesh resource used as the reference target.",
            )
            .option(
              "--reference-role <referenceRole:string>",
              "ReferenceRole token to assign to the created ReferenceLink.",
            )
            .option(
              "--workspace <workspace:string>",
              "Workspace root to update.",
              { default: "." },
            )
            .action(async (options, designatorPath) => {
              const normalizedDesignatorPath = resolveRequiredArgumentValue(
                designatorPath,
                "knop add-reference requires a positional designatorPath",
                (message) => new KnopAddReferenceInputError(message),
              );
              const workspaceRoot = resolve(options.workspace);
              const referenceTargetDesignatorPath = resolveRequiredOptionValue(
                options.referenceTargetDesignatorPath,
                "knop add-reference requires --reference-target-designator-path",
                (message) => new KnopAddReferenceInputError(message),
              );
              const referenceRole = resolveRequiredOptionValue(
                options.referenceRole,
                "knop add-reference requires --reference-role",
                (message) => new KnopAddReferenceInputError(message),
              );
              const logDir = join(workspaceRoot, ".weave", "logs");
              const { operationalLogger, auditLogger } = createRuntimeLoggers({
                logDir,
              });

              await auditLogger.command("knop.addReference", {
                workspaceRoot,
                designatorPath: normalizedDesignatorPath,
                referenceTargetDesignatorPath,
                referenceRole,
                localMode: true,
              });

              const result = await executeKnopAddReference({
                workspaceRoot,
                request: {
                  designatorPath: normalizedDesignatorPath,
                  referenceTargetDesignatorPath,
                  referenceRole,
                },
                operationalLogger,
                auditLogger,
              });
              console.log(describeKnopAddReferenceResult(result));
              for (const path of result.createdPaths) {
                console.log(path);
              }
              for (const path of result.updatedPaths) {
                console.log(path);
              }
            }),
        )
        .command(
          "create",
          new Command()
            .description(
              "Create the first knop support artifacts for a designator path.",
            )
            .arguments("<designatorPath:string>")
            .option(
              "--workspace <workspace:string>",
              "Workspace root to update.",
              { default: "." },
            )
            .action(async (options, designatorPath) => {
              const workspaceRoot = resolve(options.workspace);
              const logDir = join(workspaceRoot, ".weave", "logs");
              const { operationalLogger, auditLogger } = createRuntimeLoggers({
                logDir,
              });

              await auditLogger.command("knop.create", {
                workspaceRoot,
                designatorPath,
                localMode: true,
              });

              const result = await executeKnopCreate({
                workspaceRoot,
                request: { designatorPath },
                operationalLogger,
                auditLogger,
              });
              console.log(describeKnopCreateResult(result));
              for (const path of result.createdPaths) {
                console.log(path);
              }
              for (const path of result.updatedPaths) {
                console.log(path);
              }
            }),
        ),
    );

  try {
    await command.parse(args);
  } catch (error) {
    exitCode = 1;
    const message = getCliErrorMessage(error);
    if (message.length > 0) {
      console.error(message);
    }
  }

  return exitCode;
}

async function resolveMeshBaseOption(
  options: { meshBase?: string; interactive?: boolean },
): Promise<string> {
  if (
    typeof options.meshBase === "string" && options.meshBase.trim().length > 0
  ) {
    return options.meshBase;
  }

  if (!options.interactive) {
    throw new MeshCreateInputError(
      "mesh create requires --mesh-base or --interactive",
    );
  }

  return await Input.prompt({
    message: "Mesh base IRI",
    validate(value) {
      return value.trim().length > 0 || "meshBase is required";
    },
  });
}

function resolveIntegrateDesignatorPath(
  options: { designatorPath?: string },
  designatorPathArg?: string,
): string {
  return resolveDesignatorPath(options, designatorPathArg, {
    conflictMessage: "integrate received conflicting designator paths",
    missingMessage:
      "integrate requires a designator path as [designatorPath] or --designator-path",
    createError: (message) => new IntegrateInputError(message),
  });
}

function resolvePayloadUpdateDesignatorPath(
  options: { designatorPath?: string },
  designatorPathArg?: string,
): string {
  return resolveDesignatorPath(options, designatorPathArg, {
    conflictMessage: "payload update received conflicting designator paths",
    missingMessage:
      "payload update requires a designator path as [designatorPath] or --designator-path",
    createError: (message) => new PayloadUpdateInputError(message),
  });
}

function resolveDesignatorPath(
  options: { designatorPath?: string },
  designatorPathArg: string | undefined,
  errorMessages: {
    conflictMessage: string;
    missingMessage: string;
    createError: (message: string) => Error;
  },
): string {
  const optionValue = options.designatorPath?.trim() ?? "";
  const argumentValue = designatorPathArg?.trim() ?? "";

  if (optionValue.length > 0 && argumentValue.length > 0) {
    if (optionValue !== argumentValue) {
      throw errorMessages.createError(errorMessages.conflictMessage);
    }

    return optionValue;
  }

  if (optionValue.length > 0) {
    return optionValue;
  }

  if (argumentValue.length > 0) {
    return argumentValue;
  }

  throw errorMessages.createError(errorMessages.missingMessage);
}

function resolveWeaveTargetSpecs(
  values: readonly string[] | undefined,
): readonly { designatorPath: string; recursive?: boolean }[] {
  if (!values || values.length === 0) {
    return [];
  }

  return values.map((value, index) => parseWeaveTargetSpec(value, index));
}

function parseWeaveTargetSpec(
  value: string,
  index: number,
): { designatorPath: string; recursive?: boolean } {
  const fieldName = `weave --target[${index}]`;
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new WeaveInputError(`${fieldName} is required`);
  }

  const record: Record<string, string> = {};
  for (const segment of trimmed.split(",")) {
    const entry = segment.trim();
    if (entry.length === 0) {
      throw new WeaveInputError(
        `${fieldName} must use key=value fields separated by commas`,
      );
    }

    const separatorIndex = entry.indexOf("=");
    if (
      separatorIndex <= 0 || separatorIndex === entry.length - 1
    ) {
      throw new WeaveInputError(
        `${fieldName} must use key=value fields separated by commas`,
      );
    }

    const key = entry.slice(0, separatorIndex).trim();
    const rawFieldValue = entry.slice(separatorIndex + 1).trim();
    if (rawFieldValue.length === 0) {
      throw new WeaveInputError(`${fieldName}.${key} is required`);
    }
    if (key !== "designatorPath" && key !== "recursive") {
      throw new WeaveInputError(`${fieldName}.${key} is not supported`);
    }
    if (Object.hasOwn(record, key)) {
      throw new WeaveInputError(`${fieldName} contains duplicate key: ${key}`);
    }

    record[key] = rawFieldValue;
  }

  const designatorPath = record.designatorPath?.trim() ?? "";
  if (designatorPath.length === 0) {
    throw new WeaveInputError(`${fieldName}.designatorPath is required`);
  }

  if (record.recursive === undefined) {
    return { designatorPath };
  }
  if (record.recursive !== "true" && record.recursive !== "false") {
    throw new WeaveInputError(
      `${fieldName}.recursive must be true or false`,
    );
  }

  return record.recursive === "true"
    ? { designatorPath, recursive: true }
    : { designatorPath };
}

function getCliErrorMessage(error: unknown): string {
  if (
    error instanceof ExtractInputError ||
    error instanceof ExtractRuntimeError ||
    error instanceof IntegrateInputError ||
    error instanceof IntegrateRuntimeError ||
    error instanceof PayloadUpdateInputError ||
    error instanceof PayloadUpdateRuntimeError ||
    error instanceof KnopAddReferenceInputError ||
    error instanceof KnopAddReferenceRuntimeError ||
    error instanceof WeaveInputError ||
    error instanceof WeaveRuntimeError ||
    error instanceof KnopCreateInputError ||
    error instanceof KnopCreateRuntimeError ||
    error instanceof MeshCreateInputError ||
    error instanceof MeshCreateRuntimeError
  ) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message.trim();
  }
  return String(error);
}

function resolveRequiredOptionValue(
  value: string | undefined,
  errorMessage: string,
  createError: (message: string) => Error,
): string {
  const trimmed = value?.trim() ?? "";
  if (trimmed.length === 0) {
    throw createError(errorMessage);
  }
  return trimmed;
}

function resolveRequiredArgumentValue(
  value: string | undefined,
  errorMessage: string,
  createError: (message: string) => Error,
): string {
  return resolveRequiredOptionValue(
    typeof value === "string" ? value : undefined,
    errorMessage,
    createError,
  );
}
