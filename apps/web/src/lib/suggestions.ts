/**
 * Every suggestion here maps to one of the three intents the query planner
 * actually supports today (vendor_payout_total, vendor_payout_by_vendor,
 * unreconciled_transactions - see apps/api/src/query/queryPlanner.ts).
 * The first one matches the worked example in the API contract exactly.
 */
export const SUGGESTED_QUESTIONS = [
  "How much did we pay Acme Corporation in August?",
  "Which vendors received the most payouts in August?",
  "Show me unreconciled transactions.",
  "How much did we pay all vendors last month?",
] as const;
