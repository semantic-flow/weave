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

// Get the log level from the environment variable WEAVE_LOGS
let level = env<LevelName>("WEAVE_LOGS")?.toUpperCase() as
  | LevelName
  | undefined;

if (!level || level === "NOTSET") {
  level = "INFO";
}

export function setLogLevel(newLevel: LevelName) {
  level = newLevel;
  log.info(`Log level set to ${newLevel}`);
}

const COLOR_TAG_REG = /<(\w+)>([^<]+)<\/\1>/g;

/**
 * This is the default logger. It will output color coded log messages to the
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
        msg = `<Red>CRITICAL</Red> ${msg}`;
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

logger.setup({
  handlers: {
    console: new ConsoleHandler("DEBUG"),
  },
  loggers: {
    weave: {
      level: level as LevelName,
      handlers: ["console"],
    },
  },
});

export const log = logger.getLogger("weave");



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
