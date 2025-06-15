import { log } from "@/core/utils/logging.ts";
import {
  WeaveError,
  GitError,
  ConfigError,
  FileSystemError,
  NetworkError,
  ValidationError,
} from "@/core/errors.ts";

export function handleCaughtError(e: unknown, customMessage?: string): void {
  // Format error message with context if provided
  const formatErrorMsg = (errorType: string, msg: string) => {
    if (customMessage) {
      return `${customMessage} ${errorType}: ${msg}`;
    }
    return `${errorType}: ${msg}`;
  };

  // Log detailed error information
  const logDetailedError = (error: Error, type = "Error") => {
    log.error(formatErrorMsg(type, error.message));
    
    // Log stack trace if available
    if (error.stack) {
      log.debug("Stack trace:", error.stack);
    }
    
    // Log cause if available
    if (error.cause) {
      log.debug("Caused by:", Deno.inspect(error.cause, { colors: true }));
    }
    
    // Log additional error details
    log.debug("Error details:", Deno.inspect(error, { colors: true }));
  };

  if (e instanceof WeaveError) {
    // Handle specific error types with appropriate logging/recovery
    if (e instanceof GitError) {
      logDetailedError(e, "Git operation failed");
      if (e.command) {
        log.debug("Failed command:", e.command);
      }
    } else if (e instanceof ConfigError) {
      logDetailedError(e, "Configuration error");
    } else if (e instanceof FileSystemError) {
      logDetailedError(e, "File system error");
      if (e.path) {
        log.debug("Path:", e.path);
      }
    } else if (e instanceof NetworkError) {
      logDetailedError(e, "Network error");
      if (e.url) {
        log.debug("URL:", e.url);
      }
    } else if (e instanceof ValidationError) {
      logDetailedError(e, "Validation error");
    } else {
      logDetailedError(e, "Weave error");
    }
  } else if (e instanceof Error) {
    logDetailedError(e);
  } else {
    log.error(customMessage ? `${customMessage} Unknown error occurred` : "An unknown error occurred");
    log.debug("Unknown error details:", Deno.inspect(e, { colors: true }));
  }
}
