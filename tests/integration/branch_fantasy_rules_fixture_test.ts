import {
  assert,
  assertEquals,
  assertFalse,
  assertRejects,
  assertStringIncludes,
} from "@std/assert";
import { join } from "@std/path";
import { Parser, type Quad, type Term } from "n3";
import { executeExtractAllTerms } from "../../src/runtime/extract/extract.ts";
import { executeGenerate } from "../../src/runtime/weave/weave.ts";
import { readSingleTransitionCase } from "../support/accord_manifest.ts";
import {
  listMeshBranchFantasyRulesBranchFiles,
  materializeMeshBranchFantasyRulesBranch,
  MESH_BRANCH_FANTASY_RULES_BASE,
  meshBranchFantasyRulesSourcePaths,
  readMeshBranchFantasyRulesBranchFile,
  resolveMeshBranchFantasyRulesCommit,
  resolveMeshBranchFantasyRulesConformanceManifestPath,
  resolveMeshBranchFantasyRulesFixtureRepoPath,
} from "../support/mesh_branch_fantasy_rules_fixture.ts";
import { createTestTmpDir } from "../support/test_tmp.ts";

const branchSourceOnlyExpectedPaths = [
  ".assets/01-source-only/NOTICE.md",
  ".assets/01-source-only/examples/gunaar.ttl",
  ".assets/01-source-only/ontology/fantasy-rules-ontology.ttl",
  ".assets/01-source-only/shacl/fantasy-rules-shacl.ttl",
  ".assets/14-first-release/examples/gunaar.ttl",
  ".assets/14-first-release/ontology/fantasy-rules-ontology.ttl",
  ".assets/14-first-release/shacl/fantasy-rules-shacl.ttl",
  ".gitignore",
  "NOTICE.md",
  "README.md",
  "examples/gunaar.ttl",
  "ontology/fantasy-rules-ontology.ttl",
  "shacl/fantasy-rules-shacl.ttl",
] as const;

const branchSourceBindings = [
  {
    designatorPath: "ontology",
    sourcePath: "ontology/fantasy-rules-ontology.ttl",
    bindingKey: "branch-source-ontology",
  },
  {
    designatorPath: "shacl",
    sourcePath: "shacl/fantasy-rules-shacl.ttl",
    bindingKey: "branch-source-shacl",
  },
  {
    designatorPath: "examples/gunaar",
    sourcePath: "examples/gunaar.ttl",
    bindingKey: "branch-source-examples-gunaar",
  },
] as const;

Deno.test("branch Fantasy Rules source lane remains source-only", async () => {
  const paths = await listMeshBranchFantasyRulesBranchFiles(
    "10-first-release-source",
  );
  assertEquals(paths, [...branchSourceOnlyExpectedPaths]);

  assertEquals(
    paths.filter((path) =>
      path === "_mesh" ||
      path.startsWith("_mesh/") ||
      path.includes("/_knop/") ||
      path.includes("/_history") ||
      path.includes("/_sources/") ||
      path.endsWith(".html")
    ),
    [],
  );
});

