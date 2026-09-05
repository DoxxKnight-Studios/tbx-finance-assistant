import { describe, expect, it } from "vitest";
import { formatFinanceResponse, formatPeriodLabel, formatINR } from "./responseFormatter.js";
import type { QueryPipelineSuccess } from "../query/queryPipeline.js";
import type { ProcessFinanceMessageResult } from "../ai/messagePipeline.js";
import type { FinanceIntent } from "../ai/types.js";
import type { QueryPlan } from "../query/queryTypes.js";

const AUGUST_2026 = { startDate: "2026-08-01", endDateExclusive: "2026-09-01" };
const JULY_2026 = { startDate: "2026-07-01", endDateExclusive: "2026-08-01" };

function success(
  intent: FinanceIntent,
  plan: QueryPlan,
  rows: Record<string, unknown>[],
): QueryPipelineSuccess {
  return { status: "success", intent, plan, template: plan.intent, rows };
}

describe("formatINR / formatPeriodLabel (presentation helpers)", () => {
  it("groups digits and keeps two decimal places without touching precision", () => {
    expect(formatINR("29108400.00")).toBe("₹29,108,400.00");
    expect(formatINR("252786141.26")).toBe("₹252,786,141.26");
  });

  it("renders a full calendar month as 'Month YYYY'", () => {
    expect(formatPeriodLabel("2026-08-01", "2026-09-01")).toBe("August 2026");
  });

  it("renders an arbitrary range as inclusive short dates", () => {
    expect(formatPeriodLabel("2026-08-05", "2026-08-10")).toBe("Aug 5, 2026 – Aug 9, 2026");
  });

  it("returns undefined when no date window exists (all-time)", () => {
    expect(formatPeriodLabel(undefined, undefined)).toBeUndefined();
  });
});

