import { sql } from "../db/client.js";
import type { BuiltQuery } from "./queryTemplates.js";

export interface QueryExecutionResult {
  rows: Record<string, unknown>[];
}

export async function executeQuery(
  query: BuiltQuery,
): Promise<QueryExecutionResult> {
  const rows = await sql.query(
    query.text,
    query.params,
  );

  return {
    rows,
  };
}