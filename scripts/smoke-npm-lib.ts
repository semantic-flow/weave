// Off-tree downstream contract smoke for @semantic-flow/weave-lib: packs the
// dnt build output, installs the tarball into a temp consumer package outside
// the source tree, runs a real versionPayloads batch under Node, and asserts
// the resulting mesh tree and outcomes are byte-equivalent to the same batch
// run through the source import (src/api/mod.ts). This is the honest Node CI
// leg the library must pass before publishing; it also fails if any
// package-relative resource load resolves only under a file: checkout.
// Run: deno task build:npm-lib && deno task smoke:npm-lib
import { fromFileUrl, join } from "@std/path";
import { versionPayloads } from "../src/api/mod.ts";
import {
  coreTarget,
  listWorkspaceFiles,
  materializePayloadMesh,
  payloadBytes,
  type PayloadTargetFixture,
  shaclTarget,
} from "../tests/support/payload_mesh_fixture.ts";
import { NPM_LIB_PACKAGE_NAME } from "./build-npm-lib.ts";

const defaultRoot = fromFileUrl(new URL("..", import.meta.url));
const defaultLibDir = "dist/npm-lib";

interface SmokeNpmLibOptions {
  root: string;
  libDir: string;
  keep: boolean;
}

if (import.meta.main) {
  try {
    await smokeNpmLib(parseArgs(Deno.args));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    Deno.exit(1);
  }
}

function parseArgs(args: readonly string[]): SmokeNpmLibOptions {
  let root = defaultRoot;
  let libDir = defaultLibDir;
  let keep = false;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--root") {
      index += 1;
      root = requireArgumentValue(args[index], "--root");
    } else if (arg.startsWith("--root=")) {
      root = requireArgumentValue(arg.slice("--root=".length), "--root");
    } else if (arg === "--lib-dir") {
      index += 1;
      libDir = requireArgumentValue(args[index], "--lib-dir");
    } else if (arg.startsWith("--lib-dir=")) {
      libDir = requireArgumentValue(
        arg.slice("--lib-dir=".length),
        "--lib-dir",
      );
    } else if (arg === "--keep") {
      keep = true;
    } else {
      throw new Error(`Unsupported smoke:npm-lib argument: ${arg}`);
    }
  }

  return { root, libDir, keep };
}

async function smokeNpmLib(options: SmokeNpmLibOptions): Promise<void> {
  const libDir = join(options.root, options.libDir);
  try {
    await Deno.stat(join(libDir, "package.json"));
  } catch {
    throw new Error(
      `No built library package at ${libDir}; run: deno task build:npm-lib`,
    );
  }

  const consumerRoot = await Deno.makeTempDir({
    prefix: "weave-npm-lib-smoke-",
  });
  console.log(`Consumer workspace (off-tree): ${consumerRoot}`);
  try {
    const tarballPath = await packLibrary(libDir, consumerRoot);
    await installTarball(consumerRoot, tarballPath);

    const nodeMeshRoot = join(consumerRoot, "mesh-node");
    const sourceMeshRoot = join(consumerRoot, "mesh-source");
    const targets = [coreTarget, shaclTarget];
    await materializePayloadMesh(nodeMeshRoot, targets);
    await materializePayloadMesh(sourceMeshRoot, targets);

    const items = [
      { target: coreTarget, ordinal: 2 },
      { target: shaclTarget, ordinal: 3 },
    ];

    const nodeForecast = await runNodeConsumer(
      consumerRoot,
      nodeMeshRoot,
      items,
      { dryRun: true },
    );
    const sourceForecast = await versionPayloads({
      meshRoot: sourceMeshRoot,
      dryRun: true,
      items: items.map(({ target, ordinal }) => ({
        designatorPath: target.designatorPath,
        bytes: payloadBytes(target, ordinal),
      })),
    });
    assertJsonEqual(
      nodeForecast,
      JSON.parse(JSON.stringify(sourceForecast)),
      "dry-run forecast (Node npm package vs Deno source import)",
    );
    if (sourceForecast.executed !== false) {
      throw new Error("dry-run forecast must report executed: false");
    }
    await assertTreesByteIdentical(nodeMeshRoot, sourceMeshRoot);

    const nodeResult = await runNodeConsumer(consumerRoot, nodeMeshRoot, items);
    const sourceResult = await versionPayloads({
      meshRoot: sourceMeshRoot,
      items: items.map(({ target, ordinal }) => ({
        designatorPath: target.designatorPath,
        bytes: payloadBytes(target, ordinal),
      })),
    });
    assertJsonEqual(
      sourceForecast.createdPaths,
      sourceResult.createdPaths,
      "forecast vs actual createdPaths",
    );
    assertJsonEqual(
      sourceForecast.updatedPaths,
      sourceResult.updatedPaths,
      "forecast vs actual updatedPaths",
    );

    assertJsonEqual(
      nodeResult,
      JSON.parse(JSON.stringify(sourceResult)),
      "versionPayloads result (Node npm package vs Deno source import)",
    );
    for (const outcome of sourceResult.outcomes) {
      if (outcome.status !== "applied") {
        throw new Error(
          `Expected an applied outcome for ${outcome.designatorPath}, got ${outcome.status}`,
        );
      }
    }
    await assertTreesByteIdentical(nodeMeshRoot, sourceMeshRoot);
    console.log(
      `npm-lib smoke passed: ${sourceResult.outcomes.length} payloads versioned identically under Node and Deno`,
    );
  } finally {
    if (options.keep) {
      console.log(`Keeping consumer workspace: ${consumerRoot}`);
    } else {
      await Deno.remove(consumerRoot, { recursive: true });
    }
  }
}

