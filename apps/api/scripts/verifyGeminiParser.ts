/**
 * Manual/dev-only verification of the real Gemini-backed parser against
 * the deterministic query pipeline. NOT part of `npm test` - it makes a
 * real Gemini API call and requires GEMINI_API_KEY, plus
 * apps/api/src/ai/intentParser.ts, which currently only exists on the
 * snaehath-devlop branch (not this one). This file lives outside src/
 * (excluded from tsconfig's "include") specifically so its import of
 * that not-yet-merged module doesn't break `tsc --noEmit` today.
 *
 * Run after merging the AI branch and setting GEMINI_API_KEY:
 *   npx tsx scripts/verifyGeminiParser.ts
 */
import { parseFinanceIntent } from "../src/ai/intentParser.js";
import { processFinanceMessage } from "../src/ai/messagePipeline.js";

const referenceDate = new Date();

const scenarios = [
  {
    label: "Unambiguous vendor payout total",
    message: "How much did we pay Acme Corporation in August?",
    expect:
      "status: success, intent: vendor_payout_total, vendor resolved to a single Acme Corporation, database returns the actual total (not hardcoded here).",
  },
  {
    label: "Ambiguous vendor name",
    message: "How much did we pay Acme in August?",
    expect:
      "status: clarification - must NOT silently resolve to one of the multiple Acme-like vendors.",
  },
  {
    label: "Unsupported intent",
    message: "Show me our revenue by account.",
    expect:
      'status: unsupported_ai_intent (parser has no matching intent) or unsupported_query_intent (recognized intent, no template) - either is "fails cleanly", never invented SQL/data.',
  },
];

async function main(): Promise<void> {
  for (const scenario of scenarios) {
    console.log(`\n=== ${scenario.label} ===`);
    console.log(`Message: "${scenario.message}"`);
    console.log(`Expected: ${scenario.expect}`);

    const result = await processFinanceMessage(
      scenario.message,
      parseFinanceIntent,
      { referenceDate },
    );

    console.log("Result:", JSON.stringify(result, null, 2));
  }
}

main().catch((error) => {
  console.error("Verification script failed:", error);
  process.exit(1);
});
