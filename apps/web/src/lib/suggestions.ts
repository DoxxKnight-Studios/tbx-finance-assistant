/**
 * The canonical sample question for each of the 10 approved finance
 * intents (see apps/api/src/ai/types.ts) - the single source EmptyState
 * (shown up front) and ChatShell's follow-up SuggestionChips (shown
 * after a reply) both draw from, so there is only ever one place to
 * update. Every question uses real, verifiable scope (August/July
 * 2026, TXN-DEMO-000001, a real seeded account) - never an unsupported
 * vendor/category/reconciliation concept.
 */
export const SUGGESTED_QUESTIONS = [
  "How much did we spend in August 2026?",
  "How much income did we receive in July 2026?",
  "How many transactions did we have in August 2026?",
  "Which bank had the highest spend in August 2026?",
  "Which program had the highest spend in August 2026?",
  "Give me a financial summary for August 2026.",
  "What was our largest transaction?",
  "Find transaction TXN-DEMO-000001.",
  "What is the balance of account ending 7622?",
  "Did we spend more in August than July 2026?",
] as const;
