import { assertEquals } from "@std/assert";
import {
  isCanonicalContentDigest,
  sha256ContentDigest,
} from "./content_digest.ts";

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

Deno.test("sha256ContentDigest hashes exact bytes with the canonical qualifier", async () => {
  assertEquals(
    await sha256ContentDigest(new TextEncoder().encode("abc")),
    "sha256:ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
  );
});
