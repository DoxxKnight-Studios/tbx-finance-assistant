import { describe, expect, it } from "vitest";
import {
  processFinanceMessage,
  type FinanceIntentParser,
} from "./messagePipeline.js";
import type { ConversationContext } from "./conversationContext.js";

/**
 * These tests exercise the AI contract (parse -> validate -> hand off to
 * the query pipeline) without touching a database. Every one of the new
 * 10 intents deterministically resolves to "unsupported_query_intent"
 * here, because query/queryTemplateRegistry.ts (Phase 5's job, not this
 * phase's) has no template registered for any of them yet -
 * queryPipeline.ts's executeFinanceIntent() checks isTemplateSupported()
 * BEFORE it would ever touch the database, so this is a real,
 * deterministic, DB-free code path today, not a mock of one.
 */
describe("processFinanceMessage - new FinanceIntent contract", () => {
  const referenceDate = new Date("2026-09-05T00:00:00Z");

  it("runs a valid new-contract intent through validation into the query layer", async () => {
    const mockParser: FinanceIntentParser = async () => ({
      status: "success",
      intent: {
        intent: "transaction_spend_total",
        date_range: { type: "month", year: 2026, month: 8 },
        bank: { code: "HDFC" },
      },
    });

    const result = await processFinanceMessage(
      "How much did we spend through HDFC in August?",
      mockParser,
      { referenceDate },
    );

    // No template is registered for any Phase-4 intent yet (that's
    // Phase 5+), so a structurally-valid intent deterministically comes
    // back as unsupported_query_intent rather than a DB error.
    expect(result.status).toBe("unsupported_query_intent");
    if (result.status === "unsupported_query_intent") {
      expect(result.intent.intent).toBe("transaction_spend_total");
    }
  });

  it("passes every approved intent through to the query layer without a parser_error", async () => {
    const intents: FinanceIntentParser[] = [
      async () => ({ status: "success", intent: { intent: "transaction_spend_total" } }),
      async () => ({ status: "success", intent: { intent: "transaction_income_total" } }),
      async () => ({ status: "success", intent: { intent: "transaction_count" } }),
      async () => ({ status: "success", intent: { intent: "transaction_spend_by_bank" } }),
      async () => ({ status: "success", intent: { intent: "transaction_spend_by_program" } }),
      async () => ({ status: "success", intent: { intent: "transaction_summary" } }),
      async () => ({ status: "success", intent: { intent: "largest_transaction" } }),
      async () => ({
        status: "success",
        intent: { intent: "transaction_lookup", transaction_reference: "TXN-DEMO-000007" },
      }),
      async () => ({
        status: "success",
        intent: { intent: "account_balance", account: { last4: "9069" } },
      }),
      async () => ({
        status: "success",
        intent: {
          intent: "financial_comparison",
          comparison: {
            metric: "spend",
            primary: { type: "month", year: 2026, month: 8 },
            secondary: { type: "month", year: 2026, month: 7 },
          },
        },
      }),
    ];

    for (const mockParser of intents) {
      const result = await processFinanceMessage("irrelevant for this parser", mockParser, {
        referenceDate,
      });
      expect(result.status).toBe("unsupported_query_intent");
    }
  });

  it("surfaces a clarification request from the parser itself", async () => {
    const mockParser: FinanceIntentParser = async () => ({
      status: "clarification",
      question: "Which account would you like me to check?",
    });

    const result = await processFinanceMessage("What is my balance?", mockParser);

    expect(result.status).toBe("clarification");
    if (result.status === "clarification") {
      expect(result.question).toBe("Which account would you like me to check?");
    }
  });

  it("surfaces an unsupported AI intent without touching the query layer", async () => {
    const mockParser: FinanceIntentParser = async () => ({
      status: "unsupported",
      message: "Vendor and payee analysis is not supported.",
    });

    const result = await processFinanceMessage("How much did Acme get paid?", mockParser);

    expect(result.status).toBe("unsupported_ai_intent");
    if (result.status === "unsupported_ai_intent") {
      expect(result.message).toBe("Vendor and payee analysis is not supported.");
    }
  });

  it("forwards previousContext to the parser unchanged (multi-turn plumbing)", async () => {
    let receivedContext: unknown;
    const mockParser: FinanceIntentParser = async (_message, previousContext) => {
      receivedContext = previousContext;
      return {
        status: "success",
        intent: {
          intent: "transaction_spend_total",
          date_range: { type: "month", year: 2026, month: 7 },
        },
      };
    };

    const previousContext = {
      intent: "transaction_spend_total",
      date_range: { type: "month", year: 2026, month: 8 },
    };

    await processFinanceMessage("What about July?", mockParser, {
      referenceDate,
      previousContext,
    });

    expect(receivedContext).toEqual(previousContext);
  });

  it("converts a throwing parser into a parser_error result instead of rejecting", async () => {
    const mockParser: FinanceIntentParser = async () => {
      throw new Error("Gemini request failed");
    };

    const result = await processFinanceMessage("how much did we spend", mockParser);

    expect(result.status).toBe("parser_error");
    if (result.status === "parser_error") {
      expect(result.message).toContain("Gemini request failed");
    }
  });
});

/**
 * Which facts survive an intent change is decided entirely inside the
 * Gemini prompt (prompts/intent.ts's worked examples), not by any
 * in-code merge step - there is no deterministic merge function to unit
 * test, and these tests never make a live Gemini call. What these DO
 * prove: (1) ConversationContext types every one of these previous-turn
 * snapshots without `any`/Record<string,unknown>, and (2) once a parser
 * produces the correctly-merged intent (standing in for what the prompt
 * instructs Gemini to do), the pipeline's validation/handoff carries it
 * through byte-for-byte rather than corrupting, rejecting, or silently
 * stripping any part of it. Whether the real Gemini integration actually
 * performs each merge correctly is a prompt-engineering question,
 * checked separately via the manual scripts/verifyGeminiParser.ts smoke
 * test against a live model - not by this suite.
 */
