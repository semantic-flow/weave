import { dirname } from "@std/path";
import { LOG_LEVEL_ORDER } from "./log_record.ts";
import type { LogLevel, LogRecord, LogSink } from "./log_record.ts";

export interface StructuredLoggerOptions {
  minLevel?: LogLevel;
  channel: LogRecord["channel"];
  now?: () => Date;
}

export class StructuredLogger {
  private readonly minLevel: LogLevel;
  private readonly now: () => Date;

  constructor(
    private readonly sinks: readonly LogSink[],
    private readonly options: StructuredLoggerOptions,
  ) {
    this.minLevel = options.minLevel ?? "info";
    this.now = options.now ?? (() => new Date());
  }

  async log(
    level: LogLevel,
    event: string,
    message: string,
    attributes?: Record<string, unknown>,
  ): Promise<void> {
    if (LOG_LEVEL_ORDER[level] < LOG_LEVEL_ORDER[this.minLevel]) {
      return;
    }

    const record: LogRecord = {
      timestamp: this.now().toISOString(),
      level,
      channel: this.options.channel,
      event,
      message,
      ...(attributes ? { attributes } : {}),
    };

    for (const sink of this.sinks) {
      await sink.write(record);
    }
  }

  debug(
    event: string,
    message: string,
    attributes?: Record<string, unknown>,
  ): Promise<void> {
    return this.log("debug", event, message, attributes);
  }

  info(
    event: string,
    message: string,
    attributes?: Record<string, unknown>,
  ): Promise<void> {
    return this.log("info", event, message, attributes);
  }

  warn(
    event: string,
    message: string,
    attributes?: Record<string, unknown>,
  ): Promise<void> {
    return this.log("warn", event, message, attributes);
  }

  error(
    event: string,
    message: string,
    attributes?: Record<string, unknown>,
  ): Promise<void> {
    return this.log("error", event, message, attributes);
  }
}

export class JsonLineFileSink implements LogSink {
  constructor(private readonly filePath: string) {}

  async write(record: LogRecord): Promise<void> {
    await Deno.mkdir(dirname(this.filePath), { recursive: true });
    await Deno.writeTextFile(
      this.filePath,
      `${JSON.stringify(record)}\n`,
      {
        append: true,
        create: true,
      },
    );
  }
}

export class NoopSink implements LogSink {
  write(_record: LogRecord): void {
    // Intentionally empty.
  }
}
