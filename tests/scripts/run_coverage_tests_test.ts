import { assertEquals, assertThrows } from "@std/assert";
import {
  coverageTestArgs,
  parseRunCoverageTestsArgs,
} from "../../scripts/run-coverage-tests.ts";

Deno.test("parseRunCoverageTestsArgs accepts root and Codecov JUnit overrides", () => {
  assertEquals(
    parseRunCoverageTestsArgs([
      "--root",
      "/tmp/weave",
      "--codecov-junit",
      "/tmp/custom-codecov.xml",
    ]),
    {
      root: "/tmp/weave",
      codecovJunitPath: "/tmp/custom-codecov.xml",
    },
  );
});

Deno.test("parseRunCoverageTestsArgs rejects unsupported arguments", () => {
  assertThrows(
    () => parseRunCoverageTestsArgs(["--unknown"]),
    Error,
    "Unsupported coverage test argument",
  );
});

Deno.test("parseRunCoverageTestsArgs treats -- as the end of options", () => {
  assertEquals(parseRunCoverageTestsArgs(["--root", "/tmp/weave", "--"]), {
    root: "/tmp/weave",
    codecovJunitPath: "/tmp/semantic-flow-coverage/codecov-junit.xml",
  });
  assertThrows(
    () => parseRunCoverageTestsArgs(["--", "--root", "/tmp/weave"]),
    Error,
    'coverage tests do not accept positional arguments: "--root", "/tmp/weave"',
  );
});

Deno.test("coverageTestArgs writes raw coverage and Deno JUnit XML under /tmp", () => {
  assertEquals(coverageTestArgs(), [
    "test",
    "--clean",
    "--preload=tests/support/test_tmp_harness.ts",
    "--allow-read",
    "--allow-write",
    "--allow-run=git,deno",
    "--allow-env",
    "--coverage=/tmp/semantic-flow-coverage",
    "--coverage-raw-data-only",
    "--junit-path=/tmp/semantic-flow-coverage/junit.xml",
    "src",
    "tests",
  ]);
});
