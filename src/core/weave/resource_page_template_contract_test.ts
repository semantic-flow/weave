import { assertEquals } from "@std/assert";
import type { ResourcePageDocumentModel } from "./resource_page_models.ts";
import type {
  ResourcePageTemplateRenderRequest,
  ResourcePageTemplateRenderResult,
} from "./resource_page_template_contract.ts";

const document: ResourcePageDocumentModel = {
  kind: "identifier",
  meshLabel: "Example Mesh",
  meshBase: "https://example.test/mesh/",
  meshRootHref: "/",
  pagePath: "people/alice/",
  resourcePath: "people/alice",
  displayResourcePath: "people/alice",
  canonical: "https://example.test/mesh/people/alice",
  generatedAtIso: "2026-05-03T00:00:00.000Z",
  generatedAtDisplay: "2026-05-03 00:00:00 UTC",
  title: "Alice",
  rdfClasses: [],
  breadcrumbs: [],
  metadata: [],
  panels: [
    {
      kind: "children",
      groups: [
        {
          label: "Identifiers",
          identifiers: [{ label: "Alice Bio", path: "people/alice/data" }],
        },
      ],
    },
  ],
};

Deno.test(
  "ResourcePage template requests pass resolved document and template identity only",
  () => {
    const request = {
      document,
      template: {
        iri:
          "https://semantic-flow.github.io/weave/defaults/resource-page-template/semantic-site/outer",
        role: "outer",
      },
    } satisfies ResourcePageTemplateRenderRequest;

    assertEquals(Object.keys(request).sort(), ["document", "template"]);
    assertEquals(request.document.panels[0]?.kind, "children");
    assertEquals(request.template.role, "outer");
  },
);

Deno.test("ResourcePage templates may return page HTML or named fragments", () => {
  const results: readonly ResourcePageTemplateRenderResult[] = [
    {
      kind: "pageHtml",
      html: "<!doctype html><html><body><main>Alice</main></body></html>",
    },
    {
      kind: "fragments",
      fragments: [
        { slot: "head", html: '<link rel="stylesheet" href="style.css">' },
        { slot: "body", html: "<main>Alice</main>" },
        { slot: "footer", html: "<footer>Generated</footer>" },
      ],
    },
  ];

  assertEquals(results.map((result) => result.kind), [
    "pageHtml",
    "fragments",
  ]);
  assertEquals(
    results[1]?.kind === "fragments" ? results[1].fragments[1]?.slot : "",
    "body",
  );
});
