import { assertEquals } from "@std/assert";
import type {
  ArtifactRole,
  ResourcePageGenerationPolicy,
} from "../config/effective_config.ts";
import { listGeneratedResourcePagePaths } from "./resource_page_policy.ts";

const MESH_BASE = "https://semantic-flow.github.io/mesh-test/";

Deno.test("listGeneratedResourcePagePaths keeps generated artifact pages", () => {
  assertEquals(
    listGeneratedResourcePagePaths({
      meshBase: MESH_BASE,
      inventoryTurtle: PAGE_POLICY_TURTLE,
      parseErrorMessage: "Could not parse test inventory.",
      config: policyConfig(),
    }),
    [
      "alice/data/_history001/_s0001/index.html",
      "alice/data/_history001/_s0001/ttl/index.html",
      "alice/data/_history001/index.html",
      "alice/data/_knop/_inventory/index.html",
      "alice/data/_knop/index.html",
      "alice/data/index.html",
    ],
  );
});

Deno.test("listGeneratedResourcePagePaths suppresses pages owned by suppressed artifact roles", () => {
  assertEquals(
    listGeneratedResourcePagePaths({
      meshBase: MESH_BASE,
      inventoryTurtle: PAGE_POLICY_TURTLE,
      parseErrorMessage: "Could not parse test inventory.",
      config: policyConfig({ payload: "suppress" }),
    }),
    [
      "alice/data/_knop/_inventory/index.html",
      "alice/data/_knop/index.html",
    ],
  );
});

Deno.test("listGeneratedResourcePagePaths lets exact artifact policy override role policy", () => {
  assertEquals(
    listGeneratedResourcePagePaths({
      meshBase: MESH_BASE,
      inventoryTurtle: PAGE_POLICY_TURTLE,
      parseErrorMessage: "Could not parse test inventory.",
      config: policyConfig(
        { payload: "generate" },
        { [`${MESH_BASE}alice/data`]: "suppress" },
      ),
    }),
    [
      "alice/data/_knop/_inventory/index.html",
      "alice/data/_knop/index.html",
    ],
  );
});

Deno.test("listGeneratedResourcePagePaths materializes on-request pages only for explicit requests", () => {
  const config = policyConfig({ payload: "onRequest" });

  assertEquals(
    listGeneratedResourcePagePaths({
      meshBase: MESH_BASE,
      inventoryTurtle: PAGE_POLICY_TURTLE,
      parseErrorMessage: "Could not parse test inventory.",
      config,
    }),
    [
      "alice/data/_knop/_inventory/index.html",
      "alice/data/_knop/index.html",
    ],
  );
  assertEquals(
    listGeneratedResourcePagePaths({
      meshBase: MESH_BASE,
      inventoryTurtle: PAGE_POLICY_TURTLE,
      parseErrorMessage: "Could not parse test inventory.",
      config,
      explicitRequest: true,
    }),
    [
      "alice/data/_history001/_s0001/index.html",
      "alice/data/_history001/_s0001/ttl/index.html",
      "alice/data/_history001/index.html",
      "alice/data/_knop/_inventory/index.html",
      "alice/data/_knop/index.html",
      "alice/data/index.html",
    ],
  );
});

Deno.test("listGeneratedResourcePagePaths does not infer ownership from mutable current pointers", () => {
  assertEquals(
    listGeneratedResourcePagePaths({
      meshBase: MESH_BASE,
      inventoryTurtle: MUTABLE_POINTER_ONLY_TURTLE,
      parseErrorMessage: "Could not parse test inventory.",
      config: policyConfig({ payload: "suppress" }),
    }),
    [
      "alice/data/_history001/_s0001/index.html",
      "alice/data/_history001/_s0001/ttl/index.html",
      "alice/data/_history001/index.html",
      "alice/data/_knop/_inventory/index.html",
      "alice/data/_knop/index.html",
    ],
  );
});

function policyConfig(
  policies: Partial<Record<ArtifactRole, ResourcePageGenerationPolicy>> = {},
  exactPolicies: Partial<Record<string, ResourcePageGenerationPolicy>> = {},
) {
  return {
    resourcePageGenerationPolicyForArtifactTarget(target: {
      artifactIri: string;
      artifactRole: ArtifactRole;
    }): ResourcePageGenerationPolicy {
      return exactPolicies[target.artifactIri] ??
        policies[target.artifactRole] ?? "generate";
    },
    resourcePageGenerationPolicyForArtifactRole(
      role: ArtifactRole,
    ): ResourcePageGenerationPolicy {
      return policies[role] ?? "generate";
    },
  };
}

const PAGE_POLICY_TURTLE = `@base <${MESH_BASE}> .
@prefix sflo: <https://semantic-flow.github.io/sflo/ontology/> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

<alice/data> a sflo:PayloadArtifact, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasArtifactHistory <alice/data/_history001> ;
  sflo:currentArtifactHistory <alice/data/_history001> ;
  sflo:hasResourcePage <alice/data/index.html> .

<alice/data/_history001> a sflo:ArtifactHistory ;
  sflo:hasHistoricalState <alice/data/_history001/_s0001> ;
  sflo:latestHistoricalState <alice/data/_history001/_s0001> ;
  sflo:hasResourcePage <alice/data/_history001/index.html> .

<alice/data/_history001/_s0001> a sflo:HistoricalState ;
  sflo:hasManifestation <alice/data/_history001/_s0001/ttl> ;
  sflo:hasResourcePage <alice/data/_history001/_s0001/index.html> .

<alice/data/_history001/_s0001/ttl> a sflo:ArtifactManifestation ;
  sflo:hasResourcePage <alice/data/_history001/_s0001/ttl/index.html> .

<alice/data/_knop> a sflo:Knop ;
  sflo:hasResourcePage <alice/data/_knop/index.html> .

<alice/data/_knop/_inventory> a sflo:KnopInventory, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasResourcePage <alice/data/_knop/_inventory/index.html> .
`;

const MUTABLE_POINTER_ONLY_TURTLE = `@base <${MESH_BASE}> .
@prefix sflo: <https://semantic-flow.github.io/sflo/ontology/> .

<alice/data> a sflo:PayloadArtifact, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:currentArtifactHistory <alice/data/_history001> ;
  sflo:hasResourcePage <alice/data/index.html> .

<alice/data/_history001> a sflo:ArtifactHistory ;
  sflo:latestHistoricalState <alice/data/_history001/_s0001> ;
  sflo:hasResourcePage <alice/data/_history001/index.html> .

<alice/data/_history001/_s0001> a sflo:HistoricalState ;
  sflo:hasManifestation <alice/data/_history001/_s0001/ttl> ;
  sflo:hasResourcePage <alice/data/_history001/_s0001/index.html> .

<alice/data/_history001/_s0001/ttl> a sflo:ArtifactManifestation ;
  sflo:hasResourcePage <alice/data/_history001/_s0001/ttl/index.html> .

<alice/data/_knop> a sflo:Knop ;
  sflo:hasResourcePage <alice/data/_knop/index.html> .

<alice/data/_knop/_inventory> a sflo:KnopInventory, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasResourcePage <alice/data/_knop/_inventory/index.html> .
`;
