// Deno-side runner for the unified packaging spike. Run from the repository:
// deno run --allow-read --allow-write scripts/spikes/unified-packaging/probe-deno.ts render <input> <output>
// deno run --allow-read scripts/spikes/unified-packaging/probe-deno.ts benchmark <count>
import { fromFileUrl, join } from "@std/path";
import { createUnifiedPackagingSpikeRenderer } from "../../../src/runtime/content/spike_unified_render.ts";

const root = fromFileUrl(new URL("../../../", import.meta.url));
const aliceBioPath = join(
  root,
  "dependencies/github.com/semantic-flow/mesh-alice-bio/alice-bio.md",
);

if (import.meta.main) {
  try {
    await main(Deno.args);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    Deno.exit(1);
  }
}

async function main(args: readonly string[]): Promise<void> {
  const command = args[0];
  if (command === "render") {
    await render(args[1] ?? aliceBioPath, args[2]);
  } else if (command === "benchmark") {
    await benchmark(parseCount(args[1]));
  } else {
    throw new Error("Expected: render [input] [output] | benchmark <count>");
  }
}

async function render(inputPath: string, outputPath?: string): Promise<void> {
  const markdown = await Deno.readTextFile(inputPath);
  const renderer = createUnifiedPackagingSpikeRenderer();
  const first = renderer.render(markdown);
  const second = renderer.render(markdown);
  const byteIdentical = first.html === second.html;

  assertRealDendronResult(first, byteIdentical);
  if (outputPath) {
    await Deno.writeTextFile(outputPath, first.html);
  }
  console.log(JSON.stringify({
    runtime: `Deno ${Deno.version.deno}`,
    inputPath,
    htmlBytes: new TextEncoder().encode(first.html).byteLength,
    frontmatterBlocks: first.frontmatter.length,
    sameProcessByteIdentical: byteIdentical,
    outputPath: outputPath ?? null,
  }));
}

async function benchmark(count: number): Promise<void> {
  const corpus = await loadCorpus();
  const renderer = createUnifiedPackagingSpikeRenderer();
  const started = performance.now();
  let htmlBytes = 0;
  let frontmatterBlocks = 0;

  for (let index = 0; index < count; index += 1) {
    const result = renderer.render(corpus[index % corpus.length]);
    htmlBytes += new TextEncoder().encode(result.html).byteLength;
    frontmatterBlocks += result.frontmatter.length;
  }

  console.log(JSON.stringify({
    runtime: `Deno ${Deno.version.deno}`,
    documents: count,
    distinctRealSources: corpus.length,
    renderWallMs: Number((performance.now() - started).toFixed(3)),
    htmlBytes,
    frontmatterBlocks,
  }));
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

function assertRealDendronResult(
  result: ReturnType<
    ReturnType<typeof createUnifiedPackagingSpikeRenderer>["render"]
  >,
  byteIdentical: boolean,
): void {
  if (!byteIdentical) {
    throw new Error("Two renders in one process were not byte-identical");
  }
  const frontmatter = result.frontmatter[0] ?? "";
  for (const field of ["id:", "title:", "desc:"]) {
    if (!frontmatter.includes(field)) {
      throw new Error(`Frontmatter was not recognized with field ${field}`);
    }
  }
  if (result.html.includes("id: kuv0cetbseva2cevtkfckoh")) {
    throw new Error("YAML frontmatter leaked into rendered HTML");
  }
  if (!result.html.includes("[[user.bob-newhart]]")) {
    throw new Error("Untouched wikilink text was not preserved");
  }
  if (!result.html.includes('<h2 id="weave-overview">Overview</h2>')) {
    throw new Error("Expected sanitized, slugged HTML was not produced");
  }
}

function parseCount(value: string | undefined): number {
  const count = Number(value);
  if (!Number.isSafeInteger(count) || count <= 0) {
    throw new Error("benchmark count must be a positive integer");
  }
  return count;
}

function compareCodePoints(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
