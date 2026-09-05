import { describe, expect, it } from "vitest";
import { buildQueryPlan } from "./queryPlanner.js";
import {
  getQueryTemplate,
  isTemplateSupported,
} from "./queryTemplateRegistry.js";

describe("intent -> QueryPlanner -> QueryTemplateRegistry -> BuiltQuery", () => {
  const referenceDate = new Date("2026-09-05T00:00:00Z");

  it("builds a query for vendor_payout_total", async () => {
    const planResult = await buildQueryPlan(
      {
        intent: "vendor_payout_total",
        date_range: { type: "last_month" },
      },
      referenceDate,
    );

    expect(planResult.status).toBe("success");
    if (planResult.status !== "success") return;

    expect(isTemplateSupported(planResult.plan.intent)).toBe(true);
    if (!isTemplateSupported(planResult.plan.intent)) return;

    const template = getQueryTemplate(planResult.plan.intent);
    const built = template.build(planResult.plan);

    expect(built.text).toContain("t.status = $2");
    expect(built.params).toEqual([
      "VENDOR_PAYOUT",
      "COMPLETED",
      "2026-08-01",
      "2026-09-01",
    ]);
  });

  it("builds a query for vendor_payout_by_vendor", async () => {
    const planResult = await buildQueryPlan(
      {
        intent: "vendor_payout_by_vendor",
        date_range: { type: "month", year: 2026, month: 8 },
      },
      referenceDate,
    );

    expect(planResult.status).toBe("success");
    if (planResult.status !== "success") return;

    expect(isTemplateSupported(planResult.plan.intent)).toBe(true);
    if (!isTemplateSupported(planResult.plan.intent)) return;

    const template = getQueryTemplate(planResult.plan.intent);
    const built = template.build(planResult.plan);

    expect(built.text).toContain("GROUP BY v.id, v.vendor_code, v.name");
    expect(built.text).toContain("ORDER BY total DESC");
    expect(built.params.at(-1)).toBe(10);
  });

  it("builds a query for unreconciled_transactions", async () => {
    const planResult = await buildQueryPlan(
      {
        intent: "unreconciled_transactions",
        date_range: { type: "last_month" },
      },
      referenceDate,
    );

    expect(planResult.status).toBe("success");
    if (planResult.status !== "success") return;

    expect(isTemplateSupported(planResult.plan.intent)).toBe(true);
    if (!isTemplateSupported(planResult.plan.intent)) return;

    const template = getQueryTemplate(planResult.plan.intent);
    const built = template.build(planResult.plan);

    expect(built.text).toContain(
      "JOIN reconciliations r ON r.transaction_id = t.id",
    );
    expect(built.params).toContain("UNRECONCILED");
  });

  it("marks all supported finance intents as executable", () => {
    expect(isTemplateSupported("reconciliation_summary")).toBe(true);
    expect(isTemplateSupported("transaction_lookup")).toBe(true);
    expect(isTemplateSupported("financial_comparison")).toBe(true);
    expect(isTemplateSupported("transaction_spend_total")).toBe(true);
    expect(isTemplateSupported("vendor_payout_largest")).toBe(true);
  });
});
