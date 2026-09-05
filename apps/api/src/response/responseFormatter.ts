import type { QueryPipelineSuccess } from "../query/queryPipeline.js";
import type { ProcessFinanceMessageResult } from "../ai/messagePipeline.js";
import type { FinanceIntent } from "../ai/types.js";

/**
 * Deterministic, LLM-free view of a ProcessFinanceMessageResult for the
 * frontend to render directly. `evidence` always carries enough of the
 * underlying DB result for a "View evidence" section; nothing in here
 * performs new aggregation or touches an LLM - it only formats values
 * that already came out of the query pipeline.
 */
export interface FormattedFinanceResponse {
  status: string;
  answer: string;
  summary?: Record<string, unknown>;
  evidence?: Record<string, unknown>;
  conversationContext?: Partial<FinanceIntent>;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const MONTH_ABBR = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

interface CalendarDate {
  year: number;
  month: number; // 1-12
  day: number;
}

function parseISODate(iso: string): CalendarDate {
  const [year, month, day] = iso.split("-").map(Number);
  return { year, month, day };
}

function toEpochMs(date: CalendarDate): number {
  return Date.UTC(date.year, date.month - 1, date.day);
}

function epochToCalendar(epochMs: number): CalendarDate {
  const asDate = new Date(epochMs);
  return {
    year: asDate.getUTCFullYear(),
    month: asDate.getUTCMonth() + 1,
    day: asDate.getUTCDate(),
  };
}

function formatMonthYear(date: CalendarDate): string {
  return `${MONTH_NAMES[date.month - 1]} ${date.year}`;
}

function formatShortDate(date: CalendarDate): string {
  return `${MONTH_ABBR[date.month - 1]} ${date.day}, ${date.year}`;
}

function isExactlyOneCalendarMonth(
  start: CalendarDate,
  endExclusive: CalendarDate,
): boolean {
  if (start.day !== 1) return false;

  const expectedNextMonthStart = toEpochMs({
    year: start.year,
    month: start.month + 1,
    day: 1,
  });

  return toEpochMs(endExclusive) === expectedNextMonthStart;
}

/**
 * Renders a plan's date filters for humans. Never mutates the underlying
 * startDate/endDateExclusive used by the query - endDateExclusive is only
 * shifted back a day here, for display.
 */
export function formatPeriodLabel(
  startDate?: string,
  endDateExclusive?: string,
): string | undefined {
  if (!startDate || !endDateExclusive) return undefined;

  const start = parseISODate(startDate);
  const endExclusive = parseISODate(endDateExclusive);

  if (isExactlyOneCalendarMonth(start, endExclusive)) {
    return formatMonthYear(start);
  }

  const inclusiveEnd = epochToCalendar(
    toEpochMs(endExclusive) - 24 * 60 * 60 * 1000,
  );

  return `${formatShortDate(start)} – ${formatShortDate(inclusiveEnd)}`;
}

/**
 * Renders a NUMERIC(...) monetary string as Indian Rupees using plain
 * thousands grouping (matches the worked examples, e.g. "29108400.00" ->
 * "₹29,108,400.00") rather than Intl's en-IN lakh/crore grouping.
 * Operates on the string's digits only - never round-trips through
 * Number - so precision can't be lost for values beyond
 * Number.MAX_SAFE_INTEGER.
 */
export function formatINR(rawAmount: string): string {
  const trimmed = rawAmount.trim();
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(trimmed);

  if (!match) {
    return `₹${trimmed}`;
  }

  const [, sign, integerPart, fractionPart = "00"] = match;
  const grouped = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const decimals = fractionPart.padEnd(2, "0").slice(0, 2);

  return `${sign}₹${grouped}.${decimals}`;
}

function periodEvidence(
  startDate?: string,
  endDateExclusive?: string,
): Record<string, string> | undefined {
  if (!startDate || !endDateExclusive) return undefined;

  return { start: startDate, endExclusive: endDateExclusive };
}

function vendorLabel(result: QueryPipelineSuccess): string | undefined {
  return result.intent.vendor?.name ?? result.intent.vendor?.code;
}

function formatVendorPayoutTotal(
  result: QueryPipelineSuccess,
): FormattedFinanceResponse {
  const vendorName = vendorLabel(result);
  const period = formatPeriodLabel(
    result.plan.filters.startDate,
    result.plan.filters.endDateExclusive,
  );
  const periodClause = period ? ` in ${period}` : "";

  const firstRow = result.rows[0] as { total?: unknown } | undefined;
  const rawTotal =
    typeof firstRow?.total === "string" ? firstRow.total : undefined;

  const evidence: Record<string, unknown> = {
    template: result.template,
    rows: result.rows,
  };

  const period_ = periodEvidence(
    result.plan.filters.startDate,
    result.plan.filters.endDateExclusive,
  );
  if (period_) evidence.period = period_;
  if (vendorName) evidence.vendor = { name: vendorName };

  if (rawTotal === undefined) {
    return {
      status: "success",
      answer: vendorName
        ? `I couldn't find a payout total for ${vendorName}${periodClause}.`
        : `I couldn't find a payout total${periodClause}.`,
      evidence,
    };
  }

  const formattedAmount = formatINR(rawTotal);

  const answer = vendorName
    ? `You paid ${vendorName} ${formattedAmount}${periodClause}.`
    : `You paid a total of ${formattedAmount}${periodClause}.`;

  return {
    status: "success",
    answer,
    summary: {
      amount: rawTotal,
      currency: "INR",
    },
    evidence,
  };
}

function formatVendorPayoutByVendor(
  result: QueryPipelineSuccess,
): FormattedFinanceResponse {
  const period = formatPeriodLabel(
    result.plan.filters.startDate,
    result.plan.filters.endDateExclusive,
  );
  const periodClause = period ? ` for ${period}` : "";

  const rankings = result.rows.map((row, index) => ({
    rank: index + 1,
    vendorCode: row.vendor_code,
    vendorName: row.vendor_name,
    total: row.total,
  }));

  const evidence: Record<string, unknown> = {
    template: result.template,
    rankings,
    rows: result.rows,
  };

  const period_ = periodEvidence(
    result.plan.filters.startDate,
    result.plan.filters.endDateExclusive,
  );
  if (period_) evidence.period = period_;

  const answer =
    rankings.length > 0
      ? `Here are the vendors with the highest completed payouts${periodClause}.`
      : `No completed vendor payouts were found${periodClause}.`;

  return { status: "success", answer, evidence };
}

function formatUnreconciledTransactions(
  result: QueryPipelineSuccess,
): FormattedFinanceResponse {
  const count = result.rows.length;

  const rows = result.rows.map((row) => ({
    transactionId: row.transaction_id,
    transactionReference: row.transaction_reference,
    transactionDate: row.transaction_date,
    vendorCode: row.vendor_code,
    vendorName: row.vendor_name,
    amount: row.amount,
    category: row.category,
    reconciliationStatus: row.reconciliation_status,
  }));

  const evidence: Record<string, unknown> = {
    template: result.template,
    rows,
  };

  const period_ = periodEvidence(
    result.plan.filters.startDate,
    result.plan.filters.endDateExclusive,
  );
  if (period_) evidence.period = period_;

  const answer =
    count === 0
      ? "No unreconciled transactions were found."
      : `Found ${count} unreconciled transaction${count === 1 ? "" : "s"}.`;

  return {
    status: "success",
    answer,
    summary: { count },
    evidence,
  };
}

function formatUnsupportedTemplate(
  result: QueryPipelineSuccess,
): FormattedFinanceResponse {
  return {
    status: "unsupported_query_intent",
    answer: `The "${result.template}" response format is not implemented yet.`,
    evidence: { template: result.template, rows: result.rows },
  };
}

function formatSuccess(
  result: QueryPipelineSuccess,
): FormattedFinanceResponse {
  switch (result.template) {
    case "vendor_payout_total":
      return formatVendorPayoutTotal(result);
    case "vendor_payout_by_vendor":
      return formatVendorPayoutByVendor(result);
    case "unreconciled_transactions":
      return formatUnreconciledTransactions(result);
    default:
      return formatUnsupportedTemplate(result);
  }
}

/**
 * Converts a ProcessFinanceMessageResult (the /api/chat pipeline's output)
 * into a response the frontend can render directly: a human-readable
 * `answer` plus a deterministic `evidence` block. Purely a formatting
 * layer - it never calls an LLM, never aggregates, and never invents a
 * value that didn't come back from the database.
 */
export function formatFinanceResponse(
  result: ProcessFinanceMessageResult,
): FormattedFinanceResponse {
  switch (result.status) {
    case "success":
      return formatSuccess(result);

    case "unsupported_query_intent":
      return {
        status: "unsupported_query_intent",
        answer: result.message,
        evidence: { intent: result.intent.intent },
      };

    case "clarification":
      return {
        status: "clarification",
        answer: result.question,
        conversationContext: result.conversationContext,
      };

    case "not_found":
      return {
        status: "not_found",
        answer: result.message,
      };

    case "execution_error":
      return {
        status: "execution_error",
        answer: result.message,
      };

    case "unsupported_ai_intent":
      return {
        status: "unsupported_ai_intent",
        answer: result.message,
      };

    case "parser_error":
      return {
        status: "parser_error",
        answer: result.message,
      };

    default: {
      const exhaustiveCheck: never = result;
      throw new Error(
        `Unhandled finance response status: ${JSON.stringify(exhaustiveCheck)}`,
      );
    }
  }
}
