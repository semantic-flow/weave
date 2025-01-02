import { log } from "./logging.ts";
import {
  WeaveError,
  GitError,
  ConfigError,
  FileSystemError,
  NetworkError,
  ValidationError,
} from "../errors.ts";

export function handleCaughtError(e: unknown, customMessage?: string): void {
  // Format error message with context if provided
  const formatErrorMsg = (errorType: string, msg: string) => {
    if (customMessage) {
      return `${customMessage} ${errorType}: ${msg}`;
    }
    return `${errorType}: ${msg}`;
  };

  if (e instanceof WeaveError) {
    // Handle specific error types with appropriate logging/recovery
    if (e instanceof GitError) {
      log.error(formatErrorMsg("Git operation failed", e.message));
      if (e.command) {
        log.debug(`Failed command: ${e.command}`);
      }
    } else if (e instanceof ConfigError) {
      log.error(formatErrorMsg("Configuration error", e.message));
    } else if (e instanceof FileSystemError) {
      log.error(formatErrorMsg("File system error", e.message));
      if (e.path) {
        log.debug(`Path: ${e.path}`);
      }
    } else if (e instanceof NetworkError) {
      log.error(formatErrorMsg("Network error", e.message));
      if (e.url) {
        log.debug(`URL: ${e.url}`);
      }
    } else if (e instanceof ValidationError) {
      log.error(formatErrorMsg("Validation error", e.message));
    }
    log.debug(Deno.inspect(e, { colors: true }));
  } else if (e instanceof Error) {
    log.error(customMessage ? `${customMessage} Error: ${e.message}` : e.message);
    log.debug(Deno.inspect(e, { colors: true }));
  } else {
    log.error(customMessage ? `${customMessage} Unknown error occurred` : "An unknown error occurred");
    log.debug(Deno.inspect(e, { colors: true }));
  }
}
