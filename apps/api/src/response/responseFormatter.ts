import type { QueryPipelineSuccess } from "../query/queryPipeline.js";
import type { ProcessFinanceMessageResult } from "../ai/messagePipeline.js";
import type { ComparisonMetric, FinanceIntent, TransactionType } from "../ai/types.js";

// ============================================================
// Stable API response contract
// ============================================================
// The boundary between the database/query world and the frontend. Never
// calls Gemini, never recalculates a financial value the query layer
// already produced - every number here is either passed through
// verbatim (as the exact string PostgreSQL returned) or reformatted for
// display only (grouping digits, choosing a date label).

export type FinanceResponseStatus =
  | "success"
  | "clarification"
  | "unsupported_ai_intent"
  | "unsupported_query_intent"
  | "not_found"
  | "execution_error"
  | "parser_error";

export interface PeriodEvidence {
  start: string;
  endExclusive: string;
}

export interface BankEvidenceRef {
  code: string;
  name?: string;
}

export interface AccountEvidenceRef {
  /** Last 4 digits only - the full account_number is never surfaced here. */
  last4: string;
}

// ---- Summary (the single/handful of headline figures) ---------------------

export interface AmountSummary {
  amount: string;
  currency: "INR";
}

export interface CountSummary {
  count: number;
}

export interface SummaryMetricsSummary {
  count: number;
  debitTotal: string;
  creditTotal: string;
  net: string;
  currency: "INR";
}

export interface ComparisonSummary {
  metric: ComparisonMetric;
  primaryValue: string;
  secondaryValue: string;
  currency?: "INR";
}

export type FinanceSummary =
  | AmountSummary
  | CountSummary
  | SummaryMetricsSummary
  | ComparisonSummary;

// ---- Evidence (discriminated by template/intent) ---------------------------

export interface SpendTotalEvidence {
  template: "transaction_spend_total";
  period?: PeriodEvidence;
  bank?: BankEvidenceRef;
  programId?: number;
  account?: AccountEvidenceRef;
  amount: string;
}

export interface IncomeTotalEvidence {
  template: "transaction_income_total";
  period?: PeriodEvidence;
  bank?: BankEvidenceRef;
  programId?: number;
  account?: AccountEvidenceRef;
  amount: string;
}

export interface TransactionCountEvidence {
  template: "transaction_count";
  period?: PeriodEvidence;
  transactionType?: TransactionType;
  bank?: BankEvidenceRef;
  programId?: number;
  account?: AccountEvidenceRef;
  count: number;
}

export interface BankSpendRanking {
  bankCode: string;
  bankName: string;
  total: string;
}

export interface BankSpendEvidence {
  template: "transaction_spend_by_bank";
  period?: PeriodEvidence;
  rankings: BankSpendRanking[];
}

export interface ProgramSpendRanking {
  programId: number;
  total: string;
}

export interface ProgramSpendEvidence {
  template: "transaction_spend_by_program";
  period?: PeriodEvidence;
  rankings: ProgramSpendRanking[];
}

export interface SummaryEvidence {
  template: "transaction_summary";
  period?: PeriodEvidence;
  count: number;
  debitTotal: string;
  creditTotal: string;
  net: string;
}

/**
 * Safe transaction evidence - deliberately excludes transaction_id
 * (an internal UUID with no product need to surface it; the reference
 * is the human-facing identifier) and never includes utr_number.
 */
export interface TransactionEvidenceRow {
  transactionDate: string;
  transactionType: TransactionType;
  amount: string;
  reference: string | null;
  description: string | null;
  bank?: BankEvidenceRef;
  programId?: number;
}

export interface LargestTransactionEvidence {
  template: "largest_transaction";
  period?: PeriodEvidence;
  transactionType?: TransactionType;
  transaction: TransactionEvidenceRow;
}

export interface TransactionLookupEvidence {
  template: "transaction_lookup";
  transaction: TransactionEvidenceRow;
}

export interface AccountBalanceEvidence {
  template: "account_balance";
  account: AccountEvidenceRef;
  bank?: BankEvidenceRef;
  programId?: number;
  availableBalance: string;
}

export interface ComparisonEvidence {
  template: "financial_comparison";
  metric: ComparisonMetric;
  primaryPeriod: PeriodEvidence;
  secondaryPeriod: PeriodEvidence;
  primaryValue: string;
  secondaryValue: string;
}

