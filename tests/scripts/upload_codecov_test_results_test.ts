import { assertEquals, assertRejects, assertThrows } from "@std/assert";
import {
  parseUploadCodecovTestResultsArgs,
  resolveCodecovToken,
  uploadCodecovTestResults,
} from "../../scripts/upload-codecov-test-results.ts";

Deno.test("parseUploadCodecovTestResultsArgs accepts report, flag, name, and root overrides", async () => {
  await withEnv(
    {
      CODECOV_TEST_RESULTS_FLAGS: undefined,
      CODECOV_TEST_RESULTS_NAME: undefined,
    },
    () => {
      assertEquals(
        parseUploadCodecovTestResultsArgs([
          "--root",
          "/tmp/weave",
          "--report",
          "tmp/results.xml",
          "--flag",
          "deno",
          "--flag=manual",
          "--name",
          "manual-results",
        ]),
        {
          root: "/tmp/weave",
          reportPath: "tmp/results.xml",
          flags: ["deno", "manual"],
          name: "manual-results",
        },
      );
    },
  );
});

Deno.test("parseUploadCodecovTestResultsArgs uses local defaults and env overrides", async () => {
  await withEnv(
    {
      CODECOV_TEST_RESULTS_FLAGS: "local,linux",
      CODECOV_TEST_RESULTS_NAME: "dev-results",
    },
    () => {
      assertEquals(parseUploadCodecovTestResultsArgs([]), {
        root: Deno.cwd(),
        reportPath: "/tmp/semantic-flow-coverage/junit.xml",
        flags: ["local", "linux"],
        name: "dev-results",
      });
    },
  );
});

Deno.test("parseUploadCodecovTestResultsArgs rejects unsupported arguments", async () => {
  await withEnv(
    {
      CODECOV_TEST_RESULTS_FLAGS: undefined,
      CODECOV_TEST_RESULTS_NAME: undefined,
    },
    () => {
      assertThrows(
        () => parseUploadCodecovTestResultsArgs(["--unknown"]),
        Error,
        "Unsupported codecov:test-results argument",
      );
    },
  );
});

Deno.test("resolveCodecovToken prefers the Semantic Flow org token", async () => {
  await withEnv(
    {
      CODECOV_TOKEN_SEMANTIC_FLOW: "semantic-flow-token",
      CODECOV_TOKEN: "generic-token",
    },
    () => {
      assertEquals(resolveCodecovToken(), "semantic-flow-token");
    },
  );
});

Deno.test("uploadCodecovTestResults requires a token before local upload", async () => {
  await withEnv(
    { CODECOV_TOKEN_SEMANTIC_FLOW: undefined, CODECOV_TOKEN: undefined },
    async () => {
      await assertRejects(
        () =>
          uploadCodecovTestResults({
            root: Deno.cwd(),
            reportPath: "coverage/junit.xml",
            flags: ["local"],
            name: "local-results",
          }),
        Error,
        "CODECOV_TOKEN_SEMANTIC_FLOW or CODECOV_TOKEN must be set",
      );
    },
  );
});

async function withEnv<T>(
  env: Record<string, string | undefined>,
  callback: () => T | Promise<T>,
): Promise<T> {
  const previous = new Map<string, string | undefined>();
  for (const name of Object.keys(env)) {
    previous.set(name, Deno.env.get(name));
  }

  try {
    for (const [name, value] of Object.entries(env)) {
      if (value === undefined) {
        Deno.env.delete(name);
      } else {
        Deno.env.set(name, value);
      }
    }
    return await callback();
  } finally {
    for (const [name, value] of previous.entries()) {
      if (value === undefined) {
        Deno.env.delete(name);
      } else {
        Deno.env.set(name, value);
      }
    }
  }
}