describe("transaction_spend_total", () => {
  it("formats the answer with INR grouping and the resolved period", () => {
    const result = success(
      { intent: "transaction_spend_total", date_range: { type: "month", year: 2026, month: 8 } },
      { intent: "transaction_spend_total", transactionType: "debit", filters: { dateWindow: AUGUST_2026 }, aggregation: { function: "sum" } },
      [{ total: "252786141.26" }],
    );

    const formatted = formatFinanceResponse(result);

    expect(formatted.status).toBe("success");
    expect(formatted.answer).toBe("You spent ₹252,786,141.26 in August 2026.");
    expect(formatted.summary).toEqual({ amount: "252786141.26", currency: "INR" });
  });

  it("includes the description phrase in the spend answer and evidence", () => {
    const result = success(
      { intent: "transaction_spend_total", description_query: "INSURANCE PREMIUM" },
      {
        intent: "transaction_spend_total",
        transactionType: "debit",
        filters: { descriptionQuery: "INSURANCE PREMIUM" },
        aggregation: { function: "sum" },
      },
      [{ total: "12500.00" }],
    );

    const formatted = formatFinanceResponse(result);

    expect(formatted.answer).toBe('You spent ₹12,500.00 matching "INSURANCE PREMIUM".');
    expect(formatted.evidence).toMatchObject({ descriptionQuery: "INSURANCE PREMIUM" });
  });

  it("includes the bank in the answer only when a bank filter is actually present", () => {
    const result = success(
      { intent: "transaction_spend_total", bank: { code: "HDFC" }, date_range: { type: "month", year: 2026, month: 8 } },
      { intent: "transaction_spend_total", transactionType: "debit", filters: { dateWindow: AUGUST_2026, bankCode: "HDFC" }, aggregation: { function: "sum" } },
      [{ total: "709772894.51" }],
    );

    const formatted = formatFinanceResponse(result);
    expect(formatted.answer).toBe("You spent ₹709,772,894.51 through HDFC in August 2026.");
  });

  it("omits period language entirely when there is no date_range (all-time)", () => {
    const result = success(
      { intent: "transaction_spend_total" },
      { intent: "transaction_spend_total", transactionType: "debit", filters: {}, aggregation: { function: "sum" } },
      [{ total: "3645077927.55" }],
    );

    const formatted = formatFinanceResponse(result);
    expect(formatted.answer).toBe("You spent ₹3,645,077,927.55.");
    expect(formatted.answer).not.toContain("in ");
  });

  it("never invents a bank/program/account clause the intent didn't request", () => {
    const result = success(
      { intent: "transaction_spend_total" },
      { intent: "transaction_spend_total", transactionType: "debit", filters: {}, aggregation: { function: "sum" } },
      [{ total: "0.00" }],
    );
    const formatted = formatFinanceResponse(result);
    expect(formatted.answer).toBe("You spent ₹0.00.");
  });

  it("zero-total is a normal success answer, not a not_found", () => {
    const result = success(
      { intent: "transaction_spend_total", date_range: { type: "month", year: 2026, month: 8 } },
      { intent: "transaction_spend_total", transactionType: "debit", filters: { dateWindow: AUGUST_2026 }, aggregation: { function: "sum" } },
      [{ total: "0.00" }],
    );
    const formatted = formatFinanceResponse(result);
    expect(formatted.status).toBe("success");
    expect(formatted.answer).toContain("₹0.00");
  });

  it("keeps the monetary value as a string in both summary and evidence", () => {
    const result = success(
      { intent: "transaction_spend_total" },
      { intent: "transaction_spend_total", transactionType: "debit", filters: {}, aggregation: { function: "sum" } },
      [{ total: "252786141.26" }],
    );
    const formatted = formatFinanceResponse(result);
    expect(typeof formatted.summary?.amount).toBe("string");
    expect(formatted.evidence && "amount" in formatted.evidence ? formatted.evidence.amount : undefined).toBe(
      "252786141.26",
    );
  });

  it("surfaces the account last4 (from the intent) in evidence, never the resolved UUID", () => {
    const result = success(
      { intent: "transaction_spend_total", account: { last4: "7622" } },
      { intent: "transaction_spend_total", transactionType: "debit", filters: { accountId: "0504cd0b-0604-ce9e-0704-d0310804d1c4" }, aggregation: { function: "sum" } },
      [{ total: "100.00" }],
    );
    const formatted = formatFinanceResponse(result);
    const evidence = formatted.evidence as { account?: { last4: string } };
    expect(evidence.account?.last4).toBe("7622");
    expect(JSON.stringify(formatted)).not.toContain("0504cd0b-0604-ce9e-0704-d0310804d1c4");
  });
});

describe("transaction_income_total", () => {
  it("uses 'received', never 'revenue'", () => {
    const result = success(
      { intent: "transaction_income_total", date_range: { type: "month", year: 2026, month: 8 } },
      { intent: "transaction_income_total", transactionType: "credit", filters: { dateWindow: AUGUST_2026 }, aggregation: { function: "sum" } },
      [{ total: "500000000.00" }],
    );
    const formatted = formatFinanceResponse(result);
    expect(formatted.answer).toBe("You received ₹500,000,000.00 in August 2026.");
    expect(formatted.answer.toLowerCase()).not.toContain("revenue");
  });
});

