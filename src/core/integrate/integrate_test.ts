import { assertEquals, assertStringIncludes, assertThrows } from "@std/assert";
import { IntegrateInputError, planIntegrate } from "./integrate.ts";
import { readMeshAliceBioBranchFile } from "../../../tests/support/mesh_alice_bio_fixture.ts";
import { readMeshSidecarFantasyRulesBranchFile } from "../../../tests/support/mesh_sidecar_fantasy_rules_fixture.ts";
import { compareRdfContent } from "../../../dependencies/github.com/spectacular-voyage/accord/src/checker/compare_rdf.ts";

Deno.test("planIntegrate renders first payload integration artifacts", async () => {
  const plan = planIntegrate({
    designatorPath: "alice/bio",
    workingLocalRelativePath: "alice-bio.ttl",
    meshBase: "https://semantic-flow.github.io/mesh-alice-bio/",
    currentMeshInventoryTurtle: await readMeshAliceBioBranchFile(
      "05-alice-knop-created-woven",
      "_mesh/_inventory/inventory.ttl",
    ),
  });

  assertEquals(
    plan.payloadArtifactIri,
    "https://semantic-flow.github.io/mesh-alice-bio/alice/bio",
  );
  assertEquals(
    plan.knopIri,
    "https://semantic-flow.github.io/mesh-alice-bio/alice/bio/_knop",
  );
  assertEquals(plan.workingLocalRelativePath, "alice-bio.ttl");
  assertEquals(
    plan.createdFiles.map((file) => file.path),
    [
      "alice/bio/_knop/_meta/meta.ttl",
      "alice/bio/_knop/_inventory/inventory.ttl",
    ],
  );
  assertEquals(
    plan.updatedFiles.map((file) => file.path),
    ["_mesh/_inventory/inventory.ttl"],
  );
  assertEquals(
    plan.createdFiles[0]?.contents,
    await readMeshAliceBioBranchFile(
      "06-alice-bio-integrated",
      "alice/bio/_knop/_meta/meta.ttl",
    ),
  );
  assertEquals(
    plan.createdFiles[1]?.contents,
    await readMeshAliceBioBranchFile(
      "06-alice-bio-integrated",
      "alice/bio/_knop/_inventory/inventory.ttl",
    ),
  );
  assertEquals(
    await compareRdfContent({
      left: encode(plan.updatedFiles[0]?.contents ?? ""),
      right: encode(
        await readMeshAliceBioBranchFile(
          "06-alice-bio-integrated",
          "_mesh/_inventory/inventory.ttl",
        ),
      ),
      path: "_mesh/_inventory/inventory.ttl",
    }),
    true,
  );
});

Deno.test("planIntegrate rejects absolute working file paths", async () => {
  const currentMeshInventoryTurtle = await readMeshAliceBioBranchFile(
    "05-alice-knop-created-woven",
    "_mesh/_inventory/inventory.ttl",
  );

  assertThrows(
    () =>
      planIntegrate({
        designatorPath: "alice/bio",
        workingLocalRelativePath: "/tmp/alice-bio.ttl",
        meshBase: "https://semantic-flow.github.io/mesh-alice-bio/",
        currentMeshInventoryTurtle,
      }),
    IntegrateInputError,
    "relative file path",
  );
});

Deno.test(
  "planIntegrate accepts extra-mesh workingLocalRelativePath values and renders them as literals",
  async () => {
    const currentMeshInventoryTurtle = await readMeshAliceBioBranchFile(
      "05-alice-knop-created-woven",
      "_mesh/_inventory/inventory.ttl",
    );

    const plan = planIntegrate({
      designatorPath: "alice/bio",
      workingLocalRelativePath: "../documentation/alice-bio.ttl",
      meshBase: "https://semantic-flow.github.io/mesh-alice-bio/",
      currentMeshInventoryTurtle,
    });

    assertEquals(
      plan.workingLocalRelativePath,
      "../documentation/alice-bio.ttl",
    );
    assertEquals(
      plan.createdFiles[1]?.contents.includes(
        'sflo:workingLocalRelativePath "../documentation/alice-bio.ttl" .',
      ),
      true,
    );
    assertEquals(
      plan.createdFiles[1]?.contents.includes(
        "sflo:hasWorkingLocatedFile <../documentation/alice-bio.ttl> .",
      ),
      false,
    );
    assertEquals(
      plan.updatedFiles[0]?.contents.includes(
        'sflo:workingLocalRelativePath "../documentation/alice-bio.ttl" .',
      ),
      true,
    );
  },
);

