// Off-tree Node proof for the temporary unified packaging spike export. It
// follows smoke-npm-lib.ts: pack dnt output, install into a type=module temp
// consumer, and run .mjs scripts with actual Node.
import { fromFileUrl, join } from "@std/path";
import { createUnifiedPackagingSpikeRenderer } from "../../../src/runtime/content/spike_unified_render.ts";
import { NPM_LIB_PACKAGE_NAME } from "../../build-npm-lib.ts";

const root = fromFileUrl(new URL("../../../", import.meta.url));
const defaultLibDir = join(root, "dist/npm-lib");
const aliceBioPath = join(
  root,
  "dependencies/github.com/semantic-flow/mesh-alice-bio/alice-bio.md",
);

if (import.meta.main) {
  try {
    await smokeNode(Deno.args.includes("--keep"));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    Deno.exit(1);
  }
}

async function smokeNode(keep: boolean): Promise<void> {
  await requireFile(join(defaultLibDir, "package.json"));
  const consumerRoot = await Deno.makeTempDir({
    prefix: "weave-unified-packaging-spike-",
  });
  console.log(`Consumer workspace (off-tree): ${consumerRoot}`);

  try {
    const tarballPath = await packLibrary(consumerRoot);
    await installTarball(consumerRoot, tarballPath);
    const inputPath = join(consumerRoot, "alice-bio.md");
    await Deno.copyFile(aliceBioPath, inputPath);
    const consumerPath = await writeConsumer(consumerRoot);

    const firstOutputPath = join(consumerRoot, "alice-first.html");
    const secondOutputPath = join(consumerRoot, "alice-second.html");
    const first = await runCommand("node", [
      consumerPath,
      "render",
      inputPath,
      firstOutputPath,
    ], consumerRoot);
    const second = await runCommand("node", [
      consumerPath,
      "render",
      inputPath,
      secondOutputPath,
    ], consumerRoot);
    const firstBytes = await Deno.readFile(firstOutputPath);
    const secondBytes = await Deno.readFile(secondOutputPath);
    assertBytesEqual(firstBytes, secondBytes, "fresh Node processes");

    const markdown = await Deno.readTextFile(inputPath);
    const denoResult = createUnifiedPackagingSpikeRenderer().render(markdown);
    assertBytesEqual(
      new TextEncoder().encode(denoResult.html),
      firstBytes,
      "Deno source and installed Node package",
    );

    const corpusPath = join(consumerRoot, "corpus.json");
    const corpus = await loadCorpus();
    await Deno.writeTextFile(corpusPath, JSON.stringify(corpus));
    const measurements = [];
    for (const count of [100, 500, 1467]) {
      measurements.push(
        await measureNode(consumerPath, corpusPath, count, consumerRoot),
      );
    }

    console.log(JSON.stringify(
      {
        node: Deno.version.v8,
        firstProcess: JSON.parse(first),
        secondProcess: JSON.parse(second),
        freshProcessByteIdentical: true,
        denoNodeByteIdentical: true,
        measurements,
      },
      null,
      2,
    ));
  } finally {
    if (keep) {
      console.log(`Keeping consumer workspace: ${consumerRoot}`);
    } else {
      await Deno.remove(consumerRoot, { recursive: true });
    }
  }
}

async function writeConsumer(consumerRoot: string): Promise<string> {
  const consumerPath = join(consumerRoot, "consumer.mjs");
  await Deno.writeTextFile(
    consumerPath,
    `import { readFile, writeFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import { createUnifiedPackagingSpikeRenderer } from "${NPM_LIB_PACKAGE_NAME}/unified-packaging-spike";

const [command, firstArg, secondArg] = process.argv.slice(2);
if (command === "render") {
  const markdown = await readFile(firstArg, "utf8");
  const renderer = createUnifiedPackagingSpikeRenderer();
  const first = renderer.render(markdown);
  const second = renderer.render(markdown);
  if (first.html !== second.html) throw new Error("same-process render differed");
  if (!first.frontmatter[0]?.includes("title: Alice Ghostley")) throw new Error("frontmatter not recognized");
  if (first.html.includes("id: kuv0cetbseva2cevtkfckoh")) throw new Error("frontmatter rendered as content");
  if (!first.html.includes("[[user.bob-newhart]]")) throw new Error("wikilink text changed");
  await writeFile(secondArg, first.html);
  console.log(JSON.stringify({
    runtime: process.version,
    htmlBytes: Buffer.byteLength(first.html),
    frontmatterBlocks: first.frontmatter.length,
    sameProcessByteIdentical: true
  }));
} else if (command === "benchmark") {
  const corpus = JSON.parse(await readFile(firstArg, "utf8"));
  const count = Number(secondArg);
  const renderer = createUnifiedPackagingSpikeRenderer();
  const started = performance.now();
  let htmlBytes = 0;
  let frontmatterBlocks = 0;
  for (let index = 0; index < count; index += 1) {
    const result = renderer.render(corpus[index % corpus.length]);
    htmlBytes += Buffer.byteLength(result.html);
    frontmatterBlocks += result.frontmatter.length;
  }
  console.log(JSON.stringify({
    runtime: process.version,
    documents: count,
    distinctRealSources: corpus.length,
    renderWallMs: Number((performance.now() - started).toFixed(3)),
    htmlBytes,
    frontmatterBlocks
  }));
} else {
  throw new Error("expected render or benchmark");
}
`,
  );
  return consumerPath;
}

async function loadCorpus(): Promise<readonly string[]> {
  const paths = [aliceBioPath];
  const notesDir = join(root, "documentation/notes");
  for await (const entry of Deno.readDir(notesDir)) {
    if (entry.isFile && entry.name.endsWith(".md")) {
      paths.push(join(notesDir, entry.name));
    }
  }
  paths.sort(compareCodePoints);
  return await Promise.all(paths.map((path) => Deno.readTextFile(path)));
}

async function measureNode(
  consumerPath: string,
  corpusPath: string,
  count: number,
  consumerRoot: string,
): Promise<Record<string, unknown>> {
  const output = await new Deno.Command("/usr/bin/time", {
    args: [
      "-f",
      "WALL_SECONDS=%e\\nMAX_RSS_KB=%M",
      "node",
      consumerPath,
      "benchmark",
      corpusPath,
      String(count),
    ],
    cwd: consumerRoot,
    stdout: "piped",
    stderr: "piped",
  }).output();
  if (!output.success) {
    throw new Error(new TextDecoder().decode(output.stderr));
  }
  const benchmark = JSON.parse(
    new TextDecoder().decode(output.stdout).trim(),
  ) as Record<string, unknown>;
  const metrics = Object.fromEntries(
    new TextDecoder().decode(output.stderr).trim().split("\n").map((line) => {
      const [key, value] = line.split("=");
      return [key, Number(value)];
    }),
  );
  return { ...benchmark, ...metrics };
}

async function packLibrary(consumerRoot: string): Promise<string> {
  const output = await runCommand("npm", [
    "pack",
    "--json",
    "--pack-destination",
    consumerRoot,
  ], defaultLibDir);
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
          name: "weave-unified-packaging-spike-consumer",
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

async function requireFile(path: string): Promise<void> {
  try {
    await Deno.stat(path);
  } catch {
    throw new Error(`Missing ${path}; run deno task build:npm-lib first`);
  }
}

function assertBytesEqual(
  left: Uint8Array,
  right: Uint8Array,
  label: string,
): void {
  if (
    left.length !== right.length ||
    !left.every((byte, index) => byte === right[index])
  ) {
    throw new Error(`${label} were not byte-identical`);
  }
}

function compareCodePoints(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
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
