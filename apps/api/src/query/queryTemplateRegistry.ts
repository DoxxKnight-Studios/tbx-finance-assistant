import type { IntentName } from "../ai/types.js";
import type { QueryTemplate } from "./queryTemplates.js";
import {
  unreconciledTransactionsTemplate,
  vendorPayoutByVendorTemplate,
  vendorPayoutTotalTemplate,
} from "./queryTemplates.js";

/**
 * Intents that currently have a predefined SQL template. This is
 * intentionally a strict subset of IntentName - an intent must be added
 * here explicitly (with a real template) before it becomes executable.
 */
export type SupportedTemplateIntent =
  | "vendor_payout_total"
  | "vendor_payout_by_vendor"
  | "unreconciled_transactions";

const queryTemplateRegistry: Record<
  SupportedTemplateIntent,
  QueryTemplate
> = {
  vendor_payout_total: vendorPayoutTotalTemplate,
  vendor_payout_by_vendor: vendorPayoutByVendorTemplate,
  unreconciled_transactions: unreconciledTransactionsTemplate,
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
