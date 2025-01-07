// src/core/utils/logging_test.ts

import { setLogLevel } from "../../../src/core/utils/logging.ts";

Deno.test("setLogLevel handles invalid log levels", () => {
  // deno-lint-ignore no-explicit-any
  setLogLevel("INVALID" as any);
  // Test passes if no error is thrown
});
