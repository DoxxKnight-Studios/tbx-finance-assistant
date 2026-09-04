import { sql } from "../db/client.js";

export interface ResolvedVendor {
  id: string;
  vendorCode: string;
  name: string;
  status: string;
}

export type VendorResolution =
  | {
      status: "resolved";
      vendor: ResolvedVendor;
    }
  | {
      status: "not_found";
      input: string;
    }
  | {
      status: "ambiguous";
      input: string;
      candidates: ResolvedVendor[];
    };

function normalizeVendorInput(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function mapVendor(row: Record<string, unknown>): ResolvedVendor {
  return {
    id: String(row.id),
    vendorCode: String(row.vendor_code),
    name: String(row.name),
    status: String(row.status),
  };
}

export async function resolveVendor(
  input: string,
): Promise<VendorResolution> {
  const normalizedInput = normalizeVendorInput(input);

  if (!normalizedInput) {
    return {
      status: "not_found",
      input,
    };
  }

  /*
   * Step 1:
   * Exact vendor-code match.
   *
   * Vendor codes are explicit identifiers and therefore
   * take precedence over name matching.
   */
  const codeRows = await sql`
    SELECT
      id,
      vendor_code,
      name,
      status
    FROM vendors
    WHERE LOWER(TRIM(vendor_code)) = ${normalizedInput}
    LIMIT 2
  `;

  if (codeRows.length === 1) {
    return {
      status: "resolved",
      vendor: mapVendor(codeRows[0]),
    };
  }

  /*
   * Step 2:
   * Exact case-insensitive name match.
   *
   * Example:
   * "acme corporation"
   * should resolve to:
   * "Acme Corporation"
   */
  const exactNameRows = await sql`
    SELECT
      id,
      vendor_code,
      name,
      status
    FROM vendors
    WHERE LOWER(TRIM(name)) = ${normalizedInput}
    ORDER BY name
    LIMIT 10
  `;

  if (exactNameRows.length === 1) {
    return {
      status: "resolved",
      vendor: mapVendor(exactNameRows[0]),
    };
  }

  if (exactNameRows.length > 1) {
    return {
      status: "ambiguous",
      input,
      candidates: exactNameRows.map(mapVendor),
    };
  }

  /*
   * Step 3:
   * Conservative token/prefix matching.
   *
   * This is intentionally NOT a fuzzy "pick the closest vendor"
   * strategy.
   *
   * We return all plausible candidates and let the application
   * ask the user to clarify.
   */
  const prefixRows = await sql`
    SELECT
      id,
      vendor_code,
      name,
      status
    FROM vendors
    WHERE LOWER(name) LIKE ${`${normalizedInput}%`}
    ORDER BY name
    LIMIT 10
  `;

  if (prefixRows.length === 1) {
    return {
      status: "resolved",
      vendor: mapVendor(prefixRows[0]),
    };
  }

  if (prefixRows.length > 1) {
    return {
      status: "ambiguous",
      input,
      candidates: prefixRows.map(mapVendor),
    };
  }

  return {
    status: "not_found",
    input,
  };
}