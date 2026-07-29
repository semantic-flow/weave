import { assert, assertEquals, assertRejects } from "@std/assert";
import { fromFileUrl, join } from "@std/path";
import {
  versionPayloadsForTesting,
  writeCombinedPlanForTesting,
} from "../../src/api/version_payloads.ts";
import { versionPayloads, WeaveApiError } from "../../src/mod.ts";
import { materializeMeshAliceBioBranch } from "../support/mesh_alice_bio_fixture.ts";
import {
  coreTarget,
  listWorkspaceFiles,
  materializePayloadMesh,
  PAYLOAD_MESH_BASE as meshBase,
  payloadBytes,
  type PayloadTargetFixture,
  payloadText,
  shaclTarget,
  snapshotPath,
  writeText,
} from "../support/payload_mesh_fixture.ts";
import {
  integrateRootPayload,
  ROOT_PAYLOAD_TURTLE_V2,
} from "../support/root_designator.ts";
import { createTestTmpDir } from "../support/test_tmp.ts";

const cliEntrypoint = fromFileUrl(
  new URL("../../src/main.ts", import.meta.url),
);

const alphaTarget: PayloadTargetFixture = {
  designatorPath: "alpha",
  label: "Alpha rules",
  latestOrdinal: 1,
  workingLocalRelativePath: "sources/beta.ttl",
};
const alphaBetaTarget: PayloadTargetFixture = {
  designatorPath: "alpha/beta",
  label: "Alpha beta rules",
  latestOrdinal: 1,
};
const rootTarget: PayloadTargetFixture = {
  designatorPath: "",
  label: "Root rules",
  latestOrdinal: 1,
  workingLocalRelativePath: "root.ttl",
};
const nestedRootTarget: PayloadTargetFixture = {
  designatorPath: "nested/root",
  label: "Nested root rules",
  latestOrdinal: 1,
};

Deno.test("versionPayloads defeats old single-target settled refusal with applied then alreadyCurrent retry", async () => {
  const meshRoot = await createTestTmpDir("weave-version-api-single-");
  await materializePayloadMesh(meshRoot, [coreTarget]);
  const bytes = payloadBytes(coreTarget, 2);

  const applied = await versionPayloads({
    meshRoot,
    items: [{ designatorPath: coreTarget.designatorPath, bytes }],
  });

  assertEquals(applied.outcomes, [{
    status: "applied",
    designatorPath: coreTarget.designatorPath,
    payloadArtifactIri: `${meshBase}${coreTarget.designatorPath}`,
    historySegment: "_history001",
    stateSegment: "_s0002",
    manifestationSegment: "ttl",
    snapshotPath:
      `${coreTarget.designatorPath}/_history001/_s0002/ttl/core.ttl`,
  }]);
  assertEquals(
    await Deno.readFile(join(meshRoot, `${coreTarget.designatorPath}.ttl`)),
    bytes,
  );
  assertEquals(
    await Deno.readFile(join(meshRoot, applied.outcomes[0]!.snapshotPath)),
    bytes,
  );
  assertEquals(applied.updatedPaths[0], `${coreTarget.designatorPath}.ttl`);

  const retry = await versionPayloads({
    meshRoot,
    items: [{ designatorPath: coreTarget.designatorPath, bytes }],
  });
  assertEquals(retry.outcomes[0]?.status, "alreadyCurrent");
  assertEquals(retry.createdPaths, []);
  assertEquals(retry.updatedPaths, []);
});

Deno.test("versionPayloads plans a deterministic coherent multi-item batch and no-op rerun", async () => {
  const meshRoot = await createTestTmpDir("weave-version-api-batch-");
  await materializePayloadMesh(meshRoot, [shaclTarget, coreTarget]);
  const request = {
    meshRoot,
    items: [
      {
        designatorPath: shaclTarget.designatorPath,
        bytes: payloadBytes(shaclTarget, 3),
      },
      {
        designatorPath: coreTarget.designatorPath,
        bytes: payloadBytes(coreTarget, 2),
      },
    ],
  };

  const applied = await versionPayloads(request);
  assertEquals(
    applied.outcomes.map((outcome) => [outcome.designatorPath, outcome.status]),
    [
      [coreTarget.designatorPath, "applied"],
      [shaclTarget.designatorPath, "applied"],
    ],
  );
  const beforeRetry = await snapshotWorkspace(meshRoot);
  const retry = await versionPayloads(request);
  assertEquals(
    retry.outcomes.map((outcome) => outcome.status),
    ["alreadyCurrent", "alreadyCurrent"],
  );
  assertEquals(retry.createdPaths, []);
  assertEquals(retry.updatedPaths, []);
  assertEquals(await snapshotWorkspace(meshRoot), beforeRetry);
});

