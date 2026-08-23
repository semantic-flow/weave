import { assertEquals, assertRejects } from "@std/assert";
import { join } from "@std/path";
import { executeKnopCreate } from "../runtime/knop/create.ts";
import { materializeMeshAliceBioBranch } from "../../tests/support/mesh_alice_bio_fixture.ts";
import { createTestTmpDir } from "../../tests/support/test_tmp.ts";
import { WeaveApiError } from "./version_payloads.ts";
import {
  versionFoundingReferentData,
  versionFoundingReferentDataForTesting,
} from "./version_founding_referent_data.ts";

const meshBase = "https://semantic-flow.github.io/mesh-alice-bio/";
const encode = (text: string) => new TextEncoder().encode(text);

Deno.test("versionFoundingReferentData settles and corrects exact bytes without pages", async () => {
  const meshRoot = await createTestTmpDir("founding-version-api-");
  await materializeMeshAliceBioBranch("03-mesh-created-woven", meshRoot);
  const firstBytes = encode(
    `\uFEFF<${meshBase}founding-demo> <https://stagecraft.example/vocab/incarnationOf> <https://original.example/items/42> .\r\n`,
  );
  await executeKnopCreate({
    workspaceRoot: meshRoot,
    request: {
      designatorPath: "founding-demo",
      foundingData: firstBytes,
    },
  });

  const initial = await versionFoundingReferentData({
    meshRoot,
    designatorPath: "founding-demo",
  });
  const state1Path = join(meshRoot, initial.snapshotPath);
  assertEquals(await Deno.readFile(state1Path), firstBytes);
  await assertRejects(
    () => Deno.stat(join(meshRoot, "founding-demo/_knop/_founding/index.html")),
    Deno.errors.NotFound,
  );

  const correctedBytes = encode(
    `<${meshBase}founding-demo> <https://stagecraft.example/vocab/incarnationOf> <https://original.example/items/43> .\n`,
  );
  const pending = versionFoundingReferentData({
    meshRoot,
    designatorPath: "founding-demo",
    bytes: correctedBytes,
  });
  correctedBytes.fill(0);
  const corrected = await pending;

  assertEquals(await Deno.readFile(state1Path), firstBytes);
  assertEquals(
    await Deno.readTextFile(join(meshRoot, corrected.snapshotPath)),
    `<${meshBase}founding-demo> <https://stagecraft.example/vocab/incarnationOf> <https://original.example/items/43> .\n`,
  );
  assertEquals(
    await Deno.readTextFile(
      join(meshRoot, "founding-demo/_knop/_founding/data.ttl"),
    ),
    `<${meshBase}founding-demo> <https://stagecraft.example/vocab/incarnationOf> <https://original.example/items/43> .\n`,
  );
});

Deno.test("versionFoundingReferentData rolls back working bytes and snapshot after an injected failure", async () => {
  const meshRoot = await createTestTmpDir("founding-version-rollback-");
  await materializeMeshAliceBioBranch("03-mesh-created-woven", meshRoot);
  const firstBytes = encode(
    `<${meshBase}founding-demo> <https://example.test/vocab/value> "one" .\n`,
  );
  await executeKnopCreate({
    workspaceRoot: meshRoot,
    request: { designatorPath: "founding-demo", foundingData: firstBytes },
  });
  await versionFoundingReferentData({
    meshRoot,
    designatorPath: "founding-demo",
  });
  const inventoryPath = join(
    meshRoot,
    "founding-demo/_knop/_inventory/inventory.ttl",
  );
  const inventoryBefore = await Deno.readFile(inventoryPath);

  const error = await assertRejects(
    () =>
      versionFoundingReferentDataForTesting(
        {
          meshRoot,
          designatorPath: "founding-demo",
          bytes: encode(
            `<${meshBase}founding-demo> <https://example.test/vocab/value> "two" .\n`,
          ),
        },
        {
          beforeWrite(write) {
            if (write.phase === "founding-inventory-update") {
              throw new Error("injected");
            }
          },
        },
      ),
    WeaveApiError,
  );
  assertEquals(error.code, "io-failure");
  assertEquals(
    await Deno.readFile(
      join(meshRoot, "founding-demo/_knop/_founding/data.ttl"),
    ),
    firstBytes,
  );
  assertEquals(await Deno.readFile(inventoryPath), inventoryBefore);
  await assertRejects(
    () =>
      Deno.stat(
        join(
          meshRoot,
          "founding-demo/_knop/_founding/_history001/_s0002/ttl/data.ttl",
        ),
      ),
    Deno.errors.NotFound,
  );
});

Deno.test("versionFoundingReferentData maps residual malformed inventory errors to the public error base", async () => {
  const meshRoot = await createTestTmpDir("founding-version-malformed-");
  await materializeMeshAliceBioBranch("03-mesh-created-woven", meshRoot);
  await executeKnopCreate({
    workspaceRoot: meshRoot,
    request: {
      designatorPath: "founding-demo",
      foundingData: encode(
        `<${meshBase}founding-demo> <https://example.test/vocab/value> "one" .\n`,
      ),
    },
  });
  const inventoryPath = join(
    meshRoot,
    "founding-demo/_knop/_inventory/inventory.ttl",
  );
  await Deno.writeTextFile(
    inventoryPath,
    `${await Deno.readTextFile(
      inventoryPath,
    )}\n<https://example.test/graph> {\n  <https://example.test/subject> <https://example.test/predicate> <https://example.test/object> .\n}\n`,
  );

  const error = await assertRejects(
    () =>
      versionFoundingReferentData({
        meshRoot,
        designatorPath: "founding-demo",
      }),
    WeaveApiError,
  );
  assertEquals([error.code, error.stage], ["malformed-mesh", "load"]);
});
