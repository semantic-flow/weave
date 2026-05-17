import { Command } from "@cliffy/command";
import { Confirm, Input } from "@cliffy/prompt";
import { basename, isAbsolute, join, relative, resolve } from "@std/path";
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
  describeGHPagesDeployBootstrapPlan,
  describeGHPagesDeployBootstrapResult,
  executeGHPagesDeployBootstrap,
  GHPagesDeployInputError,
  GHPagesDeployRuntimeError,
  planGHPagesDeployBootstrap,
} from "../runtime/deploy/gh_pages.ts";
import {
  describeExtractAllTermsResult,
  describeExtractResult,
  describeSetExtractionSourceAllTermsResult,
  describeSetExtractionSourceResult,
  executeExtract,
  executeExtractAllTerms,
  executeSetExtractionSource,
  executeSetExtractionSourceAllTerms,
  ExtractRuntimeError,
  previewExtractAllTerms,
  previewSetExtractionSourceAllTerms,
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
  type WeaveProgressEvent,
  WeaveRuntimeError,
} from "../runtime/weave/weave.ts";
import { loadOperationalLocalPathPolicy } from "../runtime/operational/local_path_policy.ts";
import type { HistoryTrackingPolicy } from "../runtime/config/effective_config.ts";
import { WEAVE_VERSION } from "../version.ts";

const TARGET_OPTION_DESCRIPTION =
  "Target spec as comma-separated key=value fields. Supported keys: designatorPath, recursive. Versioning commands also accept historySegment, stateSegment, and manifestationSegment.";
const HISTORY_TRACKING_POLICY_VALUES = [
  "versioned",
  "currentOnly",
  "required",
  "slimHistory",
  "checkpointOnly",
  "metadataOnly",
] as const satisfies readonly HistoryTrackingPolicy[];
const CLI_LOG_DIR_ENV_VAR = "WEAVE_LOG_DIR";