Deno.test("planIntegrate records working-only source bindings with the internal id", async () => {
  const currentMeshInventoryTurtle = await readMeshAliceBioBranchFile(
    "05-alice-knop-created-woven",
    "_mesh/_inventory/inventory.ttl",
  );

  const plan = planIntegrate({
    designatorPath: "alice/bio",
    workingLocalRelativePath: "../source/alice-bio.ttl",
    meshBase: "https://semantic-flow.github.io/mesh-alice-bio/",
    currentMeshInventoryTurtle,
    sourceBinding: {
      artifactResolutionMode: "working",
    },
  });

  assertEquals(
    plan.sourceBindingIri,
    "https://semantic-flow.github.io/mesh-alice-bio/alice/bio/_knop/_sources#payload-source",
  );
  assertEquals(
    plan.createdFiles.map((file) => file.path),
    [
      "alice/bio/_knop/_meta/meta.ttl",
      "alice/bio/_knop/_inventory/inventory.ttl",
      "alice/bio/_knop/_sources/sources.ttl",
    ],
  );

  const sources = plan.createdFiles[2]?.contents ?? "";
  assertStringIncludes(
    sources,
    "<alice/bio/_knop/_sources#payload-source> a sflo:IntegrationSource ;",
  );
  assertStringIncludes(
    sources,
    'sflo:targetLocalRelativePath "../source/alice-bio.ttl" ;',
  );
  assertStringIncludes(
    sources,
    "sflo:hasArtifactResolutionMode <https://semantic-flow.github.io/sflo/ontology/artifactResolutionMode_working> .",
  );
  assertEquals(sources.includes("sflo:expectsContentDigest"), false);
  assertEquals(sources.includes("sflo:hasTargetRepositorySource"), false);
  assertEquals(sources.includes("sflo:sourceRepository"), false);
  assertEquals(sources.includes("sflo:hasContentDigest"), false);
});