Deno.test("versionPayloads attributes nested same-basename snapshots per candidate", async () => {
  const meshRoot = await createTestTmpDir("weave-version-api-nested-name-");
  await materializePayloadMesh(meshRoot, [alphaTarget, alphaBetaTarget]);

  const result = await versionPayloads({
    meshRoot,
    items: [
      {
        designatorPath: alphaTarget.designatorPath,
        bytes: payloadBytes(alphaTarget, 1),
      },
      {
        designatorPath: alphaBetaTarget.designatorPath,
        bytes: payloadBytes(alphaBetaTarget, 2),
      },
    ],
  });

  assertEquals(result.outcomes[0], {
    status: "alreadyCurrent",
    designatorPath: "alpha",
    payloadArtifactIri: `${meshBase}alpha`,
    historySegment: "_history001",
    stateSegment: "_s0001",
    manifestationSegment: "ttl",
    snapshotPath: "alpha/_history001/_s0001/ttl/beta.ttl",
  });
  assertEquals(result.outcomes[1]?.status, "applied");
});

Deno.test("versionPayloads attributes root snapshots per candidate in a batch", async () => {
  const meshRoot = await createTestTmpDir("weave-version-api-root-batch-");
  await materializePayloadMesh(meshRoot, [rootTarget, nestedRootTarget]);

  const result = await versionPayloads({
    meshRoot,
    items: [
      { designatorPath: "/", bytes: payloadBytes(rootTarget, 1) },
      {
        designatorPath: nestedRootTarget.designatorPath,
        bytes: payloadBytes(nestedRootTarget, 2),
      },
    ],
  });

  assertEquals(result.outcomes[0], {
    status: "alreadyCurrent",
    designatorPath: "/",
    payloadArtifactIri: meshBase,
    historySegment: "_history001",
    stateSegment: "_s0001",
    manifestationSegment: "ttl",
    snapshotPath: "_history001/_s0001/ttl/root.ttl",
  });
  assertEquals(result.outcomes[1]?.status, "applied");
});

Deno.test("versionPayloads cardinality-one adapter is byte-equivalent to the same member in a coherent batch", async () => {
  const singleRoot = await createTestTmpDir(
    "weave-version-api-cardinality-one-",
  );
  const batchRoot = await createTestTmpDir(
    "weave-version-api-cardinality-many-",
  );
  await materializePayloadMesh(singleRoot, [coreTarget]);
  await materializePayloadMesh(batchRoot, [coreTarget, shaclTarget]);

  const single = await versionPayloads({
    meshRoot: singleRoot,
    items: [{
      designatorPath: coreTarget.designatorPath,
      bytes: payloadBytes(coreTarget, 2),
    }],
  });
  await versionPayloads({
    meshRoot: batchRoot,
    items: [
      {
        designatorPath: coreTarget.designatorPath,
        bytes: payloadBytes(coreTarget, 2),
      },
      {
        designatorPath: shaclTarget.designatorPath,
        bytes: payloadBytes(shaclTarget, 3),
      },
    ],
  });

  await assertWorkspacePathsEqual(
    singleRoot,
    batchRoot,
    single.createdPaths.filter((path) => path.startsWith("rules/core/"))
      .concat(
        single.updatedPaths.filter((path) =>
          path === "rules/core.ttl" || path.startsWith("rules/core/")
        ),
      ),
  );
});

