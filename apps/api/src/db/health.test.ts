import { describe, expect, it } from "vitest";
import { checkDatabaseConnection } from "./health.js";
import { query } from "./client.js";

describe("local MySQL connectivity", () => {
  it("connects and resolves SELECT 1 via checkDatabaseConnection", async () => {
    await expect(checkDatabaseConnection()).resolves.toBeUndefined();
  });

  it("runs a parameterized query through the shared MySQL pool", async () => {
    const rows = await query<{ answer: number }>(
      "SELECT CAST($1 AS SIGNED) AS answer",
      [42],
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].answer).toBe(42);
  });
});
