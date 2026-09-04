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
}