describe("transaction_count", () => {
  it("formats a plain count with no type qualifier", () => {
    const result = success(
      { intent: "transaction_count", date_range: { type: "month", year: 2026, month: 8 } },
      { intent: "transaction_count", filters: { dateWindow: AUGUST_2026 }, aggregation: { function: "count" } },
      [{ count: "823" }],
    );
    const formatted = formatFinanceResponse(result);
    expect(formatted.answer).toBe("There were 823 transactions in August 2026.");
    expect(formatted.summary).toEqual({ count: 823 });
  });

  it("qualifies by transaction_type when explicitly filtered", () => {
    const result = success(
      { intent: "transaction_count", transaction_type: "debit", date_range: { type: "month", year: 2026, month: 8 } },
      { intent: "transaction_count", transactionType: "debit", filters: { dateWindow: AUGUST_2026 }, aggregation: { function: "count" } },
      [{ count: "587" }],
    );
    expect(formatFinanceResponse(result).answer).toBe("There were 587 debit transactions in August 2026.");
  });

  it("uses singular wording for a count of exactly 1", () => {
    const result = success(
      { intent: "transaction_count" },
      { intent: "transaction_count", filters: {}, aggregation: { function: "count" } },
      [{ count: "1" }],
    );
    expect(formatFinanceResponse(result).answer).toBe("There was 1 transaction.");
  });

  it("omits period language when there is no date_range", () => {
    const result = success(
      { intent: "transaction_count" },
      { intent: "transaction_count", filters: {}, aggregation: { function: "count" } },
      [{ count: "823" }],
    );
    expect(formatFinanceResponse(result).answer).toBe("There were 823 transactions.");
  });

  it("a zero count is a normal success answer", () => {
    const result = success(
      { intent: "transaction_count", date_range: { type: "month", year: 2026, month: 8 } },
      { intent: "transaction_count", filters: { dateWindow: AUGUST_2026 }, aggregation: { function: "count" } },
      [{ count: "0" }],
    );
    const formatted = formatFinanceResponse(result);
    expect(formatted.status).toBe("success");
    expect(formatted.answer).toBe("There were 0 transactions in August 2026.");
  });
});

describe("transaction_spend_by_bank", () => {
  const rows = [
    { bank_code: "HDFC", bank_name: "HDFC BANK LIMITED", total: "709772894.51" },
    { bank_code: "ICIC", bank_name: "ICICI BANK LIMITED", total: "566392778.38" },
  ];

  it("never claims a bank 'spent' money - only presents the breakdown", () => {
    const result = success(
      { intent: "transaction_spend_by_bank", date_range: { type: "month", year: 2026, month: 8 } },
      { intent: "transaction_spend_by_bank", transactionType: "debit", filters: { dateWindow: AUGUST_2026 }, aggregation: { function: "sum" }, groupBy: "bank", sort: { direction: "desc" }, limit: 10 },
      rows,
    );
    const formatted = formatFinanceResponse(result);
    expect(formatted.answer).toBe("Here's the breakdown of your debit spend by bank for August 2026.");
    expect(formatted.answer).not.toMatch(/HDFC spent/i);
  });

  it("preserves the ranked rows verbatim as evidence, with no percentages computed", () => {
    const result = success(
      { intent: "transaction_spend_by_bank" },
      { intent: "transaction_spend_by_bank", transactionType: "debit", filters: {}, aggregation: { function: "sum" }, groupBy: "bank", sort: { direction: "desc" }, limit: 10 },
      rows,
    );
    const formatted = formatFinanceResponse(result);
    const evidence = formatted.evidence as { rankings: Array<{ bankCode: string; bankName: string; total: string }> };
    expect(evidence.rankings).toEqual([
      { bankCode: "HDFC", bankName: "HDFC BANK LIMITED", total: "709772894.51" },
      { bankCode: "ICIC", bankName: "ICICI BANK LIMITED", total: "566392778.38" },
    ]);
    expect(JSON.stringify(evidence)).not.toContain("%");
    expect(JSON.stringify(evidence).toLowerCase()).not.toContain("share");
  });

  it("gives a deterministic 'no records' answer for an empty ranking, not a fabricated one", () => {
    const result = success(
      { intent: "transaction_spend_by_bank", date_range: { type: "month", year: 2026, month: 8 } },
      { intent: "transaction_spend_by_bank", transactionType: "debit", filters: { dateWindow: AUGUST_2026 }, aggregation: { function: "sum" }, groupBy: "bank", sort: { direction: "desc" }, limit: 10 },
      [],
    );
    const formatted = formatFinanceResponse(result);
    expect(formatted.status).toBe("success");
    expect(formatted.answer).toBe("No debit spend was found for August 2026.");
  });

  it("never includes account-level data in bank-ranking evidence", () => {
    const result = success(
      { intent: "transaction_spend_by_bank" },
      { intent: "transaction_spend_by_bank", transactionType: "debit", filters: {}, aggregation: { function: "sum" }, groupBy: "bank", sort: { direction: "desc" }, limit: 10 },
      rows,
    );
    const formatted = formatFinanceResponse(result);
    expect(JSON.stringify(formatted).toLowerCase()).not.toContain("account");
  });
});

