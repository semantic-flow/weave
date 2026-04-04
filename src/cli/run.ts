import { Command } from "@cliffy/command";
import { Input } from "@cliffy/prompt";
import { join, resolve } from "@std/path";
import { IntegrateInputError } from "../core/integrate/integrate.ts";
import { KnopCreateInputError } from "../core/knop/create.ts";
import { MeshCreateInputError } from "../core/mesh/create.ts";
import { WeaveInputError } from "../core/weave/weave.ts";
import { createRuntimeLoggers } from "../runtime/logging/factory.ts";
import {
  describeIntegrateResult,
  executeIntegrate,
  IntegrateRuntimeError,
} from "../runtime/integrate/integrate.ts";
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
    .action(async (options) => {
      const workspaceRoot = resolve(options.workspace);
      const logDir = join(workspaceRoot, ".weave", "logs");
      const { operationalLogger, auditLogger } = createRuntimeLoggers({
        logDir,
      });

      await auditLogger.command("weave", {
        workspaceRoot,
        localMode: true,
      });

      const result = await executeWeave({
        workspaceRoot,
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
  const optionValue = options.designatorPath?.trim() ?? "";
  const argumentValue = designatorPathArg?.trim() ?? "";

  if (optionValue.length > 0 && argumentValue.length > 0) {
    if (optionValue !== argumentValue) {
      throw new IntegrateInputError(
        "integrate received conflicting designator paths",
      );
    }

    return optionValue;
  }

  if (optionValue.length > 0) {
    return optionValue;
  }

  if (argumentValue.length > 0) {
    return argumentValue;
  }

  throw new IntegrateInputError(
    "integrate requires a designator path as [designatorPath] or --designator-path",
  );
}

function getCliErrorMessage(error: unknown): string {
  if (
    error instanceof IntegrateInputError ||
    error instanceof IntegrateRuntimeError ||
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