Deno.test("planIntegrate records repository-backed source bindings", async () => {
  const currentMeshInventoryTurtle = await readMeshAliceBioBranchFile(
    "05-alice-knop-created-woven",
    "_mesh/_inventory/inventory.ttl",
  );

  const plan = planIntegrate({
    designatorPath: "alice/bio",
    workingLocalRelativePath: "../source/alice-bio.ttl",
    meshBase: "https://semantic-flow.github.io/mesh-alice-bio/",
    currentMeshInventoryTurtle,
    sourceBinding: {
      bindingId: "branch-source-alice-bio",
      repositorySource: {
        repositoryUrl: "https://github.com/semantic-flow/mesh-alice-bio.git",
        repositoryRef: "main",
        repositoryCommit: "abc123",
        repositoryPath: "alice-bio.ttl",
        contentDigest: "sha256:123abc",
      },
      observation: {
        observedContentDigest: "sha256:123abc",
      },
    },
  });

  assertEquals(
    plan.sourceBindingIri,
    "https://semantic-flow.github.io/mesh-alice-bio/alice/bio/_knop/_sources#branch-source-alice-bio",
  );
  assertEquals(
    plan.createdFiles.map((file) => file.path),
    [
      "alice/bio/_knop/_meta/meta.ttl",
      "alice/bio/_knop/_inventory/inventory.ttl",
      "alice/bio/_knop/_sources/sources.ttl",
    ],
  );

  const inventory = plan.createdFiles[1]?.contents ?? "";
  assertStringIncludes(
    inventory,
    "sflo:hasKnopSourceRegistry <alice/bio/_knop/_sources> ;",
  );
  assertStringIncludes(
    inventory,
    "<alice/bio/_knop/_sources> a sflo:KnopSourceRegistry, sflo:DigitalArtifact, sflo:RdfDocument ;",
  );

  const sources = plan.createdFiles[2]?.contents ?? "";
  assertStringIncludes(
    sources,
    "<alice/bio/_knop/_sources#branch-source-alice-bio> a sflo:IntegrationSource ;",
  );
  assertStringIncludes(
    sources,
    "sflo:hasTargetArtifact <https://semantic-flow.github.io/mesh-alice-bio/alice/bio> ;",
  );
  assertStringIncludes(
    sources,
    'sflo:targetLocalRelativePath "../source/alice-bio.ttl" ;',
  );
  assertStringIncludes(
    sources,
    "sflo:hasArtifactResolutionMode <https://semantic-flow.github.io/sflo/ontology/artifactResolutionMode_working> ;",
  );
  assertStringIncludes(
    sources,
    'sflo:expectsContentDigest "sha256:123abc" ;',
  );
  assertStringIncludes(
    sources,
    "sflo:hasResolutionObservation <alice/bio/_knop/_sources#branch-source-alice-bio-observation-001> ;",
  );
  assertStringIncludes(
    sources,
    'sflo:sourceRepositoryUrl "https://github.com/semantic-flow/mesh-alice-bio.git" ;',
  );
  assertStringIncludes(sources, 'sflo:sourceRepositoryRef "main" ;');
  assertStringIncludes(sources, 'sflo:sourceRepositoryCommit "abc123" ;');
  assertStringIncludes(sources, 'sflo:sourceRepositoryPath "alice-bio.ttl" ;');
  assertStringIncludes(sources, 'sflo:hasContentDigest "sha256:123abc"');
  assertStringIncludes(
    sources,
    '<alice/bio/_knop/_sources#branch-source-alice-bio-observation-001>\n  a sflo:ArtifactResolutionObservation ;\n  sflo:observedContentDigest "sha256:123abc" .',
  );
});

Deno.test("planIntegrate records floating repository source bindings without local source paths", async () => {
  const currentMeshInventoryTurtle = await readMeshAliceBioBranchFile(
    "05-alice-knop-created-woven",
    "_mesh/_inventory/inventory.ttl",
  );

  const plan = planIntegrate({
    designatorPath: "alice/bio",
    workingLocalRelativePath: "../source/alice-bio.ttl",
    meshBase: "https://semantic-flow.github.io/mesh-alice-bio/",
    currentMeshInventoryTurtle,
    sourceBinding: {
      repositorySourceFloatingLocator: {
        repositoryUrl: "https://github.com/semantic-flow/mesh-alice-bio.git",
        repositoryPathFromRoot: "alice-bio.ttl",
      },
      artifactResolutionMode: "working",
    },
  });

  const inventory = plan.createdFiles[1]?.contents ?? "";
  assertStringIncludes(
    inventory,
    "sflo:hasRepositorySourceFloatingLocator [",
  );
  assertStringIncludes(
    inventory,
    "a sflo:RepositorySourceFloatingLocator ;",
  );
  assertStringIncludes(
    inventory,
    'sflo:sourceRepositoryUrl "https://github.com/semantic-flow/mesh-alice-bio.git" ;',
  );
  assertStringIncludes(
    inventory,
    'sflo:sourceRepositoryPathFromRoot "alice-bio.ttl"',
  );
  assertEquals(inventory.includes("sflo:workingLocalRelativePath"), false);
  assertEquals(
    inventory.includes("sflo:hasWorkingLocatedFile <../source/"),
    false,
  );

  const meshInventory = plan.updatedFiles[0]?.contents ?? "";
  assertStringIncludes(
    meshInventory,
    "sflo:hasRepositorySourceFloatingLocator [",
  );
  assertEquals(meshInventory.includes("sflo:workingLocalRelativePath"), false);
  assertEquals(
    meshInventory.includes("sflo:hasWorkingLocatedFile <../source/"),
    false,
  );

  const sources = plan.createdFiles[2]?.contents ?? "";
  assertStringIncludes(
    sources,
    "<alice/bio/_knop/_sources#payload-source> a sflo:IntegrationSource ;",
  );
  assertStringIncludes(
    sources,
    "sflo:hasRepositorySourceFloatingLocator [",
  );
  assertStringIncludes(
    sources,
    'sflo:sourceRepositoryPathFromRoot "alice-bio.ttl"',
  );
  assertEquals(sources.includes("sflo:targetLocalRelativePath"), false);
  assertEquals(sources.includes("sflo:sourceRepositoryRef"), false);
  assertEquals(sources.includes("sflo:sourceRepositoryCommit"), false);
  assertEquals(sources.includes("sflo:hasContentDigest"), false);
  assertEquals(sources.includes("sflo:expectsContentDigest"), false);
});

