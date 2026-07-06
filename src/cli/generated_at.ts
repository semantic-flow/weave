const ISO_8601_INSTANT_PATTERN =
  /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,3})?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/;

export function parseIso8601Instant(value: string): Date | undefined {
  if (!ISO_8601_INSTANT_PATTERN.test(value)) {
    return undefined;
  }

  try {
    const instant = Temporal.Instant.from(value);
    const date = new Date(instant.epochMilliseconds);
    return Number.isNaN(date.getTime()) ? undefined : date;
  } catch {
    return undefined;
  }
}
