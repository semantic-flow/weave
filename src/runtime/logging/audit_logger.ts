import type { StructuredLogger } from "./logger.ts";

export class AuditLogger {
  constructor(private readonly logger: StructuredLogger) {}

  record(
    event: string,
    message: string,
    attributes?: Record<string, unknown>,
  ): Promise<void> {
    return this.logger.info(event, message, attributes);
  }

  command(
    commandName: string,
    attributes?: Record<string, unknown>,
  ): Promise<void> {
    return this.record("cli.command", "CLI command invoked", {
      commandName,
      ...attributes,
    });
  }
}
