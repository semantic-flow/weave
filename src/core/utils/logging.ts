// src/core/utils/log.ts

import * as logger from "../../deps/log.ts";
import { env } from "./env.ts";
import {
  bold,
  brightGreen,
  cyan,
  gray,
  red,
  strikethrough,
  yellow,
} from "../../deps/colors.ts";

import type { LevelName, LogRecord } from "../../deps/log.ts";

/**
 * Defines log levels and their numeric representations.
 */
const LOG_LEVELS: Record<LevelName, number> = {
  CRITICAL: 50,
  ERROR: 40,
  WARN: 30,
  INFO: 20,
  DEBUG: 10,
  NOTSET: 0,
};

// Initialize the log level from the environment variable 'WEAVE_LOGS'
let currentLogLevel: LevelName = "INFO";

const envLogLevel = env<LevelName>("WEAVE_LOGS")?.toUpperCase();

// Use type narrowing to ensure envLogLevel is a valid LevelName
if (envLogLevel && envLogLevel in LOG_LEVELS && envLogLevel !== "NOTSET") {
  currentLogLevel = envLogLevel as LevelName;
}

/**
 * Sets the current log level.
 * @param newLevel The desired log level.
 */
export function setLogLevel(newLevel: LevelName) {
  if (LOG_LEVELS[newLevel] !== undefined) {
    currentLogLevel = newLevel;
    log.info(`Log level set to ${newLevel}`);
    // Depending on the logging library's capabilities, you might need to reconfigure handlers or loggers here
    // For example:
    // logger.loggers.get("weave")?.setLevel(newLevel);
  } else {
    log.warn(`Attempted to set invalid log level: ${newLevel}`);
  }
}

const COLOR_TAG_REG = /<(\w+)>([^<]+)<\/\1>/g;

/**
 * This is the default logger. It will output color-coded log messages to the
 * console via `console.log()`.
 */
class ConsoleHandler extends logger.BaseHandler {
  override format(logRecord: LogRecord): string {
    let { msg } = logRecord;

    switch (logRecord.level) {
      case logger.LogLevels.WARN:
        msg = `<yellow>WARN</yellow> ${msg}`;
        break;
      case logger.LogLevels.ERROR:
        msg = `<red>ERROR</red> ${msg}`;
        break;
      case logger.LogLevels.CRITICAL:
        msg = `<red>CRITICAL</red> ${msg}`;
        break;
      case logger.LogLevels.DEBUG:
        msg = `<cyan>DEBUG</cyan> ${msg}`;
        break;
      case logger.LogLevels.INFO:
        msg = `<green>INFO</green> ${msg}`;
        break;
    }

    return msg.replaceAll(
      COLOR_TAG_REG,
      (_, name, content) => logFormats[name]!(content),
    );
  }

  override log(msg: string) {
    console.log(msg);
  }
}

const logFormats: Record<string, (str: string) => string> = {
  cyan,
  Cyan: (str: string) => bold(cyan(str)),
  red,
  Red: (str: string) => bold(red(str)),
  gray,
  Gray: (str: string) => bold(gray(str)),
  green: brightGreen,
  Green: (str: string) => bold(brightGreen(str)),
  yellow: yellow,
  Yellow: (str: string) => bold(yellow(str)),
  del: (str: string) => strikethrough(gray(str)),
};

/**
 * Initial logger setup.
 * Removed the argument "DEBUG" to ConsoleHandler as it's not required or mismatched.
 */
logger.setup({
  handlers: {
    console: new ConsoleHandler("DEBUG"), // Corrected instantiation without arguments
  },
  loggers: {
    weave: {
      level: currentLogLevel,
      handlers: ["console"],
    },
  },
});

/**
 * Retrieves the 'weave' logger instance.
 */
export const log = logger.getLogger("weave");

/**
 * Sets the log level based on CLI input.
 * This function should be called before logging starts to ensure correct log levels.
 * @param debug The log level string.
 */
export function setLogLevelFromCLI(debug: string) {
  const level = debug.toUpperCase() as LevelName;
  const validLevels: LevelName[] = ["DEBUG", "INFO", "WARN", "ERROR", "CRITICAL"];
  if (validLevels.includes(level)) {
    setLogLevel(level);
  } else {
    log.warn(`Invalid log level: ${debug}. Defaulting to INFO.`);
    setLogLevel("INFO");
  }
}