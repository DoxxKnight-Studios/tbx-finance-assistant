import { describe, expect, it, vi } from "vitest";

/*
 * query() is wrapped (not fully replaced) so every test hits the real
 * seeded local Postgres database by default - only the "ambiguous" case
 * overrides it for one call, because the Phase 3 seed generates unique
 * last4 values across all 100 accounts by construction, so a real
 * ambiguous match can't be constructed without altering the seed (which
 * Phase 5 must not do).
 */
vi.mock("../db/client.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../db/client.js")>();
  return {
    ...actual,
    query: vi.fn(actual.query),
  };
});

import { query } from "../db/client.js";
import { resolveAccountByLast4 } from "./accountResolver.js";

// A real account known to exist in the Phase 3 seeded dataset.
const KNOWN_LAST4 = "7622";
const KNOWN_BANK_CODE = "CNRB";
const KNOWN_PROGRAM_ID = 58;

describe("resolveAccountByLast4", () => {
  it("resolves a valid known last4 (A)", async () => {
    const result = await resolveAccountByLast4(KNOWN_LAST4);

    expect(result.status).toBe("resolved");
    if (result.status === "resolved") {
      expect(result.account.last4).toBe(KNOWN_LAST4);
      expect(result.account.accountId).toEqual(expect.any(String));
    }
  });

  it("resolves with bankCode and programId context (F)", async () => {
    const result = await resolveAccountByLast4(KNOWN_LAST4);

    expect(result.status).toBe("resolved");
    if (result.status === "resolved") {
      expect(result.account.bankCode).toBe(KNOWN_BANK_CODE);
      expect(result.account.programId).toBe(KNOWN_PROGRAM_ID);
    }
  });

  it("returns not_found for a structurally valid but unknown last4 (D)", async () => {
    // Confirmed absent from the deterministic Phase 3 seed (seed=20260905):
    // no account_number in the dataset ends in 0000.
    const result = await resolveAccountByLast4("0000");
    expect(result.status).toBe("not_found");
  });

  describe("structurally invalid input is rejected before any database query (C)", () => {
    const invalidInputs = ["12", "12345", "abcd", "12x4", "", "   ", "-123", "12.4"];

    for (const invalid of invalidInputs) {
      it(`rejects "${invalid}"`, async () => {
        vi.mocked(query).mockClear();

        const result = await resolveAccountByLast4(invalid);

        expect(result.status).toBe("not_found");
        expect(query).not.toHaveBeenCalled();
      });
    }
  });

  it("returns ambiguous when the database yields more than one match (E, mocked)", async () => {
    vi.mocked(query).mockResolvedValueOnce([
      { account_id: "fake-account-1", last4: "1234", bank_code: "HDFC", program_id: 21 },
      { account_id: "fake-account-2", last4: "1234", bank_code: "ICIC", program_id: 4 },
    ]);

    const result = await resolveAccountByLast4("1234");

    expect(result.status).toBe("ambiguous");
    if (result.status === "ambiguous") {
      expect(result.candidates).toHaveLength(2);
      expect(result.candidates.map((c) => c.accountId).sort()).toEqual([
        "fake-account-1",
        "fake-account-2",
      ]);
    }
  });

  describe("security: never exposes sensitive fields (Section 7)", () => {
    it("the resolved account object never contains account_number or utr_number", async () => {
      const result = await resolveAccountByLast4(KNOWN_LAST4);

      expect(result.status).toBe("resolved");
      if (result.status === "resolved") {
        const keys = Object.keys(result.account);
        expect(keys).not.toContain("account_number");
        expect(keys).not.toContain("accountNumber");
        expect(keys).not.toContain("utr_number");
        expect(keys).not.toContain("utrNumber");
        expect(JSON.stringify(result.account)).not.toMatch(/\d{14}/); // no 14-digit full account number
      }
    });

    it("the underlying SQL never selects account_number or utr_number as a raw column", async () => {
      vi.mocked(query).mockClear();
      await resolveAccountByLast4(KNOWN_LAST4);

      expect(query).toHaveBeenCalledTimes(1);
      const [sqlText] = vi.mocked(query).mock.calls[0];

      // RIGHT(account_number, 4) is fine - selecting the raw column on
      // its own, or any UTR column, is not. Strip the allowed
      // RIGHT(account_number, N) usage out first, then confirm no bare
      // account_number reference remains in the select list.
      const selectClause = sqlText.match(/SELECT([\s\S]*?)FROM/i)?.[1] ?? sqlText;
      const withoutAllowedUsage = selectClause.replace(
        /RIGHT\s*\(\s*account_number\s*,\s*\d+\s*\)/gi,
        "",
      );
      expect(withoutAllowedUsage).not.toMatch(/\baccount_number\b/i);
      expect(sqlText.toLowerCase()).not.toContain("utr_number");
    });

    it("candidates in an ambiguous result also never carry account_number or utr_number", async () => {
      vi.mocked(query).mockResolvedValueOnce([
        { account_id: "fake-account-1", last4: "5678", bank_code: "HDFC", program_id: 21 },
        { account_id: "fake-account-2", last4: "5678", bank_code: "ICIC", program_id: 4 },
      ]);

      const result = await resolveAccountByLast4("5678");

      expect(result.status).toBe("ambiguous");
      if (result.status === "ambiguous") {
        for (const candidate of result.candidates) {
          expect(Object.keys(candidate)).not.toContain("account_number");
          expect(Object.keys(candidate)).not.toContain("utr_number");
        }
      }
    });
  });
});
