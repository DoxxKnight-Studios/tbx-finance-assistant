import type { ChatApiResult, SpendRankingRow } from "@/types/chat";

function timestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

/**
 * Triggers a real client-side file download (Blob + object URL) - nothing
 * here uploads data anywhere or reads back from the DOM; it serializes
 * the exact in-memory result object the app already has.
 */
function download(filename: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Exports the exact structured API response as-is - the same object
 * rendered on screen, never DOM-scraped and never re-fetched. It already
 * carries only what the backend sent (including `technical` when
 * present), so this applies no additional sanitization and none is
 * needed: the backend never sends account_number/utr_number/entity_id/
 * secrets in the first place.
 */
export function exportResultAsJson(result: ChatApiResult): void {
  download(`tbx-finance-response-${timestamp()}.json`, JSON.stringify(result, null, 2), "application/json");
}

function csvEscape(value: unknown): string {
  const str = value === null || value === undefined ? "" : String(value);
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

function rowsToCsv(rows: Record<string, unknown>[]): string {
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((header) => csvEscape(row[header])).join(","));
  }
  return lines.join("\n");
}

/**
 * CSV export only makes sense where the response actually carries a
 * table - the bank/program spend rankings. Every other intent's evidence
 * is a single value or a single record, which the JSON export already
 * covers.
 */
export function getExportableRankingRows(result: ChatApiResult): SpendRankingRow[] | null {
  const rankings = result.evidence?.rankings;
  return Array.isArray(rankings) && rankings.length > 0 ? rankings : null;
}

export function exportResultAsCsv(result: ChatApiResult): void {
  const rows = getExportableRankingRows(result);
  if (!rows) return;
  download(
    `tbx-finance-response-${timestamp()}.csv`,
    rowsToCsv(rows as unknown as Record<string, unknown>[]),
    "text/csv",
  );
}
