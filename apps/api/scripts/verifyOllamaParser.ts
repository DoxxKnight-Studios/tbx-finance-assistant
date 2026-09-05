/**
 * Verification script for testing Ollama local model integration.
 * Connects to Ollama (granite4.2:3b by default with thinking "low").
 *
 * Run with:
 *   npx tsx scripts/verifyOllamaParser.ts
 */
import { parseFinanceIntentSafe } from "../src/ai/intentParser.js";
import { env } from "../src/config/env.js";

const scenarios = [
  {
    label: "Scenario 1: Spend in August",
    message: "How much did we spend in August?",
    expected: "status: success, intent: transaction_spend_total with August 2026",
  },
  {
    label: "Scenario 2: Clarification request",
    message: "What is my balance?",
    expected: "status: clarification, question asking which account",
  },
  {
    label: "Scenario 3: Unsupported request",
    message: "tell me a joke",
    expected: "status: unsupported, message stating jokes are not supported",
  },
  {
    label: "Scenario 4: Filter by Bank",
    message: "How many debit transactions were made through HDFC?",
    expected: "status: success, intent: transaction_count, bank: HDFC, transaction_type: debit",
  },
];

async function main(): Promise<void> {
  console.log("==================================================");
  console.log("  Testing Local AI Parser with Ollama");
  console.log(`  Provider: ${env.aiProvider}`);
  console.log(`  Base URL: ${env.ollamaBaseUrl}`);
  console.log(`  Model:    ${env.ollamaModel}`);
  console.log(`  Thinking: ${env.ollamaThinking}`);
  console.log("==================================================");

  let passed = 0;

  for (const scenario of scenarios) {
    console.log(`\n--- ${scenario.label} ---`);
    console.log(`Prompt:   "${scenario.message}"`);
    console.log(`Expected: ${scenario.expected}`);

    const startTime = Date.now();
    const result = await parseFinanceIntentSafe(scenario.message);
    const duration = Date.now() - startTime;

    console.log(`Elapsed:  ${duration}ms`);

    if (!result.success) {
      console.error(`Status:   FAILED (${result.errorType})`);
      console.error(`Message:  ${result.message}`);
      if (result.raw) {
        console.error(`Raw LLM:  ${result.raw}`);
      }
    } else {
      passed++;
      console.log(`Status:   SUCCESS`);
      console.log("Parsed:", JSON.stringify(result.data, null, 2));
    }
  }

  console.log("\n==================================================");
  console.log(`Summary: ${passed}/${scenarios.length} scenarios executed successfully.`);
  console.log("==================================================");
}

main().catch((err) => {
  console.error("Fatal error in verifyOllamaParser:", err);
  process.exit(1);
});
