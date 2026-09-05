import { describe, expect, it } from "vitest";
import { toConversationContext, type ConversationContext } from "./conversationContext.js";
import type { FinanceIntent } from "./types.js";

describe("toConversationContext", () => {
  it("carries forward every field a spend-total intent has", () => {
    const intent: FinanceIntent = {
      intent: "transaction_spend_total",
      date_range: { type: "month", year: 2026, month: 8 },
      bank: { code: "HDFC" },
    };

    expect(toConversationContext(intent)).toEqual({
      intent: "transaction_spend_total",
      date_range: { type: "month", year: 2026, month: 8 },
      bank: { code: "HDFC" },
    });
  });

  it("omits fields the source intent didn't have, rather than filling them with undefined", () => {
    const intent: FinanceIntent = { intent: "transaction_spend_by_bank" };

    const context = toConversationContext(intent);

    expect(context).toEqual({ intent: "transaction_spend_by_bank" });
    expect("date_range" in context).toBe(false);
    expect("bank" in context).toBe(false);
  });

  it("carries transaction_reference forward for a lookup intent", () => {
    const intent: FinanceIntent = {
      intent: "transaction_lookup",
      transaction_reference: "TXN-DEMO-000007",
    };

    expect(toConversationContext(intent)).toEqual({
      intent: "transaction_lookup",
      transaction_reference: "TXN-DEMO-000007",
    });
  });

  it("carries account and bank forward for account_balance", () => {
    const intent: FinanceIntent = {
      intent: "account_balance",
      account: { last4: "9069" },
      bank: { code: "HDFC" },
    };

    expect(toConversationContext(intent)).toEqual({
      intent: "account_balance",
      account: { last4: "9069" },
      bank: { code: "HDFC" },
    });
  });

  it("carries the whole comparison object forward for financial_comparison", () => {
    const intent: FinanceIntent = {
      intent: "financial_comparison",
      comparison: {
        metric: "spend",
        primary: { type: "month", year: 2026, month: 8 },
        secondary: { type: "month", year: 2026, month: 7 },
      },
    };

    expect(toConversationContext(intent)).toEqual({
      intent: "financial_comparison",
      comparison: {
        metric: "spend",
        primary: { type: "month", year: 2026, month: 8 },
        secondary: { type: "month", year: 2026, month: 7 },
      },
    });
  });

  it("produces a value assignable to ConversationContext without needing `any`", () => {
    const intent: FinanceIntent = {
      intent: "transaction_count",
      transaction_type: "debit",
      program_id: 21,
    };

    const context: ConversationContext = toConversationContext(intent);
    expect(context.program_id).toBe(21);
    expect(context.transaction_type).toBe("debit");
  });
});
