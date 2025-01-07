// src/core/utils/handleCaughtError_test.ts

import { assertSpyCalls, spy } from "../../../src/deps/testing.ts";
import { handleCaughtError } from "../../../src/core/utils/handleCaughtError.ts";
import {
  WeaveError,
  GitError,
  ConfigError,
  FileSystemError,
  NetworkError,
  ValidationError,
} from "../../../src/core/errors.ts";
import { log } from "../../../src/core/utils/logging.ts";

Deno.test({
  name: "handleCaughtError",
  async fn(t) {
    await t.step("handles GitError with command", () => {
      const errorSpy = spy(log, "error");
      const debugSpy = spy(log, "debug");
      
      const error = new GitError("Git failed", "git clone repo");
      error.stack = "mock stack trace";
      
      handleCaughtError(error, "Custom message");
      
      assertSpyCalls(errorSpy, 1);
      assertSpyCalls(debugSpy, 3); // Stack trace, command, error details
      
      errorSpy.restore();
      debugSpy.restore();
    });

    await t.step("handles ConfigError", () => {
      const errorSpy = spy(log, "error");
      const debugSpy = spy(log, "debug");
      
      const error = new ConfigError("Invalid config");
      error.stack = "mock stack trace";
      
      handleCaughtError(error);
      
      assertSpyCalls(errorSpy, 1);
      assertSpyCalls(debugSpy, 2); // Stack trace, error details
      
      errorSpy.restore();
      debugSpy.restore();
    });

    await t.step("handles FileSystemError with path", () => {
      const errorSpy = spy(log, "error");
      const debugSpy = spy(log, "debug");
      
      const error = new FileSystemError("File not found", "/path/to/file");
      error.stack = "mock stack trace";
      
      handleCaughtError(error);
      
      assertSpyCalls(errorSpy, 1);
      assertSpyCalls(debugSpy, 3); // Stack trace, path, error details
      
      errorSpy.restore();
      debugSpy.restore();
    });

    await t.step("handles NetworkError with URL", () => {
      const errorSpy = spy(log, "error");
      const debugSpy = spy(log, "debug");
      
      const error = new NetworkError("Connection failed", "https://example.com");
      error.stack = "mock stack trace";
      
      handleCaughtError(error);
      
      assertSpyCalls(errorSpy, 1);
      assertSpyCalls(debugSpy, 3); // Stack trace, URL, error details
      
      errorSpy.restore();
      debugSpy.restore();
    });

    await t.step("handles ValidationError", () => {
      const errorSpy = spy(log, "error");
      const debugSpy = spy(log, "debug");
      
      const error = new ValidationError("Invalid input");
      error.stack = "mock stack trace";
      
      handleCaughtError(error);
      
      assertSpyCalls(errorSpy, 1);
      assertSpyCalls(debugSpy, 2); // Stack trace, error details
      
      errorSpy.restore();
      debugSpy.restore();
    });

    await t.step("handles generic WeaveError", () => {
      const errorSpy = spy(log, "error");
      const debugSpy = spy(log, "debug");
      
      const error = new WeaveError("Generic error");
      error.stack = "mock stack trace";
      
      handleCaughtError(error);
      
      assertSpyCalls(errorSpy, 1);
      assertSpyCalls(debugSpy, 2); // Stack trace, error details
      
      errorSpy.restore();
      debugSpy.restore();
    });

    await t.step("handles Error with cause", () => {
      const errorSpy = spy(log, "error");
      const debugSpy = spy(log, "debug");
      
      const cause = new Error("Root cause");
      const error = new Error("Main error");
      error.cause = cause;
      error.stack = "mock stack trace";
      
      handleCaughtError(error);
      
      assertSpyCalls(errorSpy, 1);
      assertSpyCalls(debugSpy, 3); // Stack trace, cause, error details
      
      errorSpy.restore();
      debugSpy.restore();
    });

    await t.step("handles non-Error objects", () => {
      const errorSpy = spy(log, "error");
      const debugSpy = spy(log, "debug");
      
      const nonError = { message: "Not an error" };
      
      handleCaughtError(nonError);
      
      assertSpyCalls(errorSpy, 1);
      assertSpyCalls(debugSpy, 1); // Error details only
      
      errorSpy.restore();
      debugSpy.restore();
    });

    await t.step("handles string errors with custom prefix", () => {
      const errorSpy = spy(log, "error");
      const debugSpy = spy(log, "debug");
      
      const stringError = "String error message";
      
      handleCaughtError(stringError, "Custom prefix");
      
      assertSpyCalls(errorSpy, 1);
      assertSpyCalls(debugSpy, 1); // Error details only
      
      errorSpy.restore();
      debugSpy.restore();
    });

    await t.step("handles null/undefined errors", () => {
      const errorSpy = spy(log, "error");
      const debugSpy = spy(log, "debug");
      
      handleCaughtError(null);
      assertSpyCalls(errorSpy, 1);
      assertSpyCalls(debugSpy, 1);

      handleCaughtError(undefined);
      assertSpyCalls(errorSpy, 2);
      assertSpyCalls(debugSpy, 2);
      
      errorSpy.restore();
      debugSpy.restore();
    });
  },
  sanitizeResources: false,
  sanitizeOps: false,
});
