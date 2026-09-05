import { describe, expect, it } from "vitest";
import { checkDatabaseConnection } from "./health.js";
import { query } from "./client.js";

describe("local PostgreSQL connectivity", () => {
  it("connects and resolves SELECT 1 via checkDatabaseConnection", async () => {
    await expect(checkDatabaseConnection()).resolves.toBeUndefined();
  });

  it("runs a parameterized query through the shared pg Pool", async () => {
    const rows = await query<{ answer: number }>(
      "SELECT $1::int AS answer",
      [42],
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].answer).toBe(42);
  });
});