describe("processFinanceMessage - multi-turn fact inheritance (worked examples from the prompt)", () => {
  const referenceDate = new Date("2026-09-05T00:00:00Z");

  it("A. same intent, changed date", async () => {
    const previousContext: ConversationContext = {
      intent: "transaction_spend_total",
      date_range: { type: "month", year: 2026, month: 8 },
    };

    const mockParser: FinanceIntentParser = async () => ({
      status: "success",
      intent: {
        intent: "transaction_spend_total",
        date_range: { type: "month", year: 2026, month: 7 },
      },
    });

    const result = await processFinanceMessage("What about July?", mockParser, {
      referenceDate,
      previousContext,
    });

    expect(result.status).toBe("unsupported_query_intent");
    if (result.status === "unsupported_query_intent") {
      expect(result.intent).toEqual({
        intent: "transaction_spend_total",
        date_range: { type: "month", year: 2026, month: 7 },
      });
    }
  });

  it("B. same intent, added bank filter - the previous date survives", async () => {
    const previousContext: ConversationContext = {
      intent: "transaction_spend_total",
      date_range: { type: "month", year: 2026, month: 8 },
    };

    const mockParser: FinanceIntentParser = async () => ({
      status: "success",
      intent: {
        intent: "transaction_spend_total",
        date_range: { type: "month", year: 2026, month: 8 },
        bank: { code: "HDFC" },
      },
    });

    const result = await processFinanceMessage("What about HDFC?", mockParser, {
      referenceDate,
      previousContext,
    });

    expect(result.status).toBe("unsupported_query_intent");
    if (result.status === "unsupported_query_intent") {
      expect(result.intent).toEqual({
        intent: "transaction_spend_total",
        date_range: { type: "month", year: 2026, month: 8 },
        bank: { code: "HDFC" },
      });
    }
  });

  it("C. intent changes, the relevant date survives", async () => {
    const previousContext: ConversationContext = {
      intent: "transaction_spend_total",
      date_range: { type: "month", year: 2026, month: 8 },
    };

    const mockParser: FinanceIntentParser = async () => ({
      status: "success",
      intent: {
        intent: "transaction_spend_by_bank",
        date_range: { type: "month", year: 2026, month: 8 },
      },
    });

    const result = await processFinanceMessage(
      "Which bank had the highest spend?",
      mockParser,
      { referenceDate, previousContext },
    );

    expect(result.status).toBe("unsupported_query_intent");
    if (result.status === "unsupported_query_intent") {
      expect(result.intent).toEqual({
        intent: "transaction_spend_by_bank",
        date_range: { type: "month", year: 2026, month: 8 },
      });
    }
  });

  it("D. intent changes, the irrelevant historical date is discarded for account_balance", async () => {
    const previousContext: ConversationContext = {
      intent: "transaction_spend_total",
      date_range: { type: "month", year: 2026, month: 8 },
    };

    const mockParser: FinanceIntentParser = async () => ({
      status: "success",
      intent: {
        intent: "account_balance",
        account: { last4: "9069" },
      },
    });

    const result = await processFinanceMessage(
      "What is the balance of the account ending 9069?",
      mockParser,
      { referenceDate, previousContext },
    );

    expect(result.status).toBe("unsupported_query_intent");
    if (result.status === "unsupported_query_intent") {
      expect(result.intent).toEqual({
        intent: "account_balance",
        account: { last4: "9069" },
      });
      expect("date_range" in result.intent).toBe(false);
    }
  });

  it("E. intent changes, the contradictory bank filter is discarded but the date survives", async () => {
    const previousContext: ConversationContext = {
      intent: "transaction_spend_total",
      bank: { code: "HDFC" },
      date_range: { type: "month", year: 2026, month: 8 },
    };

    const mockParser: FinanceIntentParser = async () => ({
      status: "success",
      intent: {
        intent: "transaction_spend_by_bank",
        date_range: { type: "month", year: 2026, month: 8 },
      },
    });

    const result = await processFinanceMessage(
      "Which bank had the highest spend?",
      mockParser,
      { referenceDate, previousContext },
    );

    expect(result.status).toBe("unsupported_query_intent");
    if (result.status === "unsupported_query_intent") {
      expect(result.intent).toEqual({
        intent: "transaction_spend_by_bank",
        date_range: { type: "month", year: 2026, month: 8 },
      });
      expect("bank" in result.intent).toBe(false);
    }
  });

  it("F. account context: a same-account follow-up can still carry account.last4 forward", async () => {
    const previousContext: ConversationContext = {
      intent: "account_balance",
      account: { last4: "9069" },
    };

    const mockParser: FinanceIntentParser = async () => ({
      status: "success",
      intent: {
        intent: "transaction_count",
        account: { last4: "9069" },
        date_range: { type: "this_month" },
      },
    });

    const result = await processFinanceMessage(
      "How many transactions has that account had this month?",
      mockParser,
      { referenceDate, previousContext },
    );

    expect(result.status).toBe("unsupported_query_intent");
    if (result.status === "unsupported_query_intent") {
      expect(result.intent).toEqual({
        intent: "transaction_count",
        account: { last4: "9069" },
        date_range: { type: "this_month" },
      });
    }
  });
});