describe("transaction_spend_by_program", () => {
  it("never invents a program name", () => {
    const result = success(
      { intent: "transaction_spend_by_program", date_range: { type: "month", year: 2026, month: 8 } },
      { intent: "transaction_spend_by_program", transactionType: "debit", filters: { dateWindow: AUGUST_2026 }, aggregation: { function: "sum" }, groupBy: "program", sort: { direction: "desc" }, limit: 10 },
      [{ program_id: 21, total: "1105519877.87" }],
    );
    const formatted = formatFinanceResponse(result);
    expect(formatted.answer).toBe("Here's the breakdown of your debit spend by program for August 2026.");
    const evidence = formatted.evidence as { rankings: Array<{ programId: number; total: string }> };
    expect(evidence.rankings).toEqual([{ programId: 21, total: "1105519877.87" }]);
    expect(JSON.stringify(evidence).toLowerCase()).not.toContain("program_name");
    expect(JSON.stringify(evidence).toLowerCase()).not.toContain("programname");
  });
});

describe("transaction_summary", () => {
  it("uses count/debit_total/credit_total/net exactly as returned - never recomputes net", () => {
    const result = success(
      { intent: "transaction_summary" },
      { intent: "transaction_summary", filters: {} },
      [{ count: "50000", debit_total: "3645077927.55", credit_total: "5254939845.30", net: "1609861917.75" }],
    );

    const formatted = formatFinanceResponse(result);

    expect(formatted.answer).toBe(
      "Overall, your activity included 50000 transactions, with ₹3,645,077,927.55 in debits and " +
        "₹5,254,939,845.30 in credits. Net movement was ₹1,609,861,917.75.",
    );
    expect(formatted.summary).toEqual({
      count: 50000,
      debitTotal: "3645077927.55",
      creditTotal: "5254939845.30",
      net: "1609861917.75",
      currency: "INR",
    });
  });

  it("would surface an intentionally-wrong net from the DB rather than silently correcting it (proves no recomputation)", () => {
    // If the formatter ever recomputed net = credit - debit itself, this
    // deliberately-inconsistent row would be "corrected" to 50.00 instead
    // of passing the (fictitious, wrong-on-purpose) DB value through.
    const result = success(
      { intent: "transaction_summary" },
      { intent: "transaction_summary", filters: {} },
      [{ count: "2", debit_total: "50.00", credit_total: "100.00", net: "999.99" }],
    );
    const formatted = formatFinanceResponse(result);
    expect(formatted.summary).toMatchObject({ net: "999.99" });
    expect(formatted.answer).toContain("₹999.99");
  });

  it("includes the resolved period in the answer when present", () => {
    const result = success(
      { intent: "transaction_summary", date_range: { type: "month", year: 2026, month: 8 } },
      { intent: "transaction_summary", filters: { dateWindow: AUGUST_2026 } },
      [{ count: "10", debit_total: "10.00", credit_total: "20.00", net: "10.00" }],
    );
    expect(formatFinanceResponse(result).answer).toContain("Your August 2026 activity");
  });
});

