import { describe, expect, it } from "vitest";
import { resolveDateRange } from "./dateResolver.js";
import type { DateRange } from "../ai/types.js";

const REFERENCE = new Date("2026-09-05T00:00:00Z"); // Saturday

describe("resolveDateRange", () => {
  it("resolves today", () => {
    expect(resolveDateRange({ type: "today" }, REFERENCE)).toEqual({
      start: "2026-09-05",
      endExclusive: "2026-09-06",
    });
  });

  it("resolves yesterday", () => {
    expect(resolveDateRange({ type: "yesterday" }, REFERENCE)).toEqual({
      start: "2026-09-04",
      endExclusive: "2026-09-05",
    });
  });

  it("resolves this_week (Monday start)", () => {
    expect(resolveDateRange({ type: "this_week" }, REFERENCE)).toEqual({
      start: "2026-08-31",
      endExclusive: "2026-09-07",
    });
  });

  it("resolves last_week", () => {
    expect(resolveDateRange({ type: "last_week" }, REFERENCE)).toEqual({
      start: "2026-08-24",
      endExclusive: "2026-08-31",
    });
  });

  it("resolves this_month", () => {
    expect(resolveDateRange({ type: "this_month" }, REFERENCE)).toEqual({
      start: "2026-09-01",
      endExclusive: "2026-10-01",
    });
  });

  it("resolves last_month", () => {
    expect(resolveDateRange({ type: "last_month" }, REFERENCE)).toEqual({
      start: "2026-08-01",
      endExclusive: "2026-09-01",
    });
  });

  it("resolves this_quarter", () => {
    expect(resolveDateRange({ type: "this_quarter" }, REFERENCE)).toEqual({
      start: "2026-07-01",
      endExclusive: "2026-10-01",
    });
  });

  it("resolves last_quarter", () => {
    expect(resolveDateRange({ type: "last_quarter" }, REFERENCE)).toEqual({
      start: "2026-04-01",
      endExclusive: "2026-07-01",
    });
  });

  it("resolves a specific month", () => {
    expect(
      resolveDateRange({ type: "month", year: 2026, month: 8 }, REFERENCE)
    ).toEqual({ start: "2026-08-01", endExclusive: "2026-09-01" });
  });

  it("resolves an explicit between range (end is already exclusive)", () => {
    expect(
      resolveDateRange(
        { type: "between", start: "2026-08-01", end: "2026-09-01" },
        REFERENCE
      )
    ).toEqual({ start: "2026-08-01", endExclusive: "2026-09-01" });
  });

  describe("month/year boundaries", () => {
    it("last_month from January rolls back to previous December", () => {
      const jan1 = new Date("2026-01-15T00:00:00Z");
      expect(resolveDateRange({ type: "last_month" }, jan1)).toEqual({
        start: "2025-12-01",
        endExclusive: "2026-01-01",
      });
    });

    it("this_month for a January reference", () => {
      const jan1 = new Date("2026-01-01T00:00:00Z");
      expect(resolveDateRange({ type: "this_month" }, jan1)).toEqual({
        start: "2026-01-01",
        endExclusive: "2026-02-01",
      });
    });

    it("this_month for a March 31 reference", () => {
      const mar31 = new Date("2026-03-31T00:00:00Z");
      expect(resolveDateRange({ type: "this_month" }, mar31)).toEqual({
        start: "2026-03-01",
        endExclusive: "2026-04-01",
      });
    });

    it("this_quarter for an April 1 reference (Q2 start)", () => {
      const apr1 = new Date("2026-04-01T00:00:00Z");
      expect(resolveDateRange({ type: "this_quarter" }, apr1)).toEqual({
        start: "2026-04-01",
        endExclusive: "2026-07-01",
      });
    });

    it("this_quarter for a June 30 reference (Q2 end)", () => {
      const jun30 = new Date("2026-06-30T00:00:00Z");
      expect(resolveDateRange({ type: "this_quarter" }, jun30)).toEqual({
        start: "2026-04-01",
        endExclusive: "2026-07-01",
      });
    });

    it("this_quarter for a July 1 reference (Q3 start)", () => {
      const jul1 = new Date("2026-07-01T00:00:00Z");
      expect(resolveDateRange({ type: "this_quarter" }, jul1)).toEqual({
        start: "2026-07-01",
        endExclusive: "2026-10-01",
      });
    });

    it("this_quarter for a September 30 reference (Q3 end)", () => {
      const sep30 = new Date("2026-09-30T00:00:00Z");
      expect(resolveDateRange({ type: "this_quarter" }, sep30)).toEqual({
        start: "2026-07-01",
        endExclusive: "2026-10-01",
      });
    });

    it("last_quarter for an October 1 reference rolls into Q3", () => {
      const oct1 = new Date("2026-10-01T00:00:00Z");
      expect(resolveDateRange({ type: "last_quarter" }, oct1)).toEqual({
        start: "2026-07-01",
        endExclusive: "2026-10-01",
      });
    });

    it("last_quarter for a January reference rolls back across the year boundary", () => {
      const jan15 = new Date("2026-01-15T00:00:00Z");
      expect(resolveDateRange({ type: "last_quarter" }, jan15)).toEqual({
        start: "2025-10-01",
        endExclusive: "2026-01-01",
      });
    });

    it("this_quarter for a December 31 reference (Q4 end)", () => {
      const dec31 = new Date("2026-12-31T00:00:00Z");
      expect(resolveDateRange({ type: "this_quarter" }, dec31)).toEqual({
        start: "2026-10-01",
        endExclusive: "2027-01-01",
      });
    });

    it("month type handles a December -> January style query directly", () => {
      expect(
        resolveDateRange({ type: "month", year: 2025, month: 12 }, REFERENCE)
      ).toEqual({ start: "2025-12-01", endExclusive: "2026-01-01" });
    });
  });

  describe("leap year", () => {
    it("resolves February 2028 (leap year) as a specific month", () => {
      expect(
        resolveDateRange({ type: "month", year: 2028, month: 2 }, REFERENCE)
      ).toEqual({ start: "2028-02-01", endExclusive: "2028-03-01" });
    });

    it("accepts 2028-02-29 as a valid explicit date", () => {
      expect(
        resolveDateRange(
          { type: "between", start: "2028-02-29", end: "2028-03-01" },
          REFERENCE
        )
      ).toEqual({ start: "2028-02-29", endExclusive: "2028-03-01" });
    });

    it("rejects 2027-02-29 (not a leap year)", () => {
      expect(() =>
        resolveDateRange(
          { type: "between", start: "2027-02-29", end: "2027-03-01" },
          REFERENCE
        )
      ).toThrow();
    });
  });

  describe("invalid input", () => {
    it("rejects month 0", () => {
      expect(() =>
        resolveDateRange({ type: "month", year: 2026, month: 0 }, REFERENCE)
      ).toThrow();
    });

    it("rejects month 13", () => {
      expect(() =>
        resolveDateRange({ type: "month", year: 2026, month: 13 }, REFERENCE)
      ).toThrow();
    });

    it("rejects a malformed date string", () => {
      expect(() =>
        resolveDateRange(
          { type: "between", start: "2026/08/01", end: "2026-09-01" },
          REFERENCE
        )
      ).toThrow();
    });

    it("rejects an impossible calendar date (2026-02-31)", () => {
      expect(() =>
        resolveDateRange(
          { type: "between", start: "2026-02-31", end: "2026-03-01" },
          REFERENCE
        )
      ).toThrow();
    });

    it("rejects end <= start", () => {
      expect(() =>
        resolveDateRange(
          { type: "between", start: "2026-09-01", end: "2026-09-01" },
          REFERENCE
        )
      ).toThrow();
    });

    it("rejects end < start", () => {
      expect(() =>
        resolveDateRange(
          { type: "between", start: "2026-09-05", end: "2026-09-01" },
          REFERENCE
        )
      ).toThrow();
    });
  });

  describe("purity", () => {
    it("does not mutate the input range object", () => {
      const range: DateRange = { type: "between", start: "2026-08-01", end: "2026-09-01" };
      const snapshot = JSON.parse(JSON.stringify(range));
      resolveDateRange(range, REFERENCE);
      expect(range).toEqual(snapshot);
    });

    it("does not mutate referenceDate", () => {
      const ref = new Date("2026-09-05T00:00:00Z");
      const before = ref.getTime();
      resolveDateRange({ type: "last_month" }, ref);
      expect(ref.getTime()).toBe(before);
    });

    it("is independent of local timezone (UTC-based reference date fields)", () => {
      const ref = new Date("2026-09-05T00:00:00Z");
      const result = resolveDateRange({ type: "today" }, ref);
      expect(result).toEqual({ start: "2026-09-05", endExclusive: "2026-09-06" });
    });
  });
});
