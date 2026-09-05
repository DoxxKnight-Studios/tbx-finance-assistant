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
const DEFAULT_SPEND_LIMIT = 10;

function addDateConditions(
  conditions: string[],
  params: unknown[],
  filters: QueryPlan["filters"],
): void {
  if (filters.startDate) {
    addCondition(conditions, params, "t.transaction_date >= ?", filters.startDate);
  }

  if (filters.endDateExclusive) {
    addCondition(conditions, params, "t.transaction_date < ?", filters.endDateExclusive);
  }
}

function addSpendConditions(
  conditions: string[],
  params: unknown[],
  filters: QueryPlan["filters"],
): void {
  addCondition(conditions, params, "t.status = ?", "COMPLETED");
  params.push("RECEIPT", "REFUND");
  conditions.push(`t.transaction_type NOT IN ($${params.length - 1}, $${params.length})`);

  if (filters.vendorId) addCondition(conditions, params, "t.vendor_id = ?", filters.vendorId);
  if (filters.category) addCondition(conditions, params, "t.category = ?", filters.category);
  addDateConditions(conditions, params, filters);
}

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

export const vendorPayoutLargestTemplate: QueryTemplate = {
  name: "vendor_payout_largest",

  build(plan) {
    const conditions: string[] = [];
    const params: unknown[] = [];

    addCondition(conditions, params, "t.transaction_type = ?", "VENDOR_PAYOUT");
    addCondition(conditions, params, "t.status = ?", "COMPLETED");
    if (plan.filters.vendorId) {
      addCondition(conditions, params, "t.vendor_id = ?", plan.filters.vendorId);
    }
    addDateConditions(conditions, params, plan.filters);

    return {
      text: `
        SELECT t.id AS transaction_id,
          t.transaction_reference AS transaction_reference,
          t.transaction_date AS transaction_date,
          v.vendor_code AS vendor_code,
          v.name AS vendor_name,
          t.amount AS amount,
          t.category AS category
        FROM transactions t
        LEFT JOIN vendors v ON v.id = t.vendor_id
        WHERE ${conditions.join("\nAND ")}
        ORDER BY t.amount DESC, t.transaction_date DESC, t.id ASC
        LIMIT 1
      `.trim(),
      params,
    };
  },
};

export const transactionAmountFilterTemplate: QueryTemplate = {
  name: "transaction_amount_filter",

  build(plan) {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (plan.filters.amountLessThan !== undefined) {
      addCondition(conditions, params, "t.amount < ?", plan.filters.amountLessThan);
    }

    if (plan.filters.vendorId) {
      addCondition(conditions, params, "t.vendor_id = ?", plan.filters.vendorId);
    }

    if (plan.filters.category) {
      addCondition(conditions, params, "t.category = ?", plan.filters.category);
    }

    addDateConditions(conditions, params, plan.filters);

    return {
      text: `
        SELECT COUNT(*) AS count
        FROM transactions t
        WHERE ${conditions.length > 0 ? conditions.join("\nAND ") : "TRUE"}
      `.trim(),
      params,
    };
  },
};

export const transactionSpendTotalTemplate: QueryTemplate = {
  name: "transaction_spend_total",
  build(plan) {
    const conditions: string[] = [];
    const params: unknown[] = [];
    addSpendConditions(conditions, params, plan.filters);
    return {
      text: `SELECT COALESCE(SUM(t.amount), 0) AS total FROM transactions t WHERE ${conditions.join("\nAND ")}`,
      params,
    };
  },
};

export const transactionSpendByVendorTemplate: QueryTemplate = {
  name: "transaction_spend_by_vendor",
  build(plan) {
    const conditions: string[] = [];
    const params: unknown[] = [];
    addSpendConditions(conditions, params, plan.filters);
    const limit = addLimitParam(params, plan.limit ?? DEFAULT_SPEND_LIMIT);
    return {
      text: `
        SELECT v.id AS vendor_id, v.vendor_code AS vendor_code, v.name AS vendor_name,
          COALESCE(SUM(t.amount), 0) AS total
        FROM transactions t JOIN vendors v ON v.id = t.vendor_id
        WHERE ${conditions.join("\nAND ")}
        GROUP BY v.id, v.vendor_code, v.name
        ORDER BY total DESC LIMIT ${limit}
      `.trim(),
      params,
    };
  },
};