Deno.test("versionPayloads maps the public slash root designator to a real root payload transition", async () => {
  const meshRoot = await createTestTmpDir("weave-version-api-root-");
  await materializeMeshAliceBioBranch(
    "05-alice-knop-created-woven",
    meshRoot,
  );
  await integrateRootPayload(meshRoot);
  const bytes = new TextEncoder().encode(ROOT_PAYLOAD_TURTLE_V2);

  const result = await versionPayloads({
    meshRoot,
    historyTrackingPolicyOverride: "versioned",
    items: [{ designatorPath: "/", bytes }],
  });

  assertEquals(result.outcomes[0]?.designatorPath, "/");
  assertEquals(result.outcomes[0]?.payloadArtifactIri.endsWith("/"), true);
  assertEquals(
    result.outcomes[0]?.snapshotPath,
    "_history001/_s0001/ttl/root.ttl",
  );
  assertEquals(await Deno.readFile(join(meshRoot, "root.ttl")), bytes);
  assertEquals(
    await Deno.readFile(join(meshRoot, result.outcomes[0]!.snapshotPath)),
    bytes,
  );
});

Deno.test("versionPayloads whole-request refusal defeats sequential partial mutation when one batch member is malformed", async () => {
  const meshRoot = await createTestTmpDir("weave-version-api-refusal-");
  await materializePayloadMesh(meshRoot, [coreTarget, shaclTarget]);
  const inventoryPath = join(
    meshRoot,
    `${shaclTarget.designatorPath}/_knop/_inventory/inventory.ttl`,
  );
  await Deno.writeTextFile(
    inventoryPath,
    (await Deno.readTextFile(inventoryPath)).replace(
      `  sflo:latestHistoricalState <${shaclTarget.designatorPath}/_history001/_s0002> ;\n`,
      "",
    ),
  );
  const before = await snapshotWorkspace(meshRoot);

  const error = await assertRejects(
    () =>
      versionPayloads({
        meshRoot,
        items: [
          {
            designatorPath: coreTarget.designatorPath,
            bytes: payloadBytes(coreTarget, 2),
          },
          {
            designatorPath: shaclTarget.designatorPath,
            bytes: payloadBytes(shaclTarget, 3),
          },
        ],
      }),
    WeaveApiError,
  );
  assertEquals(error.stage, "load");
  assertEquals(error.code, "malformed-mesh");
  assertEquals(await snapshotWorkspace(meshRoot), before);
});

Deno.test("versionPayloads maps typed invalid mesh config to malformed-mesh at LOAD", async () => {
  const meshRoot = await createTestTmpDir("weave-version-api-bad-config-");
  await materializePayloadMesh(meshRoot, [coreTarget]);
  await writeText(
    join(meshRoot, "_mesh/_config/config.ttl"),
    `@prefix sfcfg: <https://semantic-flow.github.io/sflo/config/> .

<> a sfcfg:MeshConfig ;
  sfcfg:hasDefaultHistoryTrackingPolicy sfcfg:historyTrackingPolicy_currentOnly .
`,
  );

  const error = await assertRejects(
    () =>
      versionPayloads({
        meshRoot,
        items: [{
          designatorPath: coreTarget.designatorPath,
          bytes: payloadBytes(coreTarget, 2),
        }],
      }),
    WeaveApiError,
  );
  assertEquals([error.code, error.stage], ["malformed-mesh", "load"]);
});

Deno.test("versionPayloads maps missing settled Knop designator metadata to malformed-mesh at LOAD", async () => {
  const meshRoot = await createTestTmpDir("weave-version-api-bad-read-model-");
  await materializePayloadMesh(meshRoot, [coreTarget]);
  const metadataPath = join(
    meshRoot,
    `${coreTarget.designatorPath}/_knop/_meta/meta.ttl`,
  );
  await Deno.writeTextFile(
    metadataPath,
    (await Deno.readTextFile(metadataPath)).replace(
      `  sflo:designatorPath "${coreTarget.designatorPath}" ;\n`,
      "",
    ),
  );

  const error = await assertRejects(
    () =>
      versionPayloads({
        meshRoot,
        items: [{
          designatorPath: coreTarget.designatorPath,
          bytes: payloadBytes(coreTarget, 2),
        }],
      }),
    WeaveApiError,
  );
  assertEquals([error.code, error.stage], ["malformed-mesh", "load"]);
});

