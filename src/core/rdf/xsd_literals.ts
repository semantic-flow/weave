const XSD_DATE_TIME_PATTERN =
  /^(-?\d{4,})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?(Z|[+-]\d{2}:\d{2})?$/;

export function normalizeXsdDateTimeLiteral<E extends Error>(
  value: string,
  fieldName: string,
  createError: (message: string) => E,
): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw createError(`${fieldName} must not be empty`);
  }
  if (!isValidXsdDateTime(trimmed)) {
    throw createError(`${fieldName} must be a valid xsd:dateTime`);
  }
  return trimmed;
}

export function isValidXsdDateTime(value: string): boolean {
  const match = XSD_DATE_TIME_PATTERN.exec(value);
  if (!match) {
    return false;
  }

  const year = BigInt(match[1]!);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  const fractionalSecond = match[7];
  const timezone = match[8];

  if (month < 1 || month > 12) {
    return false;
  }
  if (day < 1 || day > daysInMonth(year, month)) {
    return false;
  }
  if (minute > 59 || second > 59) {
    return false;
  }
  if (hour > 24) {
    return false;
  }
  if (
    hour === 24 &&
    (minute !== 0 || second !== 0 || !isZeroFraction(fractionalSecond))
  ) {
    return false;
  }
  if (!isValidTimezone(timezone)) {
    return false;
  }

  return true;
}

function daysInMonth(year: bigint, month: number): number {
  switch (month) {
    case 2:
      return isLeapYear(year) ? 29 : 28;
    case 4:
    case 6:
    case 9:
    case 11:
      return 30;
    default:
      return 31;
  }
}

function isLeapYear(year: bigint): boolean {
  return year % 400n === 0n || (year % 4n === 0n && year % 100n !== 0n);
}

function isZeroFraction(fractionalSecond: string | undefined): boolean {
  return fractionalSecond === undefined || /^0+$/.test(fractionalSecond);
}

function isValidTimezone(timezone: string | undefined): boolean {
  if (timezone === undefined || timezone === "Z") {
    return true;
  }

  const hour = Number(timezone.slice(1, 3));
  const minute = Number(timezone.slice(4, 6));
  return hour <= 14 && minute <= 59 && (hour !== 14 || minute === 0);
}
