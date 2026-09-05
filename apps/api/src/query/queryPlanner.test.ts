import { describe, expect, it, vi } from "vitest";

/*
 * query() is wrapped (not fully replaced) so bank/account resolution
 * hits the real seeded local Postgres database by default - these are
 * integration tests. Only the ambiguous-bank/ambiguous-account cases
 * override it for one call, because neither the 10-bank nor the
 * 100-account official dataset has a natural collision to test against
 * (see bankResolver.test.ts / accountResolver.test.ts, which use the
 * same technique).
 */
vi.mock("../db/client.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../db/client.js")>();
  return {
    ...actual,
    query: vi.fn(actual.query),
  };
});

import { query } from "../db/client.js";
import { buildQueryPlan } from "./queryPlanner.js";
import { isValidFinanceIntent } from "../ai/validateIntent.js";
import type { FinanceIntent } from "../ai/types.js";

const referenceDate = new Date("2026-09-05T00:00:00Z");

// Known-real values from the deterministic Phase 3 seed (seed=20260905).
const KNOWN_LAST4 = "7622";
const KNOWN_BANK_CODE = "CNRB";
const KNOWN_DEMO_REFERENCE = "TXN-DEMO-000001";

function expectSuccess(result: Awaited<ReturnType<typeof buildQueryPlan>>) {
  expect(result.status).toBe("success");
  if (result.status !== "success") throw new Error("expected success");
  return result.plan;
}

