import { Landmark } from "lucide-react";
import type { ReactNode } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { formatCurrency, formatPeriod } from "@/lib/format";
import type { FinanceEvidence, FinanceSummary } from "@/types/chat";

const TEMPLATE_LABELS: Record<string, string> = {
  vendor_payout_total: "Vendor payout total",
  vendor_payout_by_vendor: "Vendor payout ranking",
  transaction_amount_filter: "Transaction amount filter",
  unreconciled_transactions: "Unreconciled transactions",
};

const TEMPLATE_SOURCE: Record<string, string> = {
  vendor_payout_total: "Vendor payout data",
  vendor_payout_by_vendor: "Vendor payout data",
  transaction_amount_filter: "Transaction data",
  unreconciled_transactions: "Transaction reconciliation data",
};

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium text-foreground">{value}</span>
    </div>
  );
}

function VendorPayoutTotalEvidence({
  evidence,
  summary,
}: {
  evidence: FinanceEvidence;
  summary?: FinanceSummary;
}) {
  const rows = (evidence.rows ?? []) as Array<{ total?: unknown }>;
  const rawTotal =
    typeof summary?.amount === "string"
      ? summary.amount
      : typeof rows[0]?.total === "string"
        ? rows[0].total
        : undefined;
  const period = formatPeriod(evidence.period?.start, evidence.period?.endExclusive);

  return (
    <div className="divide-y divide-border/60">
      {evidence.vendor?.name && <Field label="Vendor" value={evidence.vendor.name} />}
      {period && <Field label="Period" value={period} />}
      <Field label="Source" value={TEMPLATE_SOURCE.vendor_payout_total} />
      {rawTotal !== undefined && (
        <Field label="Result" value={formatCurrency(rawTotal, summary?.currency)} />
      )}
    </div>
  );
}

function VendorRankingEvidence({ evidence }: { evidence: FinanceEvidence }) {
  const rankings = evidence.rankings ?? [];
  const period = formatPeriod(evidence.period?.start, evidence.period?.endExclusive);

  return (
    <div>
      {period && (
        <>
          <Field label="Period" value={period} />
          <Separator className="my-1" />
        </>
      )}
      <Field label="Source" value={TEMPLATE_SOURCE.vendor_payout_by_vendor} />
      <ScrollArea className="mt-2 max-h-56">
        <ol className="space-y-1 pr-3">
          {rankings.map((row) => (
            <li
              key={`${row.rank}-${row.vendorCode ?? row.vendorName}`}
              className="flex items-center justify-between gap-3 rounded-xl px-3 py-2 text-sm odd:bg-muted/40"
            >
              <span className="flex min-w-0 items-center gap-2">
                <span className="text-xs tabular-nums text-muted-foreground">
                  {row.rank}
                </span>
                <span className="truncate font-medium">
                  {row.vendorName ?? row.vendorCode ?? "Unknown vendor"}
                </span>
              </span>
              <span className="shrink-0 tabular-nums text-foreground">
                {typeof row.total === "string" ? formatCurrency(row.total) : "—"}
              </span>
            </li>
          ))}
        </ol>
      </ScrollArea>
    </div>
  );
}

function UnreconciledTransactionsEvidence({ evidence }: { evidence: FinanceEvidence }) {
  const rows = (evidence.rows ?? []) as Array<{
    transactionReference?: string;
    transactionDate?: string;
    vendorName?: string;
    amount?: string;
    category?: string;
    reconciliationStatus?: string;
  }>;
  const period = formatPeriod(evidence.period?.start, evidence.period?.endExclusive);

  return (
    <div>
      {period && (
        <>
          <Field label="Period" value={period} />
          <Separator className="my-1" />
        </>
      )}
      <Field label="Source" value={TEMPLATE_SOURCE.unreconciled_transactions} />
      <Field label="Count" value={rows.length} />
      <ScrollArea className="mt-2 max-h-56">
        <ul className="space-y-1 pr-3">
          {rows.map((row, index) => (
            <li
              key={row.transactionReference ?? index}
              className="flex items-center justify-between gap-3 rounded-xl px-3 py-2 text-sm odd:bg-muted/40"
            >
              <span className="min-w-0">
                <span className="block truncate font-medium">
                  {row.vendorName ?? row.transactionReference ?? "Unknown vendor"}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {row.transactionDate}
                  {row.category ? ` · ${row.category}` : ""}
                </span>
              </span>
              <span className="shrink-0 tabular-nums text-foreground">
                {typeof row.amount === "string" ? formatCurrency(row.amount) : "—"}
              </span>
            </li>
          ))}
        </ul>
      </ScrollArea>
    </div>
  );
}

function TransactionAmountFilterEvidence({
  evidence,
  summary,
}: {
  evidence: FinanceEvidence;
  summary?: FinanceSummary;
}) {
  const threshold = evidence.amountLessThan;
  const count = summary?.count;
  const period = formatPeriod(evidence.period?.start, evidence.period?.endExclusive);

  return (
    <div className="divide-y divide-border/60">
      {threshold !== undefined && (
        <Field
          label="Amount below"
          value={
            typeof threshold === "number"
              ? formatCurrency(String(threshold))
              : String(threshold)
          }
        />
      )}
      {period && <Field label="Period" value={period} />}
      <Field label="Source" value={TEMPLATE_SOURCE.transaction_amount_filter} />
      {count !== undefined && <Field label="Matching transactions" value={count} />}
    </div>
  );
}

function GenericEvidence({ evidence }: { evidence: FinanceEvidence }) {
  const period = formatPeriod(evidence.period?.start, evidence.period?.endExclusive);

  return (
    <div className="divide-y divide-border/60">
      {evidence.vendor?.name && <Field label="Vendor" value={evidence.vendor.name} />}
      {period && <Field label="Period" value={period} />}
      <Field label="Source" value="Verified financial records" />
    </div>
  );
}

/**
 * Renders evidence.rows/rankings based on evidence.template, extensibly -
 * new templates fall back to GenericEvidence rather than crashing. Never
 * shows raw SQL or internal ids (e.g. transactionId is intentionally
 * omitted, transactionReference is a human-facing identifier).
 */
export function EvidencePanel({
  evidence,
  summary,
}: {
  evidence: FinanceEvidence;
  summary?: FinanceSummary;
}) {
  let body: ReactNode;

  switch (evidence.template) {
    case "vendor_payout_total":
      body = <VendorPayoutTotalEvidence evidence={evidence} summary={summary} />;
      break;
    case "vendor_payout_by_vendor":
      body = <VendorRankingEvidence evidence={evidence} />;
      break;
    case "unreconciled_transactions":
      body = <UnreconciledTransactionsEvidence evidence={evidence} />;
      break;
    case "transaction_amount_filter":
      body = (
        <TransactionAmountFilterEvidence evidence={evidence} summary={summary} />
      );
      break;
    default:
      body = <GenericEvidence evidence={evidence} />;
  }

  return (
    <div className="animate-in fade-in slide-in-from-top-1 mt-3 rounded-2xl border border-border/60 bg-muted/30 p-4 duration-200">
      <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Landmark className="size-3.5" />
        {evidence.template ? (TEMPLATE_LABELS[evidence.template] ?? "Verified answer") : "Verified answer"}
      </div>
      {body}
    </div>
  );
}
