import {
  assert,
  assertEquals,
  assertRejects,
  assertStringIncludes,
} from "@std/assert";
import { join } from "@std/path";
import { executeKnopCreate } from "../../src/runtime/knop/create.ts";
import { materializeMeshAliceBioBranch } from "../support/mesh_alice_bio_fixture.ts";
import { createTestTmpDir } from "../support/test_tmp.ts";

const repoRoot = new URL("../../", import.meta.url);
const meshBase = "https://semantic-flow.github.io/mesh-alice-bio/";
const encode = (text: string) => new TextEncoder().encode(text);

Deno.test("weave version settles and corrects founding referent data through the ruled CLI", async () => {
  const meshRoot = await createTestTmpDir("founding-version-cli-");
  const logRoot = await createTestTmpDir("founding-version-cli-logs-");
  await materializeMeshAliceBioBranch("03-mesh-created-woven", meshRoot);
  const firstBytes = encode(
    `<${meshBase}founding-demo> <https://example.test/vocab/value> "one" .\r\n`,
  );
  await executeKnopCreate({
    workspaceRoot: meshRoot,
    request: { designatorPath: "founding-demo", foundingData: firstBytes },
  });

  const initial = await runVersion(
    meshRoot,
    logRoot,
    ["founding-demo", "--artifact-role", "founding-referent-data"],
  );
  assert(initial.success, new TextDecoder().decode(initial.stderr));
  assertStringIncludes(
    new TextDecoder().decode(initial.stdout),
    "Versioned founding referent data",
  );
  const state1 = join(
    meshRoot,
    "founding-demo/_knop/_founding/_history001/_s0001/ttl/data.ttl",
  );
  assertEquals(await Deno.readFile(state1), firstBytes);

  const sentinel = "FOUNDING_CORRECTION_SECRET";
  const correctedPath = join(meshRoot, ".accord/founding-v2.ttl");
  await Deno.mkdir(join(meshRoot, ".accord"), { recursive: true });
  const correctedBytes = encode(
    `<${meshBase}founding-demo> <https://example.test/vocab/value> "${sentinel}" .\n`,
  );
  await Deno.writeFile(correctedPath, correctedBytes);
  const corrected = await runVersion(meshRoot, logRoot, [
    "founding-demo",
    "--artifact-role",
    "founding-referent-data",
    "--source",
    correctedPath,
  ]);
  assert(corrected.success, new TextDecoder().decode(corrected.stderr));
  assertEquals(await Deno.readFile(state1), firstBytes);
  assertEquals(
    await Deno.readFile(
      join(
        meshRoot,
        "founding-demo/_knop/_founding/_history001/_s0002/ttl/data.ttl",
      ),
    ),
    correctedBytes,
  );
  for (const logName of ["operational.jsonl", "security-audit.jsonl"]) {
    assertEquals(
      (await Deno.readTextFile(join(logRoot, logName))).includes(sentinel),
      false,
    );
  }
  await assertRejects(
    () => Deno.stat(join(meshRoot, "founding-demo/_knop/_founding/index.html")),
    Deno.errors.NotFound,
  );
});

Deno.test("weave version rejects founding source-target collision deterministically", async () => {
  const meshRoot = await createTestTmpDir("founding-version-cli-collision-");
  const logRoot = await createTestTmpDir(
    "founding-version-cli-collision-logs-",
  );
  await materializeMeshAliceBioBranch("03-mesh-created-woven", meshRoot);
  const workingPath = join(
    meshRoot,
    "founding-demo/_knop/_founding/data.ttl",
  );
  await executeKnopCreate({
    workspaceRoot: meshRoot,
    request: {
      designatorPath: "founding-demo",
      foundingData: encode(
        `<${meshBase}founding-demo> <https://example.test/vocab/value> "one" .\n`,
      ),
    },
  });
  const output = await runVersion(meshRoot, logRoot, [
    "founding-demo",
    "--artifact-role",
    "founding-referent-data",
    "--source",
    workingPath,
  ]);
  assertEquals(output.success, false);
  assertStringIncludes(
    new TextDecoder().decode(output.stderr),
    "source must not be the conventional target",
  );
});

async function runVersion(
  meshRoot: string,
  logRoot: string,
  args: readonly string[],
) {
  return await new Deno.Command("deno", {
    args: [
      "run",
      "--allow-read",
      "--allow-write",
      "--allow-env",
      "src/main.ts",
      "version",
      ...args,
      "--mesh-root",
      meshRoot,
    ],
    cwd: new URL(".", repoRoot),
    env: { WEAVE_LOG_DIR: logRoot },
    stdout: "piped",
    stderr: "piped",
  }).output();
}