describe("buildQueryPlan - the 10 approved intents", () => {
  it("1. transaction_spend_total in August -> debit + August window + sum", async () => {
    const plan = expectSuccess(
      await buildQueryPlan(
        { intent: "transaction_spend_total", date_range: { type: "month", year: 2026, month: 8 } },
        referenceDate,
      ),
    );

    expect(plan.intent).toBe("transaction_spend_total");
    if (plan.intent !== "transaction_spend_total") return;
    expect(plan.transactionType).toBe("debit");
    expect(plan.aggregation).toEqual({ function: "sum" });
    expect(plan.filters.dateWindow).toEqual({ startDate: "2026-08-01", endDateExclusive: "2026-09-01" });
  });

  it("2. transaction_income_total in August -> credit + August window + sum", async () => {
    const plan = expectSuccess(
      await buildQueryPlan(
        { intent: "transaction_income_total", date_range: { type: "month", year: 2026, month: 8 } },
        referenceDate,
      ),
    );

    expect(plan.intent).toBe("transaction_income_total");
    if (plan.intent !== "transaction_income_total") return;
    expect(plan.transactionType).toBe("credit");
    expect(plan.aggregation).toEqual({ function: "sum" });
    expect(plan.filters.dateWindow).toEqual({ startDate: "2026-08-01", endDateExclusive: "2026-09-01" });
  });

  it("3. transaction_count in August with no transaction_type -> count + no type filter", async () => {
    const plan = expectSuccess(
      await buildQueryPlan(
        { intent: "transaction_count", date_range: { type: "month", year: 2026, month: 8 } },
        referenceDate,
      ),
    );

    expect(plan.intent).toBe("transaction_count");
    if (plan.intent !== "transaction_count") return;
    expect(plan.transactionType).toBeUndefined();
    expect(plan.aggregation).toEqual({ function: "count" });
  });

  it("4. transaction_count debit + August -> count + debit filter", async () => {
    const plan = expectSuccess(
      await buildQueryPlan(
        {
          intent: "transaction_count",
          transaction_type: "debit",
          date_range: { type: "month", year: 2026, month: 8 },
        },
        referenceDate,
      ),
    );

    expect(plan.intent).toBe("transaction_count");
    if (plan.intent !== "transaction_count") return;
    expect(plan.transactionType).toBe("debit");
  });

  it("5. transaction_spend_by_bank in August -> debit + group bank + sort desc + limit", async () => {
    const plan = expectSuccess(
      await buildQueryPlan(
        { intent: "transaction_spend_by_bank", date_range: { type: "month", year: 2026, month: 8 } },
        referenceDate,
      ),
    );

    expect(plan.intent).toBe("transaction_spend_by_bank");
    if (plan.intent !== "transaction_spend_by_bank") return;
    expect(plan.transactionType).toBe("debit");
    expect(plan.groupBy).toBe("bank");
    expect(plan.sort).toEqual({ direction: "desc" });
    expect(plan.limit).toBe(10);
  });

  it("6. transaction_spend_by_program in August -> debit + group program + sort desc + limit", async () => {
    const plan = expectSuccess(
      await buildQueryPlan(
        { intent: "transaction_spend_by_program", date_range: { type: "month", year: 2026, month: 8 } },
        referenceDate,
      ),
    );

    expect(plan.intent).toBe("transaction_spend_by_program");
    if (plan.intent !== "transaction_spend_by_program") return;
    expect(plan.transactionType).toBe("debit");
    expect(plan.groupBy).toBe("program");
    expect(plan.sort).toEqual({ direction: "desc" });
    expect(plan.limit).toBe(10);
  });

  it("7. transaction_summary in August -> deterministic summary plan (no Gemini-chosen metrics)", async () => {
    const plan = expectSuccess(
      await buildQueryPlan(
        { intent: "transaction_summary", date_range: { type: "month", year: 2026, month: 8 } },
        referenceDate,
      ),
    );

    expect(plan.intent).toBe("transaction_summary");
    if (plan.intent !== "transaction_summary") return;
    expect(plan.filters.dateWindow).toEqual({ startDate: "2026-08-01", endDateExclusive: "2026-09-01" });
    // No aggregation/metric-choice field exists on this plan at all - the
    // fixed 4-metric summary contract is implied entirely by the intent.
    expect("aggregation" in plan).toBe(false);
  });

  it("8. largest_transaction in August with no transaction_type -> no type filter + sort desc + limit 1", async () => {
    const plan = expectSuccess(
      await buildQueryPlan(
        { intent: "largest_transaction", date_range: { type: "month", year: 2026, month: 8 } },
        referenceDate,
      ),
    );

    expect(plan.intent).toBe("largest_transaction");
    if (plan.intent !== "largest_transaction") return;
    expect(plan.transactionType).toBeUndefined();
    expect(plan.sort).toEqual({ direction: "desc" });
    expect(plan.limit).toBe(1);
  });

  it('9. largest_transaction "largest debit" -> debit filter + sort desc + limit 1', async () => {
    const plan = expectSuccess(
      await buildQueryPlan({ intent: "largest_transaction", transaction_type: "debit" }, referenceDate),
    );

    expect(plan.intent).toBe("largest_transaction");
    if (plan.intent !== "largest_transaction") return;
    expect(plan.transactionType).toBe("debit");
    expect(plan.limit).toBe(1);
  });

  it("10. transaction_lookup by reference -> exact reference filter", async () => {
    const plan = expectSuccess(
      await buildQueryPlan(
        { intent: "transaction_lookup", transaction_reference: KNOWN_DEMO_REFERENCE },
        referenceDate,
      ),
    );

    expect(plan.intent).toBe("transaction_lookup");
    if (plan.intent !== "transaction_lookup") return;
    expect(plan.transactionReference).toBe(KNOWN_DEMO_REFERENCE);
    expect(plan.limit).toBe(1);
  });

  it("11. account_balance with a known last4 -> resolves to a real accountId", async () => {
    const plan = expectSuccess(
      await buildQueryPlan({ intent: "account_balance", account: { last4: KNOWN_LAST4 } }, referenceDate),
    );

    expect(plan.intent).toBe("account_balance");
    if (plan.intent !== "account_balance") return;
    expect(plan.accountId).toEqual(expect.any(String));
  });

  it("12. financial_comparison August vs July, spend -> two resolved periods + metric", async () => {
    const plan = expectSuccess(
      await buildQueryPlan(
        {
          intent: "financial_comparison",
          comparison: {
            metric: "spend",
            primary: { type: "month", year: 2026, month: 8 },
            secondary: { type: "month", year: 2026, month: 7 },
          },
        },
        referenceDate,
      ),
    );

    expect(plan.intent).toBe("financial_comparison");
    if (plan.intent !== "financial_comparison") return;
    expect(plan.metric).toBe("spend");
    expect(plan.primary).toEqual({ startDate: "2026-08-01", endDateExclusive: "2026-09-01" });
    expect(plan.secondary).toEqual({ startDate: "2026-07-01", endDateExclusive: "2026-08-01" });
  });
});

