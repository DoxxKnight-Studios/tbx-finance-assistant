import {
  COMPARISON_METRICS,
  KNOWN_PROGRAM_IDS,
  RELATIVE_DATE_TYPES,
  SUPPORTED_INTENTS,
  TRANSACTION_TYPES,
  type AccountFilter,
  type BankFilter,
  type DateRange,
  type FinanceIntent,
  type IntentName,
  type IntentParserResult,
  type ProgramId,
  type RelativeDateType,
  type TransactionType,
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
    if (!hasOnlyAllowedKeys(r, ["type"])) return false;
    return true;
  }

  if (r.type === "month") {
    if (!hasOnlyAllowedKeys(r, ["type", "year", "month"])) return false;
    if (typeof r.year !== "number" || typeof r.month !== "number") return false;
    if (r.month < 1 || r.month > 12) return false;
    return true;
  }

  if (r.type === "between") {
    if (!hasOnlyAllowedKeys(r, ["type", "start", "end"])) return false;
    if (typeof r.start !== "string" || typeof r.end !== "string") return false;
    if (!isValidCalendarDate(r.start) || !isValidCalendarDate(r.end)) return false;
    return r.start < r.end;
  }

  return false;
}

function hasOnlyAllowedKeys(obj: Record<string, unknown>, allowedKeys: readonly string[]): boolean {
  return Object.keys(obj).every((key) => (allowedKeys as readonly string[]).includes(key));
}

function isOptionalDateRange(value: unknown): boolean {
  return value === undefined || isValidDateRange(value);
}

function isBankFilter(value: unknown): value is BankFilter {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return hasOnlyAllowedKeys(v, ["code"]) && typeof v.code === "string" && v.code.trim().length > 0;
}

function isOptionalBankFilter(value: unknown): boolean {
  return value === undefined || isBankFilter(value);
}

const LAST4_PATTERN = /^\d{4}$/;

function isAccountFilter(value: unknown): value is AccountFilter {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    hasOnlyAllowedKeys(v, ["last4"]) &&
    typeof v.last4 === "string" &&
    LAST4_PATTERN.test(v.last4)
  );
}

function isOptionalAccountFilter(value: unknown): boolean {
  return value === undefined || isAccountFilter(value);
}

function isProgramId(value: unknown): value is ProgramId {
  return typeof value === "number" && (KNOWN_PROGRAM_IDS as readonly number[]).includes(value);
}

function isOptionalProgramId(value: unknown): boolean {
  return value === undefined || isProgramId(value);
}

function isTransactionType(value: unknown): value is TransactionType {
  return typeof value === "string" && (TRANSACTION_TYPES as readonly string[]).includes(value);
}

function isOptionalTransactionType(value: unknown): boolean {
  return value === undefined || isTransactionType(value);
}

function isValidComparison(value: unknown): boolean {
  if (typeof value !== "object" || value === null) return false;
  const c = value as Record<string, unknown>;
  if (!hasOnlyAllowedKeys(c, ["metric", "primary", "secondary"])) return false;
  if (typeof c.metric !== "string" || !(COMPARISON_METRICS as readonly string[]).includes(c.metric)) {
    return false;
  }
  return isValidDateRange(c.primary) && isValidDateRange(c.secondary);
}

/**
 * Structural/semantic validation of a raw (untyped) candidate intent
 * from Gemini's JSON output. This is the sole gate that decides whether
 * a value is trustworthy as a FinanceIntent - it rejects unknown
 * intents, malformed dates, invalid transaction_type/program_id/last4,
 * missing intent-specific required fields, AND any field that isn't
 * explicitly allowed for that intent (so a stray `vendor`, `category`,
 * or `reconciliationStatus` field fails validation here rather than
 * silently passing through). Never touches the database - program_id
 * membership is checked against the known, fixed 5-program business
 * domain, not a query.
 */
