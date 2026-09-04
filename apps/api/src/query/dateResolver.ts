import type { DateRange } from "../ai/types.js";

export interface ResolvedDateRange {
  start: string;
  endExclusive: string;
}

const MIN_REASONABLE_YEAR = 1900;
const MAX_REASONABLE_YEAR = 2999;

interface CalendarDate {
  year: number;
  month: number; // 1-12
  day: number;
}

/**
 * Reads the calendar date from a reference Date using its UTC fields, not
 * local machine fields. Callers must pass a referenceDate whose UTC
 * year/month/day represent the intended "today" (e.g. constructed as
 * `new Date("2026-09-05T00:00:00Z")`), so results never shift with the
 * local timezone of whatever machine runs this code.
 */
function toCalendarDate(date: Date): CalendarDate {
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
}

function toEpochMs(year: number, month: number, day: number): number {
  return Date.UTC(year, month - 1, day);
}

function toISODate(epochMs: number): string {
  return new Date(epochMs).toISOString().slice(0, 10);
}

function resolved(startMs: number, endExclusiveMs: number): ResolvedDateRange {
  return {
    start: toISODate(startMs),
    endExclusive: toISODate(endExclusiveMs),
  };
}

function isInteger(value: number): boolean {
  return Number.isInteger(value);
}

/**
 * Validates a YYYY-MM-DD string represents a real calendar date and
 * returns its epoch ms (UTC midnight). Throws rather than silently
 * normalizing out-of-range values (e.g. "2026-02-31"), because Date.UTC
 * would otherwise roll such input forward into the next month.
 */
function parseStrictISODate(value: string, label: string): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    throw new Error(
      `Invalid ${label}: "${value}" is not a YYYY-MM-DD date string`
    );
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  const epochMs = toEpochMs(year, month, day);
  const roundTrip = toCalendarDate(new Date(epochMs));

  if (
    roundTrip.year !== year ||
    roundTrip.month !== month ||
    roundTrip.day !== day
  ) {
    throw new Error(`Invalid ${label}: "${value}" is not a real calendar date`);
  }

  return epochMs;
}

function validateYear(year: number, label: string): void {
  if (
    !isInteger(year) ||
    year < MIN_REASONABLE_YEAR ||
    year > MAX_REASONABLE_YEAR
  ) {
    throw new Error(
      `Invalid ${label}: year must be an integer between ${MIN_REASONABLE_YEAR} and ${MAX_REASONABLE_YEAR}, got ${year}`
    );
  }
}

function validateMonth(month: number, label: string): void {
  if (!isInteger(month) || month < 1 || month > 12) {
    throw new Error(`Invalid ${label}: month must be an integer 1-12, got ${month}`);
  }
}

function resolveMonthRange(year: number, month: number): ResolvedDateRange {
  const start = toEpochMs(year, month, 1);
  const endExclusive = toEpochMs(year, month + 1, 1);
  return resolved(start, endExclusive);
}

function resolveQuarterRange(year: number, quarterStartMonth: number): ResolvedDateRange {
  const start = toEpochMs(year, quarterStartMonth, 1);
  const endExclusive = toEpochMs(year, quarterStartMonth + 3, 1);
  return resolved(start, endExclusive);
}

/** Days since Monday: Monday -> 0, Tuesday -> 1, ..., Sunday -> 6. */
function daysSinceMonday(epochMs: number): number {
  const dayOfWeek = new Date(epochMs).getUTCDay(); // Sunday = 0 .. Saturday = 6
  return (dayOfWeek + 6) % 7;
}

export function resolveDateRange(
  range: DateRange,
  referenceDate: Date
): ResolvedDateRange {
  const { year, month, day } = toCalendarDate(referenceDate);
  const todayMs = toEpochMs(year, month, day);

  switch (range.type) {
    case "today": {
      return resolved(todayMs, toEpochMs(year, month, day + 1));
    }

    case "yesterday": {
      return resolved(toEpochMs(year, month, day - 1), todayMs);
    }

    case "this_week": {
      const mondayMs = toEpochMs(year, month, day - daysSinceMonday(todayMs));
      return resolved(mondayMs, toEpochMs(year, month, day - daysSinceMonday(todayMs) + 7));
    }

    case "last_week": {
      const thisMondayMs = toEpochMs(year, month, day - daysSinceMonday(todayMs));
      const lastMondayMs = toEpochMs(year, month, day - daysSinceMonday(todayMs) - 7);
      return resolved(lastMondayMs, thisMondayMs);
    }

    case "this_month": {
      return resolveMonthRange(year, month);
    }

    case "last_month": {
      return resolveMonthRange(year, month - 1);
    }

    case "this_quarter": {
      const quarterStartMonth = Math.floor((month - 1) / 3) * 3 + 1;
      return resolveQuarterRange(year, quarterStartMonth);
    }

    case "last_quarter": {
      const quarterStartMonth = Math.floor((month - 1) / 3) * 3 + 1;
      return resolveQuarterRange(year, quarterStartMonth - 3);
    }

    case "month": {
      validateYear(range.year, "date_range.year");
      validateMonth(range.month, "date_range.month");
      return resolveMonthRange(range.year, range.month);
    }

    case "between": {
      const startMs = parseStrictISODate(range.start, "date_range.start");
      const endMs = parseStrictISODate(range.end, "date_range.end");

      if (startMs >= endMs) {
        throw new Error(
          `Invalid date_range: start "${range.start}" must be before end "${range.end}"`
        );
      }

      return resolved(startMs, endMs);
    }

    default: {
      const exhaustiveCheck: never = range;
      throw new Error(`Unsupported date range type: ${JSON.stringify(exhaustiveCheck)}`);
    }
  }
}
