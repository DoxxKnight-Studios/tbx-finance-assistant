/**
 * Calendar utilities for the seed generator, operating purely in UTC so
 * results never depend on the machine's local timezone.
 */

export interface MonthKey {
  year: number;
  month: number; // 1-12
}

export interface CalendarDay extends MonthKey {
  day: number;
  isWeekend: boolean;
  isMonthEndWindow: boolean; // last 3 calendar days of the month
}

export const QUARTER_END_MONTHS = new Set([3, 6, 9, 12]);

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Inclusive of both endpoints. */
export function enumerateMonths(
  start: MonthKey,
  endInclusive: MonthKey,
): MonthKey[] {
  const months: MonthKey[] = [];
  let year = start.year;
  let month = start.month;

  while (
    year < endInclusive.year ||
    (year === endInclusive.year && month <= endInclusive.month)
  ) {
    months.push({ year, month });
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }

  return months;
}

export function enumerateDays(
  key: MonthKey,
  endInclusive?: MonthKey & { day: number },
): CalendarDay[] {
  const total = daysInMonth(key.year, key.month);
  const lastDay =
    endInclusive && endInclusive.year === key.year && endInclusive.month === key.month
      ? endInclusive.day
      : total;

  const days: CalendarDay[] = [];
  for (let day = 1; day <= lastDay; day += 1) {
    const dow = new Date(Date.UTC(key.year, key.month - 1, day)).getUTCDay();
    days.push({
      year: key.year,
      month: key.month,
      day,
      isWeekend: dow === 0 || dow === 6,
      isMonthEndWindow: day > total - 3,
    });
  }
  return days;
}

export function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function formatDateOnly(day: CalendarDay): string {
  return `${day.year}-${pad2(day.month)}-${pad2(day.day)}`;
}

/** `YYYY-MM-DD HH:MI:SS.ffffff`, matching TIMESTAMP(6) microsecond precision. */
export function formatTimestamp(
  day: CalendarDay,
  hour: number,
  minute: number,
  second: number,
  microseconds: number,
): string {
  return (
    `${formatDateOnly(day)} ${pad2(hour)}:${pad2(minute)}:${pad2(second)}` +
    `.${String(microseconds).padStart(6, "0")}`
  );
}
