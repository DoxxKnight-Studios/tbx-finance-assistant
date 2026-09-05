import type { FinanceIntent } from "../ai/types.js";
import { buildQueryPlan } from "./queryPlanner.js";
import {
  getQueryTemplate,
  isTemplateSupported,
} from "./queryTemplateRegistry.js";
import { executeQuery } from "./queryExecutor.js";
import type { QueryPlan } from "./queryTypes.js";
import type { BuiltQuery } from "./queryTemplates.js";

export interface QueryPipelineSuccess {
  status: "success";
  intent: FinanceIntent;
  plan: QueryPlan;
  template: string;
  /**
   * The exact parameterized SQL {text, params} built for this request and
   * passed to executeQuery - carried through (not rebuilt) so the
   * response/explainability layer can show the real executed query
   * without ever running a second query.
   */
  builtQuery: BuiltQuery;
  rows: Record<string, unknown>[];
}

export type QueryPipelineResult =
  | QueryPipelineSuccess
  | {
      status: "unsupported_query_intent";
      intent: FinanceIntent;
      message: string;
    }
  | {
      status: "clarification";
      question: string;
    }
  | {
      status: "not_found";
      message: string;
    }
  | {
      status: "execution_error";
      message: string;
    };

/**
 * Runs a validated FinanceIntent through the deterministic query layer:
 * QueryPlanner -> QueryTemplateRegistry -> parameterized SQL -> PostgreSQL.
 * Gemini/the AI layer never reaches this function with anything but a
 * validated FinanceIntent, and never supplies SQL directly.
 */
export async function executeFinanceIntent(
  intent: FinanceIntent,
  referenceDate: Date = new Date(),
): Promise<QueryPipelineResult> {
  // Fail fast for intents with no executable template, before spending a
  // bank/account-resolution DB round trip on a query we could never run anyway.
  if (!isTemplateSupported(intent.intent)) {
    return {
      status: "unsupported_query_intent",
      intent,
      message: `The "${intent.intent}" query is not implemented yet.`,
    };
  }

  const planResult = await buildQueryPlan(intent, referenceDate);

  if (planResult.status === "clarification") {
    return {
      status: "clarification",
      question: planResult.question,
    };
  }

  if (planResult.status === "not_found") {
    return {
      status: "not_found",
      message: planResult.message,
    };
  }

  const { plan } = planResult;

  // Defensive/type-narrowing check: buildQueryPlan only reaches "success"
  // for the same intents the registry supports, so this should always
  // hold. It's what lets TypeScript narrow plan.intent for getQueryTemplate
  // without duplicating the registry's supported-intent list here.
  if (!isTemplateSupported(plan.intent)) {
    return {
      status: "unsupported_query_intent",
      intent,
      message: `The "${plan.intent}" query is not implemented yet.`,
    };
  }

  const template = getQueryTemplate(plan.intent);
  const builtQuery = template.build(plan);

  try {
    const { rows } = await executeQuery(builtQuery);

    return {
      status: "success",
      intent,
      plan,
      template: template.name,
      builtQuery,
      rows,
    };
  } catch (error) {
    return {
      status: "execution_error",
      message:
        error instanceof Error
          ? error.message
          : "Query execution failed.",
    };
  }
}
