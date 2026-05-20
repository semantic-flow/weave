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
import {
  executeGenerate,
  executeWeave,
} from "../../src/runtime/weave/weave.ts";
import { readSingleTransitionCase } from "../support/accord_manifest.ts";
import {
  listMeshBranchFantasyRulesBranchFiles,
  materializeMeshBranchFantasyRulesBranch,
  materializeMeshBranchFantasyRulesPublicationWorkspace,
  MESH_BRANCH_FANTASY_RULES_BASE,
  meshBranchFantasyRulesSourcePaths,
  readMeshBranchFantasyRulesBranchFile,
  resolveMeshBranchFantasyRulesConformanceManifestPath,
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
    sourcePath: "../source/ontology/fantasy-rules-ontology.ttl",
    manifestName: "03-ontology-integrated-woven.jsonld",
  },
  {
    designatorPath: "shacl",
    sourcePath: "../source/shacl/fantasy-rules-shacl.ttl",
    manifestName: "04-shacl-integrated-woven.jsonld",
  },
  {
    designatorPath: "examples/gunaar",
    sourcePath: "../source/examples/gunaar.ttl",
    manifestName: "09-gunaar-example-dataset-woven.jsonld",
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

Deno.test("branch Fantasy Rules manifests use working-only source bindings for branch-published sources", async () => {
  for (const binding of branchSourceBindings) {
    const registryPath = `${binding.designatorPath}/_knop/_sources`;
    const manifestPath = resolveMeshBranchFantasyRulesConformanceManifestPath(
      binding.manifestName,
    );
    const manifestText = await Deno.readTextFile(manifestPath);
    const transitionCase = await readSingleTransitionCase(manifestPath);
    const invocations = transitionCase.hasReplayProfile?.hasCommandSequence ??
      [];
    const integrateInvocation = invocations[0];

    assertEquals(
      integrateInvocation?.argv?.includes("--source-binding-id"),
      false,
    );
    assertEquals(
      integrateInvocation?.argv?.some((arg) =>
        arg.startsWith("--source-repository")
      ),
      false,
    );

    assertStringIncludes(
      manifestText,
      `${registryPath}#payload-source`,
    );
    assertStringIncludes(
      manifestText,
      `<${MESH_BRANCH_FANTASY_RULES_BASE}${registryPath}#payload-source> a <https://semantic-flow.github.io/sflo/ontology/ArtifactResolutionTarget>`,
    );
    assertStringIncludes(
      manifestText,
      `<https://semantic-flow.github.io/sflo/ontology/hasTargetArtifact> <${
        new URL(binding.designatorPath, MESH_BRANCH_FANTASY_RULES_BASE).href
      }>`,
    );
    assertStringIncludes(
      manifestText,
      `<https://semantic-flow.github.io/sflo/ontology/targetLocalRelativePath> \\"${binding.sourcePath}\\"`,
    );
    assertStringIncludes(manifestText, "FILTER NOT EXISTS");
    assertFalse(manifestText.includes("branch-source-"), manifestText);
    assertFalse(manifestText.includes("sourceRepositoryUrl"), manifestText);
    assertFalse(manifestText.includes("sourceRepositoryRef"), manifestText);
    assertFalse(manifestText.includes("sourceRepositoryCommit"), manifestText);
    assertFalse(manifestText.includes("sourceRepositoryPath"), manifestText);
  }

  const firstRelease = await readSingleTransitionCase(
    resolveMeshBranchFantasyRulesConformanceManifestPath(
      "11-first-release-woven.jsonld",
    ),
  );
  const releaseInvocations =
    firstRelease.hasReplayProfile?.hasCommandSequence ?? [];
  assertEquals(releaseInvocations.length, 2);
  for (const invocation of releaseInvocations) {
    assertFalse(invocation.argv?.includes("payload"));
    assertFalse(invocation.argv?.includes("prepare"));
    assertEquals(
      invocation.argv?.some((arg) => arg.startsWith("--source-repository")),
      false,
    );
  }
});

Deno.test("branch Fantasy Rules final publication has ResourcePages for every source term IRI", async () => {
  const workspaceRoot = await createTestTmpDir(
    "weave-branch-all-terms-pages-",
  );
  const { publicationRoot, sourceRoot } =
    await materializeMeshBranchFantasyRulesPublicationWorkspace(
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
    const turtle = await Deno.readTextFile(join(sourceRoot, sourcePath));
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
      await Deno.stat(join(publicationRoot, termPath, "index.html"));
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

Deno.test("branch Fantasy Rules targeted reference weave preserves sibling child shape rows", async () => {
  const workspaceRoot = await createTestTmpDir(
    "branch-fantasy-rules-targeted-child-shapes-",
  );
  const { publicationRoot } =
    await materializeMeshBranchFantasyRulesPublicationWorkspace(
      "14-extracted-term-references",
      workspaceRoot,
    );

  await executeWeave({
    meshRoot: publicationRoot,
    request: {
      targets: [
        { designatorPath: "examples/gunaar/ability-score/strength" },
        { designatorPath: "ontology/Ability" },
        { designatorPath: "ontology/CharacterShape" },
      ],
    },
    now: () => new Date("2026-05-03T00:00:00.000Z"),
  });

  const ontologyPage = await Deno.readTextFile(
    join(publicationRoot, "ontology/index.html"),
  );
  const individualsRow = extractChildRowHtml(ontologyPage, "Individuals");
  const nodeShapesRow = extractChildRowHtml(ontologyPage, "Node Shapes");

  assertStringIncludes(nodeShapesRow, "AbilityScoreShape");
  assertStringIncludes(nodeShapesRow, "BarbarianPrimaryAbilityChoice");
  assertStringIncludes(nodeShapesRow, "CharacterPrimaryAbilityByClassShape");
  assertStringIncludes(nodeShapesRow, "CharacterShape");
  assertFalse(individualsRow.includes("AbilityScoreShape"), individualsRow);
  assertFalse(
    individualsRow.includes("BarbarianPrimaryAbilityChoice"),
    individualsRow,
  );
  assertFalse(
    individualsRow.includes("CharacterPrimaryAbilityByClassShape"),
    individualsRow,
  );
  assertStringIncludes(individualsRow, ">barbarian</a>");
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
  const { publicationRoot } =
    await materializeMeshBranchFantasyRulesPublicationWorkspace(
      "11-first-release-woven",
      workspaceRoot,
    );

  const result = await executeExtractAllTerms({
    meshRoot: publicationRoot,
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
    () => Deno.stat(join(publicationRoot, "ontology/releases/v0.0.2/_knop")),
    Deno.errors.NotFound,
  );
});

function extractChildRowHtml(html: string, label: string): string {
  const match = html.match(
    new RegExp(
      `<tr><th scope="row">${label}</th><td>(.*?)</td></tr>`,
      "s",
    ),
  );
  assert(match, `Expected ${label} child row`);
  return match[1]!;
}

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
