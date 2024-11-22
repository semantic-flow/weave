// src/core/utils/logger.ts

export enum LogLevel {
  INFO = "INFO",
  WARN = "WARN",
  ERROR = "ERROR",
}

const COLOR_MAP: Record<LogLevel, string> = {
  [LogLevel.INFO]: "\x1b[32m",  // Green
  [LogLevel.WARN]: "\x1b[33m",  // Yellow
  [LogLevel.ERROR]: "\x1b[31m", // Red
};

const RESET_COLOR = "\x1b[0m";

/**
 * Current log level. Messages below this level will not be logged.
 */
let currentLogLevel: LogLevel = LogLevel.INFO;

/**
 * Sets the current log level.
 *
 * @param {LogLevel} level - The desired log level.
 */
export function setLogLevel(level: LogLevel): void {
  currentLogLevel = level;
}

/**
 * Determines if a message should be logged based on the current log level.
 *
 * @param {LogLevel} messageLevel - The level of the message.
 * @returns {boolean} - True if the message should be logged, false otherwise.
 */
function shouldLog(messageLevel: LogLevel): boolean {
  const levels = [LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR];
  return levels.indexOf(messageLevel) >= levels.indexOf(currentLogLevel);
}

/**
 * Logs a message with the specified log level and color.
 *
 * @param {string} message - The message to log.
 * @param {LogLevel} level - The log level.
 */
export function log(message: string, level: LogLevel = LogLevel.INFO): void {
  if (!shouldLog(level)) return;

  const timestamp = new Date().toISOString();
  const color = COLOR_MAP[level] || "";
  console.log(`${color}[${timestamp}] [${level}] ${message}${RESET_COLOR}`);
}

/**
 * Logs an informational message.
 *
 * @param {string} message - The message to log.
 */
export function info(message: string): void {
  log(message, LogLevel.INFO);
}

/**
 * Logs a warning message.
 *
 * @param {string} message - The message to log.
 */
export function warn(message: string): void {
  log(message, LogLevel.WARN);
}

/**
 * Logs an error message.
 *
 * @param {string} message - The message to log.
 */
export function error(message: string): void {
  log(message, LogLevel.ERROR);
}
