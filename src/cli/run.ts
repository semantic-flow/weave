import { Command } from "@cliffy/command";
import { Input } from "@cliffy/prompt";
import { isAbsolute, join, relative, resolve } from "@std/path";
import { ExtractInputError } from "../core/extract/extract.ts";
import { IntegrateInputError } from "../core/integrate/integrate.ts";
import { KnopAddReferenceInputError } from "../core/knop/add_reference.ts";
import { KnopCreateInputError } from "../core/knop/create.ts";
import { MeshCreateInputError } from "../core/mesh/create.ts";
import { PayloadUpdateInputError } from "../core/payload/update.ts";
import { normalizeCliDesignatorPath } from "../core/designator_segments.ts";
import type { TargetSpec, VersionTargetSpec } from "../core/targeting.ts";
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
  describeGenerateResult,
  describeValidateResult,
  describeVersionResult,
  describeWeaveResult,
  executeGenerate,
  executeValidate,
  executeVersion,
  executeWeave,
  WeaveRuntimeError,
} from "../runtime/weave/weave.ts";
import { loadOperationalLocalPathPolicy } from "../runtime/operational/local_path_policy.ts";

const TARGET_OPTION_DESCRIPTION =
  "Target spec as comma-separated key=value fields. Supported keys: designatorPath, recursive.";

