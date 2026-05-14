import {
  assert,
  assertEquals,
  assertRejects,
  assertStringIncludes,
  assertThrows,
} from "@std/assert";
import { join } from "@std/path";
import {
  assembleNpmPackages,
  parseAssembleNpmPackagesArgs,
} from "../../scripts/assemble-npm-packages.ts";
import {
  createBinaryBundleMetadata,
  RELEASE_PLATFORMS,
} from "../../scripts/release/metadata.ts";

Deno.test("parseAssembleNpmPackagesArgs supports root, directories, and platform selections", () => {
  assertEquals(
    parseAssembleNpmPackagesArgs([
      "--",
      "--root",
      "/tmp/weave",
      "--build-dir=build/binaries",
      "--out-dir",
      "/tmp/npm",
      "--platform",
      "linux-x64",
      "--platform=windows-x64",
    ]),
    {
      root: "/tmp/weave",
      buildDir: "build/binaries",
      outDir: "/tmp/npm",
      platformLabels: ["linux-x64", "windows-x64"],
    },
  );

  assertStringIncludes(
    assertThrows(
      () => parseAssembleNpmPackagesArgs(["--target", "linux-x64"]),
      Error,
    ).message,
    "Unsupported assemble:npm-packages argument",
  );
});

Deno.test("assembleNpmPackages creates wrapper and platform package directories", async () => {
  const root = await createPackageRoot();
  const buildDir = join(root, "dist", "binaries");
  const outDir = join(root, "node_modules");
  await writeFakeBundle(buildDir, "linux-x64");
  await writeFakeBundle(buildDir, "windows-x64");

  const result = await assembleNpmPackages({
    root,
    buildDir,
    outDir,
    platformLabels: ["linux-x64", "windows-x64"],
  });

  assertEquals(
    result.wrapperPackageDir,
    join(outDir, "@semantic-flow", "weave"),
  );
  assertEquals(result.platformPackageDirs, [
    join(outDir, "@semantic-flow", "weave-linux-x64"),
    join(outDir, "@semantic-flow", "weave-windows-x64"),
  ]);

  const wrapperPackageJson = await readJson(
    join(result.wrapperPackageDir, "package.json"),
  );
  assertEquals(wrapperPackageJson.name, "@semantic-flow/weave");
  assertEquals(wrapperPackageJson.version, "0.1.0");
  assertEquals(wrapperPackageJson.license, "Apache-2.0");
  assertEquals(wrapperPackageJson.bin, { weave: "bin/weave.js" });
  assertEquals(wrapperPackageJson.optionalDependencies, {
    "@semantic-flow/weave-linux-x64": "0.1.0",
    "@semantic-flow/weave-windows-x64": "0.1.0",
  });
  assertEquals(wrapperPackageJson.engines, { node: ">=18" });

  const wrapperBinPath = join(result.wrapperPackageDir, "bin", "weave.js");
  const wrapperBin = await Deno.readTextFile(wrapperBinPath);
  assert(wrapperBin.startsWith("#!/usr/bin/env node"));
  assertStringIncludes(wrapperBin, "@semantic-flow/weave-linux-x64");
  assertStringIncludes(wrapperBin, "@semantic-flow/weave-windows-x64");
  await assertExecutable(wrapperBinPath);
  assertEquals(
    await Deno.readTextFile(join(result.wrapperPackageDir, "LICENSE")),
    "Test license\n",
  );

  const linuxPackageDir = result.platformPackageDirs[0];
  const linuxPackageJson = await readJson(
    join(linuxPackageDir, "package.json"),
  );
  assertEquals(linuxPackageJson.name, "@semantic-flow/weave-linux-x64");
  assertEquals(linuxPackageJson.version, "0.1.0");
  assertEquals(linuxPackageJson.os, ["linux"]);
  assertEquals(linuxPackageJson.cpu, ["x64"]);
  assertEquals(linuxPackageJson.bin, undefined);
  assertEquals(linuxPackageJson.scripts, undefined);
  assertEquals(
    await Deno.readTextFile(join(linuxPackageDir, "bin", "weave")),
    "fake linux-x64 binary\n",
  );
  await assertExecutable(join(linuxPackageDir, "bin", "weave"));
  assertStringIncludes(
    await Deno.readTextFile(join(linuxPackageDir, "README.md")),
    "native Weave CLI binary for linux-x64",
  );
});

Deno.test("assembleNpmPackages rejects stale bundle metadata", async () => {
  const root = await createPackageRoot();
  const buildDir = join(root, "dist", "binaries");
  await writeFakeBundle(buildDir, "linux-x64");
  const metadataPath = join(buildDir, "linux-x64", "bundle-metadata.json");
  const metadata = JSON.parse(await Deno.readTextFile(metadataPath)) as {
    packageName: string;
  };
  metadata.packageName = "@semantic-flow/weave-not-linux";
  await Deno.writeTextFile(
    metadataPath,
    `${JSON.stringify(metadata, null, 2)}\n`,
  );

  await assertRejects(
    () =>
      assembleNpmPackages({
        root,
        buildDir,
        outDir: join(root, "node_modules"),
        platformLabels: ["linux-x64"],
      }),
    Error,
    "Bundle metadata field packageName does not match",
  );
});

async function createPackageRoot(): Promise<string> {
  const root = await Deno.makeTempDir({ prefix: "weave-assemble-npm-" });
  await Deno.writeTextFile(
    join(root, "deno.json"),
    `${JSON.stringify({ version: "0.1.0", tasks: {} }, null, 2)}\n`,
  );
  await Deno.writeTextFile(join(root, "LICENSE"), "Test license\n");
  return root;
}

async function writeFakeBundle(
  buildDir: string,
  platformLabel: "linux-x64" | "windows-x64",
): Promise<void> {
  const platform = RELEASE_PLATFORMS.find((entry) =>
    entry.label === platformLabel
  );
  if (platform === undefined) {
    throw new Error(`Unsupported test platform: ${platformLabel}`);
  }

  const platformBuildDir = join(buildDir, platform.label);
  await Deno.mkdir(platformBuildDir, { recursive: true });
  await Deno.writeTextFile(
    join(platformBuildDir, platform.executableName),
    `fake ${platform.label} binary\n`,
  );
  await Deno.writeTextFile(
    join(platformBuildDir, "bundle-metadata.json"),
    `${
      JSON.stringify(createBinaryBundleMetadata("0.1.0", platform), null, 2)
    }\n`,
  );
}

async function readJson(path: string): Promise<Record<string, unknown>> {
  return JSON.parse(await Deno.readTextFile(path)) as Record<string, unknown>;
}

async function assertExecutable(path: string): Promise<void> {
  const mode = (await Deno.stat(path)).mode;
  if (mode !== null) {
    assert((mode & 0o111) !== 0, `${path} should be executable`);
  }
}
