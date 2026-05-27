import { assert, assertFalse } from "@std/assert";
import { fromFileUrl, join } from "@std/path";
import { Parser, type Quad, type Term } from "n3";

const REPO_ROOT = fromFileUrl(new URL("../../", import.meta.url));
const SFLO_NAMESPACE = "https://semantic-flow.github.io/sflo/ontology/";
const SFCFG_NAMESPACE = "https://semantic-flow.github.io/sflo/config/";
const WEAVE_DEFAULTS_NAMESPACE =
  "https://semantic-flow.github.io/weave/defaults/";
const RDF_TYPE_IRI = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type";
const SFLO_HAS_WORKING_LOCATED_FILE_IRI =
  `${SFLO_NAMESPACE}hasWorkingLocatedFile`;

const DEFAULT_RDF_FILES = [
  "defaults/application.ttl",
  "defaults/config-resolution.ttl",
  "defaults/stylesheet-metadata.ttl",
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

Deno.test("Weave default stylesheet metadata separates RDF metadata from CSS artifact", async () => {
  const quads = await parseRepoTurtle("defaults/stylesheet-metadata.ttl");
  const metadataIri = `${WEAVE_DEFAULTS_NAMESPACE}stylesheet-metadata`;
  const metadataFileIri = `${WEAVE_DEFAULTS_NAMESPACE}stylesheet-metadata.ttl`;
  const stylesheetIri = `${WEAVE_DEFAULTS_NAMESPACE}stylesheet`;
  const stylesheetFileIri = `${WEAVE_DEFAULTS_NAMESPACE}stylesheet.css`;

  assertNamedNodeQuad(
    quads,
    metadataIri,
    RDF_TYPE_IRI,
    `${SFLO_NAMESPACE}DigitalArtifact`,
  );
  assertNamedNodeQuad(
    quads,
    metadataIri,
    RDF_TYPE_IRI,
    `${SFLO_NAMESPACE}RdfDocument`,
  );
  assertNamedNodeQuad(
    quads,
    metadataIri,
    SFLO_HAS_WORKING_LOCATED_FILE_IRI,
    metadataFileIri,
  );
  assertNamedNodeQuad(
    quads,
    stylesheetIri,
    RDF_TYPE_IRI,
    `${SFCFG_NAMESPACE}ResourcePageStylesheet`,
  );
  assertNamedNodeQuad(
    quads,
    stylesheetIri,
    RDF_TYPE_IRI,
    `${SFLO_NAMESPACE}DigitalArtifact`,
  );
  assertNamedNodeQuad(
    quads,
    stylesheetIri,
    SFLO_HAS_WORKING_LOCATED_FILE_IRI,
    stylesheetFileIri,
  );
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
    "sfcfg:OperationalConfig",
    "<OperationalConfig>",
    `${SFCFG_NAMESPACE}OperationalConfig`,
    "sfcfg:HostLocalOperationalConfig",
    "sfcfg:WorkspaceOperationalConfig",
    "artifactResolutionMode_current",
    "artifactResolutionMode_pinned",
    "sfcfg:hasLocalPathAccessRule",
    "sfcfg:LocalPathAccessRule",
    "sfcfg:hasLocalPathBase",
    "sfcfg:pathPrefix",
    "sfcfg:hasLocalPathLocatorKind",
    "localPathBase_",
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

function assertNamedNodeQuad(
  quads: readonly Quad[],
  subjectIri: string,
  predicateIri: string,
  objectIri: string,
): void {
  assert(
    quads.some((quad) =>
      quad.subject.termType === "NamedNode" &&
      quad.subject.value === subjectIri &&
      quad.predicate.value === predicateIri &&
      quad.object.termType === "NamedNode" &&
      quad.object.value === objectIri
    ),
    `Expected ${subjectIri} ${predicateIri} ${objectIri}`,
  );
}
