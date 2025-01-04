// src/core/utils/handleCaughtError_test.ts

import { assertEquals } from "../../deps/assert.ts";
import { handleCaughtError } from "./handleCaughtError.ts";
import * as logger from "../../deps/log.ts";
import { log } from "./logging.ts";
import {
  GitError,
  ConfigError,
  FileSystemError,
  NetworkError,
  ValidationError,
} from "../errors.ts";

// Create a test logger handler to capture messages
class TestHandler extends logger.BaseHandler {
  public messages: string[] = [];

  override log(msg: string): void {
    this.messages.push(msg);
  }
}

// Setup test handler
const testHandler = new TestHandler("ERROR");
const originalHandlers = logger.getLogger().handlers;

Deno.test({
  name: "handleCaughtError - handles Error instance without custom message",
  fn: () => {
    // Setup
    testHandler.messages = [];
    logger.getLogger().handlers = [testHandler];

    const testError = new Error("Test error message");
    handleCaughtError(testError);

    assertEquals(testHandler.messages.length, 2); // One for error, one for debug
    assertEquals(testHandler.messages[0].includes("Test error message"), true);

    // Cleanup
    logger.getLogger().handlers = originalHandlers;
  },
});

Deno.test({
  name: "handleCaughtError - handles GitError with command",
  fn: () => {
    // Setup
    testHandler.messages = [];
    logger.getLogger().handlers = [testHandler];

    const testError = new GitError("Git clone failed", "git clone repo-url");
    handleCaughtError(testError);

    assertEquals(testHandler.messages.length, 2);
    assertEquals(testHandler.messages[0].includes("Git operation failed: Git clone failed"), true);
    assertEquals(testHandler.messages[1].includes("Failed command: git clone repo-url"), true);

    // Cleanup
    logger.getLogger().handlers = originalHandlers;
  },
});

Deno.test({
  name: "handleCaughtError - handles ConfigError",
  fn: () => {
    // Setup
    testHandler.messages = [];
    logger.getLogger().handlers = [testHandler];

    const testError = new ConfigError("Invalid configuration format");
    handleCaughtError(testError, "Config validation:");

    assertEquals(testHandler.messages.length, 2);
    assertEquals(
      testHandler.messages[0].includes("Config validation: Configuration error: Invalid configuration format"),
      true
    );

    // Cleanup
    logger.getLogger().handlers = originalHandlers;
  },
});

Deno.test({
  name: "handleCaughtError - handles FileSystemError with path",
  fn: () => {
    // Setup
    testHandler.messages = [];
    logger.getLogger().handlers = [testHandler];

    const testError = new FileSystemError("Permission denied", "/path/to/file");
    handleCaughtError(testError);

    assertEquals(testHandler.messages.length, 2);
    assertEquals(testHandler.messages[0].includes("File system error: Permission denied"), true);
    assertEquals(testHandler.messages[1].includes("Path: /path/to/file"), true);

    // Cleanup
    logger.getLogger().handlers = originalHandlers;
  },
});

Deno.test({
  name: "handleCaughtError - handles NetworkError with URL",
  fn: () => {
    // Setup
    testHandler.messages = [];
    logger.getLogger().handlers = [testHandler];

    const testError = new NetworkError("Failed to fetch", "https://api.example.com");
    handleCaughtError(testError);

    assertEquals(testHandler.messages.length, 2);
    assertEquals(testHandler.messages[0].includes("Network error: Failed to fetch"), true);
    assertEquals(testHandler.messages[1].includes("URL: https://api.example.com"), true);

    // Cleanup
    logger.getLogger().handlers = originalHandlers;
  },
});

Deno.test({
  name: "handleCaughtError - handles ValidationError",
  fn: () => {
    // Setup
    testHandler.messages = [];
    logger.getLogger().handlers = [testHandler];

    const testError = new ValidationError("Invalid state transition");
    handleCaughtError(testError, "State error:");

    assertEquals(testHandler.messages.length, 2);
    assertEquals(
      testHandler.messages[0].includes("State error: Validation error: Invalid state transition"),
      true
    );

    // Cleanup
    logger.getLogger().handlers = originalHandlers;
  },
});

