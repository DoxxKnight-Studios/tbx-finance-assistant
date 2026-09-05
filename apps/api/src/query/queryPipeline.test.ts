import { describe, expect, it } from "vitest";
import { buildQueryPlan } from "./queryPlanner.js";
import {
  getQueryTemplate,
  isTemplateSupported,
} from "./queryTemplateRegistry.js";

/**
 * Verifies the full FinanceIntent -> buildQueryPlan -> isTemplateSupported
 * -> getQueryTemplate -> template.build() chain end-to-end for a handful
 * of representative intents - the "wiring" between the planner and the
 * registry, distinct from queryPlanner.test.ts (plan construction alone)
 * and queryTemplates.test.ts (template SQL alone, plus its own full
 * per-intent + real-database integration coverage).
 */
describe("intent -> QueryPlanner -> QueryTemplateRegistry -> BuiltQuery", () => {
  const referenceDate = new Date("2026-09-05T00:00:00Z");

  it("wires transaction_spend_total through to a debit-total query", async () => {
    const planResult = await buildQueryPlan(
      { intent: "transaction_spend_total", date_range: { type: "last_month" } },
      referenceDate,
    );

    expect(planResult.status).toBe("success");
    if (planResult.status !== "success") return;

    expect(isTemplateSupported(planResult.plan.intent)).toBe(true);
    if (!isTemplateSupported(planResult.plan.intent)) return;

    const template = getQueryTemplate(planResult.plan.intent);
    const built = template.build(planResult.plan);

    expect(built.text).toContain('t.transaction_type = $1');
    expect(built.params).toEqual(["debit", "2026-08-01", "2026-09-01"]);
  });

  it("wires transaction_spend_by_bank through to a grouped, ranked, limited query", async () => {
    const planResult = await buildQueryPlan(
      { intent: "transaction_spend_by_bank", date_range: { type: "month", year: 2026, month: 8 } },
      referenceDate,
    );

    expect(planResult.status).toBe("success");
    if (planResult.status !== "success") return;

    expect(isTemplateSupported(planResult.plan.intent)).toBe(true);
    if (!isTemplateSupported(planResult.plan.intent)) return;

    const template = getQueryTemplate(planResult.plan.intent);
    const built = template.build(planResult.plan);

    expect(built.text).toContain("GROUP BY b.bank_code, b.bank_name");
    expect(built.text).toContain("ORDER BY total DESC");
    expect(built.params.at(-1)).toBe(10);
  });

  it("wires transaction_lookup through to an exact-reference query", async () => {
    const planResult = await buildQueryPlan(
      { intent: "transaction_lookup", transaction_reference: "TXN-DEMO-000001" },
      referenceDate,
    );

    expect(planResult.status).toBe("success");
    if (planResult.status !== "success") return;

    expect(isTemplateSupported(planResult.plan.intent)).toBe(true);
    if (!isTemplateSupported(planResult.plan.intent)) return;

    const template = getQueryTemplate(planResult.plan.intent);
    const built = template.build(planResult.plan);

    expect(built.text).toContain("t.transaction_reference_id = $1");
    expect(built.params).toEqual(["TXN-DEMO-000001"]);
  });

  it("marks every one of the 10 approved intents as executable, and nothing else", () => {
    const approved = [
      "transaction_spend_total", "transaction_income_total", "transaction_count",
      "transaction_spend_by_bank", "transaction_spend_by_program", "transaction_summary",
      "largest_transaction", "transaction_lookup", "account_balance", "financial_comparison",
    ] as const;

    for (const intent of approved) {
      expect(isTemplateSupported(intent)).toBe(true);
    }

    expect(isTemplateSupported("vendor_payout_total" as never)).toBe(false);
    expect(isTemplateSupported("reconciliation_summary" as never)).toBe(false);
  });
});
