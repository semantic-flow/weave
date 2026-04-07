import { assertEquals, assertThrows } from "@std/assert";
import {
  deriveMeshLabel,
  escapeHtml,
  toRelativeHref,
  toResourcePath,
} from "./html.ts";

class TestHtmlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TestHtmlError";
  }
}

Deno.test("toResourcePath trims the index page suffix", () => {
  assertEquals(toResourcePath("alice/index.html"), "alice");
});

Deno.test("toResourcePath throws Error by default for unsupported paths", () => {
  assertThrows(
    () => toResourcePath("alice.html"),
    Error,
    "Unsupported resource page path: alice.html",
  );
});

Deno.test("toResourcePath preserves a caller-provided error type", () => {
  assertThrows(
    () =>
      toResourcePath(
        "alice.html",
        (message) => new TestHtmlError(message),
      ),
    TestHtmlError,
    "Unsupported resource page path: alice.html",
  );
});

Deno.test("toRelativeHref works for page and resource-path callers", () => {
  assertEquals(
    toRelativeHref("alice/index.html", "alice-bio.ttl"),
    "../alice-bio.ttl",
  );
  assertEquals(
    toRelativeHref("bob/_knop/_references", "alice/bio"),
    "../../alice/bio",
  );
});

Deno.test("deriveMeshLabel uses the last mesh-base path segment", () => {
  assertEquals(
    deriveMeshLabel("https://semantic-flow.github.io/mesh-alice-bio/"),
    "mesh-alice-bio",
  );
  assertEquals(deriveMeshLabel("https://semantic-flow.github.io/"), "_mesh");
});

Deno.test("escapeHtml preserves the existing exact escape sequences", () => {
  assertEquals(
    escapeHtml(`&<>"'`),
    "&amp;&lt;&gt;&quot;&#39;",
  );
});
