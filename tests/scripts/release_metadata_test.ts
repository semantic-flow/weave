import {
  assert,
  assertEquals,
  assertStringIncludes,
  assertThrows,
} from "@std/assert";
import {
  createArchiveName,
  createBinaryBundleMetadata,
  NPM_WRAPPER_PACKAGE_NAME,
  readRootVersion,
  RELEASE_PLATFORMS,
  selectReleasePlatforms,
} from "../../scripts/release/metadata.ts";
import {
  createDenoCompileArgs,
  parseBuildBinariesArgs,
} from "../../scripts/build-binaries.ts";

Deno.test("release metadata declares the v0.1.0 supported platform matrix", () => {
  assertEquals(RELEASE_PLATFORMS.map((platform) => platform.label), [
    "linux-x64",
    "windows-x64",
    "macos-x64",
    "macos-arm64",
  ]);
  assert(/^\d+\.\d+\.\d+(?:[-+].*)?$/.test(readRootVersion()));
  assertEquals(NPM_WRAPPER_PACKAGE_NAME, "@semantic-flow/weave");
});

Deno.test("release metadata derives archive and checksum names from the root version", () => {
  const archiveNames = RELEASE_PLATFORMS.map((platform) =>
    createArchiveName("0.1.0", platform)
  );

  assertEquals(archiveNames, [
    "weave-v0.1.0-linux-x64.tar.gz",
    "weave-v0.1.0-windows-x64.zip",
    "weave-v0.1.0-macos-x64.tar.gz",
    "weave-v0.1.0-macos-arm64.tar.gz",
  ]);

  const windows = RELEASE_PLATFORMS[1];
  assertEquals(createBinaryBundleMetadata("0.1.0", windows), {
    packageName: "@semantic-flow/weave-windows-x64",
    wrapperPackageName: "@semantic-flow/weave",
    version: "0.1.0",
    platform: "windows-x64",
    os: "win32",
    cpu: "x64",
    denoTarget: "x86_64-pc-windows-msvc",
    executableName: "weave.exe",
    bundleDirectoryName: "weave-v0.1.0-windows-x64",
    archiveName: "weave-v0.1.0-windows-x64.zip",
    checksumName: "weave-v0.1.0-windows-x64.zip.sha256",
  });
});

Deno.test("selectReleasePlatforms defaults to all platforms and validates explicit selections", () => {
  assertEquals(
    selectReleasePlatforms([]).map((platform) => platform.label),
    ["linux-x64", "windows-x64", "macos-x64", "macos-arm64"],
  );
  assertEquals(
    selectReleasePlatforms(["linux-x64", "macos-arm64"]).map((platform) =>
      platform.label
    ),
    ["linux-x64", "macos-arm64"],
  );

  assertThrows(
    () => selectReleasePlatforms(["linux-x64", "linux-x64"]),
    Error,
    "selected more than once",
  );
  assertThrows(
    () => selectReleasePlatforms(["freebsd-x64"]),
    Error,
    "Unsupported release platform",
  );
});

Deno.test("createBinaryBundleMetadata rejects unsupported versions", () => {
  assertThrows(
    () => createBinaryBundleMetadata("latest", RELEASE_PLATFORMS[0]),
    Error,
    "Unsupported release version",
  );
});

Deno.test("parseBuildBinariesArgs supports output and repeated platform flags", () => {
  assertEquals(
    parseBuildBinariesArgs([
      "--",
      "--out-dir",
      "/tmp/weave-binaries",
      "--platform",
      "linux-x64",
      "--platform=macos-arm64",
    ]),
    {
      outDir: "/tmp/weave-binaries",
      platformLabels: ["linux-x64", "macos-arm64"],
    },
  );

  assertStringIncludes(
    assertThrows(
      () => parseBuildBinariesArgs(["--target", "linux-x64"]),
      Error,
    ).message,
    "Unsupported build:binaries argument",
  );
});

Deno.test("createDenoCompileArgs embeds runtime defaults in binaries", () => {
  assertEquals(
    createDenoCompileArgs({
      entrypoint: "/repo/src/main.ts",
      executablePath: "/repo/dist/binaries/linux-x64/weave",
      platform: RELEASE_PLATFORMS[0],
    }),
    [
      "compile",
      "--allow-read",
      "--allow-write",
      "--allow-env",
      "--allow-run=git,deno",
      "--include",
      "defaults",
      "--target",
      "x86_64-unknown-linux-gnu",
      "--output",
      "/repo/dist/binaries/linux-x64/weave",
      "/repo/src/main.ts",
    ],
  );
});
