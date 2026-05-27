import { assertEquals } from "@std/assert";
import {
  analyticsUploadOptions,
  coverageTestArgs,
} from "../../scripts/run-codecov-test-analytics.ts";

Deno.test("analyticsUploadOptions defaults the report outside the workspace", async () => {
  await withEnv(
    {
      CODECOV_TEST_RESULTS_FLAGS: undefined,
      CODECOV_TEST_RESULTS_NAME: undefined,
    },
    () => {
      assertEquals(analyticsUploadOptions([]), {
        root: Deno.cwd(),
        reportPath: "/tmp/semantic-flow-coverage/junit.xml",
        flags: ["deno", "local"],
        name: "local-test-results",
      });
    },
  );
});

Deno.test("analyticsUploadOptions preserves an explicit report path", async () => {
  await withEnv(
    {
      CODECOV_TEST_RESULTS_FLAGS: undefined,
      CODECOV_TEST_RESULTS_NAME: undefined,
    },
    () => {
      assertEquals(analyticsUploadOptions(["--report", "custom/junit.xml"]), {
        root: Deno.cwd(),
        reportPath: "custom/junit.xml",
        flags: ["deno", "local"],
        name: "local-test-results",
      });
    },
  );
});

Deno.test("coverageTestArgs writes raw coverage and JUnit XML under /tmp", async () => {
  await withEnv(
    {
      CODECOV_TEST_RESULTS_FLAGS: undefined,
      CODECOV_TEST_RESULTS_NAME: undefined,
    },
    () => {
      assertEquals(coverageTestArgs(analyticsUploadOptions([])), [
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
