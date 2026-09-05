/**
 * FinanceIntent contract - official TBX schema (bank / account /
 * "transaction" only). There is no vendor, category, reconciliation, or
 * transaction-status concept anywhere in this file, because none exist
 * in the official schema and the product does not support vendor/payee
 * analysis.
 *
 * Deliberately NOT one large interface with every field optional. Each
 * intent is its own discriminated branch carrying only the fields that
 * are semantically meaningful for it - e.g. it is a compile error to
 * attach `account` to transaction_spend_by_bank, or to construct a
 * transaction_lookup intent without transaction_reference.
 */

export const SUPPORTED_INTENTS = [
  "transaction_spend_total",
  "transaction_income_total",
  "transaction_count",
  "transaction_spend_by_bank",
  "transaction_spend_by_program",
  "transaction_summary",
  "largest_transaction",
  "transaction_lookup",
  "account_balance",
  "financial_comparison",
] as const;

export type IntentName = (typeof SUPPORTED_INTENTS)[number];

// ---- Dates -----------------------------------------------------------
// Unchanged from the pre-Phase-4 contract: query/dateResolver.ts (not
// touched in this phase) imports DateRange/RelativeDateType/
// RELATIVE_DATE_TYPES directly from this file, so this shape is
// preserved exactly. Relative dates stay symbolic here - Gemini must
// never compute actual calendar dates for them; dateResolver.ts remains
// solely responsible for resolving them against a reference date.

export const RELATIVE_DATE_TYPES = [
  "today",
  "yesterday",
  "this_week",
  "last_week",
  "this_month",
  "last_month",
  "this_quarter",
  "last_quarter",
] as const;

export type RelativeDateType = (typeof RELATIVE_DATE_TYPES)[number];

export type DateRange =
  | { type: RelativeDateType }
  | { type: "month"; year: number; month: number }
  | { type: "between"; start: string; end: string };

// ---- Shared filters ----------------------------------------------------

export const TRANSACTION_TYPES = ["credit", "debit"] as const;
export type TransactionType = (typeof TRANSACTION_TYPES)[number];

/**
 * The official schema's only 5 programs. This is a fixed, known business
 * domain (like TRANSACTION_TYPES), not a database lookup - membership in
 * this list is checked structurally, not against the database.
 */
export const KNOWN_PROGRAM_IDS = [4, 21, 33, 46, 58] as const;
export type ProgramId = (typeof KNOWN_PROGRAM_IDS)[number];

/**
 * Natural-language bank reference, e.g. "through HDFC" -> { code: "HDFC" }.
 * Never a database-generated ID - a later resolver verifies the code
 * actually exists.
 */
export interface BankFilter {
  code: string;
}

/**
 * Natural-language account reference, e.g. "account ending 9069" ->
 * { last4: "9069" }. account_number is sensitive and never appears in
 * FinanceIntent - only the last 4 digits, and Gemini must never
 * calculate or reconstruct a full account number.
 */
export interface AccountFilter {
  last4: string;
}

export const COMPARISON_METRICS = ["spend", "income", "transaction_count"] as const;
export type ComparisonMetric = (typeof COMPARISON_METRICS)[number];

// ---- Per-intent shapes ---------------------------------------------------

export interface TransactionSpendTotalIntent {
  intent: "transaction_spend_total";
  date_range?: DateRange;
  /** Natural-language phrase matched against transaction.description. */
  description_query?: string;
  bank?: BankFilter;
  program_id?: ProgramId;
  account?: AccountFilter;
}

export interface TransactionIncomeTotalIntent {
  intent: "transaction_income_total";
  date_range?: DateRange;
  bank?: BankFilter;
  program_id?: ProgramId;
  account?: AccountFilter;
}

export interface TransactionCountIntent {
  intent: "transaction_count";
  date_range?: DateRange;
  /** Omitted = every transaction type ("transactions" with no qualifier). */
  transaction_type?: TransactionType;
  bank?: BankFilter;
  program_id?: ProgramId;
  account?: AccountFilter;
}

export interface TransactionSpendByBankIntent {
  intent: "transaction_spend_by_bank";
  date_range?: DateRange;
  /** Optional narrowing filter - the intent is still a per-bank breakdown. */
  bank?: BankFilter;
}

export interface TransactionSpendByProgramIntent {
  intent: "transaction_spend_by_program";
  date_range?: DateRange;
  /** Optional narrowing filter - the intent is still a per-program breakdown. */
  program_id?: ProgramId;
}

export interface TransactionSummaryIntent {
  intent: "transaction_summary";
  date_range?: DateRange;
  bank?: BankFilter;
  program_id?: ProgramId;
  account?: AccountFilter;
}

export interface LargestTransactionIntent {
  intent: "largest_transaction";
  date_range?: DateRange;
  /** Omitted = largest transaction regardless of type. Never silently defaulted to "debit". */
  transaction_type?: TransactionType;
  bank?: BankFilter;
  program_id?: ProgramId;
  account?: AccountFilter;
}

export interface TransactionLookupIntent {
  intent: "transaction_lookup";
  /** transaction_reference_id lookup only - UTR lookup is not implemented yet. */
  transaction_reference: string;
}

export interface AccountBalanceIntent {
  intent: "account_balance";
  account: AccountFilter;
  /** Optional disambiguation when more than one account shares a last4. */
  bank?: BankFilter;
}

export interface FinancialComparisonIntent {
  intent: "financial_comparison";
  /**
   * Grouped together because all three are required together - Gemini
   * only identifies the metric and the two periods; the backend performs
   * every calculation.
   */
  comparison: {
    metric: ComparisonMetric;
    primary: DateRange;
    secondary: DateRange;
  };
}

export type FinanceIntent =
  | TransactionSpendTotalIntent
  | TransactionIncomeTotalIntent
  | TransactionCountIntent
  | TransactionSpendByBankIntent
  | TransactionSpendByProgramIntent
  | TransactionSummaryIntent
  | LargestTransactionIntent
  | TransactionLookupIntent
  | AccountBalanceIntent
  | FinancialComparisonIntent;

// ---- Parser result envelope ----------------------------------------------
// Unchanged 3-status shape from the pre-Phase-4 contract - only what's
// inside `intent` changed. messagePipeline.ts, intentParser.ts, and
// routes/chat.ts all depend on this exact shape and are not being
// touched in this phase.

export type IntentParserResult =
  | { status: "success"; intent: FinanceIntent }
  | { status: "clarification"; question: string; partialIntent?: Partial<FinanceIntent> }
  | { status: "unsupported"; message: string };