describe("largest_transaction", () => {
  const row = {
    transaction_id: "0da0fcff-0ea0-fe92-0fa1-002508a0f520",
    transaction_date: new Date("2026-08-14T11:15:00.000Z"),
    transaction_type: "debit",
    transaction_amount: "5000000.00",
    transaction_reference_id: "HDFC20260814035000",
    description: "NEFT - TAX PAYMENT",
    bank_code: "HDFC",
    bank_name: "HDFC BANK LIMITED",
    program_id: 4,
  };

  it("only makes claims supported by the actual row", () => {
    const result = success(
      { intent: "largest_transaction", date_range: { type: "month", year: 2026, month: 8 } },
      { intent: "largest_transaction", filters: { dateWindow: AUGUST_2026 }, sort: { direction: "desc" }, limit: 1 },
      [row],
    );
    const formatted = formatFinanceResponse(result);
    expect(formatted.answer).toBe("The largest transaction in August 2026 was a ₹5,000,000.00 debit on August 14, 2026.");
  });

  it("handles a Date object for transaction_date (as returned by pg) without crashing", () => {
    const result = success(
      { intent: "largest_transaction" },
      { intent: "largest_transaction", filters: {}, sort: { direction: "desc" }, limit: 1 },
      [row],
    );
    expect(() => formatFinanceResponse(result)).not.toThrow();
  });

  it("returns a not_found result for zero matching rows, never a fabricated transaction", () => {
    const result = success(
      { intent: "largest_transaction", date_range: { type: "month", year: 2026, month: 8 } },
      { intent: "largest_transaction", filters: { dateWindow: AUGUST_2026 }, sort: { direction: "desc" }, limit: 1 },
      [],
    );
    const formatted = formatFinanceResponse(result);
    expect(formatted.status).toBe("not_found");
    expect(formatted.summary).toBeUndefined();
  });

  it("evidence carries safe transaction fields only - no transaction_id, account_number, utr_number, or entity_id", () => {
    const result = success(
      { intent: "largest_transaction" },
      { intent: "largest_transaction", filters: {}, sort: { direction: "desc" }, limit: 1 },
      [{ ...row, account_number: "40000000000012349069", utr_number: "HDFC0000000000000001", entity_id: "e1" }],
    );
    const formatted = formatFinanceResponse(result);
    const serialized = JSON.stringify(formatted);

    expect(serialized).not.toContain("0da0fcff-0ea0-fe92-0fa1-002508a0f520"); // transaction_id (internal UUID)
    expect(serialized).not.toContain("40000000000012349069"); // account_number
    expect(serialized).not.toContain("HDFC0000000000000001"); // utr_number
    expect(serialized).not.toContain("entity_id");
    expect(serialized).not.toContain('"e1"');

    const evidence = formatted.evidence as { transaction: Record<string, unknown> };
    expect(evidence.transaction.reference).toBe("HDFC20260814035000");
    expect(evidence.transaction.amount).toBe("5000000.00");
    expect(evidence.transaction.transactionType).toBe("debit");
    expect(evidence.transaction.description).toBe("NEFT - TAX PAYMENT");
  });
});

describe("transaction_lookup", () => {
  const row = {
    transaction_id: "f82cfd14-fb2d-01cd-fa2d-003af52cf85b",
    transaction_date: new Date("2025-01-01T15:14:50.127Z"),
    transaction_type: "debit",
    transaction_amount: "4607.95",
    transaction_reference_id: "TXN-DEMO-000001",
    description: "NEFT - SALARY DISBURSEMENT",
    bank_code: "HDFC",
    bank_name: "HDFC BANK LIMITED",
    program_id: 4,
  };

  it("gives a concise, fact-only answer", () => {
    const result = success(
      { intent: "transaction_lookup", transaction_reference: "TXN-DEMO-000001" },
      { intent: "transaction_lookup", transactionReference: "TXN-DEMO-000001", limit: 1 },
      [row],
    );
    expect(formatFinanceResponse(result).answer).toBe(
      "Transaction TXN-DEMO-000001 was a ₹4,607.95 debit on January 1, 2025.",
    );
  });

  it("returns not_found for zero rows instead of an empty success answer", () => {
    const result = success(
      { intent: "transaction_lookup", transaction_reference: "TXN-DOES-NOT-EXIST" },
      { intent: "transaction_lookup", transactionReference: "TXN-DOES-NOT-EXIST", limit: 1 },
      [],
    );
    const formatted = formatFinanceResponse(result);
    expect(formatted.status).toBe("not_found");
    expect(formatted.answer).toContain("TXN-DOES-NOT-EXIST");
  });

  it("never exposes account_number, utr_number, or entity_id even if a future query accidentally returns them", () => {
    const result = success(
      { intent: "transaction_lookup", transaction_reference: "TXN-DEMO-000001" },
      { intent: "transaction_lookup", transactionReference: "TXN-DEMO-000001", limit: 1 },
      [{ ...row, account_number: "40000000000012349069", utr_number: "HDFC0000000000000001", entity_id: "e1" }],
    );
    const serialized = JSON.stringify(formatFinanceResponse(result));
    expect(serialized).not.toContain("40000000000012349069");
    expect(serialized).not.toContain("HDFC0000000000000001");
    expect(serialized).not.toContain("entity_id");
  });

  it("does not fuzzy-match or expose UTR-based lookup", () => {
    const result = success(
      { intent: "transaction_lookup", transaction_reference: "TXN-DEMO-000001" },
      { intent: "transaction_lookup", transactionReference: "TXN-DEMO-000001", limit: 1 },
      [row],
    );
    const formatted = formatFinanceResponse(result);
    expect(JSON.stringify(formatted).toLowerCase()).not.toContain("utr");
  });
});

