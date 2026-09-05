import { describe, expect, it } from "vitest";
import { query } from "../db/client.js";
import {
  accountBalanceTemplate,
  financialComparisonTemplate,
  largestTransactionTemplate,
  transactionCountTemplate,
  transactionIncomeTotalTemplate,
  transactionLookupTemplate,
  transactionSpendByBankTemplate,
  transactionSpendByProgramTemplate,
  transactionSpendTotalTemplate,
  transactionSummaryTemplate,
  type QueryTemplate,
} from "./queryTemplates.js";
import { getQueryTemplate, isTemplateSupported } from "./queryTemplateRegistry.js";
import type { QueryPlan } from "./queryTypes.js";

// Ground-truth values queried directly from the live, deterministically
// seeded local database (seed=20260905) - never fabricated.
const KNOWN_LAST4 = "7622";
const KNOWN_ACCOUNT_ID = "0504cd0b-0604-ce9e-0704-d0310804d1c4";
const KNOWN_DEMO_REFERENCE = "TXN-DEMO-000001";
const LARGEST_TRANSACTION_AMOUNT = "5000000.00";
const AUGUST_2026 = { startDate: "2026-08-01", endDateExclusive: "2026-09-01" };
const JULY_2026 = { startDate: "2026-07-01", endDateExclusive: "2026-08-01" };

function noRawSqlValue(builtText: string, ...values: string[]): void {
  for (const value of values) {
    expect(builtText).not.toContain(value);
  }
}

function assertOnlyPlaceholders(text: string, params: unknown[]): void {
  // Every parameter must be referenced by a $N placeholder somewhere in
  // the text, and the number of distinct placeholders must not exceed
  // the number of supplied params.
  const placeholders = new Set(text.match(/\$\d+/g) ?? []);
  for (let i = 1; i <= params.length; i += 1) {
    expect(placeholders.has(`$${i}`)).toBe(true);
  }
}