Deno.test("versionPayloads overwrites only an explicitly named current single-item state", async () => {
  const meshRoot = await createTestTmpDir("weave-version-api-overwrite-");
  await materializePayloadMesh(meshRoot, [coreTarget]);
  await versionPayloads({
    meshRoot,
    items: [{
      designatorPath: coreTarget.designatorPath,
      bytes: payloadBytes(coreTarget, 2),
    }],
  });
  const overwrittenBytes = new TextEncoder().encode(
    payloadText(coreTarget, 2).replace("Core rules", "Corrected core rules"),
  );

  const result = await versionPayloads({
    meshRoot,
    overwriteExistingState: true,
    items: [{
      designatorPath: coreTarget.designatorPath,
      bytes: overwrittenBytes,
      historySegment: "_history001",
      stateSegment: "_s0002",
    }],
  });

  assertEquals(result.outcomes[0]?.status, "applied");
  assertEquals(result.outcomes[0]?.snapshotPath, snapshotPath(coreTarget, 2));
  assertEquals(result.createdPaths, []);
  assertEquals(
    await Deno.readFile(join(meshRoot, snapshotPath(coreTarget, 2))),
    overwrittenBytes,
  );
  assertEquals(
    await Deno.readFile(join(meshRoot, `${coreTarget.designatorPath}.ttl`)),
    overwrittenBytes,
  );
});

Deno.test("versionPayloads refuses repository/floating payload sources at LOAD", async () => {
  const meshRoot = await createTestTmpDir("weave-version-api-floating-");
  await materializePayloadMesh(meshRoot, [coreTarget]);
  const inventoryPath = join(
    meshRoot,
    `${coreTarget.designatorPath}/_knop/_inventory/inventory.ttl`,
  );
  await Deno.writeTextFile(
    inventoryPath,
    (await Deno.readTextFile(inventoryPath)).replace(
      `  sflo:hasWorkingLocatedFile <${coreTarget.designatorPath}.ttl> .`,
      `  sflo:hasRepositorySourceFloatingLocator [
    a sflo:RepositorySourceFloatingLocator ;
    sflo:sourceRepositoryUrl "https://example.test/rules.git" ;
    sflo:sourceRepositoryPathFromRoot "rules/core.ttl"
  ] .`,
    ),
  );
  const before = await snapshotWorkspace(meshRoot);

  const error = await assertRejects(
    () =>
      versionPayloads({
        meshRoot,
        items: [{
          designatorPath: coreTarget.designatorPath,
          bytes: payloadBytes(coreTarget, 2),
        }],
      }),
    WeaveApiError,
  );
  assertEquals([error.code, error.stage], ["unsupported-source", "load"]);
  assertEquals(await snapshotWorkspace(meshRoot), before);
});

Deno.test("versionPayloads refuses non-text working content and zero-length text at LOAD", async () => {
  const binaryRoot = await createTestTmpDir("weave-version-api-binary-");
  await materializePayloadMesh(binaryRoot, [coreTarget]);
  const inventoryPath = join(
    binaryRoot,
    `${coreTarget.designatorPath}/_knop/_inventory/inventory.ttl`,
  );
  await Deno.writeTextFile(
    inventoryPath,
    (await Deno.readTextFile(inventoryPath)).replaceAll(
      `${coreTarget.designatorPath}.ttl`,
      `${coreTarget.designatorPath}.bin`,
    ),
  );
  await Deno.rename(
    join(binaryRoot, `${coreTarget.designatorPath}.ttl`),
    join(binaryRoot, `${coreTarget.designatorPath}.bin`),
  );

  const binaryError = await assertRejects(
    () =>
      versionPayloads({
        meshRoot: binaryRoot,
        items: [{
          designatorPath: coreTarget.designatorPath,
          bytes: payloadBytes(coreTarget, 2),
        }],
      }),
    WeaveApiError,
  );
  assertEquals(
    [binaryError.code, binaryError.stage],
    ["unsupported-content", "load"],
  );

  const emptyRoot = await createTestTmpDir("weave-version-api-empty-");
  await materializePayloadMesh(emptyRoot, [coreTarget]);
  const emptyError = await assertRejects(
    () =>
      versionPayloads({
        meshRoot: emptyRoot,
        items: [{
          designatorPath: coreTarget.designatorPath,
          bytes: new Uint8Array(),
        }],
      }),
    WeaveApiError,
  );
  assertEquals(
    [emptyError.code, emptyError.stage],
    ["unsupported-content", "load"],
  );
});

