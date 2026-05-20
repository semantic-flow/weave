import { assert, assertFalse } from "@std/assert";
import { fromFileUrl, join } from "@std/path";
import { Parser, type Quad, type Term } from "n3";

const REPO_ROOT = fromFileUrl(new URL("../../", import.meta.url));
const SFLO_NAMESPACE = "https://semantic-flow.github.io/sflo/ontology/";
const SFCFG_NAMESPACE = "https://semantic-flow.github.io/sflo/config/";

const DEFAULT_RDF_FILES = [
  "defaults/application.ttl",
  "defaults/config-resolution.ttl",
] as const;

Deno.test("Weave defaults RDF parses as Turtle", async () => {
  for (const relativePath of DEFAULT_RDF_FILES) {
    const quads = await parseRepoTurtle(relativePath);
    assert(quads.length > 0, `${relativePath} should contain RDF triples`);
  }
});

Deno.test("Weave defaults RDF avoids duplicate triples", async () => {
  for (const relativePath of DEFAULT_RDF_FILES) {
    const quads = await parseRepoTurtle(relativePath);
    const seen = new Set<string>();

    for (const quad of quads) {
      const key = quadTerms(quad).map(termKey).join(" ");
      assertFalse(
        seen.has(key),
        `${relativePath} repeats RDF triple ${key}`,
      );
      seen.add(key);
    }
  }
});

Deno.test("Weave defaults use canonical sflo and sfcfg namespaces", async () => {
  for (const relativePath of DEFAULT_RDF_FILES) {
    const contents = await readRepoFile(relativePath);

    assert(
      contents.includes(`@prefix sflo: <${SFLO_NAMESPACE}> .`),
      `${relativePath} should import core terms through the canonical sflo namespace`,
    );
    assert(
      contents.includes(`@prefix sfcfg: <${SFCFG_NAMESPACE}> .`),
      `${relativePath} should import config terms through the canonical sfcfg namespace`,
    );
    assertFalse(
      contents.includes("https://semantic-flow.github.io/ontology/core/"),
      `${relativePath} should not use the old core namespace alias`,
    );
    assertFalse(
      contents.includes("https://semantic-flow.github.io/ontology/config"),
      `${relativePath} should not use the old standalone config namespace`,
    );
  }
});

Deno.test("Weave defaults use flat sfcfg term IRIs", async () => {
  for (const relativePath of DEFAULT_RDF_FILES) {
    const quads = await parseRepoTurtle(relativePath);
    for (const term of quads.flatMap(quadTerms)) {
      if (term.termType !== "NamedNode") {
        continue;
      }
      if (!term.value.startsWith(SFCFG_NAMESPACE)) {
        continue;
      }

      const localName = term.value.slice(SFCFG_NAMESPACE.length);
      assertFalse(
        localName.includes("/"),
        `${relativePath} uses slash-shaped sfcfg term ${term.value}`,
      );
    }
  }
});

Deno.test("retired config fragments stay out of Weave defaults and runtime policy", async () => {
  const checkedFiles = [
    "defaults/application.ttl",
    "defaults/config-resolution.ttl",
    "src/runtime/operational/local_path_policy.ts",
    "src/runtime/operational/local_path_policy_test.ts",
  ] as const;
  const retiredFragments = [
    "sfcfg:LocalConfig",
    "<LocalConfig>",
    `${SFCFG_NAMESPACE}LocalConfig`,
    "artifactResolutionMode_current",
    "artifactResolutionMode_pinned",
    "meshRootPathBase",
    "userHomePathBase",
    "absolutePathBase",
    "workingLocalRelativePathLocatorKind",
    "targetLocalRelativePathLocatorKind",
    "workingAccessUrlLocatorKind",
    "targetAccessUrlLocatorKind",
    "generateResourcePages",
    "createHistoricalStatesOnWeave",
  ] as const;

  for (const relativePath of checkedFiles) {
    const contents = await readRepoFile(relativePath);
    for (const retiredFragment of retiredFragments) {
      assertFalse(
        contents.includes(retiredFragment),
        `${relativePath} still contains retired config fragment ${retiredFragment}`,
      );
    }
  }
});

async function parseRepoTurtle(relativePath: string): Promise<readonly Quad[]> {
  const absolutePath = join(REPO_ROOT, relativePath);
  const turtle = await Deno.readTextFile(absolutePath);
  try {
    return new Parser({ baseIRI: `file://${absolutePath}` }).parse(turtle);
  } catch (error) {
    throw new Error(`Could not parse ${relativePath}: ${String(error)}`);
  }
}

async function readRepoFile(relativePath: string): Promise<string> {
  return await Deno.readTextFile(join(REPO_ROOT, relativePath));
}

function quadTerms(quad: Quad): readonly Term[] {
  return [quad.subject, quad.predicate, quad.object, quad.graph];
}

function termKey(term: Term): string {
  if (term.termType === "Literal") {
    return [
      "Literal",
      JSON.stringify(term.value),
      term.datatype.value,
      term.language,
    ].join("|");
  }

  return `${term.termType}|${term.value}`;
}
