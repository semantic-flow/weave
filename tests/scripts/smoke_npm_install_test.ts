import { assertEquals, assertStringIncludes, assertThrows } from "@std/assert";
import { join } from "@std/path";
import {
  currentNodeArch,
  currentNodePlatform,
  hostNpmPlatformPackage,
  localProjectCommandPath,
  parseSmokeNpmInstallArgs,
} from "../../scripts/smoke-npm-install.ts";

Deno.test("parseSmokeNpmInstallArgs supports root, input, work, and npm overrides", () => {
  assertEquals(
    parseSmokeNpmInstallArgs([
      "--",
      "--root",
      "/tmp/weave",
      "--input-dir=dist/npm",
      "--work-dir",
      "/tmp/smoke",
      "--npm-bin",
      "/usr/bin/npm",
    ]),
    {
      root: "/tmp/weave",
      inputDir: "dist/npm",
      workDir: "/tmp/smoke",
      npmBin: "/usr/bin/npm",
    },
  );

  assertStringIncludes(
    assertThrows(
      () => parseSmokeNpmInstallArgs(["--target", "linux-x64"]),
      Error,
    ).message,
    "Unsupported smoke:npm-install argument",
  );
});

Deno.test("hostNpmPlatformPackage maps Node os and cpu names to package metadata", () => {
  const metadata = {
    createdAt: "2026-05-14T00:00:00.000Z",
    version: "0.1.0",
    wrapperPackageName: "@semantic-flow/weave",
    wrapperPackageDir: "/tmp/node_modules/@semantic-flow/weave",
    wrapperPackageJsonPath:
      "/tmp/node_modules/@semantic-flow/weave/package.json",
    commandName: "weave",
    platformPackages: [
      {
        packageName: "@semantic-flow/weave-linux-x64",
        platform: "linux-x64",
        packageDir: "/tmp/node_modules/@semantic-flow/weave-linux-x64",
        packageJsonPath:
          "/tmp/node_modules/@semantic-flow/weave-linux-x64/package.json",
        os: "linux",
        cpu: "x64",
        executableName: "weave",
        executablePath:
          "/tmp/node_modules/@semantic-flow/weave-linux-x64/bin/weave",
        bundleMetadataPath:
          "/tmp/node_modules/@semantic-flow/weave-linux-x64/bundle-metadata.json",
      },
      {
        packageName: "@semantic-flow/weave-windows-x64",
        platform: "windows-x64",
        packageDir: "/tmp/node_modules/@semantic-flow/weave-windows-x64",
        packageJsonPath:
          "/tmp/node_modules/@semantic-flow/weave-windows-x64/package.json",
        os: "win32",
        cpu: "x64",
        executableName: "weave.exe",
        executablePath:
          "/tmp/node_modules/@semantic-flow/weave-windows-x64/bin/weave.exe",
        bundleMetadataPath:
          "/tmp/node_modules/@semantic-flow/weave-windows-x64/bundle-metadata.json",
      },
    ],
  };

  assertEquals(
    hostNpmPlatformPackage(metadata, "linux", "x64").packageName,
    "@semantic-flow/weave-linux-x64",
  );
  assertEquals(
    hostNpmPlatformPackage(metadata, "win32", "x64").packageName,
    "@semantic-flow/weave-windows-x64",
  );
  assertThrows(
    () => hostNpmPlatformPackage(metadata, "linux", "arm64"),
    Error,
    "No Weave npm platform package supports",
  );
});

Deno.test("currentNodePlatform and currentNodeArch use Node naming", () => {
  assertEquals(
    currentNodePlatform(),
    Deno.build.os === "windows" ? "win32" : Deno.build.os,
  );
  assertEquals(
    currentNodeArch(),
    Deno.build.arch === "x86_64"
      ? "x64"
      : Deno.build.arch === "aarch64"
      ? "arm64"
      : Deno.build.arch,
  );
});

Deno.test("localProjectCommandPath uses npm bin shim conventions", () => {
  assertEquals(
    localProjectCommandPath("/tmp/project", "weave", "windows"),
    join("/tmp/project", "node_modules", ".bin", "weave.cmd"),
  );
  assertEquals(
    localProjectCommandPath("/tmp/project", "weave", "linux"),
    join("/tmp/project", "node_modules", ".bin", "weave"),
  );
});