Deno.test("branch Fantasy Rules final publication links repository source provenance from Knop inventories", async () => {
  const sourceRef = "a.10-first-release-source";
  const sourceCommit = await resolveMeshBranchFantasyRulesCommit(sourceRef);
  const fixtureRepoPath = resolveMeshBranchFantasyRulesFixtureRepoPath();

  for (const binding of branchSourceBindings) {
    const registryPath = `${binding.designatorPath}/_knop/_sources`;
    const sourcesFilePath = `${registryPath}/sources.ttl`;
    const inventory = await readMeshBranchFantasyRulesBranchFile(
      "15-extracted-term-references-woven",
      `${binding.designatorPath}/_knop/_inventory/inventory.ttl`,
    );
    const sources = await readMeshBranchFantasyRulesBranchFile(
      "15-extracted-term-references-woven",
      sourcesFilePath,
    );

    assertStringIncludes(
      inventory,
      `sflo:hasKnopSourceRegistry <${registryPath}>`,
    );
    assertStringIncludes(
      inventory,
      `<${registryPath}> a sflo:KnopSourceRegistry, sflo:DigitalArtifact, sflo:RdfDocument`,
    );
    assertStringIncludes(
      inventory,
      `<${sourcesFilePath}> a sflo:LocatedFile, sflo:RdfDocument .`,
    );

    assertStringIncludes(
      sources,
      `<${registryPath}#${binding.bindingKey}> a sflo:ArtifactResolutionTarget`,
    );
    assertStringIncludes(
      sources,
      `sflo:hasTargetArtifact <${
        new URL(binding.designatorPath, MESH_BRANCH_FANTASY_RULES_BASE).href
      }>`,
    );
    assertStringIncludes(
      sources,
      `sflo:targetLocalRelativePath "${binding.sourcePath}"`,
    );
    assertStringIncludes(
      sources,
      'sflo:sourceRepositoryUrl "https://github.com/semantic-flow/mesh-branch-fantasy-rules.git"',
    );
    assertStringIncludes(
      sources,
      `sflo:sourceRepositoryRef "${sourceRef}"`,
    );
    assertStringIncludes(
      sources,
      `sflo:sourceRepositoryCommit "${sourceCommit}"`,
    );
    assertStringIncludes(
      sources,
      `sflo:sourceRepositoryPath "${binding.sourcePath}"`,
    );
    assertStringIncludes(sources, 'sflo:expectsContentDigest "sha256:');
    assertStringIncludes(sources, 'sflo:hasContentDigest "sha256:');
    assertFalse(sources.includes(fixtureRepoPath), sources);
  }
});

Deno.test("branch Fantasy Rules final publication has ResourcePages for every source term IRI", async () => {
  const workspaceRoot = await createTestTmpDir(
    "weave-branch-all-terms-pages-",
  );
  await materializeMeshBranchFantasyRulesBranch(
    "15-extracted-term-references-woven",
    workspaceRoot,
  );

  const transitionCase = await readSingleTransitionCase(
    resolveMeshBranchFantasyRulesConformanceManifestPath(
      "13-all-remaining-terms-woven.jsonld",
    ),
  );
  const manifestTermPaths = transitionCase.targetDesignatorPaths;
  assert(Array.isArray(manifestTermPaths));

  const termPaths = new Set<string>();
  for (const sourcePath of meshBranchFantasyRulesSourcePaths) {
    const turtle = await Deno.readTextFile(join(workspaceRoot, sourcePath));
    for (
      const path of meshScopedSourceTermPathsFromQuads(
        new Parser({ baseIRI: MESH_BRANCH_FANTASY_RULES_BASE }).parse(turtle),
      )
    ) {
      termPaths.add(path);
    }
  }

  const sortedTermPaths = [...termPaths].sort();
  assertEquals(
    [...manifestTermPaths].filter((termPath) => !termPaths.has(termPath)),
    [],
  );
  assertEquals(sortedTermPaths.length, 72);

  const missingPages: string[] = [];
  for (const termPath of sortedTermPaths) {
    try {
      await Deno.stat(join(workspaceRoot, termPath, "index.html"));
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) {
        missingPages.push(termPath);
        continue;
      }
      throw error;
    }
  }

  assertEquals(missingPages, []);
});

Deno.test("branch Fantasy Rules final publication has current canonical references for representative extracted terms", async () => {
  const references = [
    {
      subjectPath: "ontology/Ability",
      targetPath: "ontology",
    },
    {
      subjectPath: "ontology/CharacterShape",
      targetPath: "shacl",
    },
    {
      subjectPath: "examples/gunaar/ability-score/strength",
      targetPath: "examples/gunaar",
    },
  ] as const;

  for (const reference of references) {
    const referenceCatalogPath = `${reference.subjectPath}/_knop/_references`;
    const referencesTurtle = await readMeshBranchFantasyRulesBranchFile(
      "15-extracted-term-references-woven",
      `${referenceCatalogPath}/references.ttl`,
    );
    assertStringIncludes(
      referencesTurtle,
      `<${reference.subjectPath}> sflo:hasReferenceLink <${referenceCatalogPath}#reference001> .`,
    );
    assertStringIncludes(
      referencesTurtle,
      `sflo:referenceLinkFor <${reference.subjectPath}>`,
    );
    assertStringIncludes(
      referencesTurtle,
      "sflo:hasReferenceRole <https://semantic-flow.github.io/sflo/ontology/referenceRole_canonical>",
    );
    assertStringIncludes(
      referencesTurtle,
      `sflo:referenceTarget <${reference.targetPath}>`,
    );
    assertFalse(referencesTurtle.includes("sflo:referenceTargetState"));

    await readMeshBranchFantasyRulesBranchFile(
      "15-extracted-term-references-woven",
      `${referenceCatalogPath}/index.html`,
    );
  }
});

