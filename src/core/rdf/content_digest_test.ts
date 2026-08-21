import { assertEquals } from "@std/assert";
import { isCanonicalContentDigest } from "./content_digest.ts";

Deno.test("isCanonicalContentDigest accepts only the release SHA-256 wire form", () => {
  assertEquals(
    isCanonicalContentDigest(
      "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    ),
    true,
  );

  for (
    const invalid of [
      "sha256:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
      "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "sha512:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "md5:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      " sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    ]
  ) {
    assertEquals(isCanonicalContentDigest(invalid), false, invalid);
  }
});
