import { assertEquals } from "@std/assert";
import type { ResourcePageModel } from "../../core/weave/resource_page_models.ts";
import { ownerDesignatorPathForPage } from "./page_generation.ts";

Deno.test("ownerDesignatorPathForPage prefers threaded owner for simple pages", () => {
  const page: ResourcePageModel = {
    kind: "simple",
    path: "alice/_history001/_s0001/index.html",
    ownerDesignatorPath: "alice/data",
    description: "Historical state page",
  };

  assertEquals(ownerDesignatorPathForPage(page), "alice/data");
});

Deno.test("ownerDesignatorPathForPage keeps mesh pages in mesh scope", () => {
  const page: ResourcePageModel = {
    kind: "simple",
    path: "_mesh/_inventory/index.html",
    ownerDesignatorPath: "alice",
    description: "Mesh inventory page",
  };

  assertEquals(ownerDesignatorPathForPage(page), undefined);
});

Deno.test("ownerDesignatorPathForPage uses model designator for designator-backed pages", () => {
  const page: ResourcePageModel = {
    kind: "knop",
    path: "alice/_knop/index.html",
    designatorPath: "alice",
    governedArtifacts: [],
    supportingArtifacts: [],
  };

  assertEquals(ownerDesignatorPathForPage(page), "alice");
});
