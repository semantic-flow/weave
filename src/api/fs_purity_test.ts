import { assert, assertEquals } from "@std/assert";
import { fromFileUrl } from "@std/path";

// The packaged library (npm via dnt) must stay runnable under Node without
// subprocess or network capability: dnt shims plain fs, but Deno.Command and
// the network APIs would rot Node compatibility silently. This guard walks the
// runtime (code) module graph of src/api/** and fails if any first-party
// module in that closure reaches for a subprocess or network API.
const FORBIDDEN_PATTERNS: readonly { name: string; pattern: RegExp }[] = [
  { name: "Deno.Command (subprocess)", pattern: /\bDeno\.Command\b/ },
  { name: "Deno.run (subprocess)", pattern: /\bDeno\.run\b/ },
  { name: "Deno.connect (network)", pattern: /\bDeno\.connect(Tls)?\b/ },
  { name: "Deno.startTls (network)", pattern: /\bDeno\.startTls\b/ },
  {
    name: "Deno.listen (network)",
    pattern: /\bDeno\.listen(Tls|Datagram)?\b/,
  },
  { name: "Deno.serve (network)", pattern: /\bDeno\.serve(Http)?\b/ },
  { name: "fetch (network)", pattern: /\bfetch\s*\(/ },
  { name: "WebSocket (network)", pattern: /\bnew\s+WebSocket\b/ },
  { name: "EventSource (network)", pattern: /\bnew\s+EventSource\b/ },
  { name: "XMLHttpRequest (network)", pattern: /\bnew\s+XMLHttpRequest\b/ },
];

const API_GRAPH_ROOT = new URL("./mod.ts", import.meta.url);

interface DenoInfoDependency {
  code?: { specifier?: string };
  isDynamic?: boolean;
}

interface DenoInfoModule {
  specifier: string;
  local?: string;
  dependencies?: readonly DenoInfoDependency[];
}

async function collectRuntimeModuleGraph(
  rootUrl: URL,
): Promise<readonly DenoInfoModule[]> {
  const output = await new Deno.Command(Deno.execPath(), {
    args: ["info", "--json", rootUrl.href],
    stdout: "piped",
    stderr: "piped",
  }).output();
  assert(
    output.success,
    `deno info failed: ${new TextDecoder().decode(output.stderr)}`,
  );

  const graph = JSON.parse(new TextDecoder().decode(output.stdout)) as {
    modules?: readonly DenoInfoModule[];
  };
  const modulesBySpecifier = new Map<string, DenoInfoModule>(
    (graph.modules ?? []).map((module) => [module.specifier, module]),
  );

  // Walk only static code (runtime) edges from the root. Type-only imports
  // never execute, and dynamic imports are the sanctioned seam for
  // CLI-only capability (repository_source.ts loads the git-backed resolver
  // lazily): the library path never awaits them, and each one is visible in
  // review as an explicit `await import(...)`.
  const reachable: DenoInfoModule[] = [];
  const visited = new Set<string>();
  const queue = [rootUrl.href];
  while (queue.length > 0) {
    const specifier = queue.pop()!;
    if (visited.has(specifier)) {
      continue;
    }
    visited.add(specifier);
    const module = modulesBySpecifier.get(specifier);
    if (!module) {
      continue;
    }
    reachable.push(module);
    for (const dependency of module.dependencies ?? []) {
      const codeSpecifier = dependency.code?.specifier;
      if (codeSpecifier && dependency.isDynamic !== true) {
        queue.push(codeSpecifier);
      }
    }
  }
  return reachable;
}

Deno.test("src/api runtime module graph is subprocess- and network-free", async () => {
  const modules = await collectRuntimeModuleGraph(API_GRAPH_ROOT);
  const firstPartyModules = modules.filter((module) =>
    module.specifier.startsWith("file://")
  );
  assert(
    firstPartyModules.length > 1,
    "API module graph walk found no first-party modules; the guard is broken",
  );

  const violations: string[] = [];
  for (const module of firstPartyModules) {
    const path = module.local ?? fromFileUrl(module.specifier);
    const source = await Deno.readTextFile(path);
    const lines = source.split("\n");
    for (const { name, pattern } of FORBIDDEN_PATTERNS) {
      lines.forEach((line, index) => {
        if (pattern.test(line)) {
          violations.push(`${path}:${index + 1} uses ${name}: ${line.trim()}`);
        }
      });
    }
  }

  assertEquals(
    violations,
    [],
    `The src/api runtime import graph must stay free of subprocess and network APIs so the dnt-built npm library works under Node:\n${
      violations.join("\n")
    }`,
  );
});