Deno.test(
  "planIntegrate accepts semantically equivalent woven MeshInventory turtle",
  async () => {
    const currentMeshInventoryTurtle = withRdfPrefix(
      await readMeshAliceBioBranchFile(
        "05-alice-knop-created-woven",
        "_mesh/_inventory/inventory.ttl",
      ),
    )
      .replace(
        "<alice/_knop> a sflo:Knop ;",
        "<alice/_knop> rdf:type sflo:Knop ;",
      )
      .replace(
        /(<_mesh\/_inventory\/_history\d+\/_s\d+\/ttl>) a sflo:ArtifactManifestation, sflo:RdfDocument ;/,
        "$1 rdf:type sflo:RdfDocument, sflo:ArtifactManifestation ;",
      );

    const plan = planIntegrate({
      designatorPath: "alice/bio",
      workingLocalRelativePath: "alice-bio.ttl",
      meshBase: "https://semantic-flow.github.io/mesh-alice-bio/",
      currentMeshInventoryTurtle,
    });

    assertEquals(
      await compareRdfContent({
        left: encode(plan.updatedFiles[0]?.contents ?? ""),
        right: encode(
          await readMeshAliceBioBranchFile(
            "06-alice-bio-integrated",
            "_mesh/_inventory/inventory.ttl",
          ),
        ),
        path: "_mesh/_inventory/inventory.ttl",
      }),
      true,
    );
  },
);

Deno.test("planIntegrate accepts a carried mesh inventory with a root Knop", async () => {
  const plan = planIntegrate({
    designatorPath: "examples/gunaar",
    workingLocalRelativePath: "../examples/gunaar.ttl",
    meshBase: "https://semantic-flow.github.io/mesh-sidecar-fantasy-rules/",
    currentMeshInventoryTurtle: await readMeshSidecarFantasyRulesBranchFile(
      "10-root-knop",
      "docs/_mesh/_inventory/inventory.ttl",
    ),
  });

  assertEquals(
    plan.createdFiles.map((file) => file.path),
    [
      "examples/gunaar/_knop/_meta/meta.ttl",
      "examples/gunaar/_knop/_inventory/inventory.ttl",
    ],
  );
  assertEquals(
    plan.updatedFiles[0]?.contents.includes(
      "<_mesh> sflo:hasKnop <examples/gunaar/_knop> .",
    ),
    true,
  );
  assertEquals(
    plan.updatedFiles[0]?.contents.includes(
      'sflo:workingLocalRelativePath "../examples/gunaar.ttl" .',
    ),
    true,
  );
});

function encode(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

function withRdfPrefix(turtle: string): string {
  return turtle.replace(
    "@prefix sflo: <https://semantic-flow.github.io/sflo/ontology/> .\n",
    "@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .\n@prefix sflo: <https://semantic-flow.github.io/sflo/ontology/> .\n",
  );
}
