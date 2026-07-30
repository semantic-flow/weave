// Builds the @semantic-flow/weave-lib npm package from the programmatic API
// surface (src/api/mod.ts) with dnt. This is a separate artifact from the CLI
// wrapper (@semantic-flow/weave) and platform binary packages; those flows are
// untouched. Run: deno task build:npm-lib
import { build, emptyDir } from "@deno/dnt";
import { fromFileUrl, join } from "@std/path";
import { readRootVersionFrom } from "./release/metadata.ts";

export const NPM_LIB_PACKAGE_NAME = "@semantic-flow/weave-lib";

const defaultRoot = fromFileUrl(new URL("..", import.meta.url));
const defaultOutDir = "dist/npm-lib";

if (import.meta.main) {
  try {
    await buildNpmLibPackage(parseArgs(Deno.args));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    Deno.exit(1);
  }
}

interface BuildNpmLibOptions {
  root: string;
  outDir: string;
}

function parseArgs(args: readonly string[]): BuildNpmLibOptions {
  let root = defaultRoot;
  let outDir = defaultOutDir;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--") {
      continue;
    }
    if (arg === "--root") {
      index += 1;
      root = requireArgumentValue(args[index], "--root");
    } else if (arg.startsWith("--root=")) {
      root = requireArgumentValue(arg.slice("--root=".length), "--root");
    } else if (arg === "--out-dir") {
      index += 1;
      outDir = requireArgumentValue(args[index], "--out-dir");
    } else if (arg.startsWith("--out-dir=")) {
      outDir = requireArgumentValue(
        arg.slice("--out-dir=".length),
        "--out-dir",
      );
    } else {
      throw new Error(`Unsupported build:npm-lib argument: ${arg}`);
    }
  }

  return { root, outDir };
}

export async function buildNpmLibPackage(
  options: BuildNpmLibOptions,
): Promise<string> {
  const version = await readRootVersionFrom(options.root);
  const outDir = join(options.root, options.outDir);
  await emptyDir(outDir);

  await build({
    entryPoints: [join(options.root, "src/api/mod.ts")],
    outDir,
    shims: {
      deno: true,
    },
    test: false,
    compilerOptions: {
      target: "ES2022",
      lib: ["ES2022"],
    },
    package: {
      name: NPM_LIB_PACKAGE_NAME,
      version,
      description:
        "Programmatic Semantic Flow Weave APIs for structured mesh validation and batch payload versioning.",
      license: "Apache-2.0",
      repository: {
        type: "git",
        url: "git+https://github.com/semantic-flow/weave.git",
      },
      bugs: {
        url: "https://github.com/semantic-flow/weave/issues",
      },
      keywords: ["semantic-flow", "rdf", "mesh", "versioning"],
      engines: {
        node: ">=20",
      },
      dependencies: {
        "@types/n3": "^1.16.4",
      },
    },
    async postBuild() {
      await Deno.copyFile(
        join(options.root, "LICENSE"),
        join(outDir, "LICENSE"),
      );
      await Deno.copyFile(
        join(options.root, "NOTICE"),
        join(outDir, "NOTICE"),
      );
      await Deno.writeTextFile(
        join(outDir, "README.md"),
        renderLibReadme(version),
      );
    },
  });

  console.log(`Built ${NPM_LIB_PACKAGE_NAME}@${version} in ${outDir}`);
  return outDir;
}

function renderLibReadme(version: string): string {
  return `# ${NPM_LIB_PACKAGE_NAME}

Programmatic library surface of [Semantic Flow Weave](https://github.com/semantic-flow/weave), v${version}.

This package exposes structured validation and payload versioning APIs for Node
and bundler consumers:

\`\`\`ts
import { validateMesh, versionPayloads } from "${NPM_LIB_PACKAGE_NAME}";

const validation = await validateMesh({
  meshRoot: "/path/to/mesh",
});
for (const finding of validation.findings) {
  console.error(finding.severity, finding.code, finding.message);
}

const result = await versionPayloads({
  meshRoot: "/path/to/mesh",
  items: [{
    designatorPath: "example-knop",
    bytes: new TextEncoder().encode("payload contents"),
  }],
});
\`\`\`

The Weave CLI is distributed separately as \`@semantic-flow/weave\` (native
binary wrapper). Both packages share one version line: they are built from the
same commit and released together, so \`@semantic-flow/weave@${version}\`
corresponds to this package. Neither depends on the other at runtime. Deno
consumers can use this package via \`npm:\` specifiers or import
\`./src/mod.ts\` from a pinned source checkout.

Repository-source floating inputs are refused by both APIs; the library never
spawns subprocesses or opens network connections.

\`validateMesh\` reports planner/preflight coverage, not comprehensive
integrity coverage of every existing mesh file. In particular,
\`coverage.plannedDesignatorPathCount\` counts pending candidates whose
recursive dry-run planning completed.

License: Apache-2.0 (see LICENSE and NOTICE).
`;
}

function requireArgumentValue(value: string | undefined, name: string): string {
  if (value === undefined || value.trim().length === 0) {
    throw new Error(`${name} requires a value`);
  }
  return value;
}