describe("account_balance", () => {
  it("uses 'available balance' wording and only a masked/last4 account reference", () => {
    const result = success(
      { intent: "account_balance", account: { last4: "7622" } },
      { intent: "account_balance", accountId: "0504cd0b-0604-ce9e-0704-d0310804d1c4" },
      [{ account_id: "0504cd0b-0604-ce9e-0704-d0310804d1c4", available_balance: "23185815.48", program_id: 58, last4: "7622", bank_code: "CNRB", bank_name: "CANARA BANK" }],
    );

    const formatted = formatFinanceResponse(result);

    expect(formatted.answer).toBe("Your CNRB account ending 7622 has an available balance of ₹23,185,815.48.");
    expect(formatted.answer).toContain("available balance");
    expect(formatted.summary).toEqual({ amount: "23185815.48", currency: "INR" });
  });

  it("never attaches a date/period to the answer or evidence", () => {
    const result = success(
      { intent: "account_balance", account: { last4: "7622" } },
      { intent: "account_balance", accountId: "0504cd0b-0604-ce9e-0704-d0310804d1c4" },
      [{ account_id: "x", available_balance: "100.00", program_id: 58, last4: "7622", bank_code: "CNRB", bank_name: "CANARA BANK" }],
    );
    const formatted = formatFinanceResponse(result);
    expect(JSON.stringify(formatted).toLowerCase()).not.toContain("period");
    expect(JSON.stringify(formatted).toLowerCase()).not.toContain("date");
  });

  it("never exposes the raw account_number, entity_id, or internal account_id", () => {
    const result = success(
      { intent: "account_balance", account: { last4: "7622" } },
      { intent: "account_balance", accountId: "0504cd0b-0604-ce9e-0704-d0310804d1c4" },
      [{ account_id: "0504cd0b-0604-ce9e-0704-d0310804d1c4", account_number: "40000000000012347622", entity_id: "e1", available_balance: "100.00", program_id: 58, last4: "7622", bank_code: "CNRB", bank_name: "CANARA BANK" }],
    );
    const serialized = JSON.stringify(formatFinanceResponse(result));
    expect(serialized).not.toContain("40000000000012347622");
    expect(serialized).not.toContain("0504cd0b-0604-ce9e-0704-d0310804d1c4");
    expect(serialized).not.toContain("entity_id");
    expect(serialized).not.toContain('"e1"');
  });

  it("returns not_found for zero rows rather than fabricating a balance", () => {
    const result = success(
      { intent: "account_balance", account: { last4: "0000" } },
      { intent: "account_balance", accountId: "does-not-exist" },
      [],
    );
    const formatted = formatFinanceResponse(result);
    expect(formatted.status).toBe("not_found");
  });
});

