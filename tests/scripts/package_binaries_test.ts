import {
  assert,
  assertEquals,
  assertRejects,
  assertStringIncludes,
  assertThrows,
} from "@std/assert";
import { join } from "@std/path";
import {
  renderChecksumFile,
  sha256Hex,
} from "../../scripts/release/archive.ts";
import {
  createBinaryBundleMetadata,
  RELEASE_PLATFORMS,
} from "../../scripts/release/metadata.ts";
import {
  packageBinaries,
  parsePackageBinariesArgs,
} from "../../scripts/package-binaries.ts";

const textEncoder = new TextEncoder();

Deno.test("sha256Hex and renderChecksumFile produce release checksum contents", async () => {
  const checksum = await sha256Hex(textEncoder.encode("hello"));

  assertEquals(
    checksum,
    "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
  );
  assertEquals(
    renderChecksumFile(checksum, "weave-v0.1.0-linux-x64.tar.gz"),
    "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824  weave-v0.1.0-linux-x64.tar.gz\n",
  );
});

Deno.test("parsePackageBinariesArgs supports root, directories, and platform selections", () => {
  assertEquals(
    parsePackageBinariesArgs([
      "--",
      "--root",
      "/tmp/weave",
      "--build-dir",
      "build/binaries",
      "--out-dir=/tmp/release",
      "--platform",
      "linux-x64",
      "--platform=windows-x64",
    ]),
    {
      root: "/tmp/weave",
      buildDir: "build/binaries",
      outDir: "/tmp/release",
      platformLabels: ["linux-x64", "windows-x64"],
    },
  );

  assertStringIncludes(
    assertThrows(
      () => parsePackageBinariesArgs(["--target", "linux-x64"]),
      Error,
    ).message,
    "Unsupported package:binaries argument",
  );
});

Deno.test("packageBinaries creates archives and checksum files from bundle outputs", async () => {
  const root = await createPackageRoot();
  const buildDir = join(root, "dist", "binaries");
  const outDir = join(root, "dist", "release");
  await writeFakeBundle(buildDir, "linux-x64");
  await writeFakeBundle(buildDir, "windows-x64");

  const results = await packageBinaries({
    root,
    buildDir,
    outDir,
    platformLabels: ["linux-x64", "windows-x64"],
  });

  assertEquals(results.map((result) => result.platform), [
    "linux-x64",
    "windows-x64",
  ]);

  const linuxArchive = await Deno.readFile(
    join(outDir, "weave-v0.1.0-linux-x64.tar.gz"),
  );
  const linuxChecksum = await Deno.readTextFile(
    join(outDir, "weave-v0.1.0-linux-x64.tar.gz.sha256"),
  );
  assertEquals(
    linuxChecksum,
    renderChecksumFile(
      await sha256Hex(linuxArchive),
      "weave-v0.1.0-linux-x64.tar.gz",
    ),
  );
  assertEquals(await listTarGzEntries(linuxArchive), [
    "weave-v0.1.0-linux-x64/weave",
    "weave-v0.1.0-linux-x64/bundle-metadata.json",
    "weave-v0.1.0-linux-x64/README.md",
    "weave-v0.1.0-linux-x64/LICENSE",
  ]);

  const windowsArchive = await Deno.readFile(
    join(outDir, "weave-v0.1.0-windows-x64.zip"),
  );
  const windowsChecksum = await Deno.readTextFile(
    join(outDir, "weave-v0.1.0-windows-x64.zip.sha256"),
  );
  assertEquals(
    windowsChecksum,
    renderChecksumFile(
      await sha256Hex(windowsArchive),
      "weave-v0.1.0-windows-x64.zip",
    ),
  );
  for (
    const name of [
      "weave-v0.1.0-windows-x64/weave.exe",
      "weave-v0.1.0-windows-x64/bundle-metadata.json",
      "weave-v0.1.0-windows-x64/README.md",
      "weave-v0.1.0-windows-x64/LICENSE",
    ]
  ) {
    assert(
      includesBytes(windowsArchive, textEncoder.encode(name)),
      `zip archive should contain ${name}`,
    );
  }
});

Deno.test("packageBinaries rejects stale bundle metadata", async () => {
  const root = await createPackageRoot();
  const buildDir = join(root, "dist", "binaries");
  await writeFakeBundle(buildDir, "linux-x64");
  const metadataPath = join(buildDir, "linux-x64", "bundle-metadata.json");
  const metadata = JSON.parse(await Deno.readTextFile(metadataPath)) as {
    version: string;
  };
  metadata.version = "0.0.0";
  await Deno.writeTextFile(
    metadataPath,
    `${JSON.stringify(metadata, null, 2)}\n`,
  );

  await assertRejects(
    () =>
      packageBinaries({
        root,
        buildDir,
        outDir: join(root, "dist", "release"),
        platformLabels: ["linux-x64"],
      }),
    Error,
    "Bundle metadata field version does not match",
  );
});

async function createPackageRoot(): Promise<string> {
  const root = await Deno.makeTempDir({ prefix: "weave-package-binaries-" });
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
  await Deno.writeFile(
    join(platformBuildDir, platform.executableName),
    textEncoder.encode(`fake ${platform.label} binary\n`),
  );
  await Deno.writeTextFile(
    join(platformBuildDir, "bundle-metadata.json"),
    `${
      JSON.stringify(createBinaryBundleMetadata("0.1.0", platform), null, 2)
    }\n`,
  );
}

async function listTarGzEntries(archive: Uint8Array): Promise<string[]> {
  const stream = new Blob([toArrayBuffer(archive)]).stream().pipeThrough(
    new DecompressionStream("gzip"),
  );
  const tar = new Uint8Array(await new Response(stream).arrayBuffer());
  const entries: string[] = [];
  let offset = 0;

  while (offset + 512 <= tar.length) {
    const header = tar.slice(offset, offset + 512);
    if (header.every((byte) => byte === 0)) {
      break;
    }

    const name = decodeNullTerminated(header.slice(0, 100));
    const size = Number.parseInt(
      decodeNullTerminated(header.slice(124, 136)).trim(),
      8,
    );
    entries.push(name);
    offset += 512 + Math.ceil(size / 512) * 512;
  }

  return entries;
}

function decodeNullTerminated(bytes: Uint8Array): string {
  const end = bytes.indexOf(0);
  return new TextDecoder().decode(end === -1 ? bytes : bytes.slice(0, end));
}

function includesBytes(haystack: Uint8Array, needle: Uint8Array): boolean {
  for (let offset = 0; offset <= haystack.length - needle.length; offset += 1) {
    let matches = true;
    for (let index = 0; index < needle.length; index += 1) {
      if (haystack[offset + index] !== needle[index]) {
        matches = false;
        break;
      }
    }
    if (matches) {
      return true;
    }
  }
  return false;
}

function toArrayBuffer(data: Uint8Array): ArrayBuffer {
  const copy = new ArrayBuffer(data.byteLength);
  new Uint8Array(copy).set(data);
  return copy;
}
