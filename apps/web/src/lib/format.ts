/**
 * Pure display formatting only - never sums, averages, or otherwise
 * recomputes financial values. All amounts arrive from the backend as
 * decimal strings; formatting stays on the string's digits so precision
 * is never routed through `Number`.
 */

const MONTH_ABBR = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export function formatCurrency(rawAmount: string, currency = "INR"): string {
  const trimmed = rawAmount.trim();
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(trimmed);

  if (!match) return rawAmount;

  const [, sign, integerPart, fractionPart = "00"] = match;
  const grouped = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const decimals = fractionPart.padEnd(2, "0").slice(0, 2);
  const symbol = currency === "INR" ? "₹" : `${currency} `;

  return `${sign}${symbol}${grouped}.${decimals}`;
}

function parseISODate(iso: string): { year: number; month: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!match) return null;
  const [, y, m, d] = match;
  return { year: Number(y), month: Number(m), day: Number(d) };
}

function formatShortDate(date: { year: number; month: number; day: number }): string {
  return `${MONTH_ABBR[date.month - 1]} ${date.day}, ${date.year}`;
}

/** Renders an inclusive/exclusive ISO date pair the way a human would say it. */
export function formatPeriod(start?: string, endExclusive?: string): string | undefined {
  if (!start || !endExclusive) return undefined;

  const startDate = parseISODate(start);
  const endExclusiveDate = parseISODate(endExclusive);
  if (!startDate || !endExclusiveDate) return undefined;

  const endEpoch = Date.UTC(endExclusiveDate.year, endExclusiveDate.month - 1, endExclusiveDate.day);
  const inclusiveEndEpoch = endEpoch - 24 * 60 * 60 * 1000;
  const inclusiveEnd = new Date(inclusiveEndEpoch);
  const inclusiveEndDate = {
    year: inclusiveEnd.getUTCFullYear(),
    month: inclusiveEnd.getUTCMonth() + 1,
    day: inclusiveEnd.getUTCDate(),
  };

  if (
    startDate.year === inclusiveEndDate.year &&
    startDate.month === inclusiveEndDate.month &&
    startDate.day === 1
  ) {
    return `${MONTH_ABBR[startDate.month - 1]} 1 – ${inclusiveEndDate.day}, ${startDate.year}`;
  }

  return `${formatShortDate(startDate)} – ${formatShortDate(inclusiveEndDate)}`;
}

/**
 * Splits an assistant `answer` string around a formatted amount so the UI
 * can emphasize the number without altering or re-deriving the sentence.
 * Returns null when the formatted amount can't be located verbatim in the
 * answer, so callers fall back to rendering the plain sentence.
 */
export function splitAroundAmount(
  answer: string,
  formattedAmount: string,
): { before: string; amount: string; after: string } | null {
  const index = answer.indexOf(formattedAmount);
  if (index === -1) return null;

  return {
    before: answer.slice(0, index),
    amount: answer.slice(index, index + formattedAmount.length),
    after: answer.slice(index + formattedAmount.length),
  };
}