Deno.test("branch Fantasy Rules generated extracted release state uses source inventory history role", async () => {
  const workspaceRoot = await createTestTmpDir(
    "branch-fantasy-rules-release-state-page-",
  );
  await materializeMeshBranchFantasyRulesBranch(
    "15-extracted-term-references-woven",
    workspaceRoot,
  );

  const result = await executeGenerate({
    meshRoot: workspaceRoot,
    request: { targets: [{ designatorPath: "ontology/releases/v0.0.2" }] },
    now: () => new Date("2026-05-16T00:00:00.000Z"),
  });

  assertEquals(result.generatedDesignatorPaths, [
    "ontology/releases/v0.0.2",
  ]);
  const releaseStatePage = await Deno.readTextFile(
    join(workspaceRoot, "ontology/releases/v0.0.2/index.html"),
  );

  assertStringIncludes(
    releaseStatePage,
    '<p class="wf-classes">a <a href="https://semantic-flow.github.io/sflo/ontology/HistoricalState">sflo:HistoricalState</a></p>',
  );
  assertStringIncludes(releaseStatePage, "<summary>Manifestations</summary>");
  assertStringIncludes(
    releaseStatePage,
    'href="/mesh-branch-fantasy-rules/ontology/releases/v0.0.2/ttl"',
  );
  assertFalse(releaseStatePage.includes('<th scope="row">Source</th>'));
});

Deno.test("branch Fantasy Rules all-terms extract skips source artifact support resources", async () => {
  const workspaceRoot = await createTestTmpDir(
    "branch-fantasy-rules-all-terms-support-skip-",
  );
  await materializeMeshBranchFantasyRulesBranch(
    "11-first-release-woven",
    workspaceRoot,
  );

  const result = await executeExtractAllTerms({
    meshRoot: workspaceRoot,
    request: { sourceDesignatorPath: "ontology" },
  });

  assertFalse(
    result.extractedDesignatorPaths.includes("ontology/releases/v0.0.2"),
  );
  assertStringIncludes(
    result.skippedSupportDesignatorPaths.join("\n"),
    "ontology/releases/v0.0.2",
  );
  assertFalse(
    result.createdPaths.some((path) =>
      path.startsWith("ontology/releases/v0.0.2/_knop/")
    ),
  );
  await assertRejects(
    () => Deno.stat(join(workspaceRoot, "ontology/releases/v0.0.2/_knop")),
    Deno.errors.NotFound,
  );
});

function meshScopedSourceTermPathsFromQuads(quads: readonly Quad[]): string[] {
  const paths = new Set<string>();
  for (const quad of quads) {
    for (const term of [quad.subject, quad.predicate, quad.object]) {
      const path = meshScopedSourceTermPath(term);
      if (path !== undefined) {
        paths.add(path);
      }
    }
  }
  return [...paths].sort();
}

function meshScopedSourceTermPath(term: Term): string | undefined {
  if (
    term.termType !== "NamedNode" ||
    !term.value.startsWith(MESH_BRANCH_FANTASY_RULES_BASE)
  ) {
    return undefined;
  }

  const path = term.value.slice(MESH_BRANCH_FANTASY_RULES_BASE.length);
  if (path.length === 0 || path.endsWith(".ttl")) {
    return undefined;
  }
  return path;
}
