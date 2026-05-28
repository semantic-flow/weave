import { assertStringIncludes } from "@std/assert";
import { normalizeDenoJunitXml } from "../../scripts/normalize-deno-junit.ts";

Deno.test("normalizeDenoJunitXml adds Codecov-friendly suite metadata", () => {
  const normalized = normalizeDenoJunitXml(
    `<?xml version="1.0" encoding="UTF-8"?>
<testsuites name="deno test" tests="2" failures="0" errors="0" time="1.250">
  <testsuite name="./src/one_test.ts" tests="1" disabled="0" errors="0" failures="0">
    <testcase name="one &amp; two" classname="./src/one_test.ts" time="0.250" line="58" col="7">
    </testcase>
  </testsuite>
  <testsuite name="./src/two_test.ts" tests="1" disabled="0" errors="0" failures="0">
    <testcase name="three" classname="./src/two_test.ts" time="1.000" line="12" col="6">
    </testcase>
  </testsuite>
</testsuites>
`,
    { timestamp: "2026-05-27T00:00:00.000Z" },
  );

  assertStringIncludes(
    normalized,
    '<testsuites name="deno test" tests="2" failures="0" errors="0" skipped="0" time="1.250">',
  );
  assertStringIncludes(
    normalized,
    '<testsuite name="./src/one_test.ts" tests="1" failures="0" errors="0" skipped="0" timestamp="2026-05-27T00:00:00.000Z" time="0.250">',
  );
  assertStringIncludes(
    normalized,
    '<testsuite name="./src/two_test.ts" tests="1" failures="0" errors="0" skipped="0" timestamp="2026-05-27T00:00:00.000Z" time="1.000">',
  );
  assertStringIncludes(
    normalized,
    '<testcase classname="./src/one_test.ts" name="one &amp; two" time="0.250" line="58" col="7">',
  );
});
