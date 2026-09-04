import { describe, expect, it } from "vitest";
import {
  processFinanceMessage,
  type FinanceIntentParser,
} from "./messagePipeline.js";

describe("processFinanceMessage", () => {
  const referenceDate = new Date("2026-09-05T00:00:00Z");

  it("runs a fully parsed intent through planning, templating, and execution", async () => {
    const mockParser: FinanceIntentParser = async () => ({
      status: "success",
      intent: {
        intent: "vendor_payout_total",
        vendor: { name: "Acme Corporation" },
        date_range: { type: "month", year: 2026, month: 8 },
      },
    });

    const result = await processFinanceMessage(
      "How much did we pay Acme Corporation in August?",
      mockParser,
      { referenceDate },
    );

    expect(result.status).toBe("success");
    if (result.status !== "success") return;

    expect(result.template).toBe("vendor_payout_total");
    expect(result.plan.filters.vendorId).toBe(
      "320f8258-34ec-5997-8761-db0a6e0a71a4",
    );
    expect(result.plan.filters.startDate).toBe("2026-08-01");
    expect(result.rows).toHaveLength(1);
  });

  it("surfaces a clarification request from the parser itself", async () => {
    const mockParser: FinanceIntentParser = async () => ({
      status: "clarification",
      question: "Which vendor do you mean?",
    });

    const result = await processFinanceMessage("pay who?", mockParser);

    expect(result.status).toBe("clarification");
    if (result.status === "clarification") {
      expect(result.question).toBe("Which vendor do you mean?");
    }
  });

  it("surfaces clarification requests raised by intent validation", async () => {
    const mockParser: FinanceIntentParser = async () => ({
      status: "success",
      intent: {
        intent: "vendor_payout_total",
        // No date_range - validateIntent requires one for this intent.
      },
    });

    const result = await processFinanceMessage(
      "how much did we pay vendors",
      mockParser,
    );

    expect(result.status).toBe("clarification");
  });

  it("surfaces an unsupported AI intent without touching the query layer", async () => {
    const mockParser: FinanceIntentParser = async () => ({
      status: "unsupported",
      message: "Revenue forecasting is not supported.",
    });

    const result = await processFinanceMessage(
      "tell me a joke",
      mockParser,
    );

    expect(result.status).toBe("unsupported_ai_intent");
  });

  it("surfaces intents with no executable template as unsupported_query_intent", async () => {
    const mockParser: FinanceIntentParser = async () => ({
      status: "success",
      intent: {
        intent: "reconciliation_summary",
        date_range: { type: "last_month" },
      },
    });

    const result = await processFinanceMessage(
      "give me a reconciliation summary",
      mockParser,
      { referenceDate },
    );

    expect(result.status).toBe("unsupported_query_intent");
  });

  it("propagates vendor ambiguity from the query layer as clarification", async () => {
    const mockParser: FinanceIntentParser = async () => ({
      status: "success",
      intent: {
        intent: "vendor_payout_total",
        vendor: { name: "Acme" },
        date_range: { type: "last_month" },
      },
    });

    const result = await processFinanceMessage(
      "how much did we pay acme",
      mockParser,
      { referenceDate },
    );

    expect(result.status).toBe("clarification");
  });

  it("returns not_found for a vendor that does not exist", async () => {
    const mockParser: FinanceIntentParser = async () => ({
      status: "success",
      intent: {
        intent: "vendor_payout_total",
        vendor: { name: "Definitely Not A Vendor" },
        date_range: { type: "last_month" },
      },
    });

    const result = await processFinanceMessage(
      "how much did we pay definitely not a vendor",
      mockParser,
      { referenceDate },
    );

    expect(result.status).toBe("not_found");
  });

  it("converts a throwing parser into a parser_error result instead of rejecting", async () => {
    const mockParser: FinanceIntentParser = async () => {
      throw new Error("Gemini request failed");
    };

    const result = await processFinanceMessage(
      "how much did we pay Acme",
      mockParser,
    );

    expect(result.status).toBe("parser_error");
    if (result.status === "parser_error") {
      expect(result.message).toContain("Gemini request failed");
    }
  });
});
