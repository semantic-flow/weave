import { assert, assertFalse } from "@std/assert";
import { fromFileUrl, join } from "@std/path";
import { Parser, type Quad, type Term } from "n3";

const REPO_ROOT = fromFileUrl(new URL("../../", import.meta.url));
const SFLO_NAMESPACE = "https://semantic-flow.github.io/sflo/ontology/";
const SFCFG_NAMESPACE = "https://semantic-flow.github.io/ontology/config/";

const RDF_FILES = [
  "dependencies/github.com/semantic-flow/sflo/semantic-flow-core-ontology.ttl",
  "dependencies/github.com/semantic-flow/sflo/semantic-flow-core-shacl.ttl",
  "dependencies/github.com/semantic-flow/sflo/semantic-flow-config-ontology.ttl",
  "dependencies/github.com/semantic-flow/sflo/semantic-flow-job-ontology.ttl",
  "dependencies/github.com/semantic-flow/sflo/semantic-flow-prov-ontology.ttl",
  "defaults/application.ttl",
  "defaults/config-resolution.ttl",
] as const;

Deno.test("active ontology and defaults RDF parses as Turtle", async () => {
  for (const relativePath of RDF_FILES) {
    const quads = await parseRepoTurtle(relativePath);
    assert(quads.length > 0, `${relativePath} should contain RDF triples`);
  }
});

Deno.test("config ontology uses the canonical sflo namespace", async () => {
  const configOntology = await readRepoFile(
    "dependencies/github.com/semantic-flow/sflo/semantic-flow-config-ontology.ttl",
  );

  assert(
    configOntology.includes(`@prefix sflo: <${SFLO_NAMESPACE}> .`),
    "config ontology should import core terms through the canonical sflo namespace",
  );
  assertFalse(
    configOntology.includes("https://semantic-flow.github.io/ontology/core/"),
    "config ontology should not use the old core namespace alias",
  );
  assertFalse(
    configOntology.includes(
      "@base <https://semantic-flow.github.io/ontology/config> .",
    ),
    "config ontology @base should keep the trailing slash required by sfcfg terms",
  );
});

Deno.test("active config terms use flat namespace-local IRIs", async () => {
  for (const relativePath of RDF_FILES) {
    const quads = await parseRepoTurtle(relativePath);
    for (const term of quads.flatMap(quadTerms)) {
      if (term.termType !== "NamedNode") {
        continue;
      }
      if (!term.value.startsWith(SFCFG_NAMESPACE)) {
        continue;
      }

      const localName = term.value.slice(SFCFG_NAMESPACE.length);
      if (localName.startsWith("releases/")) {
        continue;
      }

      assertFalse(
        localName.includes("/"),
        `${relativePath} uses slash-shaped sfcfg term ${term.value}`,
      );
    }
  }
});

Deno.test("old config names and boolean policy switches stay retired", async () => {
  const checkedFiles = [
    "dependencies/github.com/semantic-flow/sflo/semantic-flow-config-ontology.ttl",
    "src/runtime/operational/local_path_policy.ts",
    "src/runtime/operational/local_path_policy_test.ts",
    "defaults/application.ttl",
    "defaults/config-resolution.ttl",
  ] as const;
  const retiredFragments = [
    "sfcfg:LocalConfig",
    "<LocalConfig>",
    `${SFCFG_NAMESPACE}LocalConfig`,
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