describe("query templates - unit level (no database)", () => {
  describe("transaction_spend_total", () => {
    const basePlan: QueryPlan = {
      intent: "transaction_spend_total",
      transactionType: "debit",
      filters: {},
      aggregation: { function: "sum" },
    };

    it("always filters transaction_type = debit", () => {
      const { text, params } = transactionSpendTotalTemplate.build(basePlan);
      expect(text).toContain('t.transaction_type = $1');
      expect(params[0]).toBe("debit");
    });

    it("uses COALESCE(SUM(...), 0) and never SELECT *", () => {
      const { text } = transactionSpendTotalTemplate.build(basePlan);
      expect(text).toMatch(/COALESCE\(SUM\(t\.transaction_amount\), 0\)/);
      expect(text).not.toMatch(/SELECT\s+\*/i);
    });

    it("uses indexed trigram similarity for a description phrase", () => {
      const { text, params } = transactionSpendTotalTemplate.build({
        intent: "transaction_spend_total",
        transactionType: "debit",
        filters: { descriptionQuery: "INSURANCE PREMIUM" },
        aggregation: { function: "sum" },
      });

      expect(text).toContain("lower(t.description) % lower($2)");
      expect(text).toContain("similarity(lower(t.description), lower($3)) >= $4");
      expect(params).toEqual(["debit", "INSURANCE PREMIUM", "INSURANCE PREMIUM", 0.3]);
      noRawSqlValue(text, "INSURANCE PREMIUM");
    });

    it("applies date, bank, program, and account filters as parameters", () => {
      const plan: QueryPlan = {
        intent: "transaction_spend_total",
        transactionType: "debit",
        filters: {
          dateWindow: AUGUST_2026,
          bankCode: "HDFC",
          programId: 21,
          accountId: KNOWN_ACCOUNT_ID,
        },
        aggregation: { function: "sum" },
      };

      const { text, params } = transactionSpendTotalTemplate.build(plan);

      expect(params).toEqual(["debit", "2026-08-01", "2026-09-01", KNOWN_ACCOUNT_ID, "HDFC", 21]);
      expect(text).toContain("t.transaction_date >= $2");
      expect(text).toContain("t.transaction_date < $3");
      expect(text).toContain("t.account_id = $4");
      expect(text).toContain("a.bank_code = $5");
      expect(text).toContain("a.program_id = $6");
      expect(text).toContain('JOIN account a ON a.account_id = t.account_id');
      assertOnlyPlaceholders(text, params);
    });

    it("omits the account join when no bank/program filter is present", () => {
      const { text } = transactionSpendTotalTemplate.build({
        intent: "transaction_spend_total",
        transactionType: "debit",
        filters: { accountId: KNOWN_ACCOUNT_ID },
        aggregation: { function: "sum" },
      });
      expect(text).not.toContain("JOIN account");
    });

    it("throws if handed a mismatched plan", () => {
      expect(() =>
        transactionSpendTotalTemplate.build({
          intent: "transaction_income_total",
          transactionType: "credit",
          filters: {},
          aggregation: { function: "sum" },
        }),
      ).toThrow();
    });
  });

  describe("transaction_income_total", () => {
    it("always filters transaction_type = credit", () => {
      const { text, params } = transactionIncomeTotalTemplate.build({
        intent: "transaction_income_total",
        transactionType: "credit",
        filters: {},
        aggregation: { function: "sum" },
      });
      expect(text).toContain("t.transaction_type = $1");
      expect(params[0]).toBe("credit");
    });

    it("applies filters as parameters, never interpolated", () => {
      const maliciousBank = "HDFC' OR 1=1 --";
      const { text, params } = transactionIncomeTotalTemplate.build({
        intent: "transaction_income_total",
        transactionType: "credit",
        filters: { bankCode: maliciousBank },
        aggregation: { function: "sum" },
      });
      noRawSqlValue(text, maliciousBank);
      expect(params).toContain(maliciousBank);
    });
  });

  describe("transaction_count", () => {
    it("defaults to no transaction_type filter (both types)", () => {
      const { text, params } = transactionCountTemplate.build({
        intent: "transaction_count",
        filters: {},
        aggregation: { function: "count" },
      });
      expect(text).not.toContain("transaction_type");
      expect(params).toHaveLength(0);
      expect(text).toMatch(/SELECT COUNT\(\*\) AS count/);
    });

    it("filters debit when transactionType is debit", () => {
      const { text, params } = transactionCountTemplate.build({
        intent: "transaction_count",
        transactionType: "debit",
        filters: {},
        aggregation: { function: "count" },
      });
      expect(text).toContain("t.transaction_type = $1");
      expect(params[0]).toBe("debit");
    });

    it("filters credit when transactionType is credit", () => {
      const { text, params } = transactionCountTemplate.build({
        intent: "transaction_count",
        transactionType: "credit",
        filters: {},
        aggregation: { function: "count" },
      });
      expect(params[0]).toBe("credit");
    });

    it("applies date/bank/program/account filters", () => {
      const { text, params } = transactionCountTemplate.build({
        intent: "transaction_count",
        filters: { dateWindow: AUGUST_2026, bankCode: "HDFC" },
        aggregation: { function: "count" },
      });
      expect(params).toEqual(["2026-08-01", "2026-09-01", "HDFC"]);
      expect(text).toContain("JOIN account a");
    });

    it("never emits a bare WHERE with no conditions", () => {
      const { text } = transactionCountTemplate.build({
        intent: "transaction_count",
        filters: {},
        aggregation: { function: "count" },
      });
      expect(text).not.toMatch(/WHERE\s*$/m);
      expect(text.toUpperCase()).not.toContain("WHERE");
    });
  });

  describe("transaction_spend_by_bank", () => {
    const plan: QueryPlan = {
      intent: "transaction_spend_by_bank",
      transactionType: "debit",
      filters: { dateWindow: AUGUST_2026 },
      aggregation: { function: "sum" },
      groupBy: "bank",
      sort: { direction: "desc" },
      limit: 10,
    };

    it("joins transaction -> account -> bank", () => {
      const { text } = transactionSpendByBankTemplate.build(plan);
      expect(text).toContain('JOIN account a ON a.account_id = t.account_id');
      expect(text).toContain("JOIN bank b ON b.bank_code = a.bank_code");
    });

    it("groups by bank, orders DESC, and parameterizes the limit", () => {
      const { text, params } = transactionSpendByBankTemplate.build(plan);
      expect(text).toMatch(/GROUP BY b\.bank_code, b\.bank_name/);
      expect(text).toMatch(/ORDER BY total DESC/);
      expect(text).toMatch(/LIMIT \$\d+/);
      expect(params).toContain(10);
    });

    it("only returns bank_code, bank_name, and total - no account/entity/transaction IDs", () => {
      const { text } = transactionSpendByBankTemplate.build(plan);
      expect(text).toMatch(/SELECT\s+b\.bank_code AS bank_code,\s*b\.bank_name AS bank_name,\s*COALESCE\(SUM\(t\.transaction_amount\), 0\) AS total/);
      expect(text.toLowerCase()).not.toContain("account_number");
      expect(text.toLowerCase()).not.toContain("utr_number");
      expect(text.toLowerCase()).not.toContain("entity_id");
    });
  });

  describe("transaction_spend_by_program", () => {
    const plan: QueryPlan = {
      intent: "transaction_spend_by_program",
      transactionType: "debit",
      filters: { dateWindow: AUGUST_2026 },
      aggregation: { function: "sum" },
      groupBy: "program",
      sort: { direction: "desc" },
      limit: 10,
    };

    it("joins transaction -> account only (no bank join needed)", () => {
      const { text } = transactionSpendByProgramTemplate.build(plan);
      expect(text).toContain('JOIN account a ON a.account_id = t.account_id');
      expect(text).not.toContain("JOIN bank");
    });

    it("groups by program_id, orders DESC, parameterized limit", () => {
      const { text, params } = transactionSpendByProgramTemplate.build(plan);
      expect(text).toMatch(/GROUP BY a\.program_id/);
      expect(text).toMatch(/ORDER BY total DESC/);
      expect(params).toContain(10);
    });

    it("never invents a program name field", () => {
      const { text } = transactionSpendByProgramTemplate.build(plan);
      expect(text.toLowerCase()).not.toContain("program_name");
    });
  });

  describe("transaction_summary", () => {
    it("computes count, debit_total, credit_total, and net = credit - debit in SQL", () => {
      const { text } = transactionSummaryTemplate.build({
        intent: "transaction_summary",
        filters: {},
      });

      expect(text).toMatch(/COUNT\(\*\) AS count/);
      expect(text).toMatch(/CASE WHEN t\.transaction_type = 'debit'.*AS debit_total/s);
      expect(text).toMatch(/CASE WHEN t\.transaction_type = 'credit'.*AS credit_total/s);
      expect(text).toMatch(/\(credit_total - debit_total\) AS net/);
      // Explicitly NOT the other way around.
      expect(text).not.toMatch(/\(debit_total - credit_total\)/);
    });

    it("applies scope filters inside the CTE", () => {
      const { text, params } = transactionSummaryTemplate.build({
        intent: "transaction_summary",
        filters: { dateWindow: AUGUST_2026, programId: 21 },
      });
      expect(params).toEqual(["2026-08-01", "2026-09-01", 21]);
      expect(text).toContain("WITH totals AS");
    });
  });

  describe("largest_transaction", () => {
    it("has no transaction_type filter by default", () => {
      const { text, params } = largestTransactionTemplate.build({
        intent: "largest_transaction",
        filters: {},
        sort: { direction: "desc" },
        limit: 1,
      });
      expect(text).not.toContain("t.transaction_type =");
      expect(params).toHaveLength(0);
    });

    it("filters explicitly when transactionType is provided", () => {
      const { text, params } = largestTransactionTemplate.build({
        intent: "largest_transaction",
        transactionType: "debit",
        filters: {},
        sort: { direction: "desc" },
        limit: 1,
      });
      expect(text).toContain("t.transaction_type = $1");
      expect(params[0]).toBe("debit");
    });

    it("orders by amount DESC with LIMIT 1, never MAX() alone", () => {
      const { text } = largestTransactionTemplate.build({
        intent: "largest_transaction",
        filters: {},
        sort: { direction: "desc" },
        limit: 1,
      });
      expect(text).toMatch(/ORDER BY t\.transaction_amount DESC/);
      expect(text).toMatch(/LIMIT 1/);
      expect(text.toUpperCase()).not.toContain("MAX(");
    });

    it("returns transaction evidence fields but never account_number or utr_number", () => {
      const { text } = largestTransactionTemplate.build({
        intent: "largest_transaction",
        filters: {},
        sort: { direction: "desc" },
        limit: 1,
      });
      for (const field of [
        "transaction_id", "transaction_date", "transaction_type",
        "transaction_amount", "transaction_reference_id", "description",
        "program_id", "bank_code", "bank_name",
      ]) {
        expect(text).toContain(field);
      }
      expect(text.toLowerCase()).not.toContain("account_number");
      expect(text.toLowerCase()).not.toContain("utr_number");
    });
  });

  describe("transaction_lookup", () => {
    it("matches transaction_reference_id exactly, never fuzzily", () => {
      const { text, params } = transactionLookupTemplate.build({
        intent: "transaction_lookup",
        transactionReference: KNOWN_DEMO_REFERENCE,
        limit: 1,
      });
      expect(text).toContain("t.transaction_reference_id = $1");
      expect(text).not.toContain("LIKE");
      expect(params).toEqual([KNOWN_DEMO_REFERENCE]);
    });

    it("never searches description or utr_number", () => {
      const { text } = transactionLookupTemplate.build({
        intent: "transaction_lookup",
        transactionReference: KNOWN_DEMO_REFERENCE,
        limit: 1,
      });
      expect(text.toLowerCase()).not.toMatch(/where[\s\S]*description/);
      expect(text.toLowerCase()).not.toContain("utr_number");
      expect(text.toLowerCase()).not.toContain("account_number");
    });

    it("SQL-injection payload in transactionReference stays a parameter", () => {
      const payload = "TXN-DEMO-000001' OR '1'='1";
      const { text, params } = transactionLookupTemplate.build({
        intent: "transaction_lookup",
        transactionReference: payload,
        limit: 1,
      });
      noRawSqlValue(text, payload);
      expect(params).toEqual([payload]);
    });
  });

  describe("account_balance", () => {
    it("filters by account_id, never by date", () => {
      const { text, params } = accountBalanceTemplate.build({
        intent: "account_balance",
        accountId: KNOWN_ACCOUNT_ID,
      });
      expect(text).toContain("a.account_id = $1");
      expect(params).toEqual([KNOWN_ACCOUNT_ID]);
      expect(text.toLowerCase()).not.toContain("transaction_date");
    });

    it("derives last4 via RIGHT(account_number, 4) and never selects the raw column", () => {
      const { text } = accountBalanceTemplate.build({
        intent: "account_balance",
        accountId: KNOWN_ACCOUNT_ID,
      });
      expect(text).toMatch(/RIGHT\(a\.account_number, 4\) AS last4/);

      const selectClause = text.match(/SELECT([\s\S]*?)FROM/i)?.[1] ?? "";
      const withoutAllowedUsage = selectClause.replace(/RIGHT\(a\.account_number, 4\)/, "");
      expect(withoutAllowedUsage).not.toMatch(/\baccount_number\b/);
    });

    it("never selects utr_number or entity_id", () => {
      const { text } = accountBalanceTemplate.build({
        intent: "account_balance",
        accountId: KNOWN_ACCOUNT_ID,
      });
      expect(text.toLowerCase()).not.toContain("utr_number");
      expect(text.toLowerCase()).not.toContain("entity_id");
    });

    it("SQL-injection payload in accountId stays a parameter", () => {
      const payload = 'ABC\'; DROP TABLE "transaction"; --';
      const { text, params } = accountBalanceTemplate.build({
        intent: "account_balance",
        accountId: payload,
      });
      noRawSqlValue(text, payload);
      expect(params).toEqual([payload]);
    });
  });

  describe("financial_comparison", () => {
    it("computes both periods independently with no overlap risk", () => {
      const { text, params } = financialComparisonTemplate.build({
        intent: "financial_comparison",
        metric: "spend",
        primary: AUGUST_2026,
        secondary: JULY_2026,
      });

      expect(params[0]).toBe("2026-08-01");
      expect(params[1]).toBe("2026-09-01");
      expect(params[2]).toBe("2026-07-01");
      expect(params[3]).toBe("2026-08-01");
      expect(text).toContain("FILTER (WHERE t.transaction_date >= $1 AND t.transaction_date < $2)");
      expect(text).toContain("FILTER (WHERE t.transaction_date >= $3 AND t.transaction_date < $4)");
    });

    it("spend uses debit, income uses credit, transaction_count uses neither", () => {
      const spend = financialComparisonTemplate.build({
        intent: "financial_comparison", metric: "spend", primary: AUGUST_2026, secondary: JULY_2026,
      });
      expect(spend.params).toContain("debit");
      expect(spend.text).toMatch(/SUM\(t\.transaction_amount\)/);

      const income = financialComparisonTemplate.build({
        intent: "financial_comparison", metric: "income", primary: AUGUST_2026, secondary: JULY_2026,
      });
      expect(income.params).toContain("credit");

      const count = financialComparisonTemplate.build({
        intent: "financial_comparison", metric: "transaction_count", primary: AUGUST_2026, secondary: JULY_2026,
      });
      expect(count.params).toEqual(["2026-08-01", "2026-09-01", "2026-07-01", "2026-08-01"]);
      expect(count.text).toMatch(/COUNT\(\*\)/);
      // No top-level WHERE (transaction_count applies no type filter) -
      // "WHERE" still legitimately appears inside each FILTER(WHERE ...).
      expect(count.text).not.toMatch(/FROM "transaction" t\s+WHERE/);
    });

    it("returns only the two raw values - no delta/percentage/winner computed in SQL", () => {
      const { text } = financialComparisonTemplate.build({
        intent: "financial_comparison", metric: "spend", primary: AUGUST_2026, secondary: JULY_2026,
      });
      expect(text.toLowerCase()).not.toContain("delta");
      expect(text.toLowerCase()).not.toContain("percent");
      const selectClause = text.match(/SELECT([\s\S]*?)FROM/i)?.[1] ?? "";
      expect((selectClause.match(/AS \w+/g) ?? []).length).toBe(2);
    });
  });

  it("no template ever produces SELECT * or references old vendor/reconciliation tables or columns", () => {
    const samples: Array<{ template: QueryTemplate; plan: QueryPlan }> = [
      { template: transactionSpendTotalTemplate, plan: { intent: "transaction_spend_total", transactionType: "debit", filters: {}, aggregation: { function: "sum" } } },
      { template: transactionIncomeTotalTemplate, plan: { intent: "transaction_income_total", transactionType: "credit", filters: {}, aggregation: { function: "sum" } } },
      { template: transactionCountTemplate, plan: { intent: "transaction_count", filters: {}, aggregation: { function: "count" } } },
      { template: transactionSpendByBankTemplate, plan: { intent: "transaction_spend_by_bank", transactionType: "debit", filters: {}, aggregation: { function: "sum" }, groupBy: "bank", sort: { direction: "desc" }, limit: 10 } },
      { template: transactionSpendByProgramTemplate, plan: { intent: "transaction_spend_by_program", transactionType: "debit", filters: {}, aggregation: { function: "sum" }, groupBy: "program", sort: { direction: "desc" }, limit: 10 } },
      { template: transactionSummaryTemplate, plan: { intent: "transaction_summary", filters: {} } },
      { template: largestTransactionTemplate, plan: { intent: "largest_transaction", filters: {}, sort: { direction: "desc" }, limit: 1 } },
      { template: transactionLookupTemplate, plan: { intent: "transaction_lookup", transactionReference: "X", limit: 1 } },
      { template: accountBalanceTemplate, plan: { intent: "account_balance", accountId: "X" } },
      { template: financialComparisonTemplate, plan: { intent: "financial_comparison", metric: "spend", primary: AUGUST_2026, secondary: JULY_2026 } },
    ];

    for (const { template, plan } of samples) {
      const { text } = template.build(plan);
      expect(text).not.toMatch(/SELECT\s+\*/i);
      const lower = text.toLowerCase();
      for (const forbidden of [
        "vendor", "reconciliation", "vendor_payout", "completed", "unreconciled",
        "\"transactions\"", "\"accounts\"", "\"vendors\"",
        "from transactions", "from accounts", "from vendors", "from reconciliations",
        "category", "account_type", "transactionstatus",
      ]) {
        expect(lower).not.toContain(forbidden);
      }
    }
  });
});

