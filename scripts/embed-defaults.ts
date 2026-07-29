// Regenerates src/runtime/config/generated/weave_defaults.ts from the
// defaults/ Turtle documents the runtime loads. Embedding the content as a
// module removes the package-relative import.meta.url read that breaks once
// the module graph loads off the local filesystem (npm library via dnt), and
// keeps data files out of the package build. Run: deno task embed:defaults
// then `deno task fmt`. weave_defaults_test.ts guards against content drift.
import { fromFileUrl } from "@std/path";

const REPO_ROOT = fromFileUrl(new URL("../", import.meta.url));
const GENERATED_PATH =
  `${REPO_ROOT}src/runtime/config/generated/weave_defaults.ts`;

export const EMBEDDED_DEFAULTS_FILES = [
  {
    fileName: "application.ttl",
    constantName: "WEAVE_DEFAULT_APPLICATION_TURTLE",
  },
  {
    fileName: "config-resolution.ttl",
    constantName: "WEAVE_DEFAULT_CONFIG_RESOLUTION_TURTLE",
  },
] as const;

export async function renderEmbeddedDefaultsModule(): Promise<string> {
  const sections: string[] = [
    "// GENERATED FILE - do not edit. Regenerate with: deno task embed:defaults",
    "// Byte-identical embeddings of the defaults/ documents the runtime loads;",
    "// src/runtime/config/generated/weave_defaults_test.ts guards against drift.",
    "",
  ];
  for (const { fileName, constantName } of EMBEDDED_DEFAULTS_FILES) {
    const content = await Deno.readTextFile(
      `${REPO_ROOT}defaults/${fileName}`,
    );
    sections.push(
      `export const ${constantName}: string = ${JSON.stringify(content)};`,
      "",
    );
  }
  return sections.join("\n");
}

if (import.meta.main) {
  const rendered = await renderEmbeddedDefaultsModule();
  await Deno.mkdir(`${REPO_ROOT}src/runtime/config/generated`, {
    recursive: true,
  });
  await Deno.writeTextFile(GENERATED_PATH, rendered);
  console.log(`wrote ${GENERATED_PATH}; now run: deno task fmt`);
}