export async function runWeaveCli(args: string[]): Promise<number> {
  let exitCode = 0;

  const command = new Command()
    .name("weave")
    .version(WEAVE_VERSION)
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
    .option(
      "--history-tracking-policy <policy:string>",
      "Override the history tracking policy for all artifact roles during this command.",
    )
    .option(
      "--silent",
      "Suppress progress updates for long-running weave operations.",
    )
    .action(async (
      options: {
        meshRoot: string;
        target?: string[];
        payloadHistorySegment?: string;
        payloadStateSegment?: string;
        payloadManifestationSegment?: string;
        historyTrackingPolicy?: string;
        silent?: boolean;
      },
    ) => {
      const meshRoot = resolve(options.meshRoot);
      const workspaceRoot = await inferCliWorkspaceRoot(meshRoot);
      const targets = resolveVersionTargetSpecs(options, "weave");
      const historyTrackingPolicyOverride = resolveHistoryTrackingPolicyOption(
        options.historyTrackingPolicy,
      );
      const logDir = resolveCliLogDir(workspaceRoot);
      const { operationalLogger, auditLogger } = createRuntimeLoggers({
        logDir,
      });

      await auditLogger.command("weave", {
        meshRoot,
        workspaceRoot,
        targets,
        historyTrackingPolicyOverride,
        localMode: true,
      });

      const result = await executeWeave({
        meshRoot,
        request: targets.length > 0 ? { targets } : undefined,
        operationalLogger,
        auditLogger,
        historyTrackingPolicyOverride,
        onProgress: options.silent ? undefined : printWeaveProgress,
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
          const logDir = resolveCliLogDir(workspaceRoot);
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
        .option(
          "--history-tracking-policy <policy:string>",
          "Override the history tracking policy for all artifact roles during this command.",
        )
        .action(async (
          options: {
            meshRoot: string;
            target?: string[];
            payloadHistorySegment?: string;
            payloadStateSegment?: string;
            payloadManifestationSegment?: string;
            historyTrackingPolicy?: string;
          },
        ) => {
          const meshRoot = resolve(options.meshRoot);
          const workspaceRoot = await inferCliWorkspaceRoot(meshRoot);
          const targets = resolveVersionTargetSpecs(options, "version");
          const historyTrackingPolicyOverride =
            resolveHistoryTrackingPolicyOption(options.historyTrackingPolicy);
          const logDir = resolveCliLogDir(workspaceRoot);
          const { auditLogger } = createRuntimeLoggers({ logDir });

          await auditLogger.command("version", {
            meshRoot,
            workspaceRoot,
            targets,
            historyTrackingPolicyOverride,
            localMode: true,
          });

          const result = await executeVersion({
            meshRoot,
            request: targets.length > 0 ? { targets } : undefined,
            historyTrackingPolicyOverride,
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
        .option(
          "--include-semantic-flow-metadata",
          "Include the generated Semantic Flow metadata section on ResourcePages.",
        )
        .option(
          "--history-tracking-policy <policy:string>",
          "Override the history tracking policy for all artifact roles during this command.",
        )
        .action(async (
          options: {
            meshRoot: string;
            target?: string[];
            includeSemanticFlowMetadata?: boolean;
            historyTrackingPolicy?: string;
          },
        ) => {
          const meshRoot = resolve(options.meshRoot);
          const workspaceRoot = await inferCliWorkspaceRoot(meshRoot);
          const targets = resolveSharedTargetSpecs(options, "generate");
          const historyTrackingPolicyOverride =
            resolveHistoryTrackingPolicyOption(options.historyTrackingPolicy);
          const logDir = resolveCliLogDir(workspaceRoot);
          const { auditLogger } = createRuntimeLoggers({ logDir });

          await auditLogger.command("generate", {
            meshRoot,
            workspaceRoot,
            targets,
            includeSemanticFlowMetadata:
              options.includeSemanticFlowMetadata === true,
            historyTrackingPolicyOverride,
            localMode: true,
          });

          const result = await executeGenerate({
            meshRoot,
            request: targets.length > 0 ? { targets } : undefined,
            includeSemanticFlowMetadata:
              options.includeSemanticFlowMetadata === true,
            historyTrackingPolicyOverride,
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
        .arguments("[designatorPath:string]")
        .option(
          "--all-terms",
          "Extract all new mesh-scoped named terms from the selected RDF source artifact.",
        )
        .option(
          "--mesh-root <meshRoot:string>",
          "Mesh root to update. Defaults to the current directory.",
          { default: "." },
        )
        .option(
          "--source <sourceDesignatorPath:string>",
          "Explicit current-tracking woven payload designator to extract from when target mention resolution would be ambiguous.",
        )
        .option(
          "--source-state <sourceStatePath:string>",
          "Historical source state to pin the extraction source to.",
        )
        .option(
          "--accept-preview",
          "Accept the all-terms preview without an interactive prompt.",
        )
        .option(
          "--add-source-references",
          "Create source ReferenceLinks for terms newly extracted by --all-terms.",
        )
        .option(
          "--reference-role <referenceRole:string>",
          "ReferenceRole token to assign when --add-source-references is supplied.",
        )
        .action(async (
          options: {
            meshRoot: string;
            source?: string;
            sourceState?: string;
            allTerms?: boolean;
            acceptPreview?: boolean;
            addSourceReferences?: boolean;
            referenceRole?: string;
          },
          designatorPath?: string,
        ) => {
          const meshRoot = resolve(options.meshRoot);
          const workspaceRoot = await inferCliWorkspaceRoot(meshRoot);
          const logDir = resolveCliLogDir(workspaceRoot);
          const { operationalLogger, auditLogger } = createRuntimeLoggers({
            logDir,
          });

          if (options.allTerms) {
            if (
              typeof designatorPath === "string" &&
              designatorPath.trim().length > 0
            ) {
              throw new ExtractInputError(
                "extract --all-terms does not accept a positional designatorPath",
              );
            }
            assertMutuallyExclusiveSourceOptions(
              options.source,
              options.sourceState,
              "extract --all-terms",
            );
            if (!options.source && !options.sourceState) {
              throw new ExtractInputError(
                "extract --all-terms requires --source or --source-state",
              );
            }
            if (options.addSourceReferences && !options.referenceRole) {
              throw new ExtractInputError(
                "extract --all-terms --add-source-references requires --reference-role",
              );
            }
            if (!options.addSourceReferences && options.referenceRole) {
              throw new ExtractInputError(
                "extract --all-terms --reference-role requires --add-source-references",
              );
            }
            const preview = await previewExtractAllTerms({
              meshRoot,
              request: {
                ...(options.source
                  ? { sourceDesignatorPath: options.source }
                  : {}),
                ...(options.sourceState
                  ? { sourceStatePath: options.sourceState }
                  : {}),
                ...(options.addSourceReferences
                  ? {
                    addSourceReferences: true,
                    referenceRole: options.referenceRole,
                  }
                  : {}),
              },
            });
            printExtractAllTermsPreview(preview.extractedDesignatorPaths);
            if (!options.acceptPreview) {
              const confirmed = await Confirm.prompt({
                message: "Create all listed identifiers?",
                default: false,
              });
              if (!confirmed) {
                console.log("All-terms extract cancelled.");
                return;
              }
            }

            await auditLogger.command("extract.allTerms", {
              meshRoot,
              workspaceRoot,
              sourceDesignatorPath: options.source,
              sourceStatePath: options.sourceState,
              addSourceReferences: options.addSourceReferences,
              referenceRole: options.referenceRole,
              localMode: true,
            });

            const result = await executeExtractAllTerms({
              meshRoot,
              request: {
                ...(options.source
                  ? { sourceDesignatorPath: options.source }
                  : {}),
                ...(options.sourceState
                  ? { sourceStatePath: options.sourceState }
                  : {}),
                ...(options.addSourceReferences
                  ? {
                    addSourceReferences: true,
                    referenceRole: options.referenceRole,
                  }
                  : {}),
              },
              operationalLogger,
              auditLogger,
            });
            console.log(describeExtractAllTermsResult(result));
            for (const path of result.createdPaths) {
              console.log(path);
            }
            for (const path of result.updatedPaths) {
              console.log(path);
            }
            return;
          }

          if (options.addSourceReferences || options.referenceRole) {
            throw new ExtractInputError(
              "extract source-reference options require --all-terms",
            );
          }

          const normalizedDesignatorPath = resolveCliArgumentDesignatorPath(
            designatorPath,
            "extract requires a positional designatorPath",
            "extract designatorPath",
            (message) => new ExtractInputError(message),
          );
          assertMutuallyExclusiveSourceOptions(
            options.source,
            options.sourceState,
            "extract",
          );

          await auditLogger.command("extract", {
            meshRoot,
            workspaceRoot,
            designatorPath: normalizedDesignatorPath,
            sourceDesignatorPath: options.source,
            sourceStatePath: options.sourceState,
            localMode: true,
          });

          const result = await executeExtract({
            meshRoot,
            request: {
              designatorPath: normalizedDesignatorPath,
              ...(options.source
                ? { sourceDesignatorPath: options.source }
                : {}),
              ...(options.sourceState
                ? { sourceStatePath: options.sourceState }
                : {}),
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
      "set",
      new Command()
        .description("Update local Weave resource settings.")
        .command(
          "extraction-source",
          new Command()
            .description(
              "Replace the extraction-source contract for an existing extracted Knop.",
            )
            .arguments("[designatorPath:string]")
            .option(
              "--all-terms",
              "Update all existing extracted terms discovered in the selected RDF source artifact.",
            )
            .option(
              "--mesh-root <meshRoot:string>",
              "Mesh root to update. Defaults to the current directory.",
              { default: "." },
            )
            .option(
              "--source <sourceDesignatorPath:string>",
              "Current-tracking woven payload designator to use as the extraction source.",
            )
            .option(
              "--source-state <sourceStatePath:string>",
              "Historical source state to pin the extraction source to.",
            )
            .option(
              "--accept-preview",
              "Accept the all-terms preview without an interactive prompt.",
            )
            .action(async (
              options: {
                meshRoot: string;
                source?: string;
                sourceState?: string;
                allTerms?: boolean;
                acceptPreview?: boolean;
              },
              designatorPath?: string,
            ) => {
              const meshRoot = resolve(options.meshRoot);
              const workspaceRoot = await inferCliWorkspaceRoot(meshRoot);
              const logDir = resolveCliLogDir(workspaceRoot);
              const { operationalLogger, auditLogger } = createRuntimeLoggers({
                logDir,
              });
              assertMutuallyExclusiveSourceOptions(
                options.source,
                options.sourceState,
                "set extraction-source",
              );
              if (!options.source && !options.sourceState) {
                throw new ExtractInputError(
                  "set extraction-source requires --source or --source-state",
                );
              }

              if (options.allTerms) {
                if (
                  typeof designatorPath === "string" &&
                  designatorPath.trim().length > 0
                ) {
                  throw new ExtractInputError(
                    "set extraction-source --all-terms does not accept a positional designatorPath",
                  );
                }
                const request = {
                  ...(options.source
                    ? { sourceDesignatorPath: options.source }
                    : {}),
                  ...(options.sourceState
                    ? { sourceStatePath: options.sourceState }
                    : {}),
                };
                const preview = await previewSetExtractionSourceAllTerms({
                  meshRoot,
                  request,
                });
                printSetExtractionSourceAllTermsPreview(
                  preview.updatedDesignatorPaths,
                );
                if (!options.acceptPreview) {
                  const confirmed = await Confirm.prompt({
                    message: "Update all listed extraction sources?",
                    default: false,
                  });
                  if (!confirmed) {
                    console.log(
                      "All-terms extraction-source update cancelled.",
                    );
                    return;
                  }
                }

                await auditLogger.command("set.extractionSource.allTerms", {
                  meshRoot,
                  workspaceRoot,
                  sourceDesignatorPath: options.source,
                  sourceStatePath: options.sourceState,
                  localMode: true,
                });
                const result = await executeSetExtractionSourceAllTerms({
                  meshRoot,
                  request,
                  operationalLogger,
                  auditLogger,
                });
                console.log(describeSetExtractionSourceAllTermsResult(result));
                for (const path of result.updatedPaths) {
                  console.log(path);
                }
                return;
              }

              const normalizedDesignatorPath = resolveCliArgumentDesignatorPath(
                designatorPath,
                "set extraction-source requires a positional designatorPath",
                "set extraction-source designatorPath",
                (message) => new ExtractInputError(message),
              );
              await auditLogger.command("set.extractionSource", {
                meshRoot,
                workspaceRoot,
                designatorPath: normalizedDesignatorPath,
                sourceDesignatorPath: options.source,
                sourceStatePath: options.sourceState,
                localMode: true,
              });
              const result = await executeSetExtractionSource({
                meshRoot,
                request: {
                  designatorPath: normalizedDesignatorPath,
                  ...(options.source
                    ? { sourceDesignatorPath: options.source }
                    : {}),
                  ...(options.sourceState
                    ? { sourceStatePath: options.sourceState }
                    : {}),
                },
                operationalLogger,
                auditLogger,
              });
              console.log(describeSetExtractionSourceResult(result));
              for (const path of result.updatedPaths) {
                console.log(path);
              }
            }),
        ),
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
          const logDir = resolveCliLogDir(workspaceRoot);
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
              "--mesh-root <meshRoot:string>",
              "Mesh root to update. Defaults to the current directory.",
              { default: "." },
            )
            .action(async (options, source, designatorPathArg) => {
              const meshRoot = resolve(options.meshRoot);
              const workspaceRoot = await inferCliWorkspaceRoot(meshRoot);
              const designatorPath = resolvePayloadUpdateDesignatorPath(
                options,
                designatorPathArg,
              );
              const logDir = resolveCliLogDir(workspaceRoot);
              const { operationalLogger, auditLogger } = createRuntimeLoggers({
                logDir,
              });

              await auditLogger.command("payload.update", {
                meshRoot,
                workspaceRoot,
                designatorPath,
                source,
                localMode: true,
              });

              const result = await executePayloadUpdate({
                workspaceRoot: meshRoot,
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
      "prepare",
      new Command()
        .description("Publication preparation operations.")
        .command(
          "gh-pages",
          new Command()
            .description(
              "Prepare a branch-published GitHub Pages mesh in a publication worktree.",
            )
            .option(
              "--source-root <sourceRoot:string>",
              "Source checkout root to read during branch-published preparation.",
              { default: "." },
            )
            .option(
              "--publish-root <publishRoot:string>",
              "Publication branch worktree root to update.",
            )
            .option(
              "--mesh-base <meshBase:string>",
              "Canonical base IRI for Semantic Flow identifiers in the published mesh.",
            )
            .option(
              "--no-nojekyll",
              "Do not create a GitHub Pages .nojekyll publishing guard.",
            )
            .option(
              "--cname <cname:string>",
              "Create or update the publication branch CNAME file.",
            )
            .option(
              "--allow-dirty-publish-root",
              "Allow preparation even when the publication worktree has uncommitted changes.",
            )
            .option(
              "--dry-run",
              "Print the branch-published preparation plan without writing publication files.",
            )
            .option(
              "--commit",
              "Create a local publication commit after successful generation when the publication diff is non-empty.",
            )
            .option(
              "--commit-message <commitMessage:string>",
              "Commit message to use with --commit.",
            )
            .option(
              "--source-path <sourcePath:string>",
              "Repository-relative source path to materialize into the publication mesh.",
            )
            .option(
              "--target-path <targetPath:string>",
              "Publication-root relative target path for the materialized source. Defaults to --source-path.",
            )
            .option(
              "--payload-history-segment <segment:string>",
              "Payload history segment for the materialized source artifact.",
            )
            .option(
              "--payload-state-segment <segment:string>",
              "Payload state segment for the materialized source artifact.",
            )
            .option(
              "--payload-manifestation-segment <segment:string>",
              "Payload manifestation segment for the materialized source artifact.",
            )
            .option(
              "--designator-path <designatorPath:string>",
              "Designator path for the materialized source artifact.",
            )
            .option(
              "--source-repository-url <sourceRepositoryUrl:string>",
              "Durable repository URL to record for the materialized source locator.",
            )
            .option(
              "--source-ref <sourceRepositoryRef:string>",
              "Durable repository ref to record for the materialized source locator.",
            )
            .option(
              "--source-commit <sourceRepositoryCommit:string>",
              "Optional resolved commit to record for the materialized source locator.",
            )
            .option(
              "--interactive",
              "Prompt for missing branch-published preparation inputs.",
            )
            .action(async (
              options: {
                sourceRoot: string;
                publishRoot?: string;
                meshBase?: string;
                nojekyll?: boolean;
                cname?: string;
                allowDirtyPublishRoot?: boolean;
                dryRun?: boolean;
                commit?: boolean;
                commitMessage?: string;
                sourcePath?: string;
                targetPath?: string;
                payloadHistorySegment?: string;
                payloadStateSegment?: string;
                payloadManifestationSegment?: string;
                designatorPath?: string;
                sourceRepositoryUrl?: string;
                sourceRef?: string;
                sourceCommit?: string;
                interactive?: boolean;
              },
            ) => {
              const sourceRoot = resolve(options.sourceRoot);
              const promptForMissingInputs = options.interactive === true ||
                Deno.stdin.isTerminal();
              const publishRoot = await resolvePublishRootOption({
                sourceRoot,
                publishRoot: options.publishRoot,
                interactive: promptForMissingInputs,
              });
              const meshBase = await resolveMeshBaseOption(
                {
                  meshBase: options.meshBase,
                  interactive: promptForMissingInputs,
                },
                "prepare gh-pages",
                "an interactive terminal",
              );
              const request = {
                meshBase,
                includeNoJekyll: options.nojekyll === false ? false : undefined,
                ...(options.cname !== undefined
                  ? { cname: options.cname }
                  : {}),
                ...(resolveGHPagesSourceBindingOption(options) ?? {}),
              };
              const allowDirtyPublicationRoot =
                options.allowDirtyPublishRoot === true;
              const commit = resolveGHPagesCommitOption({
                commit: options.commit,
                commitMessage: options.commitMessage,
              });

              if (options.dryRun === true) {
                const plan = await planGHPagesDeployBootstrap({
                  sourceRoot,
                  publishRoot,
                  request,
                  allowDirtyPublicationRoot,
                  commit,
                });
                console.log(describeGHPagesDeployBootstrapPlan(plan));
                return;
              }

              const { operationalLogger, auditLogger } = createRuntimeLoggers({
                logDir: resolveOptionalCliLogDir(),
              });

              await auditLogger.command("prepare.ghPages", {
                sourceRoot,
                publishRoot,
                meshBase,
                localMode: true,
                localCommit: commit !== undefined,
              });

              const result = await executeGHPagesDeployBootstrap({
                sourceRoot,
                publishRoot,
                request,
                allowDirtyPublicationRoot,
                commit,
                operationalLogger,
                auditLogger,
              });
              console.log(describeGHPagesDeployBootstrapResult(result));
              for (const path of result.createdPaths) {
                console.log(path);
              }
              for (const path of result.updatedPaths) {
                console.log(path);
              }
              if (result.materializedSource) {
                for (const path of result.materializedSource.createdPaths) {
                  console.log(path);
                }
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
              const logDir = resolveCliLogDir(workspaceRoot);
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
              "--mesh-root <meshRoot:string>",
              "Mesh root to update. Defaults to the current directory.",
              { default: "." },
            )
            .action(async (options, designatorPath) => {
              const normalizedDesignatorPath = resolveCliArgumentDesignatorPath(
                designatorPath,
                "knop add-reference requires a positional designatorPath",
                "knop add-reference designatorPath",
                (message) => new KnopAddReferenceInputError(message),
              );
              const meshRoot = resolve(options.meshRoot);
              const workspaceRoot = await inferCliWorkspaceRoot(meshRoot);
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
              const logDir = resolveCliLogDir(workspaceRoot);
              const { operationalLogger, auditLogger } = createRuntimeLoggers({
                logDir,
              });

              await auditLogger.command("knop.addReference", {
                meshRoot,
                workspaceRoot,
                designatorPath: normalizedDesignatorPath,
                referenceTargetDesignatorPath,
                referenceRole,
                localMode: true,
              });

              const result = await executeKnopAddReference({
                workspaceRoot: meshRoot,
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
              "--mesh-root <meshRoot:string>",
              "Mesh root to update. Defaults to the current directory.",
              { default: "." },
            )
            .action(async (options, designatorPath) => {
              const normalizedDesignatorPath = resolveCliArgumentDesignatorPath(
                designatorPath,
                "knop create requires a positional designatorPath",
                "knop create designatorPath",
                (message) => new KnopCreateInputError(message),
              );
              const meshRoot = resolve(options.meshRoot);
              const workspaceRoot = await inferCliWorkspaceRoot(meshRoot);
              const logDir = resolveCliLogDir(workspaceRoot);
              const { operationalLogger, auditLogger } = createRuntimeLoggers({
                logDir,
              });

              await auditLogger.command("knop.create", {
                meshRoot,
                workspaceRoot,
                designatorPath: normalizedDesignatorPath,
                localMode: true,
              });

              const result = await executeKnopCreate({
                workspaceRoot: meshRoot,
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

function resolveCliLogDir(workspaceRoot: string): string {
  return resolveOptionalCliLogDir() ?? join(workspaceRoot, ".weave", "logs");
}

function resolveOptionalCliLogDir(): string | undefined {
  let value: string | undefined;
  try {
    value = Deno.env.get(CLI_LOG_DIR_ENV_VAR);
  } catch {
    return undefined;
  }

  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? resolve(trimmed) : undefined;
}

function resolveHistoryTrackingPolicyOption(
  value: string | undefined,
): HistoryTrackingPolicy | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (
    HISTORY_TRACKING_POLICY_VALUES.includes(
      value as HistoryTrackingPolicy,
    )
  ) {
    return value as HistoryTrackingPolicy;
  }

  throw new WeaveInputError(
    `Unsupported history tracking policy: ${value}`,
  );
}

async function resolveMeshBaseOption(
  options: { meshBase?: string; interactive?: boolean },
  commandName = "mesh create",
  interactiveHint = "--interactive",
): Promise<string> {
  if (
    typeof options.meshBase === "string" && options.meshBase.trim().length > 0
  ) {
    return options.meshBase;
  }

  if (!options.interactive) {
    throw new MeshCreateInputError(
      `${commandName} requires --mesh-base or ${interactiveHint}`,
    );
  }

  return await Input.prompt({
    message: "Mesh base IRI",
    validate(value) {
      return value.trim().length > 0 || "meshBase is required";
    },
  });
}

async function resolvePublishRootOption(
  options: {
    sourceRoot: string;
    publishRoot?: string;
    interactive?: boolean;
  },
): Promise<string> {
  if (
    typeof options.publishRoot === "string" &&
    options.publishRoot.trim().length > 0
  ) {
    return resolve(options.publishRoot);
  }

  if (!options.interactive) {
    throw new GHPagesDeployInputError(
      "prepare gh-pages requires --publish-root or an interactive terminal",
    );
  }

  const defaultPublishRoot = resolve(
    options.sourceRoot,
    "..",
    `${basename(options.sourceRoot)}-gh-pages`,
  );

  const value = await Input.prompt({
    message: "Publication worktree path",
    default: defaultPublishRoot,
    validate(value) {
      return value.trim().length > 0 || "publishRoot is required";
    },
  });
  return resolve(value);
}

function resolveGHPagesCommitOption(
  options: {
    commit?: boolean;
    commitMessage?: string;
  },
): { message?: string } | undefined {
  if (options.commit !== true) {
    if (options.commitMessage !== undefined) {
      throw new GHPagesDeployInputError(
        "prepare gh-pages --commit-message requires --commit",
      );
    }
    return undefined;
  }

  return options.commitMessage === undefined ? {} : {
    message: options.commitMessage,
  };
}

function resolveGHPagesSourceBindingOption(
  options: {
    sourcePath?: string;
    targetPath?: string;
    payloadHistorySegment?: string;
    payloadStateSegment?: string;
    payloadManifestationSegment?: string;
    designatorPath?: string;
    sourceRepositoryUrl?: string;
    sourceRef?: string;
    sourceCommit?: string;
  },
):
  | {
    source: {
      sourcePath: string;
      designatorPath: string;
      targetPath?: string;
      historySegment?: string;
      stateSegment?: string;
      manifestationSegment?: string;
      sourceRepositoryUrl: string;
      sourceRepositoryRef: string;
      sourceRepositoryCommit?: string;
    };
  }
  | undefined {
  const hasSourceBindingOption = [
    options.sourcePath,
    options.targetPath,
    options.payloadHistorySegment,
    options.payloadStateSegment,
    options.payloadManifestationSegment,
    options.designatorPath,
    options.sourceRepositoryUrl,
    options.sourceRef,
    options.sourceCommit,
  ].some((value) => value !== undefined);

  if (!hasSourceBindingOption) {
    return undefined;
  }

  return {
    source: {
      sourcePath: resolveRequiredOptionValue(
        options.sourcePath,
        "prepare gh-pages materialization requires --source-path",
        (message) => new GHPagesDeployInputError(message),
      ),
      designatorPath: resolveRequiredOptionValue(
        options.designatorPath,
        "prepare gh-pages materialization requires --designator-path",
        (message) => new GHPagesDeployInputError(message),
      ),
      ...(options.targetPath
        ? {
          targetPath: resolveRequiredOptionValue(
            options.targetPath,
            "prepare gh-pages --target-path is required",
            (message) => new GHPagesDeployInputError(message),
          ),
        }
        : {}),
      ...(options.payloadHistorySegment
        ? {
          historySegment: resolveRequiredOptionValue(
            options.payloadHistorySegment,
            "prepare gh-pages --payload-history-segment is required",
            (message) => new GHPagesDeployInputError(message),
          ),
        }
        : {}),
      ...(options.payloadStateSegment
        ? {
          stateSegment: resolveRequiredOptionValue(
            options.payloadStateSegment,
            "prepare gh-pages --payload-state-segment is required",
            (message) => new GHPagesDeployInputError(message),
          ),
        }
        : {}),
      ...(options.payloadManifestationSegment
        ? {
          manifestationSegment: resolveRequiredOptionValue(
            options.payloadManifestationSegment,
            "prepare gh-pages --payload-manifestation-segment is required",
            (message) => new GHPagesDeployInputError(message),
          ),
        }
        : {}),
      sourceRepositoryUrl: resolveRequiredOptionValue(
        options.sourceRepositoryUrl,
        "prepare gh-pages materialization requires --source-repository-url",
        (message) => new GHPagesDeployInputError(message),
      ),
      sourceRepositoryRef: resolveRequiredOptionValue(
        options.sourceRef,
        "prepare gh-pages materialization requires --source-ref",
        (message) => new GHPagesDeployInputError(message),
      ),
      ...(options.sourceCommit
        ? {
          sourceRepositoryCommit: resolveRequiredOptionValue(
            options.sourceCommit,
            "prepare gh-pages --source-commit is required",
            (message) => new GHPagesDeployInputError(message),
          ),
        }
        : {}),
    },
  };
}

function printExtractAllTermsPreview(
  designatorPaths: readonly string[],
): void {
  console.log(
    `All-terms extract will create ${designatorPaths.length} identifiers:`,
  );
  for (const designatorPath of designatorPaths) {
    console.log(`- ${designatorPath}`);
  }
}

function printSetExtractionSourceAllTermsPreview(
  designatorPaths: readonly string[],
): void {
  console.log(
    `All-terms extraction-source update will update ${designatorPaths.length} identifiers:`,
  );
  for (const designatorPath of designatorPaths) {
    console.log(`- ${designatorPath}`);
  }
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
    parseTargetSpec(value, index, commandName, false)
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
  const values = options.target;
  const targets =
    values?.map((value, index) =>
      parseTargetSpec(value, index, commandName, true)
    ) ?? [];
  if (targets.length === 0) {
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
      return [];
    }

    return [{
      designatorPath: "",
      recursive: true,
      ...(payloadHistorySegment
        ? { historySegment: payloadHistorySegment }
        : {}),
      ...(payloadStateSegment ? { stateSegment: payloadStateSegment } : {}),
      ...(payloadManifestationSegment
        ? { manifestationSegment: payloadManifestationSegment }
        : {}),
    }];
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

  return targets.map((target) => ({
    ...target,
    ...(target.historySegment !== undefined ||
        payloadHistorySegment === undefined
      ? {}
      : { historySegment: payloadHistorySegment }),
    ...(target.stateSegment !== undefined || payloadStateSegment === undefined
      ? {}
      : { stateSegment: payloadStateSegment }),
    ...(target.manifestationSegment !== undefined ||
        payloadManifestationSegment === undefined
      ? {}
      : { manifestationSegment: payloadManifestationSegment }),
  }));
}

function parseTargetSpec(
  value: string,
  index: number,
  commandName: string,
  allowVersionFields: false,
): TargetSpec;
function parseTargetSpec(
  value: string,
  index: number,
  commandName: string,
  allowVersionFields: true,
): VersionTargetSpec;
function parseTargetSpec(
  value: string,
  index: number,
  commandName: string,
  allowVersionFields: boolean,
): TargetSpec | VersionTargetSpec {
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

    const rawKey = entry.slice(0, separatorIndex).trim();
    const key = normalizeTargetSpecKey(rawKey, allowVersionFields);
    const rawFieldValue = entry.slice(separatorIndex + 1).trim();
    if (rawFieldValue.length === 0) {
      throw new WeaveInputError(`${fieldName}.${rawKey} is required`);
    }
    if (key === undefined) {
      throw new WeaveInputError(`${fieldName}.${rawKey} is not supported`);
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

  const recursive = record.recursive;
  if (
    recursive !== undefined && recursive !== "true" && recursive !== "false"
  ) {
    throw new WeaveInputError(
      `${fieldName}.recursive must be true or false`,
    );
  }

  return {
    designatorPath,
    ...(recursive === "true" ? { recursive: true } : {}),
    ...(record.historySegment ? { historySegment: record.historySegment } : {}),
    ...(record.stateSegment ? { stateSegment: record.stateSegment } : {}),
    ...(record.manifestationSegment
      ? { manifestationSegment: record.manifestationSegment }
      : {}),
  };
}

function normalizeTargetSpecKey(
  key: string,
  allowVersionFields: boolean,
): string | undefined {
  if (key === "designatorPath" || key === "recursive") {
    return key;
  }
  if (!allowVersionFields) {
    return undefined;
  }

  switch (key) {
    case "historySegment":
    case "payloadHistorySegment":
      return "historySegment";
    case "stateSegment":
    case "payloadStateSegment":
      return "stateSegment";
    case "manifestationSegment":
    case "payloadManifestationSegment":
      return "manifestationSegment";
    default:
      return undefined;
  }
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

function printWeaveProgress(event: WeaveProgressEvent): void {
  const designatorPath = event.designatorPath.length === 0
    ? "/"
    : event.designatorPath;
  console.log(
    `[${event.percent}%] Wove ${event.completed}/${event.total}: ${designatorPath}`,
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
    error instanceof MeshCreateRuntimeError ||
    error instanceof GHPagesDeployInputError ||
    error instanceof GHPagesDeployRuntimeError
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

function assertMutuallyExclusiveSourceOptions(
  sourceDesignatorPath: string | undefined,
  sourceStatePath: string | undefined,
  commandName: string,
): void {
  if (sourceDesignatorPath && sourceStatePath) {
    throw new ExtractInputError(
      `${commandName} requires either --source or --source-state, not both`,
    );
  }
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