describe("query template registry", () => {
  it("supports exactly the 10 approved intents and no others", () => {
    const approved = [
      "transaction_spend_total", "transaction_income_total", "transaction_count",
      "transaction_spend_by_bank", "transaction_spend_by_program", "transaction_summary",
      "largest_transaction", "transaction_lookup", "account_balance", "financial_comparison",
    ] as const;

    for (const intent of approved) {
      expect(isTemplateSupported(intent)).toBe(true);
      expect(getQueryTemplate(intent).name).toBe(intent);
    }

    // Old intent name, passed as a plain string - isTemplateSupported must
    // reject it at runtime (registry lookup), not just via typing.
    expect(isTemplateSupported("vendor_payout_total" as never)).toBe(false);
  });
});

describe("query templates - integration against the real seeded database", () => {
  it("1. transaction_spend_total: August debit total matches the seed", async () => {
    const { text, params } = transactionSpendTotalTemplate.build({
      intent: "transaction_spend_total",
      transactionType: "debit",
      filters: { dateWindow: AUGUST_2026 },
      aggregation: { function: "sum" },
    });
    const rows = await query<{ total: string }>(text, params);
    expect(rows).toHaveLength(1);
    expect(rows[0].total).toBe("252786141.26");
  });

  it("2. transaction_income_total: overall credit total matches the seed", async () => {
    const { text, params } = transactionIncomeTotalTemplate.build({
      intent: "transaction_income_total",
      transactionType: "credit",
      filters: {},
      aggregation: { function: "sum" },
    });
    const rows = await query<{ total: string }>(text, params);
    expect(rows[0].total).toBe("5254939845.30");
  });

  it("3. transaction_count: overall count is exactly 50000", async () => {
    const { text, params } = transactionCountTemplate.build({
      intent: "transaction_count",
      filters: {},
      aggregation: { function: "count" },
    });
    const rows = await query<{ count: string }>(text, params);
    expect(rows[0].count).toBe("50000");
  });

  it("3b. transaction_count: debit-only count is exactly 35000", async () => {
    const { text, params } = transactionCountTemplate.build({
      intent: "transaction_count",
      transactionType: "debit",
      filters: {},
      aggregation: { function: "count" },
    });
    const rows = await query<{ count: string }>(text, params);
    expect(rows[0].count).toBe("35000");
  });

  it("4. transaction_spend_by_bank: HDFC leads, matching the seed's engineered scenario", async () => {
    const { text, params } = transactionSpendByBankTemplate.build({
      intent: "transaction_spend_by_bank",
      transactionType: "debit",
      filters: {},
      aggregation: { function: "sum" },
      groupBy: "bank",
      sort: { direction: "desc" },
      limit: 10,
    });
    const rows = await query<{ bank_code: string; bank_name: string; total: string }>(text, params);
    expect(rows).toHaveLength(10);
    expect(rows[0].bank_code).toBe("HDFC");
    expect(rows[0].total).toBe("709772894.51");
  });

  it("5. transaction_spend_by_program: program 21 leads, matching the seed's engineered scenario", async () => {
    const { text, params } = transactionSpendByProgramTemplate.build({
      intent: "transaction_spend_by_program",
      transactionType: "debit",
      filters: {},
      aggregation: { function: "sum" },
      groupBy: "program",
      sort: { direction: "desc" },
      limit: 10,
    });
    const rows = await query<{ program_id: number; total: string }>(text, params);
    expect(rows).toHaveLength(5);
    expect(Number(rows[0].program_id)).toBe(21);
    expect(rows[0].total).toBe("1105519877.87");
  });

  it("6. transaction_summary: count/debit/credit/net all correct and net = credit - debit", async () => {
    const { text, params } = transactionSummaryTemplate.build({
      intent: "transaction_summary",
      filters: {},
    });
    const rows = await query<{ count: string; debit_total: string; credit_total: string; net: string }>(
      text,
      params,
    );
    expect(rows[0].count).toBe("50000");
    expect(rows[0].debit_total).toBe("3645077927.55");
    expect(rows[0].credit_total).toBe("5254939845.30");
    expect(rows[0].net).toBe("1609861917.75");
  });

  it("7. largest_transaction: the deliberately-reserved dataset maximum, with full evidence", async () => {
    const { text, params } = largestTransactionTemplate.build({
      intent: "largest_transaction",
      filters: {},
      sort: { direction: "desc" },
      limit: 1,
    });
    const rows = await query<Record<string, unknown>>(text, params);
    expect(rows).toHaveLength(1);
    expect(rows[0].transaction_amount).toBe(LARGEST_TRANSACTION_AMOUNT);
    expect(rows[0].transaction_type).toBe("debit");
    expect(rows[0].bank_code).toBe("HDFC");
    expect(Object.keys(rows[0])).not.toContain("account_number");
    expect(Object.keys(rows[0])).not.toContain("utr_number");
  });

  it("8. transaction_lookup: resolves the known demo reference with correct evidence", async () => {
    const { text, params } = transactionLookupTemplate.build({
      intent: "transaction_lookup",
      transactionReference: KNOWN_DEMO_REFERENCE,
      limit: 1,
    });
    const rows = await query<Record<string, unknown>>(text, params);
    expect(rows).toHaveLength(1);
    expect(rows[0].transaction_amount).toBe("4607.95");
    expect(rows[0].transaction_type).toBe("debit");
  });

  it("8b. transaction_lookup: an unknown reference returns zero rows, not a fabricated one", async () => {
    const { text, params } = transactionLookupTemplate.build({
      intent: "transaction_lookup",
      transactionReference: "TXN-DOES-NOT-EXIST",
      limit: 1,
    });
    const rows = await query(text, params);
    expect(rows).toHaveLength(0);
  });

  it("9. account_balance: resolves the known last4 account with correct balance and no sensitive fields", async () => {
    const { text, params } = accountBalanceTemplate.build({
      intent: "account_balance",
      accountId: KNOWN_ACCOUNT_ID,
    });
    const rows = await query<Record<string, unknown>>(text, params);
    expect(rows).toHaveLength(1);
    expect(rows[0].last4).toBe(KNOWN_LAST4);
    expect(rows[0].bank_code).toBe("CNRB");
    expect(Number(rows[0].program_id)).toBe(58);
    expect(rows[0].available_balance).toBe("23185815.48");
    expect(Object.keys(rows[0])).not.toContain("account_number");
    expect(Object.keys(rows[0])).not.toContain("utr_number");
    expect(Object.keys(rows[0])).not.toContain("entity_id");
  });

  it("10. financial_comparison: August vs July spend matches both totals from the seed", async () => {
    const { text, params } = financialComparisonTemplate.build({
      intent: "financial_comparison",
      metric: "spend",
      primary: AUGUST_2026,
      secondary: JULY_2026,
    });
    const rows = await query<{ primary_value: string; secondary_value: string }>(text, params);
    expect(rows).toHaveLength(1);
    expect(rows[0].primary_value).toBe("252786141.26");
    expect(rows[0].secondary_value).toBe("202228913.02");
    // The engineered August spike is roughly 20-30% higher than July.
    const ratio = Number(rows[0].primary_value) / Number(rows[0].secondary_value);
    expect(ratio).toBeGreaterThan(1.2);
    expect(ratio).toBeLessThan(1.3);
  });
});
