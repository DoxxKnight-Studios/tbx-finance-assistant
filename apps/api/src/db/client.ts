import mysql, { type PoolConnection } from "mysql2/promise";
import { env } from "../config/env.js";

export const pool = mysql.createPool(env.databaseUrl);

function bindMySqlPlaceholders(text: string, params: unknown[]): {
  text: string;
  params: unknown[];
} {
  if (!text.includes("$")) {
    return { text, params };
  }

  const boundParams: unknown[] = [];
  const boundText = text.replace(/\$(\d+)/g, (_match, index: string) => {
    boundParams.push(params[Number(index) - 1]);
    return "?";
  });

  return { text: boundText, params: boundParams };
}

export async function query<T extends Record<string, unknown> = Record<string, unknown>>(
  text: string,
  params?: unknown[],
): Promise<T[]> {
  const bound = bindMySqlPlaceholders(text, params ?? []);
  const [rows] = await pool.query(bound.text, bound.params);
  return rows as T[];
}

function taggedQuery(
  strings: TemplateStringsArray,
  ...values: unknown[]
): Promise<Record<string, unknown>[]> {
  let text = strings[0];
  for (let i = 0; i < values.length; i += 1) {
    text += `?${strings[i + 1]}`;
  }
  return query(text, values);
}

/**
 * Drop-in replacement for the subset of @neondatabase/serverless's `sql`
 * API this codebase relies on - tagged-template calls and
 * `sql.query(text, params)`. PostgreSQL-style $1 placeholders are converted
 * to MySQL ? placeholders at this boundary.
 */
export const sql: typeof taggedQuery & { query: typeof query } = Object.assign(
  taggedQuery,
  { query },
);

export type DatabaseConnection = PoolConnection;
