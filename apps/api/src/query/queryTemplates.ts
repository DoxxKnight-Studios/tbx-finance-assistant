import type {
  BankScopeFilters,
  FullScopeFilters,
  ProgramScopeFilters,
  QueryPlan,
} from "./queryTypes.js";

export interface BuiltQuery {
  text: string;
  params: unknown[];
}

export interface QueryTemplate {
  name: string;
  build(plan: QueryPlan): BuiltQuery;
}

// ---- Shared, parameterized query-building helpers ------------------------
// Every value that ever came from a plan (dates, codes, ids, limits) is
// pushed onto `params` and referenced only by its `$N` placeholder - never
// interpolated into the SQL text itself.

function addCondition(
  conditions: string[],
  params: unknown[],
  conditionSql: string,
  value: unknown,
): void {
  params.push(value);
  const placeholder = `$${params.length}`;
  conditions.push(conditionSql.replace("?", placeholder));
}

function addLimitParam(params: unknown[], limit: number): string {
  params.push(limit);
  return `$${params.length}`;
}

function buildWhereClause(conditions: string[]): string {
  return conditions.length > 0 ? `WHERE ${conditions.join("\nAND ")}` : "";
}

/**
 * Applies dateWindow/accountId/bankCode/programId - the scope every
 * "totals" style intent (spend/income/count/summary/largest) shares.
 * account_id is filtered directly on "transaction" (no join needed);
 * bank_code/program_id live on account, so applying either requires
 * joining to it - the caller decides whether to include that join based
 * on the returned flag.
 */
function addScopeConditions(
  conditions: string[],
  params: unknown[],
  filters: FullScopeFilters | BankScopeFilters | ProgramScopeFilters,
  transactionAlias: string,
): { joinAccount: boolean } {
  let joinAccount = false;

  if (filters.dateWindow) {
    addCondition(
      conditions,
      params,
      `${transactionAlias}.transaction_date >= ?`,
      filters.dateWindow.startDate,
    );
    addCondition(
      conditions,
      params,
      `${transactionAlias}.transaction_date < ?`,
      filters.dateWindow.endDateExclusive,
    );
  }

  if ("accountId" in filters && filters.accountId) {
    addCondition(conditions, params, `${transactionAlias}.account_id = ?`, filters.accountId);
  }

  if ("bankCode" in filters && filters.bankCode) {
    addCondition(conditions, params, "a.bank_code = ?", filters.bankCode);
    joinAccount = true;
  }

  if ("programId" in filters && filters.programId !== undefined) {
    addCondition(conditions, params, "a.program_id = ?", filters.programId);
    joinAccount = true;
  }

  return { joinAccount };
}

function accountJoinClause(joinAccount: boolean): string {
  return joinAccount ? `JOIN account a ON a.account_id = t.account_id` : "";
}

// ---- 1 & 2: transaction_spend_total / transaction_income_total -----------

function buildAggregateTotalQuery(
  filters: FullScopeFilters,
  transactionType: "debit" | "credit",
): BuiltQuery {
  const conditions: string[] = [];
  const params: unknown[] = [];

  addCondition(conditions, params, "t.transaction_type = ?", transactionType);
  if (filters.descriptionQuery) {
    addCondition(
      conditions,
      params,
      "MATCH(t.description) AGAINST (? IN BOOLEAN MODE)",
      filters.descriptionQuery,
    );
  }
  const { joinAccount } = addScopeConditions(conditions, params, filters, "t");

  return {
    text: `
      SELECT COALESCE(SUM(t.transaction_amount), 0) AS total
      FROM \`transaction\` t
      ${accountJoinClause(joinAccount)}
      ${buildWhereClause(conditions)}
    `.trim(),
    params,
  };
}

export const transactionSpendTotalTemplate: QueryTemplate = {
  name: "transaction_spend_total",
  build(plan) {
    if (plan.intent !== "transaction_spend_total") {
      throw new Error("transactionSpendTotalTemplate received a mismatched plan");
    }
    return buildAggregateTotalQuery(plan.filters, "debit");
  },
};

export const transactionIncomeTotalTemplate: QueryTemplate = {
  name: "transaction_income_total",
  build(plan) {
    if (plan.intent !== "transaction_income_total") {
      throw new Error("transactionIncomeTotalTemplate received a mismatched plan");
    }
    return buildAggregateTotalQuery(plan.filters, "credit");
  },
};

// ---- 3: transaction_count -------------------------------------------------

export const transactionCountTemplate: QueryTemplate = {
  name: "transaction_count",
  build(plan) {
    if (plan.intent !== "transaction_count") {
      throw new Error("transactionCountTemplate received a mismatched plan");
    }

    const conditions: string[] = [];
    const params: unknown[] = [];

    if (plan.transactionType) {
      addCondition(conditions, params, "t.transaction_type = ?", plan.transactionType);
    }

    const { joinAccount } = addScopeConditions(conditions, params, plan.filters, "t");

    return {
      text: `
        SELECT COUNT(*) AS count
        FROM \`transaction\` t
        ${accountJoinClause(joinAccount)}
        ${buildWhereClause(conditions)}
      `.trim(),
      params,
    };
  },
};