export type FinanceEvidence =
  | SpendTotalEvidence
  | IncomeTotalEvidence
  | TransactionCountEvidence
  | BankSpendEvidence
  | ProgramSpendEvidence
  | SummaryEvidence
  | LargestTransactionEvidence
  | TransactionLookupEvidence
  | AccountBalanceEvidence
  | ComparisonEvidence;

/** The only evidence shape used outside the 10 approved templates. */
export interface UnsupportedIntentEvidence {
  intent: string;
}

export interface FormattedFinanceResponse {
  status: FinanceResponseStatus;
  answer: string;
  summary?: FinanceSummary;
  evidence?: FinanceEvidence | UnsupportedIntentEvidence;
}

// ============================================================
// Date/money display helpers (presentation only - never touch the
// underlying value used for the query or the exact DB string returned)
// ============================================================

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

function isExactlyOneCalendarMonth(start: CalendarDate, endExclusive: CalendarDate): boolean {
  if (start.day !== 1) return false;
  const expectedNextMonthStart = toEpochMs({ year: start.year, month: start.month + 1, day: 1 });
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

  const inclusiveEnd = epochToCalendar(toEpochMs(endExclusive) - 24 * 60 * 60 * 1000);

  return `${formatShortDate(start)} – ${formatShortDate(inclusiveEnd)}`;
}

/**
 * Renders a NUMERIC(...) monetary string as Indian Rupees using plain
 * thousands grouping, operating on the string's digits only - never
 * round-trips through Number, so precision can't be lost.
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

/** transaction_date comes back from `pg` as a Date object, not a string. */
function toISODateTimeString(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return value;
  return "";
}

function formatFullDateLabel(value: unknown): string {
  const date = value instanceof Date ? value : new Date(toISODateTimeString(value));
  if (Number.isNaN(date.getTime())) return "an unknown date";
  return `${MONTH_NAMES[date.getUTCMonth()]} ${date.getUTCDate()}, ${date.getUTCFullYear()}`;
}

function periodFromWindow(window?: { startDate: string; endDateExclusive: string }): PeriodEvidence | undefined {
  if (!window) return undefined;
  return { start: window.startDate, endExclusive: window.endDateExclusive };
}

// ============================================================
// Row/intent helpers
// ============================================================

function firstRowStringField(rows: Record<string, unknown>[], key: string): string | undefined {
  const value = rows[0]?.[key];
  return typeof value === "string" ? value : undefined;
}

/**
 * Pulls the last4 the user originally supplied, straight from the
 * validated FinanceIntent - safe to display (it's what the user said),
 * unlike the resolved accountId on the plan, which is an internal UUID.
 */
function accountFilterEvidence(intent: FinanceIntent): AccountEvidenceRef | undefined {
  if ("account" in intent && intent.account) {
    return { last4: intent.account.last4 };
  }
  return undefined;
}

function bankEvidenceFromCode(bankCode: string | undefined): BankEvidenceRef | undefined {
  return bankCode ? { code: bankCode } : undefined;
}

function bankEvidenceFromRow(row: Record<string, unknown>): BankEvidenceRef | undefined {
  if (typeof row.bank_code !== "string") return undefined;
  return {
    code: row.bank_code,
    name: typeof row.bank_name === "string" ? row.bank_name : undefined,
  };
}

function programIdFromRow(row: Record<string, unknown>): number | undefined {
  return row.program_id !== undefined && row.program_id !== null ? Number(row.program_id) : undefined;
}

function transactionEvidenceFromRow(row: Record<string, unknown>): TransactionEvidenceRow {
  return {
    transactionDate: toISODateTimeString(row.transaction_date),
    transactionType: row.transaction_type as TransactionType,
    amount: String(row.transaction_amount),
    reference: typeof row.transaction_reference_id === "string" ? row.transaction_reference_id : null,
    description: typeof row.description === "string" ? row.description : null,
    bank: bankEvidenceFromRow(row),
    programId: programIdFromRow(row),
  };
}

// ============================================================
// Per-intent formatters
// ============================================================