export function isValidFinanceIntent(value: unknown): value is FinanceIntent {
  if (!value || typeof value !== "object") return false;
  const fi = value as Record<string, unknown>;

  if (!SUPPORTED_INTENTS.includes(fi.intent as IntentName)) return false;

  switch (fi.intent as IntentName) {
    case "transaction_spend_total":
      return (
        hasOnlyAllowedKeys(fi, ["intent", "date_range", "description_query", "bank", "program_id", "account"]) &&
        isOptionalDateRange(fi.date_range) &&
        (fi.description_query === undefined ||
          (typeof fi.description_query === "string" && fi.description_query.trim().length > 0)) &&
        isOptionalBankFilter(fi.bank) &&
        isOptionalProgramId(fi.program_id) &&
        isOptionalAccountFilter(fi.account)
      );
    case "transaction_income_total":
    case "transaction_summary":
      return (
        hasOnlyAllowedKeys(fi, ["intent", "date_range", "bank", "program_id", "account"]) &&
        isOptionalDateRange(fi.date_range) &&
        isOptionalBankFilter(fi.bank) &&
        isOptionalProgramId(fi.program_id) &&
        isOptionalAccountFilter(fi.account)
      );

    case "transaction_count":
      return (
        hasOnlyAllowedKeys(fi, [
          "intent", "date_range", "transaction_type", "bank", "program_id", "account",
        ]) &&
        isOptionalDateRange(fi.date_range) &&
        isOptionalTransactionType(fi.transaction_type) &&
        isOptionalBankFilter(fi.bank) &&
        isOptionalProgramId(fi.program_id) &&
        isOptionalAccountFilter(fi.account)
      );

    case "transaction_spend_by_bank":
      return (
        hasOnlyAllowedKeys(fi, ["intent", "date_range", "bank"]) &&
        isOptionalDateRange(fi.date_range) &&
        isOptionalBankFilter(fi.bank)
      );

    case "transaction_spend_by_program":
      return (
        hasOnlyAllowedKeys(fi, ["intent", "date_range", "program_id"]) &&
        isOptionalDateRange(fi.date_range) &&
        isOptionalProgramId(fi.program_id)
      );

    case "largest_transaction":
      return (
        hasOnlyAllowedKeys(fi, [
          "intent", "date_range", "transaction_type", "bank", "program_id", "account",
        ]) &&
        isOptionalDateRange(fi.date_range) &&
        isOptionalTransactionType(fi.transaction_type) &&
        isOptionalBankFilter(fi.bank) &&
        isOptionalProgramId(fi.program_id) &&
        isOptionalAccountFilter(fi.account)
      );

    case "transaction_lookup":
      return (
        hasOnlyAllowedKeys(fi, ["intent", "transaction_reference"]) &&
        typeof fi.transaction_reference === "string" &&
        fi.transaction_reference.trim().length > 0
      );

    case "account_balance":
      return (
        hasOnlyAllowedKeys(fi, ["intent", "account", "bank"]) &&
        isAccountFilter(fi.account) &&
        isOptionalBankFilter(fi.bank)
      );

    case "account_count":
      return hasOnlyAllowedKeys(fi, ["intent"]);

    case "financial_comparison":
      return hasOnlyAllowedKeys(fi, ["intent", "comparison"]) && isValidComparison(fi.comparison);

    default:
      return false;
  }
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
        intent: res.intent,
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

export type IntentValidationResult =
  | { valid: true; intent: FinanceIntent }
  | { valid: false; reason: string; clarification?: string };

/**
 * The real runtime validation boundary called by ai/messagePipeline.ts.
 * `intent: FinanceIntent` is a TypeScript annotation, not proof - that
 * type is erased at runtime, so a value arriving here (from Gemini's raw
 * JSON, or from a test that force-casts a malformed object with
 * `as unknown as FinanceIntent`) cannot be trusted just because the
 * caller's type checker allowed it through. This independently re-runs
 * the full structural check (isValidFinanceIntent: recognized intent,
 * allowed keys only, well-formed dates/bank/program/account/comparison)
 * against the actual value, so malformed data is rejected here even if
 * every earlier layer's type-level guarantee was bypassed.
 *
 * Its signature is preserved exactly because messagePipeline.ts calls it
 * directly and is not being touched in this phase. Unlike the
 * pre-Phase-4 contract - where date_range was structurally optional but
 * a business rule still required it for spend/vendor intents - every
 * field this contract marks optional is genuinely optional ("all time"
 * is a meaningful answer for e.g. transaction_spend_total), so there is
 * no additional business-only requirement left to enforce beyond
 * structural validity.
 */
export function validateIntent(intent: FinanceIntent): IntentValidationResult {
  if (!isValidFinanceIntent(intent)) {
    return {
      valid: false,
      reason: "MALFORMED_FINANCE_INTENT",
    };
  }

  return { valid: true, intent };
}
