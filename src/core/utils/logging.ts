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

// Initialize the log level from the environment variable 'WEAVE_LOGS'
let currentLogLevel: LevelName = "INFO";

const envLogLevel = env<LevelName>("WEAVE_LOGS")?.toUpperCase();

// Use type narrowing to ensure envLogLevel is a valid LevelName
if (envLogLevel && envLogLevel in logger.LogLevels && envLogLevel !== "NOTSET") {
  currentLogLevel = envLogLevel as LevelName;
}

/**
 * Sets the current log level.
 * @param newLevel The desired log level.
 */
export function setLogLevel(newLevel: LevelName) {
  if (logger.LogLevels[newLevel] !== undefined) {
    const oldLevel = currentLogLevel;
    currentLogLevel = newLevel;
    logger.setup({
      handlers: {
        console: new ConsoleHandler("DEBUG"),
      },
      loggers: {
        weave: {
          level: newLevel,
          handlers: ["console"],
        },
      },
    });
    // Update the exported logger instance after reconfiguring
    log = logger.getLogger("weave");
    log.info(`Logger level changed from ${oldLevel} to ${newLevel}`);
  } else {
    console.error(`Attempted to set invalid log level: ${newLevel}`);
  }
}

const COLOR_TAG_REG = /<(\w+)>([^<]+)<\/\1>/g;

/**
 * This is the default logger. It will output color-coded log messages to the
 * console via `console.log()`.
 */
class ConsoleHandler extends logger.BaseHandler {
  constructor(level: LevelName) {
    super(level);
  }

  override format(logRecord: LogRecord): string {
    let { msg } = logRecord;

    switch (logRecord.level) {
      case logger.LogLevels.CRITICAL:
        msg = `<red>CRITICAL</red> ${msg}`;
        break;
      case logger.LogLevels.ERROR:
        msg = `<red>ERROR</red> ${msg}`;
        break;
      case logger.LogLevels.WARN:
        msg = `<yellow>WARN</yellow> ${msg}`;
        break;
      case logger.LogLevels.INFO:
        msg = `<green>INFO</green> ${msg}`;
        break;
      case logger.LogLevels.DEBUG:
        msg = `<cyan>DEBUG</cyan> ${msg}`;
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

// Initialize logger with default configuration
logger.setup({
  handlers: {
    console: new ConsoleHandler("DEBUG"),
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
export let log = logger.getLogger("weave");
log.debug("Logger setup with level: " + currentLogLevel);