async function packLibrary(
  libDir: string,
  consumerRoot: string,
): Promise<string> {
  const output = await runCommand("npm", [
    "pack",
    "--json",
    "--pack-destination",
    consumerRoot,
  ], libDir);
  const packed = JSON.parse(output) as readonly { filename?: string }[];
  const filename = packed[0]?.filename;
  if (!filename) {
    throw new Error(`npm pack reported no tarball: ${output}`);
  }
  return join(consumerRoot, filename);
}

async function installTarball(
  consumerRoot: string,
  tarballPath: string,
): Promise<void> {
  await Deno.writeTextFile(
    join(consumerRoot, "package.json"),
    `${
      JSON.stringify(
        {
          name: "weave-lib-smoke-consumer",
          private: true,
          type: "module",
        },
        null,
        2,
      )
    }\n`,
  );
  await runCommand("npm", [
    "install",
    "--no-audit",
    "--no-fund",
    tarballPath,
  ], consumerRoot);
}

async function runNodeConsumer(
  consumerRoot: string,
  meshRoot: string,
  items: readonly { target: PayloadTargetFixture; ordinal: number }[],
  options: { dryRun?: boolean } = {},
): Promise<unknown> {
  const consumerScriptPath = join(consumerRoot, "consumer.mjs");
  await Deno.writeTextFile(
    consumerScriptPath,
    `import { readFile, writeFile } from "node:fs/promises";
import { versionPayloads } from "${NPM_LIB_PACKAGE_NAME}";

const [meshRoot, requestPath, resultPath] = process.argv.slice(2);
const request = JSON.parse(await readFile(requestPath, "utf8"));
const result = await versionPayloads({
  meshRoot,
  ...(request.dryRun ? { dryRun: true } : {}),
  items: request.items.map((item) => ({
    designatorPath: item.designatorPath,
    bytes: Buffer.from(item.bytesBase64, "base64"),
  })),
});
await writeFile(resultPath, JSON.stringify(result));
`,
  );

  const label = options.dryRun ? "dry-run" : "write";
  const requestPath = join(consumerRoot, `request-${label}.json`);
  const resultPath = join(consumerRoot, `result-node-${label}.json`);
  await Deno.writeTextFile(
    requestPath,
    JSON.stringify({
      ...(options.dryRun ? { dryRun: true } : {}),
      items: items.map(({ target, ordinal }) => ({
        designatorPath: target.designatorPath,
        bytesBase64: encodeBase64(payloadBytes(target, ordinal)),
      })),
    }),
  );

  await runCommand("node", [
    consumerScriptPath,
    meshRoot,
    requestPath,
    resultPath,
  ], consumerRoot);
  return JSON.parse(await Deno.readTextFile(resultPath));
}

async function assertTreesByteIdentical(
  leftRoot: string,
  rightRoot: string,
): Promise<void> {
  const leftPaths = await listWorkspaceFiles(leftRoot);
  const rightPaths = await listWorkspaceFiles(rightRoot);
  assertJsonEqual(leftPaths, rightPaths, "mesh workspace file lists");

  for (const path of leftPaths) {
    const left = await Deno.readFile(join(leftRoot, path));
    const right = await Deno.readFile(join(rightRoot, path));
    if (
      left.length !== right.length ||
      !left.every((byte, index) => byte === right[index])
    ) {
      throw new Error(
        `Mesh trees differ at ${path}: the npm package and the source import must version payloads byte-identically`,
      );
    }
  }
}

function assertJsonEqual(
  actual: unknown,
  expected: unknown,
  label: string,
): void {
  const actualJson = JSON.stringify(actual, null, 2);
  const expectedJson = JSON.stringify(expected, null, 2);
  if (actualJson !== expectedJson) {
    throw new Error(
      `${label} differ.\nNode:\n${actualJson}\nSource:\n${expectedJson}`,
    );
  }
}

function encodeBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function requireArgumentValue(value: string | undefined, name: string): string {
  if (value === undefined || value.trim().length === 0) {
    throw new Error(`${name} requires a value`);
  }
  return value;
}

async function runCommand(
  binary: string,
  args: readonly string[],
  cwd: string,
): Promise<string> {
  const output = await new Deno.Command(binary, {
    args: [...args],
    cwd,
    stdout: "piped",
    stderr: "piped",
  }).output();
  if (!output.success) {
    throw new Error(
      `${binary} ${args.join(" ")} failed in ${cwd}:\n${
        new TextDecoder().decode(output.stderr)
      }`,
    );
  }
  return new TextDecoder().decode(output.stdout).trim();
}
