import { Landmark } from "lucide-react";
import type { ReactNode } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { formatCurrency, formatPeriod } from "@/lib/format";
import type { FinanceEvidence, FinanceSummary } from "@/types/chat";

const TEMPLATE_LABELS: Record<string, string> = {
  transaction_spend_total: "Spend total",
  transaction_income_total: "Income total",
  transaction_count: "Transaction count",
  transaction_spend_by_bank: "Spend by bank",
  transaction_spend_by_program: "Spend by program",
  transaction_summary: "Activity summary",
  largest_transaction: "Largest transaction",
  transaction_lookup: "Transaction lookup",
  account_balance: "Account balance",
  financial_comparison: "Period comparison",
};

const MONTH_ABBR = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** Renders a single ISO transaction_date (not a start/end range) for display. */
function formatTransactionDate(iso: string): string | undefined {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return undefined;
  return `${MONTH_ABBR[date.getUTCMonth()]} ${date.getUTCDate()}, ${date.getUTCFullYear()}`;
}

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium text-foreground">{value}</span>
    </div>
  );
}

function AmountTotalEvidence({
  evidence,
  summary,
}: {
  evidence: FinanceEvidence;
  summary?: FinanceSummary;
}) {
  const rawAmount = typeof summary?.amount === "string" ? summary.amount : evidence.amount;
  const period = formatPeriod(evidence.period?.start, evidence.period?.endExclusive);

  return (
    <div className="divide-y divide-border/60">
      {evidence.bank?.code && <Field label="Bank" value={evidence.bank.name ?? evidence.bank.code} />}
      {evidence.programId !== undefined && <Field label="Program" value={evidence.programId} />}
      {evidence.account?.last4 && <Field label="Account" value={`•••• ${evidence.account.last4}`} />}
      {period && <Field label="Period" value={period} />}
      <Field label="Source" value="Verified transaction data" />
      {typeof rawAmount === "string" && (
        <Field label="Result" value={formatCurrency(rawAmount, summary?.currency)} />
      )}
    </div>
  );
}

function TransactionCountEvidence({ evidence }: { evidence: FinanceEvidence }) {
  const period = formatPeriod(evidence.period?.start, evidence.period?.endExclusive);

  return (
    <div className="divide-y divide-border/60">
      {evidence.transactionType && <Field label="Type" value={evidence.transactionType} />}
      {evidence.bank?.code && <Field label="Bank" value={evidence.bank.name ?? evidence.bank.code} />}
      {period && <Field label="Period" value={period} />}
      <Field label="Source" value="Verified transaction data" />
      {typeof evidence.count === "number" && <Field label="Count" value={evidence.count} />}
    </div>
  );
}

function RankingEvidence({ evidence }: { evidence: FinanceEvidence }) {
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
      <Field label="Source" value="Verified transaction data" />
      <ScrollArea className="mt-2 max-h-56">
        <ol className="space-y-1 pr-3">
          {rankings.map((row, index) => {
            const label =
              row.bankName ?? row.bankCode ?? (row.programId !== undefined ? `Program ${row.programId}` : "Unknown");
            const key = row.bankCode ?? row.programId ?? index;

            return (
              <li
                key={key}
                className="flex items-center justify-between gap-3 rounded-xl px-3 py-2 text-sm odd:bg-muted/40"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span className="text-xs tabular-nums text-muted-foreground">{index + 1}</span>
                  <span className="truncate font-medium">{label}</span>
                </span>
                <span className="shrink-0 tabular-nums text-foreground">
                  {typeof row.total === "string" ? formatCurrency(row.total) : "—"}
                </span>
              </li>
            );
          })}
        </ol>
      </ScrollArea>
    </div>
  );
}

function SummaryEvidence({ evidence }: { evidence: FinanceEvidence }) {
  const period = formatPeriod(evidence.period?.start, evidence.period?.endExclusive);

  return (
    <div className="divide-y divide-border/60">
      {period && <Field label="Period" value={period} />}
      <Field label="Source" value="Verified transaction data" />
      {typeof evidence.count === "number" && <Field label="Transactions" value={evidence.count} />}
      {typeof evidence.debitTotal === "string" && <Field label="Debits" value={formatCurrency(evidence.debitTotal)} />}
      {typeof evidence.creditTotal === "string" && <Field label="Credits" value={formatCurrency(evidence.creditTotal)} />}
      {typeof evidence.net === "string" && <Field label="Net" value={formatCurrency(evidence.net)} />}
    </div>
  );
}