describe("financial_comparison", () => {
  it("clearly labels primary vs secondary periods and uses the raw DB values", () => {
    const result = success(
      {
        intent: "financial_comparison",
        comparison: {
          metric: "spend",
          primary: { type: "month", year: 2026, month: 8 },
          secondary: { type: "month", year: 2026, month: 7 },
        },
      },
      { intent: "financial_comparison", metric: "spend", primary: AUGUST_2026, secondary: JULY_2026 },
      [{ primary_value: "252786141.26", secondary_value: "202228913.02" }],
    );

    const formatted = formatFinanceResponse(result);

    expect(formatted.answer).toBe(
      "You spent ₹252,786,141.26 in August 2026 versus ₹202,228,913.02 in July 2026.",
    );
    expect(formatted.summary).toEqual({
      metric: "spend",
      primaryValue: "252786141.26",
      secondaryValue: "202228913.02",
      currency: "INR",
    });
  });

  it("uses 'received' for the income metric", () => {
    const result = success(
      { intent: "financial_comparison", comparison: { metric: "income", primary: { type: "this_month" }, secondary: { type: "last_month" } } },
      { intent: "financial_comparison", metric: "income", primary: AUGUST_2026, secondary: JULY_2026 },
      [{ primary_value: "100.00", secondary_value: "50.00" }],
    );
    expect(formatFinanceResponse(result).answer).toContain("received");
  });

  it("does not apply currency formatting or an INR symbol for the transaction_count metric", () => {
    const result = success(
      { intent: "financial_comparison", comparison: { metric: "transaction_count", primary: { type: "this_month" }, secondary: { type: "last_month" } } },
      { intent: "financial_comparison", metric: "transaction_count", primary: AUGUST_2026, secondary: JULY_2026 },
      [{ primary_value: "500", secondary_value: "400" }],
    );
    const formatted = formatFinanceResponse(result);
    expect(formatted.answer).not.toContain("₹");
    expect(formatted.summary).toEqual({ metric: "transaction_count", primaryValue: "500", secondaryValue: "400" });
  });

  it("never computes a delta or percentage change - only the two raw values", () => {
    const result = success(
      { intent: "financial_comparison", comparison: { metric: "spend", primary: { type: "this_month" }, secondary: { type: "last_month" } } },
      { intent: "financial_comparison", metric: "spend", primary: AUGUST_2026, secondary: JULY_2026 },
      [{ primary_value: "252786141.26", secondary_value: "202228913.02" }],
    );
    const formatted = formatFinanceResponse(result);
    expect(formatted.answer.toLowerCase()).not.toContain("delta");
    expect(formatted.answer.toLowerCase()).not.toContain("%");
    expect(formatted.summary).not.toHaveProperty("delta");
    expect(formatted.summary).not.toHaveProperty("percentageChange");
  });

  it("evidence carries both periods and the raw metric values", () => {
    const result = success(
      { intent: "financial_comparison", comparison: { metric: "spend", primary: { type: "this_month" }, secondary: { type: "last_month" } } },
      { intent: "financial_comparison", metric: "spend", primary: AUGUST_2026, secondary: JULY_2026 },
      [{ primary_value: "252786141.26", secondary_value: "202228913.02" }],
    );
    const evidence = formatFinanceResponse(result).evidence as {
      primaryPeriod: { start: string; endExclusive: string };
      secondaryPeriod: { start: string; endExclusive: string };
    };
    expect(evidence.primaryPeriod).toEqual(AUGUST_2026 && { start: "2026-08-01", endExclusive: "2026-09-01" });
    expect(evidence.secondaryPeriod).toEqual({ start: "2026-07-01", endExclusive: "2026-08-01" });
  });
});