function formatTransactionSpendTotal(result: QueryPipelineSuccess): FormattedFinanceResponse {
  if (result.plan.intent !== "transaction_spend_total") {
    throw new Error("formatTransactionSpendTotal received a mismatched plan");
  }
  const { filters } = result.plan;
  const rawTotal = firstRowStringField(result.rows, "total") ?? "0.00";
  const period = formatPeriodLabel(filters.dateWindow?.startDate, filters.dateWindow?.endDateExclusive);
  const account = accountFilterEvidence(result.intent);

  let clause = "";
  if (filters.bankCode) clause += ` through ${filters.bankCode}`;
  if (filters.programId !== undefined) clause += ` for program ${filters.programId}`;
  if (account) clause += ` for the account ending ${account.last4}`;
  if (period) clause += ` in ${period}`;

  const evidence: SpendTotalEvidence = {
    template: "transaction_spend_total",
    period: periodFromWindow(filters.dateWindow),
    bank: bankEvidenceFromCode(filters.bankCode),
    programId: filters.programId,
    account,
    amount: rawTotal,
  };

  return {
    status: "success",
    answer: `You spent ${formatINR(rawTotal)}${clause}.`,
    summary: { amount: rawTotal, currency: "INR" },
    evidence,
  };
}

function formatTransactionIncomeTotal(result: QueryPipelineSuccess): FormattedFinanceResponse {
  if (result.plan.intent !== "transaction_income_total") {
    throw new Error("formatTransactionIncomeTotal received a mismatched plan");
  }
  const { filters } = result.plan;
  const rawTotal = firstRowStringField(result.rows, "total") ?? "0.00";
  const period = formatPeriodLabel(filters.dateWindow?.startDate, filters.dateWindow?.endDateExclusive);
  const account = accountFilterEvidence(result.intent);

  let clause = "";
  if (filters.bankCode) clause += ` through ${filters.bankCode}`;
  if (filters.programId !== undefined) clause += ` for program ${filters.programId}`;
  if (account) clause += ` for the account ending ${account.last4}`;
  if (period) clause += ` in ${period}`;

  const evidence: IncomeTotalEvidence = {
    template: "transaction_income_total",
    period: periodFromWindow(filters.dateWindow),
    bank: bankEvidenceFromCode(filters.bankCode),
    programId: filters.programId,
    account,
    amount: rawTotal,
  };

  return {
    status: "success",
    answer: `You received ${formatINR(rawTotal)}${clause}.`,
    summary: { amount: rawTotal, currency: "INR" },
    evidence,
  };
}

function formatTransactionCount(result: QueryPipelineSuccess): FormattedFinanceResponse {
  if (result.plan.intent !== "transaction_count") {
    throw new Error("formatTransactionCount received a mismatched plan");
  }
  const { filters, transactionType } = result.plan;
  const rawCount = firstRowStringField(result.rows, "count") ?? "0";
  const count = Number(rawCount);
  const period = formatPeriodLabel(filters.dateWindow?.startDate, filters.dateWindow?.endDateExclusive);

  const verb = count === 1 ? "was" : "were";
  const noun = count === 1 ? "transaction" : "transactions";
  const typePrefix = transactionType ? `${transactionType} ` : "";
  const periodClause = period ? ` in ${period}` : "";

  const evidence: TransactionCountEvidence = {
    template: "transaction_count",
    period: periodFromWindow(filters.dateWindow),
    transactionType,
    bank: bankEvidenceFromCode(filters.bankCode),
    programId: filters.programId,
    account: accountFilterEvidence(result.intent),
    count,
  };

  return {
    status: "success",
    answer: `There ${verb} ${count} ${typePrefix}${noun}${periodClause}.`,
    summary: { count },
    evidence,
  };
}

function formatTransactionSpendByBank(result: QueryPipelineSuccess): FormattedFinanceResponse {
  if (result.plan.intent !== "transaction_spend_by_bank") {
    throw new Error("formatTransactionSpendByBank received a mismatched plan");
  }
  const { filters } = result.plan;
  const period = formatPeriodLabel(filters.dateWindow?.startDate, filters.dateWindow?.endDateExclusive);
  const periodClause = period ? ` for ${period}` : "";

  const rankings: BankSpendRanking[] = result.rows.map((row) => ({
    bankCode: String(row.bank_code),
    bankName: String(row.bank_name),
    total: String(row.total),
  }));

  const evidence: BankSpendEvidence = {
    template: "transaction_spend_by_bank",
    period: periodFromWindow(filters.dateWindow),
    rankings,
  };

  const answer =
    rankings.length > 0
      ? `Here's the breakdown of your debit spend by bank${periodClause}.`
      : `No debit spend was found${periodClause}.`;

  return { status: "success", answer, evidence };
}