export async function runWeaveCli(args: string[]): Promise<number> {
  let exitCode = 0;

  const command = new Command()
    .name("weave")
    .description("Filesystem-oriented Semantic Flow tooling.")
    .option(
      "--mesh-root <meshRoot:string>",
      "Mesh root to weave. Defaults to the current directory.",
      { default: "." },
    )
    .option(
      "--target <target:string>",
      TARGET_OPTION_DESCRIPTION,
      { collect: true },
    )
    .option(
      "--payload-history-segment <segment:string>",
      "Payload history segment name to pass only to version for a single targeted payload weave.",
    )
    .option(
      "--payload-state-segment <segment:string>",
      "Payload state segment name to pass only to version for a single targeted payload weave.",
    )
    .option(
      "--payload-manifestation-segment <segment:string>",
      "Payload manifestation segment name to pass only to version for a single targeted payload weave.",
    )
    .action(async (
      options: {
        meshRoot: string;
        target?: string[];
        payloadHistorySegment?: string;
        payloadStateSegment?: string;
        payloadManifestationSegment?: string;
      },
    ) => {
      const meshRoot = resolve(options.meshRoot);
      const workspaceRoot = await inferCliWorkspaceRoot(meshRoot);
      const targets = resolveVersionTargetSpecs(options, "weave");
      const logDir = join(workspaceRoot, ".weave", "logs");
      const { operationalLogger, auditLogger } = createRuntimeLoggers({
        logDir,
      });

      await auditLogger.command("weave", {
        meshRoot,
        workspaceRoot,
        targets,
        localMode: true,
      });

      const result = await executeWeave({
        meshRoot,
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
    .command(
      "validate",
      new Command()
        .description("Validate the current local state for targeted resources.")
        .option(
          "--mesh-root <meshRoot:string>",
          "Mesh root to validate. Defaults to the current directory.",
          { default: "." },
        )
        .option(
          "--target <target:string>",
          TARGET_OPTION_DESCRIPTION,
          { collect: true },
        )
        .action(async (
          options: {
            meshRoot: string;
            target?: string[];
          },
        ) => {
          const meshRoot = resolve(options.meshRoot);
          const workspaceRoot = await inferCliWorkspaceRoot(meshRoot);
          const targets = resolveSharedTargetSpecs(options, "validate");
          const logDir = join(workspaceRoot, ".weave", "logs");
          const { auditLogger } = createRuntimeLoggers({ logDir });

          await auditLogger.command("validate", {
            meshRoot,
            workspaceRoot,
            targets,
            localMode: true,
          });

          const result = await executeValidate({
            meshRoot,
            request: targets.length > 0 ? { targets } : undefined,
          });
          if (result.findings.length > 0) {
            throw new WeaveInputError(
              result.findings.map((finding) =>
                `${finding.severity}: ${finding.message}`
              ).join("\n"),
            );
          }
          console.log(describeValidateResult(result));
        }),
    )
    .command(
      "version",
      new Command()
        .description(
          "Version the current targeted resources without page generation.",
        )
        .option(
          "--mesh-root <meshRoot:string>",
          "Mesh root to version. Defaults to the current directory.",
          { default: "." },
        )
        .option(
          "--target <target:string>",
          TARGET_OPTION_DESCRIPTION,
          { collect: true },
        )
        .option(
          "--payload-history-segment <segment:string>",
          "Payload history segment name for a single targeted payload version.",
        )
        .option(
          "--payload-state-segment <segment:string>",
          "Payload state segment name for a single targeted payload version.",
        )
        .option(
          "--payload-manifestation-segment <segment:string>",
          "Payload manifestation segment name for a single targeted payload version.",
        )
        .action(async (
          options: {
            meshRoot: string;
            target?: string[];
            payloadHistorySegment?: string;
            payloadStateSegment?: string;
            payloadManifestationSegment?: string;
          },
        ) => {
          const meshRoot = resolve(options.meshRoot);
          const workspaceRoot = await inferCliWorkspaceRoot(meshRoot);
          const targets = resolveVersionTargetSpecs(options, "version");
          const logDir = join(workspaceRoot, ".weave", "logs");
          const { auditLogger } = createRuntimeLoggers({ logDir });

          await auditLogger.command("version", {
            meshRoot,
            workspaceRoot,
            targets,
            localMode: true,
          });

          const result = await executeVersion({
            meshRoot,
            request: targets.length > 0 ? { targets } : undefined,
          });
          console.log(describeVersionResult(result));
          for (const path of result.createdPaths) {
            console.log(path);
          }
          for (const path of result.updatedPaths) {
            console.log(path);
          }
        }),
    )
    .command(
      "generate",
      new Command()
        .description(
          "Render current ResourcePages from the settled local workspace state.",
        )
        .option(
          "--mesh-root <meshRoot:string>",
          "Mesh root for page generation. Defaults to the current directory.",
          { default: "." },
        )
        .option(
          "--target <target:string>",
          TARGET_OPTION_DESCRIPTION,
          { collect: true },
        )
        .action(async (
          options: {
            meshRoot: string;
            target?: string[];
          },
        ) => {
          const meshRoot = resolve(options.meshRoot);
          const workspaceRoot = await inferCliWorkspaceRoot(meshRoot);
          const targets = resolveSharedTargetSpecs(options, "generate");
          const logDir = join(workspaceRoot, ".weave", "logs");
          const { auditLogger } = createRuntimeLoggers({ logDir });

          await auditLogger.command("generate", {
            meshRoot,
            workspaceRoot,
            targets,
            localMode: true,
          });

          const result = await executeGenerate({
            meshRoot,
            request: targets.length > 0 ? { targets } : undefined,
          });
          console.log(describeGenerateResult(result));
          for (const path of result.createdPaths) {
            console.log(path);
          }
          for (const path of result.updatedPaths) {
            console.log(path);
          }
        }),
    )
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
          const normalizedDesignatorPath = resolveCliArgumentDesignatorPath(
            designatorPath,
            "extract requires a positional designatorPath",
            "extract designatorPath",
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
          "--mesh-root <meshRoot:string>",
          "Mesh root to update. Defaults to the current directory.",
          { default: "." },
        )
        .option(
          "--grant-source-directory <path:string>",
          "Add a mesh config workingLocalRelativePath grant for this source directory.",
        )
        .action(async (options, source, designatorPathArg) => {
          const designatorPath = resolveIntegrateDesignatorPath(
            options,
            designatorPathArg,
          );
          const meshRoot = resolve(options.meshRoot);
          const workspaceRoot = await inferCliWorkspaceRoot(meshRoot);
          const logDir = join(workspaceRoot, ".weave", "logs");
          const { operationalLogger, auditLogger } = createRuntimeLoggers({
            logDir,
          });

          await auditLogger.command("integrate", {
            meshRoot,
            workspaceRoot,
            designatorPath,
            source,
            grantSourceDirectory: options.grantSourceDirectory,
            localMode: true,
          });

          const result = await executeIntegrate({
            meshRoot,
            sourceBaseDirectory: Deno.cwd(),
            sourceAccessDirectory: options.grantSourceDirectory,
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
              "--mesh-root <meshRoot:string>",
              "Mesh root path. Relative values are resolved from the current directory and must stay inside the workspace.",
            )
            .option(
              "--no-nojekyll",
              "Do not create a GitHub Pages .nojekyll publishing guard.",
            )
            .option(
              "--interactive",
              "Prompt for meshBase when it was not provided on the command line.",
            )
            .action(async (options) => {
              const workspaceRoot = resolve(options.workspace);
              const meshRoot = normalizeCliMeshRoot(
                workspaceRoot,
                options.meshRoot,
              );
              const meshBase = await resolveMeshBaseOption(options);
              const logDir = join(workspaceRoot, ".weave", "logs");
              const { operationalLogger, auditLogger } = createRuntimeLoggers({
                logDir,
              });

              await auditLogger.command("mesh.create", {
                workspaceRoot,
                meshRoot,
                localMode: true,
              });

              const result = await executeMeshCreate({
                workspaceRoot,
                meshRoot,
                request: {
                  meshBase,
                  includeNoJekyll: options.nojekyll === false
                    ? false
                    : undefined,
                },
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
              const normalizedDesignatorPath = resolveCliArgumentDesignatorPath(
                designatorPath,
                "knop add-reference requires a positional designatorPath",
                "knop add-reference designatorPath",
                (message) => new KnopAddReferenceInputError(message),
              );
              const workspaceRoot = resolve(options.workspace);
              const referenceTargetDesignatorPath =
                resolveCliOptionDesignatorPath(
                  options.referenceTargetDesignatorPath,
                  "knop add-reference requires --reference-target-designator-path",
                  "knop add-reference referenceTargetDesignatorPath",
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
              const normalizedDesignatorPath = resolveCliArgumentDesignatorPath(
                designatorPath,
                "knop create requires a positional designatorPath",
                "knop create designatorPath",
                (message) => new KnopCreateInputError(message),
              );
              const workspaceRoot = resolve(options.workspace);
              const logDir = join(workspaceRoot, ".weave", "logs");
              const { operationalLogger, auditLogger } = createRuntimeLoggers({
                logDir,
              });

              await auditLogger.command("knop.create", {
                workspaceRoot,
                designatorPath: normalizedDesignatorPath,
                localMode: true,
              });

              const result = await executeKnopCreate({
                workspaceRoot,
                request: { designatorPath: normalizedDesignatorPath },
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

function normalizeCliMeshRoot(
  workspaceRoot: string,
  meshRoot: string | undefined,
): string {
  if (meshRoot === undefined) {
    return ".";
  }

  const absoluteMeshRoot = resolve(meshRoot);
  const relation = relative(workspaceRoot, absoluteMeshRoot).replaceAll(
    "\\",
    "/",
  );
  if (relation.length === 0) {
    return ".";
  }
  if (relation.startsWith("../") || relation === ".." || isAbsolute(relation)) {
    throw new Error(
      `mesh root must stay inside the workspace root: ${meshRoot}`,
    );
  }
  return relation;
}

async function inferCliWorkspaceRoot(meshRoot: string): Promise<string> {
  return (await loadOperationalLocalPathPolicy(meshRoot)).workspaceRoot;
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
  const optionValue = normalizeOptionalCliDesignatorPath(
    options.designatorPath,
  );
  const argumentValue = normalizeOptionalCliDesignatorPath(designatorPathArg);

  if (optionValue !== undefined && argumentValue !== undefined) {
    if (optionValue !== argumentValue) {
      throw errorMessages.createError(errorMessages.conflictMessage);
    }

    return optionValue;
  }

  if (optionValue !== undefined) {
    return optionValue;
  }

  if (argumentValue !== undefined) {
    return argumentValue;
  }

  throw errorMessages.createError(errorMessages.missingMessage);
}

function resolveSharedTargetSpecs(
  options: {
    target?: readonly string[];
  },
  commandName: string,
): readonly TargetSpec[] {
  const values = options.target;
  if (!values || values.length === 0) {
    return [];
  }

  return values.map((value, index) =>
    parseTargetSpec(value, index, commandName)
  );
}

function resolveVersionTargetSpecs(
  options: {
    target?: readonly string[];
    payloadHistorySegment?: string;
    payloadStateSegment?: string;
    payloadManifestationSegment?: string;
  },
  commandName: string,
): readonly VersionTargetSpec[] {
  const targets = resolveSharedTargetSpecs(options, commandName);
  if (targets.length === 0) {
    if (
      options.payloadHistorySegment !== undefined ||
      options.payloadStateSegment !== undefined ||
      options.payloadManifestationSegment !== undefined
    ) {
      throw new WeaveInputError(
        "Payload version naming requires exactly one --target.",
      );
    }
    return [];
  }
  const payloadHistorySegment = resolveOptionalWeavePayloadSegment(
    options.payloadHistorySegment,
    `${commandName} --payload-history-segment`,
  );
  const payloadStateSegment = resolveOptionalWeavePayloadSegment(
    options.payloadStateSegment,
    `${commandName} --payload-state-segment`,
  );
  const payloadManifestationSegment = resolveOptionalWeavePayloadSegment(
    options.payloadManifestationSegment,
    `${commandName} --payload-manifestation-segment`,
  );

  if (
    payloadHistorySegment === undefined &&
    payloadStateSegment === undefined &&
    payloadManifestationSegment === undefined
  ) {
    return targets;
  }
  if (targets.length !== 1) {
    throw new WeaveInputError(
      "Payload version naming requires exactly one --target.",
    );
  }

  return [{
    ...targets[0]!,
    ...(payloadHistorySegment ? { historySegment: payloadHistorySegment } : {}),
    ...(payloadStateSegment ? { stateSegment: payloadStateSegment } : {}),
    ...(payloadManifestationSegment
      ? { manifestationSegment: payloadManifestationSegment }
      : {}),
  }];
}

function parseTargetSpec(
  value: string,
  index: number,
  commandName: string,
): TargetSpec {
  const fieldName = `${commandName} --target[${index}]`;
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
    if (separatorIndex <= 0) {
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

  const rawDesignatorPath = record.designatorPath?.trim() ?? "";
  const designatorPath = rawDesignatorPath.length === 0
    ? ""
    : normalizeCliDesignatorPath(
      rawDesignatorPath,
      `${fieldName}.designatorPath`,
      (message) => new WeaveInputError(message),
    );
  if (designatorPath.length === 0) {
    if (rawDesignatorPath.length === 0) {
      throw new WeaveInputError(`${fieldName}.designatorPath is required`);
    }
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

function resolveOptionalWeavePayloadSegment(
  value: string | undefined,
  fieldName: string,
): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  return resolveRequiredOptionValue(
    value,
    `${fieldName} is required`,
    (message) => new WeaveInputError(message),
  );
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

function resolveCliArgumentDesignatorPath(
  value: string | undefined,
  errorMessage: string,
  fieldName: string,
  createError: (message: string) => Error,
): string {
  return normalizeCliDesignatorPath(
    resolveRequiredArgumentValue(value, errorMessage, createError),
    fieldName,
    createError,
  );
}

function resolveCliOptionDesignatorPath(
  value: string | undefined,
  errorMessage: string,
  fieldName: string,
  createError: (message: string) => Error,
): string {
  return normalizeCliDesignatorPath(
    resolveRequiredOptionValue(value, errorMessage, createError),
    fieldName,
    createError,
  );
}

function normalizeOptionalCliDesignatorPath(
  value: string | undefined,
): string | undefined {
  const trimmed = value?.trim();
  return trimmed === undefined || trimmed.length === 0
    ? undefined
    : normalizeCliDesignatorPath(trimmed, "designatorPath", (message) =>
      new Error(message));
}