describe("formatFinanceResponse - non-success statuses continue to work", () => {
  it("passes through clarification", () => {
    const formatted = formatFinanceResponse({ status: "clarification", question: "Which account would you like me to check?" });
    expect(formatted.status).toBe("clarification");
    expect(formatted.answer).toBe("Which account would you like me to check?");
  });

  it("passes through unsupported_ai_intent", () => {
    const formatted = formatFinanceResponse({ status: "unsupported_ai_intent", message: "Vendor and payee analysis is not supported." });
    expect(formatted.status).toBe("unsupported_ai_intent");
  });

  it("passes through not_found (e.g. from bank/account resolution)", () => {
    const formatted: ProcessFinanceMessageResult = { status: "not_found", message: "I couldn't find a bank matching \"Foo\"." };
    expect(formatFinanceResponse(formatted).status).toBe("not_found");
  });

  it("passes through execution_error and parser_error", () => {
    expect(formatFinanceResponse({ status: "execution_error", message: "boom" }).status).toBe("execution_error");
    expect(formatFinanceResponse({ status: "parser_error", message: "boom" }).status).toBe("parser_error");
  });

  it("handles unsupported_query_intent defensively (should be unreachable for the 10 approved intents)", () => {
    const formatted = formatFinanceResponse({
      status: "unsupported_query_intent",
      intent: { intent: "transaction_spend_total" },
      message: 'The "transaction_spend_total" query is not implemented yet.',
    });
    expect(formatted.status).toBe("unsupported_query_intent");
    expect(formatted.evidence).toEqual({ intent: "transaction_spend_total" });
  });
});

describe("security hardening - the formatter is a last line of defense", () => {
  it("never surfaces sensitive keys anywhere in the response, across every intent, even if the row carries them", () => {
    const sensitiveRow = {
      total: "1.00", count: "1", debit_total: "1.00", credit_total: "1.00", net: "0.00",
      bank_code: "HDFC", bank_name: "HDFC BANK LIMITED", program_id: 4,
      transaction_id: "internal-uuid", transaction_date: new Date("2026-08-01T00:00:00Z"),
      transaction_type: "debit", transaction_amount: "1.00", transaction_reference_id: "REF-1",
      description: "TEST", account_id: "internal-account-uuid", available_balance: "1.00",
      last4: "1234", primary_value: "1.00", secondary_value: "1.00",
      account_number: "99999999999999", utr_number: "SECRETUTR12345", entity_id: "SECRETENTITY",
    };

    const plans: QueryPlan[] = [
      { intent: "transaction_spend_total", transactionType: "debit", filters: {}, aggregation: { function: "sum" } },
      { intent: "transaction_income_total", transactionType: "credit", filters: {}, aggregation: { function: "sum" } },
      { intent: "transaction_count", filters: {}, aggregation: { function: "count" } },
      { intent: "transaction_spend_by_bank", transactionType: "debit", filters: {}, aggregation: { function: "sum" }, groupBy: "bank", sort: { direction: "desc" }, limit: 10 },
      { intent: "transaction_spend_by_program", transactionType: "debit", filters: {}, aggregation: { function: "sum" }, groupBy: "program", sort: { direction: "desc" }, limit: 10 },
      { intent: "transaction_summary", filters: {} },
      { intent: "largest_transaction", filters: {}, sort: { direction: "desc" }, limit: 1 },
      { intent: "transaction_lookup", transactionReference: "REF-1", limit: 1 },
      { intent: "account_balance", accountId: "internal-account-uuid" },
      { intent: "financial_comparison", metric: "spend", primary: AUGUST_2026, secondary: JULY_2026 },
    ];

    for (const plan of plans) {
      const result = success({ intent: plan.intent } as FinanceIntent, plan, [sensitiveRow]);
      const serialized = JSON.stringify(formatFinanceResponse(result));

      expect(serialized).not.toContain("99999999999999");
      expect(serialized).not.toContain("SECRETUTR12345");
      expect(serialized).not.toContain("SECRETENTITY");
      expect(serialized.toLowerCase()).not.toContain("account_number");
      expect(serialized.toLowerCase()).not.toContain("utr_number");
      expect(serialized.toLowerCase()).not.toContain("entity_id");
    }
  });
});