Deno.test({
  name: "handleCaughtError - handles Error instance with custom message",
  fn: () => {
    // Setup
    testHandler.messages = [];
    logger.getLogger().handlers = [testHandler];

    const testError = new Error("Test error message");
    handleCaughtError(testError, "Custom prefix:");

    assertEquals(testHandler.messages.length, 2);
    assertEquals(
      testHandler.messages[0].includes("Custom prefix: Test error message"),
      true
    );

    // Cleanup
    logger.getLogger().handlers = originalHandlers;
  },
});

Deno.test({
  name: "handleCaughtError - handles GitError without command",
  fn: () => {
    // Setup
    testHandler.messages = [];
    logger.getLogger().handlers = [testHandler];

    const testError = new GitError("Git operation failed");
    handleCaughtError(testError);

    assertEquals(testHandler.messages.length, 1);
    assertEquals(testHandler.messages[0].includes("Git operation failed: Git operation failed"), true);

    // Cleanup
    logger.getLogger().handlers = originalHandlers;
  },
});

Deno.test({
  name: "handleCaughtError - handles FileSystemError without path",
  fn: () => {
    // Setup
    testHandler.messages = [];
    logger.getLogger().handlers = [testHandler];

    const testError = new FileSystemError("File system operation failed");
    handleCaughtError(testError);

    assertEquals(testHandler.messages.length, 1);
    assertEquals(testHandler.messages[0].includes("File system error: File system operation failed"), true);

    // Cleanup
    logger.getLogger().handlers = originalHandlers;
  },
});

Deno.test({
  name: "handleCaughtError - handles NetworkError without URL",
  fn: () => {
    // Setup
    testHandler.messages = [];
    logger.getLogger().handlers = [testHandler];

    const testError = new NetworkError("Network operation failed");
    handleCaughtError(testError);

    assertEquals(testHandler.messages.length, 1);
    assertEquals(testHandler.messages[0].includes("Network error: Network operation failed"), true);

    // Cleanup
    logger.getLogger().handlers = originalHandlers;
  },
});

Deno.test({
  name: "handleCaughtError - handles non-Error object",
  fn: () => {
    // Setup
    testHandler.messages = [];
    logger.getLogger().handlers = [testHandler];

    handleCaughtError({ someProperty: "not an error" });

    assertEquals(testHandler.messages.length, 1);
    assertEquals(
      testHandler.messages[0].includes("An unknown error occurred"),
      true
    );

    // Cleanup
    logger.getLogger().handlers = originalHandlers;
  },
});

Deno.test({
  name: "handleCaughtError - handles null/undefined",
  fn: () => {
    // Setup
    testHandler.messages = [];
    logger.getLogger().handlers = [testHandler];

    handleCaughtError(null);
    handleCaughtError(undefined);

    assertEquals(testHandler.messages.length, 2);
    assertEquals(
      testHandler.messages[0].includes("An unknown error occurred"),
      true
    );
    assertEquals(
      testHandler.messages[1].includes("An unknown error occurred"),
      true
    );

    // Cleanup
    logger.getLogger().handlers = originalHandlers;
  },
});

Deno.test({
  name: "handleCaughtError - handles custom error types",
  fn: () => {
    // Setup
    testHandler.messages = [];
    logger.getLogger().handlers = [testHandler];

    class CustomError extends Error {
      constructor(message: string) {
        super(message);
        this.name = "CustomError";
      }
    }

    const testError = new CustomError("Custom error message");
    handleCaughtError(testError, "Custom error occurred:");

    assertEquals(testHandler.messages.length, 2);
    assertEquals(
      testHandler.messages[0].includes("Custom error occurred: Custom error message"),
      true
    );

    // Cleanup
    logger.getLogger().handlers = originalHandlers;
  },
});
