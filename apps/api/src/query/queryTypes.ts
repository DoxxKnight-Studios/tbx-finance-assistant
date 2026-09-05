import type { ComparisonMetric, TransactionType } from "../ai/types.js";

/**
 * QueryPlan represents semantic query instructions for the official
 * bank/account/"transaction" schema - never SQL, never a table name
 * leaking in from FinanceIntent, never a vendor/category/reconciliation
 * concept. Deliberately a discriminated union (mirroring FinanceIntent's
 * own shape) rather than one loose interface, so illegal combinations -
 * e.g. a transaction_spend_total plan with transactionType "credit", or
 * a transaction_spend_by_bank plan carrying an accountId filter it never
 * supported - are compile errors, not just runtime possibilities.
 */

export interface QueryDateWindow {
  startDate: string;
  endDateExclusive: string;
}

/**
 * Every field here is an already-resolved, deterministic scoping value -
 * dateWindow comes from dateResolver, bankCode from bankResolver,
 * accountId from accountResolver, programId from FinanceIntent's own
 * closed 5-program domain. None of this is raw user text and none of it
 * is SQL.
 */
export interface FullScopeFilters {
  dateWindow?: QueryDateWindow;
  descriptionQuery?: string;
  bankCode?: string;
  programId?: number;
  accountId?: string;
}

/** transaction_spend_by_bank only ever supports these two - never program/account. */
export interface BankScopeFilters {
  dateWindow?: QueryDateWindow;
  bankCode?: string;
}

/** transaction_spend_by_program only ever supports these two - never bank/account. */
export interface ProgramScopeFilters {
  dateWindow?: QueryDateWindow;
  programId?: number;
}

export type QueryAggregationFunction = "sum" | "count";

export interface QueryAggregationSpec {
  function: QueryAggregationFunction;
}

export type QueryGroupBy = "bank" | "program";

export interface QuerySort {
  direction: "asc" | "desc";
}

// ---- Per-intent plans ------------------------------------------------------

export interface TransactionSpendTotalPlan {
  intent: "transaction_spend_total";
  /** Backend invariant, not something the caller can choose. */
  transactionType: "debit";
  filters: FullScopeFilters;
  aggregation: QueryAggregationSpec;
}

export interface TransactionIncomeTotalPlan {
  intent: "transaction_income_total";
  transactionType: "credit";
  filters: FullScopeFilters;
  aggregation: QueryAggregationSpec;
}

export interface TransactionCountPlan {
  intent: "transaction_count";
  /** Omitted = every transaction type. */
  transactionType?: TransactionType;
  filters: FullScopeFilters;
  aggregation: QueryAggregationSpec;
}

export interface TransactionSpendByBankPlan {
  intent: "transaction_spend_by_bank";
  transactionType: "debit";
  filters: BankScopeFilters;
  aggregation: QueryAggregationSpec;
  groupBy: "bank";
  sort: QuerySort;
  limit: number;
}

export interface TransactionSpendByProgramPlan {
  intent: "transaction_spend_by_program";
  transactionType: "debit";
  filters: ProgramScopeFilters;
  aggregation: QueryAggregationSpec;
  groupBy: "program";
  sort: QuerySort;
  limit: number;
}

/**
 * The backend-defined summary contract (total count, total debit,
 * total credit, net) is fixed and implied entirely by this intent name -
 * there is no field here for a caller to choose which metrics appear,
 * because Gemini never gets to decide that (see ai/prompts/intent.ts).
 */
export interface TransactionSummaryPlan {
  intent: "transaction_summary";
  filters: FullScopeFilters;
}

export interface LargestTransactionPlan {
  intent: "largest_transaction";
  /** Omitted = largest transaction of either type - never defaulted to debit. */
  transactionType?: TransactionType;
  filters: FullScopeFilters;
  sort: QuerySort;
  limit: 1;
}

export interface TransactionLookupPlan {
  intent: "transaction_lookup";
  transactionReference: string;
  limit: 1;
}

export interface AccountBalancePlan {
  intent: "account_balance";
  /** Resolved via accountResolver.resolveAccountByLast4 - never the raw account_number. */
  accountId: string;
}

export interface AccountCountPlan {
  intent: "account_count";
}

export interface FinancialComparisonPlan {
  intent: "financial_comparison";
  metric: ComparisonMetric;
  primary: QueryDateWindow;
  secondary: QueryDateWindow;
}

export type QueryPlan =
  | TransactionSpendTotalPlan
  | TransactionIncomeTotalPlan
  | TransactionCountPlan
  | TransactionSpendByBankPlan
  | TransactionSpendByProgramPlan
  | TransactionSummaryPlan
  | LargestTransactionPlan
  | TransactionLookupPlan
  | AccountBalancePlan
  | AccountCountPlan
  | FinancialComparisonPlan;
