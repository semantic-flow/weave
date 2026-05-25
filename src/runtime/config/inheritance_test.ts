import { assertEquals, assertThrows } from "@std/assert";
import {
  ConfigInheritanceError,
  resolveKnopInheritedConfigSources,
} from "./inheritance.ts";

Deno.test("resolveKnopInheritedConfigSources includes mesh inheritable config before ancestor Knop offers", () => {
  assertEquals(
    resolveKnopInheritedConfigSources({
      meshInheritableSources: ["mesh-knop-defaults"],
      knopScopePath: [
        {
          scopeKey: "alice",
          inheritableSources: ["alice-defaults"],
        },
        {
          scopeKey: "alice/data",
        },
      ],
    }),
    [
      {
        source: "mesh-knop-defaults",
        offeredByScopeKey: "_mesh",
        projection: "meshInherited",
      },
      {
        source: "alice-defaults",
        offeredByScopeKey: "alice",
        projection: "ancestorInherited",
      },
    ],
  );
});

Deno.test("resolveKnopInheritedConfigSources propagates ancestor offers by default", () => {
  assertEquals(
    resolveKnopInheritedConfigSources([
      {
        scopeKey: "alice",
        inheritableSources: ["alice-defaults"],
      },
      {
        scopeKey: "alice/data",
        inheritableSources: ["bio-defaults"],
      },
      {
        scopeKey: "alice/data/summary",
      },
    ]),
    [
      {
        source: "alice-defaults",
        offeredByScopeKey: "alice",
        projection: "ancestorInherited",
      },
      {
        source: "bio-defaults",
        offeredByScopeKey: "alice/data",
        projection: "ancestorInherited",
      },
    ],
  );
});

Deno.test("resolveKnopInheritedConfigSources stops mesh inheritable config at acceptDoNotPropagate scopes", () => {
  assertEquals(
    resolveKnopInheritedConfigSources({
      meshInheritableSources: ["mesh-knop-defaults"],
      knopScopePath: [
        {
          scopeKey: "alice",
          inboundPolicy: "acceptDoNotPropagate",
          inheritableSources: ["alice-defaults"],
        },
        {
          scopeKey: "alice/data",
        },
      ],
    }),
    [
      {
        source: "alice-defaults",
        offeredByScopeKey: "alice",
        projection: "ancestorInherited",
      },
    ],
  );
});

Deno.test("resolveKnopInheritedConfigSources blocks mesh inheritable config at blockInherited scopes", () => {
  assertEquals(
    resolveKnopInheritedConfigSources({
      meshInheritableSources: ["mesh-knop-defaults"],
      knopScopePath: [
        {
          scopeKey: "alice",
          inboundPolicy: "blockInherited",
          inheritableSources: ["alice-defaults"],
        },
        {
          scopeKey: "alice/data",
        },
      ],
    }),
    [
      {
        source: "alice-defaults",
        offeredByScopeKey: "alice",
        projection: "ancestorInherited",
      },
    ],
  );
});

Deno.test("resolveKnopInheritedConfigSources stops inherited config at acceptDoNotPropagate scopes", () => {
  assertEquals(
    resolveKnopInheritedConfigSources([
      {
        scopeKey: "alice",
        inheritableSources: ["alice-defaults"],
      },
      {
        scopeKey: "alice/data",
        inboundPolicy: "acceptDoNotPropagate",
        inheritableSources: ["bio-defaults"],
      },
      {
        scopeKey: "alice/data/summary",
      },
    ]),
    [
      {
        source: "bio-defaults",
        offeredByScopeKey: "alice/data",
        projection: "ancestorInherited",
      },
    ],
  );
});

Deno.test("resolveKnopInheritedConfigSources blocks inherited config at blockInherited scopes", () => {
  assertEquals(
    resolveKnopInheritedConfigSources([
      {
        scopeKey: "alice",
        inheritableSources: ["alice-defaults"],
      },
      {
        scopeKey: "alice/data",
        inboundPolicy: "blockInherited",
        inheritableSources: ["bio-defaults"],
      },
      {
        scopeKey: "alice/data/summary",
      },
    ]),
    [
      {
        source: "bio-defaults",
        offeredByScopeKey: "alice/data",
        projection: "ancestorInherited",
      },
    ],
  );
});

Deno.test("resolveKnopInheritedConfigSources applies mesh inheritable config to the root Knop", () => {
  assertEquals(
    resolveKnopInheritedConfigSources({
      meshInheritableSources: ["mesh-knop-defaults"],
      knopScopePath: [
        {
          scopeKey: "",
        },
      ],
    }),
    [
      {
        source: "mesh-knop-defaults",
        offeredByScopeKey: "_mesh",
        projection: "meshInherited",
      },
    ],
  );
});

Deno.test("resolveKnopInheritedConfigSources keeps descendant-only offers off the authored scope", () => {
  assertEquals(
    resolveKnopInheritedConfigSources([
      {
        scopeKey: "alice",
        inheritableSources: ["alice-defaults"],
      },
    ]),
    [],
  );
});

Deno.test("resolveKnopInheritedConfigSources applies self-inclusive offers to the authored scope", () => {
  assertEquals(
    resolveKnopInheritedConfigSources([
      {
        scopeKey: "alice",
        offerPolicy: "offerSelfAndDescendants",
        inheritableSources: ["alice-defaults"],
      },
    ]),
    [
      {
        source: "alice-defaults",
        offeredByScopeKey: "alice",
        projection: "selfInclusiveOffer",
      },
    ],
  );
});

Deno.test("resolveKnopInheritedConfigSources rejects invalid scope paths", () => {
  assertThrows(
    () => resolveKnopInheritedConfigSources([]),
    ConfigInheritanceError,
    "empty scope path",
  );
  assertThrows(
    () =>
      resolveKnopInheritedConfigSources([
        { scopeKey: "alice" },
        { scopeKey: "alice" },
      ]),
    ConfigInheritanceError,
    "Duplicate config inheritance scope key",
  );
  assertThrows(
    () =>
      resolveKnopInheritedConfigSources({
        meshScopeKey: "alice",
        meshInheritableSources: ["mesh-knop-defaults"],
        knopScopePath: [{ scopeKey: "alice" }],
      }),
    ConfigInheritanceError,
    "Duplicate config inheritance scope key",
  );
  assertThrows(
    () =>
      resolveKnopInheritedConfigSources({
        meshScopeKey: "",
        meshInheritableSources: ["mesh-knop-defaults"],
        knopScopePath: [{ scopeKey: "alice" }],
      }),
    ConfigInheritanceError,
    "mesh scope key must not be empty",
  );
  assertThrows(
    () =>
      resolveKnopInheritedConfigSources([
        { scopeKey: "alice" },
        { scopeKey: "   " },
      ]),
    ConfigInheritanceError,
    "scope keys must not be blank",
  );
});
