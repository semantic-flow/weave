import { assertEquals, assertRejects, assertStringIncludes } from "@std/assert";
import { join } from "@std/path";
import { Parser } from "n3";
import type { OperationalLocalPathPolicy } from "../operational/local_path_policy.ts";
import { loadOperationalLocalPathPolicy } from "../operational/local_path_policy.ts";
import {
  type ArtifactResolutionContext,
  ArtifactResolutionError,
  parseArtifactResolutionSpecQuads,
  resolveArtifactResolutionRequest,
  resolveArtifactResolutionSpecQuads,
} from "./resolver.ts";

const MESH_BASE = "https://example.org/mesh/";
const SFLO = "https://semantic-flow.github.io/sflo/ontology/";

Deno.test("parseArtifactResolutionSpecQuads normalizes supported RDF coordinates", () => {
  const quads = new Parser({ baseIRI: MESH_BASE }).parse(`
@prefix sflo: <${SFLO}> .

<#source> a sflo:ArtifactResolutionSpec ;
  sflo:targetLocalRelativePath "config/source.ttl" ;
  sflo:expectsContentDigest "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" .
`);

  const request = parseArtifactResolutionSpecQuads(
    quads,
    new URL("#source", MESH_BASE).href,
  );

  assertEquals(request.sourceIri, "https://example.org/mesh/#source");
  assertEquals(request.targetLocalRelativePath, "config/source.ttl");
  assertEquals(
    request.expectedContentDigest,
    "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  );
});

Deno.test("resolveArtifactResolutionRequest reads direct targetLocalRelativePath text and verifies digest", async () => {
  const { context, meshRoot } = await createResolverTestContext();
  await Deno.mkdir(join(meshRoot, "config"), { recursive: true });
  const path = join(meshRoot, "config/source.ttl");
  const text = "@prefix : <#> .\n";
  await Deno.writeTextFile(path, text);

  const result = await resolveArtifactResolutionRequest(context, {
    sourceDescription: "direct config source",
    targetLocalRelativePath: "config/source.ttl",
    expectedContentDigest: await sha256Digest(text),
  }, { contentMode: "text" });

  assertEquals(result.observed.localRelativePath, "config/source.ttl");
  assertEquals(result.observed.contentDigest, await sha256Digest(text));
  assertEquals(result.content?.text, text);
});

Deno.test("resolveArtifactResolutionRequest allows workspace-bounded targetLocalRelativePath through policy", async () => {
  const tempRoot = await Deno.makeTempDir({
    prefix: "weave-artifact-resolution-workspace-",
  });
  const repoRoot = join(tempRoot, "repo");
  const meshRoot = join(repoRoot, "docs");
  await Deno.mkdir(join(meshRoot, "_mesh/_config"), { recursive: true });
  await Deno.mkdir(join(repoRoot, "shared"), { recursive: true });
  await Deno.writeTextFile(
    join(meshRoot, "_mesh/_config/config.ttl"),
    `@prefix sfcfg: <https://semantic-flow.github.io/sflo/config/> .

<> a sfcfg:MeshConfig ;
  sfcfg:workspaceRootRelativeToMeshRoot "../" ;
  sfcfg:hasMeshWorkspacePathRule [
    a sfcfg:MeshWorkspacePathRule ;
    sfcfg:workspacePathPrefix "../shared/" ;
    sfcfg:appliesToLocalPathLocatorKind <https://semantic-flow.github.io/sflo/config/localPathLocatorKind_targetLocalRelativePath>
  ] .
`,
  );
  await Deno.writeTextFile(join(repoRoot, "shared/config.ttl"), "shared\n");

  const policy = await loadOperationalLocalPathPolicy(meshRoot);
  const result = await resolveArtifactResolutionRequest({
    meshRoot,
    meshBase: MESH_BASE,
    localPathPolicy: policy,
  }, {
    sourceDescription: "workspace config source",
    targetLocalRelativePath: "../shared/config.ttl",
  }, { contentMode: "text" });

  assertEquals(result.content?.text, "shared\n");
  assertEquals(result.observed.localRelativePath, "../shared/config.ttl");
});

Deno.test("resolveArtifactResolutionRequest rejects denied targetLocalRelativePath escapes", async () => {
  const { context } = await createResolverTestContext();

  await assertRejects(
    () =>
      resolveArtifactResolutionRequest(context, {
        sourceDescription: "escaping config source",
        targetLocalRelativePath: "../outside.ttl",
      }, { contentMode: "text" }),
    ArtifactResolutionError,
    "outside the allowed local-path boundary",
  );
});

Deno.test("resolveArtifactResolutionRequest rejects targetAccessUrl without fetching", async () => {
  const { context } = await createResolverTestContext();

  await assertRejects(
    () =>
      resolveArtifactResolutionRequest(context, {
        sourceDescription: "remote import provenance",
        targetAccessUrl: "https://example.org/source.ttl",
      }, { contentMode: "text" }),
    ArtifactResolutionError,
    "does not fetch",
  );
});

Deno.test("resolveArtifactResolutionRequest rejects digest mismatches", async () => {
  const { context, meshRoot } = await createResolverTestContext();
  await Deno.writeTextFile(join(meshRoot, "source.ttl"), "actual\n");

  await assertRejects(
    () =>
      resolveArtifactResolutionRequest(context, {
        sourceDescription: "digest-pinned source",
        targetLocalRelativePath: "source.ttl",
        expectedContentDigest:
          "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      }, { contentMode: "text" }),
    ArtifactResolutionError,
    "digest mismatch",
  );
});

Deno.test("resolveArtifactResolutionRequest resolves governed payload working bytes", async () => {
  const { context, meshRoot } = await createResolverTestContext();
  await materializePayloadArtifact(meshRoot);
  await Deno.writeTextFile(join(meshRoot, "alice/source.ttl"), "working\n");

  const result = await resolveArtifactResolutionRequest(context, {
    sourceDescription: "working payload source",
    targetArtifactIri: new URL("alice", MESH_BASE).href,
    mode: "working",
  }, { contentMode: "text" });

  assertEquals(result.observed.localRelativePath, "alice/source.ttl");
  assertEquals(result.content?.text, "working\n");
});

Deno.test("resolveArtifactResolutionRequest resolves governed payload latest state", async () => {
  const { context, meshRoot } = await createResolverTestContext();
  await materializePayloadArtifact(meshRoot);
  await Deno.writeTextFile(
    join(meshRoot, "alice/_history001/_s0001/ttl/source.ttl"),
    "settled\n",
  );

  const result = await resolveArtifactResolutionRequest(context, {
    sourceDescription: "latest payload source",
    targetArtifactIri: new URL("alice", MESH_BASE).href,
    mode: "latestState",
  }, { contentMode: "text" });

  assertEquals(
    result.observed.historicalStateIri,
    new URL("alice/_history001/_s0001", MESH_BASE).href,
  );
  assertEquals(
    result.observed.locatedFileIri,
    new URL("alice/_history001/_s0001/ttl/source.ttl", MESH_BASE).href,
  );
  assertEquals(result.content?.text, "settled\n");
});

Deno.test("resolveArtifactResolutionRequest rejects latest payload state without HistoricalState type", async () => {
  const { context, meshRoot } = await createResolverTestContext();
  await materializePayloadArtifact(meshRoot);
  const inventoryPath = join(
    meshRoot,
    "alice/_knop/_inventory/inventory.ttl",
  );
  await Deno.writeTextFile(
    inventoryPath,
    (await Deno.readTextFile(inventoryPath)).replace(
      "<alice/_history001/_s0001> a sflo:HistoricalState ;",
      "<alice/_history001/_s0001> a sflo:LocatedFile ;",
    ),
  );

  await assertRejects(
    () =>
      resolveArtifactResolutionRequest(context, {
        sourceDescription: "latest payload source",
        targetArtifactIri: new URL("alice", MESH_BASE).href,
        mode: "latestState",
      }, { contentMode: "text" }),
    ArtifactResolutionError,
    "targetHistoricalState is not declared as a HistoricalState",
  );
});

Deno.test("resolveArtifactResolutionRequest resolves exact payload historical state", async () => {
  const { context, meshRoot } = await createResolverTestContext();
  await materializePayloadArtifact(meshRoot);
  await Deno.writeTextFile(
    join(meshRoot, "alice/_history001/_s0001/ttl/source.ttl"),
    "exact\n",
  );

  const result = await resolveArtifactResolutionRequest(context, {
    sourceDescription: "exact payload source",
    targetArtifactIri: new URL("alice", MESH_BASE).href,
    targetHistoricalStateIri: new URL(
      "alice/_history001/_s0001",
      MESH_BASE,
    ).href,
  }, { contentMode: "text" });

  assertEquals(
    result.observed.historicalStateIri,
    new URL("alice/_history001/_s0001", MESH_BASE).href,
  );
  assertEquals(result.content?.text, "exact\n");
});

Deno.test("resolveArtifactResolutionRequest rejects state/history ownership mismatches", async () => {
  const { context, meshRoot } = await createResolverTestContext();
  await materializePayloadArtifact(meshRoot);

  await assertRejects(
    () =>
      resolveArtifactResolutionRequest(context, {
        sourceDescription: "wrong history source",
        targetArtifactIri: new URL("alice", MESH_BASE).href,
        targetArtifactHistoryIri: new URL("alice/_history999", MESH_BASE).href,
        targetHistoricalStateIri: new URL(
          "alice/_history999/_s0001",
          MESH_BASE,
        ).href,
      }, { contentMode: "text" }),
    ArtifactResolutionError,
    "not a history of targetArtifact",
  );
});

Deno.test("resolveArtifactResolutionSpecQuads falls back after unavailable exact state bytes", async () => {
  const { context, meshRoot } = await createResolverTestContext();
  await materializePayloadArtifact(meshRoot);
  await Deno.writeTextFile(join(meshRoot, "fallback.md"), "fallback\n");
  const quads = new Parser({ baseIRI: MESH_BASE }).parse(`
@prefix sflo: <${SFLO}> .

<#source> a sflo:ArtifactResolutionSpec ;
  sflo:targetArtifact <alice> ;
  sflo:targetHistoricalState <alice/_history001/_s0001> ;
  sflo:hasFallbackArtifactResolutionSpec <#fallback> .

<#fallback> a sflo:ArtifactResolutionSpec ;
  sflo:targetLocalRelativePath "fallback.md" .
`);

  const result = await resolveArtifactResolutionSpecQuads(
    context,
    quads,
    new URL("#source", MESH_BASE).href,
    { contentMode: "text" },
  );

  assertEquals(result.observed.localRelativePath, "fallback.md");
  assertEquals(result.content?.text, "fallback\n");
});

Deno.test("resolveArtifactResolutionSpecQuads does not fall back after digest mismatch", async () => {
  const { context, meshRoot } = await createResolverTestContext();
  await materializePayloadArtifact(meshRoot);
  await Deno.writeTextFile(
    join(meshRoot, "alice/_history001/_s0001/ttl/source.ttl"),
    "primary\n",
  );
  await Deno.writeTextFile(join(meshRoot, "fallback.md"), "fallback\n");
  const quads = new Parser({ baseIRI: MESH_BASE }).parse(`
@prefix sflo: <${SFLO}> .

<#source> a sflo:ArtifactResolutionSpec ;
  sflo:targetArtifact <alice> ;
  sflo:targetHistoricalState <alice/_history001/_s0001> ;
  sflo:expectsContentDigest "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" ;
  sflo:hasFallbackArtifactResolutionSpec <#fallback> .

<#fallback> a sflo:ArtifactResolutionSpec ;
  sflo:targetLocalRelativePath "fallback.md" .
`);

  await assertRejects(
    () =>
      resolveArtifactResolutionSpecQuads(
        context,
        quads,
        new URL("#source", MESH_BASE).href,
        { contentMode: "text" },
      ),
    ArtifactResolutionError,
    "digest mismatch",
  );
});

Deno.test("resolveArtifactResolutionSpecQuads reports primary and fallback failures", async () => {
  const { context, meshRoot } = await createResolverTestContext();
  await materializePayloadArtifact(meshRoot);
  const quads = new Parser({ baseIRI: MESH_BASE }).parse(`
@prefix sflo: <${SFLO}> .

<#source> a sflo:ArtifactResolutionSpec ;
  sflo:targetArtifact <alice> ;
  sflo:targetHistoricalState <alice/_history001/_s0001> ;
  sflo:hasFallbackArtifactResolutionSpec <#fallback> .

<#fallback> a sflo:ArtifactResolutionSpec ;
  sflo:targetLocalRelativePath "missing.md" .
`);

  const error = await assertRejects(
    () =>
      resolveArtifactResolutionSpecQuads(
        context,
        quads,
        new URL("#source", MESH_BASE).href,
        { contentMode: "text" },
      ),
    ArtifactResolutionError,
  );

  assertStringIncludes(error.message, "failed before fallback");
  assertStringIncludes(error.message, "Fallback");
  assertStringIncludes(error.message, "missing.md");
});

Deno.test("resolveArtifactResolutionRequest resolves exact in-mesh located files", async () => {
  const { context, meshRoot } = await createResolverTestContext();
  await Deno.mkdir(join(meshRoot, "_mesh/_config"), { recursive: true });
  await Deno.writeTextFile(join(meshRoot, "_mesh/_config/config.ttl"), "cfg\n");

  const result = await resolveArtifactResolutionRequest(context, {
    sourceDescription: "located file source",
    targetLocatedFileIri: new URL("_mesh/_config/config.ttl", MESH_BASE).href,
  }, { contentMode: "text" });

  assertEquals(result.observed.localRelativePath, "_mesh/_config/config.ttl");
  assertEquals(
    result.observed.locatedFileIri,
    new URL("_mesh/_config/config.ttl", MESH_BASE).href,
  );
  assertEquals(result.content?.text, "cfg\n");
});

Deno.test("parseArtifactResolutionSpecQuads rejects duplicate singleton coordinates", () => {
  const quads = new Parser({ baseIRI: MESH_BASE }).parse(`
@prefix sflo: <${SFLO}> .

<#source> sflo:targetLocalRelativePath "a.ttl", "b.ttl" .
`);

  const error = assertRejectsSync(() =>
    parseArtifactResolutionSpecQuads(
      quads,
      new URL("#source", MESH_BASE).href,
    )
  );

  assertStringIncludes(error.message, "Expected at most one");
});

async function createResolverTestContext(): Promise<{
  meshRoot: string;
  context: ArtifactResolutionContext;
}> {
  const meshRoot = await Deno.makeTempDir({
    prefix: "weave-artifact-resolution-",
  });
  const policy: OperationalLocalPathPolicy = {
    meshRoot,
    workspaceRoot: meshRoot,
    rules: [],
  };
  return {
    meshRoot,
    context: {
      meshRoot,
      meshBase: MESH_BASE,
      localPathPolicy: policy,
    },
  };
}

async function materializePayloadArtifact(meshRoot: string): Promise<void> {
  await Deno.mkdir(join(meshRoot, "alice/_knop/_inventory"), {
    recursive: true,
  });
  await Deno.mkdir(join(meshRoot, "alice"), { recursive: true });
  await Deno.mkdir(join(meshRoot, "alice/_history001/_s0001/ttl"), {
    recursive: true,
  });
  await Deno.writeTextFile(
    join(meshRoot, "alice/_knop/_inventory/inventory.ttl"),
    `@base <${MESH_BASE}> .
@prefix sflo: <${SFLO}> .

<alice/_knop> a sflo:Knop ;
  sflo:hasPayloadArtifact <alice> .

<alice> a sflo:PayloadArtifact, sflo:RdfDocument ;
  sflo:workingLocalRelativePath "alice/source.ttl" ;
  sflo:currentArtifactHistory <alice/_history001> ;
  sflo:hasArtifactHistory <alice/_history001> .

<alice/_history001> a sflo:ArtifactHistory ;
  sflo:latestHistoricalState <alice/_history001/_s0001> .

<alice/_history001/_s0001> a sflo:HistoricalState ;
  sflo:locatedFileForState <alice/_history001/_s0001/ttl/source.ttl> .
`,
  );
}

async function sha256Digest(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const hex = [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return `sha256:${hex}`;
}

function assertRejectsSync(callback: () => unknown): Error {
  try {
    callback();
  } catch (error) {
    if (error instanceof Error) {
      return error;
    }
    throw error;
  }
  throw new Error("Expected callback to throw");
}