// ---- 4: transaction_spend_by_bank -----------------------------------------

export const transactionSpendByBankTemplate: QueryTemplate = {
  name: "transaction_spend_by_bank",
  build(plan) {
    if (plan.intent !== "transaction_spend_by_bank") {
      throw new Error("transactionSpendByBankTemplate received a mismatched plan");
    }

    const conditions: string[] = [];
    const params: unknown[] = [];

    addCondition(conditions, params, "t.transaction_type = ?", plan.transactionType);
    addScopeConditions(conditions, params, plan.filters, "t");

    const limitPlaceholder = addLimitParam(params, plan.limit);

    return {
      text: `
        SELECT
          b.bank_code AS bank_code,
          b.bank_name AS bank_name,
          COALESCE(SUM(t.transaction_amount), 0) AS total
        FROM \`transaction\` t
        JOIN account a ON a.account_id = t.account_id
        JOIN bank b ON b.bank_code = a.bank_code
        ${buildWhereClause(conditions)}
        GROUP BY b.bank_code, b.bank_name
        ORDER BY total DESC
        LIMIT ${limitPlaceholder}
      `.trim(),
      params,
    };
  },
};

// ---- 5: transaction_spend_by_program --------------------------------------

export const transactionSpendByProgramTemplate: QueryTemplate = {
  name: "transaction_spend_by_program",
  build(plan) {
    if (plan.intent !== "transaction_spend_by_program") {
      throw new Error("transactionSpendByProgramTemplate received a mismatched plan");
    }

    const conditions: string[] = [];
    const params: unknown[] = [];

    addCondition(conditions, params, "t.transaction_type = ?", plan.transactionType);
    addScopeConditions(conditions, params, plan.filters, "t");

    const limitPlaceholder = addLimitParam(params, plan.limit);

    return {
      text: `
        SELECT
          a.program_id AS program_id,
          COALESCE(SUM(t.transaction_amount), 0) AS total
        FROM \`transaction\` t
        JOIN account a ON a.account_id = t.account_id
        ${buildWhereClause(conditions)}
        GROUP BY a.program_id
        ORDER BY total DESC
        LIMIT ${limitPlaceholder}
      `.trim(),
      params,
    };
  },
};

// ---- 6: transaction_summary ------------------------------------------------
// One deterministic, fixed 4-metric summary computed entirely in Postgres -
// count, debit total, credit total, and net = credit - debit (never the
// other way around). A CTE lets the outer SELECT reference debit_total/
// credit_total by name for `net`, rather than repeating each CASE
// expression a second time.

export const transactionSummaryTemplate: QueryTemplate = {
  name: "transaction_summary",
  build(plan) {
    if (plan.intent !== "transaction_summary") {
      throw new Error("transactionSummaryTemplate received a mismatched plan");
    }

    const conditions: string[] = [];
    const params: unknown[] = [];

    const { joinAccount } = addScopeConditions(conditions, params, plan.filters, "t");

    return {
      text: `
        WITH totals AS (
          SELECT
            COUNT(*) AS count,
            COALESCE(SUM(CASE WHEN t.transaction_type = 'debit' THEN t.transaction_amount ELSE 0 END), 0) AS debit_total,
            COALESCE(SUM(CASE WHEN t.transaction_type = 'credit' THEN t.transaction_amount ELSE 0 END), 0) AS credit_total
          FROM \`transaction\` t
          ${accountJoinClause(joinAccount)}
          ${buildWhereClause(conditions)}
        )
        SELECT
          count,
          debit_total,
          credit_total,
          (credit_total - debit_total) AS net
        FROM totals
      `.trim(),
      params,
    };
  },
};

// ---- 7: largest_transaction -------------------------------------------------
// Sort + limit 1, never MAX() alone - the actual row is the evidence.
// Always joined to account/bank since bank_code/bank_name/program_id are
// part of the returned evidence regardless of which filters were applied.

export const largestTransactionTemplate: QueryTemplate = {
  name: "largest_transaction",
  build(plan) {
    if (plan.intent !== "largest_transaction") {
      throw new Error("largestTransactionTemplate received a mismatched plan");
    }

    const conditions: string[] = [];
    const params: unknown[] = [];

    if (plan.transactionType) {
      addCondition(conditions, params, "t.transaction_type = ?", plan.transactionType);
    }

    addScopeConditions(conditions, params, plan.filters, "t");

    return {
      text: `
        SELECT
          t.transaction_id AS transaction_id,
          t.transaction_date AS transaction_date,
          t.transaction_type AS transaction_type,
          t.transaction_amount AS transaction_amount,
          t.transaction_reference_id AS transaction_reference_id,
          t.description AS description,
          a.program_id AS program_id,
          b.bank_code AS bank_code,
          b.bank_name AS bank_name
        FROM \`transaction\` t
        JOIN account a ON a.account_id = t.account_id
        JOIN bank b ON b.bank_code = a.bank_code
        ${buildWhereClause(conditions)}
        ORDER BY t.transaction_amount DESC
        LIMIT 1
      `.trim(),
      params,
    };
  },
};

