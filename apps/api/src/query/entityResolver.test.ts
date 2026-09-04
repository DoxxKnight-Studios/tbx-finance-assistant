import { describe, expect, it } from "vitest";
import { resolveVendor } from "./entityResolver.js";

describe("resolveVendor", () => {
  it("resolves an exact vendor name", async () => {
    const result = await resolveVendor("Acme Corporation");

    expect(result.status).toBe("resolved");

    if (result.status === "resolved") {
      expect(result.vendor.name).toBe("Acme Corporation");
      expect(result.vendor.vendorCode).toBe(
        "TEST-VENDOR-ACME",
      );
    }
  });

  it("resolves vendor name case-insensitively", async () => {
    const result = await resolveVendor(
      "acme corporation",
    );

    expect(result.status).toBe("resolved");
  });

  it("resolves an exact vendor code", async () => {
    const result = await resolveVendor(
      "TEST-VENDOR-ACME",
    );

    expect(result.status).toBe("resolved");

    if (result.status === "resolved") {
      expect(result.vendor.name).toBe(
        "Acme Corporation",
      );
    }
  });

  it("detects ambiguous prefix", async () => {
    const result = await resolveVendor("Acme");

    expect(result.status).toBe("ambiguous");

    if (result.status === "ambiguous") {
      expect(result.candidates.length).toBeGreaterThan(1);

      expect(
        result.candidates.some(
          (candidate) =>
            candidate.name === "Acme Corporation",
        ),
      ).toBe(true);
    }
  });

  it("returns not_found for unknown vendor", async () => {
    const result = await resolveVendor(
      "Definitely Not A Real Vendor",
    );

    expect(result.status).toBe("not_found");
  });

  it("handles surrounding whitespace", async () => {
    const result = await resolveVendor(
      "   Acme Corporation   ",
    );

    expect(result.status).toBe("resolved");
  });

  it("handles empty input", async () => {
    const result = await resolveVendor("   ");

    expect(result.status).toBe("not_found");
  });
});