export const transactionSpendByCategoryTemplate: QueryTemplate = {
  name: "transaction_spend_by_category",
  build(plan) {
    const conditions: string[] = [];
    const params: unknown[] = [];
    addSpendConditions(conditions, params, plan.filters);
    const limit = addLimitParam(params, plan.limit ?? DEFAULT_SPEND_LIMIT);
    return {
      text: `
        SELECT t.category AS category, COALESCE(SUM(t.amount), 0) AS total,
          COUNT(*) AS transaction_count
        FROM transactions t
        WHERE ${conditions.join("\nAND ")}
        GROUP BY t.category ORDER BY total DESC LIMIT ${limit}
      `.trim(),
      params,
    };
  },
};

export const transactionLookupTemplate: QueryTemplate = {
  name: "transaction_lookup",
  build(plan) {
    const conditions: string[] = [];
    const params: unknown[] = [];
    addCondition(conditions, params, "t.transaction_reference = ?", plan.filters.transactionReference);
    return {
      text: `
        SELECT t.id AS transaction_id, t.transaction_reference AS transaction_reference,
          t.transaction_date AS transaction_date, v.vendor_code AS vendor_code,
          v.name AS vendor_name, t.amount AS amount, t.currency AS currency,
          t.transaction_type AS transaction_type, t.category AS category,
          t.status AS transaction_status, t.description AS description,
          r.status AS reconciliation_status
        FROM transactions t LEFT JOIN vendors v ON v.id = t.vendor_id
          LEFT JOIN reconciliations r ON r.transaction_id = t.id
        WHERE ${conditions.join("\nAND ")}
        LIMIT 1
      `.trim(),
      params,
    };
  },
};

export const reconciliationSummaryTemplate: QueryTemplate = {
  name: "reconciliation_summary",
  build(plan) {
    const conditions: string[] = [];
    const params: unknown[] = [];
    if (plan.filters.vendorId) addCondition(conditions, params, "t.vendor_id = ?", plan.filters.vendorId);
    addDateConditions(conditions, params, plan.filters);
    const where = conditions.length ? `WHERE ${conditions.join("\nAND ")}` : "";
    return {
      text: `
        SELECT r.status AS reconciliation_status, COUNT(*) AS transaction_count,
          COALESCE(SUM(t.amount), 0) AS total_amount
        FROM transactions t JOIN reconciliations r ON r.transaction_id = t.id
        ${where}
        GROUP BY r.status ORDER BY transaction_count DESC, r.status ASC
      `.trim(),
      params,
    };
  },
};

export const financialComparisonTemplate: QueryTemplate = {
  name: "financial_comparison",
  build(plan) {
    const primary = plan.comparison?.primary;
    const secondary = plan.comparison?.secondary;
    if (!primary || !secondary) throw new Error("Comparison periods are required");

    const params: unknown[] = ["COMPLETED", "RECEIPT", "REFUND"];
    params.push(primary.startDate, primary.endDateExclusive, secondary.startDate, secondary.endDateExclusive);

    return {
      text: `
        SELECT
          COALESCE(SUM(CASE WHEN t.transaction_date >= $4 AND t.transaction_date < $5 THEN t.amount ELSE 0 END), 0) AS primary_total,
          COALESCE(SUM(CASE WHEN t.transaction_date >= $6 AND t.transaction_date < $7 THEN t.amount ELSE 0 END), 0) AS secondary_total
        FROM transactions t
        WHERE t.status = $1
          AND t.transaction_type NOT IN ($2, $3)
          AND ((t.transaction_date >= $4 AND t.transaction_date < $5)
            OR (t.transaction_date >= $6 AND t.transaction_date < $7))
      `.trim(),
      params,
    };
  },
};

export const transactionAmountFilterTemplate: QueryTemplate = {
  name: "transaction_amount_filter",
  build(plan) {
    if (plan.filters.amountLessThan === undefined) {
      throw new Error("transaction_amount_filter requires amountLessThan");
    }

    const conditions: string[] = [];
    const params: unknown[] = [];
    addCondition(conditions, params, "t.amount < ?", plan.filters.amountLessThan);
    if (plan.filters.vendorId) addCondition(conditions, params, "t.vendor_id = ?", plan.filters.vendorId);
    if (plan.filters.category) addCondition(conditions, params, "t.category = ?", plan.filters.category);
    addDateConditions(conditions, params, plan.filters);

    return {
      text: `
        SELECT COUNT(*) AS count
        FROM transactions t
        WHERE ${conditions.join("\nAND ")}
      `.trim(),
      params,
    };
  },
};