// ---- 8: transaction_lookup --------------------------------------------------
// Exact transaction_reference_id match only - never description, never UTR.

export const transactionLookupTemplate: QueryTemplate = {
  name: "transaction_lookup",
  build(plan) {
    if (plan.intent !== "transaction_lookup") {
      throw new Error("transactionLookupTemplate received a mismatched plan");
    }

    const conditions: string[] = [];
    const params: unknown[] = [];
    addCondition(conditions, params, "t.transaction_reference_id = ?", plan.transactionReference);

    return {
      text: `
        SELECT
          t.transaction_id AS transaction_id,
          t.transaction_date AS transaction_date,
          t.transaction_type AS transaction_type,
          t.transaction_amount AS transaction_amount,
          t.transaction_reference_id AS transaction_reference_id,
          t.description AS description,
          a.program_id AS program_id,
          b.bank_code AS bank_code,
          b.bank_name AS bank_name
          FROM \`transaction\` t
        JOIN account a ON a.account_id = t.account_id
        JOIN bank b ON b.bank_code = a.bank_code
        ${buildWhereClause(conditions)}
        LIMIT 1
      `.trim(),
      params,
    };
  },
};

// ---- 9: account_balance ------------------------------------------------------
// account_number itself is never selected - only RIGHT(account_number, 4)
// as last4, for evidence display. entity_id and utr_number are never
// referenced at all.

export const accountBalanceTemplate: QueryTemplate = {
  name: "account_balance",
  build(plan) {
    if (plan.intent !== "account_balance") {
      throw new Error("accountBalanceTemplate received a mismatched plan");
    }

    const conditions: string[] = [];
    const params: unknown[] = [];
    addCondition(conditions, params, "a.account_id = ?", plan.accountId);

    return {
      text: `
        SELECT
          a.account_id AS account_id,
          a.available_balance AS available_balance,
          a.program_id AS program_id,
          RIGHT(a.account_number, 4) AS last4,
          b.bank_code AS bank_code,
          b.bank_name AS bank_name
        FROM account a
        JOIN bank b ON b.bank_code = a.bank_code
        ${buildWhereClause(conditions)}
        LIMIT 1
      `.trim(),
      params,
    };
  },
};

// ---- 10: financial_comparison ------------------------------------------------
// Both periods computed independently, in one pass over `transaction`,
// using MySQL CASE aggregates - $1/$2 bind the primary
// window and $3/$4 the secondary window, so there is no risk of the two
// periods' conditions bleeding into each other. The metric->transaction_type
// mapping (spend=debit, income=credit) is applied as a single WHERE clause
// shared by both FILTERs, so it scopes both periods identically;
// transaction_count applies no type filter, counting every transaction in
// each window. No delta/percentage/winner is computed here - only the two
// raw values, exactly as specified.

export const financialComparisonTemplate: QueryTemplate = {
  name: "financial_comparison",
  build(plan) {
    if (plan.intent !== "financial_comparison") {
      throw new Error("financialComparisonTemplate received a mismatched plan");
    }

    const params: unknown[] = [
      plan.primary.startDate,
      plan.primary.endDateExclusive,
      plan.secondary.startDate,
      plan.secondary.endDateExclusive,
    ];

    const primaryWindow = "t.transaction_date >= $1 AND t.transaction_date < $2";
    const secondaryWindow = "t.transaction_date >= $3 AND t.transaction_date < $4";

    let aggregateExpr: string;
    let whereClause = "";

    if (plan.metric === "transaction_count") {
      aggregateExpr = "COUNT(CASE WHEN {window} THEN 1 END)";
    } else {
      aggregateExpr = "SUM(CASE WHEN {window} THEN t.transaction_amount ELSE 0 END)";
      params.push(plan.metric === "spend" ? "debit" : "credit");
      whereClause = `WHERE t.transaction_type = $${params.length}`;
    }

    const primaryAggregate = aggregateExpr.replace("{window}", primaryWindow);
    const secondaryAggregate = aggregateExpr.replace("{window}", secondaryWindow);

    return {
      text: `
        SELECT
          COALESCE(${primaryAggregate}, 0) AS primary_value,
          COALESCE(${secondaryAggregate}, 0) AS secondary_value
        FROM \`transaction\` t
        ${whereClause}
      `.trim(),
      params,
    };
  },
};
