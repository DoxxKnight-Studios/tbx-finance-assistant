import type { QueryPlan } from "./queryTypes.js";

export interface BuiltQuery {
  text: string;
  params: unknown[];
}

export interface QueryTemplate {
  name: string;
  build(plan: QueryPlan): BuiltQuery;
}

function addCondition(
  conditions: string[],
  params: unknown[],
  conditionSql: string,
  value: unknown,
): void {
  params.push(value);

  const placeholder = `$${params.length}`;

  conditions.push(
    conditionSql.replace("?", placeholder),
  );
}

function addLimitParam(
  params: unknown[],
  limit: number,
): string {
  params.push(limit);
  return `$${params.length}`;
}

const DEFAULT_VENDOR_RANKING_LIMIT = 10;
const DEFAULT_UNRECONCILED_LIMIT = 20;

export const vendorPayoutTotalTemplate: QueryTemplate = {
  name: "vendor_payout_total",

  build(plan) {
    const conditions: string[] = [];
    const params: unknown[] = [];

    addCondition(
      conditions,
      params,
      "t.transaction_type = ?",
      "VENDOR_PAYOUT",
    );

    // Normal vendor payout totals only count completed transactions;
    // this is a fixed business rule, not something the LLM/intent controls.
    addCondition(
      conditions,
      params,
      "t.status = ?",
      "COMPLETED",
    );

    if (plan.filters.vendorId) {
      addCondition(
        conditions,
        params,
        "t.vendor_id = ?",
        plan.filters.vendorId,
      );
    }

    if (plan.filters.startDate) {
      addCondition(
        conditions,
        params,
        "t.transaction_date >= ?",
        plan.filters.startDate,
      );
    }

    if (plan.filters.endDateExclusive) {
      addCondition(
        conditions,
        params,
        "t.transaction_date < ?",
        plan.filters.endDateExclusive,
      );
    }

    return {
      text: `
        SELECT
          COALESCE(SUM(t.amount), 0) AS total
        FROM transactions t
        WHERE ${conditions.join("\nAND ")}
      `.trim(),

      params,
    };
  },
};

export const vendorPayoutByVendorTemplate: QueryTemplate = {
  name: "vendor_payout_by_vendor",

  build(plan) {
    const conditions: string[] = [];
    const params: unknown[] = [];

    addCondition(
      conditions,
      params,
      "t.transaction_type = ?",
      "VENDOR_PAYOUT",
    );

    // Same completed-only invariant as vendor_payout_total.
    addCondition(
      conditions,
      params,
      "t.status = ?",
      "COMPLETED",
    );

    if (plan.filters.vendorId) {
      addCondition(
        conditions,
        params,
        "t.vendor_id = ?",
        plan.filters.vendorId,
      );
    }

    if (plan.filters.startDate) {
      addCondition(
        conditions,
        params,
        "t.transaction_date >= ?",
        plan.filters.startDate,
      );
    }

    if (plan.filters.endDateExclusive) {
      addCondition(
        conditions,
        params,
        "t.transaction_date < ?",
        plan.filters.endDateExclusive,
      );
    }

    const limitPlaceholder = addLimitParam(
      params,
      plan.limit ?? DEFAULT_VENDOR_RANKING_LIMIT,
    );

    return {
      text: `
        SELECT
          v.id AS vendor_id,
          v.vendor_code AS vendor_code,
          v.name AS vendor_name,
          COALESCE(SUM(t.amount), 0) AS total
        FROM transactions t
        JOIN vendors v ON v.id = t.vendor_id
        WHERE ${conditions.join("\nAND ")}
        GROUP BY v.id, v.vendor_code, v.name
        ORDER BY total DESC
        LIMIT ${limitPlaceholder}
      `.trim(),

      params,
    };
  },
};

export const unreconciledTransactionsTemplate: QueryTemplate = {
  name: "unreconciled_transactions",

  build(plan) {
    const conditions: string[] = [];
    const params: unknown[] = [];

    addCondition(
      conditions,
      params,
      "r.status = ?",
      "UNRECONCILED",
    );

    if (plan.filters.vendorId) {
      addCondition(
        conditions,
        params,
        "t.vendor_id = ?",
        plan.filters.vendorId,
      );
    }

    if (plan.filters.category) {
      addCondition(
        conditions,
        params,
        "t.category = ?",
        plan.filters.category,
      );
    }

    if (plan.filters.startDate) {
      addCondition(
        conditions,
        params,
        "t.transaction_date >= ?",
        plan.filters.startDate,
      );
    }

    if (plan.filters.endDateExclusive) {
      addCondition(
        conditions,
        params,
        "t.transaction_date < ?",
        plan.filters.endDateExclusive,
      );
    }

    const sortDirection =
      plan.sort?.direction === "asc" ? "ASC" : "DESC";

    const limitPlaceholder = addLimitParam(
      params,
      plan.limit ?? DEFAULT_UNRECONCILED_LIMIT,
    );

    return {
      text: `
        SELECT
          t.id AS transaction_id,
          t.transaction_reference AS transaction_reference,
          t.transaction_date AS transaction_date,
          v.vendor_code AS vendor_code,
          v.name AS vendor_name,
          t.amount AS amount,
          t.category AS category,
          r.status AS reconciliation_status
        FROM transactions t
        JOIN reconciliations r ON r.transaction_id = t.id
        LEFT JOIN vendors v ON v.id = t.vendor_id
        WHERE ${conditions.join("\nAND ")}
        ORDER BY t.amount ${sortDirection}, t.transaction_date DESC, t.id ASC
        LIMIT ${limitPlaceholder}
      `.trim(),

      params,
    };
  },
};