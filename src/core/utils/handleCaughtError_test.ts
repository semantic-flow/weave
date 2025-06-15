import { assertEquals, assertStringIncludes } from "@/deps/assert.ts";
import { handleCaughtError } from "@/core/utils/handleCaughtError.ts";
import { GitError, NetworkError, WeaveError, ConfigError, FileSystemError, ValidationError } from "@/core/errors.ts";
import { log } from "@/core/utils/logging.ts";

function mockLogging() {
  const messages: string[] = [];
  const originalError = log.error;
  const originalDebug = log.debug;

  // Mock logging functions with correct Deno logger types
  log.error = ((msg: string | (() => string), ...args: unknown[]) => {
    const message = typeof msg === "function" ? msg() : msg;
    messages.push(message);
    if (args.length > 0) {
      messages.push(...args.map(arg => String(arg)));
    }
  }) as typeof log.error;

  log.debug = ((msg: string | (() => string), ...args: unknown[]) => {
    const message = typeof msg === "function" ? msg() : msg;
    messages.push(message);
    if (args.length > 0) {
      messages.push(...args.map(arg => String(arg)));
    }
  }) as typeof log.debug;

  return {
    messages,
    restore: () => {
      log.error = originalError;
      log.debug = originalDebug;
    }
  };
}

Deno.test("handleCaughtError - handles GitError with command", () => {
  const { messages, restore } = mockLogging();

  try {
    const error = new GitError("Failed to pull", "git pull");
    error.stack = "Error: Failed to pull\n    at test.ts:1:1";
    handleCaughtError(error, "Custom message");

    assertEquals(messages[0], "Custom message Git operation failed: Failed to pull");
    assertEquals(messages[1], "Stack trace:");
    assertStringIncludes(messages[2], "Error: Failed to pull");
    assertEquals(messages[3], "Error details:");
    assertStringIncludes(messages[4], "git pull");
  } finally {
    restore();
  }
});

Deno.test("handleCaughtError - handles NetworkError with URL", () => {
  const { messages, restore } = mockLogging();

  try {
    const error = new NetworkError("Failed to fetch", "https://api.example.com");
    handleCaughtError(error);

    assertEquals(messages[0], "Network error: Failed to fetch");
    assertEquals(messages[3], "Error details:");
    assertStringIncludes(messages[4], "https://api.example.com");
  } finally {
    restore();
  }
});

Deno.test("handleCaughtError - handles error with cause", () => {
  const { messages, restore } = mockLogging();

  try {
    const cause = new Error("Original error");
    const error = new WeaveError("Wrapped error");
    error.cause = cause;
    handleCaughtError(error);

    assertEquals(messages[0], "Weave error: Wrapped error");
    assertStringIncludes(messages[1], "Stack trace:");
    assertStringIncludes(messages[2], "WeaveError: Wrapped error");
    assertEquals(messages[3], "Caused by:");
    assertStringIncludes(messages[4], "Original error");
    assertEquals(messages[5], "Error details:");
  } finally {
    restore();
  }
});

Deno.test("handleCaughtError - handles unknown error", () => {
  const { messages, restore } = mockLogging();

  try {
    handleCaughtError("Something went wrong");

    assertEquals(messages[0], "An unknown error occurred");
    assertStringIncludes(messages[1], "Unknown error details:");
    assertStringIncludes(messages[2], "Something went wrong");
  } finally {
    restore();
  }
});

Deno.test("handleCaughtError - handles ConfigError", () => {
  const { messages, restore } = mockLogging();

  try {
    const error = new ConfigError("Invalid configuration format");
    error.stack = "Error: Invalid configuration format\n    at test.ts:1:1";
    handleCaughtError(error, "Config validation:");

    assertEquals(messages[0], "Config validation: Configuration error: Invalid configuration format");
    assertEquals(messages[1], "Stack trace:");
    assertStringIncludes(messages[2], "Error: Invalid configuration format");
  } finally {
    restore();
  }
});

Deno.test("handleCaughtError - handles FileSystemError with path", () => {
  const { messages, restore } = mockLogging();

  try {
    const error = new FileSystemError("Permission denied", "/path/to/file");
    error.stack = "Error: Permission denied\n    at test.ts:1:1";
    handleCaughtError(error);

    assertEquals(messages[0], "File system error: Permission denied");
    assertEquals(messages[1], "Stack trace:");
    assertStringIncludes(messages[2], "Error: Permission denied");
    assertEquals(messages[3], "Error details:");
    assertStringIncludes(messages[4], "/path/to/file");
  } finally {
    restore();
  }
});

Deno.test("handleCaughtError - handles ValidationError", () => {
  const { messages, restore } = mockLogging();

  try {
    const error = new ValidationError("Invalid state transition");
    error.stack = "Error: Invalid state transition\n    at test.ts:1:1";
    handleCaughtError(error, "State error:");

    assertEquals(messages[0], "State error: Validation error: Invalid state transition");
    assertEquals(messages[1], "Stack trace:");
    assertStringIncludes(messages[2], "Error: Invalid state transition");
  } finally {
    restore();
  }
});

Deno.test("handleCaughtError - handles null/undefined", () => {
  const { messages, restore } = mockLogging();

  try {
    handleCaughtError(null);
    handleCaughtError(undefined);

    assertEquals(messages[0], "An unknown error occurred");
    assertStringIncludes(messages[1], "Unknown error details:");
    assertStringIncludes(messages[2], "null");
    assertEquals(messages[3], "An unknown error occurred");
    assertStringIncludes(messages[4], "Unknown error details:");
    assertStringIncludes(messages[5], "undefined");
  } finally {
    restore();
  }
});

Deno.test("handleCaughtError - handles Error instance with custom message", () => {
  const { messages, restore } = mockLogging();

  try {
    const error = new Error("Test error message");
    error.stack = "Error: Test error message\n    at test.ts:1:1";
    handleCaughtError(error, "Custom prefix:");

    assertEquals(messages[0], "Custom prefix: Error: Test error message");
    assertEquals(messages[1], "Stack trace:");
    assertStringIncludes(messages[2], "Error: Test error message");
  } finally {
    restore();
  }
});
