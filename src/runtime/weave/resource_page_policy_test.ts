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
      "alice/bio/_history001/_s0001/index.html",
      "alice/bio/_history001/_s0001/ttl/index.html",
      "alice/bio/_history001/index.html",
      "alice/bio/_knop/_inventory/index.html",
      "alice/bio/_knop/index.html",
      "alice/bio/index.html",
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
      "alice/bio/_knop/_inventory/index.html",
      "alice/bio/_knop/index.html",
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
      "alice/bio/_knop/_inventory/index.html",
      "alice/bio/_knop/index.html",
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
      "alice/bio/_history001/_s0001/index.html",
      "alice/bio/_history001/_s0001/ttl/index.html",
      "alice/bio/_history001/index.html",
      "alice/bio/_knop/_inventory/index.html",
      "alice/bio/_knop/index.html",
      "alice/bio/index.html",
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
      "alice/bio/_history001/_s0001/index.html",
      "alice/bio/_history001/_s0001/ttl/index.html",
      "alice/bio/_history001/index.html",
      "alice/bio/_knop/_inventory/index.html",
      "alice/bio/_knop/index.html",
    ],
  );
});

function policyConfig(
  policies: Partial<Record<ArtifactRole, ResourcePageGenerationPolicy>> = {},
) {
  return {
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

<alice/bio> a sflo:PayloadArtifact, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasArtifactHistory <alice/bio/_history001> ;
  sflo:currentArtifactHistory <alice/bio/_history001> ;
  sflo:hasResourcePage <alice/bio/index.html> .

<alice/bio/_history001> a sflo:ArtifactHistory ;
  sflo:hasHistoricalState <alice/bio/_history001/_s0001> ;
  sflo:latestHistoricalState <alice/bio/_history001/_s0001> ;
  sflo:hasResourcePage <alice/bio/_history001/index.html> .

<alice/bio/_history001/_s0001> a sflo:HistoricalState ;
  sflo:hasManifestation <alice/bio/_history001/_s0001/ttl> ;
  sflo:hasResourcePage <alice/bio/_history001/_s0001/index.html> .

<alice/bio/_history001/_s0001/ttl> a sflo:ArtifactManifestation ;
  sflo:hasResourcePage <alice/bio/_history001/_s0001/ttl/index.html> .

<alice/bio/_knop> a sflo:Knop ;
  sflo:hasResourcePage <alice/bio/_knop/index.html> .

<alice/bio/_knop/_inventory> a sflo:KnopInventory, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasResourcePage <alice/bio/_knop/_inventory/index.html> .
`;

const MUTABLE_POINTER_ONLY_TURTLE = `@base <${MESH_BASE}> .
@prefix sflo: <https://semantic-flow.github.io/sflo/ontology/> .

<alice/bio> a sflo:PayloadArtifact, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:currentArtifactHistory <alice/bio/_history001> ;
  sflo:hasResourcePage <alice/bio/index.html> .

<alice/bio/_history001> a sflo:ArtifactHistory ;
  sflo:latestHistoricalState <alice/bio/_history001/_s0001> ;
  sflo:hasResourcePage <alice/bio/_history001/index.html> .

<alice/bio/_history001/_s0001> a sflo:HistoricalState ;
  sflo:hasManifestation <alice/bio/_history001/_s0001/ttl> ;
  sflo:hasResourcePage <alice/bio/_history001/_s0001/index.html> .

<alice/bio/_history001/_s0001/ttl> a sflo:ArtifactManifestation ;
  sflo:hasResourcePage <alice/bio/_history001/_s0001/ttl/index.html> .

<alice/bio/_knop> a sflo:Knop ;
  sflo:hasResourcePage <alice/bio/_knop/index.html> .

<alice/bio/_knop/_inventory> a sflo:KnopInventory, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasResourcePage <alice/bio/_knop/_inventory/index.html> .
`;