Deno.test("versionPayloads single-item output is byte-identical to the CLI update-plus-version path", async () => {
  const apiRoot = await createTestTmpDir("weave-version-api-cli-single-api-");
  const cliRoot = await createTestTmpDir("weave-version-api-cli-single-cli-");
  await materializePayloadMesh(apiRoot, [coreTarget]);
  await materializePayloadMesh(cliRoot, [coreTarget]);
  const items = [{
    designatorPath: coreTarget.designatorPath,
    bytes: payloadBytes(coreTarget, 2),
  }];

  await versionPayloads({ meshRoot: apiRoot, items });
  await runCliTwoStep(cliRoot, items);
  await assertWorkspaceTreesEqual(apiRoot, cliRoot);
});

Deno.test("versionPayloads multi-item output is byte-identical to the CLI update-plus-version batch", async () => {
  const apiRoot = await createTestTmpDir("weave-version-api-cli-batch-api-");
  const cliRoot = await createTestTmpDir("weave-version-api-cli-batch-cli-");
  await materializePayloadMesh(apiRoot, [coreTarget, shaclTarget]);
  await materializePayloadMesh(cliRoot, [coreTarget, shaclTarget]);
  const items = [
    {
      designatorPath: coreTarget.designatorPath,
      bytes: payloadBytes(coreTarget, 2),
    },
    {
      designatorPath: shaclTarget.designatorPath,
      bytes: payloadBytes(shaclTarget, 3),
    },
  ];

  await versionPayloads({ meshRoot: apiRoot, items });
  await runCliTwoStep(cliRoot, items);
  await assertWorkspaceTreesEqual(apiRoot, cliRoot);
});

Deno.test("versionPayloads dryRun forecasts the real run exactly and writes nothing", async () => {
  const meshRoot = await createTestTmpDir("weave-version-api-dry-run-");
  await materializePayloadMesh(meshRoot, [coreTarget, shaclTarget]);
  const request = {
    meshRoot,
    items: [
      {
        designatorPath: coreTarget.designatorPath,
        bytes: payloadBytes(coreTarget, 2),
      },
      {
        designatorPath: shaclTarget.designatorPath,
        bytes: payloadBytes(shaclTarget, 3),
      },
    ],
  };
  const before = await snapshotWorkspace(meshRoot);

  const forecast = await versionPayloads({ ...request, dryRun: true });
  assertEquals(forecast.executed, false);
  assertEquals(await snapshotWorkspace(meshRoot), before);

  const applied = await versionPayloads(request);
  assertEquals(applied.executed, true);
  assertEquals(forecast.outcomes, applied.outcomes);
  assertEquals(forecast.createdPaths, applied.createdPaths);
  assertEquals(forecast.updatedPaths, applied.updatedPaths);
  assertEquals(forecast.meshBase, applied.meshBase);
});

Deno.test("versionPayloads dryRun no-op forecast reports alreadyCurrent with empty path lists", async () => {
  const meshRoot = await createTestTmpDir("weave-version-api-dry-noop-");
  await materializePayloadMesh(meshRoot, [coreTarget]);
  const bytes = payloadBytes(coreTarget, 1);

  const forecast = await versionPayloads({
    meshRoot,
    dryRun: true,
    items: [{ designatorPath: coreTarget.designatorPath, bytes }],
  });

  assertEquals(forecast.executed, false);
  assertEquals(forecast.outcomes[0]?.status, "alreadyCurrent");
  assertEquals(forecast.createdPaths, []);
  assertEquals(forecast.updatedPaths, []);
});

Deno.test("versionPayloads dryRun admission parity refuses duplicates and non-boolean dryRun", async () => {
  const bytes = payloadBytes(coreTarget, 2);
  const meshRoot = Deno.build.os === "windows" ? "C:\\mesh" : "/mesh";

  const duplicateError = await assertRejects(
    () =>
      versionPayloads({
        meshRoot,
        dryRun: true,
        items: [
          { designatorPath: "rules/core", bytes },
          { designatorPath: " rules/core ", bytes },
        ],
      }),
    WeaveApiError,
  );
  assertEquals(
    [duplicateError.code, duplicateError.stage],
    ["invalid-request", "admit"],
  );

  const nonBooleanError = await assertRejects(
    () =>
      versionPayloads({
        meshRoot,
        // deno-lint-ignore no-explicit-any
        dryRun: "yes" as any,
        items: [{ designatorPath: "rules/core", bytes }],
      }),
    WeaveApiError,
  );
  assertEquals(
    [nonBooleanError.code, nonBooleanError.stage],
    ["invalid-request", "admit"],
  );
});