function TransactionEvidence({ evidence }: { evidence: FinanceEvidence }) {
  const transaction = evidence.transaction;
  const period = formatPeriod(evidence.period?.start, evidence.period?.endExclusive);

  return (
    <div className="divide-y divide-border/60">
      {period && <Field label="Period" value={period} />}
      <Field label="Source" value="Verified transaction data" />
      {transaction?.transactionDate && (
        <Field label="Date" value={formatTransactionDate(transaction.transactionDate) ?? transaction.transactionDate} />
      )}
      {transaction?.transactionType && <Field label="Type" value={transaction.transactionType} />}
      {typeof transaction?.amount === "string" && <Field label="Amount" value={formatCurrency(transaction.amount)} />}
      {transaction?.reference && <Field label="Reference" value={transaction.reference} />}
      {transaction?.description && <Field label="Description" value={transaction.description} />}
      {transaction?.bank?.code && <Field label="Bank" value={transaction.bank.name ?? transaction.bank.code} />}
      {transaction?.programId !== undefined && <Field label="Program" value={transaction.programId} />}
    </div>
  );
}

function AccountBalanceEvidence({ evidence }: { evidence: FinanceEvidence }) {
  return (
    <div className="divide-y divide-border/60">
      {evidence.bank?.code && <Field label="Bank" value={evidence.bank.name ?? evidence.bank.code} />}
      {evidence.account?.last4 && <Field label="Account" value={`•••• ${evidence.account.last4}`} />}
      {evidence.programId !== undefined && <Field label="Program" value={evidence.programId} />}
      <Field label="Source" value="Verified account data" />
      {typeof evidence.availableBalance === "string" && (
        <Field label="Available balance" value={formatCurrency(evidence.availableBalance)} />
      )}
    </div>
  );
}

function ComparisonEvidence({ evidence }: { evidence: FinanceEvidence }) {
  const primaryPeriod = formatPeriod(evidence.primaryPeriod?.start, evidence.primaryPeriod?.endExclusive);
  const secondaryPeriod = formatPeriod(evidence.secondaryPeriod?.start, evidence.secondaryPeriod?.endExclusive);
  const isCount = evidence.metric === "transaction_count";

  return (
    <div className="divide-y divide-border/60">
      {evidence.metric && <Field label="Metric" value={evidence.metric} />}
      <Field label="Source" value="Verified transaction data" />
      {primaryPeriod && typeof evidence.primaryValue === "string" && (
        <Field
          label={primaryPeriod}
          value={isCount ? evidence.primaryValue : formatCurrency(evidence.primaryValue)}
        />
      )}
      {secondaryPeriod && typeof evidence.secondaryValue === "string" && (
        <Field
          label={secondaryPeriod}
          value={isCount ? evidence.secondaryValue : formatCurrency(evidence.secondaryValue)}
        />
      )}
    </div>
  );
}

function GenericEvidence({ evidence }: { evidence: FinanceEvidence }) {
  const period = formatPeriod(evidence.period?.start, evidence.period?.endExclusive);

  return (
    <div className="divide-y divide-border/60">
      {evidence.bank?.code && <Field label="Bank" value={evidence.bank.name ?? evidence.bank.code} />}
      {period && <Field label="Period" value={period} />}
      <Field label="Source" value="Verified financial records" />
    </div>
  );
}

/**
 * Renders evidence based on evidence.template, extensibly - unrecognized
 * templates fall back to GenericEvidence rather than crashing. Never
 * shows raw SQL or internal/sensitive ids: account_number and utr_number
 * are never part of the API contract in the first place, and only
 * last4/masked account references are ever rendered here.
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
    case "transaction_spend_total":
    case "transaction_income_total":
      body = <AmountTotalEvidence evidence={evidence} summary={summary} />;
      break;
    case "transaction_count":
      body = <TransactionCountEvidence evidence={evidence} />;
      break;
    case "transaction_spend_by_bank":
    case "transaction_spend_by_program":
      body = <RankingEvidence evidence={evidence} />;
      break;
    case "transaction_summary":
      body = <SummaryEvidence evidence={evidence} />;
      break;
    case "largest_transaction":
    case "transaction_lookup":
      body = <TransactionEvidence evidence={evidence} />;
      break;
    case "account_balance":
      body = <AccountBalanceEvidence evidence={evidence} />;
      break;
    case "financial_comparison":
      body = <ComparisonEvidence evidence={evidence} />;
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
