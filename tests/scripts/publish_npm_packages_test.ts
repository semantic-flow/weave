import { assertEquals } from "@std/assert";
import { join } from "@std/path";
import {
  npmPublishArgs,
  parsePublishNpmPackagesArgs,
  publicationOrder,
  resolvedPublicationOrder,
} from "../../scripts/publish-npm-packages.ts";
import type { NpmPackagesMetadata } from "../../scripts/release/npm.ts";

Deno.test("parsePublishNpmPackagesArgs supports input, npm, tag, dry-run, and provenance", () => {
  assertEquals(
    parsePublishNpmPackagesArgs([
      "--root",
      "/repo",
      "--input-dir",
      "/packages",
      "--npm-bin",
      "npm-cli",
      "--tag",
      "next",
      "--dry-run",
      "--provenance",
    ]),
    {
      root: "/repo",
      inputDir: "/packages",
      npmBin: "npm-cli",
      tag: "next",
      dryRun: true,
      provenance: true,
    },
  );
});

Deno.test("publicationOrder publishes platform packages before the wrapper", () => {
  const ordered = publicationOrder(
    npmPackagesMetadata({
      wrapperPackageDir: "/tmp/wrapper",
      platformPackages: [
        {
          packageName: "@semantic-flow/weave-windows-x64",
          platform: "windows-x64",
          packageDir: "/tmp/windows",
          packageJsonPath: "/tmp/windows/package.json",
          os: "win32",
          cpu: "x64",
          executableName: "weave.exe",
          executablePath: "/tmp/windows/bin/weave.exe",
          bundleMetadataPath: "/tmp/windows/bundle-metadata.json",
        },
        {
          packageName: "@semantic-flow/weave-linux-x64",
          platform: "linux-x64",
          packageDir: "/tmp/linux",
          packageJsonPath: "/tmp/linux/package.json",
          os: "linux",
          cpu: "x64",
          executableName: "weave",
          executablePath: "/tmp/linux/bin/weave",
          bundleMetadataPath: "/tmp/linux/bundle-metadata.json",
        },
      ],
    }),
  );

  assertEquals(
    ordered.map((entry) => entry.packageName),
    [
      "@semantic-flow/weave-linux-x64",
      "@semantic-flow/weave-windows-x64",
      "@semantic-flow/weave",
    ],
  );
});

Deno.test("resolvedPublicationOrder falls back to downloaded npm package paths", async () => {
  const root = join(
    Deno.cwd(),
    ".test-tmp",
    "publish-npm-packages",
    crypto.randomUUID(),
  );
  await Deno.mkdir(join(root, "@semantic-flow", "weave"), {
    recursive: true,
  });
  await Deno.mkdir(join(root, "@semantic-flow", "weave-macos-arm64"), {
    recursive: true,
  });

  const resolved = await resolvedPublicationOrder(
    npmPackagesMetadata({
      wrapperPackageDir: "/stale/source/@semantic-flow/weave",
      platformPackages: [
        {
          packageName: "@semantic-flow/weave-macos-arm64",
          platform: "macos-arm64",
          packageDir: "/stale/source/@semantic-flow/weave-macos-arm64",
          packageJsonPath:
            "/stale/source/@semantic-flow/weave-macos-arm64/package.json",
          os: "darwin",
          cpu: "arm64",
          executableName: "weave",
          executablePath:
            "/stale/source/@semantic-flow/weave-macos-arm64/bin/weave",
          bundleMetadataPath:
            "/stale/source/@semantic-flow/weave-macos-arm64/bundle-metadata.json",
        },
      ],
    }),
    root,
  );

  assertEquals(
    resolved.map((entry) => entry.packageDir),
    [
      join(root, "@semantic-flow", "weave-macos-arm64"),
      join(root, "@semantic-flow", "weave"),
    ],
  );
});

Deno.test("npmPublishArgs adds dry-run instead of provenance for rehearsals", () => {
  assertEquals(
    npmPublishArgs({ tag: "next", dryRun: true, provenance: true }),
    ["publish", "--tag", "next", "--dry-run"],
  );
  assertEquals(
    npmPublishArgs({ tag: "latest", dryRun: false, provenance: true }),
    ["publish", "--tag", "latest", "--provenance"],
  );
});

function npmPackagesMetadata(options: {
  wrapperPackageDir: string;
  platformPackages: NpmPackagesMetadata["platformPackages"];
}): NpmPackagesMetadata {
  return {
    createdAt: "2026-05-14T00:00:00.000Z",
    version: "0.1.0",
    wrapperPackageName: "@semantic-flow/weave",
    wrapperPackageDir: options.wrapperPackageDir,
    wrapperPackageJsonPath: join(options.wrapperPackageDir, "package.json"),
    commandName: "weave",
    platformPackages: options.platformPackages,
  };
}