Deno.test("versionPayloads dryRun load parity refuses unknown targets without touching the mesh", async () => {
  const meshRoot = await createTestTmpDir("weave-version-api-dry-load-");
  await materializePayloadMesh(meshRoot, [coreTarget]);
  const before = await snapshotWorkspace(meshRoot);

  const error = await assertRejects(
    () =>
      versionPayloads({
        meshRoot,
        dryRun: true,
        items: [{
          designatorPath: "rules/missing",
          bytes: payloadBytes(coreTarget, 2),
        }],
      }),
    WeaveApiError,
  );
  assertEquals([error.code, error.stage], ["unknown-target", "load"]);
  assertEquals(await snapshotWorkspace(meshRoot), before);
});

Deno.test("versionPayloads dryRun preflight parity refuses an occupied snapshot destination", async () => {
  const meshRoot = await createTestTmpDir("weave-version-api-dry-preflight-");
  await materializePayloadMesh(meshRoot, [coreTarget]);
  await writeText(
    join(meshRoot, snapshotPath(coreTarget, 2)),
    "occupies the planned snapshot destination",
  );
  const before = await snapshotWorkspace(meshRoot);

  const error = await assertRejects(
    () =>
      versionPayloads({
        meshRoot,
        dryRun: true,
        items: [{
          designatorPath: coreTarget.designatorPath,
          bytes: payloadBytes(coreTarget, 2),
        }],
      }),
    WeaveApiError,
  );
  assertEquals([error.code, error.stage], ["plan-conflict", "plan"]);
  assertEquals(await snapshotWorkspace(meshRoot), before);
});

Deno.test("versionPayloads dryRun forecasts an explicit overwrite without writing it", async () => {
  const meshRoot = await createTestTmpDir("weave-version-api-dry-overwrite-");
  await materializePayloadMesh(meshRoot, [coreTarget]);
  await versionPayloads({
    meshRoot,
    items: [{
      designatorPath: coreTarget.designatorPath,
      bytes: payloadBytes(coreTarget, 2),
    }],
  });
  const overwrittenBytes = new TextEncoder().encode(
    payloadText(coreTarget, 2).replace("Core rules", "Corrected core rules"),
  );
  const request = {
    meshRoot,
    overwriteExistingState: true,
    items: [{
      designatorPath: coreTarget.designatorPath,
      bytes: overwrittenBytes,
      historySegment: "_history001",
      stateSegment: "_s0002",
    }],
  };
  const before = await snapshotWorkspace(meshRoot);

  const forecast = await versionPayloads({ ...request, dryRun: true });
  assertEquals(forecast.executed, false);
  assertEquals(await snapshotWorkspace(meshRoot), before);

  const applied = await versionPayloads(request);
  assertEquals(applied.executed, true);
  assertEquals(forecast.outcomes, applied.outcomes);
  assertEquals(forecast.createdPaths, applied.createdPaths);
  assertEquals(forecast.updatedPaths, applied.updatedPaths);
});

Deno.test("versionPayloads admitted overlay defeats post-plan disk mutation as a capture conflict", async () => {
  const meshRoot = await createTestTmpDir("weave-version-api-post-plan-");
  await materializePayloadMesh(meshRoot, [coreTarget]);
  const admittedBytes = payloadBytes(coreTarget, 2);

  const result = await versionPayloadsForTesting(
    {
      meshRoot,
      items: [{
        designatorPath: coreTarget.designatorPath,
        bytes: admittedBytes,
      }],
    },
    {
      afterPlan: async () => {
        await Deno.writeFile(
          join(meshRoot, `${coreTarget.designatorPath}.ttl`),
          payloadBytes(coreTarget, 99),
        );
      },
    },
  );

  assertEquals(result.outcomes[0]?.status, "applied");
  assertEquals(
    await Deno.readFile(join(meshRoot, `${coreTarget.designatorPath}.ttl`)),
    admittedBytes,
  );
  assertEquals(
    await Deno.readFile(join(meshRoot, result.outcomes[0]!.snapshotPath)),
    admittedBytes,
  );
});

