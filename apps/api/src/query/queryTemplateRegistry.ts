import type { IntentName } from "../ai/types.js";
import type { QueryTemplate } from "./queryTemplates.js";
import {
  financialComparisonTemplate,
  reconciliationSummaryTemplate,
  transactionLookupTemplate,
  transactionSpendByCategoryTemplate,
  transactionSpendByVendorTemplate,
  transactionSpendTotalTemplate,
  unreconciledTransactionsTemplate,
  vendorPayoutByVendorTemplate,
  vendorPayoutLargestTemplate,
  vendorPayoutTotalTemplate,
  transactionAmountFilterTemplate,
} from "./queryTemplates.js";

/**
 * Intents that currently have a predefined SQL template. This is
 * intentionally a strict subset of IntentName - an intent must be added
 * here explicitly (with a real template) before it becomes executable.
 */
export type SupportedTemplateIntent =
  | "vendor_payout_total"
  | "vendor_payout_by_vendor"
  | "vendor_payout_largest"
  | "transaction_spend_total"
  | "transaction_spend_by_vendor"
  | "transaction_spend_by_category"
  | "transaction_lookup"
  | "reconciliation_summary"
  | "financial_comparison";
  | "transaction_amount_filter"
  | "unreconciled_transactions";

const queryTemplateRegistry: Record<
  SupportedTemplateIntent,
  QueryTemplate
> = {
  vendor_payout_total: vendorPayoutTotalTemplate,
  vendor_payout_by_vendor: vendorPayoutByVendorTemplate,
  transaction_amount_filter: transactionAmountFilterTemplate,
  unreconciled_transactions: unreconciledTransactionsTemplate,
  vendor_payout_largest: vendorPayoutLargestTemplate,
  transaction_spend_total: transactionSpendTotalTemplate,
  transaction_spend_by_vendor: transactionSpendByVendorTemplate,
  transaction_spend_by_category: transactionSpendByCategoryTemplate,
  transaction_lookup: transactionLookupTemplate,
  reconciliation_summary: reconciliationSummaryTemplate,
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
