import { Pool } from "pg";
import { env } from "../config/env.js";

export const pool = new Pool({
  connectionString: env.databaseUrl,
});

export async function query<T extends Record<string, unknown> = Record<string, unknown>>(
  text: string,
  params?: unknown[],
): Promise<T[]> {
  const result = await pool.query(text, params);
  return result.rows as T[];
}

function taggedQuery(
  strings: TemplateStringsArray,
  ...values: unknown[]
): Promise<Record<string, unknown>[]> {
  let text = strings[0];
  for (let i = 0; i < values.length; i += 1) {
    text += `$${i + 1}${strings[i + 1]}`;
  }
  return query(text, values);
}

/**
 * Drop-in replacement for the subset of @neondatabase/serverless's `sql`
 * API this codebase relies on - tagged-template calls (used by
 * db/health.ts and query/entityResolver.ts) and `sql.query(text, params)`
 * (used by query/queryExecutor.ts, which already builds $1/$2-style
 * positional SQL). Backed by a standard `pg.Pool` so those call sites
 * didn't need to change.
 */
export const sql: typeof taggedQuery & { query: typeof query } = Object.assign(
  taggedQuery,
  { query },
);
