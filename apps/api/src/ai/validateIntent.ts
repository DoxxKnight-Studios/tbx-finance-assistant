import type { FinanceIntent } from "./types.js";

export type IntentValidationResult =
  | {
      valid: true;
      intent: FinanceIntent;
    }
  | {
      valid: false;
      reason: string;
      clarification?: string;
    };

const requiredDateIntents = new Set([
  "vendor_payout_total",
  "vendor_payout_by_vendor",
  "vendor_payout_largest",
  "transaction_spend_total",
  "transaction_spend_by_vendor",
  "transaction_spend_by_category",
  "vendor_payout_largest",
]);

export function validateIntent(
  intent: FinanceIntent,
): IntentValidationResult {
  if (!intent || typeof intent !== "object") {
    return {
      valid: false,
      reason: "INVALID_INTENT",
    };
  }

  if (!intent.intent) {
    return {
      valid: false,
      reason: "MISSING_INTENT",
    };
  }

  if (
    requiredDateIntents.has(intent.intent) &&
    !intent.date_range
  ) {
    return {
      valid: false,
      reason: "MISSING_DATE_RANGE",
      clarification: "What date range should I use?",
    };
  }

  if (
    intent.intent === "transaction_lookup" &&
    !intent.transaction_reference
  ) {
    return {
      valid: false,
      reason: "MISSING_TRANSACTION_REFERENCE",
      clarification: "Which transaction reference should I look up?",
    };
  }

  if (
    intent.intent === "transaction_amount_filter" &&
    intent.amount_less_than === undefined
  ) {
    return {
      valid: false,
      reason: "MISSING_AMOUNT_THRESHOLD",
      clarification: "What transaction amount should I use as the threshold?",
    };
  }

  if (
    intent.intent === "financial_comparison" &&
    !intent.comparison
  ) {
    return {
      valid: false,
      reason: "MISSING_COMPARISON_PERIODS",
      clarification: "Which two periods should I compare?",
    };
  }

  if (
    intent.limit !== undefined &&
    (!Number.isInteger(intent.limit) ||
      intent.limit < 1 ||
      intent.limit > 100)
  ) {
    return {
      valid: false,
      reason: "INVALID_LIMIT",
    };
  }

  return {
    valid: true,
    intent,
  };
}import {
  SUPPORTED_INTENTS,
  RELATIVE_DATE_TYPES,
  type IntentParserResult,
  type DateRange,
  type IntentName,
  type RelativeDateType,
} from "./types.js";

export type ValidationOutcome =
  | { valid: true; data: IntentParserResult }
  | { valid: false; error: string };

export function isValidCalendarDate(dateStr: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!match) return false;

  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const day = parseInt(match[3], 10);

  if (month < 1 || month > 12 || day < 1 || day > 31) return false;

  // Timezone-safe calendar check using UTC
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function isValidDateRange(range: unknown): range is DateRange {
  if (!range || typeof range !== "object") return false;
  const r = range as Record<string, unknown>;

  if (typeof r.type !== "string") return false;

  if (RELATIVE_DATE_TYPES.includes(r.type as RelativeDateType)) {
    return true;
  }

  if (r.type === "month") {
    if (typeof r.year !== "number" || typeof r.month !== "number") return false;
    if (r.month < 1 || r.month > 12) return false;
    return true;
  }

  if (r.type === "between") {
    if (typeof r.start !== "string" || typeof r.end !== "string") return false;
    if (!isValidCalendarDate(r.start) || !isValidCalendarDate(r.end)) return false;
    return r.start < r.end;
  }

  return false;
}

export function isValidFinanceIntent(intent: unknown): intent is FinanceIntent {
  if (!intent || typeof intent !== "object") return false;
  const fi = intent as Record<string, unknown>;

  if (!SUPPORTED_INTENTS.includes(fi.intent as IntentName)) {
    return false;
  }

  if (fi.vendor !== undefined) {
    if (typeof fi.vendor !== "object" || fi.vendor === null) return false;
    const v = fi.vendor as Record<string, unknown>;
    if (v.name !== undefined && typeof v.name !== "string") return false;
    if (v.code !== undefined && typeof v.code !== "string") return false;
  }

  if (fi.category !== undefined && typeof fi.category !== "string") {
    return false;
  }

  if (
    fi.amount_less_than !== undefined &&
    (typeof fi.amount_less_than !== "number" ||
      !Number.isFinite(fi.amount_less_than) ||
      fi.amount_less_than < 0)
  ) {
    return false;
  }

  if (
    fi.intent === "transaction_amount_filter" &&
    (typeof fi.amount_less_than !== "number" ||
      !Number.isFinite(fi.amount_less_than) ||
      fi.amount_less_than < 0)
  ) {
    return false;
  }

  if (
    fi.transaction_reference !== undefined &&
    typeof fi.transaction_reference !== "string"
  ) {
    return false;
  }

  if (fi.date_range !== undefined && !isValidDateRange(fi.date_range)) {
    return false;
  }

  if (fi.intent === "transaction_lookup") {
    if (
      typeof fi.transaction_reference !== "string" ||
      fi.transaction_reference.trim().length === 0
    ) {
      return false;
    }
  }

  if (fi.intent === "financial_comparison") {
    if (!fi.comparison || typeof fi.comparison !== "object") {
      return false;
    }
  }

  if (fi.comparison !== undefined) {
    if (typeof fi.comparison !== "object" || fi.comparison === null)
      return false;
    const c = fi.comparison as Record<string, unknown>;
    if (!isValidDateRange(c.primary) || !isValidDateRange(c.secondary)) {
      return false;
    }
  }

  if (fi.limit !== undefined) {
    if (
      typeof fi.limit !== "number" ||
      !Number.isInteger(fi.limit) ||
      fi.limit < 1 ||
      fi.limit > 1000
    ) {
      return false;
    }
  }

  return true;
}

export function validateIntentParserResult(input: unknown): ValidationOutcome {
  if (!input || typeof input !== "object") {
    return { valid: false, error: "Model output is not a JSON object" };
  }

  const res = input as Record<string, unknown>;

  if (res.status === "success") {
    if (!isValidFinanceIntent(res.intent)) {
      return {
        valid: false,
        error: "Invalid or malformed FinanceIntent in success response",
      };
    }
    return {
      valid: true,
      data: {
        status: "success",
        intent: res.intent as FinanceIntent,
      },
    };
  }

  if (res.status === "clarification") {
    if (typeof res.question !== "string" || res.question.trim().length === 0) {
      return {
        valid: false,
        error: "Clarification status requires a non-empty question string",
      };
    }
    return {
      valid: true,
      data: {
        status: "clarification",
        question: res.question,
        partialIntent: (res.partialIntent as Partial<FinanceIntent>) || undefined,
      },
    };
  }

  if (res.status === "unsupported") {
    if (typeof res.message !== "string" || res.message.trim().length === 0) {
      return {
        valid: false,
        error: "Unsupported status requires a non-empty message string",
      };
    }
    return {
      valid: true,
      data: {
        status: "unsupported",
        message: res.message,
      },
    };
  }

  return {
    valid: false,
    error: `Unknown or missing status: ${String(res.status)}`,
  };
}