for (const phase of ["working-update", "text-create"] as const) {
  Deno.test(`versionPayloads ${phase} failure reports completed paths and permits a narrowed explicit retry`, async () => {
    const meshRoot = await createTestTmpDir(`weave-version-api-fail-${phase}-`);
    await materializePayloadMesh(meshRoot, [coreTarget]);
    const request = {
      meshRoot,
      items: [{
        designatorPath: coreTarget.designatorPath,
        bytes: payloadBytes(coreTarget, 2),
      }],
    };

    const error = await assertRejects(
      () =>
        versionPayloadsForTesting(request, {
          beforeWrite: (candidatePhase) => {
            if (candidatePhase === phase) {
              throw new Error(`injected ${phase} failure`);
            }
          },
        }),
      WeaveApiError,
    );
    assertEquals([error.code, error.stage], ["io-failure", "write"]);
    assertEquals(
      error.completedPaths,
      phase === "working-update" ? [] : [`${coreTarget.designatorPath}.ttl`],
    );
    assertEquals(error.possiblyTouchedPaths, [error.path!]);

    const retry = await versionPayloads(request);
    assertEquals(retry.outcomes[0]?.status, "applied");
  });
}

Deno.test("versionPayloads support-update failure discloses partial paths and narrows retry to explicit repair", async () => {
  const meshRoot = await createTestTmpDir("weave-version-api-fail-support-");
  await materializePayloadMesh(meshRoot, [coreTarget]);
  const request = {
    meshRoot,
    items: [{
      designatorPath: coreTarget.designatorPath,
      bytes: payloadBytes(coreTarget, 2),
    }],
  };

  const error = await assertRejects(
    () =>
      versionPayloadsForTesting(request, {
        beforeWrite: (phase) => {
          if (phase === "support-update") {
            throw new Error("injected support update failure");
          }
        },
      }),
    WeaveApiError,
  );
  assertEquals([error.code, error.stage], ["io-failure", "write"]);
  assert(error.completedPaths?.includes(`${coreTarget.designatorPath}.ttl`));
  assert(error.completedPaths?.includes(snapshotPath(coreTarget, 2)));

  const retryError = await assertRejects(
    () => versionPayloads(request),
    WeaveApiError,
  );
  assertEquals([retryError.code, retryError.stage], ["plan-conflict", "plan"]);
});

Deno.test("versionPayloads write failure splits completed creates from updates", async () => {
  const meshRoot = await createTestTmpDir("weave-version-api-fail-split-");
  await materializePayloadMesh(meshRoot, [coreTarget, shaclTarget]);
  const failingPath = snapshotPath(shaclTarget, 3);

  const error = await assertRejects(
    () =>
      versionPayloadsForTesting(
        {
          meshRoot,
          items: [
            {
              designatorPath: coreTarget.designatorPath,
              bytes: payloadBytes(coreTarget, 2),
            },
            {
              designatorPath: shaclTarget.designatorPath,
              bytes: payloadBytes(shaclTarget, 3),
            },
          ],
        },
        {
          beforeWrite: (phase, path) => {
            if (phase === "text-create" && path === failingPath) {
              throw new Error("injected second payload snapshot failure");
            }
          },
        },
      ),
    WeaveApiError,
  );
  const repairError = error as WeaveApiError & {
    completedCreatedPaths?: readonly string[];
    completedUpdatedPaths?: readonly string[];
  };
  assertEquals(error.path, failingPath);
  assertEquals(error.completedPaths, [
    `${coreTarget.designatorPath}.ttl`,
    `${shaclTarget.designatorPath}.ttl`,
    snapshotPath(coreTarget, 2),
  ]);
  assertEquals(repairError.completedCreatedPaths, [
    snapshotPath(coreTarget, 2),
  ]);
  assertEquals(repairError.completedUpdatedPaths, [
    `${coreTarget.designatorPath}.ttl`,
    `${shaclTarget.designatorPath}.ttl`,
  ]);
});

