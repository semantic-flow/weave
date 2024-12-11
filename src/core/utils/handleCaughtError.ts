import { log } from "./logging.ts";

export function handleCaughtError(e: any, customMessage?: string): void {
	if (e instanceof Error) {
    log.error(customMessage ? customMessage + " " + e.message : e.message);
    log.debug(Deno.inspect(e, { colors: true }));
  } else {
    log.error("An unknown error occurred.");
  }
}