import { assertEquals } from "@std/assert";
import { parseIso8601Instant } from "./generated_at.ts";

Deno.test("parseIso8601Instant validates leap-year calendar dates", () => {
  assertEquals(
    parseIso8601Instant("2024-02-29T00:00:00Z")?.toISOString(),
    "2024-02-29T00:00:00.000Z",
  );
  assertEquals(parseIso8601Instant("2026-02-29T00:00:00Z"), undefined);
  assertEquals(
    parseIso8601Instant("2000-02-29T00:00:00Z")?.toISOString(),
    "2000-02-29T00:00:00.000Z",
  );
  assertEquals(parseIso8601Instant("1900-02-29T00:00:00Z"), undefined);
});

Deno.test("parseIso8601Instant applies positive and negative offsets", () => {
  assertEquals(
    parseIso8601Instant("2026-07-06T15:04:05+02:30")?.toISOString(),
    "2026-07-06T12:34:05.000Z",
  );
  assertEquals(
    parseIso8601Instant("2026-07-06T08:34:56-04:00")?.toISOString(),
    "2026-07-06T12:34:56.000Z",
  );
  assertEquals(
    parseIso8601Instant("2026-07-06T23:59:59+23:59")?.toISOString(),
    "2026-07-06T00:00:59.000Z",
  );
  assertEquals(
    parseIso8601Instant("2026-07-06T00:00:00-23:59")?.toISOString(),
    "2026-07-06T23:59:00.000Z",
  );
});

Deno.test("parseIso8601Instant enforces boundary hour minute and second values", () => {
  assertEquals(
    parseIso8601Instant("2026-07-06T00:00:00Z")?.toISOString(),
    "2026-07-06T00:00:00.000Z",
  );
  assertEquals(
    parseIso8601Instant("2026-07-06T23:59:59Z")?.toISOString(),
    "2026-07-06T23:59:59.000Z",
  );
  assertEquals(parseIso8601Instant("2026-07-06T24:00:00Z"), undefined);
  assertEquals(parseIso8601Instant("2026-07-06T23:60:00Z"), undefined);
  assertEquals(parseIso8601Instant("2026-07-06T23:59:60Z"), undefined);
  assertEquals(parseIso8601Instant("2026-07-06T23:59:59+24:00"), undefined);
  assertEquals(parseIso8601Instant("2026-07-06T23:59:59+23:60"), undefined);
});

Deno.test("parseIso8601Instant parses millisecond fractions deterministically", () => {
  assertEquals(
    parseIso8601Instant("2026-07-06T12:34:56.1Z")?.toISOString(),
    "2026-07-06T12:34:56.100Z",
  );
  assertEquals(
    parseIso8601Instant("2026-07-06T12:34:56.12Z")?.toISOString(),
    "2026-07-06T12:34:56.120Z",
  );
  assertEquals(
    parseIso8601Instant("2026-07-06T12:34:56.123Z")?.toISOString(),
    "2026-07-06T12:34:56.123Z",
  );
  assertEquals(parseIso8601Instant("2026-07-06T12:34:56.1234Z"), undefined);
});

Deno.test("parseIso8601Instant requires an explicit UTC offset", () => {
  assertEquals(parseIso8601Instant("2026-07-06T12:34:56"), undefined);
});
