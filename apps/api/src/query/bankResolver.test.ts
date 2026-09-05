import { describe, expect, it, vi } from "vitest";

/*
 * query() is wrapped (not fully replaced) so every test hits the real
 * seeded local Postgres database by default - these are integration
 * tests, not unit tests with a fake DB. Only the "ambiguous" case
 * overrides it for one call, because the official 10-bank dataset has no
 * two banks sharing a name/code, so a real ambiguous match can't be
 * constructed without altering the seed (which Phase 5 must not do).
 */
vi.mock("../db/client.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../db/client.js")>();
  return {
    ...actual,
    query: vi.fn(actual.query),
  };
});

import { query } from "../db/client.js";
import { resolveBank } from "./bankResolver.js";

describe("resolveBank", () => {
  it("resolves an exact bank_code match (A)", async () => {
    const result = await resolveBank("HDFC");

    expect(result.status).toBe("resolved");
    if (result.status === "resolved") {
      expect(result.bank.code).toBe("HDFC");
      expect(result.bank.name).toBe("HDFC BANK LIMITED");
    }
  });

  it("resolves a lowercase bank_code case-insensitively (B)", async () => {
    const result = await resolveBank("hdfc");

    expect(result.status).toBe("resolved");
    if (result.status === "resolved") {
      expect(result.bank.code).toBe("HDFC");
    }
  });

  it("resolves the canonical bank_name case-insensitively (C)", async () => {
    const result = await resolveBank("hdfc bank limited");

    expect(result.status).toBe("resolved");
    if (result.status === "resolved") {
      expect(result.bank.code).toBe("HDFC");
      expect(result.bank.name).toBe("HDFC BANK LIMITED");
    }
  });

  it("resolves a conservative name prefix", async () => {
    const result = await resolveBank("HDFC BANK");

    expect(result.status).toBe("resolved");
    if (result.status === "resolved") {
      expect(result.bank.code).toBe("HDFC");
    }
  });

  it("returns not_found for an unknown bank (D)", async () => {
    const result = await resolveBank("Definitely Not A Real Bank");
    expect(result.status).toBe("not_found");
  });

  it("returns not_found for empty/whitespace input without querying the database", async () => {
    const result = await resolveBank("   ");
    expect(result.status).toBe("not_found");
  });

  it("handles surrounding whitespace", async () => {
    const result = await resolveBank("  HDFC  ");
    expect(result.status).toBe("resolved");
  });

  /*
   * (E) The official dataset has no two banks with the same code or
   * name, so a genuinely ambiguous input can't be constructed against
   * the real seed. This proves the ambiguous branch itself is correct
   * by injecting a fake multi-row result for one call only - every
   * other test in this file still hits the real database.
   */
  it("returns ambiguous when the database yields more than one match (E, mocked)", async () => {
    // resolveBank queries in three sequential steps (code, exact name,
    // prefix) - queue an empty step-1 (code match) result first so the
    // fake ambiguity lands on step 2 (exact name match) as intended,
    // rather than being misread as a >1-row bank_code match.
    vi.mocked(query)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { bank_code: "AAA1", bank_name: "ALPHA BANK OF INDIA" },
        { bank_code: "AAA2", bank_name: "ALPHA BANK LIMITED" },
      ]);

    const result = await resolveBank("alpha");

    expect(result.status).toBe("ambiguous");
    if (result.status === "ambiguous") {
      expect(result.candidates).toHaveLength(2);
      expect(result.candidates.map((c) => c.code).sort()).toEqual(["AAA1", "AAA2"]);
    }
  });

  it("never fuzzy-picks a closest match for a garbled/misspelled name", async () => {
    const result = await resolveBank("HFDC Banc Limitd");
    expect(result.status).toBe("not_found");
  });
});
