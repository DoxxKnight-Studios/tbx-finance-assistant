import { describe, expect, it } from "vitest";
import {
  processFinanceMessage,
  type FinanceIntentParser,
} from "./messagePipeline.js";
import type { ConversationContext } from "./conversationContext.js";

// A real account known to exist in the deterministic Phase 3 seed
// (seed=20260905) - used wherever a test needs a last4 that actually
// resolves against the live database.
const KNOWN_LAST4 = "7622";

/**
 * As of Phase 7, every one of the 10 approved intents has a real,
 * registered SQL template - these tests exercise the full
 * parse -> validate -> plan -> template -> execute pipeline against the
 * real seeded local database, not a mock of one. (Earlier phases'
 * versions of this file asserted "unsupported_query_intent" here,
 * because no template existed yet; Phase 7 completed that, so those
 * assertions were updated to match.)
 */
describe("processFinanceMessage - new FinanceIntent contract", () => {
  const referenceDate = new Date("2026-09-05T00:00:00Z");

  it("forwards previous context and preserves clarification context", async () => {
    let receivedContext: ConversationContext | null | undefined;
    const previousContext: ConversationContext = {
      intent: "transaction_spend_total",
      date_range: { type: "month", year: 2026, month: 8 },
    };

    const result = await processFinanceMessage(
      "What about July?",
      async (_message, context) => {
        receivedContext = context;
        return {
          status: "clarification",
          question: "Which account should I use?",
          partialIntent: previousContext,
        };
      },
      { previousContext, referenceDate },
    );

    expect(receivedContext).toEqual(previousContext);
    expect(result.status).toBe("clarification");
    if (result.status === "clarification") {
      expect(result.conversationContext).toEqual(previousContext);
    }
  });

  it("runs a valid new-contract intent all the way through to a real result", async () => {
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

    expect(result.status).toBe("success");
    if (result.status === "success") {
      expect(result.template).toBe("transaction_spend_total");
      expect(result.rows).toHaveLength(1);
      expect(typeof result.rows[0].total).toBe("string");
    }
  });

  it("passes every approved intent through to a real, non-error result", async () => {
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
        intent: { intent: "account_balance", account: { last4: KNOWN_LAST4 } },
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
      // The one invariant that matters at this layer: a structurally
      // valid intent for any approved template never comes back as
      // parser_error or unsupported_query_intent now that Phase 7 has
      // registered a template for all 10.
      expect(result.status).toBe("success");
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
 * instructs Gemini to do), the pipeline carries it through to a real
 * result, end to end, against the real seeded database. Whether the real
 * Gemini integration actually performs each merge correctly is a
 * prompt-engineering question, checked separately via the manual
 * scripts/verifyGeminiParser.ts smoke test against a live model - not by
 * this suite.
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

    expect(result.status).toBe("success");
    if (result.status === "success") {
      expect(result.plan.intent).toBe("transaction_spend_total");
      if (result.plan.intent === "transaction_spend_total") {
        expect(result.plan.filters.dateWindow).toEqual({
          startDate: "2026-07-01",
          endDateExclusive: "2026-08-01",
        });
      }
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

    expect(result.status).toBe("success");
    if (result.status === "success" && result.plan.intent === "transaction_spend_total") {
      expect(result.plan.filters.dateWindow?.startDate).toBe("2026-08-01");
      expect(result.plan.filters.bankCode).toBe("HDFC");
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

    expect(result.status).toBe("success");
    if (result.status === "success") {
      expect(result.template).toBe("transaction_spend_by_bank");
      if (result.plan.intent === "transaction_spend_by_bank") {
        expect(result.plan.filters.dateWindow?.startDate).toBe("2026-08-01");
      }
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
        account: { last4: KNOWN_LAST4 },
      },
    });

    const result = await processFinanceMessage(
      `What is the balance of the account ending ${KNOWN_LAST4}?`,
      mockParser,
      { referenceDate, previousContext },
    );

    expect(result.status).toBe("success");
    if (result.status === "success") {
      expect(result.template).toBe("account_balance");
      // account_balance's plan type has no date_range/filters field at
      // all - there is nothing for the August date to have attached to.
      expect(Object.keys(result.plan)).not.toContain("filters");
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

    expect(result.status).toBe("success");
    if (result.status === "success" && result.plan.intent === "transaction_spend_by_bank") {
      expect(result.plan.filters.dateWindow?.startDate).toBe("2026-08-01");
      expect(result.plan.filters.bankCode).toBeUndefined();
    }
  });

  it("F. account context: a same-account follow-up can still carry account.last4 forward", async () => {
    const previousContext: ConversationContext = {
      intent: "account_balance",
      account: { last4: KNOWN_LAST4 },
    };

    const mockParser: FinanceIntentParser = async () => ({
      status: "success",
      intent: {
        intent: "transaction_count",
        account: { last4: KNOWN_LAST4 },
        date_range: { type: "this_month" },
      },
    });

    const result = await processFinanceMessage(
      "How many transactions has that account had this month?",
      mockParser,
      { referenceDate, previousContext },
    );

    expect(result.status).toBe("success");
    if (result.status === "success") {
      expect(result.template).toBe("transaction_count");
      expect(result.rows).toHaveLength(1);
      expect(typeof result.rows[0].count).toBe("string");
    }
  });
});