describe("buildQueryPlan - bank resolution", () => {
  it("resolves a real bank filter to its canonical code", async () => {
    const plan = expectSuccess(
      await buildQueryPlan(
        { intent: "transaction_spend_total", bank: { code: "hdfc" } },
        referenceDate,
      ),
    );

    if (plan.intent !== "transaction_spend_total") throw new Error("wrong intent");
    expect(plan.filters.bankCode).toBe("HDFC");
  });

  it("returns not_found for an unknown bank", async () => {
    const result = await buildQueryPlan(
      { intent: "transaction_spend_total", bank: { code: "Definitely Not A Real Bank" } },
      referenceDate,
    );

    expect(result.status).toBe("not_found");
  });

  it("returns clarification for an ambiguous bank match (mocked)", async () => {
    vi.mocked(query)
      .mockResolvedValueOnce([]) // step 1: no exact bank_code match
      .mockResolvedValueOnce([
        { bank_code: "AAA1", bank_name: "ALPHA BANK OF INDIA" },
        { bank_code: "AAA2", bank_name: "ALPHA BANK LIMITED" },
      ]); // step 2: exact bank_name match, ambiguous

    const result = await buildQueryPlan(
      { intent: "transaction_spend_total", bank: { code: "alpha" } },
      referenceDate,
    );

    expect(result.status).toBe("clarification");
  });

  it("never inherits/invents a bank filter for a ranking intent unless the intent itself supplies one", async () => {
    const plan = expectSuccess(
      await buildQueryPlan({ intent: "transaction_spend_by_bank" }, referenceDate),
    );

    if (plan.intent !== "transaction_spend_by_bank") throw new Error("wrong intent");
    expect(plan.filters.bankCode).toBeUndefined();
  });
});

describe("buildQueryPlan - account resolution", () => {
  it("resolves a known last4 to a real accountId with no full account number anywhere in the plan", async () => {
    const plan = expectSuccess(
      await buildQueryPlan({ intent: "account_balance", account: { last4: KNOWN_LAST4 } }, referenceDate),
    );

    expect(JSON.stringify(plan)).not.toMatch(/\d{14}/);
  });

  it("returns not_found for a structurally valid but unknown last4", async () => {
    // Confirmed absent from the deterministic seed - see accountResolver.test.ts.
    const result = await buildQueryPlan(
      { intent: "account_balance", account: { last4: "0000" } },
      referenceDate,
    );

    expect(result.status).toBe("not_found");
  });

  it("returns clarification for an ambiguous account match (mocked)", async () => {
    vi.mocked(query).mockResolvedValueOnce([
      { account_id: "fake-account-1", last4: "1234", bank_code: "HDFC", program_id: 21 },
      { account_id: "fake-account-2", last4: "1234", bank_code: "ICIC", program_id: 4 },
    ]);

    const result = await buildQueryPlan(
      { intent: "account_balance", account: { last4: "1234" } },
      referenceDate,
    );

    expect(result.status).toBe("clarification");
  });

  it("uses a bank hint to narrow an ambiguous account match down to one (mocked)", async () => {
    // account_balance resolves its bank filter FIRST, then the account -
    // queue the bank's single-row exact-code-match result before the
    // account's ambiguous rows, matching that call order.
    vi.mocked(query)
      .mockResolvedValueOnce([{ bank_code: "HDFC", bank_name: "HDFC BANK LIMITED" }])
      .mockResolvedValueOnce([
        { account_id: "fake-account-1", last4: "1234", bank_code: "HDFC", program_id: 21 },
        { account_id: "fake-account-2", last4: "1234", bank_code: "ICIC", program_id: 4 },
      ]);

    const plan = expectSuccess(
      await buildQueryPlan(
        { intent: "account_balance", account: { last4: "1234" }, bank: { code: "HDFC" } },
        referenceDate,
      ),
    );

    if (plan.intent !== "account_balance") throw new Error("wrong intent");
    expect(plan.accountId).toBe("fake-account-1");
  });
});