function formatTransactionSpendByProgram(result: QueryPipelineSuccess): FormattedFinanceResponse {
  if (result.plan.intent !== "transaction_spend_by_program") {
    throw new Error("formatTransactionSpendByProgram received a mismatched plan");
  }
  const { filters } = result.plan;
  const period = formatPeriodLabel(filters.dateWindow?.startDate, filters.dateWindow?.endDateExclusive);
  const periodClause = period ? ` for ${period}` : "";

  const rankings: ProgramSpendRanking[] = result.rows.map((row) => ({
    programId: Number(row.program_id),
    total: String(row.total),
  }));

  const evidence: ProgramSpendEvidence = {
    template: "transaction_spend_by_program",
    period: periodFromWindow(filters.dateWindow),
    rankings,
  };

  const answer =
    rankings.length > 0
      ? `Here's the breakdown of your debit spend by program${periodClause}.`
      : `No debit spend was found${periodClause}.`;

  return { status: "success", answer, evidence };
}

function formatTransactionSummary(result: QueryPipelineSuccess): FormattedFinanceResponse {
  if (result.plan.intent !== "transaction_summary") {
    throw new Error("formatTransactionSummary received a mismatched plan");
  }
  const { filters } = result.plan;
  const row = result.rows[0];

  const count = Number(row?.count ?? 0);
  const debitTotal = String(row?.debit_total ?? "0.00");
  const creditTotal = String(row?.credit_total ?? "0.00");
  // `net` is used exactly as the database computed it - never
  // recalculated here as creditTotal - debitTotal.
  const net = String(row?.net ?? "0.00");

  const period = formatPeriodLabel(filters.dateWindow?.startDate, filters.dateWindow?.endDateExclusive);
  const scopeClause = period ? `Your ${period} activity` : "Overall, your activity";

  const answer =
    `${scopeClause} included ${count} transaction${count === 1 ? "" : "s"}, with ` +
    `${formatINR(debitTotal)} in debits and ${formatINR(creditTotal)} in credits. ` +
    `Net movement was ${formatINR(net)}.`;

  const evidence: SummaryEvidence = {
    template: "transaction_summary",
    period: periodFromWindow(filters.dateWindow),
    count,
    debitTotal,
    creditTotal,
    net,
  };

  return {
    status: "success",
    answer,
    summary: { count, debitTotal, creditTotal, net, currency: "INR" },
    evidence,
  };
}

function formatLargestTransaction(result: QueryPipelineSuccess): FormattedFinanceResponse {
  if (result.plan.intent !== "largest_transaction") {
    throw new Error("formatLargestTransaction received a mismatched plan");
  }
  const row = result.rows[0];

  if (!row) {
    return { status: "not_found", answer: "No matching transactions were found." };
  }

  const { filters, transactionType } = result.plan;
  const period = formatPeriodLabel(filters.dateWindow?.startDate, filters.dateWindow?.endDateExclusive);
  const periodClause = period ? ` in ${period}` : "";
  const amount = formatINR(String(row.transaction_amount));
  const type = String(row.transaction_type);
  const dateLabel = formatFullDateLabel(row.transaction_date);

  const evidence: LargestTransactionEvidence = {
    template: "largest_transaction",
    period: periodFromWindow(filters.dateWindow),
    transactionType,
    transaction: transactionEvidenceFromRow(row),
  };

  return {
    status: "success",
    answer: `The largest transaction${periodClause} was a ${amount} ${type} on ${dateLabel}.`,
    summary: { amount: String(row.transaction_amount), currency: "INR" },
    evidence,
  };
}

function formatTransactionLookup(result: QueryPipelineSuccess): FormattedFinanceResponse {
  if (result.plan.intent !== "transaction_lookup") {
    throw new Error("formatTransactionLookup received a mismatched plan");
  }
  const row = result.rows[0];

  if (!row) {
    return {
      status: "not_found",
      answer: `I couldn't find a transaction matching reference "${result.plan.transactionReference}".`,
    };
  }

  const amount = formatINR(String(row.transaction_amount));
  const type = String(row.transaction_type);
  const dateLabel = formatFullDateLabel(row.transaction_date);
  const reference = typeof row.transaction_reference_id === "string" ? row.transaction_reference_id : result.plan.transactionReference;

  const evidence: TransactionLookupEvidence = {
    template: "transaction_lookup",
    transaction: transactionEvidenceFromRow(row),
  };

  return {
    status: "success",
    answer: `Transaction ${reference} was a ${amount} ${type} on ${dateLabel}.`,
    summary: { amount: String(row.transaction_amount), currency: "INR" },
    evidence,
  };
}

