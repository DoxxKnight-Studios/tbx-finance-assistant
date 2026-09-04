import { sql } from "./client.js";

export async function checkDatabaseConnection(): Promise<void> {
  await sql`SELECT 1`;
}