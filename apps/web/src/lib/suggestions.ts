/**
 * Every suggestion maps to one of the 10 approved intents the query
 * planner supports (see apps/api/src/ai/types.ts) and uses real,
 * verifiable scope (August/July 2026, a real seeded account) rather than
 * unsupported vendor/reconciliation concepts.
 */
export const SUGGESTED_QUESTIONS = [
  "How much did we spend in August 2026?",
  "Which bank had the highest spend in August 2026?",
  "What was our largest transaction in August 2026?",
  "Did we spend more in August than July 2026?",
] as const;