function formatAccountBalance(result: QueryPipelineSuccess): FormattedFinanceResponse {
  if (result.plan.intent !== "account_balance") {
    throw new Error("formatAccountBalance received a mismatched plan");
  }
  const row = result.rows[0];

  if (!row) {
    return { status: "not_found", answer: "I couldn't find that account." };
  }

  const bankCode = typeof row.bank_code === "string" ? row.bank_code : undefined;
  const last4 = String(row.last4);
  const rawBalance = String(row.available_balance);

  const bankClause = bankCode ? `Your ${bankCode} account` : "The account";

  const evidence: AccountBalanceEvidence = {
    template: "account_balance",
    account: { last4 },
    bank: bankEvidenceFromRow(row),
    programId: programIdFromRow(row),
    availableBalance: rawBalance,
  };

  return {
    status: "success",
    answer: `${bankClause} ending ${last4} has an available balance of ${formatINR(rawBalance)}.`,
    summary: { amount: rawBalance, currency: "INR" },
    evidence,
  };
}

function formatFinancialComparison(result: QueryPipelineSuccess): FormattedFinanceResponse {
  if (result.plan.intent !== "financial_comparison") {
    throw new Error("formatFinancialComparison received a mismatched plan");
  }
  const { metric, primary, secondary } = result.plan;
  const row = result.rows[0];
  const primaryValue = String(row?.primary_value ?? "0");
  const secondaryValue = String(row?.secondary_value ?? "0");

  const primaryLabel = formatPeriodLabel(primary.startDate, primary.endDateExclusive) ?? "the primary period";
  const secondaryLabel = formatPeriodLabel(secondary.startDate, secondary.endDateExclusive) ?? "the secondary period";

  const isCount = metric === "transaction_count";
  const verb = metric === "spend" ? "spent" : metric === "income" ? "received" : "had";
  const noun = isCount ? " transactions" : "";
  const primaryDisplay = isCount ? primaryValue : formatINR(primaryValue);
  const secondaryDisplay = isCount ? secondaryValue : formatINR(secondaryValue);

  const evidence: ComparisonEvidence = {
    template: "financial_comparison",
    metric,
    primaryPeriod: { start: primary.startDate, endExclusive: primary.endDateExclusive },
    secondaryPeriod: { start: secondary.startDate, endExclusive: secondary.endDateExclusive },
    primaryValue,
    secondaryValue,
  };

  const summary: ComparisonSummary = { metric, primaryValue, secondaryValue };
  if (!isCount) summary.currency = "INR";

  return {
    status: "success",
    answer: `You ${verb} ${primaryDisplay}${noun} in ${primaryLabel} versus ${secondaryDisplay}${noun} in ${secondaryLabel}.`,
    summary,
    evidence,
  };
}

function formatSuccess(result: QueryPipelineSuccess): FormattedFinanceResponse {
  switch (result.template) {
    case "transaction_spend_total":
      return formatTransactionSpendTotal(result);
    case "transaction_income_total":
      return formatTransactionIncomeTotal(result);
    case "transaction_count":
      return formatTransactionCount(result);
    case "transaction_spend_by_bank":
      return formatTransactionSpendByBank(result);
    case "transaction_spend_by_program":
      return formatTransactionSpendByProgram(result);
    case "transaction_summary":
      return formatTransactionSummary(result);
    case "largest_transaction":
      return formatLargestTransaction(result);
    case "transaction_lookup":
      return formatTransactionLookup(result);
    case "account_balance":
      return formatAccountBalance(result);
    case "financial_comparison":
      return formatFinancialComparison(result);
    default:
      return {
        status: "unsupported_query_intent",
        answer: `The "${result.template}" response format is not implemented.`,
        evidence: { intent: result.template },
      };
  }
}

/**
 * Converts a ProcessFinanceMessageResult (the /api/chat pipeline's output)
 * into a response the frontend can render directly: a human-readable
 * `answer` plus a deterministic, strongly-typed `evidence` block. Purely
 * a formatting layer - it never calls an LLM, never aggregates, and
 * never invents a value that didn't come back from the database.
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