describe("buildQueryPlan - date handling", () => {
  it("treats an absent date_range as all-time (no dateWindow), not an error", async () => {
    const plan = expectSuccess(await buildQueryPlan({ intent: "transaction_spend_total" }, referenceDate));

    if (plan.intent !== "transaction_spend_total") throw new Error("wrong intent");
    expect(plan.filters.dateWindow).toBeUndefined();
  });

  it("account_balance never carries a date window - it has no date_range field to inherit from", async () => {
    const plan = expectSuccess(
      await buildQueryPlan({ intent: "account_balance", account: { last4: KNOWN_LAST4 } }, referenceDate),
    );

    expect(Object.keys(plan)).not.toContain("filters");
    expect(JSON.stringify(plan)).not.toContain("dateWindow");
  });

  it("uses the single supplied referenceDate rather than the wall clock", async () => {
    const planA = expectSuccess(
      await buildQueryPlan({ intent: "transaction_spend_total", date_range: { type: "this_month" } }, referenceDate),
    );
    const planB = expectSuccess(
      await buildQueryPlan({ intent: "transaction_spend_total", date_range: { type: "this_month" } }, referenceDate),
    );

    expect(planA).toEqual(planB);
  });
});

describe("buildQueryPlan - defaults are never silently narrowed", () => {
  it("largest_transaction defaults to no transaction_type filter (never debit)", async () => {
    const plan = expectSuccess(await buildQueryPlan({ intent: "largest_transaction" }, referenceDate));
    if (plan.intent !== "largest_transaction") throw new Error("wrong intent");
    expect(plan.transactionType).toBeUndefined();
  });

  it("transaction_count defaults to both transaction types", async () => {
    const plan = expectSuccess(await buildQueryPlan({ intent: "transaction_count" }, referenceDate));
    if (plan.intent !== "transaction_count") throw new Error("wrong intent");
    expect(plan.transactionType).toBeUndefined();
  });
});

describe("buildQueryPlan - never produces SQL or old vendor/reconciliation concepts", () => {
  const sampleIntents: FinanceIntent[] = [
    { intent: "transaction_spend_total" },
    { intent: "transaction_income_total" },
    { intent: "transaction_count" },
    { intent: "transaction_spend_by_bank" },
    { intent: "transaction_spend_by_program" },
    { intent: "transaction_summary" },
    { intent: "largest_transaction" },
    { intent: "transaction_lookup", transaction_reference: KNOWN_DEMO_REFERENCE },
    { intent: "account_balance", account: { last4: KNOWN_LAST4 } },
    {
      intent: "financial_comparison",
      comparison: {
        metric: "spend",
        primary: { type: "this_month" },
        secondary: { type: "last_month" },
      },
    },
  ];

  it("every plan is a plain semantic object - never SQL text and never a vendor/category/reconciliation field", async () => {
    for (const intent of sampleIntents) {
      const result = await buildQueryPlan(intent, referenceDate);
      expect(result.status).toBe("success");
      if (result.status !== "success") continue;

      const serialized = JSON.stringify(result.plan);
      expect(serialized.toLowerCase()).not.toMatch(/\bselect\b|\bfrom\b|\bwhere\b/);
      expect(serialized.toLowerCase()).not.toContain("vendor");
      expect(serialized.toLowerCase()).not.toContain("category");
      expect(serialized.toLowerCase()).not.toContain("reconcil");
      expect(serialized.toLowerCase()).not.toContain("status");
      expect(Object.keys(result.plan)).not.toContain("text");
      expect(Object.keys(result.plan)).not.toContain("params");
    }
  });
});

describe("buildQueryPlan - invalid FinanceIntent never reaches the planner", () => {
  it("isValidFinanceIntent rejects malformed/old-contract data before it would ever reach buildQueryPlan", () => {
    // buildQueryPlan trusts its input is already a validated FinanceIntent
    // (ai/validateIntent.ts's job, upstream in messagePipeline.ts) - it
    // performs no structural validation of its own. This proves the gate
    // that stands between untrusted data and buildQueryPlan actually
    // rejects the shapes that must never arrive here.
    expect(isValidFinanceIntent({ intent: "vendor_payout_total" })).toBe(false);
    expect(isValidFinanceIntent({ intent: "transaction_spend_total", vendor: { name: "Acme" } })).toBe(false);
    expect(isValidFinanceIntent({ intent: "account_balance" })).toBe(false);
    expect(isValidFinanceIntent({ intent: "transaction_lookup" })).toBe(false);
  });
});
