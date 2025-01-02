/**
 * Base error class for all Weave errors. Provides a foundation for more specific error types.
 * Should not be thrown directly - use a more specific error type instead.
 */
export class WeaveError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WeaveError";
  }
}

/**
 * Configuration-related errors for issues with config file loading, parsing, and structure.
 * 
 * Use this error type when:
 * - Config file is missing or cannot be found
 * - Config file has invalid format or syntax
 * - Required config fields are missing
 * - Config file structure is invalid
 * 
 * Examples:
 * - "No configuration file found"
 * - "Failed to fetch config from URL"
 * - "Remote config must be in JSON format"
 * - "'inclusions' must be an array in the configuration file"
 */
export class ConfigError extends WeaveError {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

/**
 * Git operation errors for issues with Git commands and repository operations.
 * Includes the Git command that failed for better debugging context.
 * 
 * Use this error type when:
 * - Git commands fail to execute
 * - Repository operations fail (clone, fetch, push, etc.)
 * - Git configuration issues occur
 * 
 * Examples:
 * - "Failed to clone repository"
 * - "Cannot checkout branch: branch does not exist"
 * - "Failed to determine default branch"
 * 
 * @param command The Git command that failed, useful for debugging
 */
export class GitError extends WeaveError {
  constructor(message: string, public command?: string) {
    super(message);
    this.name = "GitError";
  }
}

/**
 * File system operation errors for issues with file/directory operations.
 * Includes the file path for better debugging context.
 * 
 * Use this error type when:
 * - File/directory access fails
 * - File/directory creation fails
 * - File/directory permissions issues occur
 * - File operations (read/write) fail
 * 
 * Examples:
 * - "Failed to create directory"
 * - "Cannot read file: permission denied"
 * - "Directory does not exist"
 * 
 * @param path The file system path where the error occurred
 */
export class FileSystemError extends WeaveError {
  constructor(message: string, public path?: string) {
    super(message);
    this.name = "FileSystemError";
  }
}

/**
 * Network-related errors for issues with web requests and remote resources.
 * Includes the URL for better debugging context.
 * 
 * Use this error type when:
 * - HTTP requests fail
 * - Network connectivity issues occur
 * - Remote resource access fails
 * 
 * Examples:
 * - "Failed to fetch remote resource"
 * - "Network request timeout"
 * - "Invalid response from server"
 * 
 * @param url The URL where the error occurred
 */
export class NetworkError extends WeaveError {
  constructor(message: string, public url?: string) {
    super(message);
    this.name = "NetworkError";
  }
}

/**
 * Validation errors for issues with business rules and state validation.
 * Used for logical/semantic validation rather than structural validation.
 * 
 * Use this error type when:
 * - Business rule violations occur
 * - State validation fails
 * - Semantic validation fails
 * - Runtime invariants are violated
 * 
 * Examples:
 * - "Frame has already been initialized"
 * - "Invalid state transition"
 * - "Operation not allowed in current state"
 */
export class ValidationError extends WeaveError {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}
