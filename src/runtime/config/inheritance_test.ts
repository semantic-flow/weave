import { assertEquals, assertThrows } from "@std/assert";
import {
  ConfigInheritanceError,
  resolveKnopInheritedConfigSources,
} from "./inheritance.ts";

Deno.test("resolveKnopInheritedConfigSources propagates ancestor offers by default", () => {
  assertEquals(
    resolveKnopInheritedConfigSources([
      {
        scopeKey: "alice",
        inheritableSources: ["alice-defaults"],
      },
      {
        scopeKey: "alice/bio",
        inheritableSources: ["bio-defaults"],
      },
      {
        scopeKey: "alice/bio/summary",
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
        offeredByScopeKey: "alice/bio",
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
        scopeKey: "alice/bio",
        inboundPolicy: "acceptDoNotPropagate",
        inheritableSources: ["bio-defaults"],
      },
      {
        scopeKey: "alice/bio/summary",
      },
    ]),
    [
      {
        source: "bio-defaults",
        offeredByScopeKey: "alice/bio",
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
        scopeKey: "alice/bio",
        inboundPolicy: "blockInherited",
        inheritableSources: ["bio-defaults"],
      },
      {
        scopeKey: "alice/bio/summary",
      },
    ]),
    [
      {
        source: "bio-defaults",
        offeredByScopeKey: "alice/bio",
        projection: "ancestorInherited",
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
});
