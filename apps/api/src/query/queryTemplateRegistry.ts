import type { IntentName } from "../ai/types.js";
import type { QueryTemplate } from "./queryTemplates.js";
import {
  accountBalanceTemplate,
  financialComparisonTemplate,
  largestTransactionTemplate,
  transactionCountTemplate,
  transactionIncomeTotalTemplate,
  transactionLookupTemplate,
  transactionSpendByBankTemplate,
  transactionSpendByProgramTemplate,
  transactionSpendTotalTemplate,
  transactionSummaryTemplate,
} from "./queryTemplates.js";

/**
 * Every approved intent has exactly one template - this Record forces
 * that at compile time (a missing or misspelled key is a type error, not
 * a silent runtime gap). No old intents, no dynamically-constructed
 * lookup key.
 */
export type SupportedTemplateIntent = IntentName;

const queryTemplateRegistry: Record<SupportedTemplateIntent, QueryTemplate> = {
  transaction_spend_total: transactionSpendTotalTemplate,
  transaction_income_total: transactionIncomeTotalTemplate,
  transaction_count: transactionCountTemplate,
  transaction_spend_by_bank: transactionSpendByBankTemplate,
  transaction_spend_by_program: transactionSpendByProgramTemplate,
  transaction_summary: transactionSummaryTemplate,
  largest_transaction: largestTransactionTemplate,
  transaction_lookup: transactionLookupTemplate,
  account_balance: accountBalanceTemplate,
  financial_comparison: financialComparisonTemplate,
};

export function isTemplateSupported(
  intent: IntentName,
): intent is SupportedTemplateIntent {
  return Object.prototype.hasOwnProperty.call(
    queryTemplateRegistry,
    intent,
  );
}

export function getQueryTemplate(
  intent: SupportedTemplateIntent,
): QueryTemplate {
  return queryTemplateRegistry[intent];
}
