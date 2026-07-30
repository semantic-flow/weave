import {
  assert,
  assertEquals,
  assertRejects,
  assertStringIncludes,
} from "@std/assert";
import { fromFileUrl, join } from "@std/path";
import { validateMesh, WeaveApiError } from "../../src/mod.ts";
import {
  coreTarget,
  materializePayloadMesh,
} from "../support/payload_mesh_fixture.ts";
import { createTestTmpDir } from "../support/test_tmp.ts";

const cliEntrypoint = fromFileUrl(
  new URL("../../src/main.ts", import.meta.url),
);

Deno.test("validateMesh returns the exact settled-mesh result shape and planner coverage", async () => {
  const meshRoot = await createTestTmpDir("validate-mesh-settled-");
  await materializePayloadMesh(meshRoot, [coreTarget]);

  assertEquals(await validateMesh({ meshRoot }), {
    meshBase: "https://example.test/version-api/",
    findings: [],
    coverage: {
      knownDesignatorPathCount: 1,
      plannedDesignatorPathCount: 0,
    },
  });
});

Deno.test("validateMesh and CLI share the missing-artifact finding message", async () => {
  const meshRoot = await createTestTmpDir("validate-mesh-missing-");
  await materializePayloadMesh(meshRoot, [coreTarget]);
  await Deno.remove(join(meshRoot, "rules/core.ttl"));

  const result = await validateMesh({ meshRoot });
  assertEquals(result.findings, [{
    severity: "error",
    code: "missing-artifact",
    message:
      "Workspace is missing the working payload file for rules/core: rules/core.ttl",
    path: "rules/core.ttl",
    designatorPath: "rules/core",
  }]);

  const cli = await runValidateCli(meshRoot);
  const stderr = new TextDecoder().decode(cli.stderr);
  assert(!cli.success, stderr);
  assertStringIncludes(stderr, result.findings[0]!.message);
});

Deno.test("validateMesh reports malformed inventory and the CLI now renders the same finding instead of crashing", async () => {
  const meshRoot = await createTestTmpDir("validate-mesh-inventory-");
  await materializePayloadMesh(meshRoot, [coreTarget]);
  await Deno.writeTextFile(
    join(meshRoot, "_mesh/_inventory/inventory.ttl"),
    "not valid Turtle [",
  );

  const result = await validateMesh({ meshRoot });
  assertEquals(result.findings[0]?.code, "malformed-inventory");
  assertEquals(result.meshBase, "https://example.test/version-api/");

  const cli = await runValidateCli(meshRoot);
  const stderr = new TextDecoder().decode(cli.stderr);
  assert(!cli.success, stderr);
  assertStringIncludes(stderr, result.findings[0]!.message);
});

Deno.test("validateMesh reports config parsing failures as malformed-config findings", async () => {
  const meshRoot = await createTestTmpDir("validate-mesh-config-");
  await materializePayloadMesh(meshRoot, [coreTarget]);
  await Deno.mkdir(join(meshRoot, "_mesh/_config"), { recursive: true });
  await Deno.writeTextFile(
    join(meshRoot, "_mesh/_config/config.ttl"),
    "not valid Turtle [",
  );

  const result = await validateMesh({ meshRoot });
  assertEquals(result.findings[0]?.code, "malformed-config");
  assertEquals(result.meshBase, "https://example.test/version-api/");

  const cli = await runValidateCli(meshRoot);
  const stderr = new TextDecoder().decode(cli.stderr);
  assert(!cli.success, stderr);
  assertStringIncludes(stderr, result.findings[0]!.message);
});

Deno.test("validateMesh refuses unknown targets as a load error", async () => {
  const meshRoot = await createTestTmpDir("validate-mesh-target-");
  await materializePayloadMesh(meshRoot, [coreTarget]);

  const error = await assertRejects(
    () =>
      validateMesh({
        meshRoot,
        targets: [{ designatorPath: "rules/missing" }],
      }),
    WeaveApiError,
  );
  assertEquals([error.code, error.stage], ["unknown-target", "load"]);
  assertEquals(error.target, {
    index: 0,
    designatorPath: "rules/missing",
  });
});

Deno.test("validateMesh refuses a floating repository source before resolution", async () => {
  const meshRoot = await createTestTmpDir("validate-mesh-floating-");
  await materializePayloadMesh(meshRoot, [coreTarget]);
  const inventoryPath = join(
    meshRoot,
    "rules/core/_knop/_inventory/inventory.ttl",
  );
  await Deno.writeTextFile(
    inventoryPath,
    (await Deno.readTextFile(inventoryPath)).replace(
      "  sflo:hasWorkingLocatedFile <rules/core.ttl> .",
      `  sflo:hasRepositorySourceFloatingLocator [
    a sflo:RepositorySourceFloatingLocator ;
    sflo:sourceRepositoryUrl "https://example.test/rules.git" ;
    sflo:sourceRepositoryPathFromRoot "rules/core.ttl"
  ] .`,
    ),
  );

  const error = await assertRejects(
    () => validateMesh({ meshRoot }),
    WeaveApiError,
  );
  assertEquals([error.code, error.stage], ["unsupported-source", "load"]);
});

Deno.test("validateMesh keeps malformed metadata as result data without meshBase", async () => {
  const meshRoot = await createTestTmpDir("validate-mesh-metadata-");
  await materializePayloadMesh(meshRoot, [coreTarget]);
  await Deno.writeTextFile(
    join(meshRoot, "_mesh/_meta/meta.ttl"),
    "not valid Turtle [",
  );

  assertEquals(await validateMesh({ meshRoot }), {
    findings: [{
      severity: "error",
      code: "malformed-mesh-metadata",
      message: "Could not resolve meshBase from _mesh/_meta/meta.ttl",
      path: "_mesh/_meta/meta.ttl",
    }],
    coverage: {
      knownDesignatorPathCount: 0,
      plannedDesignatorPathCount: 0,
    },
  });
});

Deno.test("validateMesh distinguishes unreadable roots from roots with no mesh surface", async () => {
  const parent = await createTestTmpDir("validate-mesh-root-");
  const absentRoot = join(parent, "absent");

  const readError = await assertRejects(
    () => validateMesh({ meshRoot: absentRoot }),
    WeaveApiError,
  );
  assertEquals([readError.code, readError.stage], ["read-failure", "load"]);

  const emptyRoot = join(parent, "empty");
  await Deno.mkdir(emptyRoot);
  const meshError = await assertRejects(
    () => validateMesh({ meshRoot: emptyRoot }),
    WeaveApiError,
  );
  assertEquals([meshError.code, meshError.stage], ["malformed-mesh", "load"]);
});

async function runValidateCli(meshRoot: string): Promise<Deno.CommandOutput> {
  return await new Deno.Command(Deno.execPath(), {
    args: [
      "run",
      "--allow-read",
      "--allow-write",
      "--allow-env",
      cliEntrypoint,
      "validate",
      "mesh",
      "--mesh-root",
      meshRoot,
    ],
    stdout: "piped",
    stderr: "piped",
  }).output();
}
