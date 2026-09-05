import { formatCurrency, formatPeriod } from "./format";
import { formatBankName } from "./bankUtils";
import type { ChatApiResult } from "@/types/chat";

/**
 * Generates a clean, human-readable text representation of the assistant's answer and evidence.
 */
export function generatePlainText(result: ChatApiResult): string {
  const lines: string[] = [];

  lines.push(result.answer);
  lines.push("");

  const ev = result.evidence;
  if (ev) {
    const period = formatPeriod(ev.period?.start, ev.period?.endExclusive);
    if (period) lines.push(`Period: ${period}`);

    if (ev.rankings && ev.rankings.length > 0) {
      lines.push("");
      lines.push("Breakdown:");
      ev.rankings.forEach((r, idx) => {
        const title = r.bankName
          ? formatBankName(r.bankName, r.bankCode)
          : r.programId !== undefined
            ? `Program ${r.programId}`
            : `Item ${idx + 1}`;
        const amount = typeof r.total === "string" ? formatCurrency(r.total) : "—";
        lines.push(`  ${idx + 1}. ${title}: ${amount}`);
      });
    }

    if (ev.debitTotal || ev.creditTotal) {
      lines.push("");
      lines.push("Summary:");
      if (ev.debitTotal) lines.push(`  Debits: ${formatCurrency(ev.debitTotal)}`);
      if (ev.creditTotal) lines.push(`  Credits: ${formatCurrency(ev.creditTotal)}`);
      if (ev.net) lines.push(`  Net: ${formatCurrency(ev.net)}`);
      if (ev.count !== undefined) lines.push(`  Transactions: ${ev.count}`);
    }

    if (ev.transaction) {
      lines.push("");
      lines.push("Transaction:");
      if (ev.transaction.amount) lines.push(`  Amount: ${formatCurrency(ev.transaction.amount)}`);
      if (ev.transaction.reference) lines.push(`  Reference: ${ev.transaction.reference}`);
      if (ev.transaction.transactionDate) lines.push(`  Date: ${ev.transaction.transactionDate.split("T")[0]}`);
    }

    if (ev.availableBalance) {
      lines.push("");
      lines.push(`Available Balance: ${formatCurrency(ev.availableBalance)}`);
    }

    lines.push("");
    lines.push("Source: Verified PostgreSQL Transaction Dataset");
  }

  return lines.join("\n");
}

/**
 * Generates a rich Markdown report of the answer and financial data.
 */
export function generateMarkdownReport(result: ChatApiResult): string {
  const lines: string[] = [];

  lines.push("# TBX Finance Assistant Report");
  lines.push(`*Generated on ${new Date().toLocaleString()}*`);
  lines.push("");
  lines.push("## Summary");
  lines.push(result.answer);
  lines.push("");

  const ev = result.evidence;
  if (ev) {
    const period = formatPeriod(ev.period?.start, ev.period?.endExclusive);
    if (period) {
      lines.push(`**Period:** ${period}`);
      lines.push("");
    }

    if (ev.rankings && ev.rankings.length > 0) {
      lines.push("## Breakdown");
      lines.push("");
      lines.push("| # | Entity | Amount |");
      lines.push("| :-: | :-- | --: |");
      ev.rankings.forEach((r, idx) => {
        const title = r.bankName
          ? formatBankName(r.bankName, r.bankCode)
          : r.programId !== undefined
            ? `Program ${r.programId}`
            : `Item ${idx + 1}`;
        const amount = typeof r.total === "string" ? formatCurrency(r.total) : "—";
        lines.push(`| ${idx + 1} | ${title} | ${amount} |`);
      });
      lines.push("");
    }

    if (ev.debitTotal || ev.creditTotal) {
      lines.push("## Activity Totals");
      lines.push("");
      if (ev.debitTotal) lines.push(`- **Total Debits (Spend):** ${formatCurrency(ev.debitTotal)}`);
      if (ev.creditTotal) lines.push(`- **Total Credits (Income):** ${formatCurrency(ev.creditTotal)}`);
      if (ev.net) lines.push(`- **Net Movement:** ${formatCurrency(ev.net)}`);
      if (ev.count !== undefined) lines.push(`- **Transaction Count:** ${ev.count}`);
      lines.push("");
    }

    if (ev.transaction) {
      lines.push("## Transaction Details");
      lines.push("");
      if (ev.transaction.amount) lines.push(`- **Amount:** ${formatCurrency(ev.transaction.amount)}`);
      if (ev.transaction.reference) lines.push(`- **Reference:** \`${ev.transaction.reference}\``);
      if (ev.transaction.transactionDate) lines.push(`- **Date:** ${ev.transaction.transactionDate.split("T")[0]}`);
      lines.push("");
    }

    lines.push("---");
    lines.push("**Audit Trail:** Verified PostgreSQL database query (read-only)");
  }

  return lines.join("\n");
}

/**
 * Exports ranking/breakdown rows to CSV format for spreadsheets.
 */
export function generateCsvData(result: ChatApiResult): string | null {
  const rankings = result.evidence?.rankings;
  if (!rankings || rankings.length === 0) return null;

  const rows: string[] = [];
  rows.push("Rank,Entity,Amount,Raw_Amount");

  rankings.forEach((r, idx) => {
    const title = r.bankName
      ? formatBankName(r.bankName, r.bankCode)
      : r.programId !== undefined
        ? `Program ${r.programId}`
        : `Item ${idx + 1}`;
    const formatted = typeof r.total === "string" ? formatCurrency(r.total) : "";
    const raw = r.total ?? "";

    // Escape CSV cell
    const safeTitle = `"${title.replace(/"/g, '""')}"`;
    const safeFormatted = `"${formatted.replace(/"/g, '""')}"`;

    rows.push(`${idx + 1},${safeTitle},${safeFormatted},${raw}`);
  });

  return rows.join("\n");
}

/**
 * Triggers a file download in the browser.
 */
export function downloadFile(filename: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