Deno.test("versionPayloads writer reports the binary-create phase even though v1 payload admission rejects binary content", async () => {
  const meshRoot = await createTestTmpDir("weave-version-api-fail-binary-");
  await writeText(join(meshRoot, "working.txt"), "before");
  await writeText(join(meshRoot, "support.txt"), "before");
  const prepared = {
    meshState: {
      meshBase,
      currentMeshMetadataTurtle: "",
      currentMeshInventoryTurtle: "",
    },
    plan: {
      meshBase,
      versionedDesignatorPaths: [],
      createdFiles: [{ path: "created.txt", contents: "created" }],
      createdBinaryFiles: [{
        path: "created.bin",
        contents: new Uint8Array([1, 2, 3]),
      }],
      updatedFiles: [{ path: "support.txt", contents: "after" }],
    },
    candidates: [],
    payloadSnapshots: [],
  };

  const error = await assertRejects(
    () =>
      writeCombinedPlanForTesting(
        meshRoot,
        [{ path: "working.txt", contents: "after" }],
        prepared,
        {
          beforeWrite: (phase) => {
            if (phase === "binary-create") {
              throw new Error("injected binary create failure");
            }
          },
        },
      ),
    WeaveApiError,
  );
  assertEquals([error.code, error.stage], ["io-failure", "write"]);
  assertEquals(error.path, "created.bin");
  assertEquals(error.completedPaths, ["working.txt", "created.txt"]);
  assertEquals(await Deno.readTextFile(join(meshRoot, "working.txt")), "after");
  assertEquals(
    await Deno.readTextFile(join(meshRoot, "created.txt")),
    "created",
  );
});

async function snapshotWorkspace(
  root: string,
): Promise<Map<string, Uint8Array>> {
  const snapshot = new Map<string, Uint8Array>();
  for (const path of await listWorkspaceFiles(root)) {
    snapshot.set(path, await Deno.readFile(join(root, path)));
  }
  return snapshot;
}

async function runCliTwoStep(
  meshRoot: string,
  items: readonly { designatorPath: string; bytes: Uint8Array }[],
): Promise<void> {
  const inputRoot = join(meshRoot, ".version-api-inputs");
  await Deno.mkdir(inputRoot, { recursive: true });
  for (const [index, item] of items.entries()) {
    const sourcePath = join(inputRoot, `${index}.ttl`);
    await Deno.writeFile(sourcePath, item.bytes);
    const update = await runCli([
      "payload",
      "update",
      sourcePath,
      item.designatorPath,
      "--mesh-root",
      meshRoot,
    ], meshRoot);
    assert(update.success, new TextDecoder().decode(update.stderr));
  }
  const version = await runCli([
    "version",
    "--mesh-root",
    meshRoot,
    ...items.flatMap((item) => [
      "--target",
      `designatorPath=${item.designatorPath}`,
    ]),
  ], meshRoot);
  assert(version.success, new TextDecoder().decode(version.stderr));
}

function runCli(
  args: readonly string[],
  cwd: string,
): Promise<Deno.CommandOutput> {
  return new Deno.Command("deno", {
    args: [
      "run",
      "--allow-read",
      "--allow-write",
      "--allow-env",
      cliEntrypoint,
      ...args,
    ],
    cwd,
    stdout: "piped",
    stderr: "piped",
  }).output();
}

async function assertWorkspacePathsEqual(
  leftRoot: string,
  rightRoot: string,
  paths: readonly string[],
): Promise<void> {
  for (const path of paths) {
    assertEquals(
      await Deno.readFile(join(leftRoot, path)),
      await Deno.readFile(join(rightRoot, path)),
      path,
    );
  }
}

async function assertWorkspaceTreesEqual(
  leftRoot: string,
  rightRoot: string,
): Promise<void> {
  const isCliStagingPath = (path: string) =>
    path === ".version-api-inputs" ||
    path.startsWith(".version-api-inputs/");
  const leftPaths = (await listWorkspaceFiles(leftRoot)).filter((path) =>
    !isCliStagingPath(path)
  );
  const rightPaths = (await listWorkspaceFiles(rightRoot)).filter((path) =>
    !isCliStagingPath(path)
  );
  assertEquals(leftPaths, rightPaths, "workspace file paths");

  const allPaths = [...new Set([...leftPaths, ...rightPaths])].sort();
  await assertWorkspacePathsEqual(leftRoot, rightRoot, allPaths);
